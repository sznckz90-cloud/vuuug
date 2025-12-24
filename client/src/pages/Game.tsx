import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import Layout from "@/components/Layout";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DiamondIcon } from "@/components/DiamondIcon";
import { Bug, Info } from "lucide-react";

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
  const [chipType, setChipType] = useState<"PAD" | "BUG" | null>("PAD");
  const [playAmount, setPlayAmount] = useState("20");
  const [isRevealing, setIsRevealing] = useState(false);
  const [luckyNumberDisplay, setLuckyNumberDisplay] = useState<number | null>(null);
  const [showInfo, setShowInfo] = useState(false);

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

  const multiplier = calculateMultiplier(sliderValue, betType);

  const playMutation = useMutation({
    mutationFn: async () => {
      if (!betType || !chipType || !playAmount) {
        throw new Error("Missing game parameters");
      }

      const amount = parseInt(playAmount);
      if (amount < 20) {
        throw new Error("Minimum play amount is 20");
      }
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
            title: "🎉 You Won!",
            description: `Congratulations! You won ${data.reward} ${data.chipType}`,
            variant: "default",
          });
        } else {
          toast({
            title: "❌ You Lost",
            description: `The lucky number was ${data.luckyNumber}. You lost ${data.playAmount} ${data.chipType}`,
            variant: "destructive",
          });
        }
        
        // Reset game and refetchUser
        setBetType(null);
        setChipType("PAD");
        setPlayAmount("20");
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
      <div className="flex flex-col bg-black overflow-hidden h-[calc(100vh-64px)]">
        <div className="flex-1 overflow-y-auto pt-4 pb-24 px-4 custom-scrollbar">
          <div className="max-w-md mx-auto">
            <div className="bg-[#1a1a1a] rounded-2xl p-6 border border-[#2a2a2a] space-y-5 shadow-xl">
              <div>
                <div className="flex justify-between text-white text-sm font-bold mb-3">
                  {[0, 25, 50, 75, 99].map((mark) => (
                    <span key={mark}>{mark}</span>
                  ))}
                </div>

                <div className="relative mb-4">
                  <div className="h-8 bg-[#333333] rounded-full shadow-lg"></div>
                  
                  {/* Predicted Number Indicator ON Slider */}
                  {!isRevealing && (
                    <div 
                      className="absolute top-[-45px] transition-all duration-200 ease-out flex flex-col items-center"
                      style={{
                        left: `calc(${sliderValue}% - 18px)`,
                        zIndex: 25,
                      }}
                    >
                      <div className="bg-[#333333] border border-[#444444] text-white text-sm font-bold px-3 py-1.5 rounded-lg shadow-lg">
                        {sliderValue}
                      </div>
                      <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-[#333333]"></div>
                    </div>
                  )}

                  {/* Lucky Number Indicator ON Slider */}
                  {isRevealing && luckyNumberDisplay !== null && (
                    <div 
                      className="absolute top-[-45px] transition-all duration-500 ease-out flex flex-col items-center"
                      style={{
                        left: `calc(${luckyNumberDisplay}% - 18px)`,
                        zIndex: 30,
                      }}
                    >
                      <div className="bg-[#4cd3ff] text-white text-sm font-bold px-3 py-1.5 rounded-lg shadow-lg shadow-[#4cd3ff]/30 animate-in fade-in zoom-in slide-in-from-bottom-2">
                        {luckyNumberDisplay}
                      </div>
                      <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-[#4cd3ff]"></div>
                    </div>
                  )}
                  
                  <input
                    type="range"
                    min="0"
                    max="99"
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
                      width: 4px;
                      height: 36px;
                      background: #ff0000;
                      cursor: pointer;
                      pointer-events: all;
                      box-shadow: 0 0 8px rgba(255, 0, 0, 0.5);
                      z-index: 20;
                      position: relative;
                    }
                    input[type="range"]::-moz-range-thumb {
                      width: 4px;
                      height: 36px;
                      background: #ff0000;
                      cursor: pointer;
                      border: none;
                      box-shadow: 0 0 8px rgba(255, 0, 0, 0.5);
                      z-index: 20;
                      position: relative;
                    }
                  `}</style>
                </div>
              </div>

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

              <div>
                <div className="text-white text-sm font-bold mb-3">Select Token</div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setChipType("PAD")}
                    className={`flex items-center justify-center gap-2 py-2.5 rounded-lg font-bold transition-all border ${
                      chipType === "PAD"
                        ? "bg-[#007BFF] border-[#007BFF] text-white shadow-lg"
                        : "bg-[#1a1a1a] border-[#333333] text-white hover:border-[#007BFF]"
                    }`}
                  >
                    <DiamondIcon size={16} withGlow={chipType === "PAD"} />
                    <span>PAD</span>
                  </button>
                  <button
                    onClick={() => setChipType("BUG")}
                    className={`flex items-center justify-center gap-2 py-2.5 rounded-lg font-bold transition-all border ${
                      chipType === "BUG"
                        ? "bg-[#007BFF] border-[#007BFF] text-white shadow-lg"
                        : "bg-[#1a1a1a] border-[#333333] text-white hover:border-[#007BFF]"
                    }`}
                  >
                    <Bug className={`w-4 h-4 ${chipType === "BUG" ? "text-white" : "text-green-400"}`} />
                    <span>BUG</span>
                  </button>
                </div>
              </div>

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

              <button
                onClick={() => playMutation.mutate()}
                disabled={!canPlay || !isValidAmount}
                className="w-full bg-[#007BFF] hover:bg-[#0056b3] text-white font-bold py-3 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
              >
                {playMutation.isPending ? "Playing..." : "Play"}
              </button>

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

        <button
          onClick={() => setShowInfo(true)}
          className="fixed bottom-24 right-6 bg-[#1a1a1a] p-2 rounded-full border border-[#333333] text-gray-400 hover:text-white transition-colors shadow-lg"
        >
          <Info className="w-5 h-5" />
        </button>

        <Dialog open={showInfo} onOpenChange={setShowInfo}>
          <DialogContent className="bg-black/95 border-gray-700 text-white max-w-[90%] sm:max-w-md rounded-[20px] p-6 [&>button]:hidden">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-center mb-2">Game Info</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 text-gray-300 text-sm leading-relaxed">
              <p>
                Control the slider to move the predicted value, then bet whether the lucky number will be higher or lower than the predicted value.
              </p>
              <p>
                A lucky number will be randomly generated from 0 to 99. If your prediction is correct, you win the reward.
              </p>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
