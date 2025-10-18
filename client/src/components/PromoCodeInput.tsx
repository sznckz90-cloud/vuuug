import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { showNotification } from "@/components/AppNotification";
import { Ticket } from "lucide-react";

export default function PromoCodeInput() {
  const [promoCode, setPromoCode] = useState("");
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
      
      // Simplify error messages
      if (message.includes("expired")) {
        showNotification("Promo expired.", "error");
      } else if (message.includes("already")) {
        showNotification("Already claimed.", "error");
      } else {
        showNotification("Invalid code.", "error");
      }
    },
  });

  const handleSubmit = () => {
    if (!promoCode.trim()) {
      showNotification("Please enter a promo code", "error");
      return;
    }

    redeemPromoMutation.mutate(promoCode.trim().toUpperCase());
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
        disabled={redeemPromoMutation.isPending || !promoCode.trim()}
        className="h-10 px-6 bg-[#4cd3ff] hover:bg-[#6ddeff] text-black transition-all active:scale-[0.97] shadow-[0_0_20px_rgba(76,211,255,0.4)] font-semibold"
      >
        {redeemPromoMutation.isPending ? "..." : "Apply"}
      </Button>
    </div>
  );
}
