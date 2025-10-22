import { useAuth } from "@/hooks/useAuth";
import Layout from "@/components/Layout";
import AdWatchingSection from "@/components/AdWatchingSection";
import StreakCard from "@/components/StreakCard";
import PromoCodeDialog from "@/components/PromoCodeDialog";
import PromoCodeInput from "@/components/PromoCodeInput";
import WithdrawDialog from "@/components/WithdrawDialog";
import WalletSection from "@/components/WalletSection";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import React from "react";
import { useAdmin } from "@/hooks/useAdmin";
import { useLocation } from "wouter";
import { ArrowDown, Flame } from "lucide-react";
import { tonToPAD } from "@shared/constants";
import { DiamondIcon, SparkleIcon } from "@/components/DiamondIcon";

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

  const { data: stats, isLoading: statsLoading } = useQuery<{
    todayEarnings?: string;
    referralEarnings?: string;
  }>({
    queryKey: ["/api/user/stats"],
    retry: false,
    // CRITICAL FIX: Always refetch stats from database
    refetchOnMount: true,
    staleTime: 0,
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
  const allTimeEarnings = tonToPAD((user as User)?.totalEarned || "0");
  const referralEarnings = tonToPAD(stats?.referralEarnings || "0");
  
  const referralCode = (user as User)?.referralCode || "000000";
  const formattedUserId = referralCode.slice(-6).toUpperCase();

  return (
    <Layout>
      <main className="max-w-md mx-auto px-4 mt-6">
        {/* Wallet Section - Compact */}
        <WalletSection
          padBalance={balancePAD}
          tonBalance={tonBalance}
          uid={formattedUserId}
          isAdmin={isAdmin}
          onAdminClick={() => setLocation("/admin")}
          onWithdraw={() => setWithdrawDialogOpen(true)}
        />

        {/* Income Statistics */}
        <Card className="mb-3 minimal-card">
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center gap-2 mb-2">
              <DiamondIcon size={18} withGlow />
              <h3 className="text-sm font-semibold text-white">Income statistics</h3>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <div className="text-[10px] text-muted-foreground mb-1">Today</div>
                <div className="text-foreground font-semibold text-sm">{todayEarnings.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground mb-1">All time</div>
                <div className="text-foreground font-semibold text-sm">{allTimeEarnings.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground mb-1">On referrals</div>
                <div className="text-foreground font-semibold text-sm">{referralEarnings.toLocaleString()}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Viewing Ads Section */}
        <AdWatchingSection user={user as User} />

        {/* Promo Code Section - Inline */}
        <Card className="mb-3 minimal-card">
          <CardContent className="pt-3 pb-3">
            <PromoCodeInput />
          </CardContent>
        </Card>

        {/* Main Action Buttons - Centered */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            className="h-12 btn-primary"
            onClick={() => setStreakDialogOpen(true)}
          >
            <Flame className="w-5 h-5 mr-2" />
            Streak
          </Button>
          
          <Button
            className="h-12 btn-primary"
            onClick={() => setWithdrawDialogOpen(true)}
          >
            <ArrowDown className="w-5 h-5 mr-2" />
            Withdraw
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
      </main>
    </Layout>
  );
}
