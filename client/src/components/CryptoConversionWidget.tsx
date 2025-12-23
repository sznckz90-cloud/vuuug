import { useEffect, useState } from "react";
import { getTONPrice, calculateConversions } from "@/lib/tonPriceService";
import { TrendingUp, RefreshCw } from "lucide-react";

export default function CryptoConversionWidget() {
  const [tonPrice, setTonPrice] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    const fetchPrice = async () => {
      setIsLoading(true);
      const price = await getTONPrice();
      setTonPrice(price);
      setLastUpdate(new Date());
      setIsLoading(false);
    };

    fetchPrice();
    
    // Refresh price every 60 seconds
    const interval = setInterval(fetchPrice, 60000);
    return () => clearInterval(interval);
  }, []);

  if (!tonPrice || isLoading) {
    return (
      <div className="bg-[#111] rounded-2xl p-4 border border-white/5 mb-4 animate-pulse">
        <div className="h-4 bg-gray-700 rounded w-1/3 mb-4"></div>
        <div className="space-y-2">
          <div className="h-3 bg-gray-700 rounded w-2/3"></div>
          <div className="h-3 bg-gray-700 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  const conversions = calculateConversions(tonPrice);

  return (
    <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0f0f0f] rounded-2xl p-4 border border-white/5 mb-4 shadow-lg">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
          <TrendingUp className="w-4 h-4 text-blue-400" />
        </div>
        <span className="text-white text-sm font-bold">Live TON Rate</span>
      </div>

      {/* Current TON Price */}
      <div className="bg-white/5 rounded-xl p-3 mb-4">
        <div className="text-gray-400 text-xs mb-1">1 TON in USD</div>
        <div className="text-2xl font-black text-white">
          ${conversions.tonPriceUSD}
        </div>
      </div>

      {/* Conversions */}
      <div className="space-y-2 mb-4">
        <div className="flex justify-between items-center p-2 bg-white/5 rounded-lg">
          <span className="text-xs text-gray-400">10,000 PAD</span>
          <span className="text-sm font-bold text-[#ADFF2F]">= $1</span>
        </div>
        
        <div className="flex justify-between items-center p-2 bg-white/5 rounded-lg">
          <span className="text-xs text-gray-400">$1</span>
          <span className="text-sm font-bold text-blue-400">
            ≈ {conversions.tonPerDollar} TON
          </span>
        </div>
        
        <div className="flex justify-between items-center p-2 bg-white/5 rounded-lg">
          <span className="text-xs text-gray-400">1 TON</span>
          <span className="text-sm font-bold text-emerald-400">
            ≈ {conversions.padPerTon.toLocaleString()} PAD
          </span>
        </div>
      </div>

      {/* Update info */}
      <div className="flex items-center justify-between text-[10px] text-gray-500 px-2">
        <span>
          <RefreshCw className="w-3 h-3 inline mr-1" />
          Rates update automatically every 60 seconds
        </span>
        {lastUpdate && (
          <span>Updated: {lastUpdate.toLocaleTimeString()}</span>
        )}
      </div>
    </div>
  );
}
