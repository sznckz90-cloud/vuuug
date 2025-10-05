import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { formatCurrency } from "@/lib/utils";

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

  // Check channel membership
  const { data: membershipData, refetch: refetchMembership } = useQuery({
    queryKey: ["/api/streak/check-membership"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/streak/check-membership");
      return response.json();
    },
    refetchInterval: 30000, // Recheck every 30 seconds
  });

  const isMember = membershipData?.isMember ?? false; // Default to false until verified

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
        // Show reward notification
        const event = new CustomEvent('showReward', { 
          detail: { amount: parseFloat(data.rewardEarned) } 
        });
        window.dispatchEvent(event);
      }
      
      toast({
        title: "Streak Updated!",
        description: `Your streak is now ${data.newStreak} days`,
      });
    },
    onError: (error: any) => {
      if (error.message?.includes('channel')) {
        toast({
          title: "Channel Membership Required",
          description: "Please join our channel to claim daily rewards.",
          variant: "destructive",
        });
        refetchMembership();
      } else {
        toast({
          title: "Error",
          description: "Failed to claim streak reward. Please try again.",
          variant: "destructive",
        });
      }
    },
  });

  // Calculate time until next claim (24 hours from last claim)
  useEffect(() => {
    const updateTimer = () => {
      if (!user?.lastStreakClaim) {
        setTimeUntilNextClaim("Available now");
        return;
      }

      const lastClaim = new Date(user.lastStreakClaim);
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
        `${hours.toString().padStart(2, '0')}h:${minutes.toString().padStart(2, '0')}m:${seconds.toString().padStart(2, '0')}s`
      );
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [user?.lastStreakClaim]);

  const handleJoinChannel = () => {
    // Use Telegram WebApp API to open channel
    if (window.Telegram?.WebApp?.openTelegramLink) {
      window.Telegram.WebApp.openTelegramLink('https://t.me/PaidAdsNews');
    } else {
      // Fallback: open in new tab
      window.open('https://t.me/PaidAdsNews', '_blank');
    }
    
    // Recheck membership after a short delay
    setTimeout(() => {
      refetchMembership();
    }, 2000);
  };

  const handleClaimStreak = async () => {
    if (isClaiming) return;
    
    // Check membership again before claim
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
        try {
          await window.show_9368336('pop');
        } catch (adError) {
          console.log('Ad display failed, but proceeding with streak claim:', adError);
        }
      } else {
        console.log('Ad SDK not loaded, proceeding with streak claim anyway');
      }
      
      // Always process streak claim regardless of ad success/failure
      claimStreakMutation.mutate();
    } catch (error) {
      console.error('Streak claim failed:', error);
      toast({
        title: "Error",
        description: "Failed to claim streak. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsClaiming(false);
    }
  };

  const currentStreak = user?.currentStreak || 0;
  const streakProgress = Math.min((currentStreak % 5) / 5 * 100, 100);
  const canClaim = timeUntilNextClaim === "Available now";

  return (
    <Card className="rounded-xl shadow-sm border border-border mt-3">
      <CardContent className="p-3">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-base font-semibold text-foreground">Daily Streak</h3>
          <div className="text-secondary text-xl streak-fire">
            <i className="fas fa-fire"></i>
          </div>
        </div>
        
        <div className="flex justify-between items-center mb-2">
          <span className="text-muted-foreground text-sm">Current streak</span>
          <span className="text-lg font-bold text-foreground" data-testid="text-current-streak">
            {currentStreak} days
          </span>
        </div>
        
        <div className="bg-muted rounded-full h-1.5 mb-3 overflow-hidden">
          <div 
            className="bg-gradient-to-r from-primary to-secondary h-full rounded-full transition-all duration-500" 
            style={{ width: `${streakProgress}%` }}
          ></div>
        </div>
        
        <div className="flex justify-between text-xs text-muted-foreground mb-4">
          <span>0 days</span>
          <span>5 days bonus</span>
        </div>
        
        {!isMember && (
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
        )}
        
        <Button
          onClick={handleClaimStreak}
          disabled={isClaiming || !isMember || !canClaim}
          className="w-full bg-secondary hover:bg-secondary/90 text-secondary-foreground py-2 rounded-lg font-semibold transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          data-testid="button-claim-streak"
        >
          {isClaiming ? (
            <>
              <i className="fas fa-spinner fa-spin mr-2"></i>
              Loading Ad...
            </>
          ) : (
            <>
              <i className="fas fa-gift mr-2"></i>
              Claim Daily Reward
            </>
          )}
        </Button>
        
        {timeUntilNextClaim && (
          <div className="mt-3 text-center text-xs text-muted-foreground">
            <i className="fas fa-clock mr-1"></i>
            Next claim in: <span className="font-semibold">{timeUntilNextClaim}</span> (UTC)
          </div>
        )}
      </CardContent>
    </Card>
  );
}
