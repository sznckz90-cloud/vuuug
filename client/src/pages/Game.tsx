import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import Layout from "@/components/Layout";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DiamondIcon } from "@/components/DiamondIcon";
import { Bug, Info, ArrowUp, ArrowDown } from "lucide-react";

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
  const [sliderValue, setSliderValue] = useState(50);
  const [betType, setBetType] = useState<"higher" | "lower" | null>(null);
  const [chipType, setChipType] = useState<"PAD" | "BUG" | null>("PAD");
  const [playAmount, setPlayAmount] = useState("20");
  const [isRevealing, setIsRevealing] = useState(false);
  const [luckyNumberDisplay, setLuckyNumberDisplay] = useState<number | null>(null);
  const [showInfo, setShowInfo] = useState(false);

  // Calculate roll over (chance of winning)
  const rollOverChance = betType === "higher" 
    ? 100 - sliderValue 
    : sliderValue;
  
  const winChance = rollOverChance;

  const { data: currentUser, refetch: refetchUser } = useQuery({
    queryKey: ["/api/auth/user"],
    retry: false,
  });

  const calculateMultiplier = (predicted: number, bet: "higher" | "lower" | null) => {
    if (!bet) return 1;
    
    let winProbability = 0;
    
    if (bet === "higher") {
      // Win if luckyNumber > predictedValue
      // Lucky range is 0-99 (100 possible values)
      // Winning numbers: (predictedValue+1) to 99 = (99 - predictedValue) numbers
      // Probability = (99 - predictedValue) / 100
      winProbability = (99 - predicted) / 100;
    } else {
      // Win if luckyNumber < predictedValue
      // Lucky range is 0-99
      // Winning numbers: 0 to (predictedValue-1) = predictedValue numbers
      // Probability = predictedValue / 100
      winProbability = predicted / 100;
    }
    
    // Pure multiplier formula: 1 / Win Chance
    // No house edge applied here - dynamic based on win probability only
    if (winProbability <= 0) {
      return 99; // Impossible to win
    }
    
    return Math.max(1.01, 1 / winProbability);
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
      // Scale lucky number from 0-99 to 0-100 range for slider positioning
      const scaledLuckyNumber = Math.round((data.luckyNumber / 99) * 100);
      setLuckyNumberDisplay(scaledLuckyNumber);
      
      setTimeout(() => {
        setIsRevealing(false);
        
        // Use app's default reward notification system for both wins and losses
        if (data.won) {
          window.dispatchEvent(new CustomEvent('showReward', { detail: { amount: data.reward } }));
        } else {
          window.dispatchEvent(new CustomEvent('showReward', { detail: { amount: -data.playAmount } }));
        }
        
        // Reset game and refetchUser
        setBetType(null);
        setChipType("PAD");
        setPlayAmount("20");
        setSliderValue(50);
        setLuckyNumberDisplay(null);
        refetchUser();
      }, 3000);
    },
    onError: (error) => {
      console.error("Game error:", error instanceof Error ? error.message : "Failed to play game");
    },
  });

  // Format multiplier: remove trailing .00 but keep decimals for fractional values
  const formatMultiplier = (num: number): string => {
    const formatted = num.toFixed(4);
    return parseFloat(formatted).toString();
  };

  // Check for invalid bet cases (100% guaranteed wins - prevent reward farming)
  const isInvalidCase = 
    (betType === "higher" && sliderValue >= 99) || 
    (betType === "lower" && sliderValue <= 0);

  const canPlay =
    sliderValue !== undefined &&
    betType &&
    chipType &&
    playAmount &&
    !playMutation.isPending &&
    !isInvalidCase;

  const availableBalance = chipType === "PAD" 
    ? parseInt((currentUser as any)?.balance || "0")
    : parseInt((currentUser as any)?.bugBalance || "0");

  const amount = parseInt(playAmount) || 0;
  const isValidAmount = amount > 0 && amount <= availableBalance;

  return (
    <Layout>
      <div className="bg-black pt-6 px-4">
        <div className="max-w-md mx-auto">
            <div className="bg-[#1a1a1a] rounded-2xl p-6 border border-[#2a2a2a] space-y-5 shadow-xl">
              <div>
                <div className="flex justify-between text-white text-sm font-bold mb-3">
                  {[0, 25, 50, 75, 100].map((mark) => (
                    <span key={mark}>{mark}</span>
                  ))}
                </div>

                <div className="relative mb-6">
                  {/* Simple Stick Style Slider Track with Red (left) and Gray (right) */}
                  <div className="h-3 rounded-sm overflow-hidden flex bg-gray-500">
                    <div 
                      className="bg-red-500 transition-all duration-200"
                      style={{ width: `${sliderValue}%` }}
                    ></div>
                  </div>
                  
                  {/* Predicted Number Indicator - Clearly Visible */}
                  {!isRevealing && (
                    <div 
                      className="absolute top-[-55px] transition-all duration-200 ease-out flex flex-col items-center pointer-events-none"
                      style={{
                        left: `calc(${sliderValue}% - 20px)`,
                        zIndex: 25,
                      }}
                    >
                      <div className="bg-blue-500 text-white text-base font-bold px-3 py-2 rounded shadow-lg min-w-[44px] text-center">
                        {sliderValue}
                      </div>
                      <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-blue-500"></div>
                    </div>
                  )}

                  {/* Lucky Number Animation - Moves and Stops */}
                  {isRevealing && luckyNumberDisplay !== null && (
                    <div 
                      className="absolute top-[-55px] flex flex-col items-center pointer-events-none"
                      style={{
                        left: `calc(${luckyNumberDisplay}% - 20px)`,
                        zIndex: 30,
                        animation: `slideToNumber 1.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards`,
                      }}
                    >
                      <div className="bg-yellow-400 text-black text-lg font-bold px-4 py-2 rounded shadow-lg shadow-yellow-400/50 border-2 border-yellow-300 min-w-[52px] text-center">
                        {luckyNumberDisplay}
                      </div>
                      <div className="w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[10px] border-t-yellow-400"></div>
                    </div>
                  )}
                  
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={sliderValue}
                    onChange={(e) => setSliderValue(parseInt(e.target.value))}
                    className="absolute top-1/2 -translate-y-1/2 w-full h-6 appearance-none bg-transparent cursor-pointer"
                    style={{
                      WebkitAppearance: "none",
                      background: "transparent",
                    }}
                  />
                  <style>{`
                    @keyframes slideToNumber {
                      from {
                        opacity: 0;
                        transform: scale(0.8);
                      }
                      to {
                        opacity: 1;
                        transform: scale(1);
                      }
                    }
                    input[type="range"]::-webkit-slider-thumb {
                      appearance: none;
                      width: 18px;
                      height: 24px;
                      background: linear-gradient(180deg, #2563eb 0%, #1e40af 100%);
                      cursor: pointer;
                      pointer-events: all;
                      border: 2px solid #60a5fa;
                      border-radius: 3px;
                      box-shadow: 0 0 10px rgba(37, 99, 235, 0.7);
                      z-index: 20;
                      position: relative;
                    }
                    input[type="range"]::-webkit-slider-runnable-track {
                      background: transparent;
                      height: 12px;
                      border: none;
                    }
                    input[type="range"]::-moz-range-thumb {
                      width: 18px;
                      height: 24px;
                      background: linear-gradient(180deg, #2563eb 0%, #1e40af 100%);
                      cursor: pointer;
                      border: 2px solid #60a5fa;
                      border-radius: 3px;
                      box-shadow: 0 0 10px rgba(37, 99, 235, 0.7);
                      z-index: 20;
                      position: relative;
                    }
                    input[type="range"]::-moz-range-track {
                      background: transparent;
                      border: none;
                    }
                    input[type="range"]::-moz-range-progress {
                      background: transparent;
                      height: 12px;
                    }
                  `}</style>
                </div>
              </div>

              <div>
                <div className="text-white text-sm font-bold mb-2">Bet Type</div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setBetType("higher")}
                    className={`flex items-center justify-center gap-2 py-3 rounded-lg font-bold text-base transition-all ${
                      betType === "higher"
                        ? "bg-[#007BFF] text-white shadow-lg"
                        : "bg-[#1a1a1a] border border-[#333333] text-white hover:border-[#007BFF]"
                    }`}
                  >
                    <ArrowUp className="w-5 h-5" />
                    <span>Higher</span>
                  </button>
                  <button
                    onClick={() => setBetType("lower")}
                    className={`flex items-center justify-center gap-2 py-3 rounded-lg font-bold text-base transition-all ${
                      betType === "lower"
                        ? "bg-[#007BFF] text-white shadow-lg"
                        : "bg-[#1a1a1a] border border-[#333333] text-white hover:border-[#007BFF]"
                    }`}
                  >
                    <ArrowDown className="w-5 h-5" />
                    <span>Lower</span>
                  </button>
                </div>
              </div>

              {/* Stats Section */}
              <div className="grid grid-cols-3 gap-3 bg-[#0d0d0d] p-4 rounded-lg border border-[#2a2a2a] w-full">
                <div className="text-center min-w-0">
                  <div className="text-white text-xs sm:text-sm font-bold truncate">Multiplier</div>
                  <div className="text-white text-sm sm:text-base font-bold truncate">{formatMultiplier(multiplier)} X</div>
                </div>
                <div className="text-center min-w-0">
                  <div className="text-white text-xs sm:text-sm font-bold truncate">Roll Over</div>
                  <div className="text-white text-sm sm:text-base font-bold truncate">{sliderValue.toFixed(2)}</div>
                </div>
                <div className="text-center min-w-0">
                  <div className="text-white text-xs sm:text-sm font-bold truncate">Win Chance</div>
                  <div className="text-white text-sm sm:text-base font-bold truncate">{winChance.toFixed(4)} %</div>
                </div>
              </div>

              <div>
                <label className="text-white text-sm font-bold mb-2 block">Play Amount</label>
                <div className="flex gap-2 w-full min-w-0">
                  {/* Amount Input with Token Selector */}
                  <div className="relative flex-1 min-w-0">
                    <input
                      type="number"
                      value={playAmount}
                      onChange={(e) => setPlayAmount(e.target.value)}
                      placeholder="20"
                      className="w-full bg-[#0d0d0d] text-white rounded-lg px-3 py-2 pr-20 text-sm border border-[#333333] focus:border-[#007BFF] focus:outline-none focus:ring-2 focus:ring-[#007BFF]/30"
                    />
                    {/* Token Selector Buttons Inside Input */}
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-0.5 items-center">
                      <button
                        onClick={() => setChipType("PAD")}
                        className={`flex items-center justify-center p-1 rounded transition-all ${
                          chipType === "PAD"
                            ? "bg-[#007BFF] text-white"
                            : "bg-[#1a1a1a] text-gray-400 hover:bg-[#2a2a2a]"
                        }`}
                        title="PAD"
                      >
                        <DiamondIcon size={13} withGlow={chipType === "PAD"} />
                      </button>
                      <button
                        onClick={() => setChipType("BUG")}
                        className={`flex items-center justify-center p-1 rounded transition-all ${
                          chipType === "BUG"
                            ? "bg-[#007BFF] text-white"
                            : "bg-[#1a1a1a] text-green-400 hover:bg-[#2a2a2a]"
                        }`}
                        title="BUG"
                      >
                        <Bug className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  
                  {/* Multiplier Buttons */}
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => setPlayAmount(String(Math.max(20, Math.floor((parseInt(playAmount) || 20) / 2))))}
                      className="bg-[#1a1a1a] border border-[#333333] hover:border-[#007BFF] text-white px-3 py-2 rounded text-sm font-semibold transition-all"
                    >
                      ½
                    </button>
                    <button
                      onClick={() => setPlayAmount(String((parseInt(playAmount) || 20) * 2))}
                      className="bg-[#1a1a1a] border border-[#333333] hover:border-[#007BFF] text-white px-3 py-2 rounded text-sm font-semibold transition-all"
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
                {isInvalidCase && (
                  <div className="text-red-500 text-xs mt-1 font-semibold">
                    {betType === "higher" ? "Prediction too high - guaranteed win not allowed" : "Prediction too low - guaranteed win not allowed"}
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

              <div>
                <div className="text-gray-400 text-xs font-bold mb-1">Potential Payout</div>
                <div className="bg-[#0d0d0d] p-2 rounded-lg border border-[#2a2a2a] flex items-center justify-between gap-3">
                  <div className="text-white font-bold text-2xl">
                    {betType && amount > 0 ? Math.floor(amount * multiplier).toString() : "0"}
                  </div>
                  <div>
                    {chipType === "PAD" ? (
                      <DiamondIcon size={24} withGlow={true} />
                    ) : (
                      <Bug className="w-6 h-6 text-green-400" />
                    )}
                  </div>
                </div>
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
