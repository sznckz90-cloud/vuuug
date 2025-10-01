import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { formatCurrency } from "@/lib/utils";

declare global {
  interface Window {
    show_9368336: (type?: string | { type: string; inAppSettings: any }) => Promise<void>;
  }
}

interface StreakCardProps {
  user: any;
}

export default function StreakCard({ user }: StreakCardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isClaiming, setIsClaiming] = useState(false);

  const claimStreakMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/streak/claim");
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
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to claim streak reward. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleClaimStreak = async () => {
    if (isClaiming) return;
    
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
        
        <Button
          onClick={handleClaimStreak}
          disabled={isClaiming}
          className="w-full bg-secondary hover:bg-secondary/90 text-secondary-foreground py-2 rounded-lg font-semibold transition-colors text-sm"
          data-testid="button-claim-streak"
        >
          {isClaiming ? (
            <>
              <i className="fas fa-spinner fa-spin mr-2"></i>
              Loading Ad...
            </>
          ) : (
            'Claim Streak Reward'
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
