import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { showNotification } from "@/components/AppNotification";
import { Flame, Loader, Send } from "lucide-react";

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
      
      // Check if user has claimed today (after UTC 12:00 PM)
      if (user?.lastStreakDate) {
        const lastClaim = new Date(user.lastStreakDate);
        
        // Get today's UTC 12:00 PM
        const todayNoon = new Date(Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate(),
          12, 0, 0, 0
        ));
        
        // If last claim was after today's noon, calculate time until tomorrow's noon
        if (lastClaim.getTime() >= todayNoon.getTime()) {
          const nextNoon = new Date(Date.UTC(
            now.getUTCFullYear(),
            now.getUTCMonth(),
            now.getUTCDate() + 1,
            12, 0, 0, 0
          ));
          const diff = nextNoon.getTime() - now.getTime();

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
    
    setIsClaiming(true);
    
    // Immediately set countdown to disable button until next UTC 12:00 PM
    const now = new Date();
    const nextNoon = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + 1,
      12, 0, 0, 0
    ));
    const diff = nextNoon.getTime() - now.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    setTimeUntilNextClaim(
      `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    );
    
    try {
      if (typeof window.show_9368336 === 'function') {
        await window.show_9368336();
        claimStreakMutation.mutate();
        // Mark dialog as shown for today after claiming
        const today = new Date().toISOString().split('T')[0];
        localStorage.setItem('streakDialogShown', today);
      } else {
        claimStreakMutation.mutate();
        // Mark dialog as shown for today after claiming
        const today = new Date().toISOString().split('T')[0];
        localStorage.setItem('streakDialogShown', today);
      }
    } catch (error) {
      console.error('Ad watching failed:', error);
      showNotification("Failed to claim streak", "error");
    } finally {
      setIsClaiming(false);
    }
  };

  const currentStreak = user?.currentStreak || 0;
  const daysUntilBonus = 5 - (currentStreak % 5);
  const streakProgress = ((currentStreak % 5) / 5) * 100;
  const canClaim = timeUntilNextClaim === "Available now";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="sm:max-w-md frosted-glass border border-white/10 rounded-2xl"
        onInteractOutside={(e) => e.preventDefault()}
        hideCloseButton={true}
      >
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-[#4cd3ff] mb-1 flex items-center justify-center">
            <Flame className="text-[#4cd3ff] mr-2" size={20} />
            Daily Streak Rewards
          </DialogTitle>
          <DialogDescription className="sr-only">
            Claim your daily streak rewards and maintain your earning streak
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          
          <div className="p-4 bg-[#0d0d0d] rounded-lg border border-[#4cd3ff]/20 text-center">
            <div className="text-xs text-muted-foreground mb-2">Current Streak</div>
            <div className="text-6xl font-bold text-[#4cd3ff]">
              {currentStreak}
            </div>
          </div>
          
          {!isMember ? (
            <>
              <div className="p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                <p className="text-sm font-medium text-orange-500 mb-2">
                  Channel membership required!
                </p>
                <p className="text-xs text-orange-400 mb-3">
                  You must join our channel to claim daily rewards.
                </p>
                <Button
                  onClick={handleJoinChannel}
                  className="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-semibold transition-colors text-sm"
                >
                  <Send className="mr-2" size={16} />
                  Join Channel
                </Button>
              </div>
              
              <Button
                onClick={() => onOpenChange?.(false)}
                variant="outline"
                className="w-full border-white/20 hover:bg-white/10 text-white"
              >
                Close
              </Button>
            </>
          ) : (
            <>
              <Button
                onClick={handleClaimStreak}
                disabled={isClaiming || !canClaim}
                className="w-full bg-[#4cd3ff] hover:bg-[#6ddeff] text-black py-3 rounded-lg font-semibold transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                data-testid="button-claim-streak"
              >
                {isClaiming ? (
                  <div className="flex items-center justify-center">
                    <Loader className="mr-2 animate-spin" size={16} />
                    <span>Watching Ad...</span>
                  </div>
                ) : canClaim ? (
                  <div className="flex items-center justify-center">
                    <Flame className="mr-2" size={16} />
                    <span>Claim Streak</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center">
                    <span className="text-lg font-bold tracking-wider">{timeUntilNextClaim}</span>
                  </div>
                )}
              </Button>
              
              <Button
                onClick={() => onOpenChange?.(false)}
                variant="outline"
                className="w-full border-white/20 hover:bg-white/10 text-white"
              >
                Close
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
