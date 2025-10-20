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
      console.error('❌ Ad reward processing error:', error);
      
      // Handle different error types
      if (error.status === 429) {
        showNotification("Daily ad limit reached (50 ads/day)", "error");
      } else if (error.status === 401 || error.status === 403) {
        showNotification("Authentication error. Please refresh the page.", "error");
      } else if (error.message) {
        showNotification(`Error: ${error.message}`, "error");
      } else {
        showNotification("Network error. Check your connection and try again.", "error");
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
    
    try {
      // ✅ FIX: Display ad and credit reward immediately after completion (no retry delay)
      if (typeof window.show_9368336 === 'function') {
        console.log('📺 Starting ad display...');
        await window.show_9368336();
        console.log('✅ Ad display completed');
      } else {
        console.log('⚠️ Ad provider not available, crediting reward anyway');
      }
      
      // ✅ FIX: Credit reward instantly after ad closes (no delay)
      console.log('💰 Crediting ad reward immediately...');
      watchAdMutation.mutate('rewarded');
      
    } catch (error) {
      console.error('❌ Ad display error:', error);
      showNotification("Ad display failed. Please try again.", "error");
    }
  };

  // Get ads watched today from user data
  const adsWatchedToday = user?.adsWatchedToday || 0;
  const dailyLimit = 50;

  return (
    <Card className="rounded-2xl minimal-card mb-3">
      <CardContent className="p-4">
        <div className="text-center mb-3">
          <h2 className="text-base font-bold text-white mb-1">Viewing ads</h2>
          <p className="text-[#AAAAAA] text-xs">Get PAD for watching commercials</p>
        </div>
        
        <div className="flex justify-center mb-3">
          <button
            onClick={handleWatchAd}
            disabled={cooldownRemaining > 0 || watchAdMutation.isPending}
            className="btn-primary px-6 py-3 flex items-center gap-2 min-w-[160px] justify-center text-base"
            data-testid="button-watch-ad"
          >
            {watchAdMutation.isPending ? (
              <>
                <Clock size={16} className="animate-spin" />
                <span className="text-sm font-semibold">Processing...</span>
              </>
            ) : (
              <>
                <Play size={16} className="group-hover:scale-110 transition-transform" />
                <span className="text-sm font-semibold">Start Watching</span>
              </>
            )}
          </button>
        </div>
        
        {/* Watched counter - Always visible */}
        <div className="text-center">
          <p className="text-xs text-muted-foreground">
            {watchAdMutation.isPending ? "Processing reward..." : `Watched: ${adsWatchedToday}/${dailyLimit}`}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
