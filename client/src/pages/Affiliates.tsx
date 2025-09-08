import { useAuth } from "@/hooks/useAuth";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";

interface AffiliateStats {
  totalFriendsReferred: number;
  totalCommissionEarned: string;
  totalReferralBonus: string;
  referralLink: string;
  referrals: Array<{
    refereeId: string;
    refereeName: string;
    reward: string;
    status: string;
    createdAt: string;
  }>;
}

async function fetchAffiliateStats(): Promise<AffiliateStats> {
  const response = await fetch('/api/affiliates/stats', {
    credentials: 'include',
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch affiliate stats');
  }
  
  return response.json();
}

export default function Affiliates() {
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  
  const { data: stats, isLoading: isStatsLoading } = useQuery({
    queryKey: ['affiliateStats'],
    queryFn: fetchAffiliateStats,
    enabled: !!user,
  });

  const handleCopyReferralLink = () => {
    const referralLink = (user as any)?.referralLink || stats?.referralLink;
    if (referralLink) {
      navigator.clipboard.writeText(referralLink);
      toast({
        title: "Copied!",
        description: "Referral link copied to clipboard",
      });
    }
  };

  if (isLoading || isStatsLoading) {
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
        <div className="py-6">
          <h1 className="text-2xl font-bold text-foreground mb-6 text-center">
            Affiliates
          </h1>

          {/* Referral Link Card */}
          <Card className="shadow-sm border border-border mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <i className="fas fa-link text-primary"></i>
                Your Referral Link
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground text-sm">
                Invite friends using your referral link and earn 10% of their earnings automatically!
              </p>
              
              <div className="bg-muted/50 p-3 rounded-lg border text-sm font-mono break-all">
                {(user as any)?.referralLink || stats?.referralLink || 'Loading...'}
              </div>
              
              <Button 
                onClick={handleCopyReferralLink}
                className="w-full bg-primary hover:bg-primary/90"
                disabled={!(user as any)?.referralLink && !stats?.referralLink}
              >
                <i className="fas fa-copy mr-2"></i>
                Copy Referral Link
              </Button>
            </CardContent>
          </Card>

          {/* Stats Cards */}
          <div className="grid gap-4 mb-6">
            {/* Friends Referred */}
            <Card className="shadow-sm border border-border">
              <CardContent className="p-6 text-center">
                <div className="bg-blue-500/10 p-4 rounded-full inline-block mb-4">
                  <i className="fas fa-users text-blue-500 text-2xl"></i>
                </div>
                <div className="text-3xl font-bold text-foreground mb-2">
                  {stats?.totalFriendsReferred || 0}
                </div>
                <div className="text-muted-foreground text-sm">
                  Friends Referred
                </div>
              </CardContent>
            </Card>

            {/* Total Commission Earned */}
            <Card className="shadow-sm border border-border">
              <CardContent className="p-6 text-center">
                <div className="bg-green-500/10 p-4 rounded-full inline-block mb-4">
                  <i className="fas fa-dollar-sign text-green-500 text-2xl"></i>
                </div>
                <div className="text-3xl font-bold text-foreground mb-2">
                  ${stats?.totalCommissionEarned || '0.00000'}
                </div>
                <div className="text-muted-foreground text-sm">
                  Commission Earned (in Withdrawal Balance)
                </div>
              </CardContent>
            </Card>

            {/* Total Referral Bonus */}
            <Card className="shadow-sm border border-border">
              <CardContent className="p-6 text-center">
                <div className="bg-blue-500/10 p-4 rounded-full inline-block mb-4">
                  <i className="fas fa-gift text-blue-500 text-2xl"></i>
                </div>
                <div className="text-3xl font-bold text-foreground mb-2">
                  ${stats?.totalReferralBonus || '0.00000'}
                </div>
                <div className="text-muted-foreground text-sm">
                  Referral Bonuses (in Total Earned)
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Referred Friends List */}
          {stats?.referrals && stats.referrals.length > 0 && (
            <Card className="shadow-sm border border-border mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <i className="fas fa-users text-primary"></i>
                  Your Referrals
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {stats.referrals.map((referral, index) => (
                  <div key={referral.refereeId} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                    <div>
                      <p className="font-medium text-foreground">{referral.refereeName}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(referral.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-green-600">${referral.reward}</p>
                      <p className="text-xs text-muted-foreground capitalize">{referral.status}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* How it Works */}
          <Card className="shadow-sm border border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <i className="fas fa-info-circle text-primary"></i>
                How it Works
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="bg-primary/10 rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-primary font-bold text-sm">1</span>
                </div>
                <div>
                  <p className="font-medium text-foreground mb-1">Share Your Link</p>
                  <p className="text-muted-foreground text-sm">
                    Copy and share your referral link with friends
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="bg-primary/10 rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-primary font-bold text-sm">2</span>
                </div>
                <div>
                  <p className="font-medium text-foreground mb-1">Friends Watch 10 Ads & Get Bonus</p>
                  <p className="text-muted-foreground text-sm">
                    You get $0.01 referral bonus when your friend watches at least 10 ads (anti-fraud protection)
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="bg-primary/10 rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-primary font-bold text-sm">3</span>
                </div>
                <div>
                  <p className="font-medium text-foreground mb-1">Earn Commission</p>
                  <p className="text-muted-foreground text-sm">
                    You earn 10% of your friends' ad earnings ($0.000022 per ad they watch)
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </Layout>
  );
}