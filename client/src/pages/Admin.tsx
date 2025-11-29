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

type UserViewTab = 'list' | 'stats';

function UserManagementSection({ usersData }: { usersData: any }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [activeView, setActiveView] = useState<UserViewTab>('list');
  const itemsPerPage = 8;
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

  const bannedUsers = users.filter((u: any) => u.banned);
  const activeUsers = users.filter((u: any) => !u.banned);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  return (
    <>
      <div className="space-y-3">
        <div className="flex gap-2 flex-wrap items-center">
          <Button size="sm" variant="outline" onClick={() => setActiveView('list')} className={`text-xs h-7 ${activeView === 'list' ? 'bg-gradient-to-r from-[#4cd3ff]/20 to-[#4cd3ff]/10 border-[#4cd3ff] text-[#4cd3ff]' : 'border-white/20 text-muted-foreground hover:border-[#4cd3ff]/50'}`}>
            <i className="fas fa-list mr-1"></i>List ({users.length})
          </Button>
          <Button size="sm" variant="outline" onClick={() => setActiveView('stats')} className={`text-xs h-7 ${activeView === 'stats' ? 'bg-gradient-to-r from-[#4cd3ff]/20 to-[#4cd3ff]/10 border-[#4cd3ff] text-[#4cd3ff]' : 'border-white/20 text-muted-foreground hover:border-[#4cd3ff]/50'}`}>
            <i className="fas fa-chart-pie mr-1"></i>Stats
          </Button>
        </div>
        
        {activeView === 'list' && (
          <Input
            placeholder="🔍 Search by UID or username..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-8 text-sm"
          />
        )}

        {activeView === 'stats' ? (
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gradient-to-br from-[#4cd3ff]/20 to-[#4cd3ff]/5 p-3 rounded text-center border border-[#4cd3ff]/30">
              <p className="text-2xl font-bold text-[#4cd3ff]">{users.length}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
            <div className="bg-gradient-to-br from-green-500/20 to-green-500/5 p-3 rounded text-center border border-green-500/30">
              <p className="text-2xl font-bold text-green-400">{activeUsers.length}</p>
              <p className="text-xs text-muted-foreground">Active</p>
            </div>
            <div className="bg-gradient-to-br from-red-500/20 to-red-500/5 p-3 rounded text-center border border-red-500/30">
              <p className="text-2xl font-bold text-red-400">{bannedUsers.length}</p>
              <p className="text-xs text-muted-foreground">Banned</p>
            </div>
            <div className="bg-gradient-to-br from-purple-500/20 to-purple-500/5 p-3 rounded text-center border border-purple-500/30">
              <p className="text-2xl font-bold text-purple-400">{users.filter((u: any) => u.cwalletId).length}</p>
              <p className="text-xs text-muted-foreground">Wallet</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[320px] overflow-y-auto border border-white/10 rounded-lg">
            <Table>
              <TableHeader className="sticky top-0 bg-background">
                <TableRow>
                  <TableHead className="text-xs">User</TableHead>
                  <TableHead className="text-xs">UID</TableHead>
                  <TableHead className="text-xs">Friends</TableHead>
                  <TableHead className="text-xs text-right">Earned</TableHead>
                  <TableHead className="text-xs">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-4 text-sm">
                      No users
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedUsers.map((user: any) => (
                    <TableRow key={user.id} className="hover:bg-muted/50">
                      <TableCell className="text-xs py-2">{user.username || user.firstName || 'Anon'}{user.banned && <Badge className="ml-1 bg-red-600 text-[10px] px-1">Ban</Badge>}</TableCell>
                      <TableCell className="font-mono text-xs text-[#4cd3ff] py-2">{user.personalCode || 'N/A'}</TableCell>
                      <TableCell className="py-2"><Badge variant="outline" className="text-[10px]">{user.friendsInvited || 0}</Badge></TableCell>
                      <TableCell className="text-right text-xs font-semibold py-2">{formatCurrency(user.totalEarned || '0')}</TableCell>
                      <TableCell className="py-2"><Button size="sm" variant="ghost" onClick={() => setSelectedUser(user)} className="h-6 text-xs px-2"><i className="fas fa-eye"></i></Button></TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
        
        {activeView === 'list' && totalPages > 1 && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{filteredUsers.length} users</span>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="ghost" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="h-6 w-6 p-0"><i className="fas fa-chevron-left text-xs"></i></Button>
              <span className="px-2">{currentPage}/{totalPages}</span>
              <Button size="sm" variant="ghost" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="h-6 w-6 p-0"><i className="fas fa-chevron-right text-xs"></i></Button>
            </div>
          </div>
        )}
      </div>

      {/* User Detail Dialog */}
      <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <i className="fas fa-user-circle text-[#4cd3ff]"></i>
              {selectedUser?.username || selectedUser?.firstName || 'User'}
            </DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-3 max-h-[70vh] overflow-y-auto text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-white/5 p-2 rounded">
                  <p className="text-xs text-muted-foreground">UID</p>
                  <p className="font-mono font-bold text-[#4cd3ff]">{selectedUser.personalCode || 'N/A'}</p>
                </div>
                <div className="bg-white/5 p-2 rounded">
                  <p className="text-xs text-muted-foreground">Join Date</p>
                  <p className="text-sm">{selectedUser.createdAt ? new Date(selectedUser.createdAt).toLocaleDateString() : 'N/A'}</p>
                </div>
              </div>
              
              <div className="bg-gradient-to-r from-[#4cd3ff]/10 to-[#4cd3ff]/5 border border-[#4cd3ff]/30 p-3 rounded">
                <p className="text-xs text-muted-foreground mb-2">💰 Balances</p>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div><p className="text-xs text-muted-foreground">PAD</p><p className="font-bold text-[#4cd3ff]">{Math.round(parseFloat(selectedUser.balance || '0') * 100000)}</p></div>
                  <div><p className="text-xs text-muted-foreground">PDZ</p><p className="font-bold text-purple-400">{parseFloat(selectedUser.pdzBalance || '0').toFixed(2)}</p></div>
                  <div><p className="text-xs text-muted-foreground">USD</p><p className="font-bold text-green-400">${parseFloat(selectedUser.usdBalance || '0').toFixed(2)}</p></div>
                </div>
              </div>

              <div className="bg-gradient-to-r from-emerald-500/10 to-emerald-500/5 border border-emerald-500/30 p-3 rounded">
                <p className="text-xs text-muted-foreground mb-2">📈 Earnings</p>
                <div className="grid grid-cols-2 gap-2">
                  <div><p className="text-xs text-muted-foreground">Total Earned</p><p className="font-bold text-emerald-400">{formatCurrency(selectedUser.totalEarned || '0')}</p></div>
                  <div><p className="text-xs text-muted-foreground">Total Withdrawn</p><p className="font-bold text-amber-400">{formatCurrency(selectedUser.totalWithdrawn || '0')}</p></div>
                </div>
              </div>

              <div className="bg-gradient-to-r from-blue-500/10 to-blue-500/5 border border-blue-500/30 p-3 rounded">
                <p className="text-xs text-muted-foreground mb-2">📊 Activity</p>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div><p className="text-xs text-muted-foreground">Friends</p><p className="font-bold">{selectedUser.friendsInvited || 0}</p></div>
                  <div><p className="text-xs text-muted-foreground">Ads Watched</p><p className="font-bold">{selectedUser.adsWatched || 0}</p></div>
                  <div><p className="text-xs text-muted-foreground">Tasks Done</p><p className="font-bold">{selectedUser.tasksCompleted || 0}</p></div>
                </div>
              </div>

              {selectedUser.walletAddress && (
                <div className="bg-white/5 border border-white/10 p-2 rounded">
                  <p className="text-xs text-muted-foreground mb-1">Wallet Address</p>
                  <p className="font-mono text-xs text-[#4cd3ff] break-all">{selectedUser.walletAddress}</p>
                </div>
              )}

              <div className="flex gap-2 items-center pt-2 border-t border-white/10">
                {selectedUser.banned ? (
                  <Badge className="bg-red-600 text-xs">🚫 Banned</Badge>
                ) : (
                  <Badge className="bg-green-600 text-xs">✓ Active</Badge>
                )}
                {selectedUser.bannedReason && (
                  <span className="text-xs text-muted-foreground">({selectedUser.bannedReason})</span>
                )}
                <div className="ml-auto">
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

type PromoTab = 'create' | 'manage';

function PromoCreatorSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<PromoTab>('create');
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
    toast({ title: "✨ Code Generated!", description: randomCode });
  };

  const { data: promoCodesData } = useQuery({
    queryKey: ["/api/admin/promo-codes"],
    queryFn: () => apiRequest("GET", "/api/admin/promo-codes").then(res => res.json()),
    refetchInterval: 5000,
  });

  const handleCreate = async () => {
    if (!formData.code.trim() || !formData.rewardAmount) {
      toast({ title: "⚠️ Error", description: "Code and amount required", variant: "destructive" });
      return;
    }
    const rewardAmount = parseFloat(formData.rewardAmount);
    if (isNaN(rewardAmount) || rewardAmount <= 0) {
      toast({ title: "⚠️ Error", description: "Amount must be positive", variant: "destructive" });
      return;
    }

    setIsCreating(true);
    try {
      const response = await apiRequest('POST', '/api/promo-codes/create', {
        code: formData.code.trim().toUpperCase(),
        rewardAmount,
        rewardType: formData.rewardType,
        usageLimit: formData.usageLimit ? parseInt(formData.usageLimit) : null,
        perUserLimit: parseInt(formData.perUserLimit),
        expiresAt: formData.expiresAt || null
      });
      const result = await response.json();
      if (result.success) {
        toast({ title: "✅ Created!", description: `${rewardAmount} ${formData.rewardType}` });
        setFormData({ code: '', rewardAmount: '', rewardType: 'PAD', usageLimit: '', perUserLimit: '1', expiresAt: '' });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/promo-codes"] });
        setActiveTab('manage');
      } else {
        throw new Error(result.message);
      }
    } catch (error: any) {
      toast({ title: "❌ Error", description: error.message, variant: "destructive" });
    } finally {
      setIsCreating(false);
    }
  };

  const promoCodes = promoCodesData?.promoCodes || [];
  const getPromoStatus = (promo: any) => {
    const now = new Date();
    const expiresAt = promo.expiresAt ? new Date(promo.expiresAt) : null;
    if (promo.usageLimit && promo.usageCount >= promo.usageLimit) return { label: 'Full', color: 'bg-orange-600' };
    if (expiresAt && now > expiresAt) return { label: 'Expired', color: 'bg-gray-600' };
    if (promo.isActive) return { label: 'Active', color: 'bg-green-600' };
    return { label: 'Off', color: 'bg-gray-600' };
  };

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: "✅ Copied!", description: code });
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-1 flex-wrap">
        <Button size="sm" variant="outline" onClick={() => setActiveTab('create')} className={`text-xs h-7 ${activeTab === 'create' ? 'bg-gradient-to-r from-green-500/20 to-green-500/10 border-green-500 text-green-400' : 'border-white/20 text-muted-foreground hover:border-green-500/50'}`}>
          <i className="fas fa-plus mr-1"></i>Create
        </Button>
        <Button size="sm" variant="outline" onClick={() => setActiveTab('manage')} className={`text-xs h-7 ${activeTab === 'manage' ? 'bg-gradient-to-r from-[#4cd3ff]/20 to-[#4cd3ff]/10 border-[#4cd3ff] text-[#4cd3ff]' : 'border-white/20 text-muted-foreground hover:border-[#4cd3ff]/50'}`}>
          <i className="fas fa-list mr-1"></i>Manage ({promoCodes.length})
        </Button>
      </div>
      
      {activeTab === 'create' ? (
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input placeholder="PROMO CODE" value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })} maxLength={20} className="flex-1 h-8 text-sm" />
            <Button type="button" variant="outline" onClick={handleGenerateCode} size="sm" className="h-8"><i className="fas fa-random"></i></Button>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {(['PAD', 'PDZ', 'USD'] as const).map(type => (
              <Button key={type} type="button" variant={formData.rewardType === type ? 'default' : 'outline'} onClick={() => setFormData({ ...formData, rewardType: type })} className="h-8 text-xs">{type}</Button>
            ))}
          </div>
          <Input type="number" placeholder={`Amount (${formData.rewardType})`} value={formData.rewardAmount} onChange={(e) => setFormData({ ...formData, rewardAmount: e.target.value })} min="0" className="h-8 text-sm" />
          <div className="grid grid-cols-2 gap-2">
            <Input type="number" placeholder="Max Claims" value={formData.usageLimit} onChange={(e) => setFormData({ ...formData, usageLimit: e.target.value })} min="1" className="h-8 text-sm" />
            <Input type="date" value={formData.expiresAt} onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })} className="h-8 text-sm" />
          </div>
          <Button onClick={handleCreate} disabled={isCreating} className="w-full h-8 text-sm">
            {isCreating ? <><i className="fas fa-spinner fa-spin mr-1"></i>Creating...</> : <><i className="fas fa-plus mr-1"></i>Create</>}
          </Button>
        </div>
      ) : (
        <div className="space-y-2 max-h-[300px] overflow-y-auto border border-white/10 rounded-lg p-2">
          {promoCodes.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-sm"><i className="fas fa-gift text-2xl mb-2"></i><p>No codes</p></div>
          ) : (
            promoCodes.map((promo: any) => {
              const status = getPromoStatus(promo);
              return (
                <div key={promo.id} className="border border-white/10 rounded p-2 hover:bg-white/5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <code className="font-bold text-sm bg-white/10 px-1.5 py-0.5 rounded text-[#4cd3ff]">{promo.code}</code>
                      <Button size="sm" variant="ghost" onClick={() => copyToClipboard(promo.code)} className="h-5 w-5 p-0"><i className="fas fa-copy text-[10px]"></i></Button>
                    </div>
                    <Badge className={`${status.color} text-[10px]`}>{status.label}</Badge>
                  </div>
                  <div className="flex justify-between text-xs mt-1 text-muted-foreground"><span>{promo.rewardType === 'USD' ? `$${parseFloat(promo.rewardAmount).toFixed(2)}` : `${Math.round(parseFloat(promo.rewardAmount))} ${promo.rewardType || 'PAD'}`}</span><span>{promo.usageCount || 0}/{promo.usageLimit || '∞'}</span></div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

type PayoutTab = 'all' | 'pending' | 'approved' | 'rejected';

function PayoutLogsSection({ data }: { data: any }) {
  const [statusFilter, setStatusFilter] = useState<PayoutTab>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const itemsPerPage = 6;
  const payouts = data?.withdrawals || [];

  const pendingCount = payouts.filter((p: any) => p.status === 'pending').length;
  const approvedCount = payouts.filter((p: any) => ['success', 'paid', 'Approved'].includes(p.status)).length;
  const rejectedCount = payouts.filter((p: any) => p.status === 'rejected').length;

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
  const paginatedPayouts = filteredPayouts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  useEffect(() => { setCurrentPage(1); }, [statusFilter, searchQuery]);

  const getStatusBadge = (status: string) => {
    if (['success', 'paid', 'Approved'].includes(status)) return <Badge className="bg-green-600 text-[10px] h-4">✓</Badge>;
    if (status === 'rejected') return <Badge className="bg-red-600 text-[10px] h-4">✗</Badge>;
    return <Badge className="bg-yellow-600 text-[10px] h-4">⏳</Badge>;
  };

  const tabButtons: { key: PayoutTab; label: string; count: number; color: string }[] = [
    { key: 'all', label: 'All', count: payouts.length, color: '' },
    { key: 'pending', label: 'Pending', count: pendingCount, color: 'text-yellow-600' },
    { key: 'approved', label: 'Done', count: approvedCount, color: 'text-green-600' },
    { key: 'rejected', label: 'Reject', count: rejectedCount, color: 'text-red-600' },
  ];

  return (
    <div className="space-y-3">
      <div className="flex gap-1 flex-wrap">
        {tabButtons.map((tab) => {
          const isActive = statusFilter === tab.key;
          const activeColors = tab.key === 'pending' ? 'from-yellow-500/20 to-yellow-500/10 border-yellow-500 text-yellow-400' :
            tab.key === 'approved' ? 'from-green-500/20 to-green-500/10 border-green-500 text-green-400' :
            tab.key === 'rejected' ? 'from-red-500/20 to-red-500/10 border-red-500 text-red-400' :
            'from-[#4cd3ff]/20 to-[#4cd3ff]/10 border-[#4cd3ff] text-[#4cd3ff]';
          return (
            <Button key={tab.key} size="sm" variant="outline" onClick={() => setStatusFilter(tab.key)} className={`text-xs h-7 ${isActive ? `bg-gradient-to-r ${activeColors}` : 'border-white/20 text-muted-foreground hover:border-white/40'}`}>
              {tab.label} ({tab.count})
            </Button>
          );
        })}
      </div>
      <Input placeholder="🔍 Search user, UID, wallet..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="h-8 text-sm" />
      
      {paginatedPayouts.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm"><i className="fas fa-inbox text-2xl mb-2"></i><p>No payouts</p></div>
      ) : (
        <div className="overflow-x-auto max-h-[280px] overflow-y-auto border border-white/10 rounded-lg">
          <Table>
            <TableHeader className="sticky top-0 bg-background">
              <TableRow>
                <TableHead className="text-xs">User</TableHead>
                <TableHead className="text-xs">Amount</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedPayouts.map((payout: any) => (
                <TableRow key={payout.id} className="hover:bg-white/5">
                  <TableCell className="text-xs py-2">@{payout.user?.username || 'Anon'}</TableCell>
                  <TableCell className="text-xs py-2 font-semibold text-green-400">{formatCurrency(payout.amount || '0')}</TableCell>
                  <TableCell className="py-2">{getStatusBadge(payout.status)}</TableCell>
                  <TableCell className="text-[10px] py-2 text-muted-foreground">{new Date(payout.createdAt || payout.created_on).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{filteredPayouts.length} records</span>
        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="h-6 w-6 p-0"><i className="fas fa-chevron-left text-xs"></i></Button>
            <span className="px-2">{currentPage}/{totalPages}</span>
            <Button size="sm" variant="ghost" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="h-6 w-6 p-0"><i className="fas fa-chevron-right text-xs"></i></Button>
          </div>
        )}
      </div>
    </div>
  );
}

type SettingsCategory = 'ads' | 'affiliates' | 'withdrawals' | 'tasks' | 'other';

function SettingsSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSaving, setIsSaving] = useState(false);
  const [activeCategory, setActiveCategory] = useState<SettingsCategory>('ads');
  
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
  
  const categories = [
    { id: 'ads' as const, label: 'Ads & Rewards', icon: 'play-circle' },
    { id: 'affiliates' as const, label: 'Affiliates', icon: 'users' },
    { id: 'withdrawals' as const, label: 'Withdrawals', icon: 'wallet' },
    { id: 'tasks' as const, label: 'Tasks', icon: 'tasks' },
    { id: 'other' as const, label: 'Other', icon: 'cog' },
  ];
  
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
      <div className="text-center py-8">
        <i className="fas fa-spinner fa-spin text-3xl text-primary mb-2"></i>
        <p className="text-muted-foreground">Loading settings...</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-3">
      <div className="flex gap-1 flex-wrap">
        {categories.map((cat) => {
          const isActive = activeCategory === cat.id;
          const catColors = cat.id === 'ads' ? 'from-orange-500/20 to-orange-500/10 border-orange-500 text-orange-400' :
            cat.id === 'affiliates' ? 'from-green-500/20 to-green-500/10 border-green-500 text-green-400' :
            cat.id === 'withdrawals' ? 'from-emerald-500/20 to-emerald-500/10 border-emerald-500 text-emerald-400' :
            cat.id === 'tasks' ? 'from-cyan-500/20 to-cyan-500/10 border-[#4cd3ff] text-[#4cd3ff]' :
            'from-purple-500/20 to-purple-500/10 border-purple-500 text-purple-400';
          return (
            <Button key={cat.id} size="sm" variant="outline" onClick={() => setActiveCategory(cat.id)} className={`text-xs h-7 ${isActive ? `bg-gradient-to-r ${catColors}` : 'border-white/20 text-muted-foreground hover:border-white/40'}`}>
              <i className={`fas fa-${cat.icon} mr-1`}></i>{cat.label}
            </Button>
          );
        })}
      </div>

      <div className="space-y-3">
        {activeCategory === 'ads' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="daily-ad-limit" className="text-sm font-semibold">
                <i className="fas fa-calendar-day mr-2 text-orange-600"></i>
                Daily Ad Limit
              </Label>
              <Input
                id="daily-ad-limit"
                type="number"
                value={settings.dailyAdLimit}
                onChange={(e) => setSettings({ ...settings, dailyAdLimit: e.target.value })}
                placeholder="50"
                min="1"
              />
              <p className="text-xs text-muted-foreground">
                Current: {settingsData?.dailyAdLimit || 50} ads/day
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="reward-per-ad" className="text-sm font-semibold">
                <i className="fas fa-gem mr-2 text-purple-600"></i>
                Reward Per Ad (PAD)
              </Label>
              <Input
                id="reward-per-ad"
                type="number"
                value={settings.rewardPerAd}
                onChange={(e) => setSettings({ ...settings, rewardPerAd: e.target.value })}
                placeholder="1000"
                min="1"
              />
              <p className="text-xs text-muted-foreground">
                Current: {settingsData?.rewardPerAd || 1000} PAD
              </p>
            </div>
          </div>
        )}

        {activeCategory === 'affiliates' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="affiliate-commission" className="text-sm font-semibold">
                <i className="fas fa-percent mr-2 text-green-600"></i>
                Affiliate Commission (%)
              </Label>
              <Input
                id="affiliate-commission"
                type="number"
                value={settings.affiliateCommission}
                onChange={(e) => setSettings({ ...settings, affiliateCommission: e.target.value })}
                placeholder="10"
                min="0"
                max="100"
                step="0.1"
              />
              <p className="text-xs text-muted-foreground">
                Current: {settingsData?.affiliateCommission || 10}%
              </p>
            </div>

            <div className="space-y-2 p-3 border rounded-lg bg-green-50/5 border-green-500/20">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">
                  <i className="fas fa-gift mr-2 text-green-500"></i>
                  Referral Bonus
                </Label>
                <button
                  type="button"
                  onClick={() => setSettings({ ...settings, referralRewardEnabled: !settings.referralRewardEnabled })}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                    settings.referralRewardEnabled ? 'bg-green-500' : 'bg-gray-600'
                  }`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                      settings.referralRewardEnabled ? 'translate-x-5' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div>
                  <Label className="text-xs">PAD</Label>
                  <Input
                    type="number"
                    value={settings.referralRewardPAD}
                    onChange={(e) => setSettings({ ...settings, referralRewardPAD: e.target.value })}
                    placeholder="50"
                    disabled={!settings.referralRewardEnabled}
                    className={`h-8 ${!settings.referralRewardEnabled ? 'opacity-50' : ''}`}
                  />
                </div>
                <div>
                  <Label className="text-xs">USD</Label>
                  <Input
                    type="number"
                    value={settings.referralRewardUSD}
                    onChange={(e) => setSettings({ ...settings, referralRewardUSD: e.target.value })}
                    placeholder="0.0005"
                    step="0.0001"
                    disabled={!settings.referralRewardEnabled}
                    className={`h-8 ${!settings.referralRewardEnabled ? 'opacity-50' : ''}`}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {activeCategory === 'withdrawals' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="minimum-withdrawal-usd" className="text-sm font-semibold">
                <i className="fas fa-dollar-sign mr-2 text-green-600"></i>
                Min USD (USD/USDT/Stars)
              </Label>
              <Input
                id="minimum-withdrawal-usd"
                type="number"
                value={settings.minimumWithdrawalUSD}
                onChange={(e) => setSettings({ ...settings, minimumWithdrawalUSD: e.target.value })}
                placeholder="1.00"
                min="0"
                step="0.01"
              />
              <p className="text-xs text-muted-foreground">
                Current: ${settingsData?.minimumWithdrawalUSD || 1.00}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="minimum-withdrawal-ton" className="text-sm font-semibold">
                <i className="fas fa-gem mr-2 text-blue-600"></i>
                Min USD (TON Method)
              </Label>
              <Input
                id="minimum-withdrawal-ton"
                type="number"
                value={settings.minimumWithdrawalTON}
                onChange={(e) => setSettings({ ...settings, minimumWithdrawalTON: e.target.value })}
                placeholder="0.5"
                min="0"
                step="0.01"
              />
              <p className="text-xs text-muted-foreground">
                Current: ${settingsData?.minimumWithdrawalTON || 0.5}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="withdrawal-fee-ton" className="text-sm font-semibold">
                <i className="fas fa-percent mr-2 text-blue-600"></i>
                TON Fee (%)
              </Label>
              <Input
                id="withdrawal-fee-ton"
                type="number"
                value={settings.withdrawalFeeTON}
                onChange={(e) => setSettings({ ...settings, withdrawalFeeTON: e.target.value })}
                placeholder="5"
                min="0"
                max="100"
                step="0.1"
              />
              <p className="text-xs text-muted-foreground">
                Current: {settingsData?.withdrawalFeeTON || 5}%
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="withdrawal-fee-usd" className="text-sm font-semibold">
                <i className="fas fa-percent mr-2 text-green-600"></i>
                USD/USDT Fee (%)
              </Label>
              <Input
                id="withdrawal-fee-usd"
                type="number"
                value={settings.withdrawalFeeUSD}
                onChange={(e) => setSettings({ ...settings, withdrawalFeeUSD: e.target.value })}
                placeholder="3"
                min="0"
                max="100"
                step="0.1"
              />
              <p className="text-xs text-muted-foreground">
                Current: {settingsData?.withdrawalFeeUSD || 3}%
              </p>
            </div>
          </div>
        )}

        {activeCategory === 'tasks' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-sm font-semibold">
                <i className="fas fa-bullhorn mr-2 text-cyan-600"></i>
                Channel Task
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Cost (USD)</Label>
                  <Input
                    type="number"
                    value={settings.channelTaskCost}
                    onChange={(e) => setSettings({ ...settings, channelTaskCost: e.target.value })}
                    placeholder="0.003"
                    step="0.0001"
                    className="h-8"
                  />
                </div>
                <div>
                  <Label className="text-xs">Reward (PAD)</Label>
                  <Input
                    type="number"
                    value={settings.channelTaskReward}
                    onChange={(e) => setSettings({ ...settings, channelTaskReward: e.target.value })}
                    placeholder="30"
                    className="h-8"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold">
                <i className="fas fa-robot mr-2 text-purple-600"></i>
                Bot Task
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Cost (USD)</Label>
                  <Input
                    type="number"
                    value={settings.botTaskCost}
                    onChange={(e) => setSettings({ ...settings, botTaskCost: e.target.value })}
                    placeholder="0.003"
                    step="0.0001"
                    className="h-8"
                  />
                </div>
                <div>
                  <Label className="text-xs">Reward (PAD)</Label>
                  <Input
                    type="number"
                    value={settings.botTaskReward}
                    onChange={(e) => setSettings({ ...settings, botTaskReward: e.target.value })}
                    placeholder="20"
                    className="h-8"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="partner-task-reward" className="text-sm font-semibold">
                <i className="fas fa-handshake mr-2 text-green-600"></i>
                Partner Task Reward (PAD)
              </Label>
              <Input
                id="partner-task-reward"
                type="number"
                value={settings.partnerTaskReward}
                onChange={(e) => setSettings({ ...settings, partnerTaskReward: e.target.value })}
                placeholder="5"
              />
              <p className="text-xs text-muted-foreground">
                Current: {settingsData?.partnerTaskReward || 5} PAD
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="minimum-clicks" className="text-sm font-semibold">
                <i className="fas fa-mouse-pointer mr-2 text-pink-600"></i>
                Minimum Clicks
              </Label>
              <Input
                id="minimum-clicks"
                type="number"
                value={settings.minimumClicks}
                onChange={(e) => setSettings({ ...settings, minimumClicks: e.target.value })}
                placeholder="500"
                min="1"
              />
              <p className="text-xs text-muted-foreground">
                Current: {settingsData?.minimumClicks || 500} clicks
              </p>
            </div>
          </div>
        )}

        {activeCategory === 'other' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="wallet-change-fee" className="text-sm font-semibold">
                <i className="fas fa-exchange-alt mr-2 text-yellow-600"></i>
                Wallet Change Fee (PAD)
              </Label>
              <Input
                id="wallet-change-fee"
                type="number"
                value={settings.walletChangeFee}
                onChange={(e) => setSettings({ ...settings, walletChangeFee: e.target.value })}
                placeholder="5000"
              />
              <p className="text-xs text-muted-foreground">
                Current: {settingsData?.walletChangeFee || 5000} PAD
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="minimum-convert-pad" className="text-sm font-semibold">
                <i className="fas fa-repeat mr-2 text-indigo-600"></i>
                Min Convert (PAD)
              </Label>
              <Input
                id="minimum-convert-pad"
                type="number"
                value={settings.minimumConvertPAD}
                onChange={(e) => setSettings({ ...settings, minimumConvertPAD: e.target.value })}
                placeholder="100"
              />
              <p className="text-xs text-muted-foreground">
                Current: {settingsData?.minimumConvertPAD || 100} PAD
              </p>
            </div>

            <div className="space-y-2 p-3 border rounded-lg">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">
                  <i className="fas fa-broadcast-tower mr-2 text-cyan-600"></i>
                  Season Broadcast
                </Label>
                <button
                  type="button"
                  onClick={() => setSettings({ ...settings, seasonBroadcastActive: !settings.seasonBroadcastActive })}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                    settings.seasonBroadcastActive ? 'bg-green-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                      settings.seasonBroadcastActive ? 'translate-x-5' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                {settings.seasonBroadcastActive ? 'Active' : 'Inactive'}
              </p>
            </div>
          </div>
        )}
        
        <div className="pt-3 border-t flex gap-2">
          <Button
            onClick={handleSaveSettings}
            disabled={isSaving}
            size="sm"
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
      </div>
    </div>
  );
}
