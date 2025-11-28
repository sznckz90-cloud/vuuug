import { useState, useRef } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Loader2, Gem } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { showNotification } from "@/components/AppNotification";

const MINIMUM_AMOUNT = 0.1;
const DEBOUNCE_DELAY = 1000;
const PRESET_AMOUNTS = [1, 3, 5, 10];

interface TopUpSheetProps {
  trigger?: React.ReactNode;
}

export default function TopUpSheet({ trigger }: TopUpSheetProps) {
  const [open, setOpen] = useState(false);
  const [padAmount, setPadAmount] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [validationError, setValidationError] = useState("");
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      setPadAmount(value);
      setValidationError("");
    }
  };

  const handlePresetSelect = (amount: number) => {
    setPadAmount(amount.toString());
    setValidationError("");
  };

  const validateAmount = (): boolean => {
    if (!padAmount || padAmount.trim() === "") {
      setValidationError("Enter amount (Min 0.1 TON)");
      return false;
    }

    const amount = parseFloat(padAmount);

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

    const amount = parseFloat(padAmount);
    setIsLoading(true);

    debounceTimeoutRef.current = setTimeout(async () => {
      try {
        const response = await apiRequest("POST", "/api/arcpay/create-payment", {
          pdzAmount: amount,
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
      setPadAmount("");
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
      <DrawerContent className="bg-black/95 backdrop-blur-xl border-t-0 rounded-t-[24px] shadow-[0_-10px_40px_rgba(76,211,255,0.15)]">
        <div className="px-4 pb-5 pt-1">
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-2">
              <Gem className="w-5 h-5 text-[#4cd3ff]" />
              <span className="text-base font-semibold text-white">Top-Up PAD</span>
              <span className="text-xs text-gray-500">(1 TON = 1 PAD)</span>
            </div>

            <div className="grid grid-cols-4 gap-2">
              {PRESET_AMOUNTS.map((amount) => (
                <button
                  key={amount}
                  onClick={() => handlePresetSelect(amount)}
                  disabled={isLoading}
                  className={`py-2 px-2 rounded-lg border transition-all text-sm font-medium ${
                    padAmount === amount.toString()
                      ? "bg-[#4cd3ff] text-black border-[#4cd3ff]"
                      : "bg-[#1a1a1a] text-white border-white/10 hover:border-[#4cd3ff]/50"
                  }`}
                >
                  {amount}
                </button>
              ))}
            </div>

            <div className="flex gap-2 items-center">
              <Input
                type="text"
                inputMode="decimal"
                placeholder="Custom amount"
                value={padAmount}
                onChange={handleInputChange}
                disabled={isLoading}
                className="bg-[#1a1a1a] border-[#333] text-white placeholder:text-gray-500 h-10 rounded-lg flex-1"
              />
              <Button
                onClick={handlePay}
                disabled={!padAmount || isLoading || !!validationError}
                className="h-10 px-6 bg-[#4cd3ff] hover:bg-[#6ddeff] text-black font-semibold rounded-lg transition-all active:scale-[0.98]"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Pay"}
              </Button>
            </div>

            {validationError && (
              <p className="text-xs text-red-500 text-center">{validationError}</p>
            )}

            <p className="text-[10px] text-center text-gray-600">
              Min 0.1 TON • Secured by ArcPay
            </p>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
