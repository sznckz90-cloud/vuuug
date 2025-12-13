import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import Layout from "@/components/Layout";
import AdWatchingSection from "@/components/AdWatchingSection";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import React from "react";
import { useAdmin } from "@/hooks/useAdmin";
import { useLocation } from "wouter";
import { Award, Wallet, RefreshCw, Flame, Ticket, Clock, Loader2, Gift, Rocket, X, Bug, DollarSign, Coins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { showNotification } from "@/components/AppNotification";
import { apiRequest } from "@/lib/queryClient";
import { Input } from "@/components/ui/input";

declare global {
  interface Window {
    show_10306459: (type?: string | { type: string; inAppSettings: any }) => Promise<void>;
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
  bugBalance?: string;
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
  const [promoCode, setPromoCode] = useState("");
  const [isApplyingPromo, setIsApplyingPromo] = useState(false);
  const [hasClaimed, setHasClaimed] = useState(false);
  const [timeUntilNextClaim, setTimeUntilNextClaim] = useState<string>("");
  
  const [promoPopupOpen, setPromoPopupOpen] = useState(false);
  const [convertPopupOpen, setConvertPopupOpen] = useState(false);
  const [selectedConvertType, setSelectedConvertType] = useState<'USD' | 'TON' | 'BUG'>('USD');

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
    mutationFn: async ({ amount, convertTo }: { amount: number; convertTo: string }) => {
      const res = await fetch("/api/convert-to-usd", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ padAmount: amount, convertTo }),
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
      setConvertPopupOpen(false);
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
        (errorObj as any).isAlreadyClaimed = error.message === "Please wait 5 minutes before claiming again!";
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
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/earnings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/stats"] });
      setPromoCode("");
      setPromoPopupOpen(false);
      showNotification(data.message || "Promo applied successfully!", "success");
    },
    onError: (error: any) => {
      const message = error.message || "Invalid promo code";
      showNotification(message, "error");
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
      if (typeof window.show_10306459 === 'function') {
        window.show_10306459()
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

  const handleConvertClick = () => {
    setConvertPopupOpen(true);
  };

  const handleConvertConfirm = async () => {
    const minimumConvertPAD = selectedConvertType === 'USD' 
      ? (appSettings?.minimumConvertPAD || 10000)
      : selectedConvertType === 'TON'
        ? (appSettings?.minimumConvertPadToTon || 10000)
        : (appSettings?.minimumConvertPadToBug || 1000);
    
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
      
      convertMutation.mutate({ amount: balancePAD, convertTo: selectedConvertType });
      
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

  const handleBoosterClick = () => {
    if (isAdmin) {
      setLocation("/store");
    } else {
      showNotification("Boosters are coming soon!", "info");
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
  const balanceBUG = parseFloat((user as User)?.bugBalance || "0");
  
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
      <main className="max-w-md mx-auto px-4 pt-[14px]">
        <div className="flex flex-col items-center mb-3">
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

        <div className="grid grid-cols-2 gap-2 mt-2">
          <Button
            onClick={handleConvertClick}
            disabled={isConverting || convertMutation.isPending}
            className="h-12 bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] border border-[#4cd3ff]/30 hover:border-[#4cd3ff] hover:bg-[#4cd3ff]/10 transition-all rounded-full flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg"
          >
            {isConverting || convertMutation.isPending ? (
              <>
                <Clock className="w-4 h-4 text-[#4cd3ff] animate-spin" />
                <span className="text-white font-medium text-xs">Converting...</span>
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 text-[#4cd3ff]" />
                <span className="text-white font-medium text-xs">Convert</span>
              </>
            )}
          </Button>

          <Button
            onClick={handleClaimStreak}
            disabled={isClaimingStreak || !canClaimStreak}
            className="h-12 bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] border border-[#4cd3ff]/30 hover:border-[#4cd3ff] hover:bg-[#4cd3ff]/10 transition-all rounded-full flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg"
          >
            {isClaimingStreak ? (
              <>
                <Loader2 className="w-4 h-4 text-[#4cd3ff] animate-spin" />
                <span className="text-white font-medium text-xs">Claiming...</span>
              </>
            ) : canClaimStreak ? (
              <>
                <Flame className="w-4 h-4 text-[#4cd3ff]" />
                <span className="text-white font-medium text-xs">Claim Bonus</span>
              </>
            ) : (
              <>
                <Flame className="w-4 h-4 text-[#4cd3ff] opacity-50" />
                <span className="text-white font-medium text-xs opacity-70">{timeUntilNextClaim}</span>
              </>
            )}
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-2">
          <Button
            onClick={() => setPromoPopupOpen(true)}
            className="h-12 bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] border border-purple-500/30 hover:border-purple-500 hover:bg-purple-500/10 transition-all rounded-full flex items-center justify-center gap-2 shadow-lg"
          >
            <Gift className="w-4 h-4 text-purple-400" />
            <span className="text-white font-medium text-xs">Promo</span>
          </Button>

          <Button
            onClick={handleBoosterClick}
            className="h-12 bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] border border-orange-500/30 hover:border-orange-500 hover:bg-orange-500/10 transition-all rounded-full flex items-center justify-center gap-2 shadow-lg"
          >
            <Rocket className="w-4 h-4 text-orange-400" />
            <span className="text-white font-medium text-xs">Booster</span>
          </Button>
        </div>

        <div className="mt-3">
          <AdWatchingSection user={user as User} />
        </div>
      </main>

      {promoPopupOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 px-4">
          <div className="bg-[#1a1a1a] rounded-2xl p-6 w-full max-w-sm border border-white/10">
            <h2 className="text-xl font-bold text-white text-center mb-4">Enter Promo Code</h2>
            
            <Input
              placeholder="Enter code here"
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
              disabled={redeemPromoMutation.isPending || isApplyingPromo}
              className="bg-[#0d0d0d] border border-white/20 rounded-xl text-white placeholder:text-gray-500 px-4 py-3 h-12 text-center text-lg font-semibold tracking-wider focus:border-purple-500 focus:ring-0 mb-4"
            />
            
            <div className="flex gap-3">
              <Button
                onClick={() => {
                  setPromoPopupOpen(false);
                  setPromoCode("");
                }}
                className="flex-1 h-11 bg-[#2a2a2a] hover:bg-[#333] text-white font-semibold rounded-xl"
              >
                Close
              </Button>
              <Button
                onClick={handleApplyPromo}
                disabled={redeemPromoMutation.isPending || isApplyingPromo || !promoCode.trim()}
                className="flex-1 h-11 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl disabled:opacity-50"
              >
                {redeemPromoMutation.isPending || isApplyingPromo ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Apply"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {convertPopupOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 px-4">
          <div className="bg-[#1a1a1a] rounded-2xl p-6 w-full max-w-sm border border-white/10">
            <h2 className="text-xl font-bold text-white text-center mb-2">Convert PAD</h2>
            <p className="text-gray-400 text-sm text-center mb-4">
              Balance: {balancePAD.toLocaleString()} PAD
            </p>
            
            <div className="space-y-3 mb-4">
              <button
                onClick={() => setSelectedConvertType('USD')}
                className={`w-full p-4 rounded-xl border-2 transition-all flex items-center gap-3 ${
                  selectedConvertType === 'USD' 
                    ? 'border-green-500 bg-green-500/10' 
                    : 'border-white/10 bg-[#0d0d0d] hover:border-white/30'
                }`}
              >
                <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-green-400" />
                </div>
                <div className="text-left flex-1">
                  <p className="text-white font-semibold">PAD → USD</p>
                  <p className="text-xs text-gray-400">Min: {(appSettings?.minimumConvertPAD || 10000).toLocaleString()} PAD</p>
                </div>
              </button>
              
              <button
                onClick={() => setSelectedConvertType('TON')}
                className={`w-full p-4 rounded-xl border-2 transition-all flex items-center gap-3 ${
                  selectedConvertType === 'TON' 
                    ? 'border-blue-500 bg-blue-500/10' 
                    : 'border-white/10 bg-[#0d0d0d] hover:border-white/30'
                }`}
              >
                <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                  <Coins className="w-5 h-5 text-blue-400" />
                </div>
                <div className="text-left flex-1">
                  <p className="text-white font-semibold">PAD → TON</p>
                  <p className="text-xs text-gray-400">Min: {(appSettings?.minimumConvertPadToTon || 10000).toLocaleString()} PAD</p>
                </div>
              </button>
              
              <button
                onClick={() => setSelectedConvertType('BUG')}
                className={`w-full p-4 rounded-xl border-2 transition-all flex items-center gap-3 ${
                  selectedConvertType === 'BUG' 
                    ? 'border-emerald-500 bg-emerald-500/10' 
                    : 'border-white/10 bg-[#0d0d0d] hover:border-white/30'
                }`}
              >
                <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <Bug className="w-5 h-5 text-emerald-400" />
                </div>
                <div className="text-left flex-1">
                  <p className="text-white font-semibold">PAD → BUG</p>
                  <p className="text-xs text-gray-400">Min: {(appSettings?.minimumConvertPadToBug || 1000).toLocaleString()} PAD</p>
                </div>
              </button>
            </div>
            
            <div className="flex gap-3">
              <Button
                onClick={() => setConvertPopupOpen(false)}
                className="flex-1 h-11 bg-[#2a2a2a] hover:bg-[#333] text-white font-semibold rounded-xl"
              >
                Close
              </Button>
              <Button
                onClick={handleConvertConfirm}
                disabled={isConverting || convertMutation.isPending}
                className="flex-1 h-11 bg-[#4cd3ff] hover:bg-[#6ddeff] text-black font-semibold rounded-xl disabled:opacity-50"
              >
                {isConverting || convertMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Convert"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
