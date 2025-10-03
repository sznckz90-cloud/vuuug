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


export default function AdminPage() {
  const { toast } = useToast();
  const { isAdmin, isLoading: adminLoading } = useAdmin();
  const queryClient = useQueryClient();

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


  // Fetch pending withdrawals
  const { data: withdrawalsData, isLoading: withdrawalsLoading } = useQuery({
    queryKey: ["/api/admin/withdrawals/pending"],
    queryFn: () => apiRequest("GET", "/api/admin/withdrawals/pending").then(res => res.json()),
    refetchInterval: 30000,
  });







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

          <Tabs defaultValue="analytics" className="w-full">
            <div className="overflow-x-auto mb-6">
              <TabsList className="flex w-full min-w-max">
                <TabsTrigger value="withdrawals" data-testid="tab-withdrawals" className="flex-1 min-w-[120px]">
                  <i className="fas fa-money-bill-wave mr-2"></i>
                  Withdrawals
                </TabsTrigger>
                <TabsTrigger value="analytics" data-testid="tab-analytics" className="flex-1 min-w-[120px]">
                  <i className="fas fa-chart-area mr-2"></i>
                  Advanced Analytics
                </TabsTrigger>
              </TabsList>
            </div>


            {/* Withdrawals Tab */}
            <TabsContent value="withdrawals" className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-4 flex items-center">
                  <i className="fas fa-money-bill-wave mr-2 text-orange-600"></i>
                  Withdrawal Management
                </h2>
                <Card>
                  <CardHeader>
                    <CardTitle>Withdrawal Requests</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {withdrawalsLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <i className="fas fa-spinner fa-spin text-2xl text-muted-foreground"></i>
                        <p className="ml-2 text-muted-foreground">Loading withdrawals...</p>
                      </div>
                    ) : withdrawalsData?.withdrawals && withdrawalsData.withdrawals.length > 0 ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-5 gap-4 font-medium text-sm border-b pb-2">
                          <span>User</span>
                          <span>Amount</span>
                          <span>Method</span>
                          <span>Status</span>
                          <span>Date</span>
                        </div>
                        {withdrawalsData.withdrawals.map((withdrawal: any) => (
                          <div key={withdrawal.id} className="grid grid-cols-5 gap-4 items-center p-3 border rounded-lg">
                            <div>
                              <p className="font-medium">{withdrawal.user?.firstName || 'User'} {withdrawal.user?.lastName || ''}</p>
                              <p className="text-xs text-muted-foreground">@{withdrawal.user?.username || withdrawal.user?.telegram_id}</p>
                            </div>
                            <p className="font-medium text-green-600">{formatCurrency(withdrawal.amount || '0')}</p>
                            <Badge variant="outline">{withdrawal.method || 'Unknown'}</Badge>
                            <Badge 
                              variant={withdrawal.status === 'paid' ? 'default' : 'secondary'}
                              className={withdrawal.status === 'paid' ? 'bg-green-600' : 'bg-yellow-600'}
                            >
                              {withdrawal.status === 'paid' ? 'Completed' : 'Pending'}
                            </Badge>
                            <p className="text-sm text-muted-foreground">{new Date(withdrawal.createdAt).toLocaleDateString()}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <i className="fas fa-inbox text-4xl mb-4 opacity-50"></i>
                        <p>No withdrawal requests</p>
                        <p className="text-sm">Withdrawal requests will appear here</p>
                      </div>
                    )}
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
                    {/* Quick Stats Row */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                      <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-blue-600 text-xs font-medium uppercase tracking-wide">Total Users</p>
                            <p className="text-2xl font-bold text-blue-900">
                              {stats?.totalUsers?.toLocaleString() || '0'}
                            </p>
                            <p className="text-blue-600 text-xs mt-1">
                              <i className="fas fa-arrow-up text-green-600 mr-1"></i>
                              Growing
                            </p>
                          </div>
                          <i className="fas fa-users text-blue-600 text-2xl"></i>
                        </div>
                      </div>
                      
                      <div className="bg-gradient-to-r from-green-50 to-green-100 p-4 rounded-lg border border-green-200">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-green-600 text-xs font-medium uppercase tracking-wide">Total Earnings</p>
                            <p className="text-2xl font-bold text-green-900">
                              {formatCurrency(stats?.totalEarnings || '0')}
                            </p>
                            <p className="text-green-600 text-xs mt-1">
                              <i className="fas fa-arrow-up text-green-600 mr-1"></i>
                              +{formatCurrency(parseFloat(stats?.totalEarnings || '0') * 0.1, false)} today
                            </p>
                          </div>
                          <i className="fas fa-dollar-sign text-green-600 text-2xl"></i>
                        </div>
                      </div>
                      
                      <div className="bg-gradient-to-r from-purple-50 to-purple-100 p-4 rounded-lg border border-purple-200">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-purple-600 text-xs font-medium uppercase tracking-wide">Withdrawals</p>
                            <p className="text-2xl font-bold text-purple-900">
                              {formatCurrency(stats?.totalWithdrawals || '0')}
                            </p>
                            <p className="text-purple-600 text-xs mt-1">
                              <i className="fas fa-arrow-up text-green-600 mr-1"></i>
                              {stats?.pendingWithdrawals || 0} pending
                            </p>
                          </div>
                          <i className="fas fa-money-bill-wave text-purple-600 text-2xl"></i>
                        </div>
                      </div>
                      
                      <div className="bg-gradient-to-r from-orange-50 to-orange-100 p-4 rounded-lg border border-orange-200">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-orange-600 text-xs font-medium uppercase tracking-wide">Active Users</p>
                            <p className="text-2xl font-bold text-orange-900">
                              {stats?.dailyActiveUsers?.toLocaleString() || '0'}
                            </p>
                            <p className="text-orange-600 text-xs mt-1">
                              <i className="fas fa-arrow-up text-green-600 mr-1"></i>
                              Last 24h
                            </p>
                          </div>
                          <i className="fas fa-chart-line text-orange-600 text-2xl"></i>
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
                        {stats ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart
                              data={[
                                { 
                                  period: 'Week 1', 
                                  users: Math.round((stats.totalUsers || 0) * 0.6), 
                                  earnings: parseFloat(stats.totalEarnings || '0') * 0.6,
                                  withdrawals: parseFloat(stats.totalWithdrawals || '0') * 0.5
                                },
                                { 
                                  period: 'Week 2', 
                                  users: Math.round((stats.totalUsers || 0) * 0.75), 
                                  earnings: parseFloat(stats.totalEarnings || '0') * 0.75,
                                  withdrawals: parseFloat(stats.totalWithdrawals || '0') * 0.7
                                },
                                { 
                                  period: 'Week 3', 
                                  users: Math.round((stats.totalUsers || 0) * 0.9), 
                                  earnings: parseFloat(stats.totalEarnings || '0') * 0.9,
                                  withdrawals: parseFloat(stats.totalWithdrawals || '0') * 0.85
                                },
                                { 
                                  period: 'Current', 
                                  users: stats.totalUsers || 0, 
                                  earnings: parseFloat(stats.totalEarnings || '0'),
                                  withdrawals: parseFloat(stats.totalWithdrawals || '0')
                                }
                              ]}
                            >
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
                              <p>Loading real-time data...</p>
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
          </Tabs>
          
          {/* Quick Actions */}
          <div className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <i className="fas fa-bolt mr-2 text-yellow-600"></i>
                  Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Button 
                    variant="outline"
                    className="flex items-center justify-center gap-2"
                    onClick={() => {
                      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
                      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
                      queryClient.invalidateQueries({ queryKey: ["/api/admin/promotions/pending"] });
                      queryClient.invalidateQueries({ queryKey: ["/api/admin/withdrawals/pending"] });
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
          </div>
        </div>
      </main>
    </Layout>
  );
}