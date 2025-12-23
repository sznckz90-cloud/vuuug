import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Zap, Clock } from "lucide-react";
import { motion } from "framer-motion";

interface MiningSessionProps {
  boosterId: string;
  boosterName: string;
  durationHours: number;
  maxProfit: number;
}

export default function MiningSection({
  user,
}: {
  user: any;
}) {
  const [activeMining, setActiveMining] = useState<MiningSessionProps | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [minedAmount, setMinedAmount] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [timeLeft, setTimeLeft] = useState<string>("");
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const savedMining = localStorage.getItem(`mining_${user?.id}`);
    if (savedMining) {
      const mining = JSON.parse(savedMining);
      const now = Date.now();
      const elapsed = Math.floor((now - mining.startTime) / 1000);

      if (elapsed >= mining.durationSeconds) {
        setIsCompleted(true);
        setElapsedSeconds(mining.durationSeconds);
        setMinedAmount(mining.maxProfit);
        setProgress(100);
        setActiveMining(mining);
      } else {
        setActiveMining(mining);
        setElapsedSeconds(elapsed);
        setProgress((elapsed / mining.durationSeconds) * 100);
      }
    }
  }, [user?.id]);

  useEffect(() => {
    if (!activeMining || isCompleted) return;

    const interval = setInterval(() => {
      setElapsedSeconds((prev) => {
        const next = prev + 1;
        const durationSeconds = activeMining.durationHours * 3600;

        if (next >= durationSeconds) {
          setIsCompleted(true);
          setMinedAmount(activeMining.maxProfit);
          setProgress(100);
          localStorage.removeItem(`mining_${user?.id}`);
          return durationSeconds;
        }

        const progressPercent = (next / durationSeconds) * 100;
        const amount = activeMining.maxProfit * (next / durationSeconds);
        setMinedAmount(amount);
        setProgress(progressPercent);

        localStorage.setItem(
          `mining_${user?.id}`,
          JSON.stringify({
            ...activeMining,
            elapsed: next,
          })
        );

        return next;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [activeMining, user?.id, isCompleted]);

  useEffect(() => {
    if (!activeMining) return;

    const durationSeconds = activeMining.durationHours * 3600;
    const timeRemain = Math.max(0, durationSeconds - elapsedSeconds);

    const hours = Math.floor(timeRemain / 3600);
    const minutes = Math.floor((timeRemain % 3600) / 60);
    const seconds = timeRemain % 60;

    setTimeLeft(
      `${hours.toString().padStart(2, "0")}:${minutes
        .toString()
        .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
    );
  }, [elapsedSeconds, activeMining]);

  const handleClaim = async () => {
    try {
      const response = await fetch("/api/mining/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          minedAmount,
          boosterId: activeMining?.boosterId,
        }),
      });

      if (!response.ok) throw new Error("Claim failed");

      localStorage.removeItem(`mining_${user?.id}`);
      setActiveMining(null);
      setElapsedSeconds(0);
      setMinedAmount(0);
      setIsCompleted(false);
      setProgress(0);

      window.location.reload();
    } catch (error) {
      console.error("Claim error:", error);
    }
  };

  if (!activeMining) {
    return (
      <Card className="rounded-2xl minimal-card mb-3">
        <CardContent className="p-4">
          <div className="text-center">
            <h2 className="text-base font-bold text-white mb-1">Mining</h2>
            <p className="text-[#AAAAAA] text-xs">No active mining session</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl minimal-card mb-3">
      <CardContent className="p-4">
        <div className="text-center mb-3">
          <h2 className="text-base font-bold text-white mb-0.5">{activeMining.boosterName}</h2>
          <p className="text-[#AAAAAA] text-xs">Mining in progress</p>
        </div>

        {/* Progress Bar */}
        <div className="mb-3">
          <div className="w-full h-1.5 bg-[#2a2a2a] rounded-full overflow-hidden border border-[#3a3a3a]">
            <motion.div
              className="h-full bg-gradient-to-r from-[#4cd3ff] to-[#00a8ff]"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>

        {/* Mining Amount and Timer */}
        <div className="flex items-center justify-between gap-4 mb-3">
          <div className="flex-1 text-center">
            <motion.div
              className="text-2xl font-bold text-[#4cd3ff] font-mono"
              key={minedAmount.toFixed(8)}
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.1 }}
            >
              {minedAmount.toFixed(6)}
            </motion.div>
            <p className="text-[#AAAAAA] text-[10px] mt-0.5">TON</p>
          </div>

          {!isCompleted && (
            <div className="flex items-center gap-1 px-3 py-2 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a]">
              <Clock className="w-3.5 h-3.5 text-[#4cd3ff]" />
              <span className="text-sm font-bold font-mono text-[#4cd3ff]">{timeLeft}</span>
            </div>
          )}
        </div>

        {/* Claim Button */}
        {isCompleted ? (
          <Button
            onClick={handleClaim}
            className="w-full bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 text-white font-bold rounded-lg h-9 text-sm"
          >
            ✓ Claim {minedAmount.toFixed(6)} TON
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
