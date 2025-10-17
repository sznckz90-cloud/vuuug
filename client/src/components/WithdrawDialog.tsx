import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface User {
  id: string;
  tonBalance: string;
}

interface WithdrawDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function WithdrawDialog({ open, onOpenChange }: WithdrawDialogProps) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [comment, setComment] = useState('');
  const { toast } = useToast();

  const { data: user } = useQuery<User>({
    queryKey: ['/api/user'],
    retry: false,
  });

  const tonBalance = parseFloat(user?.tonBalance || "0");

  const { data: withdrawalsData = [] } = useQuery<any[]>({
    queryKey: ['/api/withdrawals'],
    retry: false,
  });

  const hasPendingWithdrawal = withdrawalsData.some(w => w.status === 'pending');

  const withdrawMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/withdrawals', {
        amount: parseFloat(amount),
        walletAddress: walletAddress.trim() || undefined,
        comment: comment.trim() || undefined
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "✅ Withdrawal request submitted!",
        description: "Your withdrawal will be processed soon.",
      });
      setAmount('');
      setWalletAddress('');
      setComment('');
      queryClient.invalidateQueries({ queryKey: ['/api/withdrawals'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "❌ Withdrawal failed",
        description: error.message || "Failed to submit withdrawal request",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const withdrawAmount = parseFloat(amount);

    if (hasPendingWithdrawal) {
      toast({
        title: "Pending withdrawal exists",
        description: "Cannot create new request until current one is processed",
        variant: "destructive",
      });
      return;
    }

    if (!amount || isNaN(withdrawAmount) || withdrawAmount <= 0) {
      toast({
        title: "Invalid amount",
        description: "Please enter a valid withdrawal amount",
        variant: "destructive",
      });
      return;
    }

    if (withdrawAmount < 0.01) {
      toast({
        title: "Minimum withdrawal",
        description: "Minimum withdrawal is 0.01 TON",
        variant: "destructive",
      });
      return;
    }

    if (withdrawAmount > tonBalance) {
      toast({
        title: "Insufficient balance",
        description: "Insufficient TON balance",
        variant: "destructive",
      });
      return;
    }

    withdrawMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-[#0a0a0a] border border-white/20">
        <DialogHeader>
          <DialogTitle className="text-foreground">Withdraw TON</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Minimum: 0.01 TON • No fees
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label className="text-foreground">Amount (TON)</Label>
            <div className="relative">
              <Input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter TON amount"
                className="bg-[#111111] border-white/20 text-foreground"
              />
              <Button 
                type="button"
                size="sm"
                variant="ghost"
                className="absolute right-2 top-1/2 -translate-y-1/2 h-6 px-2 text-xs"
                onClick={() => setAmount(tonBalance.toString())}
              >
                MAX
              </Button>
            </div>
            <div className="text-xs text-muted-foreground">
              Available: {tonBalance.toFixed(4)} TON
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-foreground">Wallet Address (Optional)</Label>
            <Input
              value={walletAddress}
              onChange={(e) => setWalletAddress(e.target.value)}
              placeholder="Enter TON wallet address"
              className="bg-[#111111] border-white/20 text-foreground"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-foreground">Comment (Optional)</Label>
            <Input
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add a comment"
              className="bg-[#111111] border-white/20 text-foreground"
            />
          </div>

          <Button 
            type="submit" 
            className="w-full bg-[#3da9fc] hover:bg-[#3da9fc]/90 text-white" 
            disabled={withdrawMutation.isPending}
          >
            {withdrawMutation.isPending ? (
              <>
                <i className="fas fa-spinner fa-spin mr-2"></i>
                Processing...
              </>
            ) : (
              'Withdraw'
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
