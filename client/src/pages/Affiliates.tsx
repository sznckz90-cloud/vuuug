import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { showNotification } from '@/components/AppNotification';
import Layout from '@/components/Layout';
import { Share2, Users, Coins, Copy } from 'lucide-react';

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

interface AppSettings {
  affiliateCommission?: number;
  referralRewardEnabled?: boolean;
  referralRewardUSD?: number;
  referralRewardPAD?: number;
}

export default function Affiliates() {
  const queryClient = useQueryClient();
  
  const { data: user, isLoading: userLoading } = useQuery<User>({
    queryKey: ['/api/auth/user'],
    retry: false,
    staleTime: 60000,
    gcTime: 300000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const { data: stats, isLoading: statsLoading } = useQuery<ReferralStats>({
    queryKey: ['/api/referrals/stats'],
    retry: false,
    staleTime: 60000,
    gcTime: 300000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const { data: appSettings } = useQuery<AppSettings>({
    queryKey: ['/api/app-settings'],
    retry: false,
    staleTime: 120000,
    gcTime: 600000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
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
    if (!referralLink) return;
    
    const shareTitle = `💸 Start earning money just by completing tasks & watching ads!`;
    const buttonText = `🚀 Start earning`;
    
    const tgWebApp = window.Telegram?.WebApp as any;
    
    if (tgWebApp?.switchInlineQuery) {
      tgWebApp.switchInlineQuery(shareTitle, ['users']);
    } else {
      const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent(shareTitle)}`;
      
      if (tgWebApp?.openTelegramLink) {
        tgWebApp.openTelegramLink(shareUrl);
      } else if (navigator.share) {
        navigator.share({
          title: buttonText,
          text: shareTitle,
          url: referralLink,
        }).catch(() => {
          copyReferralLink();
        });
      } else {
        window.open(shareUrl, '_blank');
      }
    }
  };

  const handleClaim = () => {
    claimMutation.mutate();
  };

  const totalClaimedPAD = Math.round(parseFloat(stats?.totalClaimed || '0'));
  const availableBonusPAD = Math.round(parseFloat(stats?.availableBonus || '0'));
  const hasBonus = availableBonusPAD > 0;

  if (isLoading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="flex gap-1 justify-center mb-4">
              <div className="w-2 h-2 rounded-full bg-[#4cd3ff] animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-2 h-2 rounded-full bg-[#4cd3ff] animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-2 h-2 rounded-full bg-[#4cd3ff] animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
            <div className="text-foreground font-medium">Loading...</div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <main className="max-w-md mx-auto px-4 pt-3">
        <Card className="mb-4 minimal-card">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Users className="w-7 h-7 text-[#007BFF]" />
              <h1 className="text-2xl font-bold text-white">Affiliates program</h1>
            </div>
            
            <p className="text-sm text-center text-white leading-relaxed mb-4">
              Invite friends and get <span className="font-bold">{appSettings?.affiliateCommission || 10}%</span> of every ads completed by your referrals automatically added to your balance
            </p>
            
            {appSettings?.referralRewardEnabled && (
              <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                <p className="text-xs text-green-400 font-medium text-center">
                  Bonus: Earn <span className="font-bold">{appSettings.referralRewardPAD || 50} PAD</span> + <span className="font-bold">${appSettings.referralRewardUSD || 0.0005} USD</span> when your friend watches their first ad!
                </p>
              </div>
            )}
            
            <div className="flex items-center gap-2 mb-3">
              <Share2 className="w-4 h-4 text-blue-400" />
              <h3 className="text-sm font-semibold text-blue-400">Friend Invite Link</h3>
            </div>
            
            <div className="bg-muted/50 rounded-lg p-3 mb-3 overflow-x-auto text-sm text-foreground whitespace-nowrap">
              {referralLink}
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <Button
                className="h-12 btn-primary"
                onClick={copyReferralLink}
                disabled={!referralLink}
              >
                <Copy className="w-4 h-4 mr-2" />
                Copy
              </Button>
              
              <Button
                className="h-12 btn-primary"
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
          <Card className="minimal-card">
            <CardContent className="pt-4 pb-4">
              <div className="text-xs text-muted-foreground mb-1">Total Claim</div>
              <div className="text-xl font-bold text-[#e5e5e5] flex items-center gap-1">
                {totalClaimedPAD.toLocaleString()} 
                <span className="text-sm text-gray-400 font-semibold">PAD</span>
              </div>
            </CardContent>
          </Card>
          
          <Card className="minimal-card">
            <CardContent className="pt-4 pb-4">
              <div className="text-xs text-muted-foreground mb-1">Total Invites</div>
              <div className="text-xl font-bold text-[#e5e5e5]">{stats?.totalInvites || 0}</div>
            </CardContent>
          </Card>
        </div>

        <Card className="minimal-card mb-2">
          <CardContent className="pt-3 pb-3">
            <Button
              className={`w-full h-12 text-base ${
                hasBonus 
                  ? 'btn-primary' 
                  : 'btn-secondary cursor-not-allowed'
              }`}
              onClick={handleClaim}
              disabled={!hasBonus || claimMutation.isPending}
            >
              <Coins className="w-4 h-4 mr-2" />
              {claimMutation.isPending ? 'Claiming...' : hasBonus ? 'Claim PAD' : 'No referral bonus available'}
            </Button>
            
            {!hasBonus && (
              <p className="text-xs text-center text-muted-foreground mt-2">
                Invite friends to earn referral bonuses
              </p>
            )}
          </CardContent>
        </Card>
      </main>
    </Layout>
  );
}
