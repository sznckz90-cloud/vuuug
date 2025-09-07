import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { useToast } from "@/hooks/use-toast";
import Layout from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";

export default function Profile() {
  const { toast } = useToast();
  const { user, isLoading } = useAuth();
  const { isAdmin } = useAdmin();
  const queryClient = useQueryClient();
  
  const [withdrawalAmount, setWithdrawalAmount] = useState("");
  const [withdrawalMethod, setWithdrawalMethod] = useState("");
  const [methodDetails, setMethodDetails] = useState("");

  // Payment method configurations
  const paymentMethods = {
    usdt_polygon: {
      name: "🧢 Tether (Polygon POS)",
      min: 0.10,
      commission: 0.02,
      placeholder: "Polygon address",
      label: "Enter the Polygon address.",
      lowBalanceMessage: "There are not enough funds on your balance. The minimum amount to withdraw to \"Tether (Polygon POS)\" is $0.10"
    },
    litecoin: {
      name: "⏺️ Litecoin (LTC)",
      min: 0.35,
      commission: 0.05,
      placeholder: "Litecoin address",
      label: "Enter the Litecoin address.",
      lowBalanceMessage: "There are not enough funds on your balance. The minimum amount to withdraw to \"Litecoin (LTC)\" is $0.35"
    }
  };


  const withdrawalMutation = useMutation({
    mutationFn: async (data: { amount: string; method: string; details: any }) => {
      const response = await apiRequest("POST", "/api/withdrawals", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/withdrawals"] });
      setWithdrawalAmount("");
      setWithdrawalMethod("");
      setMethodDetails("");
      toast({
        title: "Success",
        description: "The payout request has been successfully created and will be processed within an hour",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to submit withdrawal request",
        variant: "destructive",
      });
    },
  });

  const handleWithdrawal = () => {
    if (!withdrawalAmount || !withdrawalMethod || !methodDetails) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    const amount = parseFloat(withdrawalAmount);
    const balance = parseFloat((user as any)?.balance || "0");
    const selectedMethod = paymentMethods[withdrawalMethod as keyof typeof paymentMethods];

    if (amount <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid amount",
        variant: "destructive",
      });
      return;
    }

    if (amount > balance) {
      toast({
        title: "Error",
        description: "Insufficient balance",
        variant: "destructive",
      });
      return;
    }

    if (selectedMethod && amount < selectedMethod.min) {
      toast({
        title: "Error",
        description: selectedMethod.lowBalanceMessage,
        variant: "destructive",
      });
      return;
    }

    withdrawalMutation.mutate({
      amount: withdrawalAmount,
      method: withdrawalMethod,
      details: { [withdrawalMethod]: methodDetails },
    });
  };

  // Calculate commission and net amount
  const getWithdrawalDetails = () => {
    if (!withdrawalAmount || !withdrawalMethod) return null;
    
    const amount = parseFloat(withdrawalAmount) || 0;
    const selectedMethod = paymentMethods[withdrawalMethod as keyof typeof paymentMethods];
    if (!selectedMethod) return null;
    
    const commission = selectedMethod.commission || 0;
    const netAmount = Math.max(0, amount - commission);
    
    return {
      amount,
      commission,
      netAmount,
      method: selectedMethod.name
    };
  };

  const withdrawalDetails = getWithdrawalDetails();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin text-primary text-3xl mb-4">
            <i className="fas fa-spinner"></i>
          </div>
          <div className="text-foreground font-medium">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <Layout>
      <main className="max-w-md mx-auto px-4 pb-20">
        <div className="py-6">
          <h1 className="text-2xl font-bold text-foreground mb-6 text-center">
            Profile
          </h1>

          {/* User Info */}
          <Card className="shadow-sm border border-border mb-6">
            <CardContent className="p-6 text-center">
              <div className="bg-primary/10 p-4 rounded-full inline-block mb-4">
                {(user as any)?.profileImageUrl ? (
                  <img 
                    src={(user as any).profileImageUrl} 
                    alt="Profile" 
                    className="w-12 h-12 rounded-full object-cover"
                    data-testid="img-profile-avatar"
                  />
                ) : (
                  <i className="fas fa-user text-primary text-2xl"></i>
                )}
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-1" data-testid="text-user-name">
                {(user as any)?.firstName || (user as any)?.lastName ? `${(user as any).firstName || ''} ${(user as any).lastName || ''}`.trim() : 'User'}
              </h3>
              <p className="text-muted-foreground text-sm" data-testid="text-user-email">
                Telegram ID: {(user as any)?.id || 'Unknown'}
              </p>
              {isAdmin && (
                <div className="mt-4">
                  <Link href="/admin">
                    <Button 
                      size="default"
                      className="bg-orange-600 hover:bg-orange-700 border-orange-600 text-white"
                      data-testid="button-admin-dashboard"
                    >
                      <i className="fas fa-crown mr-2"></i>
                      Admin Panel
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          {/* User Info with Admin Access */}

          {/* Balance & Withdrawal */}
          <Card className="shadow-sm border border-border mb-6">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">Withdraw Earnings</h3>
              
              <div className="text-center mb-6">
                <div className="text-3xl font-bold text-primary mb-2" data-testid="text-withdrawal-balance">
                  ${(user as any) ? Math.max(0, parseFloat((user as any).balance || "0")).toFixed(5) : "0.00000"}
                </div>
                <div className="text-muted-foreground text-sm">Available Balance</div>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="withdrawal-amount">Amount (USD)</Label>
                  <Input
                    id="withdrawal-amount"
                    type="number"
                    placeholder="0.00"
                    min="5"
                    step="0.01"
                    value={withdrawalAmount}
                    onChange={(e) => setWithdrawalAmount(e.target.value)}
                    data-testid="input-withdrawal-amount"
                  />
                </div>

                <div>
                  <Label htmlFor="withdrawal-method">Withdrawal Method</Label>
                  <Select value={withdrawalMethod} onValueChange={setWithdrawalMethod}>
                    <SelectTrigger data-testid="select-withdrawal-method">
                      <SelectValue placeholder="Select method" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(paymentMethods).map(([key, method]) => (
                        <SelectItem key={key} value={key}>{method.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="method-details">
                    {withdrawalMethod && paymentMethods[withdrawalMethod as keyof typeof paymentMethods] 
                      ? paymentMethods[withdrawalMethod as keyof typeof paymentMethods].label
                      : 'Method Details'}
                  </Label>
                  <Input
                    id="method-details"
                    placeholder={
                      withdrawalMethod && paymentMethods[withdrawalMethod as keyof typeof paymentMethods]
                        ? paymentMethods[withdrawalMethod as keyof typeof paymentMethods].placeholder
                        : 'Enter details'
                    }
                    value={methodDetails}
                    onChange={(e) => setMethodDetails(e.target.value)}
                    data-testid="input-method-details"
                  />
                </div>

                <Button
                  onClick={handleWithdrawal}
                  disabled={withdrawalMutation.isPending}
                  className="w-full bg-primary hover:bg-primary/90"
                  data-testid="button-submit-withdrawal"
                >
                  {withdrawalMutation.isPending ? (
                    <>
                      <i className="fas fa-spinner fa-spin mr-2"></i>
                      Processing...
                    </>
                  ) : (
                    'Request Withdrawal'
                  )}
                </Button>
              </div>

              {withdrawalDetails && (
                <div className="bg-muted/50 p-3 rounded-lg mt-4 text-sm">
                  <div className="flex justify-between mb-1">
                    <span className="text-muted-foreground">Withdrawal Amount:</span>
                    <span className="font-medium">${withdrawalDetails.amount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between mb-1">
                    <span className="text-muted-foreground">Commission:</span>
                    <span className="font-medium text-red-600">-${Math.abs(withdrawalDetails.commission).toFixed(2)}</span>
                  </div>
                  <div className="border-t border-border pt-1 mt-1">
                    <div className="flex justify-between">
                      <span className="font-semibold">You will receive:</span>
                      <span className="font-semibold text-primary">${withdrawalDetails.netAmount.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}
              
              <p className="text-muted-foreground text-xs mt-4">
                {withdrawalMethod && paymentMethods[withdrawalMethod as keyof typeof paymentMethods]
                  ? `Minimum withdrawal: $${paymentMethods[withdrawalMethod as keyof typeof paymentMethods].min.toFixed(2)}`
                  : 'Select a withdrawal method'} • Processing time: within an hour
              </p>
            </CardContent>
          </Card>


        </div>
      </main>
    </Layout>
  );
}
