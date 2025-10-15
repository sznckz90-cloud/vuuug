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
  const [showChangeOptions, setShowChangeOptions] = useState(false);
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
  const balancePAD = Math.round(parseFloat(user?.balance || "0") * 100000);

  useEffect(() => {
    if (walletDetails) {
      setTonAddress(walletDetails.tonWalletAddress || '');
      setTonComment(walletDetails.tonWalletComment || '');
      setTelegramUsername(walletDetails.telegramUsername || '');
    }
  }, [walletDetails]);

  const saveWalletMutation = useMutation({
    mutationFn: async (paidChange: boolean) => {
      const response = await apiRequest('POST', '/api/wallet/save', {
        tonWalletAddress: tonAddress,
        tonWalletComment: tonComment,
        telegramUsername: telegramUsername,
        paidChange
      });
      return response.json();
    },
    onSuccess: (data) => {
      showNotification(data.message, "success");
      queryClient.invalidateQueries({ queryKey: ['/api/wallet/details'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      setShowChangeOptions(false);
      onOpenChange(false);
    },
    onError: (error: any) => {
      showNotification(error.message || "Failed to save wallet details", "error");
    },
  });

  const handleSave = (paidChange: boolean) => {
    if (!tonAddress && !telegramUsername) {
      showNotification("Please enter at least one wallet address", "error");
      return;
    }
    saveWalletMutation.mutate(paidChange);
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

        {showChangeOptions ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Choose how to update your wallet:</p>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => handleSave(false)}
              disabled={saveWalletMutation.isPending}
            >
              <div className="text-left">
                <div className="font-medium">Free (24-hour hold)</div>
                <div className="text-xs text-muted-foreground">Withdrawal available after 24 hours</div>
              </div>
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => handleSave(true)}
              disabled={saveWalletMutation.isPending || balancePAD < 300}
            >
              <div className="text-left">
                <div className="font-medium">Paid - 300 PAD (no hold)</div>
                <div className="text-xs text-muted-foreground">Withdrawal available immediately</div>
              </div>
            </Button>
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => setShowChangeOptions(false)}
            >
              Cancel
            </Button>
          </div>
        ) : (
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
              {isWalletSet ? (
                <Button
                  className="w-full"
                  onClick={() => setShowChangeOptions(true)}
                  disabled={saveWalletMutation.isPending}
                >
                  <Settings2 className="w-4 h-4 mr-2" />
                  Change Details
                </Button>
              ) : (
                <Button
                  className="w-full"
                  onClick={() => handleSave(false)}
                  disabled={saveWalletMutation.isPending}
                >
                  {saveWalletMutation.isPending ? 'Saving...' : 'Confirm & Save'}
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
