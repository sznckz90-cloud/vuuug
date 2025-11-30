import { useState, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { showNotification } from "@/components/AppNotification";
import { Ticket } from "lucide-react";

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
      const message = error.message || "Invalid code.";
      
      if (message.includes("expired")) {
        showNotification("Promo expired.", "error");
      } else if (message.includes("already")) {
        showNotification("Already claimed.", "error");
      } else {
        showNotification("Invalid code.", "error");
      }
    },
  });

  const showMonetagAd = (): Promise<{ success: boolean; watchedFully: boolean }> => {
    return new Promise((resolve) => {
      if (typeof window.show_10013974 === 'function') {
        monetagStartTimeRef.current = Date.now();
        window.show_10013974()
          .then(() => {
            const watchDuration = Date.now() - monetagStartTimeRef.current;
            resolve({ success: true, watchedFully: watchDuration >= 3000 });
          })
          .catch((error) => {
            console.error('Monetag ad error:', error);
            const watchDuration = Date.now() - monetagStartTimeRef.current;
            resolve({ success: false, watchedFully: watchDuration >= 3000 });
          });
      } else {
        resolve({ success: false, watchedFully: false });
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
      const monetagResult = await showMonetagAd();
      
      if (!monetagResult.watchedFully) {
        showNotification("Claimed too fast!", "error");
        return;
      }

      await new Promise(resolve => setTimeout(resolve, 500));
      
      const adsgramSuccess = await showAdsgramAd();
      
      if (!monetagResult.success || !adsgramSuccess) {
        showNotification("Both ads must be watched to claim promo.", "error");
        return;
      }

      redeemPromoMutation.mutate(promoCode.trim().toUpperCase());
    } finally {
      setIsShowingAd(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 relative">
        <Ticket className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#4cd3ff]" />
        <Input
          placeholder="PROMO CODE"
          value={promoCode}
          onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
          disabled={redeemPromoMutation.isPending}
          className="bg-[#0d0d0d] border-[#4cd3ff] text-white placeholder:text-gray-500 pl-10 h-10"
        />
      </div>
      <Button
        onClick={handleSubmit}
        disabled={redeemPromoMutation.isPending || isShowingAd || !promoCode.trim()}
        className="h-10 px-6 bg-[#4cd3ff] hover:bg-[#6ddeff] text-black transition-all active:scale-[0.97] shadow-[0_0_20px_rgba(76,211,255,0.4)] font-semibold"
      >
        {isShowingAd ? "Watching..." : redeemPromoMutation.isPending ? "..." : "Apply"}
      </Button>
    </div>
  );
}
