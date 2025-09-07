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
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={[
                            { day: 'Mon', ads: 45, users: 12 },
                            { day: 'Tue', ads: 52, users: 15 },
                            { day: 'Wed', ads: 38, users: 8 },
                            { day: 'Thu', ads: 67, users: 18 },
                            { day: 'Fri', ads: 73, users: 22 },
                            { day: 'Sat', ads: 85, users: 25 },
                            { day: 'Today', ads: stats?.totalAdsWatched || 0, users: stats?.dailyActiveUsers || 0 }
                          ]}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="day" />
                          <YAxis />
                          <Tooltip />
                          <Line type="monotone" dataKey="ads" stroke="#2563eb" strokeWidth={2} name="Ads Watched" />
                        </LineChart>
                      </ResponsiveContainer>
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
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                          data={[
                            { day: 'Mon', users: 12, earnings: 24.5 },
                            { day: 'Tue', users: 15, earnings: 31.2 },
                            { day: 'Wed', users: 8, earnings: 18.6 },
                            { day: 'Thu', users: 18, earnings: 42.8 },
                            { day: 'Fri', users: 22, earnings: 55.4 },
                            { day: 'Sat', users: 25, earnings: 67.9 },
                            { day: 'Today', users: stats?.dailyActiveUsers || 0, earnings: parseFloat(stats?.totalEarnings || '0') }
                          ]}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="day" />
                          <YAxis />
                          <Tooltip />
                          <Area type="monotone" dataKey="users" stackId="1" stroke="#10b981" fill="#10b981" fillOpacity={0.6} name="Active Users" />
                        </AreaChart>
                      </ResponsiveContainer>
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
                      variant="outline"
                      className="flex items-center justify-center gap-2"
                      onClick={() => {
                        queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
                        queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
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


          </Tabs>
        </div>
      </main>
    </Layout>
  );
}