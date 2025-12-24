import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import Layout from "@/components/Layout";
import { useToast } from "@/hooks/use-toast";
import { Dices, X } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";

interface GameResult {
  predictedValue: number;
  betType: "higher" | "lower";
  chipType: "PAD" | "BUG";
  playAmount: number;
  luckyNumber: number;
  won: boolean;
  reward: number;
  multiplier: number;
}

export default function Game() {
  const { toast } = useToast();
  
  const [sliderValue, setSliderValue] = useState(50);
  const [betType, setBetType] = useState<"higher" | "lower" | null>(null);
  const [chipType, setChipType] = useState<"PAD" | "BUG" | null>(null);
  const [playAmount, setPlayAmount] = useState("");
  const [isRevealing, setIsRevealing] = useState(false);
  const [luckyNumberDisplay, setLuckyNumberDisplay] = useState<number | null>(null);

  const { data: currentUser, refetch: refetchUser } = useQuery({
    queryKey: ["/api/auth/user"],
    retry: false,
  });

  const calculateMultiplier = (predicted: number, bet: "higher" | "lower" | null) => {
    if (!bet) return 1;
    if (bet === "higher") {
      return 1 + (100 - predicted) / 100;
    } else {
      return 1 + predicted / 100;
    }
  };

  const calculateWinChance = (predicted: number, bet: "higher" | "lower" | null) => {
    if (!bet) return 0;
    if (bet === "higher") {
      return (100 - predicted) / 100;
    } else {
      return predicted / 100;
    }
  };

  const multiplier = calculateMultiplier(sliderValue, betType);
  const winChance = calculateWinChance(sliderValue, betType);

  const playMutation = useMutation({
    mutationFn: async () => {
      if (!betType || !chipType || !playAmount) {
        throw new Error("Missing game parameters");
      }

      const amount = parseInt(playAmount);
      if (amount <= 0) {
        throw new Error("Invalid amount");
      }

      const res = await fetch("/api/games/lucky/play", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          predictedValue: sliderValue,
          betType,
          chipType,
          playAmount: amount,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to play game");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setIsRevealing(true);
      setLuckyNumberDisplay(data.luckyNumber);
      
      setTimeout(() => {
        setIsRevealing(false);
        
        if (data.won) {
          toast({
            description: `🎉 You Won! +${data.reward} ${data.chipType}`,
            variant: "default",
          });
        } else {
          toast({
            description: `❌ You Lost ${data.playAmount} ${data.chipType}`,
            variant: "destructive",
          });
        }
        
        // Reset game and refetch user
        setBetType(null);
        setChipType(null);
        setPlayAmount("");
        setSliderValue(50);
        setLuckyNumberDisplay(null);
        refetchUser();
      }, 2000);
    },
    onError: (error) => {
      toast({
        description: error instanceof Error ? error.message : "Failed to play game",
        variant: "destructive",
      });
    },
  });

  const canPlay =
    sliderValue !== undefined &&
    betType &&
    chipType &&
    playAmount &&
    !playMutation.isPending;

  const availableBalance = chipType === "PAD" 
    ? parseInt(currentUser?.balance || "0")
    : parseInt(currentUser?.bugBalance || "0");

  const amount = parseInt(playAmount) || 0;
  const isValidAmount = amount > 0 && amount <= availableBalance;


  return (
    <Layout>
      <div className="min-h-screen bg-black pt-4 pb-6 px-4">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Dices className="w-6 h-6 text-[#4cd3ff]" />
            <h1 className="text-2xl font-bold text-white">GAME</h1>
          </div>
          <p className="text-gray-400 text-sm">Control the slider to move the predicted value, then bet whether the lucky number will be higher or lower than the predicted value. A lucky number will be randomly generated from 0 to 99. If your prediction is correct, you win the reward.</p>
        </div>

        {/* Main Container */}
        <div className="max-w-md mx-auto">
          {/* Game Card */}
          <div className="bg-[#1a1a1a] rounded-2xl p-6 border border-[#2a2a2a] space-y-5">
            {/* Slider Section */}
            <div>
              {/* Marks */}
              <div className="flex justify-between text-white text-sm font-bold mb-3">
                {[0, 25, 50, 75, 100].map((mark) => (
                  <span key={mark}>{mark}</span>
                ))}
              </div>

              {/* Slider */}
              <div className="relative mb-4">
                <div className="h-8 bg-gradient-to-r from-[#00d4ff] via-[#6366f1] to-[#ec4899] rounded-full shadow-lg shadow-[#4cd3ff]/50"></div>
                
                {/* Lucky Number Indicator ON Slider */}
                {isRevealing && luckyNumberDisplay !== null && (
                  <div 
                    className="absolute top-1/2 -translate-y-1/2 flex flex-col items-center"
                    style={{
                      left: `calc(${luckyNumberDisplay}% - 18px)`,
                      zIndex: 10,
                    }}
                  >
                    <div className="text-white text-xs font-bold bg-[#4cd3ff] rounded-full w-9 h-9 flex items-center justify-center animate-pulse border-2 border-white">
                      {luckyNumberDisplay}
                    </div>
                  </div>
                )}
                
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={sliderValue}
                  onChange={(e) => setSliderValue(parseInt(e.target.value))}
                  className="absolute top-1/2 -translate-y-1/2 w-full h-8 rounded-full appearance-none bg-transparent cursor-pointer"
                  style={{
                    WebkitAppearance: "none",
                    background: "transparent",
                  }}
                />
                <style>{`
                  input[type="range"]::-webkit-slider-thumb {
                    appearance: none;
                    width: 36px;
                    height: 36px;
                    border-radius: 8px;
                    background: #4cd3ff;
                    cursor: pointer;
                    pointer-events: all;
                    box-shadow: 0 4px 12px rgba(76, 211, 255, 0.4);
                    border: 3px solid #0095cc;
                  }
                  input[type="range"]::-moz-range-thumb {
                    width: 36px;
                    height: 36px;
                    border-radius: 8px;
                    background: #4cd3ff;
                    cursor: pointer;
                    border: 3px solid #0095cc;
                    box-shadow: 0 4px 12px rgba(76, 211, 255, 0.4);
                  }
                `}</style>
              </div>

              {/* Value Display */}
              <div className="text-center">
                <span className="text-white text-sm font-semibold">Predicted Value: </span>
                <span className="text-[#4cd3ff] text-lg font-bold">{sliderValue}</span>
              </div>
            </div>

            {/* Bet Type Selection */}
            <div>
              <div className="text-white text-sm font-bold mb-2">Bet Type</div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setBetType("higher")}
                  className={`py-3 rounded-lg font-bold text-base transition-all ${
                    betType === "higher"
                      ? "bg-[#007BFF] text-white shadow-lg"
                      : "bg-[#1a1a1a] border border-[#333333] text-white hover:border-[#007BFF]"
                  }`}
                >
                  Higher
                </button>
                <button
                  onClick={() => setBetType("lower")}
                  className={`py-3 rounded-lg font-bold text-base transition-all ${
                    betType === "lower"
                      ? "bg-[#007BFF] text-white shadow-lg"
                      : "bg-[#1a1a1a] border border-[#333333] text-white hover:border-[#007BFF]"
                  }`}
                >
                  Lower
                </button>
              </div>
            </div>

            {/* Token Selection */}
            <div>
              <div className="text-white text-sm font-bold mb-2">Select Token</div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setChipType("PAD")}
                  className={`py-3 rounded-lg font-bold transition-all ${
                    chipType === "PAD"
                      ? "bg-[#007BFF] text-white shadow-lg"
                      : "bg-[#1a1a1a] border border-[#333333] text-white hover:border-[#007BFF]"
                  }`}
                >
                  PAD
                </button>
                <button
                  onClick={() => setChipType("BUG")}
                  className={`py-3 rounded-lg font-bold transition-all ${
                    chipType === "BUG"
                      ? "bg-[#007BFF] text-white shadow-lg"
                      : "bg-[#1a1a1a] border border-[#333333] text-white hover:border-[#007BFF]"
                  }`}
                >
                  BUG
                </button>
              </div>
            </div>

            {/* Play Amount */}
            <div>
              <label className="text-white text-sm font-bold mb-2 block">Play Amount</label>
              <div className="relative">
                <input
                  type="number"
                  value={playAmount}
                  onChange={(e) => setPlayAmount(e.target.value)}
                  placeholder="Enter amount"
                  className="w-full bg-[#0d0d0d] text-white rounded-lg px-4 py-3 pr-24 text-base border border-[#333333] focus:border-[#007BFF] focus:outline-none focus:ring-2 focus:ring-[#007BFF]/30"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                  <button
                    onClick={() => setPlayAmount(String(Math.max(1, Math.floor((parseInt(playAmount) || 0) / 2))))}
                    className="bg-[#333333] hover:bg-[#444444] text-white px-2 py-1 rounded text-xs font-semibold"
                  >
                    ½
                  </button>
                  <button
                    onClick={() => setPlayAmount(String((parseInt(playAmount) || 1) * 2))}
                    className="bg-[#333333] hover:bg-[#444444] text-white px-2 py-1 rounded text-xs font-semibold"
                  >
                    2×
                  </button>
                </div>
              </div>
              {playAmount && !isValidAmount && (
                <div className="text-red-500 text-xs mt-1 font-semibold">
                  Insufficient balance
                </div>
              )}
            </div>

            {/* Play Button */}
            <button
              onClick={() => playMutation.mutate()}
              disabled={!canPlay || !isValidAmount}
              className="w-full bg-[#007BFF] hover:bg-[#0056b3] text-white font-bold py-3 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
            >
              {playMutation.isPending ? "Playing..." : "Play"}
            </button>

            {/* Potential Payout */}
            {playAmount && isValidAmount && betType && (
              <div>
                <div className="text-gray-400 text-xs mb-1">Potential Payout</div>
                <div className="text-white font-bold text-2xl">
                  {(amount * multiplier).toFixed(0)}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

    </Layout>
  );
}
