import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { History as HistoryIcon } from 'lucide-react';

interface HistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function HistoryDialog({ open, onOpenChange }: HistoryDialogProps) {
  const { data: withdrawalsResponse, isLoading } = useQuery<{ withdrawals?: any[] }>({
    queryKey: ['/api/withdrawals'],
    retry: false,
  });

  const withdrawals = withdrawalsResponse?.withdrawals || [];

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive'> = {
      pending: 'secondary',
      approved: 'default',
      rejected: 'destructive',
    };
    return <Badge variant={variants[status] || 'default'}>{status}</Badge>;
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
            <HistoryIcon className="w-5 h-5" />
            Withdrawal History
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[400px] pr-4">
          {isLoading ? (
            <div className="text-center py-8">
              <i className="fas fa-spinner fa-spin text-2xl text-muted-foreground"></i>
            </div>
          ) : withdrawals.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No withdrawal history
            </div>
          ) : (
            <div className="space-y-3">
              {withdrawals.map((withdrawal) => (
                <div key={withdrawal.id} className="border border-white/10 rounded-lg p-3 space-y-2 bg-[#0d0d0d]">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-white">
                      {Math.round(parseFloat(withdrawal.amount) * 100000).toLocaleString()} PAD
                    </span>
                    {getStatusBadge(withdrawal.status)}
                  </div>
                  <div className="text-sm text-[#c0c0c0]">
                    <div>{withdrawal.method}</div>
                    <div>{new Date(withdrawal.createdAt).toLocaleDateString()}</div>
                  </div>
                  {withdrawal.adminNotes && (
                    <div className="text-xs text-[#c0c0c0] bg-[#1a1a1a] p-2 rounded">
                      Note: {withdrawal.adminNotes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="flex justify-center pt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full bg-transparent border-white/20 text-white hover:bg-white/10"
          >
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
