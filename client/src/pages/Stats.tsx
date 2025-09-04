import { useAuth } from "@/hooks/useAuth";
import Layout from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";

export default function Stats() {
  const { user, isLoading } = useAuth();

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/user/stats"],
    retry: false,
  });

  const { data: earnings, isLoading: earningsLoading } = useQuery({
    queryKey: ["/api/earnings"],
    retry: false,
  });

  const { data: withdrawals, isLoading: withdrawalsLoading } = useQuery({
    queryKey: ["/api/withdrawals"],
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin text-primary text-3xl mb-4">
            <i className="fas fa-spinner"></i>
          </div>
          <div className="text-foreground font-medium">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <Layout>
      <main className="max-w-md mx-auto px-4 pb-20">
        <div className="py-6">
          <h1 className="text-2xl font-bold text-foreground mb-6 text-center">
            Your Statistics
          </h1>

          {/* Earnings Overview */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <Card className="shadow-sm border border-border">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-foreground" data-testid="text-total-earnings">
                  ${statsLoading ? "..." : Math.max(0, parseFloat(stats?.totalEarnings || "0")).toFixed(5)}
                </div>
                <div className="text-muted-foreground text-sm">Total Earned</div>
              </CardContent>
            </Card>
            <Card className="shadow-sm border border-border">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-foreground" data-testid="text-current-balance">
                  ${user ? Math.max(0, parseFloat(user.balance || "0")).toFixed(5) : "0.00000"}
                </div>
                <div className="text-muted-foreground text-sm">Current Balance</div>
              </CardContent>
            </Card>
          </div>

          {/* Time Period Stats */}
          <Card className="shadow-sm border border-border mb-6">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">Earnings Breakdown</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Today</span>
                  <span className="font-semibold text-foreground" data-testid="text-today-detailed">
                    ${statsLoading ? "..." : Math.max(0, parseFloat(stats?.todayEarnings || "0")).toFixed(5)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">This Week</span>
                  <span className="font-semibold text-foreground" data-testid="text-week-detailed">
                    ${statsLoading ? "..." : Math.max(0, parseFloat(stats?.weekEarnings || "0")).toFixed(5)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">This Month</span>
                  <span className="font-semibold text-foreground" data-testid="text-month-detailed">
                    ${statsLoading ? "..." : Math.max(0, parseFloat(stats?.monthEarnings || "0")).toFixed(5)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Activity Stats */}
          <Card className="shadow-sm border border-border mb-6">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">Activity</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Ads Watched Today</span>
                  <span className="font-semibold text-foreground" data-testid="text-ads-watched">
                    {user?.adsWatchedToday || 0}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Current Streak</span>
                  <span className="font-semibold text-foreground flex items-center gap-1" data-testid="text-current-streak">
                    {user?.currentStreak || 0} days
                    {(user?.currentStreak || 0) > 0 && (
                      <i className="fas fa-fire text-secondary"></i>
                    )}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Total Transactions</span>
                  <span className="font-semibold text-foreground" data-testid="text-total-transactions">
                    {earningsLoading ? "..." : (earnings?.length || 0)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Withdrawal History */}
          <Card className="shadow-sm border border-border mb-6">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">Withdrawal History</h3>
              
              {withdrawalsLoading ? (
                <div className="text-center py-4">
                  <div className="text-muted-foreground">Loading withdrawals...</div>
                </div>
              ) : !withdrawals || withdrawals.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-muted-foreground mb-2">No withdrawals yet</div>
                  <div className="text-muted-foreground text-sm">
                    Make your first withdrawal from your profile
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {withdrawals.map((withdrawal: any) => (
                    <div key={withdrawal.id} className="flex justify-between items-center py-2 border-b border-border last:border-b-0">
                      <div>
                        <div className="font-medium text-foreground">
                          ${parseFloat(withdrawal.amount).toFixed(2)}
                        </div>
                        <div className="text-muted-foreground text-xs">
                          {new Date(withdrawal.createdAt).toLocaleDateString()} • {withdrawal.method}
                        </div>
                      </div>
                      <div className={`text-xs px-2 py-1 rounded-full ${
                        withdrawal.status === 'completed' ? 'bg-primary/10 text-primary' :
                        withdrawal.status === 'processing' ? 'bg-secondary/10 text-secondary' :
                        withdrawal.status === 'failed' ? 'bg-destructive/10 text-destructive' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        {withdrawal.status}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Earning Types Breakdown */}
          <Card className="shadow-sm border border-border">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">Earning Sources</h3>
              
              {earningsLoading ? (
                <div className="text-center py-4">
                  <div className="text-muted-foreground">Loading breakdown...</div>
                </div>
              ) : !earnings || earnings.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-muted-foreground mb-2">No earnings yet</div>
                  <div className="text-muted-foreground text-sm">
                    Watch ads to start earning!
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {['ad_watch', 'streak_bonus', 'referral'].map(type => {
                    const typeEarnings = earnings.filter((e: any) => e.type === type);
                    const total = typeEarnings.reduce((sum: number, e: any) => sum + parseFloat(e.amount), 0);
                    const count = typeEarnings.length;
                    
                    return (
                      <div key={type} className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <div className="bg-primary/10 p-2 rounded-lg">
                            <i className={`fas ${
                              type === 'ad_watch' ? 'fa-video text-primary' :
                              type === 'streak_bonus' ? 'fa-fire text-secondary' :
                              'fa-users text-primary'
                            } text-sm`}></i>
                          </div>
                          <div>
                            <div className="font-medium text-foreground">
                              {type === 'ad_watch' ? 'Ad Watching' :
                               type === 'streak_bonus' ? 'Streak Bonuses' :
                               'Referral Bonuses'}
                            </div>
                            <div className="text-muted-foreground text-xs">
                              {count} {count === 1 ? 'transaction' : 'transactions'}
                            </div>
                          </div>
                        </div>
                        <div className="font-semibold text-foreground">
                          ${total.toFixed(5)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </Layout>
  );
}
