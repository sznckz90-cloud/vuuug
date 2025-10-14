import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { showNotification } from "@/components/AppNotification";
import { isUnauthorizedError } from "@/lib/authUtils";

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
  const [isWatching, setIsWatching] = useState(false);
  const [lastAdWatchTime, setLastAdWatchTime] = useState<number>(0);
  const [cooldownRemaining, setCooldownRemaining] = useState<number>(0);

  const watchAdMutation = useMutation({
    mutationFn: async (adType: string) => {
      const response = await apiRequest("POST", "/api/ads/watch", { adType });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/earnings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks/daily"] });
      
      // Set last ad watch time to enforce 30-second cooldown
      setLastAdWatchTime(Date.now());
      
      // Calculate PAD amount from response (convert TON to PAD)
      const padAmount = Math.round(parseFloat(data.earning?.amount || '0.00030000') * 100000);
      
      // Show reward notification with dynamic amount
      showNotification(`You received ${padAmount} PAD on your balance`, "success");
      
      // Start countdown AFTER reward is received (4 seconds)
      setCooldownRemaining(4);
      const cooldownInterval = setInterval(() => {
        setCooldownRemaining(prev => {
          if (prev <= 1) {
            clearInterval(cooldownInterval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    },
    onError: (error) => {
      showNotification("Failed to process ad reward", "error");
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
    if (isWatching || cooldownRemaining > 0) return;
    
    setIsWatching(true);
    
    try {
      if (typeof window.show_9368336 === 'function') {
        // Ad opens immediately
        await window.show_9368336();
        // Process reward after ad is shown
        watchAdMutation.mutate('rewarded');
      } else {
        // Fallback for testing
        watchAdMutation.mutate('rewarded');
      }
    } catch (error) {
      console.error('Ad watching failed:', error);
      watchAdMutation.mutate('rewarded');
    } finally {
      setIsWatching(false);
    }
  };

  return (
    <Card className="rounded-xl shadow-lg neon-glow-border mt-3">
      <CardContent className="p-3">
        <div className="text-center mb-2">
          <h2 className="text-base font-bold text-foreground mb-1">Viewing ads</h2>
          <p className="text-muted-foreground text-xs">Get PAD for watching commercials</p>
        </div>
        
        <div className="flex justify-center mb-2">
          <button
            onClick={handleWatchAd}
            disabled={isWatching || cooldownRemaining > 0}
            className="relative bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-2.5 rounded-lg shadow-lg transform hover:scale-105 transition-all duration-200 group disabled:opacity-50 flex items-center gap-2 min-w-[160px] justify-center"
            data-testid="button-watch-ad"
          >
            {cooldownRemaining > 0 ? (
              <>
                <i className="fas fa-clock text-sm"></i>
                <span className="text-sm font-semibold">{cooldownRemaining}s</span>
              </>
            ) : isWatching ? (
              <>
                <i className="fas fa-spinner fa-spin text-sm"></i>
                <span className="text-sm font-semibold">Loading...</span>
              </>
            ) : (
              <>
                <i className="fas fa-play text-sm group-hover:scale-110 transition-transform"></i>
                <span className="text-sm font-semibold">Start Watching</span>
              </>
            )}
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
