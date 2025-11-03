import { useAuth } from "@/hooks/useAuth";
import Layout from "@/components/Layout";
import AdWatchingSection from "@/components/AdWatchingSection";
import StreakCard from "@/components/StreakCard";
import PromoCodeDialog from "@/components/PromoCodeDialog";
import PromoCodeInput from "@/components/PromoCodeInput";
import WalletSection from "@/components/WalletSection";
import { Card, CardContent } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import React from "react";
import { useAdmin } from "@/hooks/useAdmin";
import { useLocation } from "wouter";
import { Trophy } from "lucide-react";
import { tonToPAD, formatCompactNumber } from "@shared/constants";
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
  const [promoDialogOpen, setPromoDialogOpen] = React.useState(false);

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
  
  const { data: topUser } = useQuery<{
    username: string;
    profileImage: string;
    totalEarnings: string;
  }>({
    queryKey: ["/api/leaderboard/top"],
    retry: false,
    refetchOnMount: true,
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
      <main className="max-w-md mx-auto px-4 mt-3">
        {/* Daily Streak Section */}
        <StreakCard user={user as User} />

        {/* Wallet Section - Compact */}
        <WalletSection
          padBalance={balancePAD}
          tonBalance={tonBalance}
          uid={formattedUserId}
          isAdmin={isAdmin}
          onAdminClick={() => setLocation("/admin")}
          onWithdraw={() => {}}
        />

        {/* Promo Code Section - Inline */}
        <Card className="mb-3 minimal-card">
          <CardContent className="pt-3 pb-3">
            <PromoCodeInput />
          </CardContent>
        </Card>

        {/* Leaderboard Preview */}
        <Card 
          className="mb-3 minimal-card cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => setLocation("/leaderboard")}
        >
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Trophy className="w-[18px] h-[18px] text-primary" />
                <h3 className="text-sm font-semibold text-white">Leaderboard</h3>
              </div>
              <div className="text-[10px] text-muted-foreground">Tap to view →</div>
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {topUser?.profileImage ? (
                  <img 
                    src={topUser.profileImage} 
                    alt={topUser.username}
                    className="w-10 h-10 rounded-full flex-shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-bold flex-shrink-0">
                    {topUser?.username?.[0] || '?'}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-white font-medium text-sm truncate">
                    {topUser?.username || 'No data'}
                  </div>
                </div>
              </div>
              <div className="text-primary text-sm font-bold flex-shrink-0">
                {topUser ? formatCompactNumber(tonToPAD(topUser.totalEarnings)) : '0'} PAD
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Viewing Ads Section */}
        <AdWatchingSection user={user as User} />

        {/* Promo Code Dialog */}
        <PromoCodeDialog 
          open={promoDialogOpen}
          onOpenChange={setPromoDialogOpen}
        />
      </main>
    </Layout>
  );
}
