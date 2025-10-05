import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

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
  const { toast } = useToast();
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
        const event = new CustomEvent('showReward', { 
          detail: { amount: parseFloat(data.rewardEarned) } 
        });
        window.dispatchEvent(event);
        
        if (data.isBonusDay) {
          toast({
            title: "🎉 Congratulations!",
            description: `You completed a 5-day streak! You received ${data.rewardEarned} TON bonus!`,
          });
        } else {
          toast({
            title: "✅ Daily Streak Claimed!",
            description: `You earned ${data.rewardEarned} TON for your daily streak claim!`,
          });
        }
      }
    },
    onError: (error: any) => {
      if (error.message?.includes('channel')) {
        toast({
          title: "Channel Membership Required",
          description: "Please join our channel to claim daily rewards.",
          variant: "destructive",
        });
        refetchMembership();
      } else if (error.message?.includes('already claimed')) {
        toast({
          title: "Already Claimed",
          description: "You have already claimed your daily reward. Come back in 24 hours!",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: error.message || "Failed to claim streak reward. Please try again.",
          variant: "destructive",
        });
      }
    },
  });

  useEffect(() => {
    const updateTimer = () => {
      if (!user?.lastStreakDate) {
        setTimeUntilNextClaim("Available now");
        return;
      }

      const lastClaim = new Date(user.lastStreakDate);
      const nextClaim = new Date(lastClaim.getTime() + 24 * 60 * 60 * 1000);
      const now = new Date();
      const diff = nextClaim.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeUntilNextClaim("Available now");
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeUntilNextClaim(
        `${hours.toString().padStart(2, '0')}h ${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`
      );
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
      toast({
        title: "Channel Membership Required",
        description: "Please join our channel first to claim rewards.",
        variant: "destructive",
      });
      return;
    }
    
    setIsClaiming(true);
    
    try {
      if (typeof window.show_9368336 === 'function') {
        await window.show_9368336();
        setTimeout(() => {
          claimStreakMutation.mutate();
        }, 1000);
      } else {
        setTimeout(() => {
          claimStreakMutation.mutate();
          toast({
            title: "Ad Completed!",
            description: "Processing your daily streak reward...",
          });
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
    <Card className="rounded-xl shadow-sm border border-border mt-3">
      <CardContent className="p-3">
        <div className="text-center mb-3">
          <h2 className="text-lg font-bold text-foreground mb-1 flex items-center justify-center">
            <i className="fas fa-fire text-secondary mr-2"></i>
            Daily Streak Rewards
          </h2>
          <p className="text-muted-foreground text-xs">
            Earn 0.0001 TON daily • 0.0015 TON bonus on 5th day
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
              ⚠️ Channel membership required!
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
            className="w-full bg-secondary hover:bg-secondary/90 text-secondary-foreground py-2.5 rounded-lg font-semibold transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed mb-3"
            data-testid="button-claim-streak"
          >
            {isClaiming ? (
              <>
                <i className="fas fa-spinner fa-spin mr-2"></i>
                Watching Ad...
              </>
            ) : (
              <>
                <i className="fas fa-play-circle mr-2"></i>
                Watch Ad + Claim Reward
              </>
            )}
          </Button>
        )}
        
        <div className="text-center text-xs text-muted-foreground">
          <i className="fas fa-clock mr-1"></i>
          Next claim in: <span className="font-semibold">{timeUntilNextClaim}</span> (UTC)
        </div>
      </CardContent>
    </Card>
  );
}
