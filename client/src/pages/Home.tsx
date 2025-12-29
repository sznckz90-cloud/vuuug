import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import Layout from "@/components/Layout";
import AdWatchingSection from "@/components/AdWatchingSection";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import React from "react";
import { useAdmin } from "@/hooks/useAdmin";
import { useLocation } from "wouter";
import { Award, Wallet, RefreshCw, Flame, Ticket, Clock, Loader2, Gift, Rocket, X, Bug, DollarSign, Coins, Send, Users, Check, ExternalLink, Plus } from "lucide-react";
import { DiamondIcon } from "@/components/DiamondIcon";
import { Button } from "@/components/ui/button";
import { showNotification } from "@/components/AppNotification";
import { apiRequest } from "@/lib/queryClient";
import { Input } from "@/components/ui/input";
import { AnimatePresence, motion } from "framer-motion";

interface UnifiedTask {
  id: string;
  type: 'advertiser';
  taskType: string;
  title: string;
  link: string | null;
  rewardPAD: number;
  rewardBUG?: number;
  rewardType: string;
  isAdminTask: boolean;
  isAdvertiserTask?: boolean;
  priority: number;
}

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
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set());

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

  const { data: unifiedTasksData, isLoading: isLoadingTasks } = useQuery<{
    success: boolean;
    tasks: UnifiedTask[];
    completedTaskIds: string[];
    referralCode?: string;
  }>({
    queryKey: ['/api/tasks/home/unified'],
    queryFn: async () => {
      const res = await fetch('/api/tasks/home/unified', { credentials: 'include' });
      if (!res.ok) return { success: true, tasks: [], completedTaskIds: [] };
      return res.json();
    },
    retry: false,
  });

  useEffect(() => {
    if (unifiedTasksData?.completedTaskIds) {
      setCompletedTasks(new Set(unifiedTasksData.completedTaskIds));
    } else {
      setCompletedTasks(new Set());
    }
  }, [unifiedTasksData]);

  const currentTask = unifiedTasksData?.tasks?.[0] || null;

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
      setIsApplyingPromo(false);
      showNotification(data.message || "Promo applied successfully!", "success");
    },
    onError: (error: any) => {
      const message = error.message || "Invalid promo code";
      showNotification(message, "error");
      setIsApplyingPromo(false);
    },
  });

  const advertiserTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const res = await fetch(`/api/advertiser-tasks/${taskId}/click`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Failed to complete task');
      return data;
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      await queryClient.refetchQueries({ queryKey: ['/api/tasks/home/unified'] });
      const padReward = Number(data.reward ?? 0);
      const bugReward = Number(data.bugReward ?? 0);
      if (bugReward > 0) {
        showNotification(`+${padReward.toLocaleString()} PAD, +${bugReward} BUG`, 'success');
      } else {
        showNotification(`+${padReward.toLocaleString()} PAD`, 'success');
      }
    },
    onError: (error: any) => {
      showNotification(error.message || 'Failed to complete task', 'error');
    },
  });

  const handleUnifiedTask = (task: UnifiedTask) => {
    if (!task) return;
    
    if (task.link) {
      window.open(task.link, '_blank');
      setTimeout(() => advertiserTaskMutation.mutate(task.id), 2000);
    } else {
      advertiserTaskMutation.mutate(task.id);
    }
  };

  const getTaskIcon = (task: UnifiedTask) => {
    return task.taskType === 'channel' ? <Send className="w-4 h-4" /> : 
           task.taskType === 'bot' ? <ExternalLink className="w-4 h-4" /> :
           <ExternalLink className="w-4 h-4" />;
  };

  const isTaskPending = advertiserTaskMutation.isPending;

  const showAdsgramAd = (): Promise<boolean> => {
    return new Promise(async (resolve) => {
      if (window.Adsgram) {
        try {
          await window.Adsgram.init({ blockId: "int-19149" }).show();
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

  const showMonetagRewardedAd = (): Promise<{ success: boolean; unavailable: boolean }> => {
    return new Promise((resolve) => {
      console.log('ðŸŽ¬ Attempting to show Monetag rewarded ad...');
      if (typeof window.show_10306459 === 'function') {
        console.log('âœ… Monetag SDK found, calling rewarded ad...');
        window.show_10306459()
          .then(() => {
            console.log('âœ… Monetag rewarded ad completed successfully');
            resolve({ success: true, unavailable: false });
          })
          .catch((error) => {
            console.error('âŒ Monetag rewarded ad error:', error);
            resolve({ success: false, unavailable: false });
          });
      } else {
        console.log('âš ï¸ Monetag SDK not available, skipping ad');
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
    console.log('ðŸ’± Convert started, showing AdsGram ad first...');
    
    try {
      // Show AdsGram int-19149 first
      const adsgramSuccess = await showAdsgramAd();
      
      if (!adsgramSuccess) {
        showNotification("Please watch the ad to convert.", "error");
        setIsConverting(false);
        return;
      }
      
      // Then show Monetag rewarded ad
      console.log('ðŸŽ¬ AdsGram complete, showing Monetag rewarded...');
      const monetagResult = await showMonetagRewardedAd();
      
      if (monetagResult.unavailable) {
        // If Monetag unavailable, proceed with just AdsGram
        console.log('âš ï¸ Monetag unavailable, proceeding with convert');
        convertMutation.mutate({ amount: balancePAD, convertTo: selectedConvertType });
        return;
      }
      
      if (!monetagResult.success) {
        showNotification("Please watch the ad to convert.", "error");
        setIsConverting(false);
        return;
      }
      
      console.log('âœ… Both ads watched, converting');
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
      // Show AdsGram int-19149 first
      const adsgramSuccess = await showAdsgramAd();
      
      if (!adsgramSuccess) {
        showNotification("Please watch the ad completely to claim your bonus.", "error");
        setIsClaimingStreak(false);
        return;
      }
      
      // Then show Monetag rewarded ad
      const monetagResult = await showMonetagRewardedAd();
      
      if (monetagResult.unavailable) {
        // If Monetag unavailable, proceed with just AdsGram
        claimStreakMutation.mutate();
        return;
      }
      
      if (!monetagResult.success) {
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
    console.log('ðŸŽ« Promo code claim started, showing AdsGram ad first...');
    
    try {
      // Show AdsGram int-19149 first
      const adsgramSuccess = await showAdsgramAd();
      
      if (!adsgramSuccess) {
        showNotification("Please watch the ad to claim your promo code.", "error");
        setIsApplyingPromo(false);
        return;
      }
      
      // Then show Monetag rewarded ad
      console.log('ðŸŽ¬ AdsGram complete, showing Monetag rewarded...');
      const monetagResult = await showMonetagRewardedAd();
      
      if (monetagResult.unavailable) {
        // If Monetag unavailable, proceed with just AdsGram
        console.log('âš ï¸ Monetag unavailable, proceeding with promo claim');
        redeemPromoMutation.mutate(promoCode.trim().toUpperCase());
        return;
      }
      
      if (!monetagResult.success) {
        showNotification("Please watch the ad to claim your promo code.", "error");
        setIsApplyingPromo(false);
        return;
      }
      
      console.log('âœ… Both ads watched, claiming promo code');
      redeemPromoMutation.mutate(promoCode.trim().toUpperCase());
    } catch (error) {
      console.error('Promo claim error:', error);
      showNotification("Something went wrong. Please try again.", "error");
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
          
