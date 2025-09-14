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

  // Fetch all users
  const { data: users } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
    refetchInterval: 60000,
  });

  // Fetch pending tasks/promotions
  const { data: tasksData, isLoading: tasksLoading } = useQuery({
    queryKey: ["/api/admin/promotions/pending"],
    queryFn: () => apiRequest("GET", "/api/admin/promotions/pending").then(res => res.json()),
    refetchInterval: 30000,
  });

  // Fetch pending withdrawals
  const { data: withdrawalsData, isLoading: withdrawalsLoading } = useQuery({
    queryKey: ["/api/admin/withdrawals/pending"],
    queryFn: () => apiRequest("GET", "/api/admin/withdrawals/pending").then(res => res.json()),
    refetchInterval: 30000,
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
                <TabsTrigger value="users" data-testid="tab-users" className="flex-1 min-w-[120px]">
                  <i className="fas fa-users mr-2"></i>
                  Users
                </TabsTrigger>
                <TabsTrigger value="tasks" data-testid="tab-tasks" className="flex-1 min-w-[120px]">
                  <i className="fas fa-tasks mr-2"></i>
                  Tasks
                </TabsTrigger>
                <TabsTrigger value="withdrawals" data-testid="tab-withdrawals" className="flex-1 min-w-[120px]">
                  <i className="fas fa-money-bill-wave mr-2"></i>
                  Withdrawals
                </TabsTrigger>
                <TabsTrigger value="analytics" data-testid="tab-analytics" className="flex-1 min-w-[120px]">
                  <i className="fas fa-chart-area mr-2"></i>
                  Analytics
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Dashboard Tab */}
            <TabsContent value="dashboard" className="space-y-6">
              {/* Real-time Verified Stats */}
              <div>
                <h2 className="text-xl font-semibold mb-4 flex items-center">
                  <i className="fas fa-chart-bar mr-2 text-blue-600"></i>
                  Real-time Analytics
                </h2>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Total Users</p>
                        <p className="text-2xl font-bold" data-testid="text-total-users">
                          {stats?.totalUsers?.toLocaleString() || '0'}
                        </p>
                      </div>
                      <i className="fas fa-users text-blue-600 text-xl"></i>
                    </div>
                  </Card>

                  <Card className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Tasks Completed</p>
                        <p className="text-2xl font-bold" data-testid="text-total-tasks">
                          {stats?.totalAdsWatched?.toLocaleString() || '0'}
                        </p>
                      </div>
                      <i className="fas fa-check-circle text-green-600 text-xl"></i>
                    </div>
                  </Card>

                  <Card className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Withdrawals Processed</p>
                        <p className="text-2xl font-bold text-green-600" data-testid="text-total-withdrawals">
                          ${stats?.totalWithdrawals || '0.00'}
                        </p>
                      </div>
                      <i className="fas fa-money-bill-wave text-green-600 text-xl"></i>
                    </div>
                  </Card>

                  <Card className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Total Revenue</p>
                        <p className="text-2xl font-bold text-blue-600" data-testid="text-total-revenue">
                          ${stats?.totalEarnings || '0.00'}
                        </p>
                      </div>
                      <i className="fas fa-chart-line text-blue-600 text-xl"></i>
                    </div>
                  </Card>
                </div>
              </div>
              {/* Interactive Trading-Style Chart */}
              <div>
                <h2 className="text-xl font-semibold mb-4 flex items-center">
                  <i className="fas fa-chart-area mr-2 text-green-600"></i>
                  Interactive Analytics Dashboard
                </h2>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span className="flex items-center">
                        <i className="fas fa-chart-line mr-2 text-blue-600"></i>
                        Real-time Activity Overview
                      </span>
                      <Badge variant="outline" className="bg-green-50 text-green-700">
                        Live Data
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-80 w-full">
                      {stats ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart
                            data={[
                              { 
                                period: 'Current', 
                                users: stats.totalUsers || 0, 
                                tasks: stats.totalAdsWatched || 0,
                                revenue: parseFloat(stats.totalEarnings || '0')
                              }
                            ]}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis 
                              dataKey="period" 
                              tick={{ fontSize: 12 }}
                              axisLine={{ stroke: '#64748b' }}
                            />
                            <YAxis 
                              tick={{ fontSize: 12 }}
                              axisLine={{ stroke: '#64748b' }}
                            />
                            <Tooltip 
                              contentStyle={{ 
                                backgroundColor: '#1f2937', 
                                border: 'none', 
                                borderRadius: '8px',
                                color: '#f9fafb'
                              }}
                            />
                            <Area 
                              type="monotone" 
                              dataKey="users" 
                              stroke="#3b82f6" 
                              fill="#3b82f6" 
                              fillOpacity={0.2} 
                              strokeWidth={3}
                              name="Total Users"
                            />
                            <Area 
                              type="monotone" 
                              dataKey="tasks" 
                              stroke="#10b981" 
                              fill="#10b981" 
                              fillOpacity={0.2} 
                              strokeWidth={3}
                              name="Tasks Completed"
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex items-center justify-center h-full text-muted-foreground">
                          <div className="text-center">
                            <i className="fas fa-chart-line text-4xl mb-4 opacity-50"></i>
                            <p>No data available</p>
                            <p className="text-sm">Real-time data will appear here when available</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Users Tab */}
            <TabsContent value="users" className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-4 flex items-center">
                  <i className="fas fa-users mr-2 text-purple-600"></i>
                  User Management
                </h2>
                <Card>
                  <CardHeader>
                    <CardTitle>Active Users</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {users?.map((user: any) => (
                        <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                              <i className="fas fa-user text-blue-600"></i>
                            </div>
                            <div>
                              <p className="font-medium">{user.username || `User ${user.id}`}</p>
                              <p className="text-sm text-muted-foreground">Balance: ${parseFloat(user.balance || '0').toFixed(2)}</p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Badge variant={user.banned ? "destructive" : "default"}>
                              {user.banned ? "Banned" : "Active"}
                            </Badge>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => toggleUserBanMutation.mutate({ userId: user.id, banned: !user.banned })}
                              disabled={toggleUserBanMutation.isPending}
                            >
                              {user.banned ? "Unban" : "Ban"}
                            </Button>
                          </div>
                        </div>
                      )) || <p className="text-muted-foreground">No users found</p>}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Tasks Tab */}
            <TabsContent value="tasks" className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-4 flex items-center">
                  <i className="fas fa-tasks mr-2 text-green-600"></i>
                  Task Management
                </h2>
                <Card>
                  <CardHeader>
                    <CardTitle>Pending Tasks</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {tasksLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <i className="fas fa-spinner fa-spin text-2xl text-muted-foreground"></i>
                        <p className="ml-2 text-muted-foreground">Loading tasks...</p>
                      </div>
                    ) : tasksData?.promotions && tasksData.promotions.length > 0 ? (
                      <div className="space-y-4">
                        {tasksData.promotions.map((task: any) => (
                          <div key={task.id} className="flex items-center justify-between p-4 border rounded-lg">
                            <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                                <i className="fas fa-tasks text-green-600"></i>
                              </div>
                              <div>
                                <p className="font-medium">{task.title || 'Task'}</p>
                                <p className="text-sm text-muted-foreground">Reward: ${parseFloat(task.reward || '0').toFixed(2)}</p>
                                <p className="text-xs text-muted-foreground">{task.taskType} task</p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Badge variant={task.isApproved ? "default" : "secondary"}>
                                {task.isApproved ? "Approved" : "Pending"}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <i className="fas fa-inbox text-4xl mb-4 opacity-50"></i>
                        <p>No pending tasks</p>
                        <p className="text-sm">Task submissions will appear here</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Withdrawals Tab */}
            <TabsContent value="withdrawals" className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-4 flex items-center">
                  <i className="fas fa-money-bill-wave mr-2 text-orange-600"></i>
                  Withdrawal Management
                </h2>
                <Card>
                  <CardHeader>
                    <CardTitle>Pending Withdrawals</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {withdrawalsLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <i className="fas fa-spinner fa-spin text-2xl text-muted-foreground"></i>
                        <p className="ml-2 text-muted-foreground">Loading withdrawals...</p>
                      </div>
                    ) : withdrawalsData?.withdrawals && withdrawalsData.withdrawals.length > 0 ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-4 gap-4 font-medium text-sm border-b pb-2">
                          <span>User</span>
                          <span>Amount</span>
                          <span>Method</span>
                          <span>Date</span>
                        </div>
                        {withdrawalsData.withdrawals.map((withdrawal: any) => (
                          <div key={withdrawal.id} className="grid grid-cols-4 gap-4 items-center p-3 border rounded-lg">
                            <div>
                              <p className="font-medium">{withdrawal.user?.firstName || 'User'} {withdrawal.user?.lastName || ''}</p>
                              <p className="text-xs text-muted-foreground">@{withdrawal.user?.username || withdrawal.user?.telegram_id}</p>
                            </div>
                            <p className="font-medium text-green-600">${parseFloat(withdrawal.amount || '0').toFixed(2)}</p>
                            <Badge variant="outline">{withdrawal.method || 'Unknown'}</Badge>
                            <p className="text-sm text-muted-foreground">{new Date(withdrawal.createdAt).toLocaleDateString()}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <i className="fas fa-inbox text-4xl mb-4 opacity-50"></i>
                        <p>No pending withdrawals</p>
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
                
                {/* Performance Metrics */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* User Growth Chart */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg flex items-center">
                        <i className="fas fa-chart-line mr-2 text-blue-600"></i>
                        User Growth Trend
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-64">
                        <div className="flex items-center justify-center h-full text-muted-foreground">
                          <div className="text-center">
                            <i className="fas fa-chart-line text-4xl mb-4 opacity-50"></i>
                            <p>Growth trend analytics coming soon</p>
                            <p className="text-sm">Historical data will be available here</p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Earnings Chart */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg flex items-center">
                        <i className="fas fa-dollar-sign mr-2 text-green-600"></i>
                        Earnings Overview
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-64">
                        <div className="flex items-center justify-center h-full text-muted-foreground">
                          <div className="text-center">
                            <i className="fas fa-chart-area text-4xl mb-4 opacity-50"></i>
                            <p>Earnings analytics coming soon</p>
                            <p className="text-sm">Historical earnings data will be available here</p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
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