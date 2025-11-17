import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Layout from '@/components/Layout';
import { Receipt, ArrowDownCircle, Clock, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

interface Withdrawal {
  id: string;
  amount: string;
  details: string;
  status: string;
  createdAt: string;
  comment?: string;
  method?: string;
}

interface WithdrawalsResponse {
  success: boolean;
  withdrawals: Withdrawal[];
}

export default function WalletActivity() {
  const { data, isLoading } = useQuery<WithdrawalsResponse>({
    queryKey: ['/api/withdrawals'],
    retry: false,
  });

  const withdrawals = data?.withdrawals || [];

  const getStatusIcon = (status: string) => {
    const lowerStatus = status.toLowerCase();
    if (lowerStatus.includes('approved') || lowerStatus.includes('success') || lowerStatus.includes('paid')) {
      return <CheckCircle className="w-5 h-5 text-green-500" />;
    } else if (lowerStatus.includes('reject')) {
      return <XCircle className="w-5 h-5 text-red-500" />;
    } else if (lowerStatus.includes('pending')) {
      return <Clock className="w-5 h-5 text-yellow-500" />;
    }
    return <Loader2 className="w-5 h-5 text-gray-500" />;
  };

  const getStatusColor = (status: string) => {
    const lowerStatus = status.toLowerCase();
    if (lowerStatus.includes('approved') || lowerStatus.includes('success') || lowerStatus.includes('paid')) {
      return 'text-green-500';
    } else if (lowerStatus.includes('reject')) {
      return 'text-red-500';
    } else if (lowerStatus.includes('pending')) {
      return 'text-yellow-500';
    }
    return 'text-gray-500';
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin text-[#4cd3ff] mx-auto mb-4" />
            <div className="text-white font-medium">Loading...</div>
          </div>
        </div>
      </Layout>
    );
  }

  const formatUSD = (amount: string) => {
    return parseFloat(amount).toFixed(2);
  };

  return (
    <Layout>
      <main className="max-w-md mx-auto px-4 mt-3 pb-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#4cd3ff]/20 to-[#b8b8b8]/20 flex items-center justify-center border border-white/10">
            <Receipt className="w-6 h-6 text-[#4cd3ff]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Wallet Activity</h1>
            <p className="text-sm text-gray-400">Your transaction history</p>
          </div>
        </div>

        {!withdrawals || withdrawals.length === 0 ? (
          <Card className="bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] border-white/10">
            <CardContent className="py-12">
              <div className="text-center">
                <ArrowDownCircle className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400 text-lg mb-2">No transactions yet</p>
                <p className="text-gray-500 text-sm">Your withdrawal history will appear here</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {withdrawals.map((withdrawal) => (
              <Card 
                key={withdrawal.id} 
                className="bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] border-white/10 hover:border-[#4cd3ff]/30 transition-all"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(withdrawal.status)}
                      <div>
                        <CardTitle className="text-base text-white">
                          Withdrawal Request
                        </CardTitle>
                        <p className="text-xs text-gray-500 mt-1">
                          {format(new Date(withdrawal.createdAt), 'MMM dd, yyyy • hh:mm a')}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-[#4cd3ff]">
                        ${formatUSD(withdrawal.amount)}
                      </p>
                      <p className="text-xs text-gray-500">
                        USD
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center py-2 border-t border-white/5">
                      <span className="text-sm text-gray-400">Status</span>
                      <span className={`text-sm font-semibold capitalize ${getStatusColor(withdrawal.status)}`}>
                        {withdrawal.status}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-t border-white/5">
                      <span className="text-sm text-gray-400">Wallet Address</span>
                      <span className="text-xs text-gray-300 font-mono">
                        {withdrawal.details && withdrawal.details.length > 16
                          ? `${withdrawal.details.slice(0, 8)}...${withdrawal.details.slice(-8)}`
                          : withdrawal.details || 'N/A'}
                      </span>
                    </div>
                    {withdrawal.comment && (
                      <div className="py-2 border-t border-white/5">
                        <span className="text-sm text-gray-400 block mb-1">Note</span>
                        <p className="text-sm text-gray-300 bg-black/30 rounded-lg px-3 py-2">
                          {withdrawal.comment}
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </Layout>
  );
}
