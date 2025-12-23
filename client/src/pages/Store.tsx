import { useState } from "react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import CryptoConversionWidget from "@/components/CryptoConversionWidget";
import { 
  Clock,
  TrendingUp,
  Gift,
  Loader2,
  Zap,
  Sparkles
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { showNotification } from "@/components/AppNotification";

const TON_BOOSTERS = [
  {
    id: "starter",
    name: "Starter Booster",
    price: 0.1,
    duration: 6,
    maxProfit: 0.015,
    totalReturn: 0.115,
    icon: <TrendingUp className="w-6 h-6" />,
    gradient: "from-emerald-400 to-emerald-600",
    bgGradient: "from-emerald-500/10 via-emerald-500/5 to-transparent"
  },
  {
    id: "quick",
    name: "Quick Booster",
    price: 0.2,
    duration: 12,
    maxProfit: 0.03,
    totalReturn: 0.23,
    icon: <Zap className="w-6 h-6" />,
    gradient: "from-blue-400 to-blue-600",
    bgGradient: "from-blue-500/10 via-blue-500/5 to-transparent"
  },
  {
    id: "power",
    name: "Power Booster",
    price: 0.5,
    duration: 24,
    maxProfit: 0.08,
    totalReturn: 0.58,
    icon: <Zap className="w-6 h-6" />,
    gradient: "from-indigo-400 to-indigo-600",
    bgGradient: "from-indigo-500/10 via-indigo-500/5 to-transparent",
    popular: true
  },
  {
    id: "pro",
    name: "Pro Booster",
    price: 1.0,
    duration: 24,
    maxProfit: 0.12,
    totalReturn: 1.12,
    icon: <TrendingUp className="w-6 h-6" />,
    gradient: "from-purple-400 to-purple-600",
    bgGradient: "from-purple-500/10 via-purple-500/5 to-transparent"
  },
  {
    id: "elite",
    name: "Elite Booster",
    price: 2.0,
    duration: 36,
    maxProfit: 0.18,
    totalReturn: 2.18,
    icon: <Sparkles className="w-6 h-6" />,
    gradient: "from-pink-400 to-pink-600",
    bgGradient: "from-pink-500/10 via-pink-500/5 to-transparent"
  },
  {
    id: "ultra",
    name: "Ultra Booster",
    price: 5.0,
    duration: 48,
    maxProfit: 0.3,
    totalReturn: 5.3,
    icon: <Sparkles className="w-6 h-6" />,
    gradient: "from-amber-400 to-orange-500",
    bgGradient: "from-amber-500/10 via-amber-500/5 to-transparent"
  },
  {
    id: "supreme",
    name: "Supreme Booster",
    price: 10.0,
    duration: 72,
    maxProfit: 0.5,
    totalReturn: 10.5,
    icon: <TrendingUp className="w-6 h-6" />,
    gradient: "from-orange-400 to-red-500",
    bgGradient: "from-orange-500/10 via-orange-500/5 to-transparent",
    popular: true
  },
];

function BoosterCard({ booster, onPurchase, isProcessing, isSelected }: any) {
  return (
    <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${booster.bgGradient} border border-white/5 backdrop-blur-sm hover:border-white/10 transition-all`}>
      {booster.popular && (
        <div className="absolute top-0 right-0">
          <div className="bg-gradient-to-r from-[#ADFF2F] to-[#7FFF00] text-black text-[9px] font-bold px-2.5 py-0.5 rounded-bl-lg">
            POPULAR
          </div>
        </div>
      )}
      
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${booster.gradient} flex items-center justify-center text-white shadow-lg`}>
            {booster.icon}
          </div>
          <span className="text-xs font-bold text-gray-300 bg-white/5 px-2 py-1 rounded-lg">{booster.price.toFixed(2)} TON</span>
        </div>
        
        <h3 className="text-sm font-bold text-white mb-1">{booster.name}</h3>
        
        <div className="grid grid-cols-3 gap-2 mb-3 py-2 border-y border-white/5">
          <div className="text-center">
            <Clock className="w-3 h-3 text-gray-400 mx-auto mb-0.5" />
            <p className="text-xs text-gray-400">{booster.duration}h</p>
          </div>
          <div className="text-center">
            <TrendingUp className="w-3 h-3 text-orange-400 mx-auto mb-0.5" />
            <p className="text-xs text-orange-400">+{booster.maxProfit.toFixed(3)}</p>
          </div>
          <div className="text-center">
            <Gift className="w-3 h-3 text-green-400 mx-auto mb-0.5" />
            <p className="text-xs text-green-400">{booster.totalReturn.toFixed(2)}</p>
          </div>
        </div>
        
        <Button 
          onClick={() => onPurchase(booster)}
          disabled={isProcessing}
          size="sm"
          className={`w-full h-8 bg-gradient-to-r ${booster.gradient} hover:opacity-90 text-white font-semibold text-xs rounded-lg shadow-md transition-all`}
        >
          {isSelected && isProcessing ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin inline mr-1" />
              Processing
            </>
          ) : (
            "Buy"
          )}
        </Button>
      </div>
    </div>
  );
}

export default function Store() {
  const { user } = useAuth();
  const [selectedBooster, setSelectedBooster] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleTonBoosterPurchase = async (booster: any) => {
    if (!user?.tonBalance || parseFloat(user.tonBalance) < booster.price) {
      showNotification("Insufficient TON balance", "error");
      return;
    }

    setIsProcessing(true);
    setSelectedBooster(booster.id);

    try {
      const response = await fetch("/api/mining/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          boosterId: booster.id,
          boosterName: booster.name,
          price: booster.price,
          durationHours: booster.duration,
          maxProfit: booster.maxProfit,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Purchase failed");
      }

      // Store mining session in localStorage
      localStorage.setItem(
        `mining_${user.id}`,
        JSON.stringify({
          boosterId: booster.id,
          boosterName: booster.name,
          durationHours: booster.duration,
          durationSeconds: booster.duration * 3600,
          maxProfit: booster.maxProfit,
          startTime: Date.now(),
        })
      );

      showNotification(
        `${booster.name} purchased! Mining starts now.`,
        "success"
      );

      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error: any) {
      showNotification(
        error.message || "Failed to purchase booster",
        "error"
      );
    } finally {
      setIsProcessing(false);
      setSelectedBooster(null);
    }
  };

  return (
    <Layout>
      <main className="pb-20">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-gradient-to-b from-background via-background to-transparent px-4 py-4">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-[#4cd3ff] to-[#00a8ff] mb-2 shadow-lg">
            <Zap className="w-6 h-6 text-black" />
          </div>
          <h1 className="text-2xl font-black text-white mb-1">Mining Boosters</h1>
          <p className="text-gray-400 text-sm">Supercharge your TON mining</p>
        </div>

        {/* Balance Card */}
        <div className="px-4 py-3">
          <div className="px-3 py-2 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a]">
            <p className="text-xs text-gray-400">Your TON Balance</p>
            <p className="text-lg font-bold text-[#4cd3ff]">
              {parseFloat(user?.tonBalance || "0").toFixed(4)} TON
            </p>
          </div>
        </div>

        {/* Crypto Conversion Widget */}
        <div className="px-4 py-3">
          <CryptoConversionWidget />
        </div>

        {/* Booster Grid */}
        <div className="px-4 grid grid-cols-2 gap-3 mb-4">
          {TON_BOOSTERS.map((booster) => (
            <BoosterCard 
              key={booster.id} 
              booster={booster}
              onPurchase={handleTonBoosterPurchase}
              isProcessing={isProcessing}
              isSelected={selectedBooster === booster.id}
            />
          ))}
        </div>

        {/* How It Works */}
        <div className="px-4">
          <div className="bg-[#111] rounded-2xl p-4 border border-white/5">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-[#4cd3ff]/20 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-[#4cd3ff]" />
              </div>
              <span className="text-white text-sm font-bold">How mining works</span>
            </div>
            <p className="text-gray-400 text-xs leading-relaxed">
              Purchase a booster, mining starts instantly. TON accumulates over the duration. Claim only after timer completes. No early claims allowed.
            </p>
          </div>
        </div>
      </main>
    </Layout>
  );
}
