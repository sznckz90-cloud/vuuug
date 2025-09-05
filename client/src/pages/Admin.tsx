import { useState } from "react";
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

interface Withdrawal {
  id: string;
  userId: string;
  amount: string;
  method: string;
  status: string;
  details: any;
  transactionHash?: string;
  adminNotes?: string;
  createdAt: string;
  user?: {
    firstName: string;
    lastName: string;
    email: string;
  };
}

interface AdminStats {
  totalUsers: number;
  totalEarnings: string;
  totalWithdrawals: string;
  pendingWithdrawals: number;
  dailyActiveUsers: number;
  totalAdsWatched: number;
}

interface PromoCode {
  id: string;
  code: string;
  rewardAmount: string;
  rewardCurrency: string;
  usageLimit: number;
  usageCount: number;
  perUserLimit: number;
  isActive: boolean;
  expiresAt: string;
  createdAt: string;
}

export default function AdminPage() {
  const { toast } = useToast();
  const { isAdmin, isLoading: adminLoading } = useAdmin();
  const queryClient = useQueryClient();
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<Withdrawal | null>(null);
  const [updateData, setUpdateData] = useState({
    status: '',
    transactionHash: '',
    adminNotes: ''
  });

  // Promo code form state
  const [promoForm, setPromoForm] = useState({
    code: '',
    rewardAmount: '',
    rewardCurrency: 'USDT',
    usageLimit: '',
    perUserLimit: '1',
    expiresAt: ''
  });

  // Admin access check
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

  // Fetch admin stats
  const { data: stats } = useQuery<AdminStats>({
    queryKey: ["/api/admin/stats"],
    refetchInterval: 30000,
  });

  // Fetch all users
  const { data: users } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
    refetchInterval: 60000,
  });

  // Fetch withdrawals
  const { data: withdrawals } = useQuery<Withdrawal[]>({
    queryKey: ["/api/admin/withdrawals"],
    refetchInterval: 10000,
  });

  // Fetch promo codes
  const { data: promoCodes } = useQuery<PromoCode[]>({
    queryKey: ["/api/admin/promo-codes"],
    refetchInterval: 30000,
  });

  // Update withdrawal mutation
  const updateWithdrawalMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; status: string; transactionHash?: string; adminNotes?: string }) => {
      const response = await apiRequest("POST", `/api/admin/withdrawals/${id}/update`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/withdrawals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setSelectedWithdrawal(null);
      setUpdateData({ status: '', transactionHash: '', adminNotes: '' });
      toast({
        title: "Success",
        description: "Withdrawal updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update withdrawal",
        variant: "destructive",
      });
    },
  });

  // Ban/unban user mutation
  const toggleUserBanMutation = useMutation({
    mutationFn: async ({ userId, banned }: { userId: string; banned: boolean }) => {
      const response = await apiRequest("POST", `/api/admin/users/${userId}/ban`, { banned });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "Success",
        description: "User status updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update user status",
        variant: "destructive",
      });
    },
  });

  // Create promo code mutation
  const createPromoCodeMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/admin/promo-codes", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/promo-codes"] });
      setPromoForm({
        code: '',
        rewardAmount: '',
        rewardCurrency: 'USDT',
        usageLimit: '',
        perUserLimit: '1',
        expiresAt: ''
      });
      toast({
        title: "Success",
        description: "Promo code created successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create promo code",
        variant: "destructive",
      });
    },
  });

  // Toggle promo code status mutation
  const togglePromoCodeMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const response = await apiRequest("POST", `/api/admin/promo-codes/${id}/toggle`, { isActive });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/promo-codes"] });
      toast({
        title: "Success",
        description: "Promo code status updated",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update promo code",
        variant: "destructive",
      });
    },
  });

  const handleUpdateWithdrawal = () => {
    if (!selectedWithdrawal || !updateData.status) {
      toast({
        title: "Error",
        description: "Please select status",
        variant: "destructive",
      });
      return;
    }

    updateWithdrawalMutation.mutate({
      id: selectedWithdrawal.id,
      ...updateData,
    });
  };

  const handleCreatePromoCode = () => {
    if (!promoForm.code || !promoForm.rewardAmount) {
      toast({
        title: "Error",
        description: "Please fill in required fields",
        variant: "destructive",
      });
      return;
    }

    const data = {
      ...promoForm,
      usageLimit: promoForm.usageLimit ? parseInt(promoForm.usageLimit) : null,
      perUserLimit: parseInt(promoForm.perUserLimit),
      expiresAt: promoForm.expiresAt ? new Date(promoForm.expiresAt).toISOString() : null,
    };

    createPromoCodeMutation.mutate(data);
  };

  const generateRandomCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPromoForm({ ...promoForm, code: result });
  };

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
            <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
              Administrator
            </Badge>
          </div>

          <Tabs defaultValue="dashboard" className="w-full">
            <div className="overflow-x-auto mb-6">
              <TabsList className="flex w-full min-w-max">
                <TabsTrigger value="dashboard" data-testid="tab-dashboard" className="flex-1 min-w-[120px]">
                  <i className="fas fa-chart-line mr-2"></i>
                  Dashboard
                </TabsTrigger>
                <TabsTrigger value="payouts" data-testid="tab-payouts" className="flex-1 min-w-[140px]">
                  <i className="fas fa-money-bill-wave mr-2"></i>
                  Reward & Payout
                </TabsTrigger>
                <TabsTrigger value="promo-codes" data-testid="tab-promo-codes" className="flex-1 min-w-[120px]">
                  <i className="fas fa-tags mr-2"></i>
                  Promo Codes
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Dashboard Tab */}
            <TabsContent value="dashboard" className="space-y-4">
              {/* Stats Cards - Compact Layout */}
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                <Card className="p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Total Users</p>
                      <p className="text-lg font-bold" data-testid="text-total-users">
                        {stats?.totalUsers?.toLocaleString() || '0'}
                      </p>
                    </div>
                    <i className="fas fa-users text-blue-600"></i>
                  </div>
                </Card>

                <Card className="p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Active Today</p>
                      <p className="text-lg font-bold" data-testid="text-active-users">
                        {stats?.dailyActiveUsers?.toLocaleString() || '0'}
                      </p>
                    </div>
                    <i className="fas fa-user-check text-green-600"></i>
                  </div>
                </Card>

                <Card className="p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Ads Watched</p>
                      <p className="text-lg font-bold" data-testid="text-total-ads">
                        {stats?.totalAdsWatched?.toLocaleString() || '0'}
                      </p>
                    </div>
                    <i className="fas fa-eye text-purple-600"></i>
                  </div>
                </Card>

                <Card className="p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Earnings</p>
                      <p className="text-lg font-bold text-green-600" data-testid="text-total-earnings">
                        ${stats?.totalEarnings || '0.00'}
                      </p>
                    </div>
                    <i className="fas fa-dollar-sign text-yellow-600"></i>
                  </div>
                </Card>

                <Card className="p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Pending</p>
                      <p className="text-lg font-bold text-orange-600" data-testid="text-pending-withdrawals">
                        {stats?.pendingWithdrawals || '0'}
                      </p>
                    </div>
                    <i className="fas fa-clock text-orange-600"></i>
                  </div>
                </Card>

                <Card className="p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Processed</p>
                      <p className="text-lg font-bold text-green-600" data-testid="text-total-withdrawals">
                        ${stats?.totalWithdrawals || '0.00'}
                      </p>
                    </div>
                    <i className="fas fa-check-circle text-green-600"></i>
                  </div>
                </Card>
              </div>

              {/* Charts Section */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center">
                      <i className="fas fa-chart-bar mr-2 text-blue-600"></i>
                      Daily Activity 📈
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-48 flex items-center justify-center bg-muted/20 rounded-lg">
                      <div className="text-center">
                        <i className="fas fa-chart-line text-3xl text-blue-600 mb-2"></i>
                        <p className="text-sm text-muted-foreground">Ads watched per day</p>
                        <p className="text-lg font-bold">{stats?.totalAdsWatched || 0} today</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center">
                      <i className="fas fa-users mr-2 text-green-600"></i>
                      User Analytics 📈
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-48 flex items-center justify-center bg-muted/20 rounded-lg">
                      <div className="text-center">
                        <i className="fas fa-user-friends text-3xl text-green-600 mb-2"></i>
                        <p className="text-sm text-muted-foreground">Active users per day</p>
                        <p className="text-lg font-bold">{stats?.dailyActiveUsers || 0} active</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Quick Actions */}
              <Card>
                <CardHeader>
                  <CardTitle>Quick Actions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Button 
                      className="flex items-center justify-center gap-2"
                      onClick={() => document.querySelector('[data-testid="tab-promo-codes"]')?.click()}
                      data-testid="button-create-promo"
                    >
                      <i className="fas fa-plus"></i>
                      Create Promo Code
                    </Button>
                    <Button 
                      variant="outline"
                      className="flex items-center justify-center gap-2"
                      onClick={() => document.querySelector('[data-testid="tab-payouts"]')?.click()}
                      data-testid="button-manage-withdrawals"
                    >
                      <i className="fas fa-money-bill-wave"></i>
                      Manage Withdrawals
                    </Button>
                    <Button 
                      variant="outline"
                      className="flex items-center justify-center gap-2"
                      onClick={() => {
                        queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
                        queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
                        queryClient.invalidateQueries({ queryKey: ["/api/admin/withdrawals"] });
                        toast({ title: "Data refreshed successfully" });
                      }}
                      data-testid="button-refresh-data"
                    >
                      <i className="fas fa-sync-alt"></i>
                      Refresh Data
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Reward & Payout Tab */}
            <TabsContent value="payouts" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Withdraw Requests Management</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Review and process user withdrawal requests with manual crypto payments
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {withdrawals?.map((withdrawal) => (
                      <Card key={withdrawal.id} className="border-l-4 border-l-orange-500">
                        <CardContent className="p-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div>
                              <p className="text-sm text-muted-foreground">Request ID</p>
                              <p className="font-medium" data-testid={`text-request-id-${withdrawal.id.substring(0, 8)}`}>
                                {withdrawal.id.substring(0, 8)}...
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">User</p>
                              <p className="font-medium" data-testid={`text-user-${withdrawal.id.substring(0, 8)}`}>
                                {withdrawal.user?.firstName} {withdrawal.user?.lastName}
                              </p>
                              <p className="text-xs text-muted-foreground">ID: {withdrawal.userId}</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Amount & Method</p>
                              <p className="font-medium text-green-600" data-testid={`text-amount-${withdrawal.id.substring(0, 8)}`}>
                                ${withdrawal.amount}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {withdrawal.method === 'usdt_polygon' ? 'Tether (Polygon POS)' : 'Litecoin (LTC)'}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Status</p>
                              <Badge 
                                variant={withdrawal.status === 'completed' ? 'default' : 
                                       withdrawal.status === 'failed' ? 'destructive' : 'secondary'}
                                data-testid={`badge-status-${withdrawal.id.substring(0, 8)}`}
                              >
                                {withdrawal.status}
                              </Badge>
                              <p className="text-xs text-muted-foreground mt-1">
                                {new Date(withdrawal.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          
                          <div className="mt-4 p-3 bg-muted rounded-lg">
                            <p className="text-sm text-muted-foreground">Wallet Address:</p>
                            <p className="font-mono text-sm break-all" data-testid={`text-address-${withdrawal.id.substring(0, 8)}`}>
                              {JSON.stringify(withdrawal.details)}
                            </p>
                          </div>

                          {withdrawal.transactionHash && (
                            <div className="mt-2 p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                              <p className="text-sm text-muted-foreground">Transaction Hash:</p>
                              <p className="font-mono text-sm break-all text-green-700 dark:text-green-400">
                                {withdrawal.transactionHash}
                              </p>
                            </div>
                          )}

                          {withdrawal.adminNotes && (
                            <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                              <p className="text-sm text-muted-foreground">Admin Notes:</p>
                              <p className="text-sm">{withdrawal.adminNotes}</p>
                            </div>
                          )}

                          <div className="mt-4 flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => {
                                setSelectedWithdrawal(withdrawal);
                                setUpdateData({
                                  status: withdrawal.status,
                                  transactionHash: withdrawal.transactionHash || '',
                                  adminNotes: withdrawal.adminNotes || ''
                                });
                              }}
                              data-testid={`button-update-${withdrawal.id.substring(0, 8)}`}
                            >
                              Update Status
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}

                    {(!withdrawals || withdrawals.length === 0) && (
                      <div className="text-center py-8 text-muted-foreground">
                        No withdrawal requests found
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Withdrawal Update Modal */}
              {selectedWithdrawal && (
                <Card className="border-2 border-primary">
                  <CardHeader>
                    <CardTitle>Update Withdrawal Request</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Request ID: {selectedWithdrawal.id.substring(0, 8)}... | User: {selectedWithdrawal.user?.firstName} {selectedWithdrawal.user?.lastName}
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label>Status</Label>
                      <Select value={updateData.status} onValueChange={(value) => setUpdateData({ ...updateData, status: value })}>
                        <SelectTrigger data-testid="select-withdrawal-status">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="processing">Processing</SelectItem>
                          <SelectItem value="completed">Completed (Approved)</SelectItem>
                          <SelectItem value="failed">Failed (Rejected)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Transaction Hash (for completed payments)</Label>
                      <Input
                        placeholder="Enter blockchain transaction hash as proof"
                        value={updateData.transactionHash}
                        onChange={(e) => setUpdateData({ ...updateData, transactionHash: e.target.value })}
                        data-testid="input-transaction-hash"
                      />
                    </div>

                    <div>
                      <Label>Admin Notes</Label>
                      <Textarea
                        placeholder="Add notes about this withdrawal..."
                        value={updateData.adminNotes}
                        onChange={(e) => setUpdateData({ ...updateData, adminNotes: e.target.value })}
                        data-testid="textarea-admin-notes"
                      />
                    </div>

                    <div className="flex gap-2">
                      <Button
                        onClick={handleUpdateWithdrawal}
                        disabled={updateWithdrawalMutation.isPending}
                        data-testid="button-save-withdrawal-update"
                      >
                        {updateWithdrawalMutation.isPending ? (
                          <>
                            <i className="fas fa-spinner fa-spin mr-2"></i>
                            Updating...
                          </>
                        ) : (
                          'Update Withdrawal'
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setSelectedWithdrawal(null)}
                        data-testid="button-cancel-withdrawal-update"
                      >
                        Cancel
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Promo Codes Tab */}
            <TabsContent value="promo-codes" className="space-y-6">
              {/* Create Promo Code */}
              <Card>
                <CardHeader>
                  <CardTitle>Create New Promo Code</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Create promotional codes that give users direct crypto rewards
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Promo Code</Label>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Enter custom code or generate"
                          value={promoForm.code}
                          onChange={(e) => setPromoForm({ ...promoForm, code: e.target.value.toUpperCase() })}
                          data-testid="input-promo-code"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={generateRandomCode}
                          data-testid="button-generate-code"
                        >
                          Generate
                        </Button>
                      </div>
                    </div>

                    <div>
                      <Label>Reward Amount</Label>
                      <Input
                        type="number"
                        step="0.00001"
                        placeholder="0.00001"
                        value={promoForm.rewardAmount}
                        onChange={(e) => setPromoForm({ ...promoForm, rewardAmount: e.target.value })}
                        data-testid="input-reward-amount"
                      />
                    </div>

                    <div>
                      <Label>Reward Currency</Label>
                      <Select value={promoForm.rewardCurrency} onValueChange={(value) => setPromoForm({ ...promoForm, rewardCurrency: value })}>
                        <SelectTrigger data-testid="select-reward-currency">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="USDT">USDT</SelectItem>
                          <SelectItem value="BTC">BTC</SelectItem>
                          <SelectItem value="ETH">ETH</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Usage Limit (Total)</Label>
                      <Input
                        type="number"
                        placeholder="Leave empty for unlimited"
                        value={promoForm.usageLimit}
                        onChange={(e) => setPromoForm({ ...promoForm, usageLimit: e.target.value })}
                        data-testid="input-usage-limit"
                      />
                    </div>

                    <div>
                      <Label>Per User Limit</Label>
                      <Input
                        type="number"
                        placeholder="1"
                        value={promoForm.perUserLimit}
                        onChange={(e) => setPromoForm({ ...promoForm, perUserLimit: e.target.value })}
                        data-testid="input-per-user-limit"
                      />
                    </div>

                    <div>
                      <Label>Expiry Date (Optional)</Label>
                      <Input
                        type="datetime-local"
                        value={promoForm.expiresAt}
                        onChange={(e) => setPromoForm({ ...promoForm, expiresAt: e.target.value })}
                        data-testid="input-expiry-date"
                      />
                    </div>
                  </div>

                  <Button
                    onClick={handleCreatePromoCode}
                    disabled={createPromoCodeMutation.isPending}
                    className="w-full md:w-auto"
                    data-testid="button-create-promo-code"
                  >
                    {createPromoCodeMutation.isPending ? (
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
                </CardContent>
              </Card>

              {/* Promo Codes List */}
              <Card>
                <CardHeader>
                  <CardTitle>Existing Promo Codes</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {promoCodes?.map((promo) => (
                      <Card key={promo.id} className="border-l-4 border-l-blue-500">
                        <CardContent className="p-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div>
                              <p className="text-sm text-muted-foreground">Code</p>
                              <p className="font-bold text-lg" data-testid={`text-promo-code-${promo.code}`}>
                                {promo.code}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Reward</p>
                              <p className="font-medium text-green-600" data-testid={`text-promo-reward-${promo.code}`}>
                                {promo.rewardAmount} {promo.rewardCurrency}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Usage</p>
                              <p className="font-medium" data-testid={`text-promo-usage-${promo.code}`}>
                                {promo.usageCount} / {promo.usageLimit || '∞'}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Per user: {promo.perUserLimit}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Status</p>
                              <Badge 
                                variant={promo.isActive ? 'default' : 'secondary'}
                                data-testid={`badge-promo-status-${promo.code}`}
                              >
                                {promo.isActive ? 'Active' : 'Inactive'}
                              </Badge>
                              {promo.expiresAt && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Expires: {new Date(promo.expiresAt).toLocaleDateString()}
                                </p>
                              )}
                            </div>
                          </div>
                          
                          <div className="mt-4 flex gap-2">
                            <Button
                              size="sm"
                              variant={promo.isActive ? "destructive" : "default"}
                              onClick={() => togglePromoCodeMutation.mutate({ 
                                id: promo.id, 
                                isActive: !promo.isActive 
                              })}
                              data-testid={`button-toggle-promo-${promo.code}`}
                            >
                              {promo.isActive ? 'Deactivate' : 'Activate'}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}

                    {(!promoCodes || promoCodes.length === 0) && (
                      <div className="text-center py-8 text-muted-foreground">
                        No promo codes created yet
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </Layout>
  );
}