import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Clock, CreditCard } from "lucide-react";
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

interface TopUpPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function TopUpPopup({ open, onOpenChange }: TopUpPopupProps) {
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

  const handleClose = () => {
    onOpenChange(false);
    setTonAmount("");
    setValidationError("");
    setIsLoading(false);
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md rounded-[20px] bg-black/95 border-white/10">
        <DialogHeader>
          <DialogTitle className="text-white text-center flex items-center justify-center gap-2">
            <img src="/images/ton.png" alt="TON" className="w-6 h-6 object-cover rounded-full" />
            Top up advertising balance
          </DialogTitle>
          <DialogDescription className="text-gray-400 text-center">
            Top up your advertising balance to create tasks
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-4 gap-2">
            {PRESET_AMOUNTS.map((amount) => (
              <button
                key={amount}
                onClick={() => handlePresetSelect(amount)}
                disabled={isLoading}
                className={`py-3 px-3 rounded-xl border transition-all text-sm font-semibold ${
                  tonAmount === amount.toString()
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-[#0d0d0d] text-white border-white/20 hover:border-blue-500/50"
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
            className="bg-[#0d0d0d] border border-white/20 rounded-xl text-white placeholder:text-gray-500 px-4 py-3 h-12 text-center text-lg font-semibold focus:border-blue-500 focus:ring-0"
          />

          {validationError && (
            <p className="text-xs text-red-500 text-center">{validationError}</p>
          )}

          <div className="flex gap-3">
            <Button
              onClick={handleClose}
              className="flex-1 h-11 bg-[#2a2a2a] hover:bg-[#333] text-white font-semibold rounded-xl border-none"
            >
              Close
            </Button>
            <Button
              onClick={handlePay}
              disabled={!tonAmount || isLoading || !!validationError}
              className="flex-1 h-11 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl border-none disabled:opacity-50"
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
              <div className="space-y-2 max-h-32 overflow-y-auto custom-scrollbar">
                {deposits.map((deposit) => (
                  <div key={deposit.id} className="flex items-center gap-3 bg-white/5 rounded-lg p-2">
                    <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                      <CreditCard className="w-4 h-4 text-blue-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <Clock className="w-3 h-3" />
                        <span>{format(new Date(deposit.createdAt), 'MMM dd, HH:mm')}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-semibold text-blue-500">
                        +{parseFloat(deposit.amount).toFixed(2)} TON
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
