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
import { Wallet as WalletIcon, ArrowDown, History } from 'lucide-react';

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
                ≈ ${(Math.round(parseFloat(user?.balance || "0") * 100000) / 100000).toFixed(2)} USD
              </div>
            </div>
          </div>
        </div>

        {/* Main Navigation Buttons */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <Link href="/my-wallets">
            <Button className="w-full h-16 flex flex-col gap-1">
              <WalletIcon size={20} />
              <span className="text-xs">Wallets</span>
            </Button>
          </Link>
          <Link href="/withdraw">
            <Button className="w-full h-16 flex flex-col gap-1">
              <ArrowDown size={20} />
              <span className="text-xs">Withdraw</span>
            </Button>
          </Link>
          <Link href="/payment-history">
            <Button className="w-full h-16 flex flex-col gap-1">
              <History size={20} />
              <span className="text-xs">History</span>
            </Button>
          </Link>
        </div>

        {/* Quick Access Buttons */}
        <Card className="neon-glow-border shadow-lg">
          <CardContent className="p-4">
            <div className="space-y-2">
              <Link href="/">
                <Button variant="outline" className="w-full justify-start h-12">
                  <i className="fas fa-home mr-3 text-lg"></i>
                  <span>Viewing ads</span>
                </Button>
              </Link>
              <Link href="/tasks">
                <Button variant="outline" className="w-full justify-start h-12">
                  <i className="fas fa-tasks mr-3 text-lg"></i>
                  <span>Task</span>
                </Button>
              </Link>
              <Link href="/affiliates">
                <Button variant="outline" className="w-full justify-start h-12">
                  <i className="fas fa-users mr-3 text-lg"></i>
                  <span>Get link</span>
                </Button>
              </Link>
              <Button 
                variant="outline" 
                className="w-full justify-start h-12"
                onClick={() => {
                  if (window.Telegram?.WebApp?.openTelegramLink) {
                    window.Telegram.WebApp.openTelegramLink('https://t.me/PaidAdsCommunity');
                  } else {
                    window.open('https://t.me/PaidAdsCommunity', '_blank');
                  }
                }}
              >
                <i className="fas fa-comments mr-3 text-lg"></i>
                <span>chat room</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
