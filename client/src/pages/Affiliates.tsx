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
  level1Earnings: string;
  level2Earnings: string;
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
      const shareText = `🚀 Join me on Paid Ads and start earning PAD!

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

        {/* Affiliate Program */}
        <Card className="mb-4 neon-glow-border shadow-lg">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Affiliate Program</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-sm text-muted-foreground mb-4">
              We pay out up to 20% from the income of referrals of the 1st level and up to 4% from the income of referrals of the 2nd level.
            </p>
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
        <Card className="border-primary/20 neon-glow-border shadow-lg">
          <CardContent className="p-4">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Total Referrals</span>
                <span className="text-xl font-bold text-primary">
                  {stats?.referralCount || 0}
                </span>
              </div>
              <div className="border-t border-border pt-3 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">👥 Level 1 Income</span>
                  <span className="text-base font-semibold text-primary">
                    {Math.round(parseFloat(stats?.level1Earnings || '0') * 100000)} PAD
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">👥 Level 2 Income</span>
                  <span className="text-base font-semibold text-primary">
                    {Math.round(parseFloat(stats?.level2Earnings || '0') * 100000)} PAD
                  </span>
                </div>
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
