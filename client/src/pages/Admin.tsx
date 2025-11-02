import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAdmin } from "@/hooks/useAdmin";
import Layout from "@/components/Layout";
import { Link } from "wouter";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { formatCurrency } from "@/lib/utils";
import { PAD_TO_TON } from "@shared/constants";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Crown } from "lucide-react";
import { showNotification } from "@/components/AppNotification";

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

export default function AdminPage() {
  const { toast } = useToast();
  const { isAdmin, isLoading: adminLoading } = useAdmin();
  const queryClient = useQueryClient();

  // Fetch admin stats
  const { data: stats } = useQuery<AdminStats>({
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
      <main className="max-w-7xl mx-auto px-4 pb-20 pt-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2 truncate">
            <Crown className="w-6 h-6 text-orange-600" />
            Admin Dashboard
          </h1>
          <Button 
            size="sm"
            variant="outline"
            onClick={() => {
              queryClient.invalidateQueries();
              toast({ title: "✅ Data refreshed successfully" });
            }}
            className="h-9 px-4"
          >
            <i className="fas fa-sync-alt mr-2"></i>
            Refresh
          </Button>
        </div>

        {/* App Dashboard - Vertical Layout */}
        <div className="space-y-4 mb-6">
          <h2 className="text-lg font-semibold text-foreground">App Dashboard</h2>
          
          {/* User Stats */}
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              icon="users"
              label="Total Users"
              value={stats?.totalUsers?.toLocaleString() || '0'}
              iconColor="text-blue-600"
              bgColor="bg-blue-50"
            />
            <StatCard
              icon="user-check"
              label="Active Users"
              value={stats?.dailyActiveUsers?.toLocaleString() || '0'}
              iconColor="text-green-600"
              bgColor="bg-green-50"
            />
          </div>

          {/* Ad Stats */}
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              icon="play-circle"
              label="Total Ads"
              value={stats?.totalAdsWatched?.toLocaleString() || '0'}
              iconColor="text-purple-600"
              bgColor="bg-purple-50"
            />
            <StatCard
              icon="calendar-day"
              label="Today Ads"
              value={stats?.todayAdsWatched?.toLocaleString() || '0'}
              iconColor="text-orange-600"
              bgColor="bg-orange-50"
            />
          </div>

          {/* Balance Stats */}
          <div className="grid grid-cols-1 gap-3">
            <StatCard
              icon="gem"
              label="Total PAD"
              value={formatCurrency(stats?.totalEarnings || '0')}
              iconColor="text-cyan-600"
              bgColor="bg-cyan-50"
            />
            <StatCard
              icon="wallet"
              label="TON Withdrawn"
              value={formatCurrency(stats?.tonWithdrawn || '0')}
              iconColor="text-indigo-600"
              bgColor="bg-indigo-50"
            />
          </div>

          {/* Withdrawal Requests */}
          <h3 className="text-sm font-medium text-muted-foreground mt-4">Total Requests</h3>
          <div className="grid grid-cols-3 gap-3">
            <StatCard
              icon="clock"
              label="Pending"
              value={stats?.pendingWithdrawals?.toString() || '0'}
              iconColor="text-yellow-600"
              bgColor="bg-yellow-50"
            />
            <StatCard
              icon="check-circle"
              label="Approved"
              value={stats?.successfulWithdrawals?.toString() || '0'}
              iconColor="text-green-600"
              bgColor="bg-green-50"
            />
            <StatCard
              icon="times-circle"
              label="Rejected"
              value={stats?.rejectedWithdrawals?.toString() || '0'}
              iconColor="text-red-600"
              bgColor="bg-red-50"
            />
          </div>
        </div>

        {/* Tabs Navigation */}
        <Tabs defaultValue="analytics" className="w-full">
          <TabsList className="grid grid-cols-5 w-full max-w-3xl mx-auto mb-6">
            <TabsTrigger value="analytics">
              <i className="fas fa-chart-line mr-2"></i>
              Analytics
            </TabsTrigger>
            <TabsTrigger value="users">
              <i className="fas fa-users-cog mr-2"></i>
              Users
            </TabsTrigger>
            <TabsTrigger value="promos">
              <i className="fas fa-gift mr-2"></i>
              Promos
            </TabsTrigger>
            <TabsTrigger value="payouts">
              <i className="fas fa-money-check-alt mr-2"></i>
              Payouts
            </TabsTrigger>
            <TabsTrigger value="settings">
              <i className="fas fa-cog mr-2"></i>
              Settings
            </TabsTrigger>
          </TabsList>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-4">
            <AnalyticsSection stats={stats} />
          </TabsContent>

          {/* User Management Tab */}
          <TabsContent value="users" className="space-y-4">
            <UserManagementSection usersData={usersData} />
          </TabsContent>

          {/* Promo Creator Tab */}
          <TabsContent value="promos" className="space-y-4">
            <PromoCreatorSection />
          </TabsContent>

          {/* Payout Logs Tab */}
          <TabsContent value="payouts" className="space-y-4">
            <PayoutLogsSection data={payoutLogsData} />
          </TabsContent>
          
          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-4">
            <SettingsSection />
          </TabsContent>
        </Tabs>
      </main>
    </Layout>
  );
}

// Compact Stat Card Component
function StatCard({ icon, label, value, iconColor, bgColor }: {
  icon: string;
  label: string;
  value: string;
  iconColor: string;
  bgColor: string;
}) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <i className={`fas fa-${icon} ${iconColor} text-xl`}></i>
        </div>
        <div className="text-2xl font-bold text-foreground mb-1">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
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

// User Management Section
function UserManagementSection({ usersData }: { usersData: any }) {
  const [searchTerm, setSearchTerm] = useState('');
  const users = usersData?.users || [];

  const filteredUsers = users.filter((user: any) => 
    user.personalCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.username?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No users found
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((user: any) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      {user.username || user.firstName || 'Anonymous'}
                    </TableCell>
                    <TableCell className="font-mono text-sm">{user.personalCode || 'N/A'}</TableCell>
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
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <div className="mt-4 text-sm text-muted-foreground">
          Showing {filteredUsers.length} of {users.length} users
        </div>
      </CardContent>
    </Card>
  );
}

// Promo Creator Section (Fixed Bug)
function PromoCreatorSection() {
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
        title: "⚠️ Validation Error",
        description: "Promo code and reward amount are required",
        variant: "destructive",
      });
      return;
    }

    const padAmount = parseFloat(formData.rewardAmount);
    if (isNaN(padAmount) || padAmount <= 0) {
      toast({
        title: "⚠️ Validation Error",
        description: "Reward amount must be a positive number",
        variant: "destructive",
      });
      return;
    }

    // Convert PAD to TON before sending (1 PAD = 0.0000001 TON, using PAD_TO_TON constant)
    const tonAmount = padAmount / PAD_TO_TON;

    setIsCreating(true);
    try {
      const response = await apiRequest('POST', '/api/promo-codes/create', {
        code: formData.code.trim().toUpperCase(),
        rewardAmount: tonAmount, // Send TON value
        usageLimit: formData.usageLimit ? parseInt(formData.usageLimit) : null,
        perUserLimit: parseInt(formData.perUserLimit),
        expiresAt: formData.expiresAt || null
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: "✅ Success!",
          description: `Promo code created: ${padAmount} PAD reward`,
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
            <Input
              id="promo-code"
              placeholder="e.g., WELCOME100"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
              maxLength={20}
            />
          </div>
          <div>
            <Label htmlFor="reward-amount">Reward Amount (PAD) *</Label>
            <Input
              id="reward-amount"
              type="number"
              placeholder="Enter exact PAD amount"
              value={formData.rewardAmount}
              onChange={(e) => setFormData({ ...formData, rewardAmount: e.target.value })}
              min="0"
              step="1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Value will be exactly {formData.rewardAmount || '0'} PAD per user
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
                      <Badge className={status.color}>{status.label}</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Reward:</span>
                        <span className="font-semibold ml-1">{Math.round(parseFloat(promo.rewardAmount) * 100000)} PAD</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Claimed:</span>
                        <span className="font-semibold ml-1">{promo.usageCount || 0} / {promo.usageLimit || '∞'}</span>
                      </div>
                    </div>
                    {promo.expiresAt && (
                      <div className="text-xs text-muted-foreground mt-1">
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
  const payouts = data?.withdrawals || [];

  const filteredPayouts = payouts.filter((payout: any) => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'approved') return ['success', 'paid', 'Approved'].includes(payout.status);
    if (statusFilter === 'rejected') return payout.status === 'rejected';
    if (statusFilter === 'pending') return payout.status === 'pending';
    return true;
  });

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
      </CardHeader>
      <CardContent>
        {filteredPayouts.length === 0 ? (
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
                {filteredPayouts.map((payout: any) => (
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
        <div className="mt-4 text-sm text-muted-foreground">
          Showing {filteredPayouts.length} of {payouts.length} payout records
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
  
  // Fetch current settings
  const { data: settingsData, isLoading } = useQuery({
    queryKey: ["/api/admin/settings"],
    queryFn: () => apiRequest("GET", "/api/admin/settings").then(res => res.json()),
  });
  
  const [settings, setSettings] = useState({
    dailyAdLimit: '50',
    rewardPerAd: '1000',
    affiliateCommission: '10',
    walletChangeFee: '5000',
    minimumWithdrawal: '0.5',
    taskPerClickReward: '175',
    taskCreationCost: '0.0003',
    minimumConvert: '0.01',
    seasonBroadcastActive: false
  });
  
  // Update form when settings data loads
  useEffect(() => {
    if (settingsData) {
      setSettings({
        dailyAdLimit: settingsData.dailyAdLimit?.toString() || '50',
        rewardPerAd: settingsData.rewardPerAd?.toString() || '1000',
        affiliateCommission: settingsData.affiliateCommission?.toString() || '10',
        walletChangeFee: settingsData.walletChangeFee?.toString() || '5000',
        minimumWithdrawal: settingsData.minimumWithdrawal?.toString() || '0.5',
        taskPerClickReward: settingsData.taskPerClickReward?.toString() || '175',
        taskCreationCost: settingsData.taskCreationCost?.toString() || '0.0003',
        minimumConvert: settingsData.minimumConvert?.toString() || '0.01',
        seasonBroadcastActive: settingsData.seasonBroadcastActive || false
      });
    }
  }, [settingsData]);
  
  const updateSetting = (key: string, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };
  
  const handleSaveSettings = async () => {
    // Validation
    const adLimit = parseInt(settings.dailyAdLimit);
    const reward = parseInt(settings.rewardPerAd);
    const affiliateCommission = parseFloat(settings.affiliateCommission);
    const walletChangeFee = parseFloat(settings.walletChangeFee);
    const minimumWithdrawal = parseFloat(settings.minimumWithdrawal);
    const taskPerClickReward = parseFloat(settings.taskPerClickReward);
    const taskCreationCost = parseFloat(settings.taskCreationCost);
    const minimumConvert = parseFloat(settings.minimumConvert);
    
    if (isNaN(adLimit) || adLimit <= 0) {
      toast({
        title: "Validation Error",
        description: "Daily ad limit must be a positive number",
        variant: "destructive",
      });
      return;
    }
    
    if (isNaN(reward) || reward <= 0) {
      toast({
        title: "Validation Error",
        description: "Reward per ad must be a positive number",
        variant: "destructive",
      });
      return;
    }
    
    if (isNaN(affiliateCommission) || affiliateCommission < 0 || affiliateCommission > 100) {
      toast({
        title: "Validation Error",
        description: "Affiliate commission must be between 0 and 100",
        variant: "destructive",
      });
      return;
    }
    
    if (isNaN(walletChangeFee) || walletChangeFee < 0) {
      toast({
        title: "Validation Error",
        description: "Wallet change fee must be a positive number",
        variant: "destructive",
      });
      return;
    }
    
    if (isNaN(minimumWithdrawal) || minimumWithdrawal <= 0) {
      toast({
        title: "Validation Error",
        description: "Minimum withdrawal must be a positive number",
        variant: "destructive",
      });
      return;
    }
    
    if (isNaN(taskPerClickReward) || taskPerClickReward <= 0) {
      toast({
        title: "Validation Error",
        description: "Task per click reward must be a positive number",
        variant: "destructive",
      });
      return;
    }
    
    if (isNaN(taskCreationCost) || taskCreationCost <= 0) {
      toast({
        title: "Validation Error",
        description: "Task creation cost must be a positive number",
        variant: "destructive",
      });
      return;
    }
    
    if (isNaN(minimumConvert) || minimumConvert <= 0) {
      toast({
        title: "Validation Error",
        description: "Minimum convert amount must be a positive number",
        variant: "destructive",
      });
      return;
    }
    
    setIsSaving(true);
    try {
      const response = await apiRequest('PUT', '/api/admin/settings', {
        dailyAdLimit: adLimit,
        rewardPerAd: reward,
        affiliateCommission: affiliateCommission,
        walletChangeFee: walletChangeFee,
        minimumWithdrawal: minimumWithdrawal,
        taskPerClickReward: taskPerClickReward,
        taskCreationCost: taskCreationCost,
        minimumConvert: minimumConvert,
        seasonBroadcastActive: settings.seasonBroadcastActive
      });
      
      const result = await response.json();
      
      if (result.success) {
        toast({
          title: "✅ Settings Updated Successfully",
          description: "App settings have been updated and are now active",
        });
        showNotification("Settings updated successfully", "success");
        // Invalidate both admin and app settings to refresh everywhere
        queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
        queryClient.invalidateQueries({ queryKey: ["/api/app-settings"] });
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
          Configure app-wide settings including ad limits, rewards, fees, and task parameters
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Ad & Reward Settings */}
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center">
            <i className="fas fa-video mr-2 text-blue-600"></i>
            Ad & Reward Settings
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="daily-ad-limit" className="text-sm font-semibold">
                Daily Ad Limit
              </Label>
              <p className="text-xs text-muted-foreground">
                Maximum ads per user per day
              </p>
              <Input
                id="daily-ad-limit"
                type="number"
                value={settings.dailyAdLimit}
                onChange={(e) => updateSetting('dailyAdLimit', e.target.value)}
                placeholder="50"
                min="1"
              />
              <p className="text-xs text-muted-foreground">
                Current: {settingsData?.dailyAdLimit || 50} ads
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="reward-per-ad" className="text-sm font-semibold">
                Reward Per Ad (PAD)
              </Label>
              <p className="text-xs text-muted-foreground">
                PAD tokens per ad watched
              </p>
              <Input
                id="reward-per-ad"
                type="number"
                value={settings.rewardPerAd}
                onChange={(e) => updateSetting('rewardPerAd', e.target.value)}
                placeholder="1000"
                min="1"
              />
              <p className="text-xs text-muted-foreground">
                Current: {settingsData?.rewardPerAd || 1000} PAD
              </p>
            </div>
          </div>
        </div>

        {/* Affiliate & Wallet Settings */}
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center">
            <i className="fas fa-users mr-2 text-green-600"></i>
            Affiliate & Wallet Settings
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="affiliate-commission" className="text-sm font-semibold">
                Affiliate Commission (%)
              </Label>
              <p className="text-xs text-muted-foreground">
                Commission percentage for referrals
              </p>
              <Input
                id="affiliate-commission"
                type="number"
                step="0.1"
                value={settings.affiliateCommission}
                onChange={(e) => updateSetting('affiliateCommission', e.target.value)}
                placeholder="10"
                min="0"
                max="100"
              />
              <p className="text-xs text-muted-foreground">
                Current: {settingsData?.affiliateCommission || 10}%
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="wallet-change-fee" className="text-sm font-semibold">
                Wallet Change Fee (PAD)
              </Label>
              <p className="text-xs text-muted-foreground">
                Fee for changing wallet address
              </p>
              <Input
                id="wallet-change-fee"
                type="number"
                step="100"
                value={settings.walletChangeFee}
                onChange={(e) => updateSetting('walletChangeFee', e.target.value)}
                placeholder="5000"
                min="0"
              />
              <p className="text-xs text-muted-foreground">
                Current: {settingsData?.walletChangeFee || 5000} PAD
              </p>
            </div>
          </div>
        </div>

        {/* Withdrawal & Conversion Settings */}
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center">
            <i className="fas fa-wallet mr-2 text-purple-600"></i>
            Withdrawal & Conversion Settings
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="minimum-withdrawal" className="text-sm font-semibold">
                Minimum Withdrawal (TON)
              </Label>
              <p className="text-xs text-muted-foreground">
                Minimum amount for withdrawal
              </p>
              <Input
                id="minimum-withdrawal"
                type="number"
                step="0.01"
                value={settings.minimumWithdrawal}
                onChange={(e) => updateSetting('minimumWithdrawal', e.target.value)}
                placeholder="0.5"
                min="0"
              />
              <p className="text-xs text-muted-foreground">
                Current: {settingsData?.minimumWithdrawal || 0.5} TON
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="minimum-convert" className="text-sm font-semibold">
                Minimum Convert Amount (TON)
              </Label>
              <p className="text-xs text-muted-foreground">
                Minimum for balance conversion
              </p>
              <Input
                id="minimum-convert"
                type="number"
                step="0.001"
                value={settings.minimumConvert}
                onChange={(e) => updateSetting('minimumConvert', e.target.value)}
                placeholder="0.01"
                min="0"
              />
              <p className="text-xs text-muted-foreground">
                Current: {settingsData?.minimumConvert || 0.01} TON
              </p>
            </div>
          </div>
        </div>

        {/* Task Settings */}
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center">
            <i className="fas fa-tasks mr-2 text-orange-600"></i>
            Task Settings
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="task-per-click-reward" className="text-sm font-semibold">
                Task Per Click Reward (PAD)
              </Label>
              <p className="text-xs text-muted-foreground">
                Reward per click on tasks
              </p>
              <Input
                id="task-per-click-reward"
                type="number"
                step="1"
                value={settings.taskPerClickReward}
                onChange={(e) => updateSetting('taskPerClickReward', e.target.value)}
                placeholder="175"
                min="0"
              />
              <p className="text-xs text-muted-foreground">
                Current: {settingsData?.taskPerClickReward || 175} PAD
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="task-creation-cost" className="text-sm font-semibold">
                Task Creation Cost (TON)
              </Label>
              <p className="text-xs text-muted-foreground">
                Cost per click for task creation
              </p>
              <Input
                id="task-creation-cost"
                type="number"
                step="0.00001"
                value={settings.taskCreationCost}
                onChange={(e) => updateSetting('taskCreationCost', e.target.value)}
                placeholder="0.0003"
                min="0"
              />
              <p className="text-xs text-muted-foreground">
                Current: {settingsData?.taskCreationCost || 0.0003} TON
              </p>
            </div>
          </div>
        </div>

        {/* Broadcast Settings */}
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center">
            <i className="fas fa-bullhorn mr-2 text-red-600"></i>
            Broadcast Settings
          </h3>
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="space-y-1">
              <Label htmlFor="season-broadcast" className="text-sm font-semibold">
                Season Broadcast Active
              </Label>
              <p className="text-xs text-muted-foreground">
                Enable or disable seasonal broadcast messages
              </p>
            </div>
            <Switch
              id="season-broadcast"
              checked={settings.seasonBroadcastActive}
              onCheckedChange={(checked) => setSettings(prev => ({ ...prev, seasonBroadcastActive: checked }))}
            />
          </div>
        </div>
        
        {/* Save Button */}
        <div className="pt-4 border-t">
          <Button
            onClick={handleSaveSettings}
            disabled={isSaving}
            className="w-full"
            size="lg"
          >
            {isSaving ? (
              <>
                <i className="fas fa-spinner fa-spin mr-2"></i>
                Saving Settings...
              </>
            ) : (
              <>
                <i className="fas fa-save mr-2"></i>
                Save All Settings
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
                <li>All changes take effect immediately for all users</li>
                <li>Daily ad limit resets at midnight (UTC)</li>
                <li>TON values are displayed in decimal format</li>
                <li>Commission percentages must be between 0-100</li>
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
