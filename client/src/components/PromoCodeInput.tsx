import { useState, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { showNotification } from "@/components/AppNotification";
import { Ticket, Clock, Shield } from "lucide-react";

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

export default function PromoCodeInput() {
  const [promoCode, setPromoCode] = useState("");
  const [isShowingAd, setIsShowingAd] = useState(false);
  const [currentAdStep, setCurrentAdStep] = useState<'idle' | 'monetag' | 'adsgram' | 'verifying'>('idle');
  const monetagStartTimeRef = useRef<number>(0);
  const queryClient = useQueryClient();

  const redeemPromoMutation = useMutation({
    mutationFn: async (code: string) => {
      const response = await apiRequest("POST", "/api/promo-codes/redeem", { code });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/earnings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/stats"] });
      setPromoCode("");
      showNotification("Promo applied successfully!", "success");
    },
    onError: (error: any) => {
      const message = error.message || "Invalid promo code";
      showNotification(message, "error");
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

  const showAdsgramAd = (): Promise<boolean> => {
    return new Promise(async (resolve) => {
      if (window.Adsgram) {
        try {
          await window.Adsgram.init({ blockId: "int-18225" }).show();
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

  const handleSubmit = async () => {
    if (!promoCode.trim()) {
      showNotification("Please enter a promo code", "error");
      return;
    }

    if (isShowingAd) return;
    setIsShowingAd(true);

    try {
      setCurrentAdStep('monetag');
      const monetagResult = await showMonetagAd();
      
      if (monetagResult.unavailable) {
        showNotification("Monetag ads not available. Please try again later.", "error");
        return;
      }
      
      if (!monetagResult.watchedFully) {
        showNotification("Claimed too fast!", "error");
        return;
      }

      if (!monetagResult.success) {
        showNotification("Monetag ad failed. Please try again.", "error");
        return;
      }

      await new Promise(resolve => setTimeout(resolve, 500));
      
      setCurrentAdStep('adsgram');
      const adsgramSuccess = await showAdsgramAd();
      
      if (!adsgramSuccess) {
        showNotification("Both ads must be watched completely to claim promo.", "error");
        return;
      }

      setCurrentAdStep('verifying');
      redeemPromoMutation.mutate(promoCode.trim().toUpperCase());
    } finally {
      setCurrentAdStep('idle');
      setIsShowingAd(false);
    }
  };

  const getButtonText = () => {
    if (currentAdStep === 'monetag') return "Monetag...";
    if (currentAdStep === 'adsgram') return "AdGram...";
    if (currentAdStep === 'verifying') return "Verifying...";
    if (redeemPromoMutation.isPending) return "Applying...";
    return "Apply";
  };

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 relative">
        <Ticket className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#4cd3ff]" />
        <Input
          placeholder="PROMO CODE"
          value={promoCode}
          onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
          disabled={redeemPromoMutation.isPending || isShowingAd}
          className="bg-[#0d0d0d] border-[#4cd3ff] text-white placeholder:text-gray-500 pl-10 h-10"
        />
      </div>
      <Button
        onClick={handleSubmit}
        disabled={redeemPromoMutation.isPending || isShowingAd || !promoCode.trim()}
        className="h-10 px-6 bg-[#4cd3ff] hover:bg-[#6ddeff] text-black transition-all active:scale-[0.97] shadow-[0_0_20px_rgba(76,211,255,0.4)] font-semibold flex items-center gap-2"
      >
        {isShowingAd && currentAdStep !== 'idle' && (
          currentAdStep === 'verifying' ? (
            <Shield size={14} className="animate-pulse text-green-600" />
          ) : (
            <Clock size={14} className="animate-spin" />
          )
        )}
        {getButtonText()}
      </Button>
    </div>
  );
}
