import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Layout from '@/components/Layout';
import { Link } from 'wouter';
import { ArrowLeft } from 'lucide-react';

interface WithdrawalRequest {
  id: string;
  amount: string;
  method: string;
  status: string;
  details: any;
  createdAt: string;
  updatedAt?: string;
  adminNotes?: string;
}

export default function PaymentHistory() {
  const { data: withdrawalsData = [], isLoading: withdrawalsLoading } = useQuery<WithdrawalRequest[]>({
    queryKey: ['/api/withdrawals'],
    retry: false,
  });

  const getStatusTextColor = (status: string) => {
    switch (status) {
      case 'paid':
      case 'Approved':
      case 'Successfull':
        return 'text-green-600';
      case 'pending':
        return 'text-orange-600';
      case 'rejected':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'paid':
      case 'Approved':
      case 'Successfull':
        return 'Successful';
      case 'pending':
        return 'Pending';
      case 'rejected':
        return 'Rejected';
      default:
        return 'Unknown';
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    const day = date.getUTCDate().toString().padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[date.getUTCMonth()];
    const year = date.getUTCFullYear();
    const hours = date.getUTCHours().toString().padStart(2, '0');
    const minutes = date.getUTCMinutes().toString().padStart(2, '0');
    return `${day} ${month} ${year}, ${hours}:${minutes} UTC`;
  };

  return (
    <Layout>
      <div className="max-w-md mx-auto p-4 pb-20">
        <div className="flex items-center mb-4">
          <Link href="/wallet">
            <Button variant="ghost" size="sm" className="mr-2">
              <ArrowLeft size={16} className="mr-2" />
              Back
            </Button>
          </Link>
          <h1 className="text-xl font-bold">Payment History</h1>
        </div>

        <Card className="neon-glow-border shadow-lg">
          <CardContent className="p-3">
            {withdrawalsLoading ? (
              <div className="text-center py-8">
                <i className="fas fa-spinner fa-spin text-2xl text-muted-foreground mb-2"></i>
                <p className="text-muted-foreground text-sm">Loading history...</p>
              </div>
            ) : withdrawalsData.length > 0 ? (
              <div className="space-y-3">
                {withdrawalsData.map((withdrawal) => (
                  <div key={withdrawal.id} className="border rounded-lg p-3">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-lg">
                            {Math.round(parseFloat(withdrawal.amount) * 100000)} PAD
                          </span>
                          <Badge 
                            variant="outline" 
                            className={getStatusTextColor(withdrawal.status)}
                          >
                            {getStatusLabel(withdrawal.status)}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {withdrawal.method === 'ton_coin' && '💎 TON Coin'}
                          {withdrawal.method === 'telegram_premium' && '⭐ Telegram Premium'}
                          {withdrawal.method === 'telegram_stars' && '⭐ Telegram Stars'}
                        </p>
                      </div>
                    </div>
                    
                    <div className="text-xs text-muted-foreground space-y-1">
                      <p>📅 {formatDateTime(withdrawal.createdAt)}</p>
                      {withdrawal.adminNotes && (
                        <p className="text-blue-600">💬 {withdrawal.adminNotes}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <i className="fas fa-receipt text-2xl text-muted-foreground mb-2"></i>
                <div className="text-muted-foreground text-sm">No history</div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
