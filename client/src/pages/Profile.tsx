import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import Layout from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export default function Profile() {
  const { user, isLoading } = useAuth();
  const { isAdmin } = useAdmin();
  const { toast } = useToast();

  const handleCopyReferralLink = () => {
    const referralLink = (user as any)?.referralLink;
    if (referralLink) {
      navigator.clipboard.writeText(referralLink);
      toast({
        title: "Copied!",
        description: "Referral link copied to clipboard",
      });
    }
  };

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
        <div className="py-6">
          <h1 className="text-2xl font-bold text-foreground mb-6 text-center">
            Profile
          </h1>

          {/* User Info */}
          <Card className="shadow-sm border border-border mb-6">
            <CardContent className="p-6 text-center">
              <div className="bg-primary/10 p-4 rounded-full inline-block mb-4">
                {(user as any)?.profileImageUrl ? (
                  <img 
                    src={(user as any).profileImageUrl} 
                    alt="Profile" 
                    className="w-12 h-12 rounded-full object-cover"
                    data-testid="img-profile-avatar"
                  />
                ) : (
                  <i className="fas fa-user text-primary text-2xl"></i>
                )}
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-1" data-testid="text-user-name">
                {(user as any)?.firstName || (user as any)?.lastName ? `${(user as any).firstName || ''} ${(user as any).lastName || ''}`.trim() : 'User'}
              </h3>
              <p className="text-muted-foreground text-sm" data-testid="text-user-email">
                Telegram ID: {(user as any)?.id || 'Unknown'}
              </p>
              {isAdmin && (
                <div className="mt-4">
                  <Link href="/admin">
                    <Button 
                      size="default"
                      className="bg-orange-600 hover:bg-orange-700 border-orange-600 text-white"
                      data-testid="button-admin-dashboard"
                    >
                      <i className="fas fa-crown mr-2"></i>
                      Admin Panel
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Balance */}
          <Card className="shadow-sm border border-border mb-6">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">Account Balance</h3>
              
              <div className="text-center">
                <div className="text-3xl font-bold text-primary mb-2" data-testid="text-user-balance">
                  ${(user as any) ? Math.max(0, parseFloat((user as any).balance || "0")).toFixed(5) : "0.00000"}
                </div>
                <div className="text-muted-foreground text-sm">Available Balance</div>
              </div>
            </CardContent>
          </Card>

          {/* Affiliates Section */}
          <Card className="shadow-sm border border-border mb-6">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">Affiliates</h3>
              
              {(user as any)?.referralLink ? (
                <div className="space-y-3">
                  <div className="p-3 bg-muted rounded-lg break-all text-sm font-mono">
                    {(user as any).referralLink}
                  </div>
                  <Button 
                    onClick={handleCopyReferralLink}
                    className="w-full bg-primary hover:bg-primary/90"
                  >
                    <i className="fas fa-copy mr-2"></i>
                    Copy Referral Link
                  </Button>
                </div>
              ) : (
                <div className="text-center py-4">
                  <div className="text-muted-foreground">Referral link not available</div>
                </div>
              )}
            </CardContent>
          </Card>


        </div>
      </main>
    </Layout>
  );
}
