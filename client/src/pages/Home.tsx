import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import Layout from "@/components/Layout";
import AdWatchingSection from "@/components/AdWatchingSection";
import StreakCard from "@/components/StreakCard";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import React from "react";

// Type definition for user object
interface User {
  id?: string;
  telegramId?: string;
  balance?: string;
  lastStreakDate?: string;
  [key: string]: any;
}

export default function Home() {
  const { toast } = useToast();
  const { user, isLoading, authenticateWithTelegramWebApp, isTelegramAuthenticating, telegramAuthError } = useAuth();
  const [streakDialogOpen, setStreakDialogOpen] = React.useState(false);

  const { data: stats, isLoading: statsLoading } = useQuery<{
    todayEarnings?: string;
    referralEarnings?: string;
  }>({
    queryKey: ["/api/user/stats"],
    retry: false,
  });

  const { data: tasksData } = useQuery<{
    tasks?: Array<{ claimed: boolean; [key: string]: any }>;
    adsWatchedToday?: number;
  }>({
    queryKey: ["/api/tasks/daily"],
    retry: false,
  });

  // Check if streak dialog should be shown (once per day)
  React.useEffect(() => {
    if (user) {
      const today = new Date().toISOString().split('T')[0];
      const lastShown = localStorage.getItem('streakDialogShown');
      
      // Show dialog if not shown today
      if (lastShown !== today) {
        setTimeout(() => setStreakDialogOpen(true), 500);
      }
    }
  }, [user]);


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
        {!(user as User) && (
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
        )}

        {/* Development Mode Notice - only show in actual development */}
        {(user as User) && typeof window !== 'undefined' && !window.Telegram?.WebApp && window.location.hostname.includes('replit') && (
          <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg border border-yellow-200 dark:border-yellow-800">
            <div className="flex items-center gap-2">
              <i className="fas fa-flask text-yellow-600 dark:text-yellow-400 text-sm"></i>
              <span className="text-yellow-800 dark:text-yellow-200 text-sm font-medium">
                Development Mode - Test Account Active
              </span>
            </div>
          </div>
        )}

        {/* Income Statistics Widget */}
        <div className="mt-3 bg-gradient-to-br from-purple-900/30 to-blue-900/30 border border-purple-500/20 rounded-xl p-3 shadow-lg">
          <h3 className="text-sm font-semibold text-white mb-2">Income statistics</h3>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Today:</span>
              <span className="font-semibold text-white">
                {statsLoading ? "..." : stats?.todayEarnings || "0.00"}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">All time:</span>
              <span className="font-semibold text-white">
                {statsLoading ? "..." : (parseFloat((user as User)?.balance || "0") * 100000).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">On referrals:</span>
              <span className="font-semibold text-white">—</span>
            </div>
          </div>
          
          <div className="mt-3 pt-3 border-t border-purple-500/20">
            <div className="text-xs font-medium text-gray-300 mb-1.5">Today's activity:</div>
            <div className="flex justify-between text-sm">
              <div className="flex items-center gap-1.5">
                <span className="text-gray-400">Tasks</span>
                <span className="font-semibold text-white">
                  {tasksData?.tasks?.filter((t: any) => t.claimed)?.length ?? 0}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-gray-400">Ads</span>
                <span className="font-semibold text-white">
                  {tasksData?.adsWatchedToday ?? 0}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Watch Ads Section */}
        <AdWatchingSection user={user as User} />

        {/* Network Chat Section */}
        <Card className="mt-3 bg-gradient-to-br from-blue-900/40 to-purple-900/40 border-purple-500/30 rounded-xl shadow-lg">
          <CardContent className="p-4">
            <div className="text-center">
              <h3 className="text-base font-semibold text-white mb-2">
                Network with other members in our chat room
              </h3>
              <Button
                onClick={() => {
                  if (window.Telegram?.WebApp?.openTelegramLink) {
                    window.Telegram.WebApp.openTelegramLink('https://t.me/PaidAdsCommunity');
                  } else {
                    window.open('https://t.me/PaidAdsCommunity', '_blank');
                  }
                }}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg"
              >
                <i className="fas fa-comments mr-2"></i>
                Go to chat
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Basic Rules Section */}
        <Card className="mt-3 bg-gradient-to-br from-blue-900/40 to-purple-900/40 border-purple-500/30 rounded-xl shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center">
                  <span className="text-yellow-500 text-lg">⚠️</span>
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-white mb-2.5">📜 Basic Rules</h3>
                <ul className="space-y-1.5 text-sm text-gray-200">
                  <li className="flex items-start gap-1.5">
                    <span className="text-red-400 mt-0.5">•</span>
                    <span>It is forbidden to use VPN, proxy, or any tools that hide your real IP.</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="text-red-400 mt-0.5">•</span>
                    <span>Using automated systems, bots, or emulators is strictly prohibited.</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="text-red-400 mt-0.5">•</span>
                    <span>All activity must come from real devices.</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="text-red-400 mt-0.5">•</span>
                    <span>Detected use of virtual servers or fake activity will result in permanent account suspension.</span>
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Streak Dialog - Shows once per day */}
        <StreakCard 
          user={user as User} 
          open={streakDialogOpen}
          onOpenChange={setStreakDialogOpen}
        />
      </main>
    </Layout>
  );
}
