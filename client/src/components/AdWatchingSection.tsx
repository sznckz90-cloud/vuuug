import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { showNotification } from "@/components/AppNotification";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Play, Clock } from "lucide-react";

declare global {
  interface Window {
    show_9368336: (type?: string | { type: string; inAppSettings: any }) => Promise<void>;
  }
}

interface AdWatchingSectionProps {
  user: any;
}

export default function AdWatchingSection({ user }: AdWatchingSectionProps) {
  const queryClient = useQueryClient();
  const [lastAdWatchTime, setLastAdWatchTime] = useState<number>(0);
  const [cooldownRemaining, setCooldownRemaining] = useState<number>(0);

  const watchAdMutation = useMutation({
    mutationFn: async (adType: string) => {
      const response = await apiRequest("POST", "/api/ads/watch", { adType });
      if (!response.ok) {
        const error = await response.json();
        throw { status: response.status, ...error };
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/earnings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks/daily"] });
      
      // Set last ad watch time to enforce 30-second cooldown
      setLastAdWatchTime(Date.now());
      
      // Get PAD amount from response
      const rewardPAD = data.rewardPAD || 1000;
      
      // ✅ Show reward notification instantly - no countdown
      showNotification(`You received ${rewardPAD} PAD on your balance`, "success");
      
      // Reset cooldown immediately (no delay)
      setCooldownRemaining(0);
    },
    onError: (error: any) => {
      // Handle daily limit error (429)
      if (error.status === 429) {
        showNotification("Daily limit reached", "error");
      } else {
        showNotification("Failed to process ad reward", "error");
      }
      setCooldownRemaining(0);
    },
  });

  // Initialize auto-popup ads with 30-second cooldown
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    const startAutoAds = () => {
      interval = setInterval(() => {
        // Check if 30 seconds have passed since last ad
        if (Date.now() - lastAdWatchTime < 30000) {
          return; // Block early popup
        }
        
        if (typeof window.show_9368336 === 'function') {
          try {
            window.show_9368336();
          } catch (error) {
            console.log('Auto ad display:', error);
          }
        }
      }, 30000); // Check every 30 seconds
    };
    
    // Start after initial delay
    const timer = setTimeout(startAutoAds, 30000);
    
    return () => {
      clearTimeout(timer);
      if (interval) clearInterval(interval);
    };
  }, [lastAdWatchTime]);

  const handleWatchAd = async () => {
    if (cooldownRemaining > 0) return;
    
    let retryAttempted = false;
    
    const attemptAdDisplay = async (): Promise<boolean> => {
      try {
        if (typeof window.show_9368336 === 'function') {
          await window.show_9368336();
          return true;
        } else {
          return true;
        }
      } catch (error) {
        console.error('Ad display attempt failed:', error);
        return false;
      }
    };
    
    try {
      let adSuccess = await attemptAdDisplay();
      
      if (!adSuccess && !retryAttempted) {
        console.log('First ad attempt failed, retrying...');
        retryAttempted = true;
        adSuccess = await attemptAdDisplay();
      }
      
      if (adSuccess) {
        watchAdMutation.mutate('rewarded');
      } else {
        showNotification("Ad failed, please try again.", "error");
      }
    } catch (error) {
      console.error('Ad watching failed:', error);
      showNotification("Ad failed, please try again.", "error");
    }
  };

  // Get ads watched today from user data
  const adsWatchedToday = user?.adsWatchedToday || 0;
  const dailyLimit = 50;

  return (
    <Card className="rounded-2xl frosted-glass diamond-glow">
      <CardContent className="p-3">
        <div className="text-center mb-2">
          <h2 className="text-base font-bold text-primary mb-1">Viewing ads</h2>
          <p className="text-muted-foreground text-xs">Get PAD for watching commercials</p>
        </div>
        
        <div className="flex justify-center mb-2">
          <button
            onClick={handleWatchAd}
            disabled={cooldownRemaining > 0}
            className="relative bg-gradient-to-r from-secondary to-primary hover:from-secondary/90 hover:to-primary/90 text-white px-6 py-2.5 rounded-2xl shadow-[0_0_20px_rgba(34,211,238,0.5),0_0_30px_rgba(168,85,247,0.3)] transform transition-all duration-200 active:scale-[0.97] group disabled:opacity-50 flex items-center gap-2 min-w-[160px] justify-center font-semibold"
            data-testid="button-watch-ad"
          >
            <Play size={16} className="group-hover:scale-110 transition-transform" />
            <span className="text-sm font-semibold">Start Watching</span>
          </button>
        </div>
        
        {/* Watched counter */}
        <div className="text-center">
          <p className="text-xs text-muted-foreground">Watched: {adsWatchedToday}/{dailyLimit}</p>
        </div>
      </CardContent>
    </Card>
  );
}
