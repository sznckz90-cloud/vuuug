import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import Layout from '@/components/Layout';
import { apiRequest } from '@/lib/queryClient';
import { formatCurrency } from '@/lib/utils';

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
  balance: string;
  [key: string]: any;
}

interface WithdrawForm {
  amount: string;
  paymentDetails: string;
  comment?: string;
}

export default function Wallet() {
  // Fetch user data
  const { data: user, isLoading: userLoading } = useQuery<User>({
    queryKey: ['/api/auth/user'],
    retry: false,
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('balance');
  const [withdrawForm, setWithdrawForm] = useState<WithdrawForm>({
    amount: '',
    paymentDetails: '',
    comment: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Fetch user's withdrawal history
  const { data: withdrawalsData = [], isLoading: withdrawalsLoading } = useQuery<WithdrawalRequest[]>({
    queryKey: ['/api/withdrawals'],
    retry: false,
  });

  // Filter withdrawals to only show 'pending' and 'paid' statuses (hide 'rejected' from user view)
  const withdrawals = withdrawalsData.filter(withdrawal => 
    withdrawal.status === 'pending' || withdrawal.status === 'paid'
  );

  // Helper function to preserve exact balance value, limit to 5 decimals, and remove trailing zeros
  const autoRoundAmount = (value: string | number): string => {
    // Convert to string to work with original value
    let valueStr = typeof value === 'string' ? value : value.toString();
    
    // Parse to check if valid number (allow zero)
    const num = parseFloat(valueStr);
    if (isNaN(num)) return '0';
    
    // Return zero immediately if value is zero
    if (num === 0) return '0';
    
    // Keep working with original string (don't use num.toString() which loses precision)
    // Handle scientific notation by converting back only if needed
    if (valueStr.includes('e') || valueStr.includes('E')) {
      valueStr = num.toString();
    }
    
    // If there's a decimal point
    if (valueStr.includes('.')) {
      let [whole, decimals] = valueStr.split('.');
      
      // Remove trailing zeros from the FULL fractional part first
      decimals = decimals.replace(/0+$/, '');
      
      // Then limit to max 5 decimal places
      decimals = decimals.substring(0, 5);
      
      // If no significant decimals remain, return whole number only
      if (decimals.length === 0 || decimals === '' || parseInt(decimals) === 0) {
        return whole;
      } else {
        return `${whole}.${decimals}`;
      }
    }
    
    return valueStr;
  };

  // TON address validation function
  const validateTONAddress = (address: string): boolean => {
    if (!address || address.length !== 48) {
      return false;
    }
    
    // Check if it starts with UQ or EQ (user-friendly format)
    if (!address.startsWith('UQ') && !address.startsWith('EQ')) {
      return false;
    }
    
    // Check if the rest contains only valid base64url characters (includes - and _)
    const base64Part = address.slice(2);
    const base64Regex = /^[A-Za-z0-9+/\-_]+={0,2}$/;
    return base64Regex.test(base64Part);
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    // Round amount to 5 decimal places for validation
    const amount = parseFloat(parseFloat(withdrawForm.amount).toFixed(5));
    const userBalance = parseFloat(parseFloat(user?.balance || '0').toFixed(5));

    if (!withdrawForm.amount || amount <= 0) {
      newErrors.amount = 'Please enter a valid amount';
    } else if (amount > userBalance) {
      newErrors.amount = 'Insufficient balance';
    } else if (amount < 0.5) {
      newErrors.amount = 'Minimum withdraw amount is 0.5 TON';
    }

    if (!withdrawForm.paymentDetails.trim()) {
      newErrors.paymentDetails = 'TON wallet address is required';
    } else if (!validateTONAddress(withdrawForm.paymentDetails.trim())) {
      newErrors.paymentDetails = 'Please enter a valid TON address (format: UQ... or EQ...)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const withdrawMutation = useMutation({
    mutationFn: async (withdrawData: WithdrawForm) => {
      // Send the exact amount as entered by user (preserves decimals)
      const response = await apiRequest('POST', '/api/withdrawals', {
        amount: withdrawData.amount,
        paymentSystemId: 'ton_coin',
        paymentDetails: withdrawData.paymentDetails,
        comment: withdrawData.comment || ''
      });

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Withdrawal Request Submitted! ✅",
        description: "Your withdrawal request has been sent to admin for approval.",
      });
      
      // Reset form
      setWithdrawForm({ amount: '', paymentDetails: '', comment: '' });
      setErrors({});
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['/api/withdrawals'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user/stats'] });
    },
    onError: (error: any) => {
      toast({
        title: "Withdrawal Failed",
        description: error.message || "Failed to submit withdrawal request",
        variant: "destructive",
      });
    },
  });

  const handleSubmitWithdraw = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      withdrawMutation.mutate(withdrawForm);
    }
  };

  const updateForm = (field: keyof WithdrawForm, value: string) => {
    setWithdrawForm(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-500';
      case 'pending': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid': return 'fas fa-check-circle';
      case 'pending': return 'fas fa-clock';
      default: return 'fas fa-question-circle';
    }
  };

  if (userLoading) {
    return (
      <div className="max-w-md mx-auto p-4 pb-20">
        <div className="text-center py-8">
          <div className="animate-spin text-primary text-xl mb-2">
            <i className="fas fa-spinner"></i>
          </div>
          <div className="text-muted-foreground">Loading wallet...</div>
        </div>
      </div>
    );
  }

  return (
    <Layout>
      <div className="max-w-md mx-auto p-4 pb-20">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Wallet</h1>
        <p className="text-sm text-muted-foreground">Manage your balance and withdrawals</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="balance">
            <i className="fas fa-wallet mr-2"></i>
            Balance
          </TabsTrigger>
          <TabsTrigger value="withdraw">
            <i className="fas fa-arrow-down mr-2"></i>
            Withdraw
          </TabsTrigger>
        </TabsList>

        {/* Balance Tab */}
        <TabsContent value="balance" className="space-y-4">
          {/* Current Balance Card */}
          <Card className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground">
            <CardContent className="p-4 text-center">
              <div className="text-primary-foreground/80 text-sm font-medium mb-2">Available Balance</div>
              <div className="text-2xl font-bold mb-2">
                {formatCurrency(user?.balance || "0")}
              </div>
              <div className="text-primary-foreground/60 text-xs">
                Ready for withdrawal
              </div>
            </CardContent>
          </Card>

          {/* Recent Withdrawals */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <i className="fas fa-history text-muted-foreground"></i>
                Recent Withdrawals
              </CardTitle>
            </CardHeader>
            <CardContent>
              {withdrawalsLoading ? (
                <div className="text-center py-4">
                  <div className="animate-spin text-primary text-lg mb-2">
                    <i className="fas fa-spinner"></i>
                  </div>
                  <div className="text-muted-foreground text-sm">Loading...</div>
                </div>
              ) : withdrawals.length > 0 ? (
                <div className="space-y-3">
                  {withdrawals.slice(0, 5).map((withdrawal) => (
                    <div key={withdrawal.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${getStatusColor(withdrawal.status)}`}>
                          <i className={`${getStatusIcon(withdrawal.status)} text-white text-sm`}></i>
                        </div>
                        <div>
                          <div className="font-medium">{formatCurrency(withdrawal.amount)}</div>
                          <div className="text-sm text-muted-foreground">{withdrawal.method}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge 
                          variant={withdrawal.status === 'paid' ? 'default' : 'secondary'}
                          className="text-xs"
                        >
                          {withdrawal.status === 'paid' ? 'Paid' : 'Pending'}
                        </Badge>
                        <div className="text-xs text-muted-foreground mt-1">
                          {new Date(withdrawal.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <i className="fas fa-receipt text-3xl text-muted-foreground mb-3"></i>
                  <div className="text-muted-foreground">No withdrawal history</div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Withdraw Tab */}
        <TabsContent value="withdraw" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <i className="fas fa-money-bill-wave text-primary"></i>
                Request Withdrawal
              </CardTitle>
            </CardHeader>
            
            <CardContent>
              <form onSubmit={handleSubmitWithdraw} className="space-y-4">
                {/* Amount */}
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount</Label>
                  <div className="relative">
                    <Input
                      id="amount"
                      type="number"
                      step="0.00001"
                      min="0.5"
                      max={autoRoundAmount(user?.balance || "0")}
                      value={withdrawForm.amount}
                      onChange={(e) => updateForm('amount', e.target.value)}
                      placeholder="Amount"
                      className={errors.amount ? 'border-red-500' : ''}
                    />
                    <Button 
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-6 px-2 text-xs"
                      onClick={() => updateForm('amount', autoRoundAmount(user?.balance || '0'))}
                    >
                      MAX
                    </Button>
                  </div>
                  {errors.amount && <p className="text-sm text-red-500">{errors.amount}</p>}
                  <p className="text-xs text-muted-foreground">
                    Available: {formatCurrency(user?.balance || "0")}
                  </p>
                </div>

                {/* Wallet Address */}
                <div className="space-y-2">
                  <Label htmlFor="paymentDetails">Wallet Address</Label>
                  <Input
                    id="paymentDetails"
                    value={withdrawForm.paymentDetails}
                    onChange={(e) => updateForm('paymentDetails', e.target.value)}
                    placeholder="UQD..."
                    className={errors.paymentDetails ? 'border-red-500' : ''}
                  />
                  {errors.paymentDetails && <p className="text-sm text-red-500">{errors.paymentDetails}</p>}
                </div>

                {/* Comment (Optional) */}
                <div className="space-y-2">
                  <Label htmlFor="comment">Comment (Optional)</Label>
                  <Input
                    id="comment"
                    value={withdrawForm.comment || ''}
                    onChange={(e) => updateForm('comment', e.target.value)}
                    placeholder="Add a note for admin"
                    maxLength={200}
                  />
                </div>

                {/* Submit Button */}
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={withdrawMutation.isPending || !user?.balance || parseFloat(user?.balance || '0') < 0.001}
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
        </TabsContent>
      </Tabs>
      </div>
    </Layout>
  );
}