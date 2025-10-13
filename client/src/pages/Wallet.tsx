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
import { useAdmin } from '@/hooks/useAdmin';
import { Link } from 'wouter';

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
  const { isAdmin } = useAdmin();
  const [activeTab, setActiveTab] = useState('wallet');
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
      {/* Balance Section - Prominent Display */}
      <div className="mb-4">
        <div className="bg-gradient-to-r from-primary to-secondary p-4 rounded-xl shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="text-primary-foreground/80 text-sm font-medium">Balance</div>
            {/* Admin Dashboard Button */}
            {isAdmin && (
              <Link href="/admin">
                <Button variant="secondary" size="sm" className="gap-2 h-8">
                  <i className="fas fa-cog text-xs"></i>
                  <span className="text-xs">Dashboard</span>
                </Button>
              </Link>
            )}
          </div>
          <div className="text-3xl font-bold text-white mb-1">
            {Math.round(parseFloat(user?.balance || "0") * 100000)} PAD
          </div>
          <div className="text-primary-foreground/70 text-xs">
            ≈ ${(Math.round(parseFloat(user?.balance || "0") * 100000) / 200000).toFixed(2)} USD
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-3">
        <TabsList className="grid w-full grid-cols-3 h-12 bg-muted/50">
          <TabsTrigger value="wallet" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
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

        {/* Wallets Tab */}
        <TabsContent value="wallet" className="space-y-3">
          <Card className="neon-glow-border shadow-lg">
            <CardHeader className="py-3">
              <CardTitle className="text-base font-medium">Payment Methods</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="p-4 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-lg border border-blue-500/20">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center">
                        <i className="fas fa-gem text-blue-400 text-lg"></i>
                      </div>
                      <div>
                        <div className="font-semibold text-sm">TON Wallet</div>
                        <div className="text-xs text-muted-foreground">Cryptocurrency</div>
                      </div>
                    </div>
                    <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30">Active</Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-3">
          {/* Withdrawal History in Scrollable Box */}
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
              ) : withdrawals.length > 0 ? (
                <div className="max-h-[400px] overflow-y-auto px-3 pb-3">
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

        {/* Withdraw Tab */}
        <TabsContent value="withdraw" className="space-y-3">
          <Card className="neon-glow-border shadow-lg">
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
                    Available: {Math.round(parseFloat(user?.balance || "0") * 100000)} PAD
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