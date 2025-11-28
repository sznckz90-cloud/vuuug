import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAdmin } from "@/hooks/useAdmin";
import Layout from "@/components/Layout";
import { Link } from "wouter";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { formatCurrency } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Crown } from "lucide-react";

interface AdminStats {
  totalUsers: number;
  totalEarnings: string;
  totalWithdrawals: string;
  tonWithdrawn: string;
  pendingWithdrawals: number;
  successfulWithdrawals: number;
  rejectedWithdrawals: number;
  dailyActiveUsers: number;
  totalAdsWatched: number;
  todayAdsWatched: number;
  activePromos: number;
}

// Compact Pill Stat Component
function StatPill({ icon, label, value, color }: {
  icon: string;
  label: string;
  value: string;
  color: 'blue' | 'green' | 'purple' | 'orange' | 'cyan' | 'indigo';
}) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600 border-blue-200',
    green: 'bg-green-50 text-green-600 border-green-200',
    purple: 'bg-purple-50 text-purple-600 border-purple-200',
    orange: 'bg-orange-50 text-orange-600 border-orange-200',
    cyan: 'bg-cyan-50 text-cyan-600 border-cyan-200',
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-200'
  };
  
  return (
    <div className={`${colorClasses[color]} border rounded-lg p-2.5 flex items-center gap-2`}>
      <i className={`fas fa-${icon} text-sm`}></i>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] opacity-70 truncate">{label}</p>
        <p className="text-sm font-bold truncate">{value}</p>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const { toast } = useToast();
  const { isAdmin, isLoading: adminLoading } = useAdmin();
  const queryClient = useQueryClient();

  // Fetch admin stats
  const { data: stats, isLoading: statsLoading } = useQuery<AdminStats>({
    queryKey: ["/api/admin/stats"],
    refetchInterval: 30000,
    enabled: isAdmin,
  });

  // Fetch all users for management table
  const { data: usersData } = useQuery({
    queryKey: ["/api/admin/users"],
    queryFn: () => apiRequest("GET", "/api/admin/users").then(res => res.json()),
    refetchInterval: 30000,
    enabled: isAdmin,
  });

  // Fetch processed withdrawals
  const { data: payoutLogsData } = useQuery({
    queryKey: ["/api/admin/withdrawals/processed"],
    queryFn: () => apiRequest("GET", "/api/admin/withdrawals/processed").then(res => res.json()),
    refetchInterval: 30000,
    enabled: isAdmin,
  });

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
      <main className="max-w-7xl mx-auto px-4 pb-20 pt-3">
        {/* Slim Header */}
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Crown className="w-5 h-5 text-orange-600" />
            Admin Dashboard
          </h1>
          <Button 
            size="sm"
            variant="outline"
            onClick={() => {
              queryClient.invalidateQueries();
              toast({ title: "✅ Refreshed" });
            }}
            className="h-8 px-3 text-xs"
          >
            <i className="fas fa-sync-alt"></i>
          </Button>
        </div>

        {/* Tabs Navigation - Move to Top */}
        <Tabs defaultValue="summary" className="w-full">
          <TabsList className="grid grid-cols-5 w-full mb-3">
            <TabsTrigger value="summary" className="text-xs">
              Summary
            </TabsTrigger>
            <TabsTrigger value="users" className="text-xs">
              Users
            </TabsTrigger>
            <TabsTrigger value="promos" className="text-xs">
              Promos
            </TabsTrigger>
            <TabsTrigger value="payouts" className="text-xs">
              Payouts
            </TabsTrigger>
            <TabsTrigger value="settings" className="text-xs">
              Settings
            </TabsTrigger>
          </TabsList>

          {/* Summary Tab - Ultra Compact */}
          <TabsContent value="summary" className="mt-0 space-y-3">
            {statsLoading ? (
              <div className="grid grid-cols-3 gap-2">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="bg-muted h-16 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : (
              <>
                {/* Compact Pill Stats - 2 rows max */}
                <div className="grid grid-cols-3 gap-2">
                  <StatPill icon="users" label="Users" value={stats?.totalUsers?.toLocaleString() || '0'} color="blue" />
                  <StatPill icon="user-check" label="Active" value={stats?.dailyActiveUsers?.toLocaleString() || '0'} color="green" />
                  <StatPill icon="play-circle" label="Total Ads" value={stats?.totalAdsWatched?.toLocaleString() || '0'} color="purple" />
                  <StatPill icon="calendar-day" label="Today" value={stats?.todayAdsWatched?.toLocaleString() || '0'} color="orange" />
                  <StatPill icon="gem" label="PAD" value={formatCurrency(stats?.totalEarnings || '0', false)} color="cyan" />
                  <StatPill icon="wallet" label="Withdrawn" value={formatCurrency(stats?.tonWithdrawn || '0', false)} color="indigo" />
                </div>

                {/* Withdrawal Status - One Row */}
                <Card>
                  <CardContent className="p-3">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Withdrawal Requests</p>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="text-center">
                        <p className="text-xl font-bold text-yellow-600">{stats?.pendingWithdrawals || 0}</p>
                        <p className="text-[10px] text-muted-foreground">Pending</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xl font-bold text-green-600">{stats?.successfulWithdrawals || 0}</p>
                        <p className="text-[10px] text-muted-foreground">Approved</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xl font-bold text-red-600">{stats?.rejectedWithdrawals || 0}</p>
                        <p className="text-[10px] text-muted-foreground">Rejected</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Quick Actions */}
                <div className="grid grid-cols-2 gap-2">
                  <Button onClick={() => document.querySelector('[value="users"]')?.click()} variant="outline" className="h-10 text-xs">
                    <i className="fas fa-users mr-2"></i>Manage Users
                  </Button>
                  <Button onClick={() => document.querySelector('[value="settings"]')?.click()} variant="outline" className="h-10 text-xs">
                    <i className="fas fa-cog mr-2"></i>Settings
                  </Button>
                </div>
              </>
            )}
          </TabsContent>

          {/* User Management Tab */}
          <TabsContent value="users" className="mt-0">
            <UserManagementSection usersData={usersData} />
          </TabsContent>

          {/* Promo Creator Tab */}
          <TabsContent value="promos" className="mt-0">
            <PromoCreatorSection />
          </TabsContent>

          {/* Payout Logs Tab */}
          <TabsContent value="payouts" className="mt-0">
            <PayoutLogsSection data={payoutLogsData} />
          </TabsContent>
          
          {/* Settings Tab */}
          <TabsContent value="settings" className="mt-0">
            <SettingsSection />
          </TabsContent>
        </Tabs>
      </main>
    </Layout>
  );
}

// Analytics Section with Live Charts
function AnalyticsSection({ stats }: { stats: AdminStats | undefined }) {
  const [timeFilter, setTimeFilter] = useState<'day' | 'week' | 'month'>('week');

  // Generate mock trend data (in production, fetch from API)
  const generateTrendData = () => {
    const points = timeFilter === 'day' ? 24 : timeFilter === 'week' ? 7 : 30;
    const data = [];
    for (let i = 0; i < points; i++) {
      const multiplier = (i + 1) / points;
      data.push({
        label: timeFilter === 'day' ? `${i}:00` : timeFilter === 'week' ? `Day ${i + 1}` : `Day ${i + 1}`,
        earnings: parseFloat(stats?.totalEarnings || '0') * multiplier * (0.8 + Math.random() * 0.4),
        withdrawals: parseFloat(stats?.totalWithdrawals || '0') * multiplier * (0.7 + Math.random() * 0.5),
      });
    }
    return data;
  };

  const chartData = generateTrendData();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center">
            <i className="fas fa-chart-area mr-2 text-blue-600"></i>
            Platform Trends
          </CardTitle>
          <div className="flex gap-2">
            {(['day', 'week', 'month'] as const).map((filter) => (
              <Button
                key={filter}
                size="sm"
                variant={timeFilter === filter ? 'default' : 'outline'}
                onClick={() => setTimeFilter(filter)}
                className="text-xs"
              >
                {filter === 'day' ? '24H' : filter === 'week' ? '7D' : '30D'}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis 
                dataKey="label" 
                tick={{ fontSize: 11 }}
                stroke="#9ca3af"
              />
              <YAxis 
                tick={{ fontSize: 11 }}
                stroke="#9ca3af"
                tickFormatter={(value) => formatCurrency(value, false)}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#fff', 
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '12px'
                }}
                formatter={(value: any) => [formatCurrency(value), '']}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="earnings" 
                stroke="#10b981" 
                strokeWidth={2}
                name="📈 PAD Earned"
                dot={{ fill: '#10b981', r: 3 }}
                activeDot={{ r: 5 }}
              />
              <Line 
                type="monotone" 
                dataKey="withdrawals" 
                stroke="#ef4444" 
                strokeWidth={2}
                name="📉 TON Withdrawn"
                dot={{ fill: '#ef4444', r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

// Ban User Button Component
function BanUserButton({ user, onSuccess }: { user: any; onSuccess: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);
  const [banReason, setBanReason] = useState('');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const handleBanToggle = async () => {
    setIsLoading(true);
    try {
      const response = await apiRequest('POST', '/api/admin/users/ban', {
        userId: user.id,
        banned: !user.banned,
        reason: banReason || (user.banned ? 'Unbanned by admin' : 'Banned by admin')
      });
      
      const result = await response.json();
      
      if (result.success) {
        toast({
          title: user.banned ? "✅ User Unbanned" : "🚫 User Banned",
          description: result.message,
        });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
        onSuccess();
      } else {
        throw new Error(result.message || 'Failed to update ban status');
      }
    } catch (error: any) {
      toast({
        title: "❌ Error",
        description: error.message || "Failed to update user status",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setShowConfirmDialog(false);
      setBanReason('');
    }
  };

  return (
    <>
      <Button
        size="sm"
        variant={user.banned ? "outline" : "destructive"}
        onClick={() => setShowConfirmDialog(true)}
        disabled={isLoading}
        className={user.banned ? "border-green-500 text-green-600 hover:bg-green-50" : ""}
      >
        {isLoading ? (
          <i className="fas fa-spinner fa-spin"></i>
        ) : user.banned ? (
          <><i className="fas fa-unlock mr-1"></i>Unban</>
        ) : (
          <><i className="fas fa-ban mr-1"></i>Ban</>
        )}
      </Button>

      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {user.banned ? (
                <><i className="fas fa-unlock text-green-600"></i> Unban User</>
              ) : (
                <><i className="fas fa-ban text-red-600"></i> Ban User</>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {user.banned 
                ? `Are you sure you want to unban ${user.username || user.firstName || 'this user'}?`
                : `Are you sure you want to ban ${user.username || user.firstName || 'this user'}? They will not be able to access the app.`
              }
            </p>
            {!user.banned && (
              <div>
                <Label htmlFor="ban-reason">Ban Reason (optional)</Label>
                <Input
                  id="ban-reason"
                  placeholder="e.g., Violation of terms"
                  value={banReason}
                  onChange={(e) => setBanReason(e.target.value)}
                />
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
                Cancel
              </Button>
              <Button
                variant={user.banned ? "default" : "destructive"}
                onClick={handleBanToggle}
                disabled={isLoading}
              >
                {isLoading ? 'Processing...' : user.banned ? 'Unban User' : 'Ban User'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// User Management Section
function UserManagementSection({ usersData }: { usersData: any }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const itemsPerPage = 15;
  const users = usersData?.users || usersData || [];

  const filteredUsers = users.filter((user: any) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      user.personalCode?.toLowerCase().includes(search) ||
      user.firstName?.toLowerCase().includes(search) ||
      user.username?.toLowerCase().includes(search)
    );
  });

  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  const paginatedUsers = filteredUsers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="flex items-center">
              <i className="fas fa-users-cog mr-2 text-purple-600"></i>
              User Management
            </CardTitle>
            <Input
              placeholder="🔍 Search by UID or username..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-xs"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Username</TableHead>
                  <TableHead>UID</TableHead>
                  <TableHead>Join Date</TableHead>
                  <TableHead>Friends</TableHead>
                  <TableHead>Wallet</TableHead>
                  <TableHead className="text-right">Total Earned</TableHead>
                  <TableHead className="text-right">Withdrawn</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      No users found
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedUsers.map((user: any) => (
                    <TableRow key={user.id} className="hover:bg-muted/50">
                      <TableCell className="font-medium">
                        {user.username || user.firstName || 'Anonymous'}
                      </TableCell>
                      <TableCell className="font-mono text-sm font-bold text-blue-600">
                        {user.personalCode || 'N/A'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{user.friendsInvited || 0}</Badge>
                      </TableCell>
                      <TableCell className="text-xs font-mono max-w-[150px] truncate">
                        {user.walletAddress ? (
                          <span className="text-green-600" title={user.walletAddress}>
                            {user.walletAddress.slice(0, 6)}...{user.walletAddress.slice(-4)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Not set</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(user.totalEarned || '0')}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-green-600">
                        {formatCurrency(user.totalWithdrawn || '0')}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setSelectedUser(user)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          <i className="fas fa-eye mr-1"></i> View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="text-sm text-muted-foreground">
              Showing {paginatedUsers.length} of {filteredUsers.length} users
              {searchTerm && ` (filtered from ${users.length} total)`}
            </div>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                >
                  <i className="fas fa-angle-double-left"></i>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <i className="fas fa-angle-left"></i>
                </Button>
                <span className="text-sm px-2">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  <i className="fas fa-angle-right"></i>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                >
                  <i className="fas fa-angle-double-right"></i>
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* User Detail Dialog */}
      <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <i className="fas fa-user-circle text-blue-600"></i>
              User Details
            </DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Username</p>
                  <p className="font-semibold">{selectedUser.username || selectedUser.firstName || 'Anonymous'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">UID</p>
                  <p className="font-mono font-bold text-blue-600">{selectedUser.personalCode || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Join Date</p>
                  <p className="text-sm">{selectedUser.createdAt ? new Date(selectedUser.createdAt).toLocaleDateString() : 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Friends Invited</p>
                  <p className="font-semibold">{selectedUser.friendsInvited || 0}</p>
                </div>
              </div>
              
              <div className="border-t pt-4">
                <p className="text-xs text-muted-foreground mb-2">Balances</p>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-blue-50 dark:bg-blue-950 p-2 rounded text-center">
                    <p className="text-xs text-muted-foreground">PAD</p>
                    <p className="font-bold text-blue-600">{Math.round(parseFloat(selectedUser.balance || '0') * 100000)}</p>
                  </div>
                  <div className="bg-purple-50 dark:bg-purple-950 p-2 rounded text-center">
                    <p className="text-xs text-muted-foreground">PDZ</p>
                    <p className="font-bold text-purple-600">{parseFloat(selectedUser.pdzBalance || '0').toFixed(2)}</p>
                  </div>
                  <div className="bg-green-50 dark:bg-green-950 p-2 rounded text-center">
                    <p className="text-xs text-muted-foreground">USD</p>
                    <p className="font-bold text-green-600">${parseFloat(selectedUser.usdBalance || '0').toFixed(2)}</p>
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <p className="text-xs text-muted-foreground mb-2">Earnings & Withdrawals</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-emerald-50 dark:bg-emerald-950 p-2 rounded">
                    <p className="text-xs text-muted-foreground">Total Earned</p>
                    <p className="font-bold text-emerald-600">{formatCurrency(selectedUser.totalEarned || '0')}</p>
                  </div>
                  <div className="bg-amber-50 dark:bg-amber-950 p-2 rounded">
                    <p className="text-xs text-muted-foreground">Total Withdrawn</p>
                    <p className="font-bold text-amber-600">{formatCurrency(selectedUser.totalWithdrawn || '0')}</p>
                  </div>
                </div>
              </div>

              {selectedUser.walletAddress && (
                <div className="border-t pt-4">
                  <p className="text-xs text-muted-foreground mb-1">Wallet Address</p>
                  <p className="font-mono text-xs bg-muted p-2 rounded break-all">{selectedUser.walletAddress}</p>
                </div>
              )}

              <div className="border-t pt-4">
                <p className="text-xs text-muted-foreground mb-2">Activity</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Ads Watched:</span>
                    <span className="ml-2 font-semibold">{selectedUser.adsWatched || 0}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Tasks Done:</span>
                    <span className="ml-2 font-semibold">{selectedUser.tasksCompleted || 0}</span>
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <p className="text-xs text-muted-foreground mb-2">Account Status</p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {selectedUser.banned ? (
                      <Badge className="bg-red-600">Banned</Badge>
                    ) : (
                      <Badge className="bg-green-600">Active</Badge>
                    )}
                    {selectedUser.bannedReason && (
                      <span className="text-xs text-muted-foreground">({selectedUser.bannedReason})</span>
                    )}
                  </div>
                  <BanUserButton user={selectedUser} onSuccess={() => setSelectedUser(null)} />
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

// Promo Creator Section (Fixed Bug)
function PromoCreatorSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    code: '',
    rewardAmount: '',
    rewardType: 'PAD' as 'PAD' | 'PDZ' | 'USD',
    usageLimit: '',
    perUserLimit: '1',
    expiresAt: ''
  });
  const [isCreating, setIsCreating] = useState(false);

  const handleGenerateCode = () => {
    const randomCode = 'PROMO' + Math.random().toString(36).substring(2, 10).toUpperCase();
    setFormData({ ...formData, code: randomCode });
    toast({
      title: "✨ Code Generated!",
      description: `Generated code: ${randomCode}`,
    });
  };

  const { data: promoCodesData } = useQuery({
    queryKey: ["/api/admin/promo-codes"],
    queryFn: () => apiRequest("GET", "/api/admin/promo-codes").then(res => res.json()),
    refetchInterval: 5000,
  });

  const handleCreate = async () => {
    if (!formData.code.trim() || !formData.rewardAmount) {
      toast({
        title: "⚠️ Validation Error",
        description: "Promo code and reward amount are required",
        variant: "destructive",
      });
      return;
    }

    const rewardAmount = parseFloat(formData.rewardAmount);
    if (isNaN(rewardAmount) || rewardAmount <= 0) {
      toast({
        title: "⚠️ Validation Error",
        description: "Reward amount must be a positive number",
        variant: "destructive",
      });
      return;
    }

    // Reward amount is already in PAD or PDZ, use as-is
    const finalAmount = rewardAmount;

    setIsCreating(true);
    try {
      const response = await apiRequest('POST', '/api/promo-codes/create', {
        code: formData.code.trim().toUpperCase(),
        rewardAmount: finalAmount,
        rewardType: formData.rewardType,
        usageLimit: formData.usageLimit ? parseInt(formData.usageLimit) : null,
        perUserLimit: parseInt(formData.perUserLimit),
        expiresAt: formData.expiresAt || null
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: "✅ Success!",
          description: `Promo code created: ${rewardAmount} ${formData.rewardType} reward`,
        });
        setFormData({
          code: '',
          rewardAmount: '',
          rewardType: 'PAD',
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
        title: "❌ Error",
        description: error.message || "Failed to create promo code",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const promoCodes = promoCodesData?.promoCodes || [];

  // Calculate promo status
  const getPromoStatus = (promo: any) => {
    const now = new Date();
    const expiresAt = promo.expiresAt ? new Date(promo.expiresAt) : null;
    const isExpired = expiresAt && now > expiresAt;
    const isFullyClaimed = promo.usageLimit && promo.usageCount >= promo.usageLimit;

    if (isFullyClaimed) return { label: 'Fully Claimed', color: 'bg-orange-600' };
    if (isExpired) return { label: 'Expired', color: 'bg-gray-600' };
    if (promo.isActive) return { label: 'Active', color: 'bg-green-600' };
    return { label: 'Inactive', color: 'bg-gray-600' };
  };

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({
      title: "✅ Copied!",
      description: `Code "${code}" copied to clipboard`,
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Create Promo Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <i className="fas fa-plus-circle mr-2 text-green-600"></i>
            Create Promo Code
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="promo-code">Promo Code *</Label>
            <div className="flex gap-2">
              <Input
                id="promo-code"
                placeholder="e.g., WELCOME100"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                maxLength={20}
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleGenerateCode}
                className="shrink-0"
              >
                <i className="fas fa-random mr-2"></i>Generate
              </Button>
            </div>
          </div>
          <div>
            <Label htmlFor="reward-type">Reward Type *</Label>
            <div className="grid grid-cols-3 gap-2 mt-1">
              <Button
                type="button"
                variant={formData.rewardType === 'PAD' ? 'default' : 'outline'}
                onClick={() => setFormData({ ...formData, rewardType: 'PAD' })}
                className="w-full"
              >
                PAD
              </Button>
              <Button
                type="button"
                variant={formData.rewardType === 'PDZ' ? 'default' : 'outline'}
                onClick={() => setFormData({ ...formData, rewardType: 'PDZ' })}
                className="w-full"
              >
                PDZ
              </Button>
              <Button
                type="button"
                variant={formData.rewardType === 'USD' ? 'default' : 'outline'}
                onClick={() => setFormData({ ...formData, rewardType: 'USD' })}
                className="w-full"
              >
                USD
              </Button>
            </div>
          </div>
          <div>
            <Label htmlFor="reward-amount">Reward Amount ({formData.rewardType}) *</Label>
            <Input
              id="reward-amount"
              type="number"
              placeholder={`Enter exact ${formData.rewardType} amount`}
              value={formData.rewardAmount}
              onChange={(e) => setFormData({ ...formData, rewardAmount: e.target.value })}
              min="0"
              step="1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Value will be exactly {formData.rewardAmount || '0'} {formData.rewardType} per user
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="max-users">Max Claims</Label>
              <Input
                id="max-users"
                type="number"
                placeholder="Unlimited"
                value={formData.usageLimit}
                onChange={(e) => setFormData({ ...formData, usageLimit: e.target.value })}
                min="1"
              />
            </div>
            <div>
              <Label htmlFor="expiry-date">Expiry Date</Label>
              <Input
                id="expiry-date"
                type="date"
                value={formData.expiresAt}
                onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
              />
            </div>
          </div>
          <Button 
            onClick={handleCreate}
            disabled={isCreating}
            className="w-full"
          >
            {isCreating ? (
              <><i className="fas fa-spinner fa-spin mr-2"></i>Creating...</>
            ) : (
              <><i className="fas fa-plus mr-2"></i>Create Promo</>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Active Promos Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <i className="fas fa-list mr-2 text-blue-600"></i>
            Active Promo Codes ({promoCodes.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {promoCodes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <i className="fas fa-gift text-4xl mb-2"></i>
                <p>No promo codes created yet</p>
              </div>
            ) : (
              promoCodes.map((promo: any) => {
                const status = getPromoStatus(promo);
                return (
                  <div key={promo.id} className="border rounded-lg p-3 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <code className="font-bold text-lg bg-muted px-2 py-1 rounded">{promo.code}</code>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyToClipboard(promo.code)}
                          className="h-7 w-7 p-0"
                        >
                          <i className="fas fa-copy text-xs"></i>
                        </Button>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {promo.rewardType || 'PAD'}
                        </Badge>
                        <Badge className={status.color}>{status.label}</Badge>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm mb-2">
                      <div>
                        <span className="text-muted-foreground">Reward:</span>
                        <span className="font-semibold ml-1">
                          {promo.rewardType === 'USD' 
                            ? `$${parseFloat(promo.rewardAmount).toFixed(2)} USD`
                            : promo.rewardType === 'PDZ' 
                              ? `${parseFloat(promo.rewardAmount).toFixed(2)} PDZ`
                              : `${Math.round(parseFloat(promo.rewardAmount))} PAD`
                          }
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Claimed:</span>
                        <span className="font-semibold ml-1">{promo.usageCount || 0} / {promo.usageLimit || '∞'}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">Remaining:</span>
                        <span className="font-semibold ml-1">
                          {promo.remainingCount}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Distributed:</span>
                        <span className="font-semibold ml-1">
                          {promo.rewardType === 'USD'
                            ? `$${parseFloat(promo.totalDistributed).toFixed(2)} USD`
                            : promo.rewardType === 'PDZ'
                              ? `${parseFloat(promo.totalDistributed).toFixed(2)} PDZ`
                              : `${Math.round(parseFloat(promo.totalDistributed))} PAD`
                          }
                        </span>
                      </div>
                    </div>
                    {promo.expiresAt && (
                      <div className="text-xs text-muted-foreground mt-2">
                        <i className="fas fa-clock mr-1"></i>
                        Expires: {new Date(promo.expiresAt).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Payout Logs Section
function PayoutLogsSection({ data }: { data: any }) {
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const itemsPerPage = 10;
  const payouts = data?.withdrawals || [];

  const filteredPayouts = payouts.filter((payout: any) => {
    const matchesStatus = statusFilter === 'all' ? true :
      statusFilter === 'approved' ? ['success', 'paid', 'Approved'].includes(payout.status) :
      statusFilter === 'rejected' ? payout.status === 'rejected' :
      statusFilter === 'pending' ? payout.status === 'pending' : true;
    
    const matchesSearch = searchQuery === '' ? true :
      (payout.user?.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
       payout.user?.personalCode?.toLowerCase().includes(searchQuery.toLowerCase()) ||
       payout.details?.paymentDetails?.toLowerCase().includes(searchQuery.toLowerCase()));
    
    return matchesStatus && matchesSearch;
  });

  const totalPages = Math.ceil(filteredPayouts.length / itemsPerPage);
  const paginatedPayouts = filteredPayouts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, searchQuery]);

  const getStatusBadge = (status: string) => {
    if (['success', 'paid', 'Approved'].includes(status)) {
      return <Badge className="bg-green-600">✓ Approved</Badge>;
    }
    if (status === 'rejected') {
      return <Badge className="bg-red-600">✗ Rejected</Badge>;
    }
    return <Badge className="bg-yellow-600">⏳ Pending</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="flex items-center">
              <i className="fas fa-file-invoice-dollar mr-2 text-green-600"></i>
              Payout Logs
            </CardTitle>
            <div className="flex flex-wrap gap-2">
              {(['all', 'pending', 'approved', 'rejected'] as const).map((filter) => (
                <Button
                  key={filter}
                  size="sm"
                  variant={statusFilter === filter ? 'default' : 'outline'}
                  onClick={() => setStatusFilter(filter)}
                  className="text-xs capitalize flex-shrink-0"
                >
                  {filter}
                </Button>
              ))}
            </div>
          </div>
          <Input
            placeholder="🔍 Search by username, UID, or wallet..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-md"
          />
        </div>
      </CardHeader>
      <CardContent>
        {paginatedPayouts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <i className="fas fa-inbox text-4xl mb-2"></i>
            <p>No {statusFilter !== 'all' && statusFilter} payout records found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Wallet</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedPayouts.map((payout: any) => (
                  <TableRow key={payout.id}>
                    <TableCell className="font-medium">
                      @{payout.user?.username || payout.user?.telegram_id || 'Unknown'}
                    </TableCell>
                    <TableCell className="font-bold text-green-600">
                      {formatCurrency(payout.amount || '0')}
                    </TableCell>
                    <TableCell>{getStatusBadge(payout.status)}</TableCell>
                    <TableCell className="text-sm">
                      {new Date(payout.createdAt || payout.created_on).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-xs font-mono max-w-[150px] truncate">
                      {payout.details?.paymentDetails ? (
                        <span title={payout.details.paymentDetails}>
                          {payout.details.paymentDetails.slice(0, 8)}...{payout.details.paymentDetails.slice(-6)}
                        </span>
                      ) : (
                        'N/A'
                      )}
                    </TableCell>
                    <TableCell className="text-xs max-w-[200px]">
                      {payout.status === 'rejected' && payout.rejectionReason ? (
                        <span className="text-red-500" title={payout.rejectionReason}>
                          {payout.rejectionReason.length > 30 
                            ? `${payout.rejectionReason.slice(0, 30)}...` 
                            : payout.rejectionReason}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="text-sm text-muted-foreground">
            Showing {paginatedPayouts.length} of {filteredPayouts.length} records
            {searchQuery && ` (filtered from ${payouts.length} total)`}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
              >
                <i className="fas fa-angle-double-left"></i>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <i className="fas fa-angle-left"></i>
              </Button>
              <span className="text-sm px-2">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                <i className="fas fa-angle-right"></i>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
              >
                <i className="fas fa-angle-double-right"></i>
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Settings Section Component
function SettingsSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSaving, setIsSaving] = useState(false);
  const [isTogglingSeason, setIsTogglingSeason] = useState(false);
  
  // Fetch current settings
  const { data: settingsData, isLoading } = useQuery({
    queryKey: ["/api/admin/settings"],
    queryFn: () => apiRequest("GET", "/api/admin/settings").then(res => res.json()),
  });
  
  const [settings, setSettings] = useState({
    dailyAdLimit: '50',
    rewardPerAd: '2',
    affiliateCommission: '10',
    walletChangeFee: '100',
    minimumWithdrawalUSD: '1.00',
    minimumWithdrawalTON: '0.5',
    withdrawalFeeTON: '5',
    withdrawalFeeUSD: '3',
    channelTaskCost: '0.003',
    botTaskCost: '0.003',
    channelTaskReward: '30',
    botTaskReward: '20',
    partnerTaskReward: '5',
    minimumConvertPAD: '100',
    minimumClicks: '500',
    seasonBroadcastActive: false,
    referralRewardEnabled: false,
    referralRewardUSD: '0.0005',
    referralRewardPAD: '50'
  });
  
  // Update form when settings data loads
  useEffect(() => {
    if (settingsData) {
      setSettings({
        dailyAdLimit: settingsData.dailyAdLimit?.toString() || '50',
        rewardPerAd: settingsData.rewardPerAd?.toString() || '2',
        affiliateCommission: settingsData.affiliateCommission?.toString() || '10',
        walletChangeFee: settingsData.walletChangeFee?.toString() || '100',
        minimumWithdrawalUSD: settingsData.minimumWithdrawalUSD?.toString() || '1.00',
        minimumWithdrawalTON: settingsData.minimumWithdrawalTON?.toString() || '0.5',
        withdrawalFeeTON: settingsData.withdrawalFeeTON?.toString() || '5',
        withdrawalFeeUSD: settingsData.withdrawalFeeUSD?.toString() || '3',
        channelTaskCost: settingsData.channelTaskCost?.toString() || '0.003',
        botTaskCost: settingsData.botTaskCost?.toString() || '0.003',
        channelTaskReward: settingsData.channelTaskReward?.toString() || '30',
        botTaskReward: settingsData.botTaskReward?.toString() || '20',
        partnerTaskReward: settingsData.partnerTaskReward?.toString() || '5',
        minimumConvertPAD: settingsData.minimumConvertPAD?.toString() || '100',
        minimumClicks: settingsData.minimumClicks?.toString() || '500',
        seasonBroadcastActive: settingsData.seasonBroadcastActive || false,
        referralRewardEnabled: settingsData.referralRewardEnabled || false,
        referralRewardUSD: settingsData.referralRewardUSD?.toString() || '0.0005',
        referralRewardPAD: settingsData.referralRewardPAD?.toString() || '50'
      });
    }
  }, [settingsData]);
  
  const handleSaveSettings = async () => {
    const adLimit = parseInt(settings.dailyAdLimit);
    const reward = parseInt(settings.rewardPerAd);
    const affiliate = parseFloat(settings.affiliateCommission);
    const walletFee = parseInt(settings.walletChangeFee);
    const minWithdrawalUSD = parseFloat(settings.minimumWithdrawalUSD);
    const minWithdrawalTON = parseFloat(settings.minimumWithdrawalTON);
    const withdrawalFeeTON = parseFloat(settings.withdrawalFeeTON);
    const withdrawalFeeUSD = parseFloat(settings.withdrawalFeeUSD);
    const channelCost = parseFloat(settings.channelTaskCost);
    const botCost = parseFloat(settings.botTaskCost);
    const channelReward = parseInt(settings.channelTaskReward);
    const botReward = parseInt(settings.botTaskReward);
    const partnerReward = parseInt(settings.partnerTaskReward);
    const minConvertPAD = parseInt(settings.minimumConvertPAD);
    const minClicks = parseInt(settings.minimumClicks);
    const refRewardUSD = parseFloat(settings.referralRewardUSD);
    const refRewardPAD = parseInt(settings.referralRewardPAD);
    
    if (isNaN(adLimit) || adLimit <= 0) {
      toast({
        title: "⚠️ Validation Error",
        description: "Daily ad limit must be a positive number",
        variant: "destructive",
      });
      return;
    }
    
    if (isNaN(reward) || reward <= 0) {
      toast({
        title: "⚠️ Validation Error",
        description: "Reward per ad must be a positive number",
        variant: "destructive",
      });
      return;
    }
    
    setIsSaving(true);
    try {
      const response = await apiRequest('PUT', '/api/admin/settings', {
        dailyAdLimit: adLimit,
        rewardPerAd: reward,
        affiliateCommission: affiliate,
        walletChangeFee: walletFee,
        minimumWithdrawalUSD: minWithdrawalUSD,
        minimumWithdrawalTON: minWithdrawalTON,
        withdrawalFeeTON: withdrawalFeeTON,
        withdrawalFeeUSD: withdrawalFeeUSD,
        channelTaskCost: channelCost,
        botTaskCost: botCost,
        channelTaskReward: channelReward,
        botTaskReward: botReward,
        partnerTaskReward: partnerReward,
        minimumConvertPAD: minConvertPAD,
        minimumClicks: minClicks,
        seasonBroadcastActive: settings.seasonBroadcastActive,
        referralRewardEnabled: settings.referralRewardEnabled,
        referralRewardUSD: refRewardUSD,
        referralRewardPAD: refRewardPAD
      });
      
      const result = await response.json();
      
      if (result.success) {
        toast({
          title: "✅ Settings Updated",
          description: "App settings have been updated successfully",
        });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
        queryClient.invalidateQueries({ queryKey: ["/api/app-settings"] });
      } else {
        throw new Error(result.message || 'Failed to update settings');
      }
    } catch (error: any) {
      toast({
        title: "❌ Error",
        description: error.message || "Failed to update settings",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };
  
  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <i className="fas fa-spinner fa-spin text-3xl text-primary mb-2"></i>
          <p className="text-muted-foreground">Loading settings...</p>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <i className="fas fa-cog mr-2 text-blue-600"></i>
          App Settings
        </CardTitle>
        <p className="text-sm text-muted-foreground mt-2">
          Configure app-wide settings for ad limits and reward amounts
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Daily Ad Limit Setting */}
          <div className="space-y-2">
            <Label htmlFor="daily-ad-limit" className="text-base font-semibold">
              <i className="fas fa-calendar-day mr-2 text-orange-600"></i>
              Daily Ad Limit
            </Label>
            <p className="text-xs text-muted-foreground mb-2">
              Maximum number of ads a user can watch per day
            </p>
            <Input
              id="daily-ad-limit"
              type="number"
              value={settings.dailyAdLimit}
              onChange={(e) => setSettings({ ...settings, dailyAdLimit: e.target.value })}
              placeholder="50"
              min="1"
              className="text-lg font-semibold"
            />
            <p className="text-xs text-muted-foreground">
              Current: {settingsData?.dailyAdLimit || 50} ads per day
            </p>
          </div>
          
          {/* Reward Per Ad Setting */}
          <div className="space-y-2">
            <Label htmlFor="reward-per-ad" className="text-base font-semibold">
              <i className="fas fa-gem mr-2 text-purple-600"></i>
              Reward Per Ad (PAD)
            </Label>
            <p className="text-xs text-muted-foreground mb-2">
              Amount of PAD tokens awarded for watching one ad
            </p>
            <Input
              id="reward-per-ad"
              type="number"
              value={settings.rewardPerAd}
              onChange={(e) => setSettings({ ...settings, rewardPerAd: e.target.value })}
              placeholder="1000"
              min="1"
              className="text-lg font-semibold"
            />
            <p className="text-xs text-muted-foreground">
              Current: {settingsData?.rewardPerAd || 1000} PAD per ad
            </p>
          </div>

          {/* Affiliate Commission Setting */}
          <div className="space-y-2">
            <Label htmlFor="affiliate-commission" className="text-base font-semibold">
              <i className="fas fa-users mr-2 text-green-600"></i>
              Affiliate Commission (%)
            </Label>
            <p className="text-xs text-muted-foreground mb-2">
              Percentage of earnings given to referrers
            </p>
            <Input
              id="affiliate-commission"
              type="number"
              value={settings.affiliateCommission}
              onChange={(e) => setSettings({ ...settings, affiliateCommission: e.target.value })}
              placeholder="10"
              min="0"
              max="100"
              step="0.1"
              className="text-lg font-semibold"
            />
            <p className="text-xs text-muted-foreground">
              Current: {settingsData?.affiliateCommission || 10}%
            </p>
          </div>

          {/* Referral Reward Settings */}
          <div className="space-y-3 p-4 border rounded-lg bg-green-50/5 border-green-500/20">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">
                <i className="fas fa-gift mr-2 text-green-500"></i>
                Referral Reward (First Ad Bonus)
              </Label>
              <div className="flex items-center gap-2">
                <span className={`text-xs ${settings.referralRewardEnabled ? 'text-green-500' : 'text-muted-foreground'}`}>
                  {settings.referralRewardEnabled ? 'Enabled' : 'Disabled'}
                </span>
                <button
                  type="button"
                  onClick={() => setSettings({ ...settings, referralRewardEnabled: !settings.referralRewardEnabled })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    settings.referralRewardEnabled ? 'bg-green-500' : 'bg-gray-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings.referralRewardEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Bonus awarded to referrer when their friend watches their first ad
            </p>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="referral-reward-pad" className="text-sm">PAD Reward</Label>
                <Input
                  id="referral-reward-pad"
                  type="number"
                  value={settings.referralRewardPAD}
                  onChange={(e) => setSettings({ ...settings, referralRewardPAD: e.target.value })}
                  placeholder="50"
                  min="0"
                  step="1"
                  disabled={!settings.referralRewardEnabled}
                  className={!settings.referralRewardEnabled ? 'opacity-50' : ''}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="referral-reward-usd" className="text-sm">USD Reward</Label>
                <Input
                  id="referral-reward-usd"
                  type="number"
                  value={settings.referralRewardUSD}
                  onChange={(e) => setSettings({ ...settings, referralRewardUSD: e.target.value })}
                  placeholder="0.0005"
                  min="0"
                  step="0.0001"
                  disabled={!settings.referralRewardEnabled}
                  className={!settings.referralRewardEnabled ? 'opacity-50' : ''}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Current: {settingsData?.referralRewardPAD || 50} PAD + ${settingsData?.referralRewardUSD || 0.0005} USD
            </p>
          </div>

          {/* Wallet Change Fee Setting */}
          <div className="space-y-2">
            <Label htmlFor="wallet-change-fee" className="text-base font-semibold">
              <i className="fas fa-exchange-alt mr-2 text-yellow-600"></i>
              Wallet Change Fee (PAD)
            </Label>
            <p className="text-xs text-muted-foreground mb-2">
              Fee charged when users change wallet address
            </p>
            <Input
              id="wallet-change-fee"
              type="number"
              value={settings.walletChangeFee}
              onChange={(e) => setSettings({ ...settings, walletChangeFee: e.target.value })}
              placeholder="5000"
              min="0"
              step="1"
              className="text-lg font-semibold"
            />
            <p className="text-xs text-muted-foreground">
              Current: {settingsData?.walletChangeFee || 5000} PAD
            </p>
          </div>

          {/* Minimum USD Balance for USD/USDT/Stars Withdrawal */}
          <div className="space-y-2">
            <Label htmlFor="minimum-withdrawal-usd" className="text-base font-semibold">
              <i className="fas fa-dollar-sign mr-2 text-green-600"></i>
              Min USD Balance - For USD/USDT/Stars Methods
            </Label>
            <p className="text-xs text-muted-foreground mb-2">
              Minimum USD balance needed to withdraw via USD, USDT, or Telegram Stars
            </p>
            <Input
              id="minimum-withdrawal-usd"
              type="number"
              value={settings.minimumWithdrawalUSD}
              onChange={(e) => setSettings({ ...settings, minimumWithdrawalUSD: e.target.value })}
              placeholder="1.00"
              min="0"
              step="0.01"
              className="text-lg font-semibold"
            />
            <p className="text-xs text-muted-foreground">
              Current: ${settingsData?.minimumWithdrawalUSD || 1.00}
            </p>
          </div>

          {/* Minimum USD Balance for TON Withdrawal Method */}
          <div className="space-y-2">
            <Label htmlFor="minimum-withdrawal-ton" className="text-base font-semibold">
              <i className="fas fa-gem mr-2 text-blue-600"></i>
              Min USD Balance - For TON Withdrawal Method
            </Label>
            <p className="text-xs text-muted-foreground mb-2">
              Minimum USD balance needed to withdraw via TON method (can be different from other methods)
            </p>
            <Input
              id="minimum-withdrawal-ton"
              type="number"
              value={settings.minimumWithdrawalTON}
              onChange={(e) => setSettings({ ...settings, minimumWithdrawalTON: e.target.value })}
              placeholder="0.5"
              min="0"
              step="0.01"
              className="text-lg font-semibold"
            />
            <p className="text-xs text-muted-foreground">
              Current: ${settingsData?.minimumWithdrawalTON || 0.5} (USD, not TON)
            </p>
          </div>

          {/* Channel Task Reward Setting */}
          <div className="space-y-2">
            <Label htmlFor="channel-task-reward" className="text-base font-semibold">
              <i className="fas fa-bullhorn mr-2 text-cyan-600"></i>
              Channel Task Reward (PAD)
            </Label>
            <p className="text-xs text-muted-foreground mb-2">
              Reward per channel task completion
            </p>
            <Input
              id="channel-task-reward"
              type="number"
              value={settings.channelTaskReward}
              onChange={(e) => setSettings({ ...settings, channelTaskReward: e.target.value })}
              placeholder="30"
              min="0"
              step="1"
              className="text-lg font-semibold"
            />
            <p className="text-xs text-muted-foreground">
              Current: {settingsData?.channelTaskReward || 30} PAD
            </p>
          </div>

          {/* Bot Task Reward Setting */}
          <div className="space-y-2">
            <Label htmlFor="bot-task-reward" className="text-base font-semibold">
              <i className="fas fa-robot mr-2 text-purple-600"></i>
              Bot Task Reward (PAD)
            </Label>
            <p className="text-xs text-muted-foreground mb-2">
              Reward per bot task completion
            </p>
            <Input
              id="bot-task-reward"
              type="number"
              value={settings.botTaskReward}
              onChange={(e) => setSettings({ ...settings, botTaskReward: e.target.value })}
              placeholder="20"
              min="0"
              step="1"
              className="text-lg font-semibold"
            />
            <p className="text-xs text-muted-foreground">
              Current: {settingsData?.botTaskReward || 20} PAD
            </p>
          </div>

          {/* Partner Task Reward Setting */}
          <div className="space-y-2">
            <Label htmlFor="partner-task-reward" className="text-base font-semibold">
              <i className="fas fa-handshake mr-2 text-green-600"></i>
              Partner Task Reward (PAD)
            </Label>
            <p className="text-xs text-muted-foreground mb-2">
              Reward per partner task completion (admin-created external links)
            </p>
            <Input
              id="partner-task-reward"
              type="number"
              value={settings.partnerTaskReward}
              onChange={(e) => setSettings({ ...settings, partnerTaskReward: e.target.value })}
              placeholder="5"
              min="0"
              step="1"
              className="text-lg font-semibold"
            />
            <p className="text-xs text-muted-foreground">
              Current: {settingsData?.partnerTaskReward || 5} PAD
            </p>
          </div>

          {/* Channel Task Creation Cost Setting */}
          <div className="space-y-2">
            <Label htmlFor="channel-task-cost" className="text-base font-semibold">
              <i className="fas fa-bullhorn mr-2 text-orange-600"></i>
              Channel Task Cost (USD)
            </Label>
            <p className="text-xs text-muted-foreground mb-2">
              Cost per click to create a channel task
            </p>
            <Input
              id="channel-task-cost"
              type="number"
              value={settings.channelTaskCost}
              onChange={(e) => setSettings({ ...settings, channelTaskCost: e.target.value })}
              placeholder="0.003"
              min="0"
              step="0.0001"
              className="text-lg font-semibold"
            />
            <p className="text-xs text-muted-foreground">
              Current: ${settingsData?.channelTaskCost || 0.003}
            </p>
          </div>

          {/* Bot Task Creation Cost Setting */}
          <div className="space-y-2">
            <Label htmlFor="bot-task-cost" className="text-base font-semibold">
              <i className="fas fa-robot mr-2 text-red-600"></i>
              Bot Task Cost (USD)
            </Label>
            <p className="text-xs text-muted-foreground mb-2">
              Cost per click to create a bot task
            </p>
            <Input
              id="bot-task-cost"
              type="number"
              value={settings.botTaskCost}
              onChange={(e) => setSettings({ ...settings, botTaskCost: e.target.value })}
              placeholder="0.003"
              min="0"
              step="0.0001"
              className="text-lg font-semibold"
            />
            <p className="text-xs text-muted-foreground">
              Current: ${settingsData?.botTaskCost || 0.003}
            </p>
          </div>

          {/* Minimum Convert Amount Setting (in PAD, showing USD equivalent) */}
          <div className="space-y-2">
            <Label htmlFor="minimum-convert-pad" className="text-base font-semibold">
              <i className="fas fa-repeat mr-2 text-indigo-600"></i>
              Minimum Convert Amount (PAD)
            </Label>
            <p className="text-xs text-muted-foreground mb-2">
              Minimum PAD to convert (10,000 PAD = $1)
            </p>
            <Input
              id="minimum-convert-pad"
              type="number"
              value={settings.minimumConvertPAD}
              onChange={(e) => setSettings({ ...settings, minimumConvertPAD: e.target.value })}
              placeholder="100"
              min="0"
              step="1"
              className="text-lg font-semibold"
            />
            <p className="text-xs text-muted-foreground">
              Current: {settingsData?.minimumConvertPAD || 100} PAD (${((settingsData?.minimumConvertPAD || 100) / 10000).toFixed(2)})
            </p>
          </div>

          {/* TON Withdrawal Fee Setting */}
          <div className="space-y-2">
            <Label htmlFor="withdrawal-fee-ton" className="text-base font-semibold">
              <i className="fas fa-percent mr-2 text-blue-600"></i>
              TON Withdrawal Fee (%)
            </Label>
            <p className="text-xs text-muted-foreground mb-2">
              Fee percentage for TON withdrawals
            </p>
            <Input
              id="withdrawal-fee-ton"
              type="number"
              value={settings.withdrawalFeeTON}
              onChange={(e) => setSettings({ ...settings, withdrawalFeeTON: e.target.value })}
              placeholder="5"
              min="0"
              max="100"
              step="0.1"
              className="text-lg font-semibold"
            />
            <p className="text-xs text-muted-foreground">
              Current: {settingsData?.withdrawalFeeTON || 5}%
            </p>
          </div>

          {/* USD Withdrawal Fee Setting */}
          <div className="space-y-2">
            <Label htmlFor="withdrawal-fee-usd" className="text-base font-semibold">
              <i className="fas fa-percent mr-2 text-green-600"></i>
              USD Withdrawal Fee (%)
            </Label>
            <p className="text-xs text-muted-foreground mb-2">
              Fee percentage for USD/USDT withdrawals
            </p>
            <Input
              id="withdrawal-fee-usd"
              type="number"
              value={settings.withdrawalFeeUSD}
              onChange={(e) => setSettings({ ...settings, withdrawalFeeUSD: e.target.value })}
              placeholder="3"
              min="0"
              max="100"
              step="0.1"
              className="text-lg font-semibold"
            />
            <p className="text-xs text-muted-foreground">
              Current: {settingsData?.withdrawalFeeUSD || 3}%
            </p>
          </div>

          {/* Minimum Clicks Setting */}
          <div className="space-y-2">
            <Label htmlFor="minimum-clicks" className="text-base font-semibold">
              <i className="fas fa-mouse-pointer mr-2 text-pink-600"></i>
              Minimum Clicks
            </Label>
            <p className="text-xs text-muted-foreground mb-2">
              Minimum number of clicks required to create a task
            </p>
            <Input
              id="minimum-clicks"
              type="number"
              value={settings.minimumClicks}
              onChange={(e) => setSettings({ ...settings, minimumClicks: e.target.value })}
              placeholder="500"
              min="1"
              step="1"
              className="text-lg font-semibold"
            />
            <p className="text-xs text-muted-foreground">
              Current: {settingsData?.minimumClicks || 500} clicks
            </p>
          </div>
        </div>

        {/* Season Broadcast Toggle */}
        <div className="space-y-2 pt-4 border-t">
          <Label className="text-base font-semibold flex items-center gap-2">
            <i className="fas fa-broadcast-tower mr-2 text-cyan-600"></i>
            Season Broadcast
          </Label>
          <p className="text-xs text-muted-foreground mb-2">
            Enable or disable season broadcast messages
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSettings({ ...settings, seasonBroadcastActive: !settings.seasonBroadcastActive })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings.seasonBroadcastActive ? 'bg-green-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.seasonBroadcastActive ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            <span className="text-sm font-medium">
              {settings.seasonBroadcastActive ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>
        
        {/* Save Button */}
        <div className="pt-4 border-t">
          <Button
            onClick={handleSaveSettings}
            disabled={isSaving}
            className="w-full md:w-auto"
            size="lg"
          >
            {isSaving ? (
              <>
                <i className="fas fa-spinner fa-spin mr-2"></i>
                Saving...
              </>
            ) : (
              <>
                <i className="fas fa-save mr-2"></i>
                Save Settings
              </>
            )}
          </Button>
        </div>
        
        {/* Info Box */}
        <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <i className="fas fa-info-circle text-blue-600 mt-1"></i>
            <div className="text-sm text-blue-900 dark:text-blue-100">
              <p className="font-semibold mb-1">Settings Information</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>Changes take effect immediately for all users</li>
                <li>Daily ad limit resets at midnight (UTC)</li>
                <li>Reward amounts are distributed when ads are watched</li>
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
