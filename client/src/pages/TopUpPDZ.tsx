import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Layout from "@/components/Layout";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Gem, AlertCircle, ChevronRight, Loader2 } from "lucide-react";

const MINIMUM_AMOUNT = 0.1;

export default function TopUpPDZ() {
  const [pdzAmount, setPdzAmount] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      setPdzAmount(value);
    }
  };

  const handleProceedToPay = async () => {
    const amount = parseFloat(pdzAmount);
    
    if (!pdzAmount || isNaN(amount) || amount < MINIMUM_AMOUNT) {
      toast({
        title: "Invalid Amount",
        description: `Minimum amount is ${MINIMUM_AMOUNT} TON`,
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await apiRequest("POST", "/api/arcpay/create-payment", {
        pdzAmount: parseInt(pdzAmount),
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
      console.error("Payment error:", error);
      toast({
        title: "❌ Payment Failed",
        description: error.message || "Failed to create payment request",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Layout>
      <main className="min-h-screen bg-background flex items-center justify-center px-4 py-8">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <Gem className="w-10 h-10 text-blue-500" />
            </div>
            <CardTitle className="text-2xl">Top-Up PDZ</CardTitle>
            <p className="text-sm text-muted-foreground mt-2">
              Buy PDZ tokens with TON
            </p>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Rate Information */}
            <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  Exchange Rate:
                </span>
                <span className="text-lg font-bold text-blue-900 dark:text-blue-100">
                  1 TON = 1 PDZ
                </span>
              </div>
            </div>

            {/* PDZ Amount Input */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                How many PDZ do you want to buy? (Minimum: {MINIMUM_AMOUNT})
              </label>
              <Input
                type="text"
                inputMode="decimal"
                placeholder="0.1"
                value={pdzAmount}
                onChange={handleInputChange}
                className="text-lg py-6"
              />
              {pdzAmount && (
                <p className="text-sm text-muted-foreground">
                  ≈ {parseFloat(pdzAmount).toFixed(2)} TON needed
                </p>
              )}
            </div>

            {/* Summary */}
            {pdzAmount && (
              <div className="bg-muted rounded-lg p-4 space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">PDZ Amount:</span>
                  <span className="font-semibold">{parseFloat(pdzAmount).toFixed(2)} PDZ</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">TON Required:</span>
                  <span className="font-semibold">{parseFloat(pdzAmount).toFixed(2)} TON</span>
                </div>
                <div className="border-t border-border pt-2 flex justify-between items-center font-semibold">
                  <span>Total:</span>
                  <span className="text-lg text-primary">{parseFloat(pdzAmount).toFixed(2)} TON</span>
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
                <li>PDZ will be credited to your account</li>
                <li>Payment processed on TON blockchain</li>
              </ul>
            </div>

            {/* Proceed Button */}
            <Button
              onClick={handleProceedToPay}
              disabled={!pdzAmount || isLoading}
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
