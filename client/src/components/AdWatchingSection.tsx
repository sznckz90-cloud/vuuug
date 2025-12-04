import { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Play, Clock, Shield, Timer } from "lucide-react";
import { showNotification } from "@/components/AppNotification";
import { Progress } from "@/components/ui/progress";

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

interface AdLimits {
  hourly: {
    limit: number;
    watched: number;
    remaining: number;
    isLimitReached: boolean;
    timeRemaining: number;
    resetAt: string | null;
  };
  daily: {
    limit: number;
    watched: number;
    remaining: number;
    isLimitReached: boolean;
  };
  canWatchAd: boolean;
}

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export default function AdWatchingSection({ user }: AdWatchingSectionProps) {
  const queryClient = useQueryClient();
  const [isShowingAds, setIsShowingAds] = useState(false);
  const [currentAdStep, setCurrentAdStep] = useState<'idle' | 'monetag' | 'adsgram' | 'verifying'>('idle');
  const [countdown, setCountdown] = useState(0);
  const sessionRewardedRef = useRef(false);
  const monetagStartTimeRef = useRef<number>(0);

  const { data: appSettings } = useQuery({
    queryKey: ["/api/app-settings"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/app-settings");
      return response.json();
    },
    staleTime: 30000,
    refetchInterval: 60000,
  });

  const { data: adLimits, refetch: refetchLimits } = useQuery<AdLimits>({
    queryKey: ["/api/ads/limits"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/ads/limits");
      return response.json();
    },
    staleTime: 5000,
    refetchInterval: 10000,
  });

  useEffect(() => {
    if (adLimits?.hourly?.isLimitReached && adLimits.hourly.timeRemaining > 0) {
      setCountdown(adLimits.hourly.timeRemaining);
      
      const interval = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            refetchLimits();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
      return () => clearInterval(interval);
    } else {
      setCountdown(0);
    }
  }, [adLimits?.hourly?.isLimitReached, adLimits?.hourly?.timeRemaining, refetchLimits]);

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
      const rewardAmount = data?.rewardPAD || appSettings?.rewardPerAd || 2;
      showNotification(`+${rewardAmount} PAD earned!`, "success");
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/earnings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/withdrawal-eligibility"] });
      queryClient.invalidateQueries({ queryKey: ["/api/referrals/valid-count"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ads/limits"] });
    },
    onError: (error: any) => {
      sessionRewardedRef.current = false;
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ads/limits"] });
      
      if (error.status === 429) {
        if (error.limitType === 'hourly') {
          showNotification(`Hourly limit reached. Please wait for timer to reset.`, "error");
        } else {
          const limit = error.limit || appSettings?.dailyAdLimit || 500;
          showNotification(`Daily ad limit reached (${limit} ads/day)`, "error");
        }
      } else if (error.status === 401 || error.status === 403) {
        showNotification("Authentication error. Please refresh the page.", "error");
      } else if (error.message) {
        showNotification(`Error: ${error.message}`, "error");
      } else {
        showNotification("Network error. Check your connection and try again.", "error");
      }
    },
  });

  const showMonetagAd = (): Promise<{ success: boolean; watchedFully: boolean; unavailable: boolean }> => {
    return new Promise((resolve) => {
      if (typeof window.show_10013974 === 'function') {
        monetagStartTimeRef.current = Date.now();
        window.show_10013974()
          .then(() => {
            const watchDuration = Date.now() - monetagStartTimeRef.current;
            const watchedAtLeast3Seconds = watchDuration >= 3000;
            resolve({ success: true, watchedFully: watchedAtLeast3Seconds, unavailable: false });
          })
          .catch((error) => {
            console.error('Monetag ad error:', error);
            const watchDuration = Date.now() - monetagStartTimeRef.current;
            const watchedAtLeast3Seconds = watchDuration >= 3000;
            resolve({ success: false, watchedFully: watchedAtLeast3Seconds, unavailable: false });
          });
      } else {
        resolve({ success: false, watchedFully: false, unavailable: true });
      }
    });
  };

  const handleStartEarning = async () => {
    if (isShowingAds) return;
    
    setIsShowingAds(true);
    sessionRewardedRef.current = false;
    
    try {
      setCurrentAdStep('monetag');
      const monetagResult = await showMonetagAd();
      
      if (monetagResult.unavailable) {
        showNotification("Ads not available. Please try again later.", "error");
        return;
      }
      
      if (!monetagResult.watchedFully) {
        showNotification("Claimed too fast!", "error");
        return;
      }
      
      if (!monetagResult.success) {
        showNotification("Ad failed. Please try again.", "error");
        return;
      }
      
      setCurrentAdStep('verifying');
      
      if (!sessionRewardedRef.current) {
        sessionRewardedRef.current = true;
        
        const rewardAmount = appSettings?.rewardPerAd || 2;
        queryClient.setQueryData(["/api/auth/user"], (old: any) => ({
          ...old,
          balance: String(parseFloat(old?.balance || '0') + rewardAmount),
          adsWatchedToday: (old?.adsWatchedToday || 0) + 1
        }));
        
        watchAdMutation.mutate('monetag');
      }
    } finally {
      setCurrentAdStep('idle');
      setIsShowingAds(false);
    }
  };

  const hourlyLimit = adLimits?.hourly?.limit || appSettings?.hourlyAdLimit || 60;
  const hourlyWatched = adLimits?.hourly?.watched || 0;
  const dailyLimit = adLimits?.daily?.limit || appSettings?.dailyAdLimit || 500;
  const dailyWatched = adLimits?.daily?.watched || user?.adsWatchedToday || 0;
  
  const isHourlyLimitReached = adLimits?.hourly?.isLimitReached || false;
  const isDailyLimitReached = adLimits?.daily?.isLimitReached || false;
  const canWatchAd = adLimits?.canWatchAd ?? (!isHourlyLimitReached && !isDailyLimitReached);

  const hourlyProgress = Math.min((hourlyWatched / hourlyLimit) * 100, 100);
  const dailyProgress = Math.min((dailyWatched / dailyLimit) * 100, 100);

  return (
    <Card className="rounded-2xl minimal-card mb-3">
      <CardContent className="p-4">
        <div className="text-center mb-3">
          <h2 className="text-base font-bold text-white mb-1">Viewing ads</h2>
          <p className="text-[#AAAAAA] text-xs">Get PAD for watching commercials</p>
        </div>
        
        <div className="flex justify-center mb-4">
          {isHourlyLimitReached && countdown > 0 ? (
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-2 text-amber-400">
                <Timer size={20} className="animate-pulse" />
                <span className="text-lg font-bold font-mono">{formatTime(countdown)}</span>
              </div>
              <p className="text-xs text-[#AAAAAA]">Wait for timer to watch more ads</p>
            </div>
          ) : (
            <button
              onClick={handleStartEarning}
              disabled={isShowingAds || !canWatchAd}
              className="btn-primary px-6 py-3 flex items-center gap-2 min-w-[160px] justify-center text-base disabled:opacity-50"
              data-testid="button-watch-ad"
            >
              {isShowingAds ? (
                <>
                  {currentAdStep === 'verifying' ? (
                    <Shield size={16} className="animate-pulse text-green-400" />
                  ) : (
                    <Clock size={16} className="animate-spin" />
                  )}
                  <span className="text-sm font-semibold">
                    {currentAdStep === 'monetag' ? 'Showing Ad...' : 
                     currentAdStep === 'verifying' ? 'Verifying...' : 'Loading...'}
                  </span>
                </>
              ) : (
                <>
                  <Play size={16} className="group-hover:scale-110 transition-transform" />
                  <span className="text-sm font-semibold">Start Earning</span>
                </>
              )}
            </button>
          )}
        </div>
        
        <div className="space-y-3">
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-[#AAAAAA]">Per hour ads limit</span>
              <span className="text-white font-medium">{hourlyWatched}/{hourlyLimit}</span>
            </div>
            <Progress value={hourlyProgress} className="h-2" />
          </div>
          
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-[#AAAAAA]">Daily ads limit</span>
              <span className="text-white font-medium">{dailyWatched}/{dailyLimit}</span>
            </div>
            <Progress value={dailyProgress} className="h-2" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
