import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { showNotification } from '@/components/AppNotification';
import { apiRequest } from '@/lib/queryClient';
import { Gem, Star, Settings2 } from 'lucide-react';

interface WalletDetails {
  tonWalletAddress: string;
  tonWalletComment: string;
  telegramUsername: string;
  canWithdraw: boolean;
}

interface WalletDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function WalletDialog({ open, onOpenChange }: WalletDialogProps) {
  const queryClient = useQueryClient();
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
      onOpenChange(false);
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

  const isWalletSet = walletDetails?.tonWalletAddress || walletDetails?.telegramUsername;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-[20px] bg-black/95">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-blue-500" />
            Wallet Setup
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Enter your payment details to withdraw earned funds
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={paymentType === 'ton' ? 'default' : 'outline'}
                onClick={() => setPaymentType('ton')}
                className={`rounded-[20px] ${paymentType === 'ton' ? 'bg-blue-600 hover:bg-blue-700' : 'border-gray-700 text-gray-400 hover:text-white'}`}
              >
                <Gem className="w-4 h-4 mr-2" />
                TON Coin
              </Button>
              <Button
                type="button"
                variant={paymentType === 'stars' ? 'default' : 'outline'}
                onClick={() => setPaymentType('stars')}
                className={`rounded-[20px] ${paymentType === 'stars' ? 'bg-blue-600 hover:bg-blue-700' : 'border-gray-700 text-gray-400 hover:text-white'}`}
              >
                <Star className="w-4 h-4 mr-2" />
                Stars
              </Button>
            </div>

            {paymentType === 'ton' ? (
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-white mb-1">TON Payment</p>
                  <p className="text-xs text-gray-400 mb-4">Enter your payment details to withdraw earned funds.</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-300">TON Address</Label>
                  <Input
                    placeholder="Enter TON address"
                    value={tonAddress}
                    onChange={(e) => setTonAddress(e.target.value)}
                    className="bg-transparent border-gray-700 text-white placeholder:text-gray-500 focus:border-blue-500 focus:ring-blue-500 rounded-[10px]"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-300">Comment (optional)</Label>
                  <Input
                    placeholder="Enter comment"
                    value={tonComment}
                    onChange={(e) => setTonComment(e.target.value)}
                    className="bg-transparent border-gray-700 text-white placeholder:text-gray-500 focus:border-blue-500 focus:ring-blue-500 rounded-[10px]"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-white mb-1">Star Payment</p>
                  <p className="text-xs text-gray-400 mb-4">Enter your payment details to withdraw earned funds.</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-300">Telegram Username</Label>
                  <Input
                    placeholder="Enter Telegram username"
                    value={telegramUsername}
                    onChange={(e) => setTelegramUsername(e.target.value)}
                    className="bg-transparent border-gray-700 text-white placeholder:text-gray-500 focus:border-blue-500 focus:ring-blue-500 rounded-[10px]"
                  />
                </div>
              </div>
            )}

            <div className="mt-4">
              <Button
                className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-[20px]"
                onClick={handleSave}
                disabled={saveWalletMutation.isPending}
              >
                {saveWalletMutation.isPending ? (
                  <>
                    <i className="fas fa-spinner fa-spin mr-2"></i>
                    Saving...
                  </>
                ) : (
                  'Save Wallet'
                )}
              </Button>
            </div>
          </div>
      </DialogContent>
    </Dialog>
  );
}
