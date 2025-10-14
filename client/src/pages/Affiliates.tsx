import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { showNotification } from '@/components/AppNotification';
import Layout from '@/components/Layout';
import { useAuth } from '@/hooks/useAuth';
import { Copy, UserPlus } from 'lucide-react';

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
}

interface Referral {
  id: string;
  referredUserId: string;
  referredUser?: {
    firstName?: string;
    username?: string;
    totalEarned?: string;
  };
}

export default function Affiliates() {
  const { user: authUser } = useAuth();
  
  const { data: user, isLoading: userLoading } = useQuery<User>({
    queryKey: ['/api/auth/user'],
    retry: false,
  });

  const { data: stats, isLoading: statsLoading } = useQuery<ReferralStats>({
    queryKey: ['/api/referrals/stats'],
    retry: false,
  });

  const { data: referrals = [], isLoading: referralsLoading } = useQuery<Referral[]>({
    queryKey: ['/api/referrals/list'],
    retry: false,
  });

  const isLoading = userLoading || statsLoading;

  const botUsername = import.meta.env.VITE_BOT_USERNAME || 'Paid_Adzbot';
  const referralLink = user?.referralCode 
    ? `https://t.me/${botUsername}?start=${user.referralCode}`
    : '';

  const copyReferralLink = () => {
    if (referralLink) {
      navigator.clipboard.writeText(referralLink);
      showNotification('Copied!', 'success');
    }
  };

  const inviteFriend = () => {
    if (referralLink && window.Telegram?.WebApp?.switchInlineQuery) {
      const shareText = `Earn PAD in Telegram!\n${referralLink}`;
      window.Telegram.WebApp.switchInlineQuery(shareText, ['users']);
    } else if (window.Telegram?.WebApp?.openTelegramLink) {
      const shareText = `Earn PAD in Telegram!`;
      window.Telegram.WebApp.openTelegramLink(
        `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent(shareText)}&disable_web_page_preview=true`
      );
    } else {
      copyReferralLink();
    }
  };

  const totalEarned = Math.round(parseFloat(stats?.level1Earnings || '0') * 100000);

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
      <main className="max-w-md mx-auto px-4 pb-24 pt-6">
        <div className="text-center mb-4">
          <h1 className="text-2xl font-bold text-foreground mb-2">Invite Friends!</h1>
          <p className="text-sm text-muted-foreground">You earn 10% from referrals</p>
        </div>

        <Card className="mb-4 neon-glow-border">
          <CardContent className="pt-4 pb-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-muted-foreground mb-1">Total Referrals</div>
                <div className="text-2xl font-bold text-foreground">{stats?.referralCount || 0}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Referral Income</div>
                <div className="text-2xl font-bold text-foreground">{totalEarned.toLocaleString()} PAD</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-4 neon-glow-border">
          <CardContent className="pt-4 pb-4">
            <div className="flex gap-3 justify-center">
              <Button
                variant="ghost"
                size="icon"
                className="w-12 h-12 border border-primary/30 hover:bg-primary/10"
                onClick={inviteFriend}
                disabled={!referralLink}
              >
                <UserPlus className="w-5 h-5" />
              </Button>
              
              <Button
                variant="ghost"
                size="icon"
                className="w-12 h-12 border border-primary/30 hover:bg-primary/10"
                onClick={copyReferralLink}
                disabled={!referralLink}
              >
                <Copy className="w-5 h-5" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {referrals && referrals.length > 0 && (
          <Card className="neon-glow-border">
            <CardContent className="pt-4 pb-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">Friends List</h3>
              <div className="space-y-2">
                {referrals.map((referral) => {
                  const friendName = referral.referredUser?.firstName || 
                                    referral.referredUser?.username || 
                                    'User';
                  const padEarned = Math.round(parseFloat(referral.referredUser?.totalEarned || '0') * 100000 * 0.1);
                  
                  return (
                    <div key={referral.id} className="flex justify-between items-center py-2 border-b border-border last:border-0">
                      <span className="text-foreground">{friendName}</span>
                      <span className="text-muted-foreground text-sm">PAD earned: {padEarned.toLocaleString()}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </Layout>
  );
}
