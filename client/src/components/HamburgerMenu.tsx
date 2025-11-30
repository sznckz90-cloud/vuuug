import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Drawer,
  DrawerContent,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Menu, 
  Ticket,
  Receipt,
  Clock,
  CheckCircle,
  XCircle,
  Loader2
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { showNotification } from "@/components/AppNotification";
import { format } from "date-fns";

interface Withdrawal {
  id: string;
  amount: string;
  details: string;
  status: string;
  createdAt: string;
  comment?: string;
  method?: string;
}

interface WithdrawalsResponse {
  success: boolean;
  withdrawals: Withdrawal[];
}

declare global {
  interface Window {
    show_10013974: (type?: string | { type: string; inAppSettings: any }) => Promise<void>;
  }
}

export default function HamburgerMenu() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const queryClient = useQueryClient();

  const { data: withdrawalsData, isLoading: withdrawalsLoading } = useQuery<WithdrawalsResponse>({
    queryKey: ['/api/withdrawals'],
    retry: false,
  });

  const withdrawals = (withdrawalsData?.withdrawals || []).slice(0, 5);

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

  const handleSubmit = async () => {
    if (!promoCode.trim()) {
      showNotification("Please enter a promo code", "error");
      return;
    }

    if (typeof window.show_10013974 === 'function') {
      try {
        await window.show_10013974('pop');
      } catch (error) {
        console.error('Ad error:', error);
      }
    }

    redeemPromoMutation.mutate(promoCode.trim().toUpperCase());
  };

  const getStatusIcon = (status: string) => {
    const lowerStatus = status.toLowerCase();
    if (lowerStatus.includes('approved') || lowerStatus.includes('success') || lowerStatus.includes('paid')) {
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    } else if (lowerStatus.includes('reject')) {
      return <XCircle className="w-4 h-4 text-red-500" />;
    } else if (lowerStatus.includes('pending')) {
      return <Clock className="w-4 h-4 text-yellow-500" />;
    }
    return <Loader2 className="w-4 h-4 text-gray-500" />;
  };

  const getStatusColor = (status: string) => {
    const lowerStatus = status.toLowerCase();
    if (lowerStatus.includes('approved') || lowerStatus.includes('success') || lowerStatus.includes('paid')) {
      return 'text-green-500';
    } else if (lowerStatus.includes('reject')) {
      return 'text-red-500';
    } else if (lowerStatus.includes('pending')) {
      return 'text-yellow-500';
    }
    return 'text-gray-500';
  };

  const formatUSD = (amount: string) => {
    return parseFloat(amount).toFixed(2);
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
                  disabled={redeemPromoMutation.isPending || !promoCode.trim()}
                  className="h-11 px-6 bg-[#4cd3ff] hover:bg-[#6ddeff] text-black transition-all active:scale-[0.97] font-semibold rounded-xl"
                >
                  {redeemPromoMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Apply"}
                </Button>
              </div>
            </div>

            <div className="h-px bg-white/10" />

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-[#4cd3ff]" />
                <span className="text-sm font-semibold text-white">Wallet Activity</span>
              </div>
              
              {withdrawalsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-[#4cd3ff]" />
                </div>
              ) : withdrawals.length === 0 ? (
                <div className="text-center py-6 bg-[#1a1a1a]/50 rounded-xl">
                  <p className="text-gray-500 text-sm">No transactions yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {withdrawals.map((withdrawal) => (
                    <div 
                      key={withdrawal.id}
                      className="flex items-center justify-between p-3 bg-[#1a1a1a]/50 rounded-xl border border-white/5"
                    >
                      <div className="flex items-center gap-3">
                        {getStatusIcon(withdrawal.status)}
                        <div>
                          <p className="text-sm text-white font-medium">
                            ${formatUSD(withdrawal.amount)}
                          </p>
                          <p className="text-xs text-gray-500">
                            {format(new Date(withdrawal.createdAt), 'MMM dd, yyyy')}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`text-xs font-medium capitalize ${getStatusColor(withdrawal.status)}`}>
                          {withdrawal.status}
                        </span>
                        <p className="text-xs text-gray-500">
                          {withdrawal.method || 'N/A'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
