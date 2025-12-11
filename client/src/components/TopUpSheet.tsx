import { useState, useRef } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Loader2, Clock, CreditCard } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { showNotification } from "@/components/AppNotification";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";

const MINIMUM_AMOUNT = 0.1;
const DEBOUNCE_DELAY = 1000;
const PRESET_AMOUNTS = [1, 3, 5, 10];

interface DepositHistory {
  id: string;
  amount: string;
  status: string;
  createdAt: string;
}

interface TopUpSheetProps {
  trigger?: React.ReactNode;
}

export default function TopUpSheet({ trigger }: TopUpSheetProps) {
  const [open, setOpen] = useState(false);
  const [tonAmount, setTonAmount] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [validationError, setValidationError] = useState("");
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { data: depositsData } = useQuery<{ success: boolean; deposits: DepositHistory[] }>({
    queryKey: ['/api/deposits/history'],
    retry: false,
    enabled: open,
  });

  const deposits = depositsData?.deposits?.slice(0, 5) || [];

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      setTonAmount(value);
      setValidationError("");
    }
  };

  const handlePresetSelect = (amount: number) => {
    setTonAmount(amount.toString());
    setValidationError("");
  };

  const validateAmount = (): boolean => {
    if (!tonAmount || tonAmount.trim() === "") {
      setValidationError("Enter amount (Min 0.1 TON)");
      return false;
    }

    const amount = parseFloat(tonAmount);

    if (isNaN(amount) || amount <= 0) {
      setValidationError("Enter valid amount");
      return false;
    }

    if (amount < MINIMUM_AMOUNT) {
      setValidationError(`Minimum top-up is ${MINIMUM_AMOUNT} TON`);
      return false;
    }

    setValidationError("");
    return true;
  };

  const handlePay = async () => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    if (!validateAmount()) {
      return;
    }

    if (isLoading) {
      return;
    }

    const amount = parseFloat(tonAmount);
    setIsLoading(true);

    debounceTimeoutRef.current = setTimeout(async () => {
      try {
        const response = await apiRequest("POST", "/api/arcpay/create-payment", {
          tonAmount: amount,
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to create payment");
        }

        if (data.paymentUrl) {
          window.location.href = data.paymentUrl;
        } else {
          throw new Error("No payment URL received");
        }
      } catch (error: any) {
        console.error("Payment error:", error);
        showNotification(error.message || "Failed to create payment request", "error");
        setIsLoading(false);
      }
    }, DEBOUNCE_DELAY);
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      setTonAmount("");
      setValidationError("");
      setIsLoading(false);
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    }
  };

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerTrigger asChild>
        {trigger || (
          <button className="flex items-center gap-1 text-[#4cd3ff] hover:text-[#6ddeff] transition-colors text-xs font-medium cursor-pointer">
            <Plus className="w-3.5 h-3.5" />
            Top up
          </button>
        )}
      </DrawerTrigger>
      <DrawerContent className="bg-[#1a1a1a] border-t border-white/10 rounded-t-2xl max-h-[80vh]">
        <div className="px-6 pb-6 pt-4 overflow-y-auto">
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-white text-center flex items-center justify-center gap-2">
              <img src="/images/ton.png" alt="TON" className="w-6 h-6 object-cover rounded-full" />
              Top-Up TON
            </h2>

            <div className="grid grid-cols-4 gap-2">
              {PRESET_AMOUNTS.map((amount) => (
                <button
                  key={amount}
                  onClick={() => handlePresetSelect(amount)}
                  disabled={isLoading}
                  className={`py-3 px-3 rounded-xl border transition-all text-sm font-semibold ${
                    tonAmount === amount.toString()
                      ? "bg-[#4cd3ff] text-black border-[#4cd3ff]"
                      : "bg-[#0d0d0d] text-white border-white/20 hover:border-[#4cd3ff]/50"
                  }`}
                >
                  {amount}
                </button>
              ))}
            </div>

            <Input
              type="text"
              inputMode="decimal"
              placeholder="Enter custom amount"
              value={tonAmount}
              onChange={handleInputChange}
              disabled={isLoading}
              className="bg-[#0d0d0d] border border-white/20 rounded-xl text-white placeholder:text-gray-500 px-4 py-3 h-12 text-center text-lg font-semibold focus:border-[#4cd3ff] focus:ring-0"
            />

            {validationError && (
              <p className="text-xs text-red-500 text-center">{validationError}</p>
            )}

            <div className="flex gap-3">
              <Button
                onClick={() => handleOpenChange(false)}
                className="flex-1 h-11 bg-[#2a2a2a] hover:bg-[#333] text-white font-semibold rounded-xl"
              >
                Close
              </Button>
              <Button
                onClick={handlePay}
                disabled={!tonAmount || isLoading || !!validationError}
                className="flex-1 h-11 bg-[#4cd3ff] hover:bg-[#6ddeff] text-black font-semibold rounded-xl disabled:opacity-50"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Pay"}
              </Button>
            </div>

            <p className="text-[10px] text-center text-gray-500">
              Min 0.1 TON • Secured by ArcPay
            </p>

            {deposits.length > 0 && (
              <div className="mt-4 border-t border-white/10 pt-3">
                <h4 className="text-xs font-semibold text-gray-400 mb-2">Deposit History</h4>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {deposits.map((deposit) => (
                    <div key={deposit.id} className="flex items-center gap-3 bg-[#1a1a1a] rounded-lg p-2">
                      <div className="w-8 h-8 rounded-full bg-[#4cd3ff]/10 flex items-center justify-center">
                        <CreditCard className="w-4 h-4 text-[#4cd3ff]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <Clock className="w-3 h-3" />
                          <span>{format(new Date(deposit.createdAt), 'MMM dd, HH:mm')}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-semibold text-[#4cd3ff]">
                          +{parseFloat(deposit.amount).toFixed(2)} TON
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
