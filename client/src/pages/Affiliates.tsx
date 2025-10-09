import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { showNotification } from '@/components/AppNotification';
import Layout from '@/components/Layout';
import { useAuth } from '@/hooks/useAuth';

interface User {
  id: string;
  username?: string;
  firstName?: string;
  referralCode?: string;
  [key: string]: any;
}

interface ReferralStats {
  referralCount: number;
  referralEarnings: string;
}

export default function Affiliates() {
  const { user: authUser } = useAuth();
  
  // Fetch user data
  const { data: user, isLoading: userLoading } = useQuery<User>({
    queryKey: ['/api/auth/user'],
    retry: false,
  });

  // Fetch referral stats
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery<ReferralStats>({
    queryKey: ['/api/referrals/stats'],
    retry: false,
  });

  const isLoading = userLoading || statsLoading;

  // Generate referral link
  const botUsername = import.meta.env.VITE_BOT_USERNAME || 'Paid_Adzbot';
  const referralLink = user?.referralCode 
    ? `https://t.me/${botUsername}?start=${user.referralCode}`
    : '';

  // Copy referral link to clipboard
  const copyReferralLink = () => {
    if (referralLink) {
      navigator.clipboard.writeText(referralLink);
      showNotification('🔗 Link Copied!', 'success');
    }
  };

  // Share referral link via Telegram with simplified message
  const shareViaWebApp = () => {
    if (referralLink && window.Telegram?.WebApp?.openTelegramLink) {
      const shareText = `🚀 Join me on Paid Ads and start earning TON instantly!

💸 Watch ads, complete simple tasks, and get rewarded every day.`;
      
      window.Telegram.WebApp.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent(shareText)}`);
    } else {
      copyReferralLink();
    }
  };

  // Format TON amounts
  const formatTON = (value: string | number): string => {
    let num = parseFloat(String(value)).toFixed(5);
    num = num.replace(/\.?0+$/, '');
    return num;
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
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

  return (
    <Layout>
      <main className="max-w-md mx-auto px-4 pb-20 pt-6">

        {/* How It Works - Moved to top */}
        <Card className="mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">💡 How It Works</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2.5 text-sm">
              <div className="flex items-start gap-2.5">
                <div className="bg-primary/10 rounded-full p-1.5 mt-0.5">
                  <i className="fas fa-gift text-primary text-xs"></i>
                </div>
                <div>
                  <p className="font-medium text-foreground text-sm">Instant Bonus</p>
                  <p className="text-muted-foreground text-xs">
                    Get <span className="text-primary font-semibold">0.002 TON</span> instantly when your friend joins
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <div className="bg-primary/10 rounded-full p-1.5 mt-0.5">
                  <i className="fas fa-percent text-primary text-xs"></i>
                </div>
                <div>
                  <p className="font-medium text-foreground text-sm">Lifetime Commission</p>
                  <p className="text-muted-foreground text-xs">
                    Earn <span className="text-primary font-semibold">10% commission</span> on every ad your friends watch
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Referral Link - Right below "How It Works" */}
        <div className="mb-4 space-y-2">
          <label className="text-sm font-medium text-foreground">🔗 Your Invite Link</label>
          <div className="bg-muted p-2.5 rounded-lg break-all text-xs font-mono">
            {referralLink || 'Loading...'}
          </div>
          <div className="flex gap-2">
            <Button 
              onClick={copyReferralLink} 
              variant="outline" 
              className="flex-1 h-9 text-sm bg-blue-500 hover:bg-blue-600 text-white border-blue-500"
              disabled={!referralLink}
            >
              <i className="fas fa-copy mr-1.5 text-xs"></i>
              Copy Link
            </Button>
            <Button 
              onClick={shareViaWebApp} 
              className="flex-1 h-9 text-sm bg-green-500 hover:bg-green-600 text-white"
              disabled={!referralLink}
            >
              <i className="fas fa-share mr-1.5 text-xs"></i>
              Share Link
            </Button>
          </div>
        </div>

        {/* Referral Income - Compact version below link */}
        <Card className="border-primary/20">
          <CardContent className="p-4">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Total Referrals</span>
                <span className="text-xl font-bold text-primary">
                  {stats?.referralCount || 0}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Total Earned</span>
                <span className="text-xl font-bold text-primary">
                  {formatTON(stats?.referralEarnings || '0')} TON
                </span>
              </div>
              <Button 
                onClick={() => refetchStats()} 
                variant="outline" 
                size="sm"
                className="w-full h-8 text-xs"
              >
                <i className="fas fa-sync-alt mr-1.5 text-xs"></i>
                Refresh Stats
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </Layout>
  );
}
