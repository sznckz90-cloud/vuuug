import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { showNotification } from '@/components/AppNotification';
import { Loader2, Check, Gem, DollarSign, Star, ArrowLeft, Settings2, Wallet } from 'lucide-react';
import { PAYMENT_SYSTEMS, STAR_PACKAGES } from '@/constants/paymentSystems';
import { useLocation } from 'wouter';

interface User {
  id: string;
  balance: string;
  usdBalance?: string;
  friendsInvited?: number;
}

interface WalletDetails {
  tonWalletAddress: string;
  tonWalletComment: string;
  telegramUsername: string;
  usdtWalletAddress: string;
  canWithdraw: boolean;
}

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
  const [selectedMethod, setSelectedMethod] = useState<string>('TON');
  const [selectedStarPackage, setSelectedStarPackage] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState('withdraw');
  
  const [tonAddress, setTonAddress] = useState('');
  const [tonComment, setTonComment] = useState('');
  const [usdtAddress, setUsdtAddress] = useState('');
  const [telegramUsername, setTelegramUsername] = useState('');

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

  const { data: walletDetailsData } = useQuery<{ success: boolean; walletDetails: WalletDetails }>({
    queryKey: ['/api/wallet/details'],
    retry: false,
  });

  const walletDetails = walletDetailsData?.walletDetails;

  useEffect(() => {
    if (walletDetails) {
      setTonAddress(walletDetails.tonWalletAddress || '');
      setTonComment(walletDetails.tonWalletComment || '');
      setUsdtAddress(walletDetails.usdtWalletAddress || '');
      setTelegramUsername(walletDetails.telegramUsername || '');
    }
  }, [walletDetails]);

  useEffect(() => {
    refetchUser();
    refetchWithdrawals();
  }, [refetchUser, refetchWithdrawals]);

  const withdrawalsData = withdrawalsResponse?.withdrawals || [];
  const hasPendingWithdrawal = withdrawalsData.some(w => w.status === 'pending');

  const saveWalletMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/wallet/save', {
        tonWalletAddress: tonAddress,
        tonWalletComment: tonComment,
        telegramUsername: telegramUsername,
        usdtWalletAddress: usdtAddress
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to save wallet details');
      }
      return response.json();
    },
    onSuccess: () => {
      showNotification("Wallet details saved successfully", "success");
      queryClient.invalidateQueries({ queryKey: ['/api/wallet/details'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
    },
    onError: (error: any) => {
      showNotification(error.message || "Failed to save wallet details", "error");
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
        showNotification("Minimum withdrawal amount not met. Please convert more PAD to USD.", "error");
      } else if (errorMessage.toLowerCase().includes("pending")) {
        showNotification("You already have a pending withdrawal. Please wait for it to be processed.", "error");
      } else if (errorMessage.toLowerCase().includes("insufficient")) {
        showNotification("Insufficient balance for withdrawal. Please convert PAD to USD first.", "error");
      } else {
        showNotification(errorMessage, "error");
      }
    },
  });

  const handleSaveWallet = () => {
    if (!tonAddress && !telegramUsername && !usdtAddress) {
      showNotification("Please enter at least one wallet address", "error");
      return;
    }
    saveWalletMutation.mutate();
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
      <main className="max-w-md mx-auto px-4 pt-3 pb-6">
        <div className="mb-4 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation('/')}
            className="text-white hover:bg-white/10"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold text-[#4cd3ff]">Withdraw</h1>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-[#1a1a1a] p-1 rounded-lg mb-4">
            <TabsTrigger 
              value="withdraw" 
              className="data-[state=active]:bg-[#4cd3ff] data-[state=active]:text-black text-white rounded-md"
            >
              Withdrawal
            </TabsTrigger>
            <TabsTrigger 
              value="wallet" 
              className="data-[state=active]:bg-[#4cd3ff] data-[state=active]:text-black text-white rounded-md"
            >
              Wallet Setup
            </TabsTrigger>
          </TabsList>

          <TabsContent value="withdraw" className="mt-0">
            <Card className="minimal-card">
              <CardContent className="pt-6 space-y-4">
                <div className="p-4 bg-[#0d0d0d] rounded-lg border border-[#4cd3ff]/20">
                  <div className="text-xs text-muted-foreground mb-1">Available USD Balance</div>
                  <div className="text-2xl font-bold text-[#4cd3ff]">${usdBalance.toFixed(2)} USD</div>
                  <div className="text-xs text-[#c0c0c0] mt-1">
                    Convert PAD to USD to withdraw
                  </div>
                </div>

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
                            return <IconComponent className="w-5 h-5 text-[#4cd3ff]" />;
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
                            className={`flex-1 p-2 rounded border text-sm ${
                              selectedStarPackage === pkg.stars
                                ? 'border-[#4cd3ff] bg-[#4cd3ff]/20 text-white'
                                : 'border-[#3a3a3a] text-[#aaa] hover:border-[#4cd3ff]/50'
                            }`}
                          >
                            {pkg.stars}⭐
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

                <div className="flex gap-3 mt-6">
                  <Button
                    variant="outline"
                    onClick={() => setLocation('/')}
                    className="flex-1 bg-transparent border-white/20 text-white hover:bg-white/10"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleWithdraw}
                    disabled={withdrawMutation.isPending || hasPendingWithdrawal}
                    className="flex-1 bg-[#4cd3ff] hover:bg-[#6ddeff] text-black font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {withdrawMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : selectedMethod === 'STARS' && selectedStarPackage ? `Withdraw ${selectedStarPackage} ⭐` : `Withdraw via ${selectedMethod}`}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="wallet" className="mt-0">
            <Card className="minimal-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white text-lg">
                  <Settings2 className="w-5 h-5" />
                  Wallet Setup
                </CardTitle>
                <CardDescription>
                  Enter your payment details to receive withdrawals
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium mb-3 text-white">TON Wallet</p>
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label className="text-white text-xs">TON Address</Label>
                        <Input
                          placeholder="Enter TON wallet address"
                          value={tonAddress}
                          onChange={(e) => setTonAddress(e.target.value)}
                          className="bg-[#0d0d0d] border-[#4cd3ff]/30 text-white"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-white text-xs">Comment (optional)</Label>
                        <Input
                          placeholder="Enter comment"
                          value={tonComment}
                          onChange={(e) => setTonComment(e.target.value)}
                          className="bg-[#0d0d0d] border-[#4cd3ff]/30 text-white"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-medium mb-3 text-white">USDT Wallet (TRC20)</p>
                    <div className="space-y-2">
                      <Label className="text-white text-xs">USDT Address</Label>
                      <Input
                        placeholder="Enter USDT wallet address"
                        value={usdtAddress}
                        onChange={(e) => setUsdtAddress(e.target.value)}
                        className="bg-[#0d0d0d] border-[#4cd3ff]/30 text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-medium mb-3 text-white">Telegram Stars</p>
                    <div className="space-y-2">
                      <Label className="text-white text-xs">Telegram Username</Label>
                      <Input
                        placeholder="Enter Telegram username (without @)"
                        value={telegramUsername}
                        onChange={(e) => setTelegramUsername(e.target.value)}
                        className="bg-[#0d0d0d] border-[#4cd3ff]/30 text-white"
                      />
                      <p className="text-xs text-muted-foreground">For receiving Telegram Stars</p>
                    </div>
                  </div>
                </div>

                <div className="mt-6">
                  <Button
                    className="w-full bg-[#4cd3ff] hover:bg-[#6ddeff] text-black font-semibold"
                    onClick={handleSaveWallet}
                    disabled={saveWalletMutation.isPending}
                  >
                    {saveWalletMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      'Save Wallet Details'
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </Layout>
  );
}
