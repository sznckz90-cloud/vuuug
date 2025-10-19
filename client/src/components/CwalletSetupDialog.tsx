import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Wallet, HelpCircle } from "lucide-react";
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

  const { data: user } = useQuery<any>({
    queryKey: ['/api/auth/user'],
    retry: false,
  });

  useEffect(() => {
    if (user?.cwalletId) {
      setCwalletId(user.cwalletId);
    }
  }, [user]);

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
      showNotification("Cwallet ID saved successfully", "success");
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
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
    saveCwalletMutation.mutate();
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
          <DialogTitle className="flex items-center gap-2 text-[#4cd3ff] text-lg">
            <Wallet className="w-5 h-5" />
            Set Cwallet ID
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <p className="text-xs text-[#c0c0c0]">
            One time setup • Used to withdraw your funds
          </p>

          <div className="space-y-2">
            <Input
              type="text"
              placeholder="Enter your CWallet ID"
              value={cwalletId}
              onChange={(e) => setCwalletId(e.target.value)}
              className="bg-[#0d0d0d] border-white/20 text-white placeholder:text-[#808080] focus:border-[#4cd3ff] transition-colors rounded-lg h-11"
            />
          </div>

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
            onClick={handleSave}
            disabled={saveCwalletMutation.isPending}
            className="flex-1 bg-[#4cd3ff] hover:bg-[#6ddeff] text-black font-semibold"
          >
            <Wallet className="w-4 h-4 mr-2" />
            {saveCwalletMutation.isPending ? "Saving..." : "Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
