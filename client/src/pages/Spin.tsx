import { useState } from "react";
import Layout from "@/components/Layout";
import { NumberCountingSpinner } from "@/components/NumberCountingSpinner";
import { Button } from "@/components/ui/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { showNotification } from "@/components/AppNotification";

declare global {
  interface Window {
    show_9368336: (type?: string | { type: string; inAppSettings: any }) => Promise<void>;
  }
}

export default function Spin() {
  const queryClient = useQueryClient();
  const [isSpinning, setIsSpinning] = useState(false);
  const [finalReward, setFinalReward] = useState<string>("");

  const spinMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/spin/perform", {});
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/earnings"] });
      
      if (data.success && data.reward) {
        setFinalReward(data.reward);
        showNotification(`You won: ${data.reward} TON`, "success", parseFloat(data.reward));
      }
    },
    onError: (error: any) => {
      showNotification(`⚠️ ${error.message || 'Failed to spin'}`, "error");
      setIsSpinning(false);
    },
  });

  const handleSpin = async () => {
    if (isSpinning) return;
    
    setIsSpinning(true);
    setFinalReward("");
    
    try {
      // Show ad first
      if (typeof window.show_9368336 === 'function') {
        await window.show_9368336();
      }
      
      // After ad completes, perform spin
      setTimeout(async () => {
        await spinMutation.mutateAsync();
      }, 1000);
      
    } catch (error) {
      console.error('Ad or spin failed:', error);
      // Still perform spin even if ad fails
      await spinMutation.mutateAsync();
    } finally {
      setTimeout(() => {
        setIsSpinning(false);
      }, 4000);
    }
  };

  return (
    <Layout>
      <main className="max-w-md mx-auto px-4 pb-20">
        <div className="mt-8 mb-8">
          <h1 className="text-4xl font-bold text-center text-foreground mb-2">
            🎰 SPIN & WIN
          </h1>
        </div>

        <NumberCountingSpinner 
          isSpinning={isSpinning} 
          finalValue={finalReward}
          onComplete={() => setIsSpinning(false)}
        />

        <div className="mt-8">
          <Button
            onClick={handleSpin}
            disabled={isSpinning}
            size="lg"
            className="w-full h-16 text-xl font-bold rounded-xl shadow-lg disabled:opacity-50"
          >
            {isSpinning ? (
              <span className="flex items-center gap-2">
                <i className="fas fa-spinner fa-spin"></i>
                Spinning...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <i className="fas fa-rotate"></i>
                SPIN NOW
              </span>
            )}
          </Button>
        </div>
      </main>
    </Layout>
  );
}
