import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { showNotification } from "@/components/AppNotification";
import { DiamondIcon } from "@/components/DiamondIcon";

interface WalletSectionProps {
  padBalance: number;
  tonBalance: number;
  uid: string;
  isAdmin?: boolean;
  onAdminClick?: () => void;
  onWithdraw: () => void;
}

export default function WalletSection({ padBalance, tonBalance, uid, isAdmin, onAdminClick, onWithdraw }: WalletSectionProps) {
  const queryClient = useQueryClient();

  const convertMutation = useMutation({
    mutationFn: async (amount: number) => {
      const res = await fetch("/api/wallet/convert", {
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
    onSuccess: (data) => {
      showNotification(`Converted ${data.padAmount.toLocaleString()} PAD → ${data.tonAmount.toFixed(4)} TON`, "success");
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    },
    onError: (error: Error) => {
      showNotification(error.message, "error");
    },
  });

  const handleConvert = () => {
    // Check minimum balance required
    if (padBalance < 100000) {
      showNotification("Minimum 100,000 PAD required to convert.", "error");
      return;
    }

    // Convert all available PAD balance instantly
    convertMutation.mutate(padBalance);
  };

  return (
    <Card className="frosted-glass mb-3 rounded-2xl diamond-glow">
      <CardContent className="pt-3 pb-3">
        
        <div className="space-y-2">
          {/* Diamond Icon Header */}
          <div className="flex items-center justify-center mb-2">
            <DiamondIcon size={40} withGlow={true} />
          </div>

          {/* Compact Balance Display */}
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2 bg-[#0d0d0d] rounded-lg border border-[#4cd3ff]/20">
              <div className="text-[10px] text-muted-foreground">PAD Balance</div>
              <div className="text-[#e5e5e5] font-semibold text-sm">{padBalance.toLocaleString()}</div>
            </div>
            <div className="p-2 bg-[#0d0d0d] rounded-lg border border-[#4cd3ff]/40">
              <div className="text-[10px] text-muted-foreground">TON Balance</div>
              <div className="text-[#4cd3ff] font-semibold text-sm">{tonBalance.toFixed(4)}</div>
            </div>
          </div>

          {/* Compact Action Button - Instant Conversion */}
          <Button
            className="w-full h-9 bg-[#4cd3ff] hover:bg-[#6ddeff] text-black transition-all active:scale-[0.97] shadow-[0_0_20px_rgba(76,211,255,0.4)] font-semibold"
            onClick={handleConvert}
            disabled={convertMutation.isPending}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            {convertMutation.isPending ? "Converting..." : "Convert"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
