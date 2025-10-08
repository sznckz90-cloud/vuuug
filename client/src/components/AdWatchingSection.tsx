import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { showNotification } from "@/components/AppNotification";

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
    },
    onError: (error) => {
      showNotification("⚠️ Failed to process ad reward", "error");
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
    if (isWatching) return;
    
    setIsWatching(true);
    
    try {
      if (typeof window.show_9368336 === 'function') {
        await window.show_9368336();
        // Simulate ad completion and reward user
        setTimeout(() => {
          watchAdMutation.mutate('rewarded');
        }, 1000);
      } else {
        // Fallback: simulate ad for development
        setTimeout(() => {
          watchAdMutation.mutate('rewarded');
          showNotification("✓ Ad completed!", "info");
        }, 2000);
      }
    } catch (error) {
      console.error('Ad watching failed:', error);
      // Still reward user for attempting
      watchAdMutation.mutate('rewarded');
      showNotification("✓ Ad completed!", "info");
    } finally {
      setTimeout(() => {
        setIsWatching(false);
      }, 2000);
    }
  };

  return (
    <div className="section-box mt-4 tap-glow">
      <div className="p-4">
        <div className="text-center mb-4">
          <h2 className="text-xl font-bold title-text mb-1">Watch & Earn</h2>
          <p className="text-muted-foreground text-sm">Earn 0.0002 TON per ad watched</p>
        </div>
        
        <div className="relative flex justify-center mb-4">
          <div className="absolute inset-0 rounded-full bg-secondary/30 animate-pulse-ring"></div>
          <button
            onClick={handleWatchAd}
            disabled={isWatching}
            className="relative gradient-button w-20 h-20 rounded-full shadow-xl transform hover:scale-105 transition-all duration-200 group disabled:opacity-50 flex items-center justify-center tap-glow"
            data-testid="button-watch-ad"
          >
            {isWatching ? (
              <i className="fas fa-spinner fa-spin text-2xl" style={{color: 'white'}}></i>
            ) : (
              <i className="fas fa-play text-xl text-white group-hover:scale-110 transition-transform"></i>
            )}
          </button>
        </div>
        
        <div className="text-center">
          <div className="text-muted-foreground text-sm mb-2">Ads watched today</div>
          <div className="text-2xl font-bold title-text" data-testid="text-ads-watched-today">
            {user?.adsWatchedToday || 0} / 160
          </div>
          <div className="text-muted-foreground text-sm mt-2">
            {160 - (user?.adsWatchedToday || 0)} ads remaining
          </div>
        </div>
      </div>
    </div>
  );
}
