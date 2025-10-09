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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/earnings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks/daily"] });
      
      // Set last ad watch time to enforce 30-second cooldown
      setLastAdWatchTime(Date.now());
      
      // Show reward notification
      showNotification("🎉 Reward added!", "success", 0.0002);
      
      // Start countdown AFTER reward is received
      setCooldownRemaining(3);
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
      showNotification("⚠️ Failed to process ad reward", "error");
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
        await window.show_9368336();
        setTimeout(() => {
          watchAdMutation.mutate('rewarded');
        }, 1000);
      } else {
        setTimeout(() => {
          watchAdMutation.mutate('rewarded');
          showNotification("✓ Ad completed!", "info");
        }, 2000);
      }
    } catch (error) {
      console.error('Ad watching failed:', error);
      watchAdMutation.mutate('rewarded');
      showNotification("✓ Ad completed!", "info");
    } finally {
      setTimeout(() => {
        setIsWatching(false);
      }, 2000);
    }
  };

  return (
    <Card className="rounded-xl shadow-lg neon-glow-border mt-3">
      <CardContent className="p-3">
        <div className="text-center mb-3">
          <h2 className="text-lg font-bold text-foreground mb-1">Watch & Earn</h2>
          <p className="text-muted-foreground text-xs">Earn 0.0002 TON per ad watched</p>
        </div>
        
        <div className="relative flex justify-center mb-3">
          <div className="absolute inset-0 rounded-full bg-primary/20 animate-pulse-ring"></div>
          <button
            onClick={handleWatchAd}
            disabled={isWatching || cooldownRemaining > 0}
            className="relative bg-primary hover:bg-primary/90 text-primary-foreground w-16 h-16 rounded-full shadow-lg transform hover:scale-105 transition-all duration-200 group disabled:opacity-50 flex items-center justify-center"
            data-testid="button-watch-ad"
          >
            {cooldownRemaining > 0 ? (
              <span className="text-lg font-bold text-white">{cooldownRemaining}</span>
            ) : isWatching ? (
              <i className="fas fa-spinner fa-spin text-lg" style={{color: 'white'}}></i>
            ) : (
              <i className="fas fa-play text-lg text-white group-hover:scale-110 transition-transform"></i>
            )}
          </button>
        </div>
        
        <div className="text-center">
          <div className="text-muted-foreground text-xs mb-1">Ads watched today</div>
          <div className="text-xl font-bold text-foreground" data-testid="text-ads-watched-today">
            {user?.adsWatchedToday || 0} / 160
          </div>
          <div className="text-muted-foreground text-xs mt-1">
            {160 - (user?.adsWatchedToday || 0)} ads remaining
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
