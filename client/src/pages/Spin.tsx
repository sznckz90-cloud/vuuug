import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Layout from "@/components/Layout";
import { NumberCountingSpinner } from "@/components/NumberCountingSpinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/queryClient";
import { showNotification } from "@/components/AppNotification";
import { Ticket, Tv } from "lucide-react";

declare global {
  interface Window {
    show_9368336: (type?: string | { type: string; inAppSettings: any }) => Promise<void>;
  }
}

export default function Spin() {
  const queryClient = useQueryClient();
  const [isSpinning, setIsSpinning] = useState(false);
  const [isAutoSpinning, setIsAutoSpinning] = useState(false);
  const [finalReward, setFinalReward] = useState<string>("");
  const [coinsToExchange, setCoinsToExchange] = useState("");
  const [showRewardBubble, setShowRewardBubble] = useState(false);
  const autoSpinRef = useRef<boolean>(false);

  const { data: user } = useQuery({
    queryKey: ["/api/auth/user"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/auth/user");
      return response.json();
    },
  });

  const spinTickets = user?.spinTickets || 0;
  const spinCoins = user?.spinCoins || 0;

  const spinMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/spin/perform", {});
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/stats"] });
      
      if (data.success && data.reward) {
        setFinalReward(data.reward.toString());
        setShowRewardBubble(true);
        setTimeout(() => setShowRewardBubble(false), 2000);

        // Continue auto-spin if enabled
        if (autoSpinRef.current && spinTickets > 1) {
          setTimeout(() => {
            if (autoSpinRef.current) {
              handleSpin();
            }
          }, 2500);
        } else if (autoSpinRef.current) {
          setIsAutoSpinning(false);
          autoSpinRef.current = false;
        }
      } else if (data.message) {
        showNotification(data.message, "error");
        setIsAutoSpinning(false);
        autoSpinRef.current = false;
      }
    },
    onError: (error: any) => {
      showNotification(`⚠️ ${error.message || 'Failed to spin'}`, "error");
      setIsSpinning(false);
      setIsAutoSpinning(false);
      autoSpinRef.current = false;
    },
  });

  const addTicketMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/spin/add-ticket", {});
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      if (data.success) {
        showNotification("✅ You earned 1 spin ticket!", "success");
      }
    },
    onError: (error: any) => {
      showNotification(`⚠️ ${error.message || 'Failed to get ticket'}`, "error");
    },
  });

  const exchangeMutation = useMutation({
    mutationFn: async (coins: number) => {
      const response = await apiRequest("POST", "/api/spin/exchange", { coins });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/earnings"] });
      
      if (data.success && data.tonAmount) {
        showNotification(`💎 Exchanged ${coinsToExchange} coins for ${data.tonAmount} TON!`, "success");
        setCoinsToExchange("");
      } else if (data.message) {
        showNotification(data.message, "error");
      }
    },
    onError: (error: any) => {
      showNotification(`⚠️ ${error.message || 'Failed to exchange'}`, "error");
    },
  });

  const handleGetMoreSpin = async () => {
    try {
      if (typeof window.show_9368336 === 'function') {
        await window.show_9368336();
      }
      await addTicketMutation.mutateAsync();
    } catch (error) {
      console.error('Ad failed:', error);
      await addTicketMutation.mutateAsync();
    }
  };

  const handleSpin = async () => {
    if (isSpinning || spinTickets <= 0) return;
    
    setIsSpinning(true);
    setFinalReward("");
    setShowRewardBubble(false);
    
    try {
      if (typeof window.show_9368336 === 'function') {
        await window.show_9368336();
      }
      await spinMutation.mutateAsync();
    } catch (error) {
      console.error('Ad or spin failed:', error);
      await spinMutation.mutateAsync();
    } finally {
      setTimeout(() => {
        setIsSpinning(false);
      }, 3500);
    }
  };

  const handleAutoSpin = () => {
    if (isAutoSpinning) {
      // Stop auto-spin
      setIsAutoSpinning(false);
      autoSpinRef.current = false;
    } else {
      // Start auto-spin
      if (spinTickets <= 0) {
        showNotification("No tickets available", "error");
        return;
      }
      setIsAutoSpinning(true);
      autoSpinRef.current = true;
      handleSpin();
    }
  };

  const handleExchange = () => {
    const coins = parseInt(coinsToExchange);
    if (isNaN(coins) || coins < 100) {
      showNotification("Minimum exchange is 100 coins", "error");
      return;
    }
    if (coins > spinCoins) {
      showNotification("Insufficient coins", "error");
      return;
    }
    exchangeMutation.mutate(coins);
  };

  return (
    <Layout>
      <main className="max-w-md mx-auto px-4 pb-20">
        
        {/* Page Title */}
        <div className="text-center mt-6 mb-4">
          <h1 className="text-2xl font-bold flex items-center justify-center gap-2">
            <span className="text-4xl">🎰</span>
            <span>Spin and Earn</span>
          </h1>
        </div>

        <div className="space-y-5">
          
          {/* Spinner Section */}
          <div className="relative">
            {showRewardBubble && finalReward && (
              <div className="absolute -top-12 left-1/2 -translate-x-1/2 z-10 animate-bounce">
                <div className="bg-green-500 text-white px-4 py-2 rounded-full text-sm font-semibold shadow-lg whitespace-nowrap">
                  You won: {finalReward} coins
                </div>
              </div>
            )}
            
            <NumberCountingSpinner 
              isSpinning={isSpinning} 
              finalValue={finalReward}
              onComplete={() => setIsSpinning(false)}
            />

            <div className="mt-4 flex gap-3">
              <Button
                onClick={handleSpin}
                disabled={isSpinning || spinTickets <= 0 || isAutoSpinning}
                size="lg"
                className="flex-1 h-14 text-xl font-bold rounded-xl shadow-lg disabled:opacity-50"
              >
                SPIN
              </Button>
              
              <Button
                onClick={handleAutoSpin}
                disabled={spinTickets <= 0}
                size="lg"
                variant={isAutoSpinning ? "destructive" : "secondary"}
                className="h-14 px-6 text-xl font-bold rounded-xl shadow-lg disabled:opacity-50"
              >
                {isAutoSpinning ? "STOP" : "AUTO"}
              </Button>
            </div>
          </div>

          {/* Tickets Section */}
          <div className="bg-card border rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="font-semibold">Tickets:</span>
                <span className="text-2xl font-bold text-primary">{spinTickets}</span>
                <Ticket className="w-5 h-5 text-primary" />
              </div>
              <Button
                onClick={handleGetMoreSpin}
                disabled={addTicketMutation.isPending}
                size="sm"
                variant="outline"
                className="gap-1 text-xs"
              >
                <Tv className="w-4 h-4" />
                + Get More Spin
              </Button>
            </div>
          </div>

          {/* Exchange Section */}
          <div className="bg-card border rounded-xl p-4 shadow-sm">
            <div className="space-y-3">
              <Input
                type="number"
                placeholder="Enter coins"
                value={coinsToExchange}
                onChange={(e) => setCoinsToExchange(e.target.value)}
                min={100}
                max={spinCoins}
                className="h-11"
              />
              
              <Button
                onClick={handleExchange}
                disabled={!coinsToExchange || parseInt(coinsToExchange) < 100 || exchangeMutation.isPending}
                className="w-full h-11 font-semibold"
              >
                {exchangeMutation.isPending ? "Exchanging..." : "Exchange"}
              </Button>
              
              <div className="text-xs text-muted-foreground text-center space-y-0.5">
                <p>1,000,000 coins = 1 TON • Min: 100 coins</p>
                <p className="font-medium text-yellow-600">Your coins: {spinCoins.toLocaleString()}</p>
              </div>
            </div>
          </div>
          
        </div>
      </main>
    </Layout>
  );
}
