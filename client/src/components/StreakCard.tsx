import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { showNotification } from "@/components/AppNotification";
import { Flame, Loader, Clock, CheckCircle2 } from "lucide-react";

declare global {
  interface Window {
    show_10013974: (type?: string | { type: string; inAppSettings: any }) => Promise<void>;
  }
}

interface StreakCardProps {
  user: any;
}

export default function StreakCard({ user }: StreakCardProps) {
  const queryClient = useQueryClient();
  const [isClaiming, setIsClaiming] = useState(false);
  const [timeUntilNextClaim, setTimeUntilNextClaim] = useState<string>("");
  const [hasClaimed, setHasClaimed] = useState(false);

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
      localStorage.setItem(`streak_claimed_${user?.id}`, new Date().toISOString());
      
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/earnings"] });
      
      const rewardAmount = parseFloat(data.rewardEarned || '0');
      if (rewardAmount > 0) {
        const earnedPAD = Math.round(rewardAmount);
        showNotification(` You've claimed +${earnedPAD} PAD from Faucetpay!`, "success");
      } else {
        showNotification(" You've claimed your Faucetpay reward!", "success");
      }
    },
    onError: (error: any) => {
      const notificationType = error.isAlreadyClaimed ? "info" : "error";
      showNotification(error.message || "Failed to claim streak", notificationType);
      if (error.isAlreadyClaimed) {
        setHasClaimed(true);
        if (user?.id) {
          localStorage.setItem(`streak_claimed_${user.id}`, new Date().toISOString());
        }
      }
    },
  });

  useEffect(() => {
    const updateTimer = () => {
      const now = new Date();
      
      // Check localStorage for claim status
      if (user?.id) {
        const claimedTimestamp = localStorage.getItem(`streak_claimed_${user.id}`);
        if (claimedTimestamp) {
          const claimedDate = new Date(claimedTimestamp);
          const nextClaimTime = new Date(claimedDate.getTime() + 5 * 60 * 1000); // Add 5 minutes
          
          // If we haven't reached the next claim time yet, keep claimed status
          if (now.getTime() < nextClaimTime.getTime()) {
            setHasClaimed(true);
            const diff = nextClaimTime.getTime() - now.getTime();
            const minutes = Math.floor(diff / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);
            setTimeUntilNextClaim(`${minutes}:${seconds.toString().padStart(2, '0')}`);
            return;
          } else {
            // Past the next claim time, allow claiming again
            setHasClaimed(false);
            localStorage.removeItem(`streak_claimed_${user.id}`);
          }
        }
      }
      
      // Check if user has claimed recently (within last 5 minutes)
      if (user?.lastStreakDate) {
        const lastClaim = new Date(user.lastStreakDate);
        const minutesSinceLastClaim = (now.getTime() - lastClaim.getTime()) / (1000 * 60);
        
        // If last claim was less than 5 minutes ago, show countdown
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
      
      // If not claimed recently or never claimed, show available
      setHasClaimed(false);
      setTimeUntilNextClaim("Available now");
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [user?.lastStreakDate, user?.id]);

  const handleClaimStreak = async () => {
    if (isClaiming || hasClaimed) return;
    
    setIsClaiming(true);
    
    try {
      // Show Rewarded Popup ad for streak claim
      if (typeof window.show_10013974 === 'function') {
        window.show_10013974('pop')
          .then(() => {
            // Ad completed - claim streak
            claimStreakMutation.mutate();
          })
          .catch(() => {
            // Ad error or closed - still allow claim
            claimStreakMutation.mutate();
          });
      } else {
        // Ad provider not available - claim anyway
        claimStreakMutation.mutate();
      }
    } catch (error) {
      console.error('Streak claim failed:', error);
      claimStreakMutation.mutate();
    } finally {
      setTimeout(() => setIsClaiming(false), 1000);
    }
  };

  const currentStreak = user?.currentStreak || 0;
  const canClaim = timeUntilNextClaim === "Available now" && !hasClaimed;

  return (
    <Card className="mb-2 minimal-card">
      <CardContent className="pt-2 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#4cd3ff]/20 to-[#4cd3ff]/10 border border-[#4cd3ff]/30 flex items-center justify-center">
              <Flame className="w-6 h-6 text-[#4cd3ff]" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">
                claim bonus
              </h3>
            </div>
          </div>
          <div>
            <Button
              onClick={handleClaimStreak}
              disabled={isClaiming || !canClaim}
              className="bg-[#4cd3ff] hover:bg-[#6ddeff] text-black font-semibold transition-colors disabled:opacity-70 disabled:cursor-not-allowed w-[120px]"
              size="sm"
            >
              {isClaiming ? (
                <div className="flex items-center justify-center gap-2">
                  <Loader className="w-4 h-4 animate-spin" />
                  <span>Claiming...</span>
                </div>
              ) : canClaim ? (
                <div className="flex items-center justify-center gap-2">
                  <Flame className="w-4 h-4" />
                  <span>Claim</span>
                </div>
              ) : (
                <div className="flex items-center justify-center">
                  <span className="text-sm font-mono tabular-nums">{timeUntilNextClaim}</span>
                </div>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
