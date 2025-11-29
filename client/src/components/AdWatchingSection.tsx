import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Play, Clock } from "lucide-react";
import { showNotification } from "@/components/AppNotification";

declare global {
  interface Window {
    show_10013974: (type?: string | { type: string; inAppSettings: any }) => Promise<void>;
    Adsgram: {
      init: (config: { blockId: string }) => {
        show: () => Promise<void>;
      };
    };
  }
}

interface AdWatchingSectionProps {
  user: any;
}

export default function AdWatchingSection({ user }: AdWatchingSectionProps) {
  const queryClient = useQueryClient();
  const [isShowingAds, setIsShowingAds] = useState(false);
  const [currentAdStep, setCurrentAdStep] = useState<'idle' | 'monetag' | 'adsgram'>('idle');

  const { data: appSettings } = useQuery({
    queryKey: ["/api/app-settings"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/app-settings");
      return response.json();
    },
    staleTime: 30000,
    refetchInterval: 60000,
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
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/earnings"] });
    },
    onError: (error: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      
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
    },
  });

  const showMonetagAd = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if (typeof window.show_10013974 === 'function') {
        window.show_10013974()
          .then(() => {
            // INSTANT notification - show immediately from ad callback
            const rewardAmount = appSettings?.rewardPerAd || 2;
            showNotification(`+${rewardAmount} PAD earned!`, "success");
            
            // Update UI immediately for instant feedback
            queryClient.setQueryData(["/api/auth/user"], (old: any) => ({
              ...old,
              balance: String(parseFloat(old?.balance || '0') + rewardAmount),
              adsWatchedToday: (old?.adsWatchedToday || 0) + 1
            }));
            
            // Then sync with backend in background (silent)
            watchAdMutation.mutate('monetag');
            resolve(true);
          })
          .catch((error) => {
            console.error('Monetag ad error:', error);
            resolve(false);
          });
      } else {
        resolve(false);
      }
    });
  };

  const showAdsgramAd = (): Promise<boolean> => {
    return new Promise(async (resolve) => {
      if (window.Adsgram) {
        try {
          await window.Adsgram.init({ blockId: "int-18225" }).show();
          
          // INSTANT notification - show immediately from ad callback
          const rewardAmount = appSettings?.rewardPerAd || 2;
          showNotification(`+${rewardAmount} PAD earned!`, "success");
          
          // Update UI immediately for instant feedback
          queryClient.setQueryData(["/api/auth/user"], (old: any) => ({
            ...old,
            balance: String(parseFloat(old?.balance || '0') + rewardAmount),
            adsWatchedToday: (old?.adsWatchedToday || 0) + 1
          }));
          
          // Then sync with backend in background (silent)
          watchAdMutation.mutate('adsgram');
          resolve(true);
        } catch (error) {
          console.error('Adsgram ad error:', error);
          resolve(false);
        }
      } else {
        resolve(false);
      }
    });
  };

  const handleStartEarning = async () => {
    if (isShowingAds) return;
    
    setIsShowingAds(true);
    
    // Step 1: Show Monetag ad
    setCurrentAdStep('monetag');
    const monetagSuccess = await showMonetagAd();
    
    if (!monetagSuccess) {
      showNotification("Monetag not available. Trying AdGram...", "info");
    }
    
    // Small delay between ads
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Step 2: Show AdGram ad
    setCurrentAdStep('adsgram');
    const adsgramSuccess = await showAdsgramAd();
    
    if (!adsgramSuccess && !monetagSuccess) {
      showNotification("No ads available. Please try again later.", "error");
    }
    
    // Reset state
    setCurrentAdStep('idle');
    setIsShowingAds(false);
  };

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
            onClick={handleStartEarning}
            disabled={isShowingAds || adsWatchedToday >= dailyLimit}
            className="btn-primary px-6 py-3 flex items-center gap-2 min-w-[160px] justify-center text-base disabled:opacity-50"
            data-testid="button-watch-ad"
          >
            {isShowingAds ? (
              <>
                <Clock size={16} className="animate-spin" />
                <span className="text-sm font-semibold">
                  {currentAdStep === 'monetag' ? 'Showing Monetag...' : 
                   currentAdStep === 'adsgram' ? 'Showing AdGram...' : 'Loading...'}
                </span>
              </>
            ) : (
              <>
                <Play size={16} className="group-hover:scale-110 transition-transform" />
                <span className="text-sm font-semibold">Start Earning</span>
              </>
            )}
          </button>
        </div>
        
        {/* Watched counter - Always visible */}
        <div className="text-center">
          <p className="text-xs text-muted-foreground">
            Watched: {adsWatchedToday}/{dailyLimit}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
