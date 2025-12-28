import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Layout from "@/components/Layout";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Gem, AlertCircle, ChevronRight, Loader2 } from "lucide-react";

const MINIMUM_AMOUNT = 0.1;
const DEBOUNCE_DELAY = 1000; // 1 second debounce

export default function TopUpTON() {
  const [tonAmount, setTonAmount] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [validationError, setValidationError] = useState("");
  const { toast } = useToast();
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      setTonAmount(value);
      setValidationError(""); // Clear error when user types
    }
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

  const handleProceedToPay = async () => {
    // Clear any existing debounce timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Validate before making request
    if (!validateAmount()) {
      return;
    }

    // Prevent double-click
    if (isLoading) {
      return;
    }

    const amount = parseFloat(tonAmount);

    setIsLoading(true);
    
    // Set debounce timeout to prevent spam
    debounceTimeoutRef.current = setTimeout(async () => {
      try {
        console.log(`💳 Sending payment request: ${amount} TON (type: ${typeof amount})`);
        
        const response = await apiRequest("POST", "/api/arcpay/create-payment", {
          tonAmount: amount, // Send as Number, NOT parseInt
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to create payment");
        }

        if (data.paymentUrl) {
          // Open payment URL
          window.location.href = data.paymentUrl;
        } else {
          throw new Error("No payment URL received");
        }
      } catch (error: any) {
        console.error("❌ Payment error:", error);
        toast({
          title: "Payment Failed",
          description: error.message || "Failed to create payment request",
          variant: "destructive",
        });
        setIsLoading(false); // Re-enable button on error
      }
    }, DEBOUNCE_DELAY);
  };

  return (
    <Layout>
      <main className="min-h-screen bg-background flex items-center justify-center px-4 py-8">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <Gem className="w-10 h-10 text-blue-500" />
            </div>
            <CardTitle className="text-2xl">Top-Up TON</CardTitle>
            <p className="text-sm text-muted-foreground mt-2">
              Add TON to your balance
            </p>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Rate Information */}
            <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  Payment Method:
                </span>
                <span className="text-lg font-bold text-blue-900 dark:text-blue-100">
                  TON Blockchain
                </span>
              </div>
            </div>

            {/* TON Amount Input */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                How much TON do you want to add? (Minimum: {MINIMUM_AMOUNT})
              </label>
              <Input
                type="text"
                inputMode="decimal"
                placeholder="0.1"
                value={tonAmount}
                onChange={handleInputChange}
                disabled={isLoading}
                className="text-lg py-6"
              />
              {validationError && (
                <p className="text-sm text-red-500 font-medium">
                  {validationError}
                </p>
              )}
              {tonAmount && !validationError && (
                <p className="text-sm text-muted-foreground">
                  ≈ {parseFloat(tonAmount).toFixed(2)} TON
                </p>
              )}
            </div>

            {/* Summary */}
            {tonAmount && !validationError && (
              <div className="bg-muted rounded-lg p-4 space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">TON Amount:</span>
                  <span className="font-semibold">{parseFloat(tonAmount).toFixed(2)} TON</span>
                </div>
                <div className="border-t border-border pt-2 flex justify-between items-center font-semibold">
                  <span>Total:</span>
                  <span className="text-lg text-primary">{parseFloat(tonAmount).toFixed(2)} TON</span>
                </div>
              </div>
            )}

            {/* Information Box */}
            <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-4 text-xs space-y-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                <p className="font-semibold text-amber-900 dark:text-amber-100">
                  Payment Information
                </p>
              </div>
              <ul className="list-disc list-inside space-y-1 text-amber-900 dark:text-amber-100">
                <li>You'll be redirected to secure ArcPay checkout</li>
                <li>After payment, you'll return to Telegram bot</li>
                <li>TON will be credited to your account</li>
                <li>Payment processed on TON blockchain</li>
              </ul>
            </div>

            {/* Proceed Button */}
            <Button
              onClick={handleProceedToPay}
              disabled={!tonAmount || isLoading || !!validationError}
              className="w-full py-6 text-lg"
              size="lg"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  Proceed to Pay
                  <ChevronRight className="w-5 h-5 ml-2" />
                </>
              )}
            </Button>

            {/* Warning */}
            <p className="text-xs text-center text-muted-foreground">
              Secured by ArcPay • TON Network
            </p>
          </CardContent>
        </Card>
      </main>
    </Layout>
  );
}
