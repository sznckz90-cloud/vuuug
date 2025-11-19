import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { showNotification } from '@/components/AppNotification';
import { Loader2, Check, Gem, DollarSign, Star, ArrowLeft, Wallet, HelpCircle, Info, CircleDollarSign } from 'lucide-react';
import { PAYMENT_SYSTEMS, STAR_PACKAGES } from '@/constants/paymentSystems';
import { useLocation } from 'wouter';
import { shortenAddress, canonicalizeTelegramUsername, formatTelegramUsername } from '@/lib/utils';

interface User {
  id: string;
  balance: string;
  usdBalance?: string;
  friendsInvited?: number;
  cwalletId?: string;
  usdtWalletAddress?: string;
  telegramStarsUsername?: string;
}

interface WalletDetails {
  tonWalletAddress: string;
  tonWalletComment: string;
  telegramUsername: string;
  usdtWalletAddress: string;
  canWithdraw: boolean;
}

type WalletType = 'TON' | 'USDT' | 'STARS';

const getIcon = (iconName: string) => {
  const icons: Record<string, any> = {
    'Gem': Gem,
    'DollarSign': DollarSign,
    'Star': Star
  };
  return icons[iconName] || DollarSign;
};

export default function Withdraw() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  
  // Active tab state - 'withdraw' or 'wallet-setup'
  const [activeTab, setActiveTab] = useState<'withdraw' | 'wallet-setup'>('withdraw');
  
  // Withdraw section states
  const [selectedMethod, setSelectedMethod] = useState<string>('TON');
  const [selectedStarPackage, setSelectedStarPackage] = useState<number | null>(null);
  
  // Wallet Setup section states (for popup dialog style)
  const [selectedWalletType, setSelectedWalletType] = useState<WalletType>('TON');
  const [tonWalletId, setTonWalletId] = useState('');
  const [newTonWalletId, setNewTonWalletId] = useState('');
  const [isChangingTonWallet, setIsChangingTonWallet] = useState(false);
  const [usdtWalletAddress, setUsdtWalletAddress] = useState('');
  const [newUsdtWalletAddress, setNewUsdtWalletAddress] = useState('');
  const [isChangingUsdtWallet, setIsChangingUsdtWallet] = useState(false);
  const [telegramUsername, setTelegramUsername] = useState('');
  const [newTelegramUsername, setNewTelegramUsername] = useState('');
  const [isChangingStarsUsername, setIsChangingStarsUsername] = useState(false);

  const { data: user, refetch: refetchUser } = useQuery<User>({
    queryKey: ['/api/auth/user'],
    retry: false,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    staleTime: 0,
  });

  const { data: appSettings } = useQuery<any>({
    queryKey: ['/api/app-settings'],
    retry: false,
  });

  const walletChangeFee = appSettings?.walletChangeFee || 5000;
  const padBalance = parseFloat(user?.balance || "0");
  const usdBalance = parseFloat(user?.usdBalance || "0");
  const friendsInvited = user?.friendsInvited || 0;
  const MINIMUM_FRIENDS_REQUIRED = 3;

  const { data: withdrawalsResponse, refetch: refetchWithdrawals } = useQuery<{ withdrawals?: any[] }>({
    queryKey: ['/api/withdrawals'],
    retry: false,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    staleTime: 0,
  });

  useEffect(() => {
    if (user) {
      if (user.cwalletId) setTonWalletId(user.cwalletId);
      if (user.usdtWalletAddress) setUsdtWalletAddress(user.usdtWalletAddress);
      setTelegramUsername(canonicalizeTelegramUsername(user?.telegramStarsUsername ?? ''));
    }
  }, [user]);

  useEffect(() => {
    refetchUser();
    refetchWithdrawals();
  }, [refetchUser, refetchWithdrawals]);

  const withdrawalsData = withdrawalsResponse?.withdrawals || [];
  const hasPendingWithdrawal = withdrawalsData.some(w => w.status === 'pending');

  const isTonWalletSet = !!user?.cwalletId;
  const isUsdtWalletSet = !!user?.usdtWalletAddress;
  const isTelegramStarsSet = !!user?.telegramStarsUsername;

  // TON wallet mutations
  const saveTonWalletMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/wallet/cwallet', {
        cwalletId: tonWalletId.trim()
      });
      return response.json();
    },
    onSuccess: () => {
      showNotification("TON wallet saved successfully.", "success");
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
    },
    onError: (error: Error) => {
      showNotification(error.message, "error");
    },
  });

  const changeTonWalletMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/wallet/change', {
        newWalletId: newTonWalletId.trim()
      });
      return response.json();
    },
    onSuccess: () => {
      showNotification("TON wallet updated successfully", "success");
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      setIsChangingTonWallet(false);
      setNewTonWalletId('');
    },
    onError: (error: Error) => {
      showNotification(error.message, "error");
    },
  });

  // USDT wallet mutations
  const saveUsdtWalletMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/wallet/usdt', {
        usdtAddress: usdtWalletAddress.trim()
      });
      return response.json();
    },
    onSuccess: () => {
      showNotification("USDT wallet saved successfully.", "success");
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
    },
    onError: (error: Error) => {
      showNotification(error.message, "error");
    },
  });

  const changeUsdtWalletMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/wallet/usdt', {
        usdtAddress: newUsdtWalletAddress.trim()
      });
      return response.json();
    },
    onSuccess: () => {
      showNotification("USDT wallet updated successfully", "success");
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      setIsChangingUsdtWallet(false);
      setNewUsdtWalletAddress('');
    },
    onError: (error: Error) => {
      showNotification(error.message, "error");
    },
  });

  // Telegram Stars mutations
  const saveTelegramStarsMutation = useMutation({
    mutationFn: async () => {
      const payloadUsername = canonicalizeTelegramUsername(telegramUsername);
      const response = await apiRequest('POST', '/api/wallet/telegram-stars', {
        telegramUsername: payloadUsername
      });
      return response.json();
    },
    onSuccess: () => {
      showNotification("Telegram username saved successfully.", "success");
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
    },
    onError: (error: Error) => {
      showNotification(error.message, "error");
    },
  });

  const changeTelegramStarsMutation = useMutation({
    mutationFn: async () => {
      const payloadUsername = canonicalizeTelegramUsername(newTelegramUsername);
      const response = await apiRequest('POST', '/api/wallet/telegram-stars', {
        telegramUsername: payloadUsername
      });
      return response.json();
    },
    onSuccess: () => {
      showNotification("Telegram username updated successfully", "success");
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      setIsChangingStarsUsername(false);
      setNewTelegramUsername('');
    },
    onError: (error: Error) => {
      showNotification(error.message, "error");
    },
  });

  const withdrawMutation = useMutation({
    mutationFn: async () => {
      let withdrawalData: any = {
        method: selectedMethod
      };

      if (selectedMethod === 'STARS') {
        if (!selectedStarPackage) {
          throw new Error('Please select a star package');
        }
        const starPkg = STAR_PACKAGES.find(p => p.stars === selectedStarPackage);
        if (!starPkg) throw new Error('Invalid star package');
        
        const totalCost = starPkg.usdCost * 1.05;
        withdrawalData.starPackage = selectedStarPackage;
        withdrawalData.amount = totalCost;
      }

      const response = await apiRequest('POST', '/api/withdrawals', withdrawalData);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to submit withdrawal request');
      }
      
      return data;
    },
    onSuccess: async () => {
      showNotification("You have sent a withdrawal request.", "success");
      
      queryClient.invalidateQueries({ queryKey: ['/api/withdrawals'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user/stats'] });
      
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ['/api/auth/user'] }),
        queryClient.refetchQueries({ queryKey: ['/api/user/stats'] }),
        queryClient.refetchQueries({ queryKey: ['/api/withdrawals'] })
      ]);
      
      setSelectedMethod('TON');
      setSelectedStarPackage(null);
    },
    onError: (error: any) => {
      const errorMessage = error.message || "Failed to submit withdrawal request";
      
      if (errorMessage.toLowerCase().includes("minimum") || errorMessage === "minimum withdrawal") {
        const minAmount = selectedPaymentSystem?.minWithdrawal || 1;
        showNotification(`minimum $${minAmount}`, "error");
      } else if (errorMessage.toLowerCase().includes("pending")) {
        showNotification("You already have a pending withdrawal. Please wait for it to be processed.", "error");
      } else if (errorMessage.toLowerCase().includes("insufficient")) {
        showNotification("Insufficient balance for withdrawal. Please convert PAD to USD first.", "error");
      } else {
        showNotification(errorMessage, "error");
      }
    },
  });

  const handleSaveTonWallet = () => {
    if (!tonWalletId.trim()) {
      showNotification("Please enter your TON wallet address", "error");
      return;
    }
    if (!/^(UQ|EQ)[A-Za-z0-9_-]{46}$/.test(tonWalletId.trim())) {
      showNotification("Please enter a valid TON wallet address", "error");
      return;
    }
    saveTonWalletMutation.mutate();
  };

  const handleChangeTonWallet = () => {
    if (!newTonWalletId.trim()) {
      showNotification("Please enter a new TON wallet address", "error");
      return;
    }
    if (!/^(UQ|EQ)[A-Za-z0-9_-]{46}$/.test(newTonWalletId.trim())) {
      showNotification("Please enter a valid TON wallet address", "error");
      return;
    }
    changeTonWalletMutation.mutate();
  };

  const handleSaveUsdtWallet = () => {
    if (!usdtWalletAddress.trim()) {
      showNotification("Please enter your USDT wallet address", "error");
      return;
    }
    if (!/^0x[a-fA-F0-9]{40}$/.test(usdtWalletAddress.trim())) {
      showNotification("Please enter a valid Optimism USDT address (0x...)", "error");
      return;
    }
    saveUsdtWalletMutation.mutate();
  };

  const handleChangeUsdtWallet = () => {
    if (!newUsdtWalletAddress.trim()) {
      showNotification("Please enter a new USDT wallet address", "error");
      return;
    }
    if (!/^0x[a-fA-F0-9]{40}$/.test(newUsdtWalletAddress.trim())) {
      showNotification("Please enter a valid Optimism USDT address (0x...)", "error");
      return;
    }
    changeUsdtWalletMutation.mutate();
  };

  const handleSaveTelegramStars = () => {
    const payloadUsername = canonicalizeTelegramUsername(telegramUsername);
    if (!payloadUsername) {
      showNotification("Please enter your Telegram username", "error");
      return;
    }
    saveTelegramStarsMutation.mutate();
  };

  const handleChangeTelegramStars = () => {
    const payloadUsername = canonicalizeTelegramUsername(newTelegramUsername);
    if (!payloadUsername) {
      showNotification("Please enter a new Telegram username", "error");
      return;
    }
    changeTelegramStarsMutation.mutate();
  };

  const handleWithdraw = () => {
    if (friendsInvited < MINIMUM_FRIENDS_REQUIRED) {
      showNotification("You need to invite at least 3 friends to unlock withdrawals.", "error");
      return;
    }

    if (hasPendingWithdrawal) {
      showNotification("Cannot create new request until current one is processed.", "error");
      return;
    }

    if (selectedMethod === 'STARS') {
      if (!selectedStarPackage) {
        showNotification("Please select a star package", "error");
        return;
      }
      const starPkg = STAR_PACKAGES.find(p => p.stars === selectedStarPackage);
      if (!starPkg) return;
      
      const totalCost = starPkg.usdCost * 1.05;
      if (usdBalance < totalCost) {
        showNotification(`Insufficient balance. You need $${totalCost.toFixed(2)} (including 5% fee)`, "error");
        return;
      }
    } else {
      if (usdBalance <= 0) {
        showNotification("Insufficient balance for withdrawal", "error");
        return;
      }
    }

    withdrawMutation.mutate();
  };

  const selectedPaymentSystem = PAYMENT_SYSTEMS.find(p => p.id === selectedMethod);
  const calculateWithdrawalAmount = () => {
    if (selectedMethod === 'STARS' && selectedStarPackage) {
      const starPkg = STAR_PACKAGES.find(p => p.stars === selectedStarPackage);
      if (!starPkg) return 0;
      return starPkg.usdCost * 1.05;
    }
    const feePercent = selectedPaymentSystem?.fee || 5;
    return usdBalance * (1 - feePercent / 100);
  };

  return (
    <Layout>
      <main className="max-w-md mx-auto px-4 pt-3">
        {/* Balance Card - Fixed at Top */}
        <div className="mb-3 p-4 bg-[#0d0d0d] rounded-lg border border-[#4cd3ff]/20">
          <div className="text-xs text-muted-foreground mb-1">Available USD Balance</div>
          <div className="text-2xl font-bold text-[#4cd3ff]">${usdBalance.toFixed(2)} USD</div>
          <div className="text-xs text-[#c0c0c0] mt-1">
            Convert PAD to USD to withdraw
          </div>
        </div>

        {/* Toggle System - CreateTask Style */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <Button
            type="button"
            variant="outline"
            className={`h-auto py-3 transition-all font-bold text-sm ${
              activeTab === 'withdraw'
                ? "bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border-cyan-500 text-cyan-300 shadow-lg shadow-cyan-500/20" 
                : "hover:bg-cyan-500/10 hover:border-cyan-500/50 text-muted-foreground"
            }`}
            onClick={() => setActiveTab('withdraw')}
          >
            <CircleDollarSign className="w-4 h-4 mr-2" />
            Withdraw
          </Button>
          <Button
            type="button"
            variant="outline"
            className={`h-auto py-3 transition-all font-bold text-sm ${
              activeTab === 'wallet-setup'
                ? "bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border-blue-500 text-blue-300 shadow-lg shadow-blue-500/20" 
                : "hover:bg-blue-500/10 hover:border-blue-500/50 text-muted-foreground"
            }`}
            onClick={() => setActiveTab('wallet-setup')}
          >
            <Wallet className="w-4 h-4 mr-2" />
            Wallet Setup
          </Button>
        </div>

        {/* Withdraw Section */}
        {activeTab === 'withdraw' && (
          <div className="space-y-4">
              {friendsInvited < MINIMUM_FRIENDS_REQUIRED && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <p className="text-xs text-red-500 font-medium">
                    You need to invite at least 3 friends to unlock withdrawals.
                  </p>
                  <p className="text-xs text-red-400 mt-1">
                    Friends invited: {friendsInvited}/3
                  </p>
                </div>
              )}

              {hasPendingWithdrawal && (
                <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                  <p className="text-xs text-yellow-500">
                    You have a pending withdrawal. Please wait for it to be processed.
                  </p>
                </div>
              )}

              <div className="space-y-3">
                <Label className="text-sm text-white">Withdrawal Method</Label>
                <div className="space-y-2">
                  {PAYMENT_SYSTEMS.map((system) => (
                    <button
                      key={system.id}
                      onClick={() => {
                        setSelectedMethod(system.id);
                        if (system.id !== 'STARS') {
                          setSelectedStarPackage(null);
                        }
                      }}
                      className={`w-full flex items-center space-x-2 p-3 rounded-lg border-2 transition-all ${
                        selectedMethod === system.id
                          ? 'border-[#4cd3ff] bg-[#4cd3ff]/10'
                          : 'border-[#2a2a2a] bg-[#1a1a1a] hover:border-[#4cd3ff]/50'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        selectedMethod === system.id ? 'border-[#4cd3ff] bg-[#4cd3ff]' : 'border-[#aaa]'
                      }`}>
                        {selectedMethod === system.id && <Check className="w-3 h-3 text-black" />}
                      </div>
                      <div className="flex-1 flex items-center gap-2">
                        {(() => {
                          const IconComponent = getIcon(system.icon);
                          const iconColor = system.icon === 'DollarSign' ? 'text-green-500' : 
                                          system.icon === 'Star' ? 'text-yellow-500' : 
                                          'text-[#4cd3ff]';
                          return <IconComponent className={`w-5 h-5 ${iconColor}`} />;
                        })()}
                        <span className="text-white">{system.name}</span>
                        <span className="text-xs text-[#aaa] ml-auto">({system.fee}% fee)</span>
                      </div>
                    </button>
                  ))}
                </div>

                {selectedMethod === 'STARS' && (
                  <div className="space-y-2">
                    <Label className="text-sm text-white">Select Stars</Label>
                    <div className="flex gap-2">
                      {STAR_PACKAGES.map((pkg) => (
                        <button
                          key={pkg.stars}
                          onClick={() => setSelectedStarPackage(pkg.stars)}
                          className={`flex-1 p-2 rounded border text-sm flex items-center justify-center gap-1 ${
                            selectedStarPackage === pkg.stars
                              ? 'border-[#4cd3ff] bg-[#4cd3ff]/20 text-white'
                              : 'border-[#3a3a3a] text-[#aaa] hover:border-[#4cd3ff]/50'
                          }`}
                        >
                          {pkg.stars}
                          <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                        </button>
                      ))}
                    </div>
                    {selectedStarPackage && (
                      <div className="text-xs text-[#aaa] text-center">
                        Cost: ${(STAR_PACKAGES.find(p => p.stars === selectedStarPackage)!.usdCost * 1.05).toFixed(2)}
                      </div>
                    )}
                  </div>
                )}

                {selectedMethod !== 'STARS' && (
                  <div className="p-3 bg-[#1a1a1a] rounded-lg border border-[#2a2a2a]">
                    <div className="text-xs text-[#aaa]">You will receive</div>
                    <div className="text-lg font-bold text-white">${calculateWithdrawalAmount().toFixed(2)}</div>
                    <div className="text-xs text-[#aaa] mt-1">
                      Full balance withdrawal ({selectedPaymentSystem?.fee}% fee deducted)
                    </div>
                    <div className="text-xs text-yellow-400/80 mt-1">
                      Withdrawal method: {selectedMethod}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-6">
                <Button
                  onClick={handleWithdraw}
                  disabled={withdrawMutation.isPending || hasPendingWithdrawal}
                  className="w-full bg-[#4cd3ff] hover:bg-[#6ddeff] text-black font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {withdrawMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : selectedMethod === 'STARS' && selectedStarPackage ? (
                    <span className="flex items-center gap-1">
                      Withdraw {selectedStarPackage} <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                    </span>
                  ) : `Withdraw via ${selectedMethod}`}
                </Button>
              </div>
          </div>
        )}

        {/* Wallet Setup Section */}
        {activeTab === 'wallet-setup' && (
          <div className="space-y-4">
              {/* Wallet Type Selector - List View */}
              <div className="space-y-2">
                <label className="text-xs text-[#c0c0c0]">Select Wallet Type</label>
                <div className="space-y-2">
                  <button
                    onClick={() => setSelectedWalletType('TON')}
                    className={`w-full flex items-center space-x-2 p-3 rounded-lg border-2 transition-all ${
                      selectedWalletType === 'TON'
                        ? 'border-[#4cd3ff] bg-[#4cd3ff]/10'
                        : 'border-[#2a2a2a] bg-[#1a1a1a] hover:border-[#4cd3ff]/50'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      selectedWalletType === 'TON' ? 'border-[#4cd3ff] bg-[#4cd3ff]' : 'border-[#aaa]'
                    }`}>
                      {selectedWalletType === 'TON' && <Check className="w-3 h-3 text-black" />}
                    </div>
                    <div className="flex-1 flex items-center gap-2">
                      <Gem className="w-5 h-5 text-[#4cd3ff]" />
                      <span className="text-white truncate">{isTonWalletSet ? shortenAddress(tonWalletId) : 'TON Wallet'}</span>
                    </div>
                  </button>
                  <button
                    onClick={() => setSelectedWalletType('USDT')}
                    className={`w-full flex items-center space-x-2 p-3 rounded-lg border-2 transition-all ${
                      selectedWalletType === 'USDT'
                        ? 'border-[#4cd3ff] bg-[#4cd3ff]/10'
                        : 'border-[#2a2a2a] bg-[#1a1a1a] hover:border-[#4cd3ff]/50'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      selectedWalletType === 'USDT' ? 'border-[#4cd3ff] bg-[#4cd3ff]' : 'border-[#aaa]'
                    }`}>
                      {selectedWalletType === 'USDT' && <Check className="w-3 h-3 text-black" />}
                    </div>
                    <div className="flex-1 flex items-center gap-2">
                      <DollarSign className="w-5 h-5 text-green-500" />
                      <span className="text-white truncate">{isUsdtWalletSet ? shortenAddress(usdtWalletAddress) : 'USDT (Optimism)'}</span>
                    </div>
                  </button>
                  <button
                    onClick={() => setSelectedWalletType('STARS')}
                    className={`w-full flex items-center space-x-2 p-3 rounded-lg border-2 transition-all ${
                      selectedWalletType === 'STARS'
                        ? 'border-[#4cd3ff] bg-[#4cd3ff]/10'
                        : 'border-[#2a2a2a] bg-[#1a1a1a] hover:border-[#4cd3ff]/50'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      selectedWalletType === 'STARS' ? 'border-[#4cd3ff] bg-[#4cd3ff]' : 'border-[#aaa]'
                    }`}>
                      {selectedWalletType === 'STARS' && <Check className="w-3 h-3 text-black" />}
                    </div>
                    <div className="flex-1 flex items-center gap-2">
                      <Star className="w-5 h-5 text-yellow-500" />
                      <span className="text-white truncate">{isTelegramStarsSet ? formatTelegramUsername(telegramUsername) : 'Telegram Stars'}</span>
                    </div>
                  </button>
                </div>
              </div>

              {/* TON Wallet Section */}
              {selectedWalletType === 'TON' && (
                <>
                  {isTonWalletSet && !isChangingTonWallet ? (
                    <>
                      <div className="flex items-center gap-2 p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                        <Check className="w-4 h-4 text-green-500" />
                        <p className="text-xs text-green-500">TON wallet linked successfully</p>
                      </div>
                    </>
                  ) : isChangingTonWallet ? (
                    <>
                      <div className="space-y-2">
                        <label className="text-xs text-[#c0c0c0]">Current Wallet</label>
                        <Input
                          type="text"
                          value={tonWalletId}
                          disabled={true}
                          className="bg-[#0d0d0d] border-white/20 text-white placeholder:text-[#808080] focus:border-[#4cd3ff] transition-colors rounded-lg h-11 disabled:opacity-60 disabled:cursor-not-allowed"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs text-[#c0c0c0]">New TON Wallet Address</label>
                        <Input
                          type="text"
                          placeholder="Enter TON wallet address (UQ... or EQ...)"
                          value={newTonWalletId}
                          onChange={(e) => setNewTonWalletId(e.target.value)}
                          className="bg-[#0d0d0d] border-white/20 text-white placeholder:text-[#808080] focus:border-[#4cd3ff] transition-colors rounded-lg h-11"
                        />
                      </div>
                      <div className="flex items-start gap-2 p-3 bg-[#4cd3ff]/10 rounded-lg border border-[#4cd3ff]/30">
                        <Info className="w-4 h-4 text-[#4cd3ff] mt-0.5 flex-shrink-0" />
                        <div className="text-xs text-[#c0c0c0]">
                          Fee: <span className="text-[#4cd3ff] font-semibold">{walletChangeFee} PAD</span> will be deducted
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-xs text-[#c0c0c0]">
                        Set up your <span className="text-[#4cd3ff] font-semibold">TON Network</span> wallet for withdrawals
                      </p>
                      <div className="space-y-2">
                        <Input
                          type="text"
                          placeholder="Enter TON wallet address (UQ... or EQ...)"
                          value={tonWalletId}
                          onChange={(e) => setTonWalletId(e.target.value)}
                          className="bg-[#0d0d0d] border-white/20 text-white placeholder:text-[#808080] focus:border-[#4cd3ff] transition-colors rounded-lg h-11"
                        />
                        <p className="text-xs text-red-500 font-medium flex items-center gap-1">
                          <Info className="w-3 h-3" />
                          Must start with UQ or EQ – verify address before saving
                        </p>
                      </div>
                      <div className="flex items-start gap-2 p-3 bg-[#0d0d0d] rounded-lg border border-white/5">
                        <HelpCircle className="w-4 h-4 text-[#4cd3ff] mt-0.5 flex-shrink-0" />
                        <div className="text-xs text-[#c0c0c0]">
                          Don't have a TON wallet?{' '}
                          <a 
                            href="https://ton.org/wallets" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-[#4cd3ff] hover:text-[#6ddeff] underline transition-colors"
                          >
                            Get one here
                          </a>
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}

              {/* USDT Wallet Section */}
              {selectedWalletType === 'USDT' && (
                <>
                  {isUsdtWalletSet && !isChangingUsdtWallet ? (
                    <>
                      <div className="flex items-center gap-2 p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                        <Check className="w-4 h-4 text-green-500" />
                        <p className="text-xs text-green-500">USDT wallet linked successfully</p>
                      </div>
                    </>
                  ) : isChangingUsdtWallet ? (
                    <>
                      <div className="space-y-2">
                        <label className="text-xs text-[#c0c0c0]">Current Wallet</label>
                        <Input
                          type="text"
                          value={usdtWalletAddress}
                          disabled={true}
                          className="bg-[#0d0d0d] border-white/20 text-white placeholder:text-[#808080] focus:border-[#4cd3ff] transition-colors rounded-lg h-11 disabled:opacity-60 disabled:cursor-not-allowed"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs text-[#c0c0c0]">New USDT Wallet Address</label>
                        <Input
                          type="text"
                          placeholder="Enter USDT wallet address (0x...)"
                          value={newUsdtWalletAddress}
                          onChange={(e) => setNewUsdtWalletAddress(e.target.value)}
                          className="bg-[#0d0d0d] border-white/20 text-white placeholder:text-[#808080] focus:border-[#4cd3ff] transition-colors rounded-lg h-11"
                        />
                      </div>
                      <div className="flex items-start gap-2 p-3 bg-[#4cd3ff]/10 rounded-lg border border-[#4cd3ff]/30">
                        <Info className="w-4 h-4 text-[#4cd3ff] mt-0.5 flex-shrink-0" />
                        <div className="text-xs text-[#c0c0c0]">
                          Fee: <span className="text-[#4cd3ff] font-semibold">{walletChangeFee} PAD</span> will be deducted
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-xs text-[#c0c0c0]">
                        Set up your <span className="text-[#4cd3ff] font-semibold">Optimism Network</span> USDT wallet
                      </p>
                      <div className="space-y-2">
                        <Input
                          type="text"
                          placeholder="Enter USDT wallet address (0x...)"
                          value={usdtWalletAddress}
                          onChange={(e) => setUsdtWalletAddress(e.target.value)}
                          className="bg-[#0d0d0d] border-white/20 text-white placeholder:text-[#808080] focus:border-[#4cd3ff] transition-colors rounded-lg h-11"
                        />
                        <p className="text-xs text-red-500 font-medium flex items-center gap-1">
                          <Info className="w-3 h-3" />
                          Optimism network only – not TRON, BNB, or Ethereum
                        </p>
                      </div>
                      <div className="flex items-start gap-2 p-3 bg-[#0d0d0d] rounded-lg border border-white/5">
                        <HelpCircle className="w-4 h-4 text-[#4cd3ff] mt-0.5 flex-shrink-0" />
                        <div className="text-xs text-[#c0c0c0]">
                          Need an Optimism wallet?{' '}
                          <a 
                            href="https://www.optimism.io/apps/wallets" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-[#4cd3ff] hover:text-[#6ddeff] underline transition-colors"
                          >
                            Learn more
                          </a>
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}

              {/* Telegram Stars Section */}
              {selectedWalletType === 'STARS' && (
                <>
                  {isTelegramStarsSet && !isChangingStarsUsername ? (
                    <>
                      <div className="flex items-center gap-2 p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                        <Check className="w-4 h-4 text-green-500" />
                        <p className="text-xs text-green-500">Telegram username set successfully</p>
                      </div>
                    </>
                  ) : isChangingStarsUsername ? (
                    <>
                      <div className="space-y-2">
                        <label className="text-xs text-[#c0c0c0]">Current Username</label>
                        <Input
                          type="text"
                          value={formatTelegramUsername(telegramUsername)}
                          disabled={true}
                          className="bg-[#0d0d0d] border-white/20 text-white placeholder:text-[#808080] focus:border-[#4cd3ff] transition-colors rounded-lg h-11 disabled:opacity-60 disabled:cursor-not-allowed"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs text-[#c0c0c0]">New Telegram Username</label>
                        <Input
                          type="text"
                          placeholder="Your Telegram username (e.g., szxzyz)"
                          value={formatTelegramUsername(newTelegramUsername)}
                          onChange={(e) => setNewTelegramUsername(canonicalizeTelegramUsername(e.target.value))}
                          className="bg-[#0d0d0d] border-white/20 text-white placeholder:text-[#808080] focus:border-[#4cd3ff] transition-colors rounded-lg h-11"
                        />
                      </div>
                      <div className="flex items-start gap-2 p-3 bg-[#4cd3ff]/10 rounded-lg border border-[#4cd3ff]/30">
                        <Info className="w-4 h-4 text-[#4cd3ff] mt-0.5 flex-shrink-0" />
                        <div className="text-xs text-[#c0c0c0]">
                          Fee: <span className="text-[#4cd3ff] font-semibold">{walletChangeFee} PAD</span> will be deducted
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-xs text-[#c0c0c0]">
                        Enter your Telegram username for <span className="text-[#4cd3ff] font-semibold">Stars</span> withdrawals
                      </p>
                      <div className="space-y-2">
                        <Input
                          type="text"
                          placeholder="Your Telegram username (e.g., szxzyz)"
                          value={formatTelegramUsername(telegramUsername)}
                          onChange={(e) => setTelegramUsername(canonicalizeTelegramUsername(e.target.value))}
                          className="bg-[#0d0d0d] border-white/20 text-white placeholder:text-[#808080] focus:border-[#4cd3ff] transition-colors rounded-lg h-11"
                        />
                        <p className="text-xs text-[#c0c0c0] flex items-center gap-1">
                          <Info className="w-3 h-3" />
                          @ will be added automatically. Letters, numbers, and underscores only.
                        </p>
                      </div>
                    </>
                  )}
                </>
              )}

              {/* Action Buttons */}
              <div className="flex justify-center gap-3 mt-6">
                {selectedWalletType === 'TON' && isTonWalletSet && !isChangingTonWallet ? (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => setIsChangingTonWallet(true)}
                      className="flex-1 bg-transparent border-[#4cd3ff]/50 text-[#4cd3ff] hover:bg-[#4cd3ff]/10"
                    >
                      Change Wallet
                    </Button>
                    <Button
                      onClick={() => setActiveTab('withdraw')}
                      className="flex-1 bg-[#4cd3ff] hover:bg-[#6ddeff] text-black font-semibold"
                    >
                      Done
                    </Button>
                  </>
                ) : selectedWalletType === 'TON' && isChangingTonWallet ? (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsChangingTonWallet(false);
                        setNewTonWalletId('');
                      }}
                      className="flex-1 bg-transparent border-white/20 text-white hover:bg-white/10"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleChangeTonWallet}
                      disabled={changeTonWalletMutation.isPending}
                      className="flex-1 bg-[#4cd3ff] hover:bg-[#6ddeff] text-black font-semibold"
                    >
                      {changeTonWalletMutation.isPending ? "Processing..." : `Pay ${walletChangeFee} PAD & Confirm`}
                    </Button>
                  </>
                ) : selectedWalletType === 'TON' && !isTonWalletSet ? (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => setActiveTab('withdraw')}
                      className="flex-1 bg-transparent border-white/20 text-white hover:bg-white/10"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSaveTonWallet}
                      disabled={saveTonWalletMutation.isPending}
                      className="flex-1 bg-[#4cd3ff] hover:bg-[#6ddeff] text-black font-semibold"
                    >
                      {saveTonWalletMutation.isPending ? "Saving..." : "Save TON Wallet"}
                    </Button>
                  </>
                ) : selectedWalletType === 'USDT' && isUsdtWalletSet && !isChangingUsdtWallet ? (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => setIsChangingUsdtWallet(true)}
                      className="flex-1 bg-transparent border-[#4cd3ff]/50 text-[#4cd3ff] hover:bg-[#4cd3ff]/10"
                    >
                      Change Wallet
                    </Button>
                    <Button
                      onClick={() => setActiveTab('withdraw')}
                      className="flex-1 bg-[#4cd3ff] hover:bg-[#6ddeff] text-black font-semibold"
                    >
                      Done
                    </Button>
                  </>
                ) : selectedWalletType === 'USDT' && isChangingUsdtWallet ? (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsChangingUsdtWallet(false);
                        setNewUsdtWalletAddress('');
                      }}
                      className="flex-1 bg-transparent border-white/20 text-white hover:bg-white/10"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleChangeUsdtWallet}
                      disabled={changeUsdtWalletMutation.isPending}
                      className="flex-1 bg-[#4cd3ff] hover:bg-[#6ddeff] text-black font-semibold"
                    >
                      {changeUsdtWalletMutation.isPending ? "Processing..." : "Update USDT Wallet"}
                    </Button>
                  </>
                ) : selectedWalletType === 'USDT' && !isUsdtWalletSet ? (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => setActiveTab('withdraw')}
                      className="flex-1 bg-transparent border-white/20 text-white hover:bg-white/10"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSaveUsdtWallet}
                      disabled={saveUsdtWalletMutation.isPending}
                      className="flex-1 bg-[#4cd3ff] hover:bg-[#6ddeff] text-black font-semibold"
                    >
                      {saveUsdtWalletMutation.isPending ? "Saving..." : "Save USDT Wallet"}
                    </Button>
                  </>
                ) : selectedWalletType === 'STARS' && isTelegramStarsSet && !isChangingStarsUsername ? (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setNewTelegramUsername(telegramUsername);
                        setIsChangingStarsUsername(true);
                      }}
                      className="flex-1 bg-transparent border-[#4cd3ff]/50 text-[#4cd3ff] hover:bg-[#4cd3ff]/10"
                    >
                      Change Username
                    </Button>
                    <Button
                      onClick={() => setActiveTab('withdraw')}
                      className="flex-1 bg-[#4cd3ff] hover:bg-[#6ddeff] text-black font-semibold"
                    >
                      Done
                    </Button>
                  </>
                ) : selectedWalletType === 'STARS' && isChangingStarsUsername ? (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsChangingStarsUsername(false);
                        setNewTelegramUsername('');
                      }}
                      className="flex-1 bg-transparent border-white/20 text-white hover:bg-white/10"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleChangeTelegramStars}
                      disabled={changeTelegramStarsMutation.isPending}
                      className="flex-1 bg-[#4cd3ff] hover:bg-[#6ddeff] text-black font-semibold"
                    >
                      {changeTelegramStarsMutation.isPending ? "Processing..." : "Update Username"}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => setActiveTab('withdraw')}
                      className="flex-1 bg-transparent border-white/20 text-white hover:bg-white/10"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSaveTelegramStars}
                      disabled={saveTelegramStarsMutation.isPending}
                      className="flex-1 bg-[#4cd3ff] hover:bg-[#6ddeff] text-black font-semibold"
                    >
                      {saveTelegramStarsMutation.isPending ? "Saving..." : "Save Username"}
                    </Button>
                  </>
                )}
              </div>
          </div>
        )}
      </main>
    </Layout>
  );
}
