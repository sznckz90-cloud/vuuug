import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { History as HistoryIcon } from 'lucide-react';

interface HistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function HistoryDialog({ open, onOpenChange }: HistoryDialogProps) {
  const { data: withdrawals = [], isLoading } = useQuery<any[]>({
    queryKey: ['/api/withdrawals'],
    retry: false,
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive'> = {
      pending: 'secondary',
      approved: 'default',
      rejected: 'destructive',
    };
    return <Badge variant={variants[status] || 'default'}>{status}</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
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
                <div key={withdrawal.id} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">
                      {Math.round(parseFloat(withdrawal.amount) * 100000).toLocaleString()} PAD
                    </span>
                    {getStatusBadge(withdrawal.status)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <div>{withdrawal.method}</div>
                    <div>{new Date(withdrawal.createdAt).toLocaleDateString()}</div>
                  </div>
                  {withdrawal.adminNotes && (
                    <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
                      Note: {withdrawal.adminNotes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
