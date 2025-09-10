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
        {/* Authentication Status */}
        {!user ? (
          <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-2 mb-2">
              <i className="fas fa-info-circle text-blue-600 dark:text-blue-400"></i>
              <h3 className="font-semibold text-blue-900 dark:text-blue-100">Telegram Mini App</h3>
            </div>
            <p className="text-blue-800 dark:text-blue-200 text-sm mb-3">
              This app is designed to work as a Telegram Mini App. For full functionality, access it through your Telegram bot.
            </p>
            {typeof window !== 'undefined' && window.Telegram?.WebApp ? (
              <Button 
                onClick={authenticateWithTelegramWebApp}
                disabled={isTelegramAuthenticating}
                className="w-full"
              >
                {isTelegramAuthenticating ? "Authenticating..." : "Login with Telegram"}
              </Button>
            ) : (
              <div className="text-blue-700 dark:text-blue-300 text-sm">
                <p className="mb-2">Currently running in browser mode for development.</p>
                <p className="text-xs text-blue-600 dark:text-blue-400">
                  💡 To test: Open via Telegram → Your Bot → Web App
                </p>
              </div>
            )}
            {telegramAuthError && (
              <p className="text-red-600 dark:text-red-400 text-sm mt-2">
                Error: {telegramAuthError.message}
              </p>
            )}
          </div>
        ) : null}

        {/* Development Mode Notice - only show in actual development */}
        {user && typeof window !== 'undefined' && !window.Telegram?.WebApp && window.location.hostname.includes('replit') && (
          <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg border border-yellow-200 dark:border-yellow-800">
            <div className="flex items-center gap-2">
              <i className="fas fa-flask text-yellow-600 dark:text-yellow-400 text-sm"></i>
              <span className="text-yellow-800 dark:text-yellow-200 text-sm font-medium">
                Development Mode - Test Account Active
              </span>
            </div>
          </div>
        )}

        {/* Balance Section */}
        <BalanceCard user={user} stats={stats} />

        {/* Watch Ads Section */}
        <AdWatchingSection user={user} />

        {/* Streak Section */}
        <StreakCard user={user} />

        {/* Recent Activity */}
        <Card className="rounded-xl shadow-sm border border-border mt-4">
          <CardContent className="p-4">
            <h3 className="text-base font-semibold text-foreground mb-3">Recent Activity</h3>
            
            {earningsLoading ? (
              <div className="text-center py-4">
                <div className="text-muted-foreground">Loading activity...</div>
              </div>
            ) : !earnings || (earnings as any[])?.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-muted-foreground mb-2">No activity yet</div>
                <div className="text-muted-foreground text-sm">
                  Watch your first ad to start earning!
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {(earnings as any[])?.slice(0, 5).map((earning: any) => (
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
