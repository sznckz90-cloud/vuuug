import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Wallet, HelpCircle, Info, Lock } from "lucide-react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { showNotification } from "@/components/AppNotification";
import { apiRequest } from "@/lib/queryClient";

interface CwalletSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CwalletSetupDialog({ open, onOpenChange }: CwalletSetupDialogProps) {
  const queryClient = useQueryClient();
  const [cwalletId, setCwalletId] = useState('');
  const [newWalletId, setNewWalletId] = useState('');
  const [isChangingWallet, setIsChangingWallet] = useState(false);

  const { data: user } = useQuery<any>({
    queryKey: ['/api/auth/user'],
    retry: false,
  });

  const { data: appSettings } = useQuery<any>({
    queryKey: ['/api/app-settings'],
    retry: false,
  });

  const walletChangeFee = appSettings?.walletChangeFee || 5000;

  useEffect(() => {
    if (user?.cwalletId) {
      setCwalletId(user.cwalletId);
    }
  }, [user]);
  
  // Reset changing mode when dialog closes
  useEffect(() => {
    if (!open) {
      setIsChangingWallet(false);
      setNewWalletId('');
    }
  }, [open]);

  const saveCwalletMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/wallet/cwallet', {
        cwalletId: cwalletId.trim()
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to save Cwallet ID");
      }
      return response.json();
    },
    onSuccess: () => {
      showNotification("Wallet saved successfully.", "success");
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      showNotification(error.message, "error");
    },
  });

  const changeWalletMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/wallet/change', {
        newWalletId: newWalletId.trim()
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to change wallet");
      }
      return response.json();
    },
    onSuccess: (data) => {
      showNotification("Wallet updated successfully", "success");
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      setIsChangingWallet(false);
      setNewWalletId('');
      onOpenChange(false);
    },
    onError: (error: Error) => {
      showNotification(error.message, "error");
    },
  });

  const handleSave = () => {
    if (!cwalletId.trim()) {
      showNotification("Please enter your Cwallet ID", "error");
      return;
    }
    
    // Validate numeric only
    if (!/^\d+$/.test(cwalletId.trim())) {
      showNotification("Wallet ID must contain only numbers", "error");
      return;
    }
    
    saveCwalletMutation.mutate();
  };

  const handleChangeWallet = () => {
    if (!newWalletId.trim()) {
      showNotification("Please enter a new Cwallet ID", "error");
      return;
    }
    
    // Validate numeric only
    if (!/^\d+$/.test(newWalletId.trim())) {
      showNotification("Wallet ID must contain only numbers", "error");
      return;
    }
    
    changeWalletMutation.mutate();
  };

  const isWalletLocked = !!user?.cwalletId;

  return (
    <Dialog 
      open={open} 
      onOpenChange={onOpenChange}
    >
      <DialogContent 
        className="sm:max-w-md frosted-glass border border-white/10 rounded-2xl"
        onInteractOutside={(e) => e.preventDefault()}
        hideCloseButton={!isWalletLocked}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[#4cd3ff] text-lg">
            <Wallet className="w-5 h-5" />
            {isWalletLocked && !isChangingWallet ? "Cwallet ID Set" : isChangingWallet ? "Change Wallet" : "Set Cwallet ID"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {isWalletLocked && !isChangingWallet ? (
            <>
              <p className="text-xs text-[#6ddeff] flex items-center gap-2">
                <Lock className="w-3 h-3" />
                Wallet linked successfully.
              </p>
              <div className="space-y-2">
                <Input
                  type="text"
                  placeholder="Enter your CWallet ID"
                  value={cwalletId}
                  disabled={true}
                  className="bg-[#0d0d0d] border-white/20 text-white placeholder:text-[#808080] focus:border-[#4cd3ff] transition-colors rounded-lg h-11 disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>
            </>
          ) : isChangingWallet ? (
            <>
              <div className="space-y-2">
                <label className="text-xs text-[#c0c0c0]">Current Wallet</label>
                <Input
                  type="text"
                  value={cwalletId}
                  disabled={true}
                  className="bg-[#0d0d0d] border-white/20 text-white placeholder:text-[#808080] focus:border-[#4cd3ff] transition-colors rounded-lg h-11 disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-[#c0c0c0]">New Wallet ID (numbers only)</label>
                <Input
                  type="text"
                  placeholder="Enter new wallet ID"
                  value={newWalletId}
                  onChange={(e) => setNewWalletId(e.target.value)}
                  className="bg-[#0d0d0d] border-white/20 text-white placeholder:text-[#808080] focus:border-[#4cd3ff] transition-colors rounded-lg h-11"
                />
              </div>
              <div className="flex items-start gap-2 p-3 bg-[#4cd3ff]/10 rounded-lg border border-[#4cd3ff]/30">
                <Info className="w-4 h-4 text-[#4cd3ff] mt-0.5 flex-shrink-0" />
                <div className="text-xs text-[#c0c0c0]">
                  Fee: <span className="text-[#4cd3ff] font-semibold">{walletChangeFee} PAD</span> will be deducted from your balance
                </div>
              </div>
            </>
          ) : (
            <>
              <p className="text-xs text-[#c0c0c0] flex items-center gap-2">
                <span className="text-red-500 font-semibold">One time setup</span> • Used to withdraw your funds
              </p>
              <div className="space-y-2">
                <Input
                  type="text"
                  placeholder="Enter your CWallet ID (numbers only)"
                  value={cwalletId}
                  onChange={(e) => setCwalletId(e.target.value)}
                  className="bg-[#0d0d0d] border-white/20 text-white placeholder:text-[#808080] focus:border-[#4cd3ff] transition-colors rounded-lg h-11"
                />
                <p className="text-xs text-red-500 font-medium flex items-center gap-1">
                  <Info className="w-3 h-3" />
                  One-time setup only – set carefully!
                </p>
              </div>
            </>
          )}

          {!isWalletLocked && (
            <div className="flex items-start gap-2 p-3 bg-[#0d0d0d] rounded-lg border border-white/5">
              <HelpCircle className="w-4 h-4 text-[#4cd3ff] mt-0.5 flex-shrink-0" />
              <div className="text-xs text-[#c0c0c0]">
                Don't have a Cwallet ID?{' '}
                <a 
                  href="https://cwallet.com/referralweb/XnKL50Ip" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-[#4cd3ff] hover:text-[#6ddeff] underline transition-colors"
                >
                  Create an account here Cwallet
                </a>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-center gap-3">
          {isWalletLocked && !isChangingWallet ? (
            <>
              <Button
                variant="outline"
                onClick={() => setIsChangingWallet(true)}
                className="flex-1 bg-transparent border-[#4cd3ff]/50 text-[#4cd3ff] hover:bg-[#4cd3ff]/10"
              >
                Change Wallet
              </Button>
              <Button
                onClick={() => onOpenChange(false)}
                className="flex-1 bg-[#4cd3ff] hover:bg-[#6ddeff] text-black font-semibold"
              >
                Close
              </Button>
            </>
          ) : isChangingWallet ? (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setIsChangingWallet(false);
                  setNewWalletId('');
                }}
                className="flex-1 bg-transparent border-white/20 text-white hover:bg-white/10"
              >
                Cancel
              </Button>
              <Button
                onClick={handleChangeWallet}
                disabled={changeWalletMutation.isPending}
                className="flex-1 bg-[#4cd3ff] hover:bg-[#6ddeff] text-black font-semibold"
              >
                {changeWalletMutation.isPending ? "Processing..." : `Pay ${walletChangeFee} PAD & Confirm`}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1 bg-transparent border-white/20 text-white hover:bg-white/10"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={saveCwalletMutation.isPending}
                className="flex-1 bg-[#4cd3ff] hover:bg-[#6ddeff] text-black font-semibold"
              >
                <Wallet className="w-4 h-4 mr-2" />
                {saveCwalletMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
