import { useState, useEffect } from "react";
import Layout from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { showNotification } from "@/components/AppNotification";
import { useAuth } from "@/hooks/useAuth";

declare global {
  interface Window {
    show_9368336: (type?: string | { type: string; inAppSettings: any }) => Promise<void>;
  }
}

export default function Spin() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isSpinning, setIsSpinning] = useState(false);
  const [isWatchingAd, setIsWatchingAd] = useState(false);
  const [lastAdWatchTime, setLastAdWatchTime] = useState<number>(0);

  const { data: spinStatus, refetch: refetchSpinStatus } = useQuery({
    queryKey: ["/api/spin/status"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/spin/status");
      return response.json();
    },
  });

  const spinMutation = useMutation({
    mutationFn: async (isExtraSpin: boolean) => {
      const response = await apiRequest("POST", "/api/spin/perform", { isExtraSpin });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/spin/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/earnings"] });
      
      if (data.success && data.reward) {
        showNotification(`🎉 Spin Reward!\nYou won: ${data.reward} TON`, "success", parseFloat(data.reward));
      }
    },
    onError: (error: any) => {
      showNotification(`⚠️ ${error.message || 'Failed to spin'}`, "error");
    },
  });

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
      queryClient.invalidateQueries({ queryKey: ["/api/spin/status"] });
      
      setLastAdWatchTime(Date.now());
      showNotification("🎉 Reward added!", "success", 0.0002);
    },
    onError: (error) => {
      showNotification("⚠️ Failed to process ad reward", "error");
    },
  });

  const handleWatchAd = async () => {
    if (isWatchingAd) return;
    
    setIsWatchingAd(true);
    
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
        setIsWatchingAd(false);
      }, 2000);
    }
  };

  const handleSpin = async () => {
    if (isSpinning) return;
    
    setIsSpinning(true);
    
    try {
      await spinMutation.mutateAsync(false);
    } catch (error) {
      console.error('Spin failed:', error);
    } finally {
      setTimeout(() => {
        setIsSpinning(false);
      }, 2000);
    }
  };

  const freeSpins = spinStatus?.freeSpins || 0;
  const adsWatched = user?.adsWatchedToday || 0;
  const adsNeededForNextSpin = 10 - (adsWatched % 10);

  return (
    <Layout>
      <main className="max-w-md mx-auto px-4 pb-20">
        <div className="mt-4">
          <h1 className="text-2xl font-bold text-foreground mb-2">🎰 Spin & Win</h1>
          <p className="text-muted-foreground text-sm mb-4">Spin the wheel to win 💎 TON rewards!</p>
        </div>

        {/* Watch Ads to Earn Spins Section */}
        <Card className="rounded-xl shadow-sm border border-border mb-4">
          <CardContent className="p-4">
            <div className="text-center mb-3">
              <h2 className="text-lg font-bold text-foreground mb-1">📺 Watch Ads to Earn Spins</h2>
              <p className="text-muted-foreground text-xs">Earn 0.0002 TON + 1 spin per 10 ads</p>
            </div>
            
            <div className="relative flex justify-center mb-3">
              <div className="absolute inset-0 rounded-full bg-primary/20 animate-pulse-ring"></div>
              <button
                onClick={handleWatchAd}
                disabled={isWatchingAd}
                className="relative bg-primary hover:bg-primary/90 text-primary-foreground w-20 h-20 rounded-full shadow-lg transform hover:scale-105 transition-all duration-200 group disabled:opacity-50 flex items-center justify-center"
              >
                {isWatchingAd ? (
                  <i className="fas fa-spinner fa-spin text-2xl" style={{color: 'white'}}></i>
                ) : (
                  <i className="fas fa-play text-2xl text-white group-hover:scale-110 transition-transform"></i>
                )}
              </button>
            </div>

            <div className="bg-muted/30 rounded-lg p-3">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-muted-foreground">Ads watched today:</span>
                <span className="text-lg font-bold text-foreground">{adsWatched} / 160</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2 mb-2">
                <div 
                  className="bg-primary h-2 rounded-full transition-all duration-300" 
                  style={{ width: `${Math.min((adsWatched % 10) * 10, 100)}%` }}
                />
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">Progress to next spin:</span>
                <span className="font-semibold text-primary">{adsWatched % 10}/10 ads</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Spin Wheel Section */}
        <Card className="rounded-xl shadow-lg border border-border">
          <CardContent className="p-6">
            <div className="relative flex justify-center mb-6">
              <div className={`absolute inset-0 rounded-full ${freeSpins > 0 ? 'bg-primary/20 animate-pulse-ring' : 'bg-muted/20'}`}></div>
              <button
                onClick={handleSpin}
                disabled={isSpinning || freeSpins <= 0}
                className={`relative ${freeSpins > 0 ? 'bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90' : 'bg-muted'} text-primary-foreground w-32 h-32 rounded-full shadow-2xl transform hover:scale-105 transition-all duration-200 group disabled:opacity-50 flex items-center justify-center`}
              >
                {isSpinning ? (
                  <i className="fas fa-spinner fa-spin text-4xl" style={{color: 'white'}}></i>
                ) : (
                  <span className="text-6xl">{freeSpins > 0 ? '🎰' : '🔒'}</span>
                )}
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center text-lg">
                <span className="text-muted-foreground">Free spins available:</span>
                <span className="font-bold text-foreground text-2xl">{freeSpins}</span>
              </div>
              
              {freeSpins === 0 && adsNeededForNextSpin <= 10 && (
                <div className="text-center p-4 bg-gradient-to-r from-primary/10 to-secondary/10 rounded-lg border border-primary/20">
                  <p className="text-sm text-foreground font-medium mb-2">
                    Watch {adsNeededForNextSpin} more ad{adsNeededForNextSpin !== 1 ? 's' : ''} to earn a free spin!
                  </p>
                  <div className="text-xs text-primary font-semibold">
                    1 free spin per 10 ads watched
                  </div>
                </div>
              )}

              <div className="mt-6 p-4 bg-muted/30 rounded-xl border border-border">
                <h3 className="text-sm font-bold text-foreground text-center mb-3">💎 Reward Table</h3>
                <div className="space-y-2">
                  <div className="flex justify-between items-center p-2 bg-background/50 rounded">
                    <span className="text-sm font-medium">0.000071 TON</span>
                    <span className="text-xs text-green-500 font-semibold">Very High</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-background/50 rounded">
                    <span className="text-sm font-medium">0.00029 TON</span>
                    <span className="text-xs text-green-400 font-semibold">High</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-background/50 rounded">
                    <span className="text-sm font-medium">0.0006 TON</span>
                    <span className="text-xs text-yellow-500 font-semibold">Medium</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-background/50 rounded">
                    <span className="text-sm font-medium">0.0013 TON</span>
                    <span className="text-xs text-yellow-400 font-semibold">Medium-Low</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-background/50 rounded">
                    <span className="text-sm font-medium">0.0062 TON</span>
                    <span className="text-xs text-orange-400 font-semibold">Low</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-background/50 rounded">
                    <span className="text-sm font-medium">0.031 TON</span>
                    <span className="text-xs text-orange-500 font-semibold">Very Low</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-background/50 rounded">
                    <span className="text-sm font-medium">0.52 TON</span>
                    <span className="text-xs text-red-400 font-semibold">Extremely Low</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-gradient-to-r from-primary/20 to-secondary/20 rounded border border-primary/30">
                    <span className="text-sm font-bold text-primary">1 TON</span>
                    <span className="text-xs text-primary font-bold">Ultra Rare! 🌟</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-start gap-2">
                  <i className="fas fa-info-circle text-blue-600 dark:text-blue-400 mt-0.5"></i>
                  <div className="text-xs text-blue-800 dark:text-blue-200">
                    <p className="font-semibold mb-1">How to earn spins:</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>1 free spin for every 10 ads watched</li>
                      <li>Daily maximum: 16 free spins (160 ads)</li>
                      <li>Spins reset daily at 00:00 UTC</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </Layout>
  );
}
