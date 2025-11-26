import { useAuth } from "@/hooks/useAuth";
import Layout from "@/components/Layout";
import AdWatchingSection from "@/components/AdWatchingSection";
import StreakCard from "@/components/StreakCard";
import PromoCodeInput from "@/components/PromoCodeInput";
import WalletSection from "@/components/WalletSection";
import { Card, CardContent } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import React from "react";
import { useAdmin } from "@/hooks/useAdmin";
import { useLocation } from "wouter";
import { Award } from "lucide-react";

interface User {
  id?: string;
  telegramId?: string;
  balance?: string;
  usdBalance?: string;
  lastStreakDate?: string;
  username?: string;
  firstName?: string;
  referralCode?: string;
  [key: string]: any;
}

export default function Home() {
  const { user, isLoading } = useAuth();
  const { isAdmin } = useAdmin();
  const [, setLocation] = useLocation();

  const { data: leaderboardData } = useQuery<{
    userEarnerRank?: { rank: number; totalEarnings: string } | null;
  }>({
    queryKey: ['/api/leaderboard/monthly'],
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

  const rawBalance = parseFloat((user as User)?.balance || "0");
  const balancePAD = rawBalance < 1 ? Math.round(rawBalance * 10000000) : Math.round(rawBalance);
  const balanceUSD = parseFloat((user as User)?.usdBalance || "0");
  
  const referralCode = (user as User)?.referralCode || "000000";
  const formattedUserId = referralCode.slice(-6).toUpperCase();

  const photoUrl = typeof window !== 'undefined' && (window as any).Telegram?.WebApp?.initDataUnsafe?.user?.photo_url;
  const firstName = (user as User)?.firstName || (user as User)?.username || 'User';
  const username = (user as User)?.username || '';
  const userRank = leaderboardData?.userEarnerRank?.rank;

  return (
    <Layout>
      <main className="max-w-md mx-auto px-4 pt-1">
        {/* User Profile Section - Like Hamburger Menu Style */}
        <div className="flex flex-col items-center gap-1 mb-2">
          {/* Profile Photo */}
          {photoUrl ? (
            <div className="flex flex-col items-center gap-2">
              <img 
                src={photoUrl} 
                alt="Profile" 
                className="w-20 h-20 rounded-full border-4 border-[#4cd3ff] shadow-[0_0_20px_rgba(76,211,255,0.5)]"
              />
              {userRank && (
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-gradient-to-r from-[#4cd3ff]/20 to-[#b8b8b8]/20 border border-[#4cd3ff]/30">
                  <Award className="w-3.5 h-3.5 text-[#4cd3ff]" />
                  <span className="text-[10px] font-bold text-[#4cd3ff]">#{userRank}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#4cd3ff] to-[#b8b8b8] flex items-center justify-center border-4 border-[#4cd3ff] shadow-[0_0_20px_rgba(76,211,255,0.5)]">
                <span className="text-black font-bold text-3xl">
                  {firstName.charAt(0).toUpperCase()}
                </span>
              </div>
              {userRank && (
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-gradient-to-r from-[#4cd3ff]/20 to-[#b8b8b8]/20 border border-[#4cd3ff]/30">
                  <Award className="w-3.5 h-3.5 text-[#4cd3ff]" />
                  <span className="text-[10px] font-bold text-[#4cd3ff]">#{userRank}</span>
                </div>
              )}
            </div>
          )}
          
          {/* User Info */}
          <div className="flex flex-col items-center gap-1">
            <h3 className="text-lg font-bold text-white">{firstName}</h3>
            {username && <p className="text-sm text-gray-400">@{username}</p>}
          </div>
        </div>

        {/* Daily Streak Section */}
        <StreakCard user={user as User} />

        {/* Wallet Section - Compact */}
        <WalletSection
          padBalance={balancePAD}
          usdBalance={balanceUSD}
          uid={formattedUserId}
          isAdmin={isAdmin}
          onAdminClick={() => setLocation("/admin")}
          onWithdraw={() => {}}
        />

        {/* Promo Code Section */}
        <Card className="mb-3 minimal-card">
          <CardContent className="pt-3 pb-3">
            <PromoCodeInput />
          </CardContent>
        </Card>

        {/* Viewing Ads Section - Original Style */}
        <AdWatchingSection user={user as User} />
      </main>
    </Layout>
  );
}
