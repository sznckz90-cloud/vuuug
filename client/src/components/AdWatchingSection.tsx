import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
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

  // Fetch app settings dynamically (ad limit, reward amount)
  const { data: appSettings } = useQuery({
    queryKey: ["/api/app-settings"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/app-settings");
      return response.json();
    },
    staleTime: 30000, // Cache for 30 seconds to avoid too many requests
    refetchInterval: 60000, // Refetch every minute to get latest settings
  });

  const watchAdMutation = useMutation({
    mutationFn: async (adType: string) => {
      const response = await apiRequest("POST", "/api/ads/watch", { adType });
      if (!response.ok) {
        const error = await response.json();
        throw { status: response.status, ...error };
      }
      return response.json();
    },
    onSuccess: async (data) => {
      // Optimized: Only invalidate and refetch user data (balance included in response)
      queryClient.setQueryData(["/api/auth/user"], (old: any) => ({
        ...old,
        balance: data.newBalance,
        adsWatchedToday: data.adsWatchedToday
      }));
      
      // Invalidate other queries without refetching
      queryClient.invalidateQueries({ queryKey: ["/api/user/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/earnings"] });
      
      // Set last ad watch time
      setLastAdWatchTime(Date.now());
      
      // Show reward notification instantly
      showNotification(`You received ${data.rewardPAD || 1000} PAD on your balance`, "success");
      
      // Reset cooldown immediately
      setCooldownRemaining(0);
    },
    onError: (error: any) => {
      if (error.status === 429) {
        const limit = error.limit || appSettings?.dailyAdLimit || 50;
        showNotification(`Daily ad limit reached (${limit} ads/day)`, "error");
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
        if (Date.now() - lastAdWatchTime < 30000) return;
        
        if (typeof window.show_9368336 === 'function') {
          try {
            window.show_9368336();
          } catch {}
        }
      }, 30000);
    };
    
    const timer = setTimeout(startAutoAds, 30000);
    
    return () => {
      clearTimeout(timer);
      if (interval) clearInterval(interval);
    };
  }, [lastAdWatchTime]);

  const handleWatchAd = async () => {
    if (cooldownRemaining > 0) return;
    
    try {
      // Optimized: Credit reward instantly when ad completes
      if (typeof window.show_9368336 === 'function') {
        // Start ad display with immediate reward on completion
        window.show_9368336()
          .then(() => {
            // Ad completed - credit reward immediately
            watchAdMutation.mutate('rewarded');
          })
          .catch(() => {
            // Ad failed or closed early - still credit reward
            watchAdMutation.mutate('rewarded');
          });
      } else {
        // Ad provider not available - credit anyway
        watchAdMutation.mutate('rewarded');
      }
    } catch (error) {
      showNotification("Ad display failed. Please try again.", "error");
    }
  };

  // Get ads watched today from user data and daily limit from app settings
  const adsWatchedToday = user?.adsWatchedToday || 0;
  const dailyLimit = appSettings?.dailyAdLimit || 50;

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
