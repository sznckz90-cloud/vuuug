import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Wallet, CheckCircle2 } from "lucide-react";
import { useTonPayment } from "@/hooks/useTonPayment";

interface TonPaymentSectionProps {
  clicks: number;
  baseRate: number;
  adminWallet: string;
  taskData: {
    taskType: "channel" | "bot";
    title: string;
    link: string;
  };
  onPaymentSuccess: () => void;
  disabled?: boolean;
}

export function TonPaymentSection({
  clicks,
  baseRate,
  adminWallet,
  taskData,
  onPaymentSuccess,
  disabled = false,
}: TonPaymentSectionProps) {
  const tonPayment = useTonPayment();

  const tonAmount = tonPayment.calculateTonAmount(clicks, baseRate);

  const handlePayment = async () => {
    try {
      await tonPayment.executePayment({
        clicks,
        baseRate,
        adminWallet,
        taskData,
      });
      onPaymentSuccess();
    } catch (error) {
      console.error("Payment failed:", error);
    }
  };

  return (
    <Card className="minimal-card border-cyan-500/30 bg-gradient-to-br from-cyan-500/5 to-blue-500/5">
      <CardContent className="pt-4 pb-4 space-y-4">
        <div className="flex items-center gap-2 mb-3">
          <Wallet className="w-5 h-5 text-cyan-400" />
          <h3 className="font-semibold text-white">TON Payment</h3>
        </div>

        {!tonPayment.isConnected ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Connect your TON wallet to pay and publish your task instantly
            </p>
            <Button
              onClick={tonPayment.connect}
              disabled={tonPayment.isConnecting || disabled}
              className="w-full btn-primary"
            >
              {tonPayment.isConnecting ? "Connecting..." : "🔗 Connect TON Wallet"}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 p-2 rounded-lg bg-green-500/10 border border-green-500/30">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span className="text-sm text-green-400">Wallet Connected</span>
            </div>

            <div className="p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/30">
              <div className="text-xs text-muted-foreground mb-1">Connected Address:</div>
              <div className="text-xs font-mono text-cyan-300 break-all">
                {tonPayment.address}
              </div>
            </div>

            <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-white">Clicks:</span>
                <span className="text-sm font-semibold text-cyan-300">{clicks.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-white">Base Rate:</span>
                <span className="text-xs text-muted-foreground">100 clicks = {baseRate} TON</span>
              </div>
              <div className="h-px bg-cyan-500/30" />
              <div className="flex justify-between items-center">
                <span className="text-base font-bold text-white">Total Amount:</span>
                <span className="text-lg font-bold text-cyan-300">{tonAmount.toFixed(6)} TON</span>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={tonPayment.disconnect}
                variant="outline"
                className="flex-1"
                disabled={tonPayment.isProcessing || disabled}
              >
                Disconnect
              </Button>
              <Button
                onClick={handlePayment}
                className="flex-1 btn-primary"
                disabled={tonPayment.isProcessing || disabled || !taskData.title || !taskData.link}
              >
                {tonPayment.isProcessing ? "Processing..." : `Pay ${tonAmount.toFixed(6)} TON & Publish`}
              </Button>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              Payment will be sent to admin wallet and verified on TON blockchain
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
