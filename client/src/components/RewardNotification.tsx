import { useEffect, useState } from "react";
import { formatCurrency } from "@/lib/utils";

interface RewardData {
  amount: number;
}

export default function RewardNotification() {
  const [isVisible, setIsVisible] = useState(false);
  const [rewardAmount, setRewardAmount] = useState(0);

  useEffect(() => {
    const handleShowReward = (event: CustomEvent<RewardData>) => {
      setRewardAmount(event.detail.amount);
      setIsVisible(true);
      
      setTimeout(() => {
        setIsVisible(false);
      }, 3000);
    };

    window.addEventListener('showReward', handleShowReward as EventListener);
    
    return () => {
      window.removeEventListener('showReward', handleShowReward as EventListener);
    };
  }, []);

  if (!isVisible) return null;

  return (
    <div className="fixed top-20 left-4 right-4 max-w-md mx-auto bg-primary text-primary-foreground p-4 rounded-lg shadow-lg animate-slideInUp z-50">
      <div className="flex items-center gap-3">
        <i className="fas fa-check-circle text-xl"></i>
        <div>
          <div className="font-semibold">Reward Earned!</div>
          <div className="text-primary-foreground/80 text-sm">
            +{formatCurrency(rewardAmount, false)} added to your balance
          </div>
        </div>
      </div>
    </div>
  );
}
