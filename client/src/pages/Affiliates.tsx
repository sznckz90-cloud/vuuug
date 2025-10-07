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
  const botUsername = import.meta.env.VITE_BOT_USERNAME || 'LightningSatsbot';
  const referralLink = user?.referralCode 
    ? `https://t.me/${botUsername}?start=${user.referralCode}`
    : '';

  // Copy referral link to clipboard
  const copyReferralLink = () => {
    if (referralLink) {
      navigator.clipboard.writeText(referralLink);
      showNotification({
        type: 'success',
        title: 'Link Copied!',
        message: 'Referral link copied to clipboard'
      });
    }
  };

  // Share referral link via Telegram
  const shareViaWebApp = () => {
    if (referralLink && window.Telegram?.WebApp) {
      const shareText = `🚀 Join me on Lightning Sats and start earning TON!\n\n💰 Watch ads, complete tasks, and get paid!\n\n👉 ${referralLink}`;
      
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
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground mb-2">👥 Affiliates</h1>
          <p className="text-muted-foreground text-sm">
            Invite friends and earn rewards
          </p>
        </div>

        {/* Earnings Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">💰 Referral Income</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Total Referrals</span>
                <span className="text-2xl font-bold text-primary">
                  {stats?.referralCount || 0}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Total Earned</span>
                <span className="text-2xl font-bold text-primary">
                  {formatTON(stats?.referralEarnings || '0')} TON
                </span>
              </div>
              <Button 
                onClick={() => refetchStats()} 
                variant="outline" 
                className="w-full"
              >
                <i className="fas fa-sync-alt mr-2"></i>
                Refresh Stats
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* How It Works */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">💡 How It Works</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <div className="bg-primary/10 rounded-full p-2 mt-1">
                  <i className="fas fa-gift text-primary text-sm"></i>
                </div>
                <div>
                  <p className="font-medium text-foreground">Instant Bonus</p>
                  <p className="text-muted-foreground">
                    Get <span className="text-primary font-semibold">0.002 TON</span> when your friend watches their first ad
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="bg-primary/10 rounded-full p-2 mt-1">
                  <i className="fas fa-percent text-primary text-sm"></i>
                </div>
                <div>
                  <p className="font-medium text-foreground">Lifetime Commission</p>
                  <p className="text-muted-foreground">
                    Earn <span className="text-primary font-semibold">10% commission</span> on every ad your friends watch
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Referral Link Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">🔗 Your Referral Link</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="bg-muted p-3 rounded-lg break-all text-sm font-mono">
                {referralLink || 'Loading...'}
              </div>
              <div className="flex gap-2">
                <Button 
                  onClick={copyReferralLink} 
                  variant="outline" 
                  className="flex-1"
                  disabled={!referralLink}
                >
                  <i className="fas fa-copy mr-2"></i>
                  Copy Link
                </Button>
                <Button 
                  onClick={shareViaWebApp} 
                  className="flex-1"
                  disabled={!referralLink}
                >
                  <i className="fas fa-share mr-2"></i>
                  Share
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Important Notice */}
        <Card className="border-yellow-500/20 bg-yellow-500/5">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <i className="fas fa-exclamation-triangle text-yellow-500 mt-1"></i>
              <div className="text-sm text-muted-foreground">
                <p className="font-medium text-foreground mb-1">Important Reminder</p>
                <p>
                  Invite real people only. Avoid fake or duplicate accounts to prevent penalties or bans.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </Layout>
  );
}
