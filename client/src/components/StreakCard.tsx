import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { showNotification } from "@/components/AppNotification";
import { Flame, Loader, Clock } from "lucide-react";
import { tonToPAD } from "@shared/constants";

interface StreakCardProps {
  user: any;
}

export default function StreakCard({ user }: StreakCardProps) {
  const queryClient = useQueryClient();
  const [isClaiming, setIsClaiming] = useState(false);
  const [timeUntilNextClaim, setTimeUntilNextClaim] = useState<string>("");

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
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/earnings"] });
      
      const rewardAmount = parseFloat(data.rewardEarned || '0');
      if (rewardAmount > 0) {
        const earnedPAD = tonToPAD(data.rewardEarned);
        const message = data.isBonusDay 
          ? `🔥 5-day streak bonus! You've claimed today's streak reward! +${earnedPAD} PAD`
          : `✅ You've claimed today's streak reward! +${earnedPAD} PAD`;
        showNotification(message, "success");
      } else {
        showNotification("✅ You've claimed today's streak reward!", "success");
      }
    },
    onError: (error: any) => {
      const notificationType = error.isAlreadyClaimed ? "info" : "error";
      showNotification(error.message || "Failed to claim streak", notificationType);
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

  const handleClaimStreak = async () => {
    if (isClaiming) return;
    
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
  const canClaim = timeUntilNextClaim === "Available now";

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
                {canClaim ? "Claim your reward!" : "Next claim in"}
              </p>
            </div>
          </div>
          <div>
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
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
