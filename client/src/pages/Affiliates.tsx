import { useAuth } from "@/hooks/useAuth";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface AffiliateStats {
  totalFriendsReferred: number;
  successfulReferrals: number;
  totalReferralEarnings: string;
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
  const response = await apiRequest('GET', '/api/affiliates/stats');
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

          {/* Stats Overview */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <Card className="shadow-sm border border-border">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-foreground">
                  {stats?.totalFriendsReferred || 0}
                </div>
                <div className="text-muted-foreground text-sm">Friends</div>
              </CardContent>
            </Card>
            <Card className="shadow-sm border border-border">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-foreground">
                  ${stats?.totalReferralEarnings || '0.00'}
                </div>
                <div className="text-muted-foreground text-sm">Earned</div>
              </CardContent>
            </Card>
          </div>

          {/* Referral Link */}
          <Card className="shadow-sm border border-border">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">Your Referral Link</h3>
              <div className="bg-muted/50 p-3 rounded text-sm font-mono break-all mb-4">
                {(user as any)?.referralLink || stats?.referralLink || 'Loading...'}
              </div>
              <Button 
                onClick={handleCopyReferralLink}
                className="w-full"
                disabled={!(user as any)?.referralLink && !stats?.referralLink}
              >
                <i className="fas fa-copy mr-2"></i>
                Copy Link
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </Layout>
  );
}