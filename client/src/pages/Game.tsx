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
  const [showResult, setShowResult] = useState(false);
  const [gameResult, setGameResult] = useState<GameResult | null>(null);
  const [isRevealing, setIsRevealing] = useState(false);

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
      
      setTimeout(() => {
        setGameResult({
          predictedValue: data.predictedValue,
          betType: data.betType,
          chipType: data.chipType,
          playAmount: data.playAmount,
          luckyNumber: data.luckyNumber,
          won: data.won,
          reward: data.reward,
          multiplier: data.multiplier,
        });
        setIsRevealing(false);
        setShowResult(true);
      }, 1500);
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

  const handleCloseResult = () => {
    setShowResult(false);
    setGameResult(null);
    setBetType(null);
    setChipType(null);
    setPlayAmount("");
    setSliderValue(50);
    refetchUser();
  };

  return (
    <Layout>
      <div className="min-h-screen bg-black pt-4 pb-6 px-4">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Dices className="w-6 h-6 text-[#4cd3ff]" />
            <h1 className="text-2xl font-bold text-white">GAME</h1>
          </div>
          <p className="text-gray-400 text-sm">Slider-Based Luck Game</p>
        </div>

        {/* Main Container */}
        <div className="max-w-md mx-auto">
          {/* Balance Badges */}
          <div className="flex gap-3 mb-8">
            <div className="flex-1 bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] border border-[#4cd3ff]/30 rounded-full px-4 py-3 text-center">
              <div className="text-xs text-[#4cd3ff] font-semibold">PAD</div>
              <div className="text-xl font-bold text-white">
                {Math.round(parseInt(currentUser?.balance || "0"))}
              </div>
            </div>
            <div className="flex-1 bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] border border-[#ADFF2F]/30 rounded-full px-4 py-3 text-center">
              <div className="text-xs text-[#ADFF2F] font-semibold">BUG</div>
              <div className="text-xl font-bold text-white">
                {Math.round(parseInt(currentUser?.bugBalance || "0"))}
              </div>
            </div>
          </div>

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
                <div className="h-8 bg-gradient-to-r from-red-600 via-gray-400 to-yellow-400 rounded-full shadow-lg"></div>
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

            {/* Info Cards */}
            {betType && (
              <div className="grid grid-cols-3 gap-3 bg-[#0a0a0a] rounded-lg p-3">
                <div className="text-center">
                  <div className="text-white text-xs font-semibold mb-1">Multiplier</div>
                  <div className="text-[#4cd3ff] font-bold text-lg">
                    {multiplier.toFixed(2)} X
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-white text-xs font-semibold mb-1">Roll Over</div>
                  <div className="text-[#ADFF2F] font-bold text-lg">
                    {Math.ceil(winChance * availableBalance)}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-white text-xs font-semibold mb-1">Win %</div>
                  <div className="text-[#4cd3ff] font-bold text-lg">
                    {(winChance * 100).toFixed(1)}%
                  </div>
                </div>
              </div>
            )}

            {/* Bet Type Selection */}
            <div>
              <div className="text-white text-sm font-bold mb-2">Bet Type</div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setBetType("higher")}
                  className={`py-3 rounded-lg font-bold text-base transition-all ${
                    betType === "higher"
                      ? "bg-gradient-to-br from-[#4cd3ff] to-[#00a0d2] text-black shadow-lg shadow-[#4cd3ff]/50"
                      : "bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] border border-[#4cd3ff]/30 text-white hover:border-[#4cd3ff] hover:bg-[#4cd3ff]/10"
                  }`}
                >
                  Higher
                </button>
                <button
                  onClick={() => setBetType("lower")}
                  className={`py-3 rounded-lg font-bold text-base transition-all ${
                    betType === "lower"
                      ? "bg-gradient-to-br from-[#4cd3ff] to-[#00a0d2] text-black shadow-lg shadow-[#4cd3ff]/50"
                      : "bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] border border-[#4cd3ff]/30 text-white hover:border-[#4cd3ff] hover:bg-[#4cd3ff]/10"
                  }`}
                >
                  Lower
                </button>
              </div>
            </div>

            {/* Chip Selection */}
            <div>
              <div className="text-white text-sm font-bold mb-2">Select Chip</div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setChipType("PAD")}
                  className={`py-3 rounded-lg font-bold transition-all flex items-center justify-center gap-2 ${
                    chipType === "PAD"
                      ? "bg-gradient-to-br from-[#4cd3ff] to-[#00a0d2] text-black ring-2 ring-[#4cd3ff]"
                      : "bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] border border-[#4cd3ff]/30 text-white hover:border-[#4cd3ff] hover:bg-[#4cd3ff]/10"
                  }`}
                >
                  <div className="w-5 h-5 bg-gradient-to-br from-[#b8b8b8] to-[#666666] rounded-full"></div>
                  PAD
                </button>
                <button
                  onClick={() => setChipType("BUG")}
                  className={`py-3 rounded-lg font-bold transition-all flex items-center justify-center gap-2 ${
                    chipType === "BUG"
                      ? "bg-gradient-to-br from-[#ADFF2F] to-[#7FFF00] text-black ring-2 ring-[#ADFF2F]"
                      : "bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] border border-[#ADFF2F]/30 text-white hover:border-[#ADFF2F] hover:bg-[#ADFF2F]/10"
                  }`}
                >
                  <div className="w-5 h-5 bg-gradient-to-br from-[#ADFF2F] to-[#7FFF00] rounded-full"></div>
                  BUG
                </button>
              </div>
            </div>

            {/* Play Amount */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-white text-sm font-bold">Play Amount</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPlayAmount(String(Math.floor(availableBalance * 0.5)))}
                    className="text-[#4cd3ff] text-xs hover:underline font-semibold"
                  >
                    1/2
                  </button>
                  <button
                    onClick={() => setPlayAmount(String(availableBalance))}
                    className="text-[#4cd3ff] text-xs hover:underline font-semibold"
                  >
                    Max
                  </button>
                </div>
              </div>
              <input
                type="number"
                value={playAmount}
                onChange={(e) => setPlayAmount(e.target.value)}
                placeholder="Enter amount"
                className="w-full bg-[#0d0d0d] text-white rounded-lg px-4 py-3 text-base border border-[#4cd3ff]/30 focus:border-[#4cd3ff] focus:outline-none focus:ring-2 focus:ring-[#4cd3ff]/30"
              />
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
              className="w-full bg-gradient-to-br from-[#4cd3ff] to-[#00a0d2] hover:from-[#5ce6ff] hover:to-[#00b5e5] text-black font-bold py-4 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed text-lg shadow-lg hover:shadow-[#4cd3ff]/50"
            >
              {playMutation.isPending ? "Playing..." : "PLAY"}
            </button>

            {/* Potential Payout */}
            {playAmount && isValidAmount && betType && (
              <div className="bg-[#0a0a0a] rounded-lg p-4 border border-[#4cd3ff]/30">
                <div className="text-gray-400 text-xs mb-1">Potential Payout</div>
                <div className="flex items-center gap-3">
                  <div className="text-white font-bold text-2xl">
                    {(amount * multiplier).toFixed(0)}
                  </div>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                    chipType === "PAD" 
                      ? "bg-gradient-to-br from-[#b8b8b8] to-[#666666]"
                      : "bg-gradient-to-br from-[#ADFF2F] to-[#7FFF00]"
                  }`}>
                    {chipType === "PAD" ? "P" : "B"}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Result Popup */}
      {showResult && gameResult && (
        <Dialog open={true} onOpenChange={(open) => !open && handleCloseResult()}>
          <DialogContent className="bg-black border-[#2a2a2a] max-w-sm mx-auto p-0 overflow-hidden">
            <div className="bg-black px-6 py-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white">Game Result</h2>
                <button
                  onClick={handleCloseResult}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Lucky Number Reveal */}
              <div className="text-center mb-6">
                {isRevealing ? (
                  <div className="text-6xl font-bold text-white animate-pulse">?</div>
                ) : (
                  <>
                    <div className="text-sm text-gray-400 mb-2">Lucky Number</div>
                    <div className="text-7xl font-bold text-[#4cd3ff] drop-shadow-lg">
                      {gameResult.luckyNumber}
                    </div>
                  </>
                )}
              </div>

              {!isRevealing && (
                <>
                  {/* Game Details */}
                  <div className="space-y-3 mb-6 bg-[#0a0a0a] rounded-lg p-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Your Prediction</span>
                      <span className="text-white font-bold">
                        {gameResult.predictedValue}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Bet Type</span>
                      <span className="text-white font-bold capitalize">
                        {gameResult.betType}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Result</span>
                      <span
                        className={`font-bold text-lg ${
                          gameResult.won ? "text-[#4cd3ff]" : "text-red-500"
                        }`}
                      >
                        {gameResult.won ? "WIN" : "LOSE"}
                      </span>
                    </div>
                  </div>

                  {/* Reward Display */}
                  {gameResult.won && (
                    <div className="bg-gradient-to-r from-[#4cd3ff]/20 to-[#00a0d2]/20 border border-[#4cd3ff]/30 rounded-lg p-5 mb-5 text-center">
                      <div className="text-sm text-[#4cd3ff] font-semibold mb-1">You Won</div>
                      <div className="text-4xl font-bold text-white">
                        +{gameResult.reward}
                      </div>
                      <div className="text-xs text-[#4cd3ff] mt-1">{gameResult.chipType}</div>
                    </div>
                  )}

                  {!gameResult.won && (
                    <div className="bg-gradient-to-r from-red-600/20 to-red-700/20 border border-red-500/30 rounded-lg p-5 mb-5 text-center">
                      <div className="text-lg font-bold text-white">Oops! You lost</div>
                      <div className="text-sm text-red-300 mt-2">
                        -{gameResult.playAmount} {gameResult.chipType}
                      </div>
                    </div>
                  )}

                  {/* Close Button */}
                  <button
                    onClick={handleCloseResult}
                    className="w-full bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] border border-[#4cd3ff]/30 hover:border-[#4cd3ff] hover:bg-[#4cd3ff]/10 text-white font-bold py-3 rounded-lg transition-all shadow-lg hover:shadow-[#4cd3ff]/50"
                  >
                    Play Again
                  </button>
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Layout>
  );
}
