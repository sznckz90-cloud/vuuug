import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import Layout from "@/components/Layout";
import AdWatchingSection from "@/components/AdWatchingSection";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import React from "react";
import { useAdmin } from "@/hooks/useAdmin";
import { useLocation } from "wouter";
import { Award, Wallet, RefreshCw, Flame, Ticket, Clock, Loader2, Gift, Rocket, X, Bug, DollarSign, Coins, Send, Users, Check, ExternalLink } from "lucide-react";
import { DiamondIcon } from "@/components/DiamondIcon";
import { Button } from "@/components/ui/button";
import { showNotification } from "@/components/AppNotification";
import { apiRequest } from "@/lib/queryClient";
import { Input } from "@/components/ui/input";
import { AnimatePresence, motion } from "framer-motion";

interface UnifiedTask {
  id: string;
  type: 'admin' | 'daily';
  taskType: string;
  title: string;
  link: string | null;
  rewardPAD: number;
  rewardType: string;
  isAdminTask: boolean;
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

  const shareTaskMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/tasks/complete/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to complete task');
      return data;
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      await queryClient.refetchQueries({ queryKey: ['/api/tasks/home/unified'] });
      showNotification(`+${data.reward?.toLocaleString() || '1000'} PAD`, 'success');
    },
    onError: (error: any) => {
      showNotification(error.message || 'Failed to complete task', 'error');
    },
  });

  const channelTaskMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/tasks/complete/channel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to complete task');
      return data;
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      await queryClient.refetchQueries({ queryKey: ['/api/tasks/home/unified'] });
      showNotification(`+${data.reward?.toLocaleString() || '1000'} PAD`, 'success');
    },
    onError: (error: any) => {
      showNotification(error.message || 'Failed to complete task', 'error');
    },
  });

  const communityTaskMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/tasks/complete/community', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to complete task');
      return data;
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      await queryClient.refetchQueries({ queryKey: ['/api/tasks/home/unified'] });
      showNotification(`+${data.reward?.toLocaleString() || '1000'} PAD`, 'success');
    },
    onError: (error: any) => {
      showNotification(error.message || 'Failed to complete task', 'error');
    },
  });

  const adminTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const res = await fetch(`/api/tasks/${taskId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to complete task');
      return data;
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      await queryClient.refetchQueries({ queryKey: ['/api/tasks/home/unified'] });
      showNotification(`+${data.reward?.toLocaleString() || '1750'} PAD`, 'success');
    },
    onError: (error: any) => {
      showNotification(error.message || 'Failed to complete task', 'error');
    },
  });

  const handleUnifiedTask = (task: UnifiedTask) => {
    if (!task) return;
    
    if (task.isAdminTask) {
      if (task.link) {
        window.open(task.link, '_blank');
        setTimeout(() => adminTaskMutation.mutate(task.id), 2000);
      } else {
        adminTaskMutation.mutate(task.id);
      }
    } else {
      if (task.id === 'share-friends') {
        const botUsername = import.meta.env.VITE_BOT_USERNAME || 'Paid_Adzbot';
        const referralCode = unifiedTasksData?.referralCode || (user as User)?.referralCode;
        const referralLink = referralCode 
          ? `https://t.me/${botUsername}?start=${referralCode}`
          : '';
        if (!referralLink) {
          showNotification('Unable to generate referral link', 'error');
          return;
        }
        const shareText = `Earn PAD in Telegram!`;
        const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent(shareText)}`;
        if ((window as any).Telegram?.WebApp?.openTelegramLink) {
          (window as any).Telegram.WebApp.openTelegramLink(shareUrl);
        } else {
          window.open(shareUrl, '_blank');
        }
        shareTaskMutation.mutate();
      } else if (task.id === 'check-updates') {
        window.open(task.link || 'https://t.me/PaidAdsNews', '_blank');
        setTimeout(() => channelTaskMutation.mutate(), 2000);
      } else if (task.id === 'join-community') {
        window.open(task.link || 'https://t.me/PaidAdsCommunity', '_blank');
        setTimeout(() => communityTaskMutation.mutate(), 2000);
      }
    }
  };

  const getTaskIcon = (task: UnifiedTask) => {
    if (task.isAdminTask) {
      return task.taskType === 'channel' ? <Send className="w-4 h-4" /> : <ExternalLink className="w-4 h-4" />;
    }
    switch (task.id) {
      case 'share-friends': return <Gift className="w-4 h-4" />;
      case 'check-updates': return <Send className="w-4 h-4" />;
      case 'join-community': return <Users className="w-4 h-4" />;
      default: return <Gift className="w-4 h-4" />;
    }
  };

  const isTaskPending = shareTaskMutation.isPending || channelTaskMutation.isPending || 
    communityTaskMutation.isPending || adminTaskMutation.isPending;

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

  const showMonetagPopupAd = (): Promise<{ success: boolean; unavailable: boolean }> => {
    return new Promise((resolve) => {
      console.log('🎬 Attempting to show Monetag popup ad...');
      if (typeof window.show_10306459 === 'function') {
        console.log('✅ Monetag SDK found, calling popup ad...');
        window.show_10306459('pop')
          .then(() => {
            console.log('✅ Monetag popup ad completed successfully');
            resolve({ success: true, unavailable: false });
          })
          .catch((error) => {
            console.error('❌ Monetag popup ad error:', error);
            resolve({ success: false, unavailable: false });
          });
      } else {
        console.log('⚠️ Monetag SDK not available, skipping ad');
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
    console.log('💱 Convert started, showing popup ad...');
    
    try {
      const popupResult = await showMonetagPopupAd();
      console.log('📊 Popup ad result:', popupResult);
      
      if (popupResult.unavailable) {
        console.log('⚠️ Ads unavailable, proceeding with convert');
        convertMutation.mutate({ amount: balancePAD, convertTo: selectedConvertType });
        return;
      }
      
      if (!popupResult.success) {
        showNotification("Please watch the ad to convert.", "error");
        setIsConverting(false);
        return;
      }
      
      console.log('✅ Ad watched, converting');
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
      const popupResult = await showMonetagPopupAd();
      
      if (popupResult.unavailable) {
        const adSuccess = await showAdsgramAd();
        if (!adSuccess) {
          showNotification("Please watch the ad completely to claim your bonus.", "error");
          setIsClaimingStreak(false);
          return;
        }
        claimStreakMutation.mutate();
        return;
      }
      
      if (!popupResult.success) {
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
    console.log('🎫 Promo code claim started, showing popup ad...');
    
    try {
      const popupResult = await showMonetagPopupAd();
      console.log('📊 Popup ad result:', popupResult);
      
      if (popupResult.unavailable) {
        console.log('⚠️ Ads unavailable, proceeding with promo claim');
        redeemPromoMutation.mutate(promoCode.trim().toUpperCase());
        return;
      }
      
      if (!popupResult.success) {
        showNotification("Please watch the ad to claim your promo code.", "error");
        setIsApplyingPromo(false);
        return;
      }
      
      console.log('✅ Ad watched, claiming promo code');
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

        <div className="mt-3 px-0">
          <div className="bg-[#0d0d0d] rounded-xl border border-[#1a1a1a] p-3">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-lg bg-[#4cd3ff]/20 flex items-center justify-center">
                <Flame className="w-3.5 h-3.5 text-[#4cd3ff]" />
              </div>
              <span className="text-sm font-semibold text-white">
                {currentTask?.isAdminTask ? 'Featured Task' : 'Daily Tasks'}
              </span>
              {currentTask?.isAdminTask && (
                <span className="text-[10px] px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 rounded-full font-medium">Priority</span>
              )}
            </div>
            
            <AnimatePresence mode="wait">
              {isLoadingTasks ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="bg-[#1a1a1a] rounded-lg p-4 text-center"
                >
                  <Loader2 className="w-5 h-5 text-[#4cd3ff] animate-spin mx-auto" />
                </motion.div>
              ) : currentTask ? (
                <motion.div
                  key={currentTask.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  className="bg-[#1a1a1a] rounded-lg p-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        currentTask.isAdminTask ? 'bg-yellow-500/20' : 'bg-[#4cd3ff]/20'
                      }`}>
                        <span className={currentTask.isAdminTask ? 'text-yellow-400' : 'text-[#4cd3ff]'}>
                          {getTaskIcon(currentTask)}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-white font-medium text-sm truncate">{currentTask.title}</h3>
                        <div className="flex items-center gap-1">
                          <DiamondIcon size={12} />
                          <span className={`text-xs font-semibold ${
                            currentTask.isAdminTask ? 'text-yellow-400' : 'text-[#4cd3ff]'
                          }`}>+{currentTask.rewardPAD.toLocaleString()} PAD</span>
                        </div>
                      </div>
                    </div>
                    <Button
                      onClick={() => handleUnifiedTask(currentTask)}
                      disabled={isTaskPending}
                      className={`h-8 px-4 text-xs font-semibold rounded-lg text-black ${
                        currentTask.isAdminTask 
                          ? 'bg-yellow-400 hover:bg-yellow-300' 
                          : 'bg-[#4cd3ff] hover:bg-[#6ddeff]'
                      }`}
                    >
                      {isTaskPending ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        "Start"
                      )}
                    </Button>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="completed"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.3 }}
                  className="bg-[#1a1a1a] rounded-lg p-4 text-center"
                >
                  <div className="flex items-center justify-center gap-2">
                    <Check className="w-4 h-4 text-green-400" />
                    <span className="text-gray-400 text-sm">All tasks completed</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>

      {promoPopupOpen && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 px-4">
          <div className="bg-[#0d0d0d] rounded-2xl p-6 w-full max-w-sm border border-[#1a1a1a]">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Gift className="w-5 h-5 text-[#4cd3ff]" />
              <h2 className="text-lg font-bold text-white">Enter Promo Code</h2>
            </div>
            
            <Input
              placeholder="Enter code here"
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
              disabled={redeemPromoMutation.isPending || isApplyingPromo}
              className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl text-white placeholder:text-gray-500 px-4 py-3 h-12 text-center text-lg font-semibold tracking-wider focus:border-[#4cd3ff] focus:ring-0 mb-4"
            />
            
            <div className="flex gap-3">
              <Button
                onClick={() => {
                  setPromoPopupOpen(false);
                  setPromoCode("");
                }}
                className="flex-1 h-11 bg-[#1a1a1a] hover:bg-[#2a2a2a] text-white font-semibold rounded-xl border border-[#2a2a2a]"
              >
                Close
              </Button>
              <Button
                onClick={handleApplyPromo}
                disabled={redeemPromoMutation.isPending || isApplyingPromo || !promoCode.trim()}
                className="flex-1 h-11 bg-[#4cd3ff] hover:bg-[#6ddeff] text-black font-semibold rounded-xl disabled:opacity-50"
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
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 px-4">
          <div className="bg-[#0d0d0d] rounded-2xl p-6 w-full max-w-sm border border-[#1a1a1a]">
            <div className="flex items-center justify-center gap-2 mb-2">
              <RefreshCw className="w-5 h-5 text-[#4cd3ff]" />
              <h2 className="text-lg font-bold text-white">Convert PAD</h2>
            </div>
            <div className="flex items-center justify-center gap-1.5 mb-4">
              <DiamondIcon size={14} />
              <p className="text-gray-400 text-sm">
                {balancePAD.toLocaleString()} PAD
              </p>
            </div>
            
            <div className="space-y-2 mb-4">
              <button
                onClick={() => setSelectedConvertType('USD')}
                className={`w-full p-3 rounded-xl border transition-all flex items-center gap-3 ${
                  selectedConvertType === 'USD' 
                    ? 'border-[#4cd3ff] bg-[#4cd3ff]/10' 
                    : 'border-[#2a2a2a] bg-[#1a1a1a] hover:border-[#3a3a3a]'
                }`}
              >
                <div className="w-9 h-9 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center">
                  <span className="text-green-400 font-bold text-sm">$</span>
                </div>
                <div className="text-left flex-1">
                  <div className="flex items-center gap-1.5">
                    <DiamondIcon size={12} />
                    <span className="text-gray-400 text-xs">→</span>
                    <span className="text-green-400 font-bold text-xs">USD</span>
                  </div>
                  <p className="text-xs text-gray-500">Min: {(appSettings?.minimumConvertPAD || 10000).toLocaleString()} PAD</p>
                </div>
              </button>
              
              <button
                onClick={() => setSelectedConvertType('BUG')}
                className={`w-full p-3 rounded-xl border transition-all flex items-center gap-3 ${
                  selectedConvertType === 'BUG' 
                    ? 'border-[#4cd3ff] bg-[#4cd3ff]/10' 
                    : 'border-[#2a2a2a] bg-[#1a1a1a] hover:border-[#3a3a3a]'
                }`}
              >
                <div className="w-9 h-9 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center">
                  <Bug className="w-4 h-4 text-green-400" />
                </div>
                <div className="text-left flex-1">
                  <div className="flex items-center gap-1.5">
                    <DiamondIcon size={12} />
                    <span className="text-gray-400 text-xs">→</span>
                    <Bug className="w-3 h-3 text-green-400" />
                    <span className="text-green-400 font-bold text-xs">BUG</span>
                  </div>
                  <p className="text-xs text-gray-500">Min: {(appSettings?.minimumConvertPadToBug || 1000).toLocaleString()} PAD</p>
                </div>
              </button>
            </div>
            
            <div className="flex gap-3">
              <Button
                onClick={() => setConvertPopupOpen(false)}
                className="flex-1 h-11 bg-[#1a1a1a] hover:bg-[#2a2a2a] text-white font-semibold rounded-xl border border-[#2a2a2a]"
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
