import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import Layout from "@/components/Layout";
import { useToast } from "@/hooks/use-toast";
import { Dices, X, Sparkles, TrendingUp } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";

export default function Game() {
  const { toast } = useToast();
  const [activeGame, setActiveGame] = useState<"scratch" | "pick" | null>(null);
  const [scratchValues, setScratchValues] = useState<number[]>([]);
  const [scratchRevealed, setScratchRevealed] = useState(false);
  const [pickCards, setPickCards] = useState<{ value: number; revealed: boolean }[]>([]);
  const [pickSelections, setPickSelections] = useState<number[]>([]);

  // Fetch game states
  const { data: gameState, refetch: refetchGameState } = useQuery({
    queryKey: ["/api/games/state"],
    retry: false,
  });

  // Scratch game mutation
  const scratchMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/games/scratch/play", { 
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      if (!res.ok) throw new Error("Failed to play scratch game");
      return res.json();
    },
    onSuccess: (data) => {
      setScratchValues(data.values);
      setScratchRevealed(false);
      setActiveGame("scratch");
    },
    onError: () => {
      toast({ description: "Failed to start game", variant: "destructive" });
    },
  });

  // Reveal scratch cards
  const revealScratch = () => {
    setScratchRevealed(true);
    const matched = scratchValues[0] === scratchValues[1] && scratchValues[1] === scratchValues[2];

    setTimeout(() => {
      if (matched) {
        const reward = scratchValues[0] * 3;
        toast({ description: `✨ You've Won ${reward} PAD!`, variant: "default" });
        fetch("/api/games/scratch/claim", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ values: scratchValues, matched: true, reward }),
        }).then(() => {
          refetchGameState();
          setScratchValues([]);
        });
      } else {
        toast({ description: "❌ Oops! Try Again", variant: "destructive" });
        fetch("/api/games/scratch/claim", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ values: scratchValues, matched: false }),
        }).then(() => {
          refetchGameState();
          setScratchValues([]);
        });
      }

      setTimeout(() => setScratchRevealed(false), 1500);
    }, 800);
  };

  // Pick game mutation
  const pickMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/games/pick/start", { 
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      if (!res.ok) throw new Error("Failed to start pick game");
      return res.json();
    },
    onSuccess: (data) => {
      setPickCards(data.cards);
      setPickSelections([]);
      setActiveGame("pick");
    },
    onError: () => {
      toast({ description: "Failed to start game", variant: "destructive" });
    },
  });

  // Pick a card
  const pickCard = (index: number) => {
    if (pickSelections.includes(index) || pickSelections.length >= 2) return;

    const newSelections = [...pickSelections, index];
    setPickSelections(newSelections);

    // Reveal card
    const updatedCards = [...pickCards];
    updatedCards[index] = { ...updatedCards[index], revealed: true };
    setPickCards(updatedCards);

    // Check result
    const card = updatedCards[index];
    if (card.value === 0) {
      toast({ description: "❌ Bad Choice", variant: "destructive" });
    } else {
      toast({ description: `✨ You won ${card.value} PAD!`, variant: "default" });
    }

    // If 2 picks, lock game and claim
    if (newSelections.length === 2) {
      setTimeout(() => {
        fetch("/api/games/pick/claim", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ picks: newSelections, cards: updatedCards }),
        }).then(() => {
          refetchGameState();
          setPickCards([]);
          setPickSelections([]);
        });
      }, 1000);
    }
  };

  const scratchPlaysRemaining = gameState?.scratchGame?.playsRemaining ?? 8;
  const pickAttemptsRemaining = gameState?.pickGame?.attemptsRemaining ?? 2;

  return (
    <Layout>
      <div className="min-h-screen bg-black pt-4 pb-24 px-4">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Dices className="w-5 h-5 text-[#007BFF]" />
            <h1 className="text-3xl font-bold text-white">GAME</h1>
          </div>
          <p className="text-gray-400 text-xs">Lucky Games & Instant Rewards</p>
        </div>

        {/* Game Cards */}
        <div className="max-w-sm mx-auto space-y-3">
          {/* Scratch Game Card */}
          <div className="bg-[#1a1a1a] rounded-lg p-4 border border-[#2a2a2a]">
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-2xl">🎰</span>
                  <h2 className="text-base font-bold text-white">Scratch</h2>
                </div>
                <p className="text-gray-400 text-xs mb-1">Match 3 to Win</p>
              </div>
              <span className="text-white font-bold text-sm bg-[#007BFF] px-2 py-1 rounded">{scratchPlaysRemaining}/8</span>
            </div>
            <button
              onClick={() => scratchMutation.mutate()}
              disabled={scratchMutation.isPending || scratchPlaysRemaining <= 0}
              className="w-full bg-[#007BFF] hover:bg-[#0056b3] text-white font-bold py-2 rounded-lg text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {scratchMutation.isPending ? "..." : scratchPlaysRemaining <= 0 ? "No Plays" : "Play Now"}
            </button>
          </div>

          {/* Pick & Earn Card */}
          <div className="bg-[#1a1a1a] rounded-lg p-4 border border-[#2a2a2a]">
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-2xl">🃏</span>
                  <h2 className="text-base font-bold text-white">Pick & Earn</h2>
                </div>
                <p className="text-gray-400 text-xs mb-1">Pick 2 Cards</p>
              </div>
              <span className="text-white font-bold text-sm bg-[#007BFF] px-2 py-1 rounded">{pickAttemptsRemaining}/2</span>
            </div>
            <button
              onClick={() => pickMutation.mutate()}
              disabled={pickMutation.isPending || pickAttemptsRemaining <= 0}
              className="w-full bg-[#007BFF] hover:bg-[#0056b3] text-white font-bold py-2 rounded-lg text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {pickMutation.isPending ? "..." : pickAttemptsRemaining <= 0 ? "No Attempts" : "Start"}
            </button>
          </div>
        </div>
      </div>

      {/* Scratch Game Popup */}
      {activeGame === "scratch" && (
        <Dialog open={true} onOpenChange={(open) => !open && setActiveGame(null)}>
          <DialogContent className="bg-black border-[#2a2a2a] max-w-sm mx-auto p-0 overflow-hidden">
            <div className="bg-black px-4 py-4">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🎰</span>
                  <h2 className="text-lg font-bold text-white">Scratch</h2>
                </div>
                <button
                  onClick={() => setActiveGame(null)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {scratchValues.length > 0 ? (
                <>
                  <div className="flex justify-around mb-4 gap-2">
                    {scratchValues.map((value, idx) => (
                      <div
                        key={idx}
                        className={`flex-1 h-16 flex items-center justify-center rounded-lg font-bold text-sm transition-all ${
                          scratchRevealed
                            ? "bg-[#007BFF] text-white"
                            : "bg-[#1a1a1a] text-gray-500 border border-[#2a2a2a]"
                        }`}
                      >
                        {scratchRevealed ? `${value}P` : "?"}
                      </div>
                    ))}
                  </div>

                  {!scratchRevealed ? (
                    <button
                      onClick={revealScratch}
                      className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 rounded-lg transition-all text-sm"
                    >
                      Reveal
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setScratchValues([]);
                        scratchMutation.mutate();
                      }}
                      className="w-full bg-[#007BFF] hover:bg-[#0056b3] text-white font-bold py-2 rounded-lg transition-all text-sm"
                    >
                      Play Again
                    </button>
                  )}
                </>
              ) : (
                <div className="text-center py-6">
                  <p className="text-white font-semibold text-sm mb-1">Done for Today</p>
                  <p className="text-gray-400 text-xs">Come back tomorrow</p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Pick Game Popup */}
      {activeGame === "pick" && (
        <Dialog open={true} onOpenChange={(open) => !open && setActiveGame(null)}>
          <DialogContent className="bg-black border-[#2a2a2a] max-w-sm mx-auto p-0 overflow-hidden">
            <div className="bg-black px-4 py-4">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🃏</span>
                  <h2 className="text-lg font-bold text-white">Pick & Earn</h2>
                </div>
                <button
                  onClick={() => setActiveGame(null)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {pickCards.length > 0 && pickSelections.length < 2 ? (
                <>
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    {pickCards.map((card, idx) => (
                      <button
                        key={idx}
                        onClick={() => pickCard(idx)}
                        disabled={pickSelections.includes(idx)}
                        className={`h-20 rounded-lg font-bold text-lg transition-all transform ${
                          pickSelections.includes(idx)
                            ? card.value === 0
                              ? "bg-red-600 text-white scale-95"
                              : "bg-green-600 text-white scale-95"
                            : "bg-[#1a1a1a] text-gray-300 hover:bg-[#252525] hover:scale-105 border border-[#2a2a2a]"
                        } disabled:cursor-not-allowed text-sm`}
                      >
                        {pickSelections.includes(idx)
                          ? card.value === 0
                            ? "✗"
                            : `${card.value}P`
                          : "🃏"}
                      </button>
                    ))}
                  </div>

                  <p className="text-center text-gray-400 text-xs">
                    {2 - pickSelections.length} pick(s) left
                  </p>
                </>
              ) : (
                <div className="text-center py-6">
                  <p className="text-white font-semibold text-sm mb-1">Round Complete</p>
                  <p className="text-gray-400 text-xs">Come back tomorrow</p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Layout>
  );
}
