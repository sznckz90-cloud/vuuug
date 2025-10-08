import { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { showNotification } from "@/components/AppNotification";

declare global {
  interface Window {
    show_9368336: (type?: string | { type: string; inAppSettings: any }) => Promise<void>;
    Telegram?: {
      WebApp?: {
        openTelegramLink?: (url: string) => void;
      };
    };
  }
}

interface StreakCardProps {
  user: any;
}

export default function StreakCard({ user }: StreakCardProps) {
  const queryClient = useQueryClient();
  const [isClaiming, setIsClaiming] = useState(false);
  const [timeUntilNextClaim, setTimeUntilNextClaim] = useState<string>("");

  const { data: membershipData, refetch: refetchMembership } = useQuery({
    queryKey: ["/api/streak/check-membership"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/streak/check-membership");
      return response.json();
    },
    refetchInterval: 5000,
  });

  const isMember = membershipData?.isMember ?? false;

  const claimStreakMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/streak/claim");
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to claim streak');
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/earnings"] });
      
      if (parseFloat(data.rewardEarned) > 0) {
        if (data.isBonusDay) {
          showNotification("🎉 5-day streak bonus!", "success", parseFloat(data.rewardEarned));
        } else {
          showNotification("🔥 Daily streak claimed!", "success", parseFloat(data.rewardEarned));
        }
      }
    },
    onError: (error: any) => {
      if (error.message?.includes('channel')) {
        showNotification("⚠️ Channel membership required", "error");
        refetchMembership();
      } else if (error.message?.includes('already claimed')) {
        showNotification("⚠️ Already claimed today", "error");
      } else {
        showNotification("⚠️ Failed to claim streak", "error");
      }
    },
  });

  useEffect(() => {
    const updateTimer = () => {
      const now = new Date();
      
      // Check if user has claimed today (same UTC date)
      if (user?.lastStreakDate) {
        const lastClaim = new Date(user.lastStreakDate);
        const lastClaimUTCDate = new Date(Date.UTC(
          lastClaim.getUTCFullYear(),
          lastClaim.getUTCMonth(),
          lastClaim.getUTCDate()
        ));
        const todayUTCDate = new Date(Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate()
        ));
        
        // If already claimed today, calculate time until next UTC 00:00
        if (lastClaimUTCDate.getTime() === todayUTCDate.getTime()) {
          const nextMidnight = new Date(Date.UTC(
            now.getUTCFullYear(),
            now.getUTCMonth(),
            now.getUTCDate() + 1
          ));
          const diff = nextMidnight.getTime() - now.getTime();

          const hours = Math.floor(diff / (1000 * 60 * 60));
          const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
          const seconds = Math.floor((diff % (1000 * 60)) / 1000);

          setTimeUntilNextClaim(
            `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
          );
          return;
        }
      }
      
      // If not claimed today or never claimed, show available
      setTimeUntilNextClaim("Available now");
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [user?.lastStreakDate]);

  const handleJoinChannel = () => {
    if (window.Telegram?.WebApp?.openTelegramLink) {
      window.Telegram.WebApp.openTelegramLink('https://t.me/PaidAdsNews');
    } else {
      window.open('https://t.me/PaidAdsNews', '_blank');
    }
    
    setTimeout(() => {
      refetchMembership();
    }, 1000);
  };

  const handleClaimStreak = async () => {
    if (isClaiming) return;
    
    if (!isMember) {
      showNotification("⚠️ Join channel first", "error");
      return;
    }
    
    setIsClaiming(true);
    
    // Immediately set countdown to disable button until next UTC midnight
    const now = new Date();
    const nextMidnight = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + 1
    ));
    const diff = nextMidnight.getTime() - now.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    setTimeUntilNextClaim(
      `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    );
    
    try {
      if (typeof window.show_9368336 === 'function') {
        await window.show_9368336();
        setTimeout(() => {
          claimStreakMutation.mutate();
        }, 1000);
      } else {
        setTimeout(() => {
          claimStreakMutation.mutate();
          showNotification("✓ Ad completed!", "info");
        }, 2000);
      }
    } catch (error) {
      console.error('Ad watching failed:', error);
      claimStreakMutation.mutate();
    } finally {
      setTimeout(() => {
        setIsClaiming(false);
      }, 2000);
    }
  };

  const currentStreak = user?.currentStreak || 0;
  const daysUntilBonus = 5 - (currentStreak % 5);
  const streakProgress = ((currentStreak % 5) / 5) * 100;
  const canClaim = timeUntilNextClaim === "Available now";

  return (
    <div className="section-box mt-4 tap-glow">
      <div className="p-4">
        <div className="text-center mb-4">
          <h2 className="text-xl font-bold title-text mb-1 flex items-center justify-center">
            <i className="fas fa-fire icon-gradient mr-2 text-2xl"></i>
            Daily Streak Rewards
          </h2>
          <p className="text-muted-foreground text-sm">
            Earn 0.0001 TON daily • 0.0015 TON bonus on 5th day
          </p>
        </div>
        
        <div className="flex justify-between items-center mb-3">
          <span className="text-muted-foreground text-sm">Current streak</span>
          <span className="text-xl font-bold title-text" data-testid="text-current-streak">
            {currentStreak} days
          </span>
        </div>
        
        <div className="bg-muted rounded-full h-3 mb-4 overflow-hidden">
          <div 
            className="h-full rounded-full transition-all duration-500" 
            style={{ 
              width: `${streakProgress}%`,
              background: 'linear-gradient(135deg, #1976D2, #6A1B9A, #C2185B)'
            }}
          ></div>
        </div>
        
        {!isMember ? (
          <div className="mb-3 p-3 bg-orange-950/50 border border-orange-800 rounded-lg">
            <p className="text-sm font-medium text-orange-200 mb-2">
              ⚠️ Channel membership required!
            </p>
            <p className="text-xs text-orange-300 mb-3">
              You must join our channel to claim daily rewards.
            </p>
            <button
              onClick={handleJoinChannel}
              className="w-full bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-lg font-semibold transition-colors text-sm tap-glow"
            >
              <i className="fas fa-telegram mr-2"></i>
              Join Channel
            </button>
          </div>
        ) : (
          <button
            onClick={handleClaimStreak}
            disabled={isClaiming || !canClaim}
            className="w-full gradient-button py-3 rounded-lg font-bold transition-colors text-base disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center tap-glow"
            data-testid="button-claim-streak"
          >
            {isClaiming ? (
              <>
                <i className="fas fa-spinner fa-spin mr-2"></i>
                Watching Ad...
              </>
            ) : canClaim ? (
              <span className="flex items-center">
                <i className="fas fa-fire mr-2"></i>
                Claim Streak
              </span>
            ) : (
              <span className="text-sm font-normal opacity-80">
                Next claim in: {timeUntilNextClaim} UTC
              </span>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
