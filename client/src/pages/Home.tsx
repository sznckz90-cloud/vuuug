import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import Layout from "@/components/Layout";
import AdWatchingSection from "@/components/AdWatchingSection";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import React from "react";
import { useAdmin } from "@/hooks/useAdmin";
import { useLocation } from "wouter";
import { Award, Wallet, RefreshCw, Flame, Ticket, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { showNotification } from "@/components/AppNotification";
import { apiRequest } from "@/lib/queryClient";
import {
  Drawer,
  DrawerContent,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";

declare global {
  interface Window {
    show_10013974: (type?: string | { type: string; inAppSettings: any }) => Promise<void>;
    Adsgram: {
      init: (config: { blockId: string }) => {
        show: () => Promise<void>;
      };
    };
  }
}

interface User {
  id?: string;
  telegramId?: string;
  balance?: string;
  usdBalance?: string;
  lastStreakDate?: string;
  username?: string;
  firstName?: string;
  telegramUsername?: string;
  referralCode?: string;
  [key: string]: any;
}

export default function Home() {
  const { user, isLoading } = useAuth();
  const { isAdmin } = useAdmin();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const [isConverting, setIsConverting] = useState(false);
  const [isClaimingStreak, setIsClaimingStreak] = useState(false);
  const [promoDrawerOpen, setPromoDrawerOpen] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [isApplyingPromo, setIsApplyingPromo] = useState(false);
  const [hasClaimed, setHasClaimed] = useState(false);
  const [timeUntilNextClaim, setTimeUntilNextClaim] = useState<string>("");

  const { data: leaderboardData } = useQuery<{
    userEarnerRank?: { rank: number; totalEarnings: string } | null;
  }>({
    queryKey: ['/api/leaderboard/monthly'],
    retry: false,
  });

  const { data: appSettings } = useQuery<any>({
    queryKey: ['/api/app-settings'],
    retry: false,
  });

  React.useEffect(() => {
    const updateTimer = () => {
      const now = new Date();
      const typedUser = user as User;
      
      if (typedUser?.id) {
        const claimedTimestamp = localStorage.getItem(`streak_claimed_${typedUser.id}`);
        if (claimedTimestamp) {
          const claimedDate = new Date(claimedTimestamp);
          const nextClaimTime = new Date(claimedDate.getTime() + 5 * 60 * 1000);
          
          if (now.getTime() < nextClaimTime.getTime()) {
            setHasClaimed(true);
            const diff = nextClaimTime.getTime() - now.getTime();
            const minutes = Math.floor(diff / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);
            setTimeUntilNextClaim(`${minutes}:${seconds.toString().padStart(2, '0')}`);
            return;
          } else {
            setHasClaimed(false);
            localStorage.removeItem(`streak_claimed_${typedUser.id}`);
          }
        }
      }
      
      if ((user as User)?.lastStreakDate) {
        const lastClaim = new Date((user as User).lastStreakDate!);
        const minutesSinceLastClaim = (now.getTime() - lastClaim.getTime()) / (1000 * 60);
        
        if (minutesSinceLastClaim < 5) {
          setHasClaimed(true);
          const nextClaimTime = new Date(lastClaim.getTime() + 5 * 60 * 1000);
          const diff = nextClaimTime.getTime() - now.getTime();
          const minutes = Math.floor(diff / (1000 * 60));
          const seconds = Math.floor((diff % (1000 * 60)) / 1000);
          setTimeUntilNextClaim(`${minutes}:${seconds.toString().padStart(2, '0')}`);
          return;
        }
      }
      
      setHasClaimed(false);
      setTimeUntilNextClaim("Available now");
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [(user as User)?.lastStreakDate, (user as User)?.id]);

  const convertMutation = useMutation({
    mutationFn: async (amount: number) => {
      const res = await fetch("/api/convert-to-usd", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ padAmount: amount }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to convert");
      }
      return data;
    },
    onSuccess: async () => {
      showNotification("Convert successful.", "success");
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/stats"] });
    },
    onError: (error: Error) => {
      showNotification(error.message, "error");
    },
  });

  const claimStreakMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/streak/claim");
      if (!response.ok) {
        const error = await response.json();
        const errorObj = new Error(error.message || 'Failed to claim streak');
        (errorObj as any).isAlreadyClaimed = error.message === "You have already claimed today's streak!";
        throw errorObj;
      }
      return response.json();
    },
    onSuccess: (data) => {
      setHasClaimed(true);
      const typedUser = user as User;
      if (typedUser?.id) {
        localStorage.setItem(`streak_claimed_${typedUser.id}`, new Date().toISOString());
      }
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/stats"] });
      const rewardAmount = parseFloat(data.rewardEarned || '0');
      if (rewardAmount > 0) {
        const earnedPAD = Math.round(rewardAmount);
        showNotification(`You've claimed +${earnedPAD} PAD!`, "success");
      } else {
        showNotification("You've claimed your streak bonus!", "success");
      }
    },
    onError: (error: any) => {
      const notificationType = error.isAlreadyClaimed ? "info" : "error";
      showNotification(error.message || "Failed to claim streak", notificationType);
      if (error.isAlreadyClaimed) {
        setHasClaimed(true);
        const typedUser = user as User;
        if (typedUser?.id) {
          localStorage.setItem(`streak_claimed_${typedUser.id}`, new Date().toISOString());
        }
      }
    },
    onSettled: () => {
      setIsClaimingStreak(false);
    },
  });

  const redeemPromoMutation = useMutation({
    mutationFn: async (code: string) => {
      const response = await apiRequest("POST", "/api/promo-codes/redeem", { code });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Invalid promo code");
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/earnings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/stats"] });
      setPromoCode("");
      showNotification("Promo applied successfully!", "success");
    },
    onError: (error: any) => {
      const message = error.message || "Invalid code.";
      if (message.includes("expired")) {
        showNotification("Promo expired.", "error");
      } else if (message.includes("already")) {
        showNotification("Already claimed.", "error");
      } else {
        showNotification(message, "error");
      }
    },
  });

  const showAdsgramAd = (): Promise<boolean> => {
    return new Promise(async (resolve) => {
      if (window.Adsgram) {
        try {
          await window.Adsgram.init({ blockId: "int-18225" }).show();
          resolve(true);
        } catch (error) {
          console.error('Adsgram ad error:', error);
          resolve(false);
        }
      } else {
        resolve(false);
      }
    });
  };

  const showMonetagAd = (): Promise<{ success: boolean; unavailable: boolean }> => {
    return new Promise((resolve) => {
      if (typeof window.show_10013974 === 'function') {
        window.show_10013974()
          .then(() => {
            resolve({ success: true, unavailable: false });
          })
          .catch((error) => {
            console.error('Monetag ad error:', error);
            resolve({ success: false, unavailable: false });
          });
      } else {
        resolve({ success: false, unavailable: true });
      }
    });
  };

  const handleConvert = async () => {
    const minimumConvertPAD = appSettings?.minimumConvertPAD || 10000;
    
    if (balancePAD < minimumConvertPAD) {
      showNotification(`Minimum ${minimumConvertPAD.toLocaleString()} PAD required.`, "error");
      return;
    }

    if (isConverting || convertMutation.isPending) return;
    
    setIsConverting(true);
    
    try {
      const monetagResult = await showMonetagAd();
      
      if (monetagResult.unavailable) {
        showNotification("Ads not available. Please try again later.", "error");
        setIsConverting(false);
        return;
      }
      
      if (!monetagResult.success) {
        showNotification("Ad failed. Please try again.", "error");
        setIsConverting(false);
        return;
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const adsgramSuccess = await showAdsgramAd();
      
      if (!adsgramSuccess) {
        showNotification("Please complete all ads to convert.", "error");
        setIsConverting(false);
        return;
      }
      
      convertMutation.mutate(balancePAD);
      
    } catch (error) {
      console.error('Convert error:', error);
      showNotification("Something went wrong. Please try again.", "error");
    } finally {
      setIsConverting(false);
    }
  };

  const handleClaimStreak = async () => {
    if (isClaimingStreak || hasClaimed) return;
    
    setIsClaimingStreak(true);
    
    try {
      const adSuccess = await showAdsgramAd();
      
      if (!adSuccess) {
        showNotification("Please watch the ad completely to claim your bonus.", "error");
        setIsClaimingStreak(false);
        return;
      }
      
      claimStreakMutation.mutate();
    } catch (error) {
      console.error('Streak claim failed:', error);
      showNotification("Failed to claim streak. Please try again.", "error");
      setIsClaimingStreak(false);
    }
  };

  const handleApplyPromo = async () => {
    if (!promoCode.trim()) {
      showNotification("Please enter a promo code", "error");
      return;
    }

    if (isApplyingPromo || redeemPromoMutation.isPending) return;
    
    setIsApplyingPromo(true);
    
    try {
      redeemPromoMutation.mutate(promoCode.trim().toUpperCase());
    } finally {
      setIsApplyingPromo(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="flex gap-1 justify-center mb-4">
            <div className="w-2 h-2 rounded-full bg-[#4cd3ff] animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-2 h-2 rounded-full bg-[#4cd3ff] animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-2 h-2 rounded-full bg-[#4cd3ff] animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
          <div className="text-foreground font-medium">Loading...</div>
        </div>
      </div>
    );
  }

  const rawBalance = parseFloat((user as User)?.balance || "0");
  const balancePAD = rawBalance < 1 ? Math.round(rawBalance * 10000000) : Math.round(rawBalance);
  const balanceUSD = parseFloat((user as User)?.usdBalance || "0");
  
  const userUID = (user as User)?.referralCode || "00000";

  const photoUrl = typeof window !== 'undefined' && (window as any).Telegram?.WebApp?.initDataUnsafe?.user?.photo_url;
  
  const getDisplayName = (): string => {
    const typedUser = user as User;
    if (typedUser?.firstName) {
      return typedUser.firstName;
    }
    return 'Guest';
  };
  
  const displayName = getDisplayName();
  const userRank = leaderboardData?.userEarnerRank?.rank;
  const canClaimStreak = timeUntilNextClaim === "Available now" && !hasClaimed;

  return (
    <Layout>
      <main className="max-w-md mx-auto px-4 pt-1">
        <div className="flex flex-col items-center mb-4">
          {photoUrl ? (
            <img 
              src={photoUrl} 
              alt="Profile" 
              className={`w-24 h-24 rounded-full border-4 border-[#4cd3ff] shadow-[0_0_20px_rgba(76,211,255,0.5)] ${isAdmin ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
              onClick={() => isAdmin && setLocation("/admin")}
            />
          ) : (
            <div 
              className={`w-24 h-24 rounded-full bg-gradient-to-br from-[#4cd3ff] to-[#b8b8b8] flex items-center justify-center border-4 border-[#4cd3ff] shadow-[0_0_20px_rgba(76,211,255,0.5)] ${isAdmin ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
              onClick={() => isAdmin && setLocation("/admin")}
            >
              <span className="text-black font-bold text-3xl">
                {displayName.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          
          {userRank && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-[#4cd3ff]/20 to-[#b8b8b8]/20 border border-[#4cd3ff]/30 -mt-2">
              <Award className="w-3 h-3 text-[#4cd3ff]" />
              <span className="text-[10px] font-bold text-[#4cd3ff]">#{userRank}</span>
            </div>
          )}
          
          <h1 className="text-lg font-bold text-white mt-1">{displayName}</h1>
          <p className="text-xs text-gray-400 -mt-0.5">UID: {userUID}</p>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-3">
          <Button
            onClick={() => setLocation("/withdraw")}
            className="h-16 bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] border border-[#4cd3ff]/30 hover:border-[#4cd3ff] hover:bg-[#4cd3ff]/10 transition-all rounded-xl flex flex-col items-center justify-center gap-1"
          >
            <Wallet className="w-6 h-6 text-[#4cd3ff]" />
            <span className="text-white font-semibold text-sm">Payouts</span>
          </Button>

          <Button
            onClick={handleConvert}
            disabled={isConverting || convertMutation.isPending}
            className="h-16 bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] border border-[#4cd3ff]/30 hover:border-[#4cd3ff] hover:bg-[#4cd3ff]/10 transition-all rounded-xl flex flex-col items-center justify-center gap-1 disabled:opacity-50"
          >
            {isConverting || convertMutation.isPending ? (
              <>
                <Clock className="w-6 h-6 text-[#4cd3ff] animate-spin" />
                <span className="text-white font-semibold text-sm">Converting...</span>
              </>
            ) : (
              <>
                <RefreshCw className="w-6 h-6 text-[#4cd3ff]" />
                <span className="text-white font-semibold text-sm">Convert</span>
              </>
            )}
          </Button>

          <Button
            onClick={handleClaimStreak}
            disabled={isClaimingStreak || !canClaimStreak}
            className="h-16 bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] border border-[#4cd3ff]/30 hover:border-[#4cd3ff] hover:bg-[#4cd3ff]/10 transition-all rounded-xl flex flex-col items-center justify-center gap-1 disabled:opacity-50"
          >
            {isClaimingStreak ? (
              <>
                <Loader2 className="w-6 h-6 text-[#4cd3ff] animate-spin" />
                <span className="text-white font-semibold text-sm">Claiming...</span>
              </>
            ) : canClaimStreak ? (
              <>
                <Flame className="w-6 h-6 text-[#4cd3ff]" />
                <span className="text-white font-semibold text-sm">Streak Claim</span>
              </>
            ) : (
              <>
                <Flame className="w-6 h-6 text-[#4cd3ff] opacity-50" />
                <span className="text-white font-semibold text-sm opacity-70">{timeUntilNextClaim}</span>
              </>
            )}
          </Button>

          <Drawer open={promoDrawerOpen} onOpenChange={setPromoDrawerOpen}>
            <DrawerTrigger asChild>
              <Button
                className="h-16 bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] border border-[#4cd3ff]/30 hover:border-[#4cd3ff] hover:bg-[#4cd3ff]/10 transition-all rounded-xl flex flex-col items-center justify-center gap-1"
              >
                <Ticket className="w-6 h-6 text-[#4cd3ff]" />
                <span className="text-white font-semibold text-sm">Promo Code</span>
              </Button>
            </DrawerTrigger>
            <DrawerContent className="bg-black/95 backdrop-blur-xl border-t-0 rounded-t-[24px] shadow-[0_-10px_40px_rgba(76,211,255,0.15)] max-h-[85vh]">
              <div className="px-4 pb-8 pt-2 overflow-y-auto">
                <div className="space-y-6">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Ticket className="w-5 h-5 text-[#4cd3ff]" />
                      <span className="text-sm font-semibold text-white">Promo Code</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 relative">
                        <Input
                          placeholder="Enter code"
                          value={promoCode}
                          onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                          disabled={redeemPromoMutation.isPending || isApplyingPromo}
                          className="bg-[#1a1a1a] border-[#333] text-white placeholder:text-gray-500 h-11 rounded-xl"
                        />
                      </div>
                      <Button
                        onClick={handleApplyPromo}
                        disabled={redeemPromoMutation.isPending || isApplyingPromo || !promoCode.trim()}
                        className="h-11 px-6 bg-[#4cd3ff] hover:bg-[#6ddeff] text-black transition-all active:scale-[0.97] font-semibold rounded-xl"
                      >
                        {redeemPromoMutation.isPending || isApplyingPromo ? <Loader2 className="w-4 h-4 animate-spin" /> : "Apply"}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </DrawerContent>
          </Drawer>
        </div>

        <div className="mt-6">
          <AdWatchingSection user={user as User} />
        </div>
      </main>
    </Layout>
  );
}
