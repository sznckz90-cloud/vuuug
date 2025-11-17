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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="w-5 h-5" />
            Wallet Setup
          </DialogTitle>
          <DialogDescription>
            Enter your payment details to withdraw earned funds
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={paymentType === 'ton' ? 'default' : 'outline'}
                onClick={() => setPaymentType('ton')}
              >
                <Gem className="w-4 h-4 mr-2" />
                TON Coin
              </Button>
              <Button
                type="button"
                variant={paymentType === 'stars' ? 'default' : 'outline'}
                onClick={() => setPaymentType('stars')}
              >
                <Star className="w-4 h-4 mr-2" />
                Telegram Stars
              </Button>
            </div>

            {paymentType === 'ton' ? (
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium mb-3">TON Payment</p>
                  <p className="text-xs text-muted-foreground mb-4">Enter your payment details to withdraw earned funds.</p>
                </div>
                <div className="space-y-2">
                  <Label>TON Address</Label>
                  <Input
                    placeholder="Enter TON address"
                    value={tonAddress}
                    onChange={(e) => setTonAddress(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Comment (optional)</Label>
                  <Input
                    placeholder="Enter comment"
                    value={tonComment}
                    onChange={(e) => setTonComment(e.target.value)}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium mb-3">Star Payment</p>
                  <p className="text-xs text-muted-foreground mb-4">Enter your payment details to withdraw earned funds.</p>
                </div>
                <div className="space-y-2">
                  <Label>Telegram Username</Label>
                  <Input
                    placeholder="Enter Telegram username"
                    value={telegramUsername}
                    onChange={(e) => setTelegramUsername(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Telegram Stars</p>
                </div>
              </div>
            )}

            <div className="mt-4">
              <Button
                className="w-full"
                onClick={handleSave}
                disabled={saveWalletMutation.isPending}
              >
                {saveWalletMutation.isPending ? 'Saving...' : 'Save Wallet'}
              </Button>
            </div>
          </div>
      </DialogContent>
    </Dialog>
  );
}
