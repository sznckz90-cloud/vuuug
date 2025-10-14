import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { showNotification } from '@/components/AppNotification';
import Layout from '@/components/Layout';
import { apiRequest } from '@/lib/queryClient';
import { Link } from 'wouter';
import { ArrowLeft } from 'lucide-react';

interface WalletDetails {
  tonWalletAddress: string;
  tonWalletComment: string;
  telegramUsername: string;
  walletUpdatedAt?: string;
  canWithdraw: boolean;
}

interface WalletForm {
  tonWalletAddress: string;
  tonWalletComment: string;
  telegramUsername: string;
}

export default function MyWallets() {
  const queryClient = useQueryClient();
  
  const [walletForm, setWalletForm] = useState<WalletForm>({
    tonWalletAddress: '',
    tonWalletComment: '',
    telegramUsername: ''
  });

  const { data: walletDetailsData, isLoading: walletLoading } = useQuery<{ success: boolean; walletDetails: WalletDetails }>({
    queryKey: ['/api/wallet/details'],
    retry: false,
  });

  const walletDetails = walletDetailsData?.walletDetails;

  useEffect(() => {
    if (walletDetails) {
      setWalletForm({
        tonWalletAddress: walletDetails.tonWalletAddress || '',
        tonWalletComment: walletDetails.tonWalletComment || '',
        telegramUsername: walletDetails.telegramUsername || ''
      });
    }
  }, [walletDetails]);

  const saveWalletMutation = useMutation({
    mutationFn: async (data: WalletForm) => {
      const response = await apiRequest('POST', '/api/wallet/save', data);
      return response.json();
    },
    onSuccess: () => {
      showNotification("Saved! 24h hold applied.", "success");
      queryClient.invalidateQueries({ queryKey: ['/api/wallet/details'] });
    },
    onError: (error: any) => {
      showNotification(error.message || "Failed to save wallet details", "error");
    },
  });

  const handleSaveWallet = (e: React.FormEvent) => {
    e.preventDefault();
    saveWalletMutation.mutate(walletForm);
  };

  const updateWalletForm = (field: keyof WalletForm, value: string) => {
    setWalletForm(prev => ({ ...prev, [field]: value }));
  };

  if (walletLoading) {
    return (
      <Layout>
        <div className="max-w-md mx-auto p-4 pb-20">
          <div className="text-center py-8">
            <div className="animate-spin text-primary text-xl mb-2">
              <i className="fas fa-spinner"></i>
            </div>
            <div className="text-muted-foreground">Loading wallet...</div>
          </div>
        </div>
      </Layout>
    );
  }

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
          <h1 className="text-xl font-bold">My Wallets</h1>
        </div>

        <Card className="neon-glow-border shadow-lg">
          <CardHeader className="py-3">
            <CardTitle className="text-base font-medium">Payment Details</CardTitle>
            <CardDescription className="text-xs">Enter your payment details to withdraw earned funds.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveWallet} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-semibold">TON</Label>
                <Input
                  placeholder="Address"
                  value={walletForm.tonWalletAddress}
                  onChange={(e) => updateWalletForm('tonWalletAddress', e.target.value)}
                />
                <Input
                  placeholder="Optional comment"
                  value={walletForm.tonWalletComment}
                  onChange={(e) => updateWalletForm('tonWalletComment', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold">TELEGRAM</Label>
                <Input
                  placeholder="Username for premium/stars"
                  value={walletForm.telegramUsername}
                  onChange={(e) => updateWalletForm('telegramUsername', e.target.value)}
                />
              </div>

              <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <i className="fas fa-info-circle text-orange-600 dark:text-orange-400 mt-0.5"></i>
                  <p className="text-xs text-orange-800 dark:text-orange-300">
                    After changing the payment details, the possibility of withdrawal is put on hold for 24 hours.
                  </p>
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full"
                disabled={saveWalletMutation.isPending}
              >
                {saveWalletMutation.isPending ? (
                  <>
                    <i className="fas fa-spinner fa-spin mr-2"></i>
                    Saving...
                  </>
                ) : (
                  <>
                    <i className="fas fa-save mr-2"></i>
                    Save
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
