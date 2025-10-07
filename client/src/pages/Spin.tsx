import { useState } from "react";
import Layout from "@/components/Layout";
import SpinnerWheel from "@/components/SpinnerWheel";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { showNotification } from "@/components/AppNotification";

declare global {
  interface Window {
    show_9368336: (type?: string | { type: string; inAppSettings: any }) => Promise<void>;
  }
}

export default function Spin() {
  const queryClient = useQueryClient();
  const [isSpinning, setIsSpinning] = useState(false);
  const [isWatchingExtraSpinAd, setIsWatchingExtraSpinAd] = useState(false);

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

  const watchSpinAdMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/spin/watch-ad", {});
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/spin/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      
      if (data.success) {
        showNotification(data.message, "success");
      }
    },
    onError: (error: any) => {
      showNotification(`⚠️ ${error.message || 'Failed to watch ad'}`, "error");
    },
  });

  const handleWatchExtraSpinAd = async () => {
    if (isWatchingExtraSpinAd) return;
    
    setIsWatchingExtraSpinAd(true);
    
    try {
      if (typeof window.show_9368336 === 'function') {
        await window.show_9368336();
        setTimeout(() => {
          watchSpinAdMutation.mutate();
        }, 1000);
      } else {
        setTimeout(() => {
          watchSpinAdMutation.mutate();
        }, 2000);
      }
    } catch (error) {
      console.error('Ad watching failed:', error);
      watchSpinAdMutation.mutate();
    } finally {
      setTimeout(() => {
        setIsWatchingExtraSpinAd(false);
      }, 2000);
    }
  };

  const handleSpin = async () => {
    if (isSpinning) return;
    
    const freeSpins = spinStatus?.freeSpins || 0;
    const extraSpins = spinStatus?.extraSpins || 0;
    const totalAvailableSpins = freeSpins + extraSpins;
    
    if (totalAvailableSpins <= 0) {
      showNotification("No spins available!", "error");
      return;
    }
    
    setIsSpinning(true);
    
    try {
      const isExtraSpin = freeSpins === 0;
      await spinMutation.mutateAsync(isExtraSpin);
    } catch (error) {
      console.error('Spin failed:', error);
    } finally {
      setTimeout(() => {
        setIsSpinning(false);
      }, 4000);
    }
  };

  const freeSpins = spinStatus?.freeSpins || 0;
  const extraSpins = spinStatus?.extraSpins || 0;
  const totalAvailableSpins = freeSpins + extraSpins;
  const adsWatchedToday = spinStatus?.adsWatchedToday || 0;
  const extraSpinAdsWatched = spinStatus?.extraSpinAdsWatched || 0;
  const canWatchForExtraSpin = spinStatus?.canWatchForExtraSpin || false;

  const adsNeededForNextFreeSpin = 10 - (adsWatchedToday % 10);
  const adsNeededForNextExtraSpin = 2 - (extraSpinAdsWatched % 2);

  return (
    <Layout>
      <main className="max-w-md mx-auto px-4 pb-20">
        <div className="mt-4 mb-6">
          <h1 className="text-3xl font-bold text-center text-foreground mb-2">🎰 SPIN & WIN</h1>
          <p className="text-muted-foreground text-sm text-center">Spin the wheel to win 💎 TON rewards!</p>
        </div>

        <Card className="rounded-2xl shadow-lg border-2 border-primary/20 mb-6">
          <CardContent className="p-6">
            <div className="mb-6">
              <SpinnerWheel isSpinning={isSpinning} onSpinComplete={() => {}} />
            </div>

            <div className="text-center mb-6">
              <Button
                onClick={handleSpin}
                disabled={isSpinning || totalAvailableSpins <= 0}
                size="lg"
                className="w-full h-14 text-lg font-bold rounded-xl shadow-lg disabled:opacity-50"
              >
                {isSpinning ? (
                  <span className="flex items-center gap-2">
                    <i className="fas fa-spinner fa-spin"></i>
                    Spinning...
                  </span>
                ) : totalAvailableSpins > 0 ? (
                  <span className="flex items-center gap-2">
                    <i className="fas fa-rotate"></i>
                    SPIN NOW
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <i className="fas fa-lock"></i>
                    No Spins Available
                  </span>
                )}
              </Button>
            </div>

            <div className="bg-gradient-to-r from-primary/10 to-secondary/10 rounded-xl p-4 border border-primary/20">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">🧮 Available Spins</p>
                <div className="flex items-center justify-center gap-6">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-primary">{freeSpins}</p>
                    <p className="text-xs text-muted-foreground">Free Spins</p>
                  </div>
                  <div className="text-2xl text-muted-foreground">+</div>
                  <div className="text-center">
                    <p className="text-3xl font-bold text-secondary">{extraSpins}</p>
                    <p className="text-xs text-muted-foreground">Extra Spins</p>
                  </div>
                  <div className="text-2xl text-muted-foreground">=</div>
                  <div className="text-center">
                    <p className="text-4xl font-bold text-foreground">{totalAvailableSpins}</p>
                    <p className="text-xs text-muted-foreground">Total</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-lg border-2 border-purple-200 dark:border-purple-800 mb-6">
          <CardContent className="p-6">
            <div className="text-center mb-4">
              <h2 className="text-xl font-bold text-foreground mb-1">💠 Need more spins?</h2>
              <p className="text-sm text-muted-foreground">Watch 2 ads = +1 spin</p>
              {!canWatchForExtraSpin && (
                <p className="text-xs text-red-500 mt-2">Daily limit reached (10 extra spins max)</p>
              )}
            </div>

            <Button
              onClick={handleWatchExtraSpinAd}
              disabled={isWatchingExtraSpinAd || !canWatchForExtraSpin}
              size="lg"
              variant="outline"
              className="w-full h-14 text-lg font-bold rounded-xl border-2 border-purple-300 dark:border-purple-700 hover:bg-purple-50 dark:hover:bg-purple-950 disabled:opacity-50"
            >
              {isWatchingExtraSpinAd ? (
                <span className="flex items-center gap-2">
                  <i className="fas fa-spinner fa-spin"></i>
                  Loading Ad...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <i className="fas fa-tv"></i>
                  Watch Ads
                </span>
              )}
            </Button>

            <div className="mt-4 p-3 bg-purple-50 dark:bg-purple-950 rounded-lg border border-purple-200 dark:border-purple-800">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Progress:</span>
                <span className="font-bold text-foreground">{extraSpinAdsWatched % 2}/2 ads</span>
              </div>
              <div className="w-full bg-purple-200 dark:bg-purple-900 rounded-full h-2 mt-2">
                <div 
                  className="bg-purple-600 h-2 rounded-full transition-all duration-300" 
                  style={{ width: `${((extraSpinAdsWatched % 2) / 2) * 100}%` }}
                />
              </div>
              {adsNeededForNextExtraSpin <= 2 && canWatchForExtraSpin && (
                <p className="text-xs text-purple-600 dark:text-purple-400 mt-2 text-center font-semibold">
                  {adsNeededForNextExtraSpin} more ad{adsNeededForNextExtraSpin !== 1 ? 's' : ''} for next extra spin!
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-sm border border-border">
          <CardContent className="p-4">
            <div className="flex items-start gap-2">
              <i className="fas fa-info-circle text-blue-600 dark:text-blue-400 mt-0.5"></i>
              <div className="text-xs text-muted-foreground">
                <p className="font-semibold mb-2 text-foreground">📋 How it works:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Every spin gives you <strong className="text-primary">0.00007 TON</strong></li>
                  <li>Free spins: 10 ads = 1 spin (max 16/day)</li>
                  <li>Extra spins: 2 ads = 1 spin (max 10/day)</li>
                  <li>Total daily limit: 26 spins</li>
                  <li>Resets daily at 00:00 UTC</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </Layout>
  );
}
