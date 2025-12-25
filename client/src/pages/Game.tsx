import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Layout from "@/components/Layout";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DiamondIcon } from "@/components/DiamondIcon";
import { Bug, Info, ArrowUp, ArrowDown, Dices, Receipt, Clock, CheckCircle, XCircle } from "lucide-react";
import { showNotification } from "@/components/AppNotification";
import { format } from "date-fns";

interface GameResult {
  id: string;
  predictedValue: number;
  betType: "higher" | "lower";
  chipType: "PAD" | "BUG";
  playAmount: number;
  luckyNumber: number;
  won: boolean;
  reward: number;
  multiplier: number;
  createdAt: string;
}

export default function Game() {
  const queryClient = useQueryClient();
  const [sliderValue, setSliderValue] = useState(50);
  const [betType, setBetType] = useState<"higher" | "lower" | null>(null);
  const [chipType, setChipType] = useState<"PAD" | "BUG" | null>("PAD");
  const [playAmount, setPlayAmount] = useState("20");
  const [isRevealing, setIsRevealing] = useState(false);
  const [luckyNumberDisplay, setLuckyNumberDisplay] = useState<number | null>(null);
  const [showInfo, setShowInfo] = useState(false);

  // Calculate roll over (chance of winning) - clamped between 2% and 98%
  const rollOverChance = betType === "higher" 
    ? 100 - sliderValue 
    : sliderValue;
  
  const winChance = Math.max(2, Math.min(98, rollOverChance));

  const { data: currentUser, refetch: refetchUser } = useQuery({
    queryKey: ["/api/auth/user"],
    retry: false,
  });

  const { data: gameHistory } = useQuery<GameResult[]>({
    queryKey: ["/api/games/lucky/history"],
    retry: false,
  });

  const calculateMultiplier = (predicted: number, bet: "higher" | "lower" | null) => {
    if (!bet) return 1;
    
    // Multiplier calculation must be between 2 and 98
    // Clamping predicted value to ensure it's never 1 or 100
    const clampedPredicted = Math.max(2, Math.min(98, predicted));
    
    let winChance = 0;
    if (bet === "higher") {
      // Predicted: 2 -> Win Chance: (99-2)/100 = 0.97 (Min Multiplier)
      // Predicted: 98 -> Win Chance: (99-98)/100 = 0.01 (Max Multiplier)
      winChance = (99 - clampedPredicted) / 100;
    } else {
      // Predicted: 98 -> Win Chance: 98/100 = 0.98 (Min Multiplier)
      // Predicted: 2 -> Win Chance: 2/100 = 0.02 (Max Multiplier)
      winChance = clampedPredicted / 100;
    }
    
    // Multiplier calculation strictly between 2 and 98
    winChance = Math.max(0.01, Math.min(0.98, winChance));
    
    if (bet === "higher") {
      if (clampedPredicted <= 2) return 0.9693;
      if (clampedPredicted >= 98) return 45.75;
      
      // Interpolate for Higher
      // Chance at 2: 0.97, Multiplier: 0.9693
      // Chance at 98: 0.01, Multiplier: 45.75
      const slope = (45.75 - 0.9693) / (0.01 - 0.97);
      return slope * (winChance - 0.97) + 0.9693;
    } else {
      if (clampedPredicted >= 98) return 0.9693;
      if (clampedPredicted <= 2) return 47.5;
      
      // Interpolate for Lower
      // Chance at 98: 0.98, Multiplier: 0.9693
      // Chance at 2: 0.02, Multiplier: 47.5
      const slope = (47.5 - 0.9693) / (0.02 - 0.98);
      return slope * (winChance - 0.98) + 0.9693;
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

      // Ensure predicted value is strictly within 2-98 range before sending to API
      const finalPredictedValue = Math.max(2, Math.min(98, sliderValue));

      const res = await fetch("/api/games/lucky/play", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          predictedValue: finalPredictedValue,
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
        
        // Show notification in same format as ad watch notifications (always success)
        const tokenName = chipType === "PAD" ? "PAD" : "BUG";
        if (data.won) {
          showNotification(`+${data.reward} ${tokenName} earned!`, "success");
        } else {
          showNotification(`-${data.playAmount} ${tokenName} lost!`, "success");
        }
        
        // Only reset temporary UI state, keep game selection as requested by user
        setLuckyNumberDisplay(null);
        refetchUser();
        queryClient.invalidateQueries({ queryKey: ["/api/games/lucky/history"] });
      }, 3000);
    },
    onError: (error) => {
      console.error("Game error:", error instanceof Error ? error.message : "Failed to play game");
    },
  });

  // Format multiplier: remove trailing zeros and decimal point if not needed
  const formatMultiplier = (num: number): string => {
    const formatted = num.toFixed(4);
    return formatted.replace(/\.?0+$/, '');
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
      <main className="max-w-md mx-auto px-4 pt-3 pb-16">
        <div className="flex items-center gap-2 mb-4">
          <Dices className="w-5 h-5 text-[#4cd3ff]" />
          <h1 className="text-lg font-bold text-white">Dice</h1>
        </div>

        <div className="bg-[#111] rounded-2xl p-6 border border-white/5 space-y-4 shadow-xl">
          <div>
            <div className="flex justify-between text-white text-sm font-bold mb-2">
                {[0, 25, 50, 75, 100].map((mark) => (
                  <span key={mark}>{mark}</span>
                ))}
              </div>
                
                {/* Roll Over / Roll Under Label */}
                <div className="text-center text-gray-400 text-xs font-semibold mb-2">
                  {betType === "higher" ? "Roll Over" : betType === "lower" ? "Roll Under" : "Select Bet Type"}
                </div>

                <div className="relative mb-5">
                  {/* Dynamic Two-Color Slider Track */}
                  <div className="h-3 rounded-sm overflow-hidden flex bg-transparent border border-gray-600">
                    {/* Left side color */}
                    <div 
                      className={`transition-all duration-200 ${
                        betType === "higher" ? "bg-red-500" : betType === "lower" ? "bg-blue-500" : "bg-gray-500"
                      }`}
                      style={{ width: `${sliderValue}%` }}
                    ></div>
                    {/* Right side color */}
                    <div 
                      className={`transition-all duration-200 flex-1 ${
                        betType === "higher" ? "bg-blue-500" : betType === "lower" ? "bg-red-500" : "bg-gray-500"
                      }`}
                    ></div>
                  </div>
                  
                  {/* Predicted Number Indicator - Clearly Visible */}
                  {!isRevealing && (
                    <div 
                      className="absolute top-[-50px] transition-all duration-200 ease-out flex flex-col items-center pointer-events-none"
                      style={{
                        left: `calc(${sliderValue}% - 20px)`,
                        zIndex: 25,
                      }}
                    >
                      <div className="bg-blue-500 text-white text-sm font-bold px-2.5 py-1.5 rounded shadow-lg min-w-[40px] text-center">
                        {sliderValue}
                      </div>
                      <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[7px] border-t-blue-500"></div>
                    </div>
                  )}

                  {/* Lucky Number Animation - Moves and Stops */}
                  {isRevealing && luckyNumberDisplay !== null && (
                    <div 
                      className="absolute top-[-50px] flex flex-col items-center pointer-events-none"
                      style={{
                        left: `calc(${luckyNumberDisplay}% - 20px)`,
                        zIndex: 30,
                        animation: `slideToNumber 1.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards`,
                      }}
                    >
                      <div className="bg-yellow-400 text-black text-base font-bold px-3 py-1.5 rounded shadow-lg shadow-yellow-400/50 border-2 border-yellow-300 min-w-[48px] text-center">
                        {luckyNumberDisplay}
                      </div>
                      <div className="w-0 h-0 border-l-[7px] border-l-transparent border-r-[7px] border-r-transparent border-t-[9px] border-t-yellow-400"></div>
                    </div>
                  )}
                  
                  <input
                    type="range"
                    min="2"
                    max="98"
                    value={sliderValue}
                    onChange={(e) => {
                      setSliderValue(parseInt(e.target.value));
                    }}
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

              <div className="space-y-3">
                <div>
                  <div className="text-white text-xs font-bold mb-2">Bet Type</div>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setBetType("higher")}
                      className={`flex items-center justify-center gap-2 py-2.5 rounded-lg font-bold text-sm transition-all ${
                        betType === "higher"
                          ? "bg-[#007BFF] text-white shadow-lg"
                          : "bg-[#1a1a1a] border border-[#333333] text-white hover:border-[#007BFF]"
                      }`}
                    >
                      <ArrowUp className="w-4 h-4" />
                      <span>Higher</span>
                    </button>
                    <button
                      onClick={() => setBetType("lower")}
                      className={`flex items-center justify-center gap-2 py-2.5 rounded-lg font-bold text-sm transition-all ${
                        betType === "lower"
                          ? "bg-[#007BFF] text-white shadow-lg"
                          : "bg-[#1a1a1a] border border-[#333333] text-white hover:border-[#007BFF]"
                      }`}
                    >
                      <ArrowDown className="w-4 h-4" />
                      <span>Lower</span>
                    </button>
                  </div>
                </div>

                {/* Stats Section */}
                <div className="grid grid-cols-3 gap-2 bg-[#0d0d0d] p-3 rounded-lg border border-[#2a2a2a] w-full">
                  <div className="text-center min-w-0">
                    <div className="text-gray-400 text-[10px] sm:text-xs font-bold truncate uppercase tracking-wider">Multiplier</div>
                    <div className="text-white text-sm sm:text-base font-bold truncate">{formatMultiplier(multiplier)} X</div>
                  </div>
                  <div className="text-center min-w-0">
                    <div className="text-gray-400 text-[10px] sm:text-xs font-bold truncate uppercase tracking-wider">{betType === "higher" ? "Roll Over" : betType === "lower" ? "Roll Under" : "Roll Over"}</div>
                    <div className="text-white text-sm sm:text-base font-bold truncate">{sliderValue.toFixed(2).replace(/\.?0+$/, '')}</div>
                  </div>
                  <div className="text-center min-w-0">
                    <div className="text-gray-400 text-[10px] sm:text-xs font-bold truncate uppercase tracking-wider">Win Chance</div>
                    <div className="text-white text-sm sm:text-base font-bold truncate">{winChance.toFixed(2).replace(/\.?0+$/, '')} %</div>
                  </div>
                </div>

                <div>
                  <label className="text-white text-xs font-bold mb-1.5 block">Play Amount</label>
                  <div className="flex gap-2 w-full min-w-0">
                    {/* Amount Input */}
                    <div className="relative flex-1 min-w-0">
                      <input
                        type="number"
                        value={playAmount}
                        onChange={(e) => setPlayAmount(e.target.value)}
                        className="w-full bg-[#0d0d0d] text-white rounded-lg px-3 py-2 pr-12 text-sm border border-[#333333] focus:border-[#007BFF] focus:outline-none focus:ring-2 focus:ring-[#007BFF]/30"
                      />
                      {/* Token Icon */}
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center pointer-events-none">
                        {chipType === "PAD" ? (
                          <DiamondIcon size={16} withGlow={true} />
                        ) : (
                          <Bug className="w-4 h-4 text-green-400" />
                        )}
                      </div>
                    </div>
                    
                    {/* Token Selector Buttons */}
                    <div className="flex gap-1.5 shrink-0">
                      <button
                        onClick={() => setChipType("PAD")}
                        className={`flex items-center justify-center p-2 rounded transition-all ${
                          chipType === "PAD"
                            ? "bg-[#007BFF] text-white"
                            : "bg-[#1a1a1a] text-gray-400 border border-[#333333] hover:bg-[#2a2a2a]"
                        }`}
                        title="PAD"
                      >
                        <DiamondIcon size={14} withGlow={chipType === "PAD"} />
                      </button>
                      <button
                        onClick={() => setChipType("BUG")}
                        className={`flex items-center justify-center p-2 rounded transition-all ${
                          chipType === "BUG"
                            ? "bg-[#007BFF] text-white"
                            : "bg-[#1a1a1a] text-green-400 border border-[#333333] hover:bg-[#2a2a2a]"
                        }`}
                        title="BUG"
                      >
                        <Bug className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  {isInvalidCase && (
                    <div className="text-red-500 text-[10px] mt-1 font-semibold">
                      {betType === "higher" ? "Prediction too high - guaranteed win not allowed" : "Prediction too low - guaranteed win not allowed"}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => playMutation.mutate()}
                  disabled={!canPlay || !isValidAmount}
                  className="w-full bg-[#007BFF] hover:bg-[#0056b3] text-white font-bold py-2.5 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg text-sm"
                >
                  {playMutation.isPending ? "Playing..." : !isValidAmount && playAmount ? "Insufficient Balance" : "Play"}
                </button>

                <div className="mt-0">
                  <div className="text-gray-400 text-[10px] font-bold mb-1 uppercase tracking-wider">Potential Payout</div>
                  <div className="bg-[#0d0d0d] px-3 py-2 rounded-lg border border-[#333333] flex items-center justify-between gap-3 h-[38px]">
                    <div className="text-white font-bold text-sm">
                      {betType && amount > 0 && !isInvalidCase ? (amount * multiplier).toFixed(2).replace(/\.?0+$/, "") : "0"}
                    </div>
                    <div className="flex items-center">
                      {chipType === "PAD" ? (
                        <DiamondIcon size={16} withGlow={true} />
                      ) : (
                        <Bug className="w-4 h-4 text-green-400" />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* History Section */}
            <div className="mt-6 space-y-3">
              <div className="flex items-center gap-2 px-1">
                <Receipt className="w-4 h-4 text-[#4cd3ff]" />
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">Game History</h2>
              </div>

              <div className="space-y-2">
                {gameHistory && gameHistory.length > 0 ? (
                  gameHistory.map((game) => (
                    <div 
                      key={game.id} 
                      className="bg-[#111] rounded-xl p-3 border border-white/5 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                          game.won ? 'bg-green-500/10' : 'bg-red-500/10'
                        }`}>
                          {game.won ? (
                            <CheckCircle className="w-5 h-5 text-green-500" />
                          ) : (
                            <XCircle className="w-5 h-5 text-red-500" />
                          )}
                        </div>
                        <div>
                          <p className="text-white text-sm font-medium">
                            {game.won ? 'Won' : 'Lost'} {game.playAmount} {game.chipType}
                          </p>
                          <div className="flex items-center gap-2 text-[10px] text-gray-500">
                            <Clock className="w-3 h-3" />
                            {format(new Date(game.createdAt), "MMM d, HH:mm")}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-bold ${game.won ? 'text-green-500' : 'text-red-500'}`}>
                          {game.won ? `+${game.reward}` : `-${game.playAmount}`}
                        </p>
                        <p className="text-[10px] text-gray-500">
                          {game.betType === 'higher' ? 'Over' : 'Under'} {game.predictedValue} (Roll: {game.luckyNumber})
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="bg-[#111] rounded-xl p-8 border border-white/5 text-center">
                    <Clock className="w-8 h-8 text-gray-600 mx-auto mb-2 opacity-20" />
                    <p className="text-gray-500 text-xs">No game history yet</p>
                  </div>
                )}
              </div>
            </div>
      </main>
    </Layout>
  );
}
