import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { showNotification } from '@/components/AppNotification';
import { Loader2, Check } from 'lucide-react';
import { PAYMENT_SYSTEMS, STAR_PACKAGES, PAD_TO_USD_RATE } from '@/constants/paymentSystems';

interface User {
  id: string;
  balance: string;
  usdBalance?: string;
  friendsInvited?: number;
}

interface WithdrawDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function WithdrawDialog({ open, onOpenChange }: WithdrawDialogProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedMethod, setSelectedMethod] = useState<string>('TON');
  const [selectedStarPackage, setSelectedStarPackage] = useState<number | null>(null);

  const { data: user, refetch: refetchUser } = useQuery<User>({
    queryKey: ['/api/auth/user'],
    retry: false,
    enabled: open,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    staleTime: 0,
  });

  const { data: appSettings } = useQuery<any>({
    queryKey: ['/api/app-settings'],
    retry: false,
  });

  const padBalance = parseFloat(user?.balance || "0") * 10000000;
  const usdBalance = parseFloat(user?.usdBalance || "0");
  const friendsInvited = user?.friendsInvited || 0;
  const MINIMUM_FRIENDS_REQUIRED = 3;

  const { data: withdrawalsResponse, refetch: refetchWithdrawals } = useQuery<{ withdrawals?: any[] }>({
    queryKey: ['/api/withdrawals'],
    retry: false,
    // Gate query by dialog visibility
    enabled: open,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    staleTime: 0,
  });

  // Explicitly refetch fresh data whenever dialog opens
  useEffect(() => {
    if (open) {
      refetchUser();
      refetchWithdrawals();
    }
  }, [open, refetchUser, refetchWithdrawals]);

  const withdrawalsData = withdrawalsResponse?.withdrawals || [];
  const hasPendingWithdrawal = withdrawalsData.some(w => w.status === 'pending');

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
      } else {
        const fee = usdBalance * 0.05;
        withdrawalData.amount = usdBalance - fee;
      }

      const response = await apiRequest('POST', '/api/withdrawals', withdrawalData);
      return response.json();
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
      onOpenChange(false);
    },
    onError: (error: any) => {
      showNotification(`${error.message || "Failed to submit withdrawal request"}`, "error");
    },
  });

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
    return usdBalance * 0.95;
  };

  return (
    <Dialog 
      open={open} 
      onOpenChange={(newOpen) => {
        if (!newOpen) return;
        onOpenChange(newOpen);
      }}
    >
      <DialogContent 
        className="sm:max-w-md frosted-glass border border-white/10 rounded-2xl"
        onInteractOutside={(e) => e.preventDefault()}
        hideCloseButton
      >
        <DialogHeader>
          <DialogTitle className="text-[#4cd3ff] text-lg">Withdraw Funds</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
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
                    <span className="text-lg">{system.emoji}</span>
                    <span className="text-white">{system.name}</span>
                    <span className="text-xs text-[#aaa] ml-auto">({system.fee}% fee)</span>
                  </div>
                </button>
              ))}
            </div>

            {selectedMethod === 'STARS' && (
              <div className="space-y-2">
                <Label className="text-sm text-white">Select Star Package</Label>
                <select
                  value={selectedStarPackage || ''}
                  onChange={(e) => setSelectedStarPackage(Number(e.target.value))}
                  className="w-full p-3 rounded-lg border border-[#4cd3ff]/30 bg-[#1a1a1a] text-white focus:outline-none focus:border-[#4cd3ff] transition-all"
                >
                  <option value="" disabled>Choose stars amount...</option>
                  {STAR_PACKAGES.map((pkg) => (
                    <option key={pkg.stars} value={pkg.stars}>
                      ⭐{pkg.stars} - ${pkg.usdCost.toFixed(2)} (+ 5% fee = ${(pkg.usdCost * 1.05).toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {selectedMethod !== 'STARS' && (
              <div className="p-3 bg-[#1a1a1a] rounded-lg border border-[#2a2a2a]">
                <div className="text-xs text-[#aaa]">You will receive</div>
                <div className="text-lg font-bold text-white">${calculateWithdrawalAmount().toFixed(2)}</div>
                <div className="text-xs text-[#aaa] mt-1">Full balance withdrawal (5% fee deducted)</div>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-center gap-3">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
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
      </DialogContent>
    </Dialog>
  );
}
