import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface PromoCodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function PromoCodeDialog({ open, onOpenChange }: PromoCodeDialogProps) {
  const [promoCode, setPromoCode] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const redeemPromoMutation = useMutation({
    mutationFn: async (code: string) => {
      const response = await apiRequest("POST", "/api/promo-codes/redeem", { code });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/earnings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/stats"] });
      setPromoCode("");
      onOpenChange(false);
      toast({
        title: "Success! 🎉",
        description: data.message,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to redeem promo code",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (!promoCode.trim()) {
      toast({
        title: "Error",
        description: "Please enter a promo code",
        variant: "destructive",
      });
      return;
    }

    redeemPromoMutation.mutate(promoCode.trim().toUpperCase());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            🎟️ Redeem Promo Code
          </DialogTitle>
          <DialogDescription>
            Enter your promo code to claim rewards and bonuses
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="promo-code">Promo Code</Label>
            <Input
              id="promo-code"
              placeholder="Enter your promo code"
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
              disabled={redeemPromoMutation.isPending}
              data-testid="input-promo-code"
            />
          </div>
          
          <div className="flex gap-2">
            <Button
              onClick={handleSubmit}
              disabled={redeemPromoMutation.isPending || !promoCode.trim()}
              className="flex-1"
              data-testid="button-redeem-promo"
            >
              {redeemPromoMutation.isPending ? (
                <>
                  <i className="fas fa-spinner fa-spin mr-2"></i>
                  Redeeming...
                </>
              ) : (
                <>
                  <i className="fas fa-gift mr-2"></i>
                  Redeem Code
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={redeemPromoMutation.isPending}
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}