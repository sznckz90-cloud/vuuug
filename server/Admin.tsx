import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAdmin } from "@/hooks/useAdmin";
import Layout from "@/components/Layout";
import { Link } from "wouter";
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { formatCurrency } from "@/lib/utils";

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  balance: string;
  totalEarned: string;
  adsWatched: number;
  dailyAdsWatched: number;
  level: number;
  banned: boolean;
  createdAt: string;
}


interface AdminStats {
  totalUsers: number;
  totalEarnings: string;
  totalWithdrawals: string;
  pendingWithdrawals: number;
  dailyActiveUsers: number;
  totalAdsWatched: number;
}

function WithdrawalRequestCard({ withdrawal, onUpdate }: { withdrawal: any; onUpdate: () => void }) {
  const { toast } = useToast();
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [transactionHash, setTransactionHash] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);

  const handleApprove = async () => {
    if (!transactionHash.trim()) {
      toast({
        title: "Transaction Hash Required",
        description: "Please enter the transaction hash to approve payment",
        variant: "destructive",
      });
      return;
    }

    setIsApproving(true);
    try {
      const response = await apiRequest('POST', `/api/admin/withdrawals/${withdrawal.id}/approve`, {
        transactionHash: transactionHash.trim(),
        adminNotes: 'Payment processed'
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: "✅ Payment Approved",
          description: `Withdrawal of ${formatCurrency(withdrawal.amount)} has been approved and user notified`,
        });
        setShowApproveDialog(false);
        setTransactionHash('');
        onUpdate();
      } else {
        throw new Error(result.message || 'Failed to approve withdrawal');
      }
    } catch (error: any) {
      toast({
        title: "Approval Failed",
        description: error.message || "Failed to approve withdrawal",
        variant: "destructive",
      });
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async () => {
    setIsRejecting(true);
    try {
      const response = await apiRequest('POST', `/api/admin/withdrawals/${withdrawal.id}/reject`, {
        adminNotes: rejectionReason.trim() || 'No reason provided',
        reason: rejectionReason.trim() || 'No reason provided'
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: "❌ Payment Rejected",
          description: `Withdrawal request has been rejected and user notified`,
        });
        setShowRejectDialog(false);
        setRejectionReason('');
        onUpdate();
      } else {
        throw new Error(result.message || 'Failed to reject withdrawal');
      }
    } catch (error: any) {
      toast({
        title: "Rejection Failed",
        description: error.message || "Failed to reject withdrawal",
        variant: "destructive",
      });
    } finally {
      setIsRejecting(false);
    }
  };

  const getStatusBadge = () => {
    switch (withdrawal.status) {
      case 'paid':
      case 'Successfull':
      case 'Approved':
      case 'success':
        return <Badge className="bg-green-600">Success</Badge>;
      case 'rejected':
        return <Badge className="bg-red-600">Rejected</Badge>;
      default:
        return <Badge className="bg-yellow-600">Pending</Badge>;
    }
  };

  return (
    <Card className="border-l-4 border-l-orange-500">
      <CardContent className="p-4">
        <div className="space-y-3">
          <div className="flex items-start justify-between">
            <div className="space-y-2 flex-1">
              <div>
                <span className="text-sm font-medium text-muted-foreground">User:</span>
                <p className="font-semibold">@{withdrawal.user?.username || withdrawal.user?.telegram_id}</p>
              </div>
              
              <div>
                <span className="text-sm font-medium text-muted-foreground">Amount:</span>
                <p className="text-lg font-bold text-green-600">{formatCurrency(withdrawal.amount || '0')}</p>
              </div>

              <div>
                <span className="text-sm font-medium text-muted-foreground">Wallet Address:</span>
                <p className="text-sm break-all font-mono bg-muted p-2 rounded">{withdrawal.details?.paymentDetails || 'N/A'}</p>
              </div>

              {withdrawal.comment && (
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Comment:</span>
                  <p className="text-sm text-blue-600">💬 {withdrawal.comment}</p>
                </div>
              )}

              <div className="flex items-center gap-4">
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Method:</span>
                  <Badge variant="outline" className="ml-2">{withdrawal.method || 'Unknown'}</Badge>
                </div>
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Status:</span>
                  <span className="ml-2">{getStatusBadge()}</span>
                </div>
              </div>

              <div>
                <span className="text-sm font-medium text-muted-foreground">Date/Time (UTC):</span>
                <p className="text-sm">{new Date(withdrawal.createdAt || withdrawal.created_on).toUTCString()}</p>
              </div>
            </div>
          </div>

          {withdrawal.status === 'pending' && (
            <div className="space-y-2 pt-2 border-t">
              {!showApproveDialog && !showRejectDialog ? (
                <div className="space-y-2">
                  <Button 
                    onClick={() => setShowApproveDialog(true)}
                    className="w-full bg-green-600 hover:bg-green-700"
                  >
                    <i className="fas fa-check mr-2"></i>
                    Approve Payment
                  </Button>
                  <Button 
                    onClick={() => setShowRejectDialog(true)}
                    variant="destructive"
                    className="w-full"
                  >
                    <i className="fas fa-times mr-2"></i>
                    Reject Payment
                  </Button>
                </div>
              ) : showApproveDialog ? (
                <div className="w-full space-y-2">
                  <Label htmlFor="txHash">Transaction Hash / Payment Link</Label>
                  <Input
                    id="txHash"
                    value={transactionHash}
                    onChange={(e) => setTransactionHash(e.target.value)}
                    placeholder="Enter transaction hash..."
                  />
                  <div className="space-y-2">
                    <Button 
                      onClick={handleApprove}
                      disabled={isApproving || !transactionHash.trim()}
                      className="w-full bg-green-600 hover:bg-green-700"
                    >
                      {isApproving ? (
                        <>
                          <i className="fas fa-spinner fa-spin mr-2"></i>
                          Processing...
                        </>
                      ) : (
                        <>
                          <i className="fas fa-check mr-2"></i>
                          Confirm Approval
                        </>
                      )}
                    </Button>
                    <Button 
                      onClick={() => {
                        setShowApproveDialog(false);
                        setTransactionHash('');
                      }}
                      variant="outline"
                      className="w-full"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="w-full space-y-2">
                  <Label htmlFor="reason">Rejection Reason (Optional)</Label>
                  <Textarea
                    id="reason"
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Enter rejection reason..."
                    rows={2}
                  />
                  <div className="space-y-2">
                    <Button 
                      onClick={handleReject}
                      disabled={isRejecting}
                      variant="destructive"
                      className="w-full"
                    >
                      {isRejecting ? (
                        <>
                          <i className="fas fa-spinner fa-spin mr-2"></i>
                          Processing...
                        </>
                      ) : (
                        <>
                          <i className="fas fa-times mr-2"></i>
                          Confirm Rejection
                        </>
                      )}
                    </Button>
                    <Button 
                      onClick={() => {
                        setShowRejectDialog(false);
                        setRejectionReason('');
                      }}
                      variant="outline"
                      className="w-full"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminPage() {
  const { toast } = useToast();
  const { isAdmin, isLoading: adminLoading } = useAdmin();
  const queryClient = useQueryClient();

  // Fetch admin stats - hooks must be called before any conditional returns
  const { data: stats } = useQuery<AdminStats>({
    queryKey: ["/api/admin/stats"],
    refetchInterval: 30000,
    enabled: isAdmin,
  });

  // Fetch pending withdrawals
  const { data: withdrawalsData, isLoading: withdrawalsLoading } = useQuery({
    queryKey: ["/api/admin/withdrawals/pending"],
    queryFn: () => apiRequest("GET", "/api/admin/withdrawals/pending").then(res => res.json()),
    refetchInterval: 30000,
    enabled: isAdmin,
  });

  // Fetch processed withdrawals (approved/rejected)
  const { data: processedData, isLoading: processedLoading } = useQuery({
    queryKey: ["/api/admin/withdrawals/processed"],
    queryFn: () => apiRequest("GET", "/api/admin/withdrawals/processed").then(res => res.json()),
    refetchInterval: 30000,
    enabled: isAdmin,
  });

  // Fetch chart analytics data
  const { data: chartData } = useQuery({
    queryKey: ["/api/admin/analytics/chart"],
    queryFn: () => apiRequest("GET", "/api/admin/analytics/chart").then(res => res.json()),
    refetchInterval: 30000,
    enabled: isAdmin,
  });

  // Admin access check - now after all hooks
  if (adminLoading) {
    return (
      <Layout>
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin text-primary text-3xl mb-4">
              <i className="fas fa-spinner"></i>
            </div>
            <div className="text-foreground font-medium">Loading...</div>
          </div>
        </div>
      </Layout>
    );
  }

  if (!isAdmin) {
    return (
      <Layout>
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center">
            <div className="text-red-500 text-5xl mb-4">
              <i className="fas fa-exclamation-triangle"></i>
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">Access Denied</h1>
            <p className="text-muted-foreground mb-4">You don't have permission to access this page.</p>
            <Link href="/">
              <Button>Return Home</Button>
            </Link>
          </div>
        </div>
      </Layout>
    );
  }







  return (
    <Layout>
      <main className="max-w-6xl mx-auto px-4 pb-20">
        <div className="py-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-foreground flex items-center">
                <i className="fas fa-crown text-orange-600 mr-3"></i>
                Admin Dashboard
              </h1>
              <p className="text-muted-foreground">Manage your crypto earning platform</p>
            </div>
            <div className="flex items-center gap-3">
              <Button 
                size="sm"
                variant="outline"
                onClick={() => {
                  queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
                  queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
                  queryClient.invalidateQueries({ queryKey: ["/api/admin/promotions/pending"] });
                  queryClient.invalidateQueries({ queryKey: ["/api/admin/withdrawals/pending"] });
                  queryClient.invalidateQueries({ queryKey: ["/api/admin/withdrawals/processed"] });
                  toast({ title: "Data refreshed successfully" });
                }}
                data-testid="button-refresh-data"
                className="h-8 w-8 p-0"
              >
                <i className="fas fa-sync-alt"></i>
              </Button>
              <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                Administrator
              </Badge>
            </div>
          </div>

          <Tabs defaultValue="analytics" className="w-full">
            <div className="overflow-x-auto scrollbar-hide mb-6 -mx-4 px-4">
              <TabsList className="flex w-max min-w-full">
                <TabsTrigger value="withdrawals" data-testid="tab-withdrawals" className="flex-1 min-w-[140px]">
                  <i className="fas fa-money-bill-wave mr-2"></i>
                  Withdrawals
                </TabsTrigger>
                <TabsTrigger value="analytics" data-testid="tab-analytics" className="flex-1 min-w-[140px]">
                  <i className="fas fa-chart-area mr-2"></i>
                  Analytics
                </TabsTrigger>
                <TabsTrigger value="user-tracking" data-testid="tab-user-tracking" className="flex-1 min-w-[140px]">
                  <i className="fas fa-user-search mr-2"></i>
                  User Tracking
                </TabsTrigger>
                <TabsTrigger value="promo-creator" data-testid="tab-promo-creator" className="flex-1 min-w-[140px]">
                  <i className="fas fa-tag mr-2"></i>
                  Promo Creator
                </TabsTrigger>
                <TabsTrigger value="settings" data-testid="tab-settings" className="flex-1 min-w-[140px]">
                  <i className="fas fa-cog mr-2"></i>
                  Settings
                </TabsTrigger>
              </TabsList>
            </div>


            {/* Withdrawals Tab */}
            <TabsContent value="withdrawals" className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-4 flex items-center">
                  <i className="fas fa-clock mr-2 text-orange-600"></i>
                  Pending Withdrawal Requests
                </h2>
                <Card>
                  <CardContent className="p-0">
                    <div className="max-h-[280px] overflow-y-auto p-4">
                      {withdrawalsLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <i className="fas fa-spinner fa-spin text-2xl text-muted-foreground"></i>
                          <p className="ml-2 text-muted-foreground">Loading withdrawals...</p>
                        </div>
                      ) : withdrawalsData?.withdrawals && withdrawalsData.withdrawals.length > 0 ? (
                        <div className="space-y-4">
                          {withdrawalsData.withdrawals.map((withdrawal: any) => (
                            <WithdrawalRequestCard 
                              key={withdrawal.id} 
                              withdrawal={withdrawal}
                              onUpdate={() => {
                                queryClient.invalidateQueries({ queryKey: ["/api/admin/withdrawals/pending"] });
                                queryClient.invalidateQueries({ queryKey: ["/api/admin/withdrawals/processed"] });
                              }}
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          <i className="fas fa-inbox text-4xl mb-4 opacity-50"></i>
                          <p>No pending withdrawal requests</p>
                          <p className="text-sm">Pending requests will appear here</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div>
                <h2 className="text-xl font-semibold mb-4 flex items-center">
                  <i className="fas fa-history mr-2 text-indigo-600"></i>
                  Processed Withdrawals
                </h2>
                <Card>
                  <CardContent className="p-0">
                    <div className="max-h-[280px] overflow-y-auto p-4">
                      {processedLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <i className="fas fa-spinner fa-spin text-2xl text-muted-foreground"></i>
                          <p className="ml-2 text-muted-foreground">Loading processed withdrawals...</p>
                        </div>
                      ) : processedData?.withdrawals && processedData.withdrawals.length > 0 ? (
                        <div className="space-y-4">
                          {processedData.withdrawals.map((withdrawal: any) => (
                            <WithdrawalRequestCard 
                              key={withdrawal.id} 
                              withdrawal={withdrawal}
                              onUpdate={() => {
                                queryClient.invalidateQueries({ queryKey: ["/api/admin/withdrawals/processed"] });
                              }}
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          <i className="fas fa-check-circle text-4xl mb-4 opacity-50"></i>
                          <p>No processed withdrawals</p>
                          <p className="text-sm">Approved and rejected requests will appear here</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Analytics Tab */}
            <TabsContent value="analytics" className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-4 flex items-center">
                  <i className="fas fa-chart-area mr-2 text-indigo-600"></i>
                  Advanced Analytics
                </h2>
                
                {/* Trading-Style Analytics Dashboard */}
                <Card className="border-2">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-xl flex items-center justify-between">
                      <span className="flex items-center">
                        <i className="fas fa-chart-candlestick mr-2 text-indigo-600"></i>
                        Real-Time Trading Analytics
                      </span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                          <i className="fas fa-circle text-green-500 text-xs mr-1"></i>
                          Live
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          Updates every 30s
                        </Badge>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {/* Quick Stats Row - Fixed overflow with proper text wrapping */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                      <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-blue-600 text-xs font-medium uppercase tracking-wide">Total Users</p>
                            <p className="text-2xl font-bold text-blue-900 truncate">
                              {stats?.totalUsers?.toLocaleString() || '0'}
                            </p>
                            <p className="text-blue-600 text-xs mt-1">
                              <i className="fas fa-arrow-up text-green-600 mr-1"></i>
                              Growing
                            </p>
                          </div>
                          <i className="fas fa-users text-blue-600 text-2xl flex-shrink-0"></i>
                        </div>
                      </div>
                      
                      <div className="bg-gradient-to-r from-green-50 to-green-100 p-4 rounded-lg border border-green-200">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-green-600 text-xs font-medium uppercase tracking-wide">Total Ads</p>
                            <p className="text-2xl font-bold text-green-900 truncate">
                              {stats?.totalAdsWatched?.toLocaleString() || '0'}
                            </p>
                            <p className="text-green-600 text-xs mt-1">
                              <i className="fas fa-video text-green-600 mr-1"></i>
                              All time
                            </p>
                          </div>
                          <i className="fas fa-play-circle text-green-600 text-2xl flex-shrink-0"></i>
                        </div>
                      </div>
                      
                      <div className="bg-gradient-to-r from-purple-50 to-purple-100 p-4 rounded-lg border border-purple-200">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-purple-600 text-xs font-medium uppercase tracking-wide">Total Withdrawn</p>
                            <p className="text-xl font-bold text-purple-900 break-words">
                              {formatCurrency(stats?.totalWithdrawals || '0')}
                            </p>
                            <p className="text-purple-600 text-xs mt-1">
                              <i className="fas fa-clock text-purple-600 mr-1"></i>
                              {stats?.pendingWithdrawals || 0} pending
                            </p>
                          </div>
                          <i className="fas fa-money-bill-wave text-purple-600 text-2xl flex-shrink-0"></i>
                        </div>
                      </div>
                      
                      <div className="bg-gradient-to-r from-orange-50 to-orange-100 p-4 rounded-lg border border-orange-200">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-orange-600 text-xs font-medium uppercase tracking-wide">Active Users</p>
                            <p className="text-2xl font-bold text-orange-900 truncate">
                              {stats?.dailyActiveUsers?.toLocaleString() || '0'}
                            </p>
                            <p className="text-orange-600 text-xs mt-1">
                              <i className="fas fa-clock text-orange-600 mr-1"></i>
                              Last 24h
                            </p>
                          </div>
                          <i className="fas fa-chart-line text-orange-600 text-2xl flex-shrink-0"></i>
                        </div>
                      </div>
                    </div>

                    {/* Enhanced Trading Chart */}
                    <div className="bg-gray-900 rounded-lg p-4 border">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-white font-semibold flex items-center">
                          <i className="fas fa-chart-candlestick mr-2 text-green-400"></i>
                          Platform Performance Chart
                        </h3>
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="outline" className="text-xs bg-gray-800 border-gray-700 text-gray-300">
                            <i className="fas fa-expand-arrows-alt mr-1"></i>
                            Fullscreen
                          </Button>
                        </div>
                      </div>
                      
                      <div className="h-80 w-full">
                        {chartData?.success && chartData?.data ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData.data}>
                              <defs>
                                <linearGradient id="usersGradient" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05}/>
                                </linearGradient>
                                <linearGradient id="earningsGradient" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.05}/>
                                </linearGradient>
                                <linearGradient id="withdrawalsGradient" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.05}/>
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.5} />
                              <XAxis 
                                dataKey="period" 
                                tick={{ fontSize: 11, fill: '#9ca3af' }}
                                axisLine={{ stroke: '#4b5563' }}
                                tickLine={{ stroke: '#4b5563' }}
                              />
                              <YAxis 
                                tick={{ fontSize: 11, fill: '#9ca3af' }}
                                axisLine={{ stroke: '#4b5563' }}
                                tickLine={{ stroke: '#4b5563' }}
                              />
                              <Tooltip 
                                contentStyle={{ 
                                  backgroundColor: '#1f2937', 
                                  border: '1px solid #374151', 
                                  borderRadius: '8px',
                                  color: '#f9fafb',
                                  fontSize: '12px'
                                }}
                                labelStyle={{ color: '#e5e7eb', fontWeight: 'bold' }}
                                formatter={(value: any, name: string) => [
                                  name === 'earnings' || name === 'withdrawals' 
                                    ? formatCurrency(value) 
                                    : value.toLocaleString(),
                                  name.charAt(0).toUpperCase() + name.slice(1)
                                ]}
                              />
                              <Area 
                                type="monotone" 
                                dataKey="users" 
                                stroke="#3b82f6" 
                                fill="url(#usersGradient)" 
                                strokeWidth={2}
                                name="users"
                                dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                                activeDot={{ r: 6, stroke: '#3b82f6', strokeWidth: 2, fill: '#ffffff' }}
                              />
                              <Area 
                                type="monotone" 
                                dataKey="earnings" 
                                stroke="#10b981" 
                                fill="url(#earningsGradient)" 
                                strokeWidth={2}
                                name="earnings"
                                dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
                                activeDot={{ r: 6, stroke: '#10b981', strokeWidth: 2, fill: '#ffffff' }}
                              />
                              <Area 
                                type="monotone" 
                                dataKey="withdrawals" 
                                stroke="#f59e0b" 
                                fill="url(#withdrawalsGradient)" 
                                strokeWidth={2}
                                name="withdrawals"
                                dot={{ fill: '#f59e0b', strokeWidth: 2, r: 4 }}
                                activeDot={{ r: 6, stroke: '#f59e0b', strokeWidth: 2, fill: '#ffffff' }}
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="flex items-center justify-center h-full text-gray-400">
                            <div className="text-center">
                              <i className="fas fa-spinner fa-spin text-3xl mb-4"></i>
                              <p>Loading live analytics data...</p>
                            </div>
                          </div>
                        )}
                      </div>
                      
                      {/* Chart Legend */}
                      <div className="flex items-center justify-center gap-6 mt-4 text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                          <span className="text-gray-300">User Growth</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                          <span className="text-gray-300">Earnings</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                          <span className="text-gray-300">Withdrawals</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* User Tracking Tab */}
            <TabsContent value="user-tracking" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>User Tracking</CardTitle>
                </CardHeader>
                <CardContent>
                  <UserTrackingSearch />
                </CardContent>
              </Card>
            </TabsContent>

            {/* Promo Creator Tab */}
            <TabsContent value="promo-creator" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <i className="fas fa-tag mr-2 text-blue-600"></i>
                    Create Promo Code
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <PromoCodeCreator />
                </CardContent>
              </Card>
            </TabsContent>

            {/* Settings Tab */}
            <TabsContent value="settings" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <i className="fas fa-cog mr-2 text-indigo-600"></i>
                    App Settings
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <SettingsSection />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </Layout>
  );
}

function UserTrackingSearch() {
  const [uid, setUid] = useState('');
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async () => {
    if (!uid.trim()) {
      setError('Please enter a UID');
      return;
    }

    setLoading(true);
    setError('');
    setUserData(null);

    try {
      const response = await apiRequest('GET', `/api/admin/user-tracking/${uid.trim()}`);
      const data = await response.json();
      
      if (data.success) {
        setUserData(data.user);
      } else {
        setError(data.message || 'User not found');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch user data');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    }) + ', at ' + date.toLocaleTimeString('en-GB', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder="Enter UID (referral code) or User ID"
          value={uid}
          onChange={(e) => setUid(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          className="flex-1"
        />
        <Button onClick={handleSearch} disabled={loading}>
          {loading ? (
            <><i className="fas fa-spinner fa-spin mr-2"></i>Searching...</>
          ) : (
            <><i className="fas fa-search mr-2"></i>Search</>
          )}
        </Button>
      </div>

      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {userData && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">UID</p>
                  <p className="font-semibold">{userData.uid}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <p className="font-semibold">{userData.status}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Balance</p>
                  <p className="font-semibold">{Math.round(parseFloat(userData.balance || '0') * 100000)} PAD</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Earnings</p>
                  <p className="font-semibold">{Math.round(parseFloat(userData.totalEarnings || '0') * 100000)} PAD</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Withdrawals</p>
                  <p className="font-semibold">{userData.withdrawalCount}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Referral Count</p>
                  <p className="font-semibold">{userData.referralCount}</p>
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Joined Date</p>
                <p className="font-semibold">{formatDate(userData.joinedDate)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Ads Watched</p>
                <p className="font-semibold">{userData.adsWatched}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Current Wallet</p>
                <p className="font-semibold text-sm break-all font-mono bg-muted p-2 rounded">{userData.walletAddress || 'Not set'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SettingsSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isUpdating, setIsUpdating] = useState(false);
  const [settings, setSettings] = useState({
    dailyAdLimit: '',
    rewardPerAd: ''
  });

  // Fetch current settings
  const { data: settingsData, isLoading } = useQuery({
    queryKey: ["/api/admin/settings"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/admin/settings");
      return response.json();
    },
  });

  // Update local state when data loads
  useEffect(() => {
    if (settingsData) {
      setSettings({
        dailyAdLimit: settingsData.dailyAdLimit?.toString() || '',
        rewardPerAd: settingsData.rewardPerAd?.toString() || ''
      });
    }
  }, [settingsData]);

  const handleUpdateSettings = async () => {
    if (!settings.dailyAdLimit || !settings.rewardPerAd) {
      toast({
        title: "Validation Error",
        description: "Both fields are required",
        variant: "destructive",
      });
      return;
    }

    const dailyAdLimit = parseInt(settings.dailyAdLimit);
    const rewardPerAd = parseInt(settings.rewardPerAd);

    if (isNaN(dailyAdLimit) || dailyAdLimit <= 0) {
      toast({
        title: "Validation Error",
        description: "Daily ad limit must be a positive number",
        variant: "destructive",
      });
      return;
    }

    if (isNaN(rewardPerAd) || rewardPerAd <= 0) {
      toast({
        title: "Validation Error",
        description: "Reward per ad must be a positive number",
        variant: "destructive",
      });
      return;
    }

    setIsUpdating(true);
    try {
      const response = await apiRequest('PUT', '/api/admin/settings', {
        dailyAdLimit,
        rewardPerAd
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: "✅ Settings Updated Successfully!",
          description: `Ad limit: ${dailyAdLimit}/day, Reward: ${rewardPerAd} PAD per ad`,
        });
        
        // Invalidate app settings cache so users get updated values
        queryClient.invalidateQueries({ queryKey: ["/api/app-settings"] });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
      } else {
        throw new Error(result.message || 'Failed to update settings');
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update settings",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <i className="fas fa-spinner fa-spin text-2xl text-muted-foreground mr-2"></i>
        <p className="text-muted-foreground">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <Label htmlFor="daily-ad-limit">Daily Ad Limit</Label>
          <Input
            id="daily-ad-limit"
            type="number"
            placeholder="e.g., 50"
            value={settings.dailyAdLimit}
            onChange={(e) => setSettings({ ...settings, dailyAdLimit: e.target.value })}
            min="1"
          />
          <p className="text-sm text-muted-foreground mt-1">
            Maximum ads users can watch per day
          </p>
        </div>
        <div>
          <Label htmlFor="reward-per-ad">Reward Per Ad (PAD)</Label>
          <Input
            id="reward-per-ad"
            type="number"
            placeholder="e.g., 1000"
            value={settings.rewardPerAd}
            onChange={(e) => setSettings({ ...settings, rewardPerAd: e.target.value })}
            min="1"
            step="100"
          />
          <p className="text-sm text-muted-foreground mt-1">
            PAD tokens earned per ad watched
          </p>
        </div>
      </div>

      <Button 
        onClick={handleUpdateSettings}
        disabled={isUpdating}
        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl"
      >
        {isUpdating ? (
          <>
            <i className="fas fa-spinner fa-spin mr-2"></i>
            Updating...
          </>
        ) : (
          <>
            <i className="fas fa-save mr-2"></i>
            Save Settings
          </>
        )}
      </Button>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <i className="fas fa-info-circle text-blue-600 mt-1 mr-3"></i>
          <div>
            <p className="font-semibold text-blue-900 mb-1">Important Note</p>
            <p className="text-sm text-blue-800">
              Changes will take effect immediately for all users. The app will automatically refresh settings every minute.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function PromoCodeCreator() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    code: '',
    rewardAmount: '',
    usageLimit: '',
    perUserLimit: '1',
    expiresAt: ''
  });

  const [isCreating, setIsCreating] = useState(false);

  const { data: promoCodesData } = useQuery({
    queryKey: ["/api/admin/promo-codes"],
    queryFn: () => apiRequest("GET", "/api/admin/promo-codes").then(res => res.json()),
    refetchInterval: 5000,
  });

  const handleCreate = async () => {
    if (!formData.code.trim() || !formData.rewardAmount) {
      toast({
        title: "Validation Error",
        description: "Promo code and reward amount are required",
        variant: "destructive",
      });
      return;
    }

    const rewardAmountNum = parseFloat(formData.rewardAmount);
    if (isNaN(rewardAmountNum) || rewardAmountNum <= 0) {
      toast({
        title: "Validation Error",
        description: "Reward amount must be a positive number",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);
    try {
      const response = await apiRequest('POST', '/api/promo-codes/create', {
        code: formData.code.trim().toUpperCase(),
        rewardAmount: rewardAmountNum,
        usageLimit: formData.usageLimit ? parseInt(formData.usageLimit) : null,
        perUserLimit: parseInt(formData.perUserLimit),
        expiresAt: formData.expiresAt || null
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: "Success!",
          description: "Promo code created successfully",
        });
        setFormData({
          code: '',
          rewardAmount: '',
          usageLimit: '',
          perUserLimit: '1',
          expiresAt: ''
        });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/promo-codes"] });
      } else {
        throw new Error(result.message || 'Failed to create promo code');
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create promo code",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const promoCodes = promoCodesData?.promoCodes || [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="promo-code">Promo Code *</Label>
          <Input
            id="promo-code"
            placeholder="Enter promo code (e.g., WELCOME50)"
            value={formData.code}
            onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
            maxLength={20}
          />
        </div>
        <div>
          <Label htmlFor="reward-amount">Per User Claim Amount (PAD) *</Label>
          <Input
            id="reward-amount"
            type="number"
            placeholder="Enter PAD amount"
            value={formData.rewardAmount}
            onChange={(e) => setFormData({ ...formData, rewardAmount: e.target.value })}
            min="0"
            step="1000"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="max-users">Max Users Allowed</Label>
          <Input
            id="max-users"
            type="number"
            placeholder="Leave empty for unlimited"
            value={formData.usageLimit}
            onChange={(e) => setFormData({ ...formData, usageLimit: e.target.value })}
            min="1"
          />
        </div>
        <div>
          <Label htmlFor="expiry-date">Expiry Date</Label>
          <Input
            id="expiry-date"
            type="datetime-local"
            value={formData.expiresAt}
            onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="per-user-limit">Per User Claim Limit</Label>
        <Input
          id="per-user-limit"
          type="number"
          placeholder="1"
          value={formData.perUserLimit}
          onChange={(e) => setFormData({ ...formData, perUserLimit: e.target.value })}
          min="1"
        />
      </div>

      <Button 
        onClick={handleCreate}
        disabled={isCreating}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl"
      >
        {isCreating ? (
          <>
            <i className="fas fa-spinner fa-spin mr-2"></i>
            Creating...
          </>
        ) : (
          <>
            <i className="fas fa-plus mr-2"></i>
            Create Promo Code
          </>
        )}
      </Button>

      {promoCodes.length > 0 && (
        <div className="mt-8">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <i className="fas fa-list mr-2 text-blue-600"></i>
            Active Promo Codes
          </h3>
          <div className="space-y-3">
            {promoCodes.map((promo: any) => (
              <Card key={promo.id} className="border-l-4 border-l-blue-500">
                <CardContent className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Code</p>
                      <p className="font-bold text-lg">{promo.code}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Reward Amount</p>
                      <p className="font-semibold">{Math.round(parseFloat(promo.rewardAmount) * 100000)} PAD</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Claimed / Remaining</p>
                      <p className="font-semibold text-blue-600">
                        {promo.usageCount} / {promo.remainingCount === 'Unlimited' ? '∞' : promo.remainingCount}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total PAD Distributed</p>
                      <p className="font-semibold text-green-600">
                        {Math.round(parseFloat(promo.totalDistributed) * 100000).toLocaleString()} PAD
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Status</p>
                      <Badge variant={promo.isActive ? "default" : "secondary"}>
                        {promo.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    {promo.expiresAt && (
                      <div>
                        <p className="text-sm text-muted-foreground">Expires At</p>
                        <p className="text-sm">{new Date(promo.expiresAt).toLocaleString()}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}