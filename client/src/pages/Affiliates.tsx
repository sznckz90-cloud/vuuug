import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { showNotification } from '@/components/AppNotification';
import Layout from '@/components/Layout';
import { useAuth } from '@/hooks/useAuth';
import { Copy, Share2, Users, Coins } from 'lucide-react';

interface User {
  id: string;
  username?: string;
  firstName?: string;
  referralCode?: string;
  [key: string]: any;
}

interface ReferralStats {
  totalInvites: number;
  totalClaimed: string;
  availableBonus: string;
  readyToClaim: string;
}

export default function Affiliates() {
  const { user: authUser } = useAuth();
  const queryClient = useQueryClient();
  
  const { data: user, isLoading: userLoading } = useQuery<User>({
    queryKey: ['/api/auth/user'],
    retry: false,
  });

  const { data: stats, isLoading: statsLoading } = useQuery<ReferralStats>({
    queryKey: ['/api/referrals/stats'],
    retry: false,
  });

  const claimMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/referrals/claim', {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to claim bonus');
      return data;
    },
    onSuccess: (data) => {
      showNotification(data.message || 'Bonus claimed successfully!', 'success');
      queryClient.invalidateQueries({ queryKey: ['/api/referrals/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
    },
    onError: (error: any) => {
      showNotification(error.message || 'Failed to claim bonus', 'error');
    },
  });

  const isLoading = userLoading || statsLoading;

  const botUsername = import.meta.env.VITE_BOT_USERNAME || 'Paid_Adzbot';
  const referralLink = user?.referralCode 
    ? `https://t.me/${botUsername}?start=${user.referralCode}`
    : '';

  const copyReferralLink = () => {
    if (referralLink) {
      navigator.clipboard.writeText(referralLink);
      showNotification('Link copied!', 'success');
    }
  };

  const shareReferralLink = () => {
    if (referralLink && window.Telegram?.WebApp?.switchInlineQuery) {
      const shareText = `Earn PAD in Telegram!\n${referralLink}`;
      window.Telegram.WebApp.switchInlineQuery(shareText, ['users']);
    } else if (window.Telegram?.WebApp?.openTelegramLink) {
      const shareText = `Earn PAD in Telegram!`;
      window.Telegram.WebApp.openTelegramLink(
        `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent(shareText)}`
      );
    } else {
      copyReferralLink();
    }
  };

  const handleClaim = () => {
    claimMutation.mutate();
  };

  const totalClaimedPAD = Math.round(parseFloat(stats?.totalClaimed || '0') * 100000);
  const availableBonusPAD = Math.round(parseFloat(stats?.availableBonus || '0') * 100000);
  const readyToClaimPAD = Math.round(parseFloat(stats?.readyToClaim || '0') * 100000);
  const hasBonus = availableBonusPAD > 0;

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
        <Card className="mb-4 bg-black border border-blue-500/40">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Users className="w-8 h-8 text-white" />
              <h1 className="text-2xl font-bold text-white">Affiliates program</h1>
            </div>
            
            <p className="text-sm text-center text-white leading-relaxed mb-4">
              Invite friends and get <span className="font-bold">10%</span> of every ads completed by your referrals automatically added to your balance
            </p>
            
            <div className="flex items-center gap-2 mb-3">
              <Share2 className="w-4 h-4 text-blue-400" />
              <h3 className="text-sm font-semibold text-blue-400">Friend Invite Link</h3>
            </div>
            
            <div className="bg-muted/50 rounded-lg p-3 mb-3 overflow-x-auto text-sm text-foreground whitespace-nowrap">
              {referralLink}
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <Button
                className="w-full bg-blue-500 hover:bg-blue-600 text-white"
                onClick={copyReferralLink}
                disabled={!referralLink}
              >
                <Copy className="w-4 h-4 mr-2" />
                Copy
              </Button>
              
              <Button
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                onClick={shareReferralLink}
                disabled={!referralLink}
              >
                <Share2 className="w-4 h-4 mr-2" />
                Share
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <Card className="bg-card border border-border">
            <CardContent className="pt-4 pb-4">
              <div className="text-xs text-muted-foreground mb-1">Total Claim</div>
              <div className="text-xl font-bold text-foreground flex items-center gap-1">
                {totalClaimedPAD.toLocaleString()} 
                <span className="text-sm bg-black px-2 py-0.5 rounded text-white">PAD</span>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-card border border-border">
            <CardContent className="pt-4 pb-4">
              <div className="text-xs text-muted-foreground mb-1">Total Invites</div>
              <div className="text-xl font-bold text-foreground">{stats?.totalInvites || 0}</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <Card className="bg-card border border-border">
            <CardContent className="pt-4 pb-4">
              <div className="text-xs text-muted-foreground mb-1">Available Bonus</div>
              <div className="text-xl font-bold text-foreground flex items-center gap-1">
                {availableBonusPAD.toLocaleString()}
                <span className="text-sm bg-black px-2 py-0.5 rounded text-white">PAD</span>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-card border border-border">
            <CardContent className="pt-4 pb-4">
              <div className="text-xs text-muted-foreground mb-1">Ready to Claim</div>
              <div className="text-xl font-bold text-foreground flex items-center gap-1">
                {readyToClaimPAD.toLocaleString()}
                <span className="text-sm bg-black px-2 py-0.5 rounded text-white">PAD</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-card border border-border">
          <CardContent className="pt-3 pb-3">
            <Button
              className={`w-full h-12 text-base font-bold ${
                hasBonus 
                  ? 'bg-blue-500 hover:bg-blue-600 text-white' 
                  : 'bg-muted/50 text-muted-foreground cursor-not-allowed'
              }`}
              onClick={handleClaim}
              disabled={!hasBonus || claimMutation.isPending}
            >
              <Coins className="w-4 h-4 mr-2" />
              {claimMutation.isPending ? 'Claiming...' : 'Claim PAD'}
            </Button>
            
            {!hasBonus && (
              <p className="text-xs text-center text-muted-foreground mt-2">
                No referral bonus available.
              </p>
            )}
          </CardContent>
        </Card>
      </main>
    </Layout>
  );
}
