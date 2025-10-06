import { useEffect, useState } from "react";
import { formatCurrency } from "@/lib/utils";

interface RewardData {
  amount: number;
}

export default function RewardNotification() {
  const [isVisible, setIsVisible] = useState(false);
  const [isHiding, setIsHiding] = useState(false);
  const [rewardAmount, setRewardAmount] = useState(0);

  useEffect(() => {
    const handleShowReward = (event: CustomEvent<RewardData>) => {
      setRewardAmount(event.detail.amount);
      setIsHiding(false);
      setIsVisible(true);
      
      setTimeout(() => {
        setIsHiding(true);
        setTimeout(() => {
          setIsVisible(false);
        }, 500);
      }, 1000);
    };

    window.addEventListener('showReward', handleShowReward as EventListener);
    
    return () => {
      window.removeEventListener('showReward', handleShowReward as EventListener);
    };
  }, []);

  if (!isVisible) return null;

  return (
    <div 
      className="fixed top-20 left-4 right-4 max-w-md mx-auto bg-primary text-primary-foreground p-4 rounded-lg shadow-lg z-50 transition-all duration-500"
      style={{
        animation: isHiding ? "slideOutDown 0.5s ease-out forwards" : "slideInUp 0.5s ease-out forwards",
        opacity: isHiding ? 0 : 1,
        transform: isHiding ? "translateY(100px)" : "translateY(0)"
      }}
    >
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
