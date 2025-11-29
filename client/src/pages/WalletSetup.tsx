import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { showNotification } from '@/components/AppNotification';
import { apiRequest } from '@/lib/queryClient';
import { Gem, Star, Settings2, ArrowLeft } from 'lucide-react';
import { useLocation } from 'wouter';

interface WalletDetails {
  tonWalletAddress: string;
  tonWalletComment: string;
  telegramUsername: string;
  canWithdraw: boolean;
}

export default function WalletSetup() {
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [paymentType, setPaymentType] = useState<'ton' | 'stars'>('ton');
  const [tonAddress, setTonAddress] = useState('');
  const [tonComment, setTonComment] = useState('');
  const [telegramUsername, setTelegramUsername] = useState('');

  const { data: walletDetailsData } = useQuery<{ success: boolean; walletDetails: WalletDetails }>({
    queryKey: ['/api/wallet/details'],
    retry: false,
  });

  const { data: user } = useQuery<any>({
    queryKey: ['/api/auth/user'],
    retry: false,
  });

  const walletDetails = walletDetailsData?.walletDetails;

  useEffect(() => {
    if (walletDetails) {
      setTonAddress(walletDetails.tonWalletAddress || '');
      setTonComment(walletDetails.tonWalletComment || '');
      setTelegramUsername(walletDetails.telegramUsername || '');
    }
  }, [walletDetails]);

  const saveWalletMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/wallet/save', {
        tonWalletAddress: tonAddress,
        tonWalletComment: tonComment,
        telegramUsername: telegramUsername
      });
      return response.json();
    },
    onSuccess: (data) => {
      showNotification("Wallet details saved successfully", "success", undefined, 2500);
      queryClient.invalidateQueries({ queryKey: ['/api/wallet/details'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      setTimeout(() => setLocation('/'), 1500);
    },
    onError: (error: any) => {
      showNotification(error.message || "Failed to save wallet details", "error", undefined, 2500);
    },
  });

  const handleSave = () => {
    if (!tonAddress && !telegramUsername) {
      showNotification("Please enter at least one wallet address", "error", undefined, 2500);
      return;
    }

    saveWalletMutation.mutate();
  };

  return (
    <Layout>
      <main className="max-w-md mx-auto px-4 pt-3">
        <div className="mb-4 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation('/')}
            className="text-white hover:bg-white/10"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold text-white">Wallet Setup</h1>
        </div>

        <Card className="minimal-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Settings2 className="w-5 h-5" />
              Payment Details
            </CardTitle>
            <CardDescription>
              Enter your payment details to withdraw earned funds
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={paymentType === 'ton' ? 'default' : 'outline'}
                onClick={() => setPaymentType('ton')}
                className={paymentType === 'ton' ? 'bg-[#4cd3ff] hover:bg-[#6ddeff] text-black' : ''}
              >
                <Gem className="w-4 h-4 mr-2" />
                TON Coin
              </Button>
              <Button
                type="button"
                variant={paymentType === 'stars' ? 'default' : 'outline'}
                onClick={() => setPaymentType('stars')}
                className={paymentType === 'stars' ? 'bg-[#4cd3ff] hover:bg-[#6ddeff] text-black' : ''}
              >
                <Star className="w-4 h-4 mr-2" />
                Telegram Stars
              </Button>
            </div>

            {paymentType === 'ton' ? (
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium mb-3 text-white">TON Payment</p>
                  <p className="text-xs text-muted-foreground mb-4">Enter your payment details to withdraw earned funds.</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-white">TON Address</Label>
                  <Input
                    placeholder="Enter TON address"
                    value={tonAddress}
                    onChange={(e) => setTonAddress(e.target.value)}
                    className="bg-[#0d0d0d] border-[#4cd3ff]/30 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-white">Comment (optional)</Label>
                  <Input
                    placeholder="Enter comment"
                    value={tonComment}
                    onChange={(e) => setTonComment(e.target.value)}
                    className="bg-[#0d0d0d] border-[#4cd3ff]/30 text-white"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium mb-3 text-white">Star Payment</p>
                  <p className="text-xs text-muted-foreground mb-4">Enter your payment details to withdraw earned funds.</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-white">Telegram Username</Label>
                  <Input
                    placeholder="Enter Telegram username"
                    value={telegramUsername}
                    onChange={(e) => setTelegramUsername(e.target.value)}
                    className="bg-[#0d0d0d] border-[#4cd3ff]/30 text-white"
                  />
                  <p className="text-xs text-muted-foreground">Telegram Stars</p>
                </div>
              </div>
            )}

            <div className="mt-6">
              <Button
                className="w-full bg-[#4cd3ff] hover:bg-[#6ddeff] text-black font-semibold"
                onClick={handleSave}
                disabled={saveWalletMutation.isPending}
              >
                {saveWalletMutation.isPending ? 'Saving...' : 'Save Wallet'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </Layout>
  );
}
