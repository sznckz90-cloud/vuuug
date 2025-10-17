import { useAuth } from "@/hooks/useAuth";
import Layout from "@/components/Layout";
import AdWatchingSection from "@/components/AdWatchingSection";
import StreakCard from "@/components/StreakCard";
import PromoCodeDialog from "@/components/PromoCodeDialog";
import WithdrawDialog from "@/components/WithdrawDialog";
import HistoryDialog from "@/components/HistoryDialog";
import WalletSection from "@/components/WalletSection";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import React from "react";
import { useAdmin } from "@/hooks/useAdmin";
import { useLocation } from "wouter";
import { Gift, Zap, History, Ticket } from "lucide-react";
import { tonToPAD, padToUSD } from "@shared/constants";

interface User {
  id?: string;
  telegramId?: string;
  balance?: string;
  tonBalance?: string;
  lastStreakDate?: string;
  username?: string;
  firstName?: string;
  [key: string]: any;
}

export default function Home() {
  const { user, isLoading } = useAuth();
  const { isAdmin } = useAdmin();
  const [, setLocation] = useLocation();
  const [streakDialogOpen, setStreakDialogOpen] = React.useState(false);
  const [promoDialogOpen, setPromoDialogOpen] = React.useState(false);
  const [withdrawDialogOpen, setWithdrawDialogOpen] = React.useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = React.useState(false);

  const { data: stats, isLoading: statsLoading } = useQuery<{
    todayEarnings?: string;
    referralEarnings?: string;
  }>({
    queryKey: ["/api/user/stats"],
    retry: false,
  });

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

  const balancePAD = tonToPAD((user as User)?.balance || "0");
  const tonBalance = parseFloat((user as User)?.tonBalance || "0");
  const todayEarnings = tonToPAD(stats?.todayEarnings || "0");
  const allTimeEarnings = balancePAD;
  const referralEarnings = tonToPAD(stats?.referralEarnings || "0");
  
  const referralCode = (user as User)?.referralCode || "000000";
  const formattedUserId = referralCode.slice(-6).toUpperCase();

  return (
    <Layout>
      <main className="max-w-md mx-auto px-4 pb-24 pt-4">
        {/* Wallet Section - New Design */}
        <WalletSection
          padBalance={balancePAD}
          tonBalance={tonBalance}
          uid={formattedUserId}
          isAdmin={isAdmin}
          onAdminClick={() => setLocation("/admin")}
          onWithdraw={() => setWithdrawDialogOpen(true)}
        />

        {/* History Button */}
        <Button 
          variant="outline" 
          className="w-full h-12 mb-4 border-primary/30 hover:bg-primary/10"
          onClick={() => setHistoryDialogOpen(true)}
        >
          <History className="w-5 h-5 mr-2" />
          Withdrawal History
        </Button>

        {/* Income Statistics */}
        <Card className="mb-4 neon-glow-border">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Income statistics</h3>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <div className="text-xs text-muted-foreground mb-1">Today</div>
                <div className="text-foreground font-semibold">{todayEarnings.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">All time</div>
                <div className="text-foreground font-semibold">{allTimeEarnings.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">On referrals</div>
                <div className="text-foreground font-semibold">{referralEarnings.toLocaleString()}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Viewing Ads Section */}
        <AdWatchingSection user={user as User} />

        {/* Action Buttons - 4 buttons in 2x2 grid */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            className="w-full h-12 border-primary/30 hover:bg-primary/10"
            onClick={() => setStreakDialogOpen(true)}
          >
            <Gift className="w-5 h-5 mr-2" />
            Claim
          </Button>
          
          <Button
            variant="outline"
            className="w-full h-12 border-primary/30 hover:bg-primary/10"
            onClick={() => setLocation("/affiliates")}
          >
            <Zap className="w-5 h-5 mr-2" />
            Boost
          </Button>

          <Button
            variant="outline"
            className="w-full h-12 border-primary/30 hover:bg-primary/10"
            onClick={() => setPromoDialogOpen(true)}
          >
            <Ticket className="w-5 h-5 mr-2" />
            Promo
          </Button>

          <Button
            variant="outline"
            className="w-full h-12 border-primary/30 hover:bg-primary/10"
            onClick={() => setLocation("/tasks")}
          >
            <Gift className="w-5 h-5 mr-2" />
            Create
          </Button>
        </div>

        {/* Streak Dialog */}
        <StreakCard 
          user={user as User} 
          open={streakDialogOpen}
          onOpenChange={setStreakDialogOpen}
        />

        {/* Promo Code Dialog */}
        <PromoCodeDialog 
          open={promoDialogOpen}
          onOpenChange={setPromoDialogOpen}
        />

        {/* Withdraw Dialog */}
        <WithdrawDialog 
          open={withdrawDialogOpen}
          onOpenChange={setWithdrawDialogOpen}
        />

        {/* History Dialog */}
        <HistoryDialog 
          open={historyDialogOpen}
          onOpenChange={setHistoryDialogOpen}
        />
      </main>
    </Layout>
  );
}
