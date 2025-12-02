import { useAuth } from "@/hooks/useAuth";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Gift, Play, Users, ChevronLeft, Loader2 } from "lucide-react";
import { showNotification } from "@/components/AppNotification";
import { useState } from "react";
import { useLocation } from "wouter";

interface SpinStatus {
  success: boolean;
  freeSpinAvailable: boolean;
  extraSpins: number;
  totalSpins: number;
  spinAdsWatched: number;
  maxDailyAds: number;
  adsPerSpin: number;
  inviteSpinsEarned: number;
}

interface SpinReward {
  type: string;
  amount: number;
  rarity: string;
}

const SEGMENTS = [
  { label: '1', color: '#10b981' },
  { label: '20', color: '#06b6d4' },
  { label: '1', color: '#22c55e' },
  { label: '200', color: '#8b5cf6' },
  { label: '20', color: '#0ea5e9' },
  { label: '0.01T', color: '#f97316' },
  { label: '1', color: '#10b981' },
  { label: '800', color: '#ec4899' },
  { label: '20', color: '#06b6d4' },
  { label: '1K', color: '#eab308' },
  { label: '1', color: '#22c55e' },
  { label: '0.1T', color: '#ef4444' },
];

export default function FreeSpin() {
  const { isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [lastReward, setLastReward] = useState<SpinReward | null>(null);

  const { data: spinStatus, isLoading: statusLoading } = useQuery<SpinStatus>({
    queryKey: ['/api/spin/status'],
    retry: false,
  });

  const spinMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/spin/use', { method: 'POST', credentials: 'include' });
      if (!response.ok) throw new Error((await response.json()).error);
      return response.json();
    },
    onSuccess: (data) => {
      setLastReward(data.reward);
      setTimeout(() => {
        setIsSpinning(false);
        setShowResult(true);
        queryClient.invalidateQueries({ queryKey: ['/api/spin/status'] });
        queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      }, 3000);
    },
    onError: (error: Error) => {
      setIsSpinning(false);
      showNotification(error.message, 'error');
    },
  });

  const adWatchMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/spin/adwatch', { method: 'POST', credentials: 'include' });
      if (!response.ok) throw new Error((await response.json()).error);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/spin/status'] });
      showNotification(data.spinEarned ? '+1 Spin!' : `${data.adsUntilNextSpin} more`, 'success');
    },
    onError: (error: Error) => showNotification(error.message, 'error'),
  });

  const handleSpin = () => {
    if (isSpinning || !spinStatus?.totalSpins) return;
    setIsSpinning(true);
    setShowResult(false);
    setRotation(prev => prev + 360 * (4 + Math.random() * 2));
    spinMutation.mutate();
  };

  if (authLoading || statusLoading) {
    return (
      <Layout>
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="flex gap-1">
            {[0, 150, 300].map(d => (
              <div key={d} className="w-2 h-2 rounded-full bg-[#4cd3ff] animate-bounce" style={{ animationDelay: `${d}ms` }} />
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  const spins = spinStatus?.totalSpins || 0;
  const adsWatched = spinStatus?.spinAdsWatched || 0;
  const maxAds = spinStatus?.maxDailyAds || 50;
  const adsPerSpin = spinStatus?.adsPerSpin || 10;
  const progress = (adsWatched % adsPerSpin) / adsPerSpin * 100;

  return (
    <Layout>
      <main className="max-w-md mx-auto px-4 pt-2 pb-20">
        <div className="flex items-center gap-2 mb-3">
          <button onClick={() => setLocation('/missions')} className="w-7 h-7 rounded-full bg-[#1a1a1a] flex items-center justify-center">
            <ChevronLeft className="w-4 h-4 text-white" />
          </button>
          <Gift className="w-4 h-4 text-yellow-400" />
          <span className="text-white text-base font-bold">Free Spin</span>
          <div className="ml-auto px-2 py-0.5 rounded-full bg-yellow-500/20 border border-yellow-500/40">
            <span className="text-yellow-400 text-xs font-bold">{spins}</span>
          </div>
        </div>

        <div className="bg-gradient-to-b from-[#1a1a1a] to-[#111] rounded-2xl p-4 mb-3 border border-[#2a2a2a] shadow-[0_0_30px_rgba(234,179,8,0.1)]">
          <div className="relative flex flex-col items-center">
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 z-20">
              <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[10px] border-t-yellow-400 drop-shadow-[0_0_4px_rgba(234,179,8,0.8)]" />
            </div>
            
            <div 
              className="w-40 h-40 rounded-full shadow-[0_0_20px_rgba(234,179,8,0.3),inset_0_0_20px_rgba(0,0,0,0.5)] overflow-hidden border-2 border-yellow-500/50"
              style={{
                transform: `rotate(${rotation}deg)`,
                transition: isSpinning ? 'transform 3s cubic-bezier(0.2, 0.8, 0.2, 1)' : 'none',
              }}
            >
              <svg viewBox="0 0 100 100" className="w-full h-full">
                <defs>
                  <radialGradient id="wheelBg" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#2a2a2a" />
                    <stop offset="100%" stopColor="#111" />
                  </radialGradient>
                </defs>
                <circle cx="50" cy="50" r="50" fill="url(#wheelBg)" />
                {SEGMENTS.map((seg, i) => {
                  const a = (360 / 12) * i - 90;
                  const aEnd = a + 30;
                  const r1 = (a * Math.PI) / 180;
                  const r2 = (aEnd * Math.PI) / 180;
                  const x1 = 50 + 48 * Math.cos(r1);
                  const y1 = 50 + 48 * Math.sin(r1);
                  const x2 = 50 + 48 * Math.cos(r2);
                  const y2 = 50 + 48 * Math.sin(r2);
                  const mid = a + 15;
                  const mr = (mid * Math.PI) / 180;
                  const tx = 50 + 32 * Math.cos(mr);
                  const ty = 50 + 32 * Math.sin(mr);
                  return (
                    <g key={i}>
                      <path d={`M 50 50 L ${x1} ${y1} A 48 48 0 0 1 ${x2} ${y2} Z`} fill={seg.color} opacity="0.9" />
                      <text x={tx} y={ty} fill="white" fontSize="5" fontWeight="700" textAnchor="middle" dominantBaseline="middle"
                        transform={`rotate(${mid + 90}, ${tx}, ${ty})`} style={{ textShadow: '0 1px 2px #000' }}>
                        {seg.label}
                      </text>
                    </g>
                  );
                })}
                <circle cx="50" cy="50" r="12" fill="#1a1a1a" stroke="#eab308" strokeWidth="2" />
                <circle cx="50" cy="50" r="8" fill="linear-gradient(#333,#111)" />
                <text x="50" y="51" fill="#eab308" fontSize="4" fontWeight="700" textAnchor="middle" dominantBaseline="middle">SPIN</text>
              </svg>
            </div>

            <Button
              onClick={handleSpin}
              disabled={isSpinning || spins === 0}
              className={`mt-3 h-9 px-6 text-sm font-bold rounded-xl shadow-lg ${
                isSpinning || spins === 0 ? 'bg-gray-700 text-gray-400' : 'bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-black'
              }`}
            >
              {isSpinning ? <Loader2 className="w-4 h-4 animate-spin" /> : spins === 0 ? 'No Spins' : 'SPIN!'}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="bg-[#111] rounded-xl p-2.5 border border-[#222]">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Play className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-white text-xs font-semibold">Watch Ads</span>
            </div>
            <div className="h-1 bg-[#2a2a2a] rounded-full overflow-hidden mb-1">
              <div className="h-full bg-cyan-500 transition-all" style={{ width: `${progress}%` }} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500 text-[10px]">{adsWatched % adsPerSpin}/{adsPerSpin}</span>
              <Button
                size="sm"
                onClick={() => adWatchMutation.mutate()}
                disabled={adWatchMutation.isPending || adsWatched >= maxAds}
                className="h-5 px-2 text-[10px] font-semibold bg-cyan-500 hover:bg-cyan-600 text-black rounded"
              >
                {adWatchMutation.isPending ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : 'Watch'}
              </Button>
            </div>
          </div>

          <div className="bg-[#111] rounded-xl p-2.5 border border-[#222]">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Users className="w-3.5 h-3.5 text-green-400" />
              <span className="text-white text-xs font-semibold">Invite</span>
            </div>
            <p className="text-gray-500 text-[10px] mb-1">1 friend = 1 spin</p>
            <p className="text-green-400 text-xs font-bold">{spinStatus?.inviteSpinsEarned || 0} earned</p>
          </div>
        </div>

        {showResult && lastReward && (
          <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 p-4" onClick={() => setShowResult(false)}>
            <div className="bg-gradient-to-b from-[#1f1f1f] to-[#111] rounded-2xl p-5 text-center border border-yellow-500/30 w-full max-w-[260px]" onClick={e => e.stopPropagation()}>
              <div className="text-3xl mb-1">{lastReward.rarity === 'ultra_rare' ? '🌟' : lastReward.rarity === 'rare' ? '✨' : '🎉'}</div>
              <p className="text-white text-sm font-bold mb-0.5">
                {lastReward.rarity === 'ultra_rare' ? 'JACKPOT!' : lastReward.rarity === 'rare' ? 'Nice Win!' : 'You Won!'}
              </p>
              <p className={`text-xl font-bold mb-3 ${lastReward.type === 'TON' ? 'text-orange-400' : 'text-cyan-400'}`}>
                +{lastReward.amount} {lastReward.type}
              </p>
              <Button onClick={() => setShowResult(false)} className="h-8 px-5 bg-yellow-500 hover:bg-yellow-600 text-black font-bold rounded-lg text-sm">
                Awesome!
              </Button>
            </div>
          </div>
        )}
      </main>
    </Layout>
  );
}
