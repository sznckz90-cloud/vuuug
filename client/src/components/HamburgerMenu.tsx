import { useState, useRef } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Ticket,
  Loader2
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { showNotification } from "@/components/AppNotification";

declare global {
  interface Window {
    Adsgram: {
      init: (config: { blockId: string }) => {
        show: () => Promise<void>;
      };
    };
    show_10306459: (type?: string | { type: string; inAppSettings: any }) => Promise<void>;
  }
}

export default function HamburgerMenu() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [isShowingAds, setIsShowingAds] = useState(false);
  const monetagStartTimeRef = useRef<number>(0);
  const queryClient = useQueryClient();

  const redeemPromoMutation = useMutation({
    mutationFn: async (code: string) => {
      const response = await apiRequest("POST", "/api/promo-codes/redeem", { code });
      return response.json();
    },
    onSuccess: () => {
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

  const showMonetagRewardedAd = (): Promise<{ success: boolean; watchedFully: boolean; unavailable: boolean }> => {
    return new Promise((resolve) => {
      if (typeof window.show_10306459 === 'function') {
        window.show_10306459()
          .then(() => {
            resolve({ success: true, watchedFully: true, unavailable: false });
          })
          .catch((error) => {
            console.error('Monetag rewarded ad error:', error);
            resolve({ success: false, watchedFully: false, unavailable: false });
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
          await window.Adsgram.init({ blockId: "int-19149" }).show();
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

    if (isShowingAds) return;
    
    setIsShowingAds(true);
    
    try {
      // Show AdsGram int-19149 first
      const adsgramSuccess = await showAdsgramAd();
      
      if (!adsgramSuccess) {
        showNotification("Please watch the ad completely to redeem!", "error");
        setIsShowingAds(false);
        return;
      }
      
      // Then show Monetag rewarded ad
      const monetagResult = await showMonetagRewardedAd();
      
      if (monetagResult.unavailable) {
        // If Monetag unavailable, proceed with just AdsGram
        redeemPromoMutation.mutate(promoCode.trim().toUpperCase());
        return;
      }
      
      if (!monetagResult.watchedFully) {
        showNotification("Please watch the ad completely to redeem!", "error");
        setIsShowingAds(false);
        return;
      }
      
      redeemPromoMutation.mutate(promoCode.trim().toUpperCase());
    } finally {
      setIsShowingAds(false);
    }
  };

  return (
    <Drawer open={menuOpen} onOpenChange={setMenuOpen}>
      <DrawerTrigger asChild>
        <button className="cursor-pointer flex flex-col gap-[3px] p-2 rounded-xl bg-[#1a1a1a] border border-[#333] hover:border-cyan-500/50 transition-all">
          <span className="w-4 h-[2px] bg-cyan-400 rounded-full"></span>
          <span className="w-3 h-[2px] bg-cyan-400 rounded-full"></span>
          <span className="w-4 h-[2px] bg-cyan-400 rounded-full"></span>
        </button>
      </DrawerTrigger>
      <DrawerContent className="bg-black/95 backdrop-blur-xl border-t-0 rounded-t-[24px] shadow-[0_-10px_40px_rgba(76,211,255,0.15)] max-h-[85vh]">
        <div className="px-4 pb-8 pt-2 overflow-y-auto">
          <div className="space-y-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Ticket className="w-5 h-5 text-[#4cd3ff]" />
                <span className="text-sm font-semibold text-white">Promo Code</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 relative">
                  <Input
                    placeholder="Enter code"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                    disabled={redeemPromoMutation.isPending}
                    className="bg-[#1a1a1a] border-[#333] text-white placeholder:text-gray-500 h-11 rounded-xl"
                  />
                </div>
                <Button
                  onClick={handleSubmit}
                  disabled={redeemPromoMutation.isPending || isShowingAds || !promoCode.trim()}
                  className="h-11 px-6 bg-[#4cd3ff] hover:bg-[#6ddeff] text-black transition-all active:scale-[0.97] font-semibold rounded-xl"
                >
                  {redeemPromoMutation.isPending || isShowingAds ? <Loader2 className="w-4 h-4 animate-spin" /> : "Apply"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
