import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { showNotification } from '@/components/AppNotification';
import { Loader2 } from 'lucide-react';

interface User {
  id: string;
  tonBalance: string;
  friendsInvited?: number;
}

interface WithdrawDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function WithdrawDialog({ open, onOpenChange }: WithdrawDialogProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: user, refetch: refetchUser } = useQuery<User>({
    queryKey: ['/api/auth/user'],
    retry: false,
    // CRITICAL FIX: Gate query by dialog visibility and refetch when dialog opens
    enabled: open,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    staleTime: 0,
  });

  const tonBalance = parseFloat(user?.tonBalance || "0");
  const MINIMUM_WITHDRAWAL = 0.001;
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
      const response = await apiRequest('POST', '/api/withdrawals', {
        amount: tonBalance
      });
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
      
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "❌ Withdrawal failed",
        description: error.message || "Failed to submit withdrawal request",
        variant: "destructive",
      });
    },
  });

  const handleWithdraw = () => {
    if (friendsInvited < MINIMUM_FRIENDS_REQUIRED) {
      toast({
        title: "❌ Withdrawal locked",
        description: "You need to invite at least 3 friends to unlock withdrawals.",
        variant: "destructive",
      });
      return;
    }

    if (hasPendingWithdrawal) {
      toast({
        title: "Pending withdrawal exists",
        description: "Cannot create new request until current one is processed",
        variant: "destructive",
      });
      return;
    }

    if (tonBalance < MINIMUM_WITHDRAWAL) {
      toast({
        title: "Insufficient balance",
        description: "You need at least 0.001 TON to withdraw.",
        variant: "destructive",
      });
      return;
    }

    withdrawMutation.mutate();
  };

  return (
    <Dialog 
      open={open} 
      onOpenChange={(newOpen) => {
        // Prevent closing by clicking outside
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
          <DialogTitle className="text-[#4cd3ff] text-lg">Withdraw TON</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="p-4 bg-[#0d0d0d] rounded-lg border border-[#4cd3ff]/20">
            <div className="text-xs text-muted-foreground mb-1">Available Balance</div>
            <div className="text-2xl font-bold text-[#4cd3ff]">{tonBalance.toFixed(4)} TON</div>
            <div className="text-xs text-[#c0c0c0] mt-2">
              You will withdraw your entire TON balance
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
            disabled={withdrawMutation.isPending || hasPendingWithdrawal || tonBalance < MINIMUM_WITHDRAWAL || friendsInvited < MINIMUM_FRIENDS_REQUIRED}
            className="flex-1 bg-[#4cd3ff] hover:bg-[#6ddeff] text-black font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {withdrawMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : "Withdraw All"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
