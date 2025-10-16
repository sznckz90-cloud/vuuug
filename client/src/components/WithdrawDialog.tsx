import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { showNotification } from '@/components/AppNotification';
import { apiRequest } from '@/lib/queryClient';
import { Gem, Star } from 'lucide-react';
import { tonToPAD, padToUSD, PAD_TO_USD } from '@shared/constants';

interface User {
  id: string;
  balance: string;
}

interface WalletDetails {
  tonWalletAddress: string;
  tonWalletComment: string;
  telegramUsername: string;
  canWithdraw: boolean;
}

interface WithdrawDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function WithdrawDialog({ open, onOpenChange }: WithdrawDialogProps) {
  const queryClient = useQueryClient();
  const [paymentSystem, setPaymentSystem] = useState<'ton_coin' | 'telegram_stars'>('ton_coin');
  const [amountPAD, setAmountPAD] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: user } = useQuery<User>({
    queryKey: ['/api/auth/user'],
    retry: false,
  });

  const { data: walletDetailsData } = useQuery<{ success: boolean; walletDetails: WalletDetails }>({
    queryKey: ['/api/wallet/details'],
    retry: false,
  });

  const walletDetails = walletDetailsData?.walletDetails;
  const balancePAD = tonToPAD(user?.balance || "0");

  const { data: withdrawalsData = [] } = useQuery<any[]>({
    queryKey: ['/api/withdrawals'],
    retry: false,
  });

  const hasPendingWithdrawal = withdrawalsData.some(w => w.status === 'pending');

  const calculateWithdrawalDetails = () => {
    const amount = parseInt(amountPAD) || 0;
    const amountUSD = padToUSD(amount);
    
    if (paymentSystem === 'ton_coin') {
      const fee = amountUSD * 0.04;
      const afterFee = amountUSD - fee;
      return { afterFee: afterFee.toFixed(2) };
    } else {
      const stars = amount / 4500;
      const fee = stars * 0.01;
      const afterFee = stars - fee;
      return { afterFee: afterFee.toFixed(2) };
    }
  };

  const withdrawMutation = useMutation({
    mutationFn: async () => {
      const amountTON = padToUSD(parseInt(amountPAD)).toFixed(8);
      const response = await apiRequest('POST', '/api/withdrawals', {
        amount: amountTON,
        paymentSystemId: paymentSystem,
        paymentDetails: paymentSystem === 'ton_coin' ? walletDetails?.tonWalletAddress : walletDetails?.telegramUsername,
        comment: paymentSystem === 'ton_coin' ? walletDetails?.tonWalletComment : ''
      });
      return response.json();
    },
    onSuccess: () => {
      showNotification("💸 Withdrawal request submitted!", "success");
      setAmountPAD('');
      setErrors({});
      queryClient.invalidateQueries({ queryKey: ['/api/withdrawals'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      showNotification(error.message || "Withdrawal failed", "error");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseInt(amountPAD) || 0;
    const newErrors: Record<string, string> = {};

    if (!walletDetails || (paymentSystem === 'ton_coin' && !walletDetails.tonWalletAddress) || (paymentSystem === 'telegram_stars' && !walletDetails.telegramUsername)) {
      showNotification("Please save wallet details first.", "error");
      return;
    }

    if (hasPendingWithdrawal) {
      showNotification("Cannot create new request until current one is processed", "error");
      return;
    }

    if (walletDetails && !walletDetails.canWithdraw) {
      showNotification("Withdrawal on hold for 24 hours after updating wallet", "error");
      return;
    }

    const minPAD = paymentSystem === 'ton_coin' ? 400000 : 100000;
    const maxPAD = 2000000;

    if (!amountPAD || amount <= 0) {
      newErrors.amount = 'Please enter a valid amount';
    } else if (amount < minPAD) {
      newErrors.amount = `Not more than ${minPAD.toLocaleString()} PAD`;
    } else if (amount > maxPAD) {
      newErrors.amount = `Maximum is ${maxPAD.toLocaleString()} PAD`;
    } else if (amount > balancePAD) {
      newErrors.amount = 'Insufficient balance';
    }

    setErrors(newErrors);
    if (Object.keys(newErrors).length === 0) {
      withdrawMutation.mutate();
    }
  };

  const details = calculateWithdrawalDetails();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Withdraw funds</DialogTitle>
          <p className="text-sm text-muted-foreground">100,000 PAD = $1</p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={paymentSystem === 'ton_coin' ? 'default' : 'outline'}
              onClick={() => setPaymentSystem('ton_coin')}
            >
              <Gem className="w-4 h-4 mr-2" />
              TON Coin
            </Button>
            <Button
              type="button"
              variant={paymentSystem === 'telegram_stars' ? 'default' : 'outline'}
              onClick={() => setPaymentSystem('telegram_stars')}
            >
              <Star className="w-4 h-4 mr-2" />
              Telegram Stars
            </Button>
          </div>

          <div className="space-y-2">
            <Label>Wallet Address</Label>
            <Input
              value={paymentSystem === 'ton_coin' ? (walletDetails?.tonWalletAddress || '') : (walletDetails?.telegramUsername || '')}
              readOnly
              className="bg-muted"
              placeholder={walletDetails ? "Loaded from wallet" : "Please set wallet details first"}
            />
          </div>

          <div className="space-y-2">
            <Label>Payout Amount (PAD)</Label>
            <div className="relative">
              <Input
                type="number"
                step="1"
                value={amountPAD}
                onChange={(e) => setAmountPAD(e.target.value)}
                placeholder="Enter amount in PAD"
                className={errors.amount ? 'border-red-500' : ''}
              />
              <Button 
                type="button"
                size="sm"
                variant="ghost"
                className="absolute right-2 top-1/2 -translate-y-1/2 h-6 px-2 text-xs"
                onClick={() => setAmountPAD(balancePAD.toString())}
              >
                MAX
              </Button>
            </div>
            {errors.amount && <p className="text-sm text-red-500">{errors.amount}</p>}
            <p className="text-xs text-muted-foreground">
              {paymentSystem === 'ton_coin' 
                ? 'Mini: 400,000 PAD | Max: 2,000,000 PAD'
                : 'Mini: 100,000 PAD | Max: 2,000,000 PAD'
              }
            </p>
          </div>

          {amountPAD && parseInt(amountPAD) > 0 && (
            <div className="bg-muted/50 rounded-lg p-3 space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Fee:</span>
                <span className="font-medium">{paymentSystem === 'ton_coin' ? '4%' : '1%'}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Will be credited to wallet:</span>
                <span className="font-semibold text-primary">${details.afterFee}</span>
              </div>
            </div>
          )}

          <Button type="submit" className="w-full" disabled={withdrawMutation.isPending}>
            {withdrawMutation.isPending ? (
              <>
                <i className="fas fa-spinner fa-spin mr-2"></i>
                Processing...
              </>
            ) : (
              'Submit withdrawal request'
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
