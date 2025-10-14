import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { showNotification } from '@/components/AppNotification';
import Layout from '@/components/Layout';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest } from '@/lib/queryClient';

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

interface ReferralSearchResult {
  id: string;
  earnedToday: string;
  allTime: string;
  invited: number;
  joinedAt: string;
}

export default function Affiliates() {
  const { user: authUser } = useAuth();
  const [searchCode, setSearchCode] = useState('');
  const [searchResult, setSearchResult] = useState<ReferralSearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  
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
      showNotification('🔗 Link copied to clipboard!', 'success');
    }
  };

  // Share referral link via Telegram
  const shareViaWebApp = () => {
    if (referralLink && window.Telegram?.WebApp?.openTelegramLink) {
      const shareText = `Earn PAD in Telegram!`;
      window.Telegram.WebApp.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent(shareText)}`);
    } else {
      copyReferralLink();
    }
  };

  // Search for referral by code
  const handleSearch = async () => {
    if (!searchCode.trim()) {
      setSearchError('Please enter a User ID');
      return;
    }

    setIsSearching(true);
    setSearchError('');
    setSearchResult(null);

    try {
      const response = await apiRequest('GET', `/api/referrals/search/${searchCode.trim()}`);
      const data = await response.json();
      setSearchResult(data);
    } catch (error: any) {
      if (error.message?.includes('403')) {
        setSearchError('This referral does not belong to you');
      } else if (error.message?.includes('404')) {
        setSearchError('Referral not found');
      } else {
        setSearchError('Failed to search referral');
      }
    } finally {
      setIsSearching(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    }) + ', in ' + date.toLocaleTimeString('en-GB', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
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
      <main className="max-w-md mx-auto px-4 pb-24 pt-6">
        {/* Affiliate Program Description with Stats */}
        <Card className="mb-4 neon-glow-border shadow-lg">
          <CardContent className="pt-6 pb-4">
            <h3 className="text-base font-semibold mb-2">Affiliate Program</h3>
            <p className="text-sm text-muted-foreground mb-4">
              We pay out up to 20% from 1st-level referrals and up to 4% from 2nd-level referrals.
            </p>
            
            <div className="grid grid-cols-2 gap-4 pt-3 border-t border-border">
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-1">Total Referrals</p>
                <p className="text-xl font-bold text-primary">{stats?.referralCount || 0}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-1">Total Earned</p>
                <p className="text-xl font-bold text-primary">
                  {Math.round(parseFloat(stats?.level1Earnings || '0') * 100000 + parseFloat(stats?.level2Earnings || '0') * 100000)} PAD
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Referral Link Actions */}
        <Card className="neon-glow-border shadow-lg">
          <CardContent className="pt-6">
            <div className="space-y-3">
              <Button 
                onClick={copyReferralLink} 
                variant="outline" 
                className="w-full bg-blue-500 hover:bg-blue-600 text-white border-blue-500"
                disabled={!referralLink}
              >
                <i className="fas fa-copy mr-2"></i>
                Copy the link
              </Button>
              
              <Button 
                onClick={shareViaWebApp} 
                className="w-full bg-green-500 hover:bg-green-600 text-white"
                disabled={!referralLink}
              >
                <i className="fas fa-paper-plane mr-2"></i>
                Send the link as a message
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </Layout>
  );
}
