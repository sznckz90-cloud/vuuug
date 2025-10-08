import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { showNotification } from '@/components/AppNotification';
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

  // Show all withdrawal requests in user's history
  const withdrawals = withdrawalsData;

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
      newErrors.paymentDetails = 'Wallet address is required';
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
      showNotification("💸 Withdrawal request sent!", "success");
      
      // Reset form
      setWithdrawForm({ amount: '', paymentDetails: '', comment: '' });
      setErrors({});
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['/api/withdrawals'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user/stats'] });
    },
    onError: (error: any) => {
      showNotification("⚠️ " + (error.message || "Withdrawal failed"), "error");
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

  const getStatusBorderColor = (status: string) => {
    switch (status) {
      case 'paid':
      case 'Approved':
      case 'Successfull':
        return 'border-green-600';
      case 'pending':
        return 'border-orange-600';
      case 'rejected':
        return 'border-red-600';
      default:
        return 'border-gray-600';
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
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-3">
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
        <TabsContent value="balance" className="space-y-3">
          {/* Current Balance Card */}
          <Card className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground">
            <CardContent className="p-3 text-center">
              <div className="text-primary-foreground/80 text-xs font-medium mb-1">Available Balance</div>
              <div className="text-xl font-bold mb-1">
                {formatCurrency(user?.balance || "0")}
              </div>
              <div className="text-primary-foreground/60 text-[10px]">
                Ready for withdrawal
              </div>
            </CardContent>
          </Card>

          {/* Withdrawal History */}
          <Card>
            <CardHeader className="py-2 pb-1.5">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <i className="fas fa-history text-muted-foreground text-sm"></i>
                History
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-2">
              {withdrawalsLoading ? (
                <div className="text-center py-3">
                  <div className="animate-spin text-primary text-base mb-1">
                    <i className="fas fa-spinner"></i>
                  </div>
                  <div className="text-muted-foreground text-xs">Loading...</div>
                </div>
              ) : withdrawals.length > 0 ? (
                <div className="space-y-0 divide-y divide-border/50">
                  {[...withdrawals].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((withdrawal) => (
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
                            <span className="font-semibold text-sm text-foreground">{formatCurrency(withdrawal.amount)}</span>
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
              ) : (
                <div className="text-center py-4">
                  <i className="fas fa-receipt text-2xl text-muted-foreground mb-2"></i>
                  <div className="text-muted-foreground text-sm">No history</div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Withdraw Tab */}
        <TabsContent value="withdraw" className="space-y-3">
          <Card>
            <CardHeader className="py-2 pb-1.5">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <i className="fas fa-money-bill-wave text-primary text-sm"></i>
                Request Withdrawal
              </CardTitle>
            </CardHeader>
            
            <CardContent className="p-3 pt-2">
              <form onSubmit={handleSubmitWithdraw} className="space-y-3">
                {/* Amount */}
                <div className="space-y-2">
                  <div className="relative">
                    <Input
                      id="amount"
                      type="number"
                      step="0.00001"
                      min="0.5"
                      max={autoRoundAmount(user?.balance || "0")}
                      value={withdrawForm.amount}
                      onChange={(e) => updateForm('amount', e.target.value)}
                      placeholder="Enter amount"
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
                  <Input
                    id="paymentDetails"
                    value={withdrawForm.paymentDetails}
                    onChange={(e) => updateForm('paymentDetails', e.target.value)}
                    placeholder="Address"
                    className={errors.paymentDetails ? 'border-red-500' : ''}
                  />
                  {errors.paymentDetails && <p className="text-sm text-red-500">{errors.paymentDetails}</p>}
                </div>

                {/* Comment (Optional) */}
                <div className="space-y-2">
                  <Input
                    id="comment"
                    value={withdrawForm.comment || ''}
                    onChange={(e) => updateForm('comment', e.target.value)}
                    placeholder="Comment (optional)"
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