import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import Layout from "@/components/Layout";
import { useUser } from "@/hooks/use-user";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface MarketState {
  currentPadz: string;
  globalAds: string;
  currentPrice: string;
}

function Exchange() {
  const { user } = useUser();
  const queryClient = useQueryClient();
  const [padzAmount, setPadzAmount] = useState("");
  const [usdtAmount, setUsdtAmount] = useState("");

  // Fetch current PADZ price and user balances
  const { data: marketState } = useQuery<MarketState>({
    queryKey: ["/api/market-state"],
    refetchInterval: 5000, // Update every 5 seconds
  });

  const { data: userStats } = useQuery({
    queryKey: ["/api/user/stats"],
    refetchInterval: 5000,
  });

  // Exchange mutation
  const exchangeMutation = useMutation({
    mutationFn: async (padzToExchange: string) => {
      const response = await fetch("/api/exchange", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          padzAmount: padzToExchange,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Exchange failed");
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Exchange Successful! 🎉",
        description: `Converted ${padzAmount} PADZ to ${data.usdtReceived} USDT`,
      });
      
      // Reset form
      setPadzAmount("");
      setUsdtAmount("");
      
      // Refresh user data
      queryClient.invalidateQueries({ queryKey: ["/api/user/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/market-state"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Exchange Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Calculate USDT amount when PADZ amount changes
  useEffect(() => {
    if (padzAmount && marketState?.currentPrice && !isNaN(Number(padzAmount))) {
      const padzValue = Number(padzAmount);
      const price = Number(marketState.currentPrice);
      const usdtValue = (padzValue * price).toFixed(6);
      setUsdtAmount(usdtValue);
    } else {
      setUsdtAmount("");
    }
  }, [padzAmount, marketState?.currentPrice]);

  const handlePadzAmountChange = (value: string) => {
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      setPadzAmount(value);
    }
  };

  const handleMaxClick = () => {
    if (userStats?.currentPadz) {
      setPadzAmount(userStats.currentPadz);
    }
  };

  const handleExchange = () => {
    if (!padzAmount || Number(padzAmount) <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid PADZ amount",
        variant: "destructive",
      });
      return;
    }

    if (!userStats?.currentPadz || Number(padzAmount) > Number(userStats.currentPadz)) {
      toast({
        title: "Insufficient Balance",
        description: "You don't have enough PADZ tokens",
        variant: "destructive",
      });
      return;
    }

    exchangeMutation.mutate(padzAmount);
  };

  const currentPrice = marketState?.currentPrice ? Number(marketState.currentPrice).toFixed(8) : "0.00000000";
  const padzBalance = userStats?.currentPadz || "0";
  const usdtBalance = userStats?.withdrawBalance || "0";

  return (
    <Layout>
      <div className="container mx-auto px-4 py-6 pb-20">
        <div className="max-w-md mx-auto space-y-6">
          {/* Header */}
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground mb-2">Exchange</h1>
            <p className="text-muted-foreground">Convert PADZ tokens to USDT</p>
          </div>

          {/* Current Price Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Current Price</CardTitle>
              <CardDescription>Live PADZ/USDT rate</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center">
                <div className="text-3xl font-bold text-primary">${currentPrice}</div>
                <div className="text-sm text-muted-foreground mt-1">per PADZ token</div>
              </div>
            </CardContent>
          </Card>

          {/* Balances Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Your Balances</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">PADZ Tokens</span>
                <span className="font-semibold">{Number(padzBalance).toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">USDT Balance</span>
                <span className="font-semibold">${Number(usdtBalance).toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Exchange Form */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Exchange PADZ → USDT</CardTitle>
              <CardDescription>Convert your PADZ tokens to withdrawable USDT</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* PADZ Input */}
              <div className="space-y-2">
                <Label htmlFor="padz-amount">PADZ Amount</Label>
                <div className="flex gap-2">
                  <Input
                    id="padz-amount"
                    type="text"
                    placeholder="0.00"
                    value={padzAmount}
                    onChange={(e) => handlePadzAmountChange(e.target.value)}
                  />
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleMaxClick}
                    className="shrink-0"
                  >
                    MAX
                  </Button>
                </div>
              </div>

              {/* Exchange Icon */}
              <div className="flex justify-center">
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                  <i className="fas fa-arrow-down text-muted-foreground" style={{fontFamily: 'Font Awesome 5 Free', fontWeight: 900}}></i>
                </div>
              </div>

              {/* USDT Output */}
              <div className="space-y-2">
                <Label htmlFor="usdt-amount">USDT Amount (Estimated)</Label>
                <Input
                  id="usdt-amount"
                  type="text"
                  placeholder="0.000000"
                  value={usdtAmount}
                  readOnly
                  className="bg-muted"
                />
              </div>

              <Separator />

              {/* Exchange Button */}
              <Button 
                onClick={handleExchange}
                disabled={!padzAmount || Number(padzAmount) <= 0 || exchangeMutation.isPending}
                className="w-full"
                size="lg"
              >
                {exchangeMutation.isPending ? (
                  <>
                    <i className="fas fa-spinner fa-spin mr-2" style={{fontFamily: 'Font Awesome 5 Free', fontWeight: 900}}></i>
                    Exchanging...
                  </>
                ) : (
                  <>
                    <i className="fas fa-exchange-alt mr-2" style={{fontFamily: 'Font Awesome 5 Free', fontWeight: 900}}></i>
                    Exchange PADZ
                  </>
                )}
              </Button>

              {/* Exchange Info */}
              {padzAmount && usdtAmount && (
                <div className="text-xs text-muted-foreground text-center space-y-1">
                  <div>Exchange Rate: 1 PADZ = ${currentPrice} USDT</div>
                  <div>Converted USDT will be added to your withdraw balance</div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}

export default Exchange;