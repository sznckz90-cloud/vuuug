import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useAdmin } from '@/hooks/useAdmin';
import { apiRequest } from '@/lib/queryClient';
import Layout from "@/components/Layout";

export default function Promote() {
  const { isAdmin } = useAdmin();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch pending promotions for admin
  const { data: pendingPromotions } = useQuery<{success: boolean, promotions: any[]}>({
    queryKey: ['/api/admin/promotions/pending'],
    retry: false,
    enabled: isAdmin,
  });

  // Fetch admin stats
  const { data: adminStats } = useQuery<{
    totalUsers: number;
    totalEarnings: string;
    totalWithdrawals: string;
    pendingWithdrawals: number;
    dailyActiveUsers: number;
    totalAdsWatched: number;
  }>({
    queryKey: ['/api/admin/stats'],
    retry: false,
    enabled: isAdmin,
  });

  // Fetch pending withdrawals for admin
  const { data: pendingWithdrawals } = useQuery<{success: boolean, withdrawals: any[]}>({
    queryKey: ['/api/admin/withdrawals/pending'],
    retry: false,
    enabled: isAdmin,
  });

  // Approve promotion mutation
  const approvePromotionMutation = useMutation({
    mutationFn: async (promotionId: string) => {
      const response = await apiRequest('POST', `/api/admin/promotions/${promotionId}/approve`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Promotion Approved ✅",
        description: "Promotion has been approved and posted to channel",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/promotions/pending'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
    },
    onError: (error: any) => {
      toast({
        title: "Approval Failed",
        description: error.message || "Failed to approve promotion",
        variant: "destructive",
      });
    },
  });

  // Reject promotion mutation
  const rejectPromotionMutation = useMutation({
    mutationFn: async (promotionId: string) => {
      const response = await apiRequest('POST', `/api/admin/promotions/${promotionId}/reject`, {
        reason: 'Rejected by admin',
        refund: true
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Promotion Rejected ❌",
        description: "Promotion has been rejected and user refunded",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/promotions/pending'] });
    },
    onError: (error: any) => {
      toast({
        title: "Rejection Failed",
        description: error.message || "Failed to reject promotion",
        variant: "destructive",
      });
    },
  });

  // Approve withdrawal mutation
  const approveWithdrawalMutation = useMutation({
    mutationFn: async (withdrawalId: string) => {
      const response = await apiRequest('POST', `/api/admin/withdrawals/${withdrawalId}/approve`);
      
      // IMPROVED ERROR HANDLING: Check response status before parsing
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error occurred' }));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Check if the API returned an error in the response body
      if (!data.success && data.message) {
        throw new Error(data.message);
      }
      
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Withdrawal Approved ✅",
        description: "Withdrawal has been processed and marked as paid",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/withdrawals/pending'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/stats'] });
    },
    onError: (error: any) => {
      console.error('Withdrawal approval error:', error);
      toast({
        title: "Approval Failed",
        description: error.message || "Failed to approve withdrawal",
        variant: "destructive",
      });
    },
  });

  // Reject withdrawal mutation
  const rejectWithdrawalMutation = useMutation({
    mutationFn: async (withdrawalId: string) => {
      const response = await apiRequest('POST', `/api/admin/withdrawals/${withdrawalId}/reject`, {
        reason: 'Rejected by admin'
      });
      
      // IMPROVED ERROR HANDLING: Check response status before parsing
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error occurred' }));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Check if the API returned an error in the response body
      if (!data.success && data.message) {
        throw new Error(data.message);
      }
      
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Withdrawal Rejected ❌",
        description: "Withdrawal has been rejected and balance refunded",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/withdrawals/pending'] });
    },
    onError: (error: any) => {
      console.error('Withdrawal rejection error:', error);
      toast({
        title: "Rejection Failed",
        description: error.message || "Failed to reject withdrawal",
        variant: "destructive",
      });
    },
  });

  return (
    <Layout>
      <main className="max-w-md mx-auto px-4 pb-20">
        <div className="py-6">
          <h1 className="text-2xl font-bold text-foreground mb-6 text-center">
            Promote Your Content
          </h1>

          {/* Create Task Section */}
          <Card className="shadow-sm border border-border mb-6">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
                <i className="fas fa-plus-circle text-primary"></i>
                Create Task
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Create promotional tasks for other users to complete and earn rewards
              </p>
              <Link href="/create-task">
                <Button className="w-full gap-2">
                  <i className="fas fa-rocket"></i>
                  Create New Task
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* My Task List Section */}
          <Card className="shadow-sm border border-border">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
                <i className="fas fa-list-alt text-secondary"></i>
                My Task List
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                View and manage your created promotional tasks
              </p>
              <Link href="/my-promotions">
                <Button variant="outline" className="w-full gap-2">
                  <i className="fas fa-tasks"></i>
                  Manage My Tasks
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Admin Panel - Only visible to admins */}
          {isAdmin && (
            <>
              <div className="mt-8 mb-4">
                <h2 className="text-xl font-bold text-foreground text-center">
                  Admin Panel
                </h2>
              </div>

              {/* Admin Stats */}
              <Card className="shadow-sm border border-border mb-6">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
                    <i className="fas fa-chart-bar text-blue-600"></i>
                    Quick Stats
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="text-center">
                      <div className="font-semibold text-lg">{adminStats?.totalUsers || 0}</div>
                      <div className="text-muted-foreground">Total Users</div>
                    </div>
                    <div className="text-center">
                      <div className="font-semibold text-lg">{adminStats?.totalAdsWatched || 0}</div>
                      <div className="text-muted-foreground">Ads Watched</div>
                    </div>
                    <div className="text-center">
                      <div className="font-semibold text-lg">${parseFloat(adminStats?.totalEarnings || '0').toFixed(2)}</div>
                      <div className="text-muted-foreground">Total Earnings</div>
                    </div>
                    <div className="text-center">
                      <div className="font-semibold text-lg">{adminStats?.pendingWithdrawals || 0}</div>
                      <div className="text-muted-foreground">Pending Payouts</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Pending Promotions */}
              <Card className="shadow-sm border border-border mb-6">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
                    <i className="fas fa-clock text-yellow-600"></i>
                    Pending Promotions
                    {pendingPromotions?.promotions && pendingPromotions.promotions.length > 0 && (
                      <Badge variant="destructive" className="ml-auto">
                        {pendingPromotions.promotions.length}
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {pendingPromotions?.promotions && pendingPromotions.promotions.length > 0 ? (
                    <div className="space-y-3">
                      {pendingPromotions.promotions.map((promotion: any) => (
                        <div key={promotion.id} className="border rounded p-3 bg-muted/20">
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex-1">
                              <div className="font-medium text-sm">{promotion.title}</div>
                              <div className="text-xs text-muted-foreground">
                                {promotion.type} • ${promotion.rewardPerUser} reward • {promotion.limit} slots
                              </div>
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {promotion.type}
                            </Badge>
                          </div>
                          <div className="flex gap-2">
                            <Button 
                              size="sm" 
                              className="flex-1 bg-green-600 hover:bg-green-700"
                              onClick={() => approvePromotionMutation.mutate(promotion.id)}
                              disabled={approvePromotionMutation.isPending || rejectPromotionMutation.isPending}
                            >
                              <i className="fas fa-check mr-1"></i>
                              Approve
                            </Button>
                            <Button 
                              size="sm" 
                              variant="destructive" 
                              className="flex-1"
                              onClick={() => rejectPromotionMutation.mutate(promotion.id)}
                              disabled={approvePromotionMutation.isPending || rejectPromotionMutation.isPending}
                            >
                              <i className="fas fa-times mr-1"></i>
                              Reject
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No pending promotions
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Pending Withdrawals */}
              <Card className="shadow-sm border border-border mb-6">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
                    <i className="fas fa-money-bill-wave text-green-600"></i>
                    Pending Withdrawals
                    {pendingWithdrawals?.withdrawals && pendingWithdrawals.withdrawals.length > 0 && (
                      <Badge variant="destructive" className="ml-auto">
                        {pendingWithdrawals.withdrawals.length}
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {pendingWithdrawals?.withdrawals && pendingWithdrawals.withdrawals.length > 0 ? (
                    <div className="space-y-3">
                      {pendingWithdrawals.withdrawals.map((withdrawal: any) => (
                        <div key={withdrawal.id} className="border rounded p-3 bg-muted/20">
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex-1">
                              <div className="font-medium text-sm">
                                {withdrawal.user?.firstName || withdrawal.user?.username || 'Unknown User'}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                ${withdrawal.amount} • {withdrawal.method} • {new Date(withdrawal.createdAt).toLocaleDateString()}
                              </div>
                            </div>
                            <Badge variant="outline" className="text-xs">
                              ${withdrawal.amount}
                            </Badge>
                          </div>
                          <div className="flex gap-2">
                            <Button 
                              size="sm" 
                              className="flex-1 bg-green-600 hover:bg-green-700"
                              onClick={() => approveWithdrawalMutation.mutate(withdrawal.id)}
                              disabled={approveWithdrawalMutation.isPending || rejectWithdrawalMutation.isPending}
                            >
                              <i className="fas fa-check mr-1"></i>
                              Paid
                            </Button>
                            <Button 
                              size="sm" 
                              variant="destructive" 
                              className="flex-1"
                              onClick={() => rejectWithdrawalMutation.mutate(withdrawal.id)}
                              disabled={approveWithdrawalMutation.isPending || rejectWithdrawalMutation.isPending}
                            >
                              <i className="fas fa-times mr-1"></i>
                              Reject
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No pending withdrawals
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Full Admin Dashboard Link */}
              <Card className="shadow-sm border border-border mb-6">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
                    <i className="fas fa-cog text-purple-600"></i>
                    Full Admin Dashboard
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Access the complete admin dashboard with detailed analytics, user management, and withdrawal handling
                  </p>
                  <Link href="/admin">
                    <Button variant="outline" className="w-full gap-2">
                      <i className="fas fa-external-link-alt"></i>
                      Open Admin Dashboard
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </main>
    </Layout>
  );
}