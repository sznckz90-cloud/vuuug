import { useAuth } from "@/hooks/useAuth";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Gift, Play, Users, ChevronLeft, Loader2, Sparkles, Zap } from "lucide-react";
import { showNotification } from "@/components/AppNotification";
import { useState, useEffect, useRef, useCallback } from "react";
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

const SLOT_SYMBOLS = [
  { id: 'pad1', label: '1', color: '#10b981', bgColor: 'from-emerald-600 to-emerald-700' },
  { id: 'pad20', label: '20', color: '#06b6d4', bgColor: 'from-cyan-600 to-cyan-700' },
  { id: 'pad200', label: '200', color: '#8b5cf6', bgColor: 'from-violet-600 to-violet-700' },
  { id: 'pad800', label: '800', color: '#ec4899', bgColor: 'from-pink-600 to-pink-700' },
  { id: 'pad1k', label: '1K', color: '#eab308', bgColor: 'from-yellow-600 to-yellow-700' },
  { id: 'pad10k', label: '10K', color: '#f97316', bgColor: 'from-orange-600 to-orange-700' },
  { id: 'ton001', label: '0.01T', color: '#3b82f6', bgColor: 'from-blue-600 to-blue-700' },
  { id: 'ton01', label: '0.1T', color: '#ef4444', bgColor: 'from-red-600 to-red-700' },
];

const getSymbolFromReward = (reward: SpinReward) => {
  if (reward.type === 'TON') {
    if (reward.amount === 0.01) return SLOT_SYMBOLS.find(s => s.id === 'ton001')!;
    if (reward.amount === 0.1) return SLOT_SYMBOLS.find(s => s.id === 'ton01')!;
  }
  if (reward.amount === 1) return SLOT_SYMBOLS.find(s => s.id === 'pad1')!;
  if (reward.amount === 20) return SLOT_SYMBOLS.find(s => s.id === 'pad20')!;
  if (reward.amount === 200) return SLOT_SYMBOLS.find(s => s.id === 'pad200')!;
  if (reward.amount === 800) return SLOT_SYMBOLS.find(s => s.id === 'pad800')!;
  if (reward.amount === 1000) return SLOT_SYMBOLS.find(s => s.id === 'pad1k')!;
  if (reward.amount === 10000) return SLOT_SYMBOLS.find(s => s.id === 'pad10k')!;
  return SLOT_SYMBOLS[0];
};

const SlotReel = ({ 
  spinning, 
  finalSymbol, 
  delay,
  onStop
}: { 
  spinning: boolean; 
  finalSymbol: typeof SLOT_SYMBOLS[0]; 
  delay: number;
  onStop?: () => void;
}) => {
  const [position, setPosition] = useState(0);
  const [stopped, setStopped] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    if (spinning) {
      setStopped(false);
      let pos = 0;
      intervalRef.current = setInterval(() => {
        pos += 1;
        setPosition(pos % SLOT_SYMBOLS.length);
      }, 80);
      
      setTimeout(() => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
        const finalIndex = SLOT_SYMBOLS.findIndex(s => s.id === finalSymbol.id);
        setPosition(finalIndex);
        setStopped(true);
        onStop?.();
      }, 2000 + delay);
    }
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [spinning, finalSymbol, delay, onStop]);

  const currentSymbol = SLOT_SYMBOLS[position];
  
  return (
    <div className="relative w-20 h-24 bg-gradient-to-b from-[#1a1a1a] to-[#0a0a0a] rounded-xl overflow-hidden border-2 border-yellow-500/30 shadow-[inset_0_2px_10px_rgba(0,0,0,0.8)]">
      <div className="absolute inset-0 flex items-center justify-center">
        <div 
          className={`w-16 h-20 rounded-lg bg-gradient-to-b ${currentSymbol.bgColor} flex items-center justify-center transition-all duration-100 ${
            !stopped ? 'blur-[2px] scale-105' : 'blur-0 scale-100'
          }`}
        >
          <span 
            className="text-white font-black text-xl drop-shadow-lg"
            style={{ textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}
          >
            {currentSymbol.label}
          </span>
        </div>
      </div>
      <div className="absolute inset-x-0 top-0 h-6 bg-gradient-to-b from-black/60 to-transparent pointer-events-none" />
      <div className="absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
    </div>
  );
};

export default function FreeSpin() {
  const { isLoading: authLoading, user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [isSpinning, setIsSpinning] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [lastReward, setLastReward] = useState<SpinReward | null>(null);
  const [reelsStopped, setReelsStopped] = useState([false, false, false]);
  const [showCollect, setShowCollect] = useState(false);
  const [isCollecting, setIsCollecting] = useState(false);
  const [adWatchLoading, setAdWatchLoading] = useState(false);

  const { data: spinStatus, isLoading: statusLoading, refetch: refetchSpinStatus } = useQuery<SpinStatus>({
    queryKey: ['/api/spin/status'],
    retry: 2,
    retryDelay: 1000,
    enabled: !authLoading && isAuthenticated,
  });

  const spinMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/spin/use', { method: 'POST', credentials: 'include' });
      if (!response.ok) throw new Error((await response.json()).error);
      return response.json();
    },
    onSuccess: (data) => {
      setLastReward(data.reward);
      setReelsStopped([false, false, false]);
    },
    onError: (error: Error) => {
      setIsSpinning(false);
      showNotification(error.message, 'error');
    },
  });

  const handleReelStop = useCallback((index: number) => {
    setReelsStopped(prev => {
      const newState = [...prev];
      newState[index] = true;
      if (newState.every(Boolean)) {
        setTimeout(() => {
          setIsSpinning(false);
          setShowResult(true);
          setShowCollect(true);
        }, 300);
      }
      return newState;
    });
  }, []);

  const handleCollectReward = async () => {
    if (!lastReward) return;
    
    setIsCollecting(true);
    
    try {
      const tg = window.Telegram?.WebApp as any;
      
      if (typeof (window as any).show_9594390 === 'function') {
        await new Promise<void>((resolve) => {
          (window as any).show_9594390('pop', {}, () => {
            resolve();
          });
        });
      }
      
      queryClient.invalidateQueries({ queryKey: ['/api/spin/status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      
      showNotification(`+${lastReward.amount} ${lastReward.type} collected!`, 'success');
      setShowResult(false);
      setShowCollect(false);
      setLastReward(null);
    } catch (error) {
      queryClient.invalidateQueries({ queryKey: ['/api/spin/status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      showNotification(`+${lastReward.amount} ${lastReward.type} collected!`, 'success');
      setShowResult(false);
      setShowCollect(false);
      setLastReward(null);
    } finally {
      setIsCollecting(false);
    }
  };

  const handleWatchAd = async () => {
    if (adWatchLoading) return;
    
    setAdWatchLoading(true);
    
    try {
      if (typeof (window as any).show_9594390 !== 'function') {
        showNotification('Ad not available. Please try again later.', 'error');
        setAdWatchLoading(false);
        return;
      }
      
      await new Promise<void>((resolve, reject) => {
        (window as any).show_9594390('pop', {}, async (result: any) => {
          if (result) {
            try {
              const response = await fetch('/api/spin/adwatch', { 
                method: 'POST', 
                credentials: 'include' 
              });
              
              if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to record ad watch');
              }
              
              const data = await response.json();
              queryClient.invalidateQueries({ queryKey: ['/api/spin/status'] });
              
              if (data.spinEarned) {
                showNotification('+1 Spin earned!', 'success');
              } else {
                showNotification(`Ad watched! ${data.adsUntilNextSpin} more for spin`, 'success');
              }
              resolve();
            } catch (error) {
              reject(error);
            }
          } else {
            reject(new Error('Ad not completed'));
          }
        });
      });
    } catch (error: any) {
      if (error.message !== 'Ad not completed') {
        showNotification(error.message || 'Failed to watch ad', 'error');
      }
    } finally {
      setAdWatchLoading(false);
    }
  };

  const handleSpin = () => {
    if (isSpinning || !spinStatus?.totalSpins) return;
    setIsSpinning(true);
    setShowResult(false);
    setShowCollect(false);
    spinMutation.mutate();
  };

  if (authLoading) {
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

  if (!isAuthenticated) {
    return (
      <Layout>
        <main className="max-w-md mx-auto px-4 pt-8 pb-16 flex flex-col items-center justify-center min-h-[60vh]">
          <Gift className="w-16 h-16 text-yellow-500 mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Authentication Required</h2>
          <p className="text-gray-400 text-center">Please open this app in Telegram to access Lucky Slots.</p>
        </main>
      </Layout>
    );
  }

  if (statusLoading) {
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
  const adsInCurrentCycle = adsWatched % adsPerSpin;
  const progress = (adsInCurrentCycle / adsPerSpin) * 100;

  const winningSymbol = lastReward ? getSymbolFromReward(lastReward) : SLOT_SYMBOLS[0];

  return (
    <Layout>
      <main className="max-w-md mx-auto px-4 pt-2 pb-16">
        <div className="flex items-center gap-2 mb-3">
          <button onClick={() => setLocation('/missions')} className="w-7 h-7 rounded-full bg-[#1a1a1a] flex items-center justify-center">
            <ChevronLeft className="w-4 h-4 text-white" />
          </button>
          <Sparkles className="w-4 h-4 text-yellow-400" />
          <span className="text-white text-base font-bold">Lucky Slots</span>
          <div className="ml-auto px-3 py-1 rounded-full bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/40">
            <span className="text-yellow-400 text-sm font-bold">{spins} Spins</span>
          </div>
        </div>

        <div className="bg-gradient-to-b from-[#1a1a1a] to-[#0d0d0d] rounded-2xl p-4 mb-3 border border-yellow-500/20 shadow-[0_0_40px_rgba(234,179,8,0.15)]">
          <div className="text-center mb-3">
            <h2 className="text-yellow-400 font-bold text-sm tracking-wider">SPIN TO WIN</h2>
          </div>

          <div className="relative bg-gradient-to-b from-[#2a2a2a] to-[#1a1a1a] rounded-xl p-4 border border-yellow-500/30">
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 z-10">
              <div className="w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[12px] border-t-yellow-400 drop-shadow-[0_0_6px_rgba(234,179,8,0.8)]" />
            </div>

            <div className="flex items-center justify-center gap-2 py-2">
              <SlotReel 
                spinning={isSpinning} 
                finalSymbol={winningSymbol} 
                delay={0}
                onStop={() => handleReelStop(0)}
              />
              <SlotReel 
                spinning={isSpinning} 
                finalSymbol={winningSymbol} 
                delay={300}
                onStop={() => handleReelStop(1)}
              />
              <SlotReel 
                spinning={isSpinning} 
                finalSymbol={winningSymbol} 
                delay={600}
                onStop={() => handleReelStop(2)}
              />
            </div>

            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-2 h-12 bg-gradient-to-r from-yellow-500/50 to-transparent rounded-r" />
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-12 bg-gradient-to-l from-yellow-500/50 to-transparent rounded-l" />
          </div>

          <div className="mt-4 flex justify-center">
            <Button
              onClick={handleSpin}
              disabled={isSpinning || spins === 0}
              className={`h-12 px-10 text-base font-black rounded-xl shadow-lg transition-all duration-200 ${
                isSpinning || spins === 0 
                  ? 'bg-gray-700 text-gray-400 cursor-not-allowed' 
                  : 'bg-gradient-to-r from-yellow-500 via-orange-500 to-yellow-500 hover:from-yellow-400 hover:via-orange-400 hover:to-yellow-400 text-black hover:scale-105 active:scale-95'
              }`}
            >
              {isSpinning ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>SPINNING...</span>
                </div>
              ) : spins === 0 ? (
                'NO SPINS'
              ) : (
                <div className="flex items-center gap-2">
                  <Zap className="w-5 h-5" />
                  <span>SPIN NOW!</span>
                </div>
              )}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gradient-to-br from-[#1a1a1a] to-[#111] rounded-xl p-3 border border-cyan-500/20">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                <Play className="w-4 h-4 text-white" />
              </div>
              <span className="text-white text-sm font-bold">Watch Ads</span>
            </div>
            
            <div className="mb-2">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-400">Progress</span>
                <span className="text-cyan-400 font-bold">{adsInCurrentCycle}/{adsPerSpin}</span>
              </div>
              <div className="h-2 bg-[#2a2a2a] rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300 rounded-full" 
                  style={{ width: `${progress}%` }} 
                />
              </div>
            </div>

            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-500 text-xs">Today: {adsWatched}/{maxAds}</span>
            </div>
            
            <Button
              onClick={handleWatchAd}
              disabled={adWatchLoading || adsWatched >= maxAds}
              className="w-full h-9 text-sm font-bold bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white rounded-lg"
            >
              {adWatchLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : adsWatched >= maxAds ? (
                'Daily Limit'
              ) : (
                'Watch Ad'
              )}
            </Button>
          </div>

          <div className="bg-gradient-to-br from-[#1a1a1a] to-[#111] rounded-xl p-3 border border-green-500/20">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                <Users className="w-4 h-4 text-white" />
              </div>
              <span className="text-white text-sm font-bold">Invite Friends</span>
            </div>
            
            <p className="text-gray-400 text-xs mb-2">
              Invite a friend who watches 1+ ad = 1 free spin!
            </p>
            
            <div className="bg-[#0a0a0a] rounded-lg p-2 text-center">
              <span className="text-green-400 text-lg font-bold">{spinStatus?.inviteSpinsEarned || 0}</span>
              <span className="text-gray-500 text-xs block">spins earned</span>
            </div>
          </div>
        </div>

        <div className="mt-3 bg-[#111] rounded-xl p-3 border border-[#222]">
          <h3 className="text-white text-sm font-bold mb-2 text-center">Possible Rewards</h3>
          <div className="grid grid-cols-4 gap-2">
            {SLOT_SYMBOLS.map((symbol) => (
              <div 
                key={symbol.id} 
                className={`bg-gradient-to-b ${symbol.bgColor} rounded-lg p-2 text-center`}
              >
                <span className="text-white text-xs font-bold">{symbol.label}</span>
              </div>
            ))}
          </div>
        </div>

        {showResult && lastReward && (
          <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
            <div 
              className="bg-gradient-to-b from-[#1f1f1f] to-[#111] rounded-2xl p-6 text-center border-2 border-yellow-500/50 w-full max-w-[300px] shadow-[0_0_60px_rgba(234,179,8,0.3)]"
              onClick={e => e.stopPropagation()}
            >
              <div className="text-5xl mb-3 animate-bounce">
                {lastReward.rarity === 'ultra_rare' ? '🌟' : lastReward.rarity === 'rare' ? '✨' : '🎉'}
              </div>
              
              <p className="text-white text-xl font-black mb-1">
                {lastReward.rarity === 'ultra_rare' ? 'JACKPOT!' : lastReward.rarity === 'rare' ? 'BIG WIN!' : 'YOU WON!'}
              </p>
              
              <div className={`text-3xl font-black mb-4 ${
                lastReward.type === 'TON' ? 'text-orange-400' : 'text-cyan-400'
              }`}>
                +{lastReward.amount} {lastReward.type}
              </div>

              {showCollect && (
                <Button 
                  onClick={handleCollectReward}
                  disabled={isCollecting}
                  className="w-full h-12 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-black font-black text-lg rounded-xl shadow-lg"
                >
                  {isCollecting ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Collecting...</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2">
                      <Gift className="w-5 h-5" />
                      <span>Collect Reward</span>
                    </div>
                  )}
                </Button>
              )}
            </div>
          </div>
        )}
      </main>
    </Layout>
  );
}
