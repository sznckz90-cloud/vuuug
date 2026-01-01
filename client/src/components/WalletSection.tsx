import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Clock, Shield } from "lucide-react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { showNotification } from "@/components/AppNotification";
import { DiamondIcon } from "@/components/DiamondIcon";

declare global {
  interface Window {
    show_10401872: (type?: string | { type: string; inAppSettings: any }) => Promise<void>;
    Adsgram: {
      init: (config: { blockId: string }) => {
        show: () => Promise<void>;
      };
    };
  }
}

interface WalletSectionProps {
  padBalance: number;
  usdBalance: number;
  uid: string;
  isAdmin?: boolean;
  onAdminClick?: () => void;
  onWithdraw: () => void;
}

export default function WalletSection({ padBalance, usdBalance, uid, isAdmin, onAdminClick, onWithdraw }: WalletSectionProps) {
  const queryClient = useQueryClient();
  const [isShowingAds, setIsShowingAds] = useState(false);
  const [currentAdStep, setCurrentAdStep] = useState<'idle' | 'monetag' | 'adsgram' | 'converting'>('idle');

  const { data: appSettings } = useQuery<any>({
    queryKey: ['/api/app-settings'],
    retry: false,
  });

  const convertMutation = useMutation({
    mutationFn: async (amount: number) => {
      const res = await fetch("/api/convert-to-usd", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ padAmount: amount }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to convert");
      }
      return data;
    },
    onSuccess: async (data) => {
      showNotification("Convert successful.", "success");
      
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/withdrawals"] });
      
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ["/api/auth/user"] }),
        queryClient.refetchQueries({ queryKey: ["/api/user/stats"] }),
        queryClient.refetchQueries({ queryKey: ["/api/withdrawals"] })
      ]);
    },
    onError: (error: Error) => {
      showNotification(error.message, "error");
    },
  });

  const showMonetagRewardedAd = (): Promise<{ success: boolean; unavailable: boolean }> => {
    return new Promise((resolve) => {
      if (typeof window.show_10401872 === 'function') {
        window.show_10401872()
          .then(() => {
            resolve({ success: true, unavailable: false });
          })
          .catch((error) => {
            console.error('Monetag rewarded ad error:', error);
            resolve({ success: false, unavailable: false });
          });
      } else {
        resolve({ success: false, unavailable: true });
      }
    });
  };

  const showAdsgramAd = (): Promise<boolean> => {
    return new Promise(async (resolve) => {
      if (window.Adsgram) {
        try {
          await window.Adsgram.init({ blockId: "int-20373" }).show();
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

  const handleConvert = async () => {
    const minimumConvertPAD = appSettings?.minimumConvertPAD || 10000;
    
    if (padBalance < minimumConvertPAD) {
      showNotification(`Minimum ${minimumConvertPAD.toLocaleString()} PAD required.`, "error");
      return;
    }

    if (isShowingAds || convertMutation.isPending) return;
    
    setIsShowingAds(true);
    
    try {
      // Show AdsGram int-20373 first
      setCurrentAdStep('adsgram');
      const adsgramSuccess = await showAdsgramAd();
      
      if (!adsgramSuccess) {
        showNotification("Please complete the ad to convert.", "error");
        setCurrentAdStep('idle');
        setIsShowingAds(false);
        return;
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Then show Monetag rewarded ad
      setCurrentAdStep('monetag');
      const monetagResult = await showMonetagRewardedAd();
      
      if (monetagResult.unavailable) {
        // If Monetag unavailable, proceed with just AdsGram
        setCurrentAdStep('converting');
        convertMutation.mutate(padBalance);
        return;
      }
      
      if (!monetagResult.success) {
        showNotification("Please complete the ad to convert.", "error");
        setCurrentAdStep('idle');
        setIsShowingAds(false);
        return;
      }
      
      setCurrentAdStep('converting');
      convertMutation.mutate(padBalance);
      
    } catch (error) {
      console.error('Convert error:', error);
      showNotification("Something went wrong. Please try again.", "error");
    } finally {
      setCurrentAdStep('idle');
      setIsShowingAds(false);
    }
  };

  return (
    <Card className="minimal-card mb-3">
      <CardContent className="pt-3 pb-3">
        <div className="flex items-center justify-between gap-3">
          {/* PAD Balance */}
          <div className="flex items-center gap-2">
            <DiamondIcon size={18} withGlow />
            <div className="text-white font-bold text-xl">{Math.floor(padBalance).toLocaleString()} PAD</div>
          </div>

          {/* Convert Button - Same size as Streak Claim button */}
          <Button
            onClick={handleConvert}
            disabled={isShowingAds || convertMutation.isPending}
            className="h-10 w-[120px] btn-primary"
          >
            <div className="flex items-center justify-center gap-2 w-full">
              {isShowingAds ? (
                <>
                  <Clock className="w-4 h-4 flex-shrink-0 animate-spin" />
                  <span className="text-center">Ad...</span>
                </>
              ) : convertMutation.isPending ? (
                <>
                  <RefreshCw className="w-4 h-4 flex-shrink-0 animate-spin" />
                  <span className="text-center">Converting...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 flex-shrink-0" />
                  <span className="text-center">Convert</span>
                </>
              )}
            </div>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
