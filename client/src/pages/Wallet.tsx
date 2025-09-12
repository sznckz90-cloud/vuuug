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
    paymentDetails: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Fetch user's withdrawal history
  const { data: withdrawals = [], isLoading: withdrawalsLoading } = useQuery<WithdrawalRequest[]>({
    queryKey: ['/api/withdrawals'],
    retry: false,
  });

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    const amount = parseFloat(withdrawForm.amount);
    const userBalance = parseFloat(user?.balance || '0');

    if (!withdrawForm.amount || amount <= 0) {
      newErrors.amount = 'Please enter a valid amount';
    } else if (amount > userBalance) {
      newErrors.amount = 'Insufficient balance';
    } else if (amount < 0.001) {
      newErrors.amount = 'Minimum withdrawal is $0.001';
    }


    if (!withdrawForm.paymentDetails.trim()) {
      newErrors.paymentDetails = 'TON wallet address is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const withdrawMutation = useMutation({
    mutationFn: async (withdrawData: WithdrawForm) => {
      const response = await apiRequest('POST', '/api/withdrawals', {
        amount: withdrawData.amount,
        method: 'ton',
        details: { paymentDetails: withdrawData.paymentDetails }
      });

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Withdrawal Request Submitted! ✅",
        description: "Your withdrawal request has been sent to admin for approval.",
      });
      
      // Reset form
      setWithdrawForm({ amount: '', paymentDetails: '' });
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
      case 'rejected': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid': return 'fas fa-check-circle';
      case 'pending': return 'fas fa-clock';
      case 'rejected': return 'fas fa-times-circle';
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
            <CardContent className="p-6 text-center">
              <div className="text-primary-foreground/80 text-sm font-medium mb-2">Available Balance</div>
              <div className="text-3xl font-bold mb-2">
                ${user ? parseFloat(user.balance || "0").toFixed(5) : "0.00000"}
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
                          <div className="font-medium">${parseFloat(withdrawal.amount).toFixed(5)}</div>
                          <div className="text-sm text-muted-foreground">{withdrawal.method}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge 
                          variant={withdrawal.status === 'paid' ? 'default' : withdrawal.status === 'pending' ? 'secondary' : 'destructive'}
                          className="text-xs"
                        >
                          {withdrawal.status}
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
                  <Label htmlFor="amount">Amount ($)</Label>
                  <div className="relative">
                    <Input
                      id="amount"
                      type="number"
                      step="0.00001"
                      min="0.001"
                      max={user?.balance || "0"}
                      value={withdrawForm.amount}
                      onChange={(e) => updateForm('amount', e.target.value)}
                      placeholder="0.001"
                      className={errors.amount ? 'border-red-500' : ''}
                    />
                    <Button 
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-6 px-2 text-xs"
                      onClick={() => updateForm('amount', user?.balance || '0')}
                    >
                      Max
                    </Button>
                  </div>
                  {errors.amount && <p className="text-sm text-red-500">{errors.amount}</p>}
                  <p className="text-xs text-muted-foreground">
                    Available: ${user ? parseFloat(user.balance || "0").toFixed(5) : "0.00000"}
                  </p>
                </div>


                {/* TON Wallet Address */}
                <div className="space-y-2">
                  <Label htmlFor="paymentDetails">Ton Wallet Address</Label>
                  <Input
                    id="paymentDetails"
                    value={withdrawForm.paymentDetails}
                    onChange={(e) => updateForm('paymentDetails', e.target.value)}
                    placeholder="UQD..."
                    className={errors.paymentDetails ? 'border-red-500' : ''}
                  />
                  {errors.paymentDetails && <p className="text-sm text-red-500">{errors.paymentDetails}</p>}
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