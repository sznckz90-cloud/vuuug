import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import Layout from "@/components/Layout";
import BalanceCard from "@/components/BalanceCard";
import AdWatchingSection from "@/components/AdWatchingSection";
import StreakCard from "@/components/StreakCard";
import RewardNotification from "@/components/RewardNotification";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";

export default function Home() {
  const { toast } = useToast();
  const { user, isLoading, authenticateWithTelegramWebApp, isTelegramAuthenticating, telegramAuthError } = useAuth();

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/user/stats"],
    retry: false,
  });

  const { data: earnings, isLoading: earningsLoading } = useQuery({
    queryKey: ["/api/earnings"],
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
        {/* Telegram Authentication Test Button */}
        {!user && (
          <div className="mb-4 p-4 bg-primary/10 rounded-lg">
            <h3 className="font-semibold mb-2">Telegram Authentication</h3>
            <Button 
              onClick={authenticateWithTelegramWebApp}
              disabled={isTelegramAuthenticating}
              className="w-full"
            >
              {isTelegramAuthenticating ? "Authenticating..." : "Login with Telegram"}
            </Button>
            {telegramAuthError && (
              <p className="text-red-500 text-sm mt-2">
                Error: {telegramAuthError.message}
              </p>
            )}
          </div>
        )}

        {/* Balance Section */}
        <BalanceCard user={user} stats={stats} />

        {/* Watch Ads Section */}
        <AdWatchingSection user={user} />

        {/* Streak Section */}
        <StreakCard user={user} />

        {/* Stats Section */}
        <div className="grid grid-cols-2 gap-3 mt-4">
          <Card className="shadow-sm border border-border">
            <CardContent className="p-3 text-center">
              <div className="text-xl font-bold text-foreground" data-testid="text-today-earnings">
                ${statsLoading ? "..." : (parseFloat(stats?.todayEarnings || "0")).toFixed(5)}
              </div>
              <div className="text-muted-foreground text-xs">Today</div>
            </CardContent>
          </Card>
          <Card className="shadow-sm border border-border">
            <CardContent className="p-3 text-center">
              <div className="text-xl font-bold text-foreground" data-testid="text-week-earnings">
                ${statsLoading ? "..." : (parseFloat(stats?.weekEarnings || "0")).toFixed(5)}
              </div>
              <div className="text-muted-foreground text-xs">This Week</div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <Card className="rounded-xl shadow-sm border border-border mt-4">
          <CardContent className="p-4">
            <h3 className="text-base font-semibold text-foreground mb-3">Recent Activity</h3>
            
            {earningsLoading ? (
              <div className="text-center py-4">
                <div className="text-muted-foreground">Loading activity...</div>
              </div>
            ) : !earnings || earnings.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-muted-foreground mb-2">No activity yet</div>
                <div className="text-muted-foreground text-sm">
                  Watch your first ad to start earning!
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {earnings.slice(0, 5).map((earning: any) => (
                  <div key={earning.id} className="flex justify-between items-center py-3 border-b border-border last:border-b-0">
                    <div className="flex items-center gap-3">
                      <div className="bg-primary/10 p-2 rounded-lg">
                        <i className={`fas ${
                          earning.type === 'ad_watch' ? 'fa-video text-primary' :
                          earning.type === 'streak_bonus' ? 'fa-fire text-secondary' :
                          earning.type === 'referral' ? 'fa-users text-primary' :
                          'fa-dollar-sign text-muted-foreground'
                        } text-sm`}></i>
                      </div>
                      <div>
                        <div className="font-medium text-foreground">
                          {earning.type === 'ad_watch' ? 'Ad Watched' :
                           earning.type === 'streak_bonus' ? 'Streak Bonus' :
                           earning.type === 'referral' ? 'Referral Bonus' :
                           earning.description}
                        </div>
                        <div className="text-muted-foreground text-xs">
                          {new Date(earning.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <div className={`font-semibold ${
                      parseFloat(earning.amount) > 0 ? 'text-primary' : 'text-destructive'
                    }`}>
                      {parseFloat(earning.amount) > 0 ? '+' : ''}${parseFloat(earning.amount).toFixed(5)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>


      </main>

      <RewardNotification />
    </Layout>
  );
}
