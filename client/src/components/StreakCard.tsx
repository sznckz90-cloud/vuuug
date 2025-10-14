import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
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
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export default function StreakCard({ user, open = false, onOpenChange }: StreakCardProps) {
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
          showNotification("5-day streak bonus!", "success", parseFloat(data.rewardEarned));
        } else {
          showNotification("Daily streak claimed!", "success", parseFloat(data.rewardEarned));
        }
      }
    },
    onError: (error: any) => {
      if (error.message?.includes('channel')) {
        showNotification("Channel membership required", "error");
        refetchMembership();
      } else if (error.message?.includes('already claimed')) {
        showNotification("Already claimed today", "error");
      } else {
        showNotification("Failed to claim streak", "error");
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
      showNotification("Join channel first", "error");
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
          // Mark dialog as shown for today after claiming
          const today = new Date().toISOString().split('T')[0];
          localStorage.setItem('streakDialogShown', today);
          // Close dialog after claiming
          onOpenChange?.(false);
        }, 1000);
      } else {
        setTimeout(() => {
          claimStreakMutation.mutate();
          showNotification("✓ Ad completed!", "info");
          // Mark dialog as shown for today after claiming
          const today = new Date().toISOString().split('T')[0];
          localStorage.setItem('streakDialogShown', today);
          // Close dialog after claiming
          onOpenChange?.(false);
        }, 2000);
      }
    } catch (error) {
      console.error('Ad watching failed:', error);
      claimStreakMutation.mutate();
      // Mark dialog as shown for today after claiming
      const today = new Date().toISOString().split('T')[0];
      localStorage.setItem('streakDialogShown', today);
      // Close dialog after claiming
      onOpenChange?.(false);
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <Card className="rounded-xl shadow-lg neon-glow-border border-0">
          <CardContent className="p-4">
            <div className="text-center mb-3">
              <h2 className="text-xl font-bold text-foreground mb-1 flex items-center justify-center">
                <i className="fas fa-fire text-secondary mr-2"></i>
                Daily Streak Rewards
              </h2>
              <p className="text-muted-foreground text-sm">
                Earn 10 PAD daily • 150 PAD bonus on 5th day
              </p>
            </div>
            
            <div className="flex justify-between items-center mb-2">
              <span className="text-muted-foreground text-sm">Current streak</span>
              <span className="text-lg font-bold text-foreground" data-testid="text-current-streak">
                {currentStreak} days
              </span>
            </div>
            
            <div className="bg-muted rounded-full h-2 mb-4 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-primary to-secondary h-full rounded-full transition-all duration-500" 
                style={{ width: `${streakProgress}%` }}
              ></div>
            </div>
            
            {!isMember ? (
              <div className="mb-3 p-3 bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800 rounded-lg">
                <p className="text-sm font-medium text-orange-800 dark:text-orange-200 mb-2">
                  Channel membership required!
                </p>
                <p className="text-xs text-orange-700 dark:text-orange-300 mb-3">
                  You must join our channel to claim daily rewards.
                </p>
                <Button
                  onClick={handleJoinChannel}
                  className="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-semibold transition-colors text-sm"
                >
                  <i className="fas fa-telegram mr-2"></i>
                  Join Channel
                </Button>
              </div>
            ) : (
              <Button
                onClick={handleClaimStreak}
                disabled={isClaiming || !canClaim}
                className="w-full bg-secondary hover:bg-secondary/90 text-secondary-foreground py-3 rounded-lg font-semibold transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center"
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
                  <span className="text-xs font-normal opacity-80">
                    Next claim in: {timeUntilNextClaim} UTC
                  </span>
                )}
              </Button>
            )}
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  );
}
