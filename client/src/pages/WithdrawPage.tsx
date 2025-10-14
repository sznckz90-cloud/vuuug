import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { showNotification } from '@/components/AppNotification';
import Layout from '@/components/Layout';
import { apiRequest } from '@/lib/queryClient';
import { PAYMENT_SYSTEMS, type PaymentSystem } from '@/constants/paymentSystems';
import { Link } from 'wouter';

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

interface WithdrawForm {
  paymentSystem: string;
  amount: string;
  paymentDetails: string;
  comment?: string;
}

interface WithdrawalRequest {
  id: string;
  status: string;
}

export default function WithdrawPage() {
  const queryClient = useQueryClient();
  
  const [withdrawForm, setWithdrawForm] = useState<WithdrawForm>({
    paymentSystem: 'ton_coin',
    amount: '',
    paymentDetails: '',
    comment: ''
  });
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

  const { data: withdrawalsData = [] } = useQuery<WithdrawalRequest[]>({
    queryKey: ['/api/withdrawals'],
    retry: false,
  });

  const hasPendingWithdrawal = withdrawalsData.some(w => w.status === 'pending');

  useEffect(() => {
    if (walletDetails && withdrawForm.paymentSystem) {
      if (withdrawForm.paymentSystem === 'ton_coin') {
        setWithdrawForm(prev => ({
          ...prev,
          paymentDetails: walletDetails.tonWalletAddress || '',
          comment: walletDetails.tonWalletComment || ''
        }));
      } else if (withdrawForm.paymentSystem === 'telegram_premium' || withdrawForm.paymentSystem === 'telegram_stars') {
        setWithdrawForm(prev => ({
          ...prev,
          paymentDetails: walletDetails.telegramUsername || '',
          comment: ''
        }));
      }
    }
  }, [withdrawForm.paymentSystem, walletDetails]);

  const selectedPaymentSystem = PAYMENT_SYSTEMS.find(ps => ps.id === withdrawForm.paymentSystem);

  const calculateFee = (amount: number, paymentSystem: typeof selectedPaymentSystem): number => {
    if (!paymentSystem) return 0;
    if (paymentSystem.feeType === 'percentage') {
      return (amount * paymentSystem.fee) / 100;
    }
    return paymentSystem.fee;
  };

  const calculateAmountAfterFee = (): { fee: number; afterFee: number } => {
    const amount = parseFloat(withdrawForm.amount) || 0;
    if (!selectedPaymentSystem) return { fee: 0, afterFee: amount };
    
    const fee = calculateFee(amount, selectedPaymentSystem);
    return { fee, afterFee: amount - fee };
  };

  const autoRoundAmount = (value: string | number): string => {
    let valueStr = typeof value === 'string' ? value : value.toString();
    const num = parseFloat(valueStr);
    if (isNaN(num)) return '0';
    if (num === 0) return '0';
    if (valueStr.includes('e') || valueStr.includes('E')) {
      valueStr = num.toString();
    }
    if (valueStr.includes('.')) {
      let [whole, decimals] = valueStr.split('.');
      decimals = decimals.replace(/0+$/, '');
      decimals = decimals.substring(0, 5);
      if (decimals.length === 0 || decimals === '' || parseInt(decimals) === 0) {
        return whole;
      } else {
        return `${whole}.${decimals}`;
      }
    }
    return valueStr;
  };

  const validateWithdrawForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    const amount = parseFloat(withdrawForm.amount);

    if (hasPendingWithdrawal) {
      showNotification("Cannot create new request until current one is processed", "error");
      return false;
    }

    if (walletDetails && !walletDetails.canWithdraw) {
      showNotification("Withdrawal on hold for 24 hours after updating wallet", "error");
      return false;
    }

    if (!selectedPaymentSystem) {
      newErrors.paymentSystem = 'Please select a payment system';
    } else {
      if (!withdrawForm.amount || amount <= 0) {
        newErrors.amount = 'Please enter a valid amount';
      } else if (amount < selectedPaymentSystem.minWithdrawal) {
        newErrors.amount = `Minimum withdrawal is ${selectedPaymentSystem.minWithdrawal} ${selectedPaymentSystem.name === 'TON Coin' ? 'TON' : 'USD'}`;
      } else if (amount > parseFloat(user?.balance || '0')) {
        newErrors.amount = 'Insufficient balance';
      }
    }

    if (!withdrawForm.paymentDetails.trim()) {
      newErrors.paymentDetails = 'Payment details are required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const withdrawMutation = useMutation({
    mutationFn: async (data: WithdrawForm) => {
      const response = await apiRequest('POST', '/api/withdrawals', {
        amount: data.amount,
        paymentSystemId: data.paymentSystem,
        paymentDetails: data.paymentDetails,
        comment: data.comment || ''
      });
      return response.json();
    },
    onSuccess: () => {
      showNotification("💸 Withdrawal request submitted!", "success");
      setWithdrawForm({
        paymentSystem: 'ton_coin',
        amount: '',
        paymentDetails: walletDetails?.tonWalletAddress || '',
        comment: walletDetails?.tonWalletComment || ''
      });
      setErrors({});
      queryClient.invalidateQueries({ queryKey: ['/api/withdrawals'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
    },
    onError: (error: any) => {
      showNotification(error.message || "Withdrawal failed", "error");
    },
  });

  const handleSubmitWithdraw = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateWithdrawForm()) {
      withdrawMutation.mutate(withdrawForm);
    }
  };

  const updateWithdrawForm = (field: keyof WithdrawForm, value: string) => {
    setWithdrawForm(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const { fee, afterFee } = calculateAmountAfterFee();

  return (
    <Layout>
      <div className="max-w-md mx-auto p-4 pb-20">
        <div className="flex items-center mb-4">
          <Link href="/wallet">
            <Button variant="ghost" size="sm" className="mr-2">
              <i className="fas fa-arrow-left mr-2"></i>
              Back
            </Button>
          </Link>
          <h1 className="text-xl font-bold">Withdraw</h1>
        </div>

        <Card className="neon-glow-border shadow-lg">
          <CardHeader className="py-3">
            <CardTitle className="text-base font-medium">Withdraw funds</CardTitle>
            <CardDescription className="text-xs">Choose the payment system</CardDescription>
          </CardHeader>
          
          <CardContent className="p-3 pt-2">
            <form onSubmit={handleSubmitWithdraw} className="space-y-3">
              <div className="space-y-2">
                <Label>Payment System</Label>
                <Select 
                  value={withdrawForm.paymentSystem} 
                  onValueChange={(value) => updateWithdrawForm('paymentSystem', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select payment system" />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_SYSTEMS.map(ps => (
                      <SelectItem key={ps.id} value={ps.id}>
                        {ps.emoji} {ps.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.paymentSystem && <p className="text-sm text-red-500">{errors.paymentSystem}</p>}
              </div>

              <div className="space-y-2">
                <Label>Wallet Address</Label>
                <Input
                  value={withdrawForm.paymentDetails}
                  onChange={(e) => updateWithdrawForm('paymentDetails', e.target.value)}
                  placeholder="Payment details"
                  className={errors.paymentDetails ? 'border-red-500' : ''}
                  readOnly={!!walletDetails && withdrawForm.paymentDetails !== ''}
                />
                {errors.paymentDetails && <p className="text-sm text-red-500">{errors.paymentDetails}</p>}
                <p className="text-xs text-muted-foreground">
                  Automatically filled from saved wallet
                </p>
              </div>

              <div className="space-y-2">
                <Label>Payout Amount</Label>
                <div className="relative">
                  <Input
                    type="number"
                    step="0.00001"
                    min={selectedPaymentSystem?.minWithdrawal || 0}
                    max={autoRoundAmount(user?.balance || "0")}
                    value={withdrawForm.amount}
                    onChange={(e) => updateWithdrawForm('amount', e.target.value)}
                    placeholder="Enter amount"
                    className={errors.amount ? 'border-red-500' : ''}
                  />
                  <Button 
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-6 px-2 text-xs"
                    onClick={() => updateWithdrawForm('amount', autoRoundAmount(user?.balance || '0'))}
                  >
                    MAX
                  </Button>
                </div>
                {errors.amount && <p className="text-sm text-red-500">{errors.amount}</p>}
                {selectedPaymentSystem && (
                  <p className="text-xs text-muted-foreground">
                    Minimum: {selectedPaymentSystem.minWithdrawal} {selectedPaymentSystem.name === 'TON Coin' ? 'TON' : 'USD'}
                  </p>
                )}
              </div>

              {selectedPaymentSystem && withdrawForm.amount && parseFloat(withdrawForm.amount) > 0 && (
                <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Fee:</span>
                    <span className="font-medium">
                      {selectedPaymentSystem.feeType === 'percentage' 
                        ? `${selectedPaymentSystem.fee}% (${fee.toFixed(4)})`
                        : `${selectedPaymentSystem.fee} ${selectedPaymentSystem.name === 'TON Coin' ? 'TON' : 'USD'}`
                      }
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Will be credited to wallet:</span>
                    <span className="font-semibold text-primary">{afterFee.toFixed(4)}</span>
                  </div>
                </div>
              )}

              {withdrawForm.paymentSystem === 'ton_coin' && (
                <div className="space-y-2">
                  <Label>Comment (Optional)</Label>
                  <Input
                    value={withdrawForm.comment || ''}
                    onChange={(e) => updateWithdrawForm('comment', e.target.value)}
                    placeholder="Optional comment"
                    maxLength={200}
                  />
                </div>
              )}

              {walletDetails && !walletDetails.canWithdraw && (
                <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <i className="fas fa-clock text-orange-600 dark:text-orange-400 mt-0.5"></i>
                    <p className="text-xs text-orange-800 dark:text-orange-300">
                      Withdrawal is on hold for 24 hours after updating wallet details.
                    </p>
                  </div>
                </div>
              )}

              {hasPendingWithdrawal && (
                <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <i className="fas fa-info-circle text-blue-600 dark:text-blue-400 mt-0.5"></i>
                    <p className="text-xs text-blue-800 dark:text-blue-300">
                      You have a pending withdrawal request. Please wait for it to be processed before creating a new one.
                    </p>
                  </div>
                </div>
              )}

              <Button 
                type="submit"
                className="w-full"
                disabled={withdrawMutation.isPending || hasPendingWithdrawal || (walletDetails && !walletDetails.canWithdraw)}
              >
                {withdrawMutation.isPending ? (
                  <>
                    <i className="fas fa-spinner fa-spin mr-2"></i>
                    Processing...
                  </>
                ) : (
                  <>
                    <i className="fas fa-paper-plane mr-2"></i>
                    Submit Request
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
