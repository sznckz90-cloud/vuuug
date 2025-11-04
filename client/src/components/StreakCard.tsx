import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { showNotification } from "@/components/AppNotification";
import { Flame, Loader, Clock, CheckCircle2 } from "lucide-react";
import { tonToPAD } from "@shared/constants";

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
        const earnedPAD = tonToPAD(data.rewardEarned);
        const message = data.isBonusDay 
          ? ` 5-day streak bonus! You've claimed today's streak reward! +${earnedPAD} PAD`
          : ` You've claimed today's streak reward! +${earnedPAD} PAD`;
        showNotification(message, "success");
      } else {
        showNotification(" You've claimed today's streak reward!", "success");
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
          
          // Calculate the next noon boundary AFTER the claim time
          const nextNoonAfterClaim = new Date(Date.UTC(
            claimedDate.getUTCFullYear(),
            claimedDate.getUTCMonth(),
            claimedDate.getUTCDate(),
            12, 0, 0, 0
          ));
          
          // If claim was before noon on that day, next reset is same day at noon
          // Otherwise, next reset is tomorrow at noon
          if (claimedDate.getUTCHours() < 12) {
            // Claimed before noon - next reset is today at noon
            // Already set correctly
          } else {
            // Claimed after noon - next reset is tomorrow at noon
            nextNoonAfterClaim.setUTCDate(nextNoonAfterClaim.getUTCDate() + 1);
          }
          
          // If we haven't reached the next reset yet, keep claimed status
          if (now.getTime() < nextNoonAfterClaim.getTime()) {
            setHasClaimed(true);
          } else {
            // Past the next reset, allow claiming again
            setHasClaimed(false);
            localStorage.removeItem(`streak_claimed_${user.id}`);
          }
        }
      }
      
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
          setHasClaimed(true);
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
  }, [user?.lastStreakDate, user?.id]);

  const handleClaimStreak = async () => {
    if (isClaiming || hasClaimed) return;
    
    setIsClaiming(true);
    
    try {
      claimStreakMutation.mutate();
    } catch (error) {
      console.error('Streak claim failed:', error);
    } finally {
      setTimeout(() => setIsClaiming(false), 1000);
    }
  };

  const currentStreak = user?.currentStreak || 0;
  const canClaim = timeUntilNextClaim === "Available now" && !hasClaimed;

  return (
    <Card className="mb-3 minimal-card">
      <CardContent className="pt-3 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#4cd3ff]/20 to-[#4cd3ff]/10 border border-[#4cd3ff]/30 flex items-center justify-center">
              <Flame className="w-6 h-6 text-[#4cd3ff]" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white flex items-center gap-1">
                Daily Streak
                <span className="text-xs text-[#4cd3ff] font-bold">Day {currentStreak}</span>
              </h3>
              <p className="text-xs text-muted-foreground">
                {hasClaimed ? "Claimed today!" : canClaim ? "Claim your reward!" : "Next claim in"}
              </p>
            </div>
          </div>
          <div>
            {hasClaimed ? (
              <div className="bg-green-600/20 border border-green-500/30 text-green-400 px-6 py-2 rounded-md flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                <span className="text-sm font-semibold">Claimed</span>
              </div>
            ) : (
              <Button
                onClick={handleClaimStreak}
                disabled={isClaiming || !canClaim}
                className="bg-[#4cd3ff] hover:bg-[#6ddeff] text-black font-semibold transition-colors disabled:opacity-70 disabled:cursor-not-allowed px-6"
                size="sm"
              >
                {isClaiming ? (
                  <div className="flex items-center gap-2">
                    <Loader className="w-4 h-4 animate-spin" />
                    <span>Claiming...</span>
                  </div>
                ) : canClaim ? (
                  <div className="flex items-center gap-2">
                    <Flame className="w-4 h-4" />
                    <span>Claim</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    <span className="text-sm font-mono">{timeUntilNextClaim}</span>
                  </div>
                )}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
