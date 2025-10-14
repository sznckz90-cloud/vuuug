import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { showNotification } from '@/components/AppNotification';
import Layout from '@/components/Layout';
import { apiRequest } from '@/lib/queryClient';
import { formatCurrency } from '@/lib/utils';
import { useAdmin } from '@/hooks/useAdmin';
import { Link } from 'wouter';
import { PAYMENT_SYSTEMS, type PaymentSystem } from '@/constants/paymentSystems';

interface WithdrawalRequest {
  id: string;
  amount: string;
  method: string;
  status: string;
  details: any;
  createdAt: string;
  updatedAt?: string;
  adminNotes?: string;
}

interface User {
  id: string;
  username?: string;
  telegram_id?: string;
  balance: string;
  [key: string]: any;
}

interface WalletDetails {
  tonWalletAddress: string;
  tonWalletComment: string;
  telegramUsername: string;
  walletUpdatedAt?: string;
  canWithdraw: boolean;
}

interface WithdrawForm {
  paymentSystem: string;
  amount: string;
  paymentDetails: string;
  comment?: string;
}

interface WalletForm {
  tonWalletAddress: string;
  tonWalletComment: string;
  telegramUsername: string;
}

export default function Wallet() {
  // Fetch user data
  const { data: user, isLoading: userLoading } = useQuery<User>({
    queryKey: ['/api/auth/user'],
    retry: false,
  });
  const queryClient = useQueryClient();
  const { isAdmin } = useAdmin();
  const [activeTab, setActiveTab] = useState('withdraw');
  
  // Wallet details form
  const [walletForm, setWalletForm] = useState<WalletForm>({
    tonWalletAddress: '',
    tonWalletComment: '',
    telegramUsername: ''
  });
  
  // Withdraw form
  const [withdrawForm, setWithdrawForm] = useState<WithdrawForm>({
    paymentSystem: 'ton_coin',
    amount: '',
    paymentDetails: '',
    comment: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Fetch wallet details
  const { data: walletDetailsData, isLoading: walletLoading } = useQuery<{ success: boolean; walletDetails: WalletDetails }>({
    queryKey: ['/api/wallet/details'],
    retry: false,
  });

  const walletDetails = walletDetailsData?.walletDetails;

  // Fetch user's withdrawal history
  const { data: withdrawalsData = [], isLoading: withdrawalsLoading } = useQuery<WithdrawalRequest[]>({
    queryKey: ['/api/withdrawals'],
    retry: false,
  });

  // Check if there's a pending withdrawal
  const hasPendingWithdrawal = withdrawalsData.some(w => w.status === 'pending');

  // Update wallet form when wallet details are loaded
  useEffect(() => {
    if (walletDetails) {
      setWalletForm({
        tonWalletAddress: walletDetails.tonWalletAddress || '',
        tonWalletComment: walletDetails.tonWalletComment || '',
        telegramUsername: walletDetails.telegramUsername || ''
      });
    }
  }, [walletDetails]);

  // Auto-fill payment details when payment system or wallet details change
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

  // Save wallet details mutation
  const saveWalletMutation = useMutation({
    mutationFn: async (data: WalletForm) => {
      const response = await apiRequest('POST', '/api/wallet/save', data);
      return response.json();
    },
    onSuccess: () => {
      showNotification("Saved! 24h hold applied.", "success");
      queryClient.invalidateQueries({ queryKey: ['/api/wallet/details'] });
    },
    onError: (error: any) => {
      showNotification(error.message || "Failed to save wallet details", "error");
    },
  });

  // Helper function for amount formatting
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

  // Get selected payment system
  const selectedPaymentSystem = PAYMENT_SYSTEMS.find(ps => ps.id === withdrawForm.paymentSystem);
  
  // Calculate fee
  const calculateFee = (amount: number, paymentSystem: typeof selectedPaymentSystem): number => {
    if (!paymentSystem) return 0;
    if (paymentSystem.feeType === 'percentage') {
      return (amount * paymentSystem.fee) / 100;
    }
    return paymentSystem.fee;
  };

  // Calculate amount after fee
  const calculateAmountAfterFee = (): { fee: number; afterFee: number } => {
    const amount = parseFloat(withdrawForm.amount) || 0;
    if (!selectedPaymentSystem) return { fee: 0, afterFee: amount };
    
    const fee = calculateFee(amount, selectedPaymentSystem);
    return { fee, afterFee: amount - fee };
  };

  const validateWithdrawForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    const amount = parseFloat(withdrawForm.amount);

    // Check for pending withdrawal
    if (hasPendingWithdrawal) {
      showNotification("Cannot create new request until current one is processed", "error");
      return false;
    }

    // Check for 24-hour hold
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

  const handleSaveWallet = (e: React.FormEvent) => {
    e.preventDefault();
    saveWalletMutation.mutate(walletForm);
  };

  const handleSubmitWithdraw = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateWithdrawForm()) {
      withdrawMutation.mutate(withdrawForm);
    }
  };

  const updateWalletForm = (field: keyof WalletForm, value: string) => {
    setWalletForm(prev => ({ ...prev, [field]: value }));
  };

  const updateWithdrawForm = (field: keyof WithdrawForm, value: string) => {
    setWithdrawForm(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const getStatusTextColor = (status: string) => {
    switch (status) {
      case 'paid':
      case 'Approved':
      case 'Successfull':
        return 'text-green-600';
      case 'pending':
        return 'text-orange-600';
      case 'rejected':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'paid':
      case 'Approved':
      case 'Successfull':
        return 'Successful';
      case 'pending':
        return 'Pending';
      case 'rejected':
        return 'Rejected';
      default:
        return 'Unknown';
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    const day = date.getUTCDate().toString().padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[date.getUTCMonth()];
    const year = date.getUTCFullYear();
    const hours = date.getUTCHours().toString().padStart(2, '0');
    const minutes = date.getUTCMinutes().toString().padStart(2, '0');
    return `${day} ${month} ${year}, ${hours}:${minutes} UTC`;
  };

  if (userLoading) {
    return (
      <Layout>
        <div className="max-w-md mx-auto p-4 pb-20">
          <div className="text-center py-8">
            <div className="animate-spin text-primary text-xl mb-2">
              <i className="fas fa-spinner"></i>
            </div>
            <div className="text-muted-foreground">Loading wallet...</div>
          </div>
        </div>
      </Layout>
    );
  }

  const { fee, afterFee } = calculateAmountAfterFee();

  return (
    <Layout>
      <div className="max-w-md mx-auto p-4 pb-20">
        {/* User Info & Balance Section */}
        <div className="mb-4">
          <div className="bg-gradient-to-r from-primary to-secondary p-4 rounded-xl shadow-lg">
            <div className="flex items-center justify-between mb-2">
              {/* User Info - Top Left */}
              <div>
                <div className="text-white font-medium text-sm">@{user?.username || user?.telegram_id}</div>
                <div className="text-primary-foreground/70 text-xs">UID: {user?.referralCode}</div>
              </div>
              
              {/* Admin Dashboard Button - Top Right */}
              {isAdmin && (
                <Link href="/admin">
                  <Button variant="secondary" size="sm" className="gap-2 h-8">
                    <i className="fas fa-cog text-xs"></i>
                    <span className="text-xs">Dashboard</span>
                  </Button>
                </Link>
              )}
            </div>
            
            {/* Balance - Centered */}
            <div className="text-center">
              <div className="text-primary-foreground/80 text-xs font-medium">Balance</div>
              <div className="text-2xl font-bold text-white">
                {Math.round(parseFloat(user?.balance || "0") * 100000)} PAD
              </div>
              <div className="text-primary-foreground/70 text-xs">
                ≈ ${(Math.round(parseFloat(user?.balance || "0") * 100000) / 200000).toFixed(2)} USD
              </div>
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-3">
          <TabsList className="grid w-full grid-cols-3 h-12 bg-muted/50">
            <TabsTrigger value="wallets" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <i className="fas fa-wallet mr-2"></i>
              <span>Wallets</span>
            </TabsTrigger>
            <TabsTrigger value="withdraw" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <i className="fas fa-arrow-down mr-2"></i>
              <span>Withdraw</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <i className="fas fa-history mr-2"></i>
              <span>History</span>
            </TabsTrigger>
          </TabsList>

          {/* My Wallets Tab */}
          <TabsContent value="wallets" className="space-y-3">
            <Card className="neon-glow-border shadow-lg">
              <CardHeader className="py-3">
                <CardTitle className="text-base font-medium">My Wallets</CardTitle>
                <CardDescription className="text-xs">Enter your payment details to withdraw earned funds.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSaveWallet} className="space-y-4">
                  {/* TON Section */}
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">TON</Label>
                    <Input
                      placeholder="Address"
                      value={walletForm.tonWalletAddress}
                      onChange={(e) => updateWalletForm('tonWalletAddress', e.target.value)}
                    />
                    <Input
                      placeholder="Optional comment"
                      value={walletForm.tonWalletComment}
                      onChange={(e) => updateWalletForm('tonWalletComment', e.target.value)}
                    />
                  </div>

                  {/* Telegram Section */}
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">TELEGRAM</Label>
                    <Input
                      placeholder="Username for premium/stars"
                      value={walletForm.telegramUsername}
                      onChange={(e) => updateWalletForm('telegramUsername', e.target.value)}
                    />
                  </div>

                  {/* Notice */}
                  <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <i className="fas fa-info-circle text-orange-600 dark:text-orange-400 mt-0.5"></i>
                      <p className="text-xs text-orange-800 dark:text-orange-300">
                        After changing the payment details, the possibility of withdrawal is put on hold for 24 hours.
                      </p>
                    </div>
                  </div>

                  {/* Save Button */}
                  <Button 
                    type="submit" 
                    className="w-full"
                    disabled={saveWalletMutation.isPending}
                  >
                    {saveWalletMutation.isPending ? (
                      <>
                        <i className="fas fa-spinner fa-spin mr-2"></i>
                        Saving...
                      </>
                    ) : (
                      <>
                        <i className="fas fa-save mr-2"></i>
                        Save
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Withdraw Tab */}
          <TabsContent value="withdraw" className="space-y-3">
            <Card className="neon-glow-border shadow-lg">
              <CardHeader className="py-3">
                <CardTitle className="text-base font-medium">Withdraw funds</CardTitle>
                <CardDescription className="text-xs">Choose the payment system</CardDescription>
              </CardHeader>
              
              <CardContent className="p-3 pt-2">
                <form onSubmit={handleSubmitWithdraw} className="space-y-3">
                  {/* Payment System Selector */}
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

                  {/* Wallet Input - Auto-filled */}
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

                  {/* Payout Amount */}
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

                  {/* Fee Display */}
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

                  {/* Comment (Optional) */}
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

                  {/* Warning Messages */}
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
                          You have a pending withdrawal request. Cannot create a new one until it's processed.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Submit Button */}
                  <Button 
                    type="submit" 
                    className="w-full"
                    disabled={
                      withdrawMutation.isPending || 
                      !user?.balance || 
                      parseFloat(user?.balance || '0') < 0.001 ||
                      (walletDetails && !walletDetails.canWithdraw) ||
                      hasPendingWithdrawal
                    }
                  >
                    {withdrawMutation.isPending ? (
                      <>
                        <i className="fas fa-spinner fa-spin mr-2"></i>
                        Submitting...
                      </>
                    ) : (
                      <>
                        <i className="fas fa-paper-plane mr-2"></i>
                        Submit Withdrawal Request
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Minimum Withdrawal & Fees Table */}
            <Card className="neon-glow-border shadow-lg">
              <CardHeader className="py-3">
                <CardTitle className="text-sm font-medium">Minimum Withdrawal & Fees</CardTitle>
              </CardHeader>
              <CardContent className="p-3">
                <div className="space-y-2">
                  {PAYMENT_SYSTEMS.map(ps => (
                    <div key={ps.id} className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{ps.emoji}</span>
                        <div>
                          <div className="text-sm font-medium">{ps.name}</div>
                          <div className="text-xs text-muted-foreground">
                            Min: {ps.minWithdrawal} {ps.name === 'TON Coin' ? 'TON' : 'USD'}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium">
                          {ps.feeType === 'percentage' ? `${ps.fee}%` : `${ps.fee} ${ps.name === 'TON Coin' ? 'TON' : 'USD'}`}
                        </div>
                        <div className="text-xs text-muted-foreground">Fee</div>
                      </div>
                    </div>
                  ))}
                  <div className="text-xs text-muted-foreground pt-2">
                    Note: 1⭐ = $0.02
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="space-y-3">
            <Card className="neon-glow-border shadow-lg">
              <CardHeader className="py-2 pb-1.5">
                <CardTitle className="text-base font-medium flex items-center gap-2">
                  <i className="fas fa-history text-muted-foreground text-sm"></i>
                  History
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {withdrawalsLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin text-primary text-base mb-1">
                      <i className="fas fa-spinner"></i>
                    </div>
                    <div className="text-muted-foreground text-xs">Loading...</div>
                  </div>
                ) : withdrawalsData.length > 0 ? (
                  <div className="max-h-[400px] overflow-y-auto px-3 pb-3">
                    <div className="space-y-0 divide-y divide-border/50">
                      {[...withdrawalsData].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((withdrawal) => (
                        <div key={withdrawal.id} className="flex items-center justify-between py-2 first:pt-0">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                              withdrawal.status === 'paid' || withdrawal.status === 'Approved' || withdrawal.status === 'Successfull' 
                                ? 'bg-green-500' 
                                : withdrawal.status === 'pending' 
                                ? 'bg-orange-500' 
                                : 'bg-red-500'
                            }`}></div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-semibold text-sm text-foreground">{Math.round(parseFloat(withdrawal.amount) * 100000)} PAD</span>
                                <span className={`text-xs font-medium ${getStatusTextColor(withdrawal.status)}`}>
                                  {getStatusLabel(withdrawal.status)}
                                </span>
                              </div>
                              <div className="text-[10px] text-muted-foreground truncate">
                                {formatDateTime(withdrawal.createdAt)}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <i className="fas fa-receipt text-2xl text-muted-foreground mb-2"></i>
                    <div className="text-muted-foreground text-sm">No history</div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
