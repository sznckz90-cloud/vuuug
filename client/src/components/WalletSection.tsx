import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowDown, RefreshCw, Wallet, Settings } from "lucide-react";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface WalletSectionProps {
  padBalance: number;
  tonBalance: number;
  uid: string;
  isAdmin?: boolean;
  onAdminClick?: () => void;
  onWithdraw: () => void;
}

export default function WalletSection({ padBalance, tonBalance, uid, isAdmin, onAdminClick, onWithdraw }: WalletSectionProps) {
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [padAmount, setPadAmount] = useState("");
  const { toast } = useToast();
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
      toast({
        title: "✅ Converted successfully!",
        description: `${data.padAmount.toLocaleString()} PAD → ${data.tonAmount.toFixed(4)} TON`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      setConvertDialogOpen(false);
      setPadAmount("");
    },
    onError: (error: Error) => {
      toast({
        title: "❌ Conversion failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleConvert = () => {
    const amount = parseFloat(padAmount);
    if (!amount || amount <= 0) {
      toast({
        title: "Invalid amount",
        description: "Please enter a valid PAD amount",
        variant: "destructive",
      });
      return;
    }

    if (amount < 10000000) {
      toast({
        title: "Minimum conversion",
        description: "Minimum conversion is 10,000,000 PAD",
        variant: "destructive",
      });
      return;
    }

    if (amount > padBalance) {
      toast({
        title: "Insufficient balance",
        description: "You don't have enough PAD balance",
        variant: "destructive",
      });
      return;
    }

    convertMutation.mutate(amount);
  };

  const tonFromPad = padAmount ? parseFloat(padAmount) / 10000000 : 0;

  return (
    <>
      <Card className="neon-glow-border mb-4">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Wallet className="w-4 h-4 text-primary" />
              <div className="text-xs text-foreground">UID: {uid}</div>
            </div>
            {isAdmin && (
              <Button
                variant="ghost"
                size="icon"
                className="w-8 h-8"
                onClick={onAdminClick}
              >
                <Settings className="w-4 h-4" />
              </Button>
            )}
          </div>
          
          <div className="space-y-3">
            {/* PAD Balance */}
            <div className="flex items-center justify-between p-3 bg-[#0a0a0a] rounded-lg border border-white/10">
              <div>
                <div className="text-xs text-muted-foreground">PAD Balance</div>
                <div className="text-foreground font-semibold text-lg">{padBalance.toLocaleString()}</div>
              </div>
            </div>

            {/* TON Balance */}
            <div className="flex items-center justify-between p-3 bg-[#0a0a0a] rounded-lg border border-[#3da9fc]/30">
              <div>
                <div className="text-xs text-muted-foreground">TON Balance</div>
                <div className="text-foreground font-semibold text-lg">{tonBalance.toFixed(4)} TON</div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <Button
                className="w-full bg-[#3da9fc] hover:bg-[#3da9fc]/90 text-white"
                onClick={() => setConvertDialogOpen(true)}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Convert
              </Button>
              <Button
                className="w-full bg-[#3da9fc] hover:bg-[#3da9fc]/90 text-white"
                onClick={onWithdraw}
              >
                <ArrowDown className="w-4 h-4 mr-2" />
                Withdraw
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Convert Dialog */}
      <Dialog open={convertDialogOpen} onOpenChange={setConvertDialogOpen}>
        <DialogContent className="bg-[#0a0a0a] border border-white/20">
          <DialogHeader>
            <DialogTitle className="text-foreground">Convert PAD → TON</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Exchange rate: 10,000,000 PAD = 1 TON
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="pad-amount" className="text-foreground">PAD Amount</Label>
              <Input
                id="pad-amount"
                type="number"
                placeholder="Enter PAD amount"
                value={padAmount}
                onChange={(e) => setPadAmount(e.target.value)}
                className="bg-[#111111] border-white/20 text-foreground mt-1"
              />
              <div className="text-xs text-muted-foreground mt-1">
                Available: {padBalance.toLocaleString()} PAD
              </div>
            </div>

            {padAmount && tonFromPad > 0 && (
              <div className="p-3 bg-[#111111] rounded-lg border border-[#3da9fc]/30">
                <div className="text-xs text-muted-foreground">You will receive</div>
                <div className="text-foreground font-semibold text-lg">{tonFromPad.toFixed(4)} TON</div>
              </div>
            )}

            <Button
              className="w-full bg-[#3da9fc] hover:bg-[#3da9fc]/90 text-white"
              onClick={handleConvert}
              disabled={convertMutation.isPending}
            >
              {convertMutation.isPending ? "Converting..." : "Convert Now"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
