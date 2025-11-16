import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { showNotification } from "@/components/AppNotification";
import { DiamondIcon } from "@/components/DiamondIcon";
import { TonCoinIcon } from "@/components/TonCoinIcon";

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
      
      // Invalidate all balance-related queries
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/withdrawals"] });
      
      // Force immediate refetch for live balance update
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

  const handleConvert = () => {
    const minimumConvertPAD = appSettings?.minimumConvertPAD || 10000;
    
    if (padBalance < minimumConvertPAD) {
      showNotification(`Minimum ${minimumConvertPAD.toLocaleString()} PAD required.`, "error");
      return;
    }

    convertMutation.mutate(padBalance);
  };

  return (
    <Card className="minimal-card mb-3">
      <CardContent className="pt-4 pb-4">
        <div className="space-y-3">
          {/* Balance Display */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-[#1A1A1A] rounded-2xl border border-[#2A2A2A]">
              <div className="text-xs text-[#AAAAAA] mb-1 flex items-center gap-1">
                <DiamondIcon size={12} withGlow />
                PAD Balance
              </div>
              <div className="text-white font-bold text-lg">{Math.floor(padBalance).toLocaleString()}</div>
            </div>
            <div className="p-3 bg-[#1A1A1A] rounded-2xl border border-[#2A2A2A]">
              <div className="text-xs text-[#AAAAAA] mb-1 flex items-center gap-1">
                <span className="text-green-400">$</span>
                USD Balance
              </div>
              <div className="text-white font-bold text-lg">${usdBalance.toFixed(2)}</div>
            </div>
          </div>

          {/* Convert Button */}
          <Button
            className="w-full h-11 btn-primary"
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
