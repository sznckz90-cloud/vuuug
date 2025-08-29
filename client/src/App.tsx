import { useState, useEffect, useRef } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { X, Play, Zap, Trophy, Users, Wallet, Copy, ExternalLink, Search, Filter, Settings } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const ADMIN_EMAILS = ["sznofficial.store@gmail.com", "official.me.szn@gmail.com"];

// Monetag SDK type declarations
declare global {
  interface Window {
    show_9368336: (type?: string | object) => Promise<void>;
  }
}

// Types
interface User {
  id: string;
  email: string;
  username: string;
  personalCode: string;
  withdrawBalance: string;
  totalEarnings: string;
  adsWatched: number;
  dailyAdsWatched: number;
  dailyEarnings: string;
  lastAdWatch?: string;
  level: number;
  referredBy?: string;
  banned: boolean;
  createdAt: string;
  updatedAt: string;
}

// Auth hook
function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem('lighting_sats_user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (error) {
        console.error('Failed to parse stored user:', error);
        localStorage.removeItem('lighting_sats_user');
      }
    }
    setIsLoading(false);
  }, []);

  const logout = () => {
    if (user && ADMIN_EMAILS.includes(user.email)) {
      localStorage.removeItem('lighting_sats_user');
      setUser(null);
      window.location.reload();
    }
  };

  const canLogout = user && ADMIN_EMAILS.includes(user.email);

  return { user, isLoading, isAuthenticated: !!user, logout, canLogout, setUser };
}

// Login/Signup Component
function AuthForm({ onSuccess }: { onSuccess: (user: User) => void }) {
  const [email, setEmail] = useState("");
  const [isSignup, setIsSignup] = useState(false);
  const [referralCode, setReferralCode] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const { toast } = useToast();

  const authMutation = useMutation({
    mutationFn: async (data: { email: string; referralCode?: string; agreedToTerms?: boolean }) => {
      const endpoint = isSignup ? '/api/register' : '/api/login';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Authentication failed');
      }

      return response.json();
    },
    onSuccess: async (user: User) => {
      localStorage.setItem('lighting_sats_user', JSON.stringify(user));
      
      // Show welcome popup ad for new users with referral code
      if (isSignup && referralCode.trim() && window.show_9368336) {
        try {
          setTimeout(async () => {
            // Simplified ad call
            window.show_9368336('pop');
            
            toast({
              title: "Referral Bonus Earned!",
              description: "You earned bonus Sats for joining with a referral!",
            });
          }, 2000); // Delay to let user see welcome message first
        } catch (error) {
          console.error('Welcome referral ad error:', error);
        }
      }
      
      onSuccess(user);
      toast({
        title: isSignup ? "Welcome to Lighting Sats!" : "Welcome back!",
        description: `Logged in as ${user.email}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: isSignup ? "Signup Failed" : "Login Failed",
        description: error.message,
      });
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!email.trim()) {
      toast({
        title: "Error",
        description: "Please enter your Gmail address",
      });
      return;
    }

    if (!email.includes('@gmail.com')) {
      toast({
        title: "Error",
        description: "Only Gmail addresses are allowed",
      });
      return;
    }

    if (isSignup && !agreedToTerms) {
      toast({
        title: "Error",
        description: "Please agree to the Terms & Conditions",
      });
      return;
    }

    authMutation.mutate({
      email,
      referralCode: referralCode.trim() || undefined,
      agreedToTerms: isSignup ? agreedToTerms : undefined,
    });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <Card className="w-full max-w-sm p-8 rounded-3xl shadow-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary mb-2">Lighting Sats</h1>
          <p className="text-muted-foreground text-sm">
            {isSignup ? "Create your account" : "Login to your account"}
          </p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <Label htmlFor="email" className="text-foreground text-sm font-medium">Gmail Address</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your.email@gmail.com"
              className="mt-2 rounded-xl h-12 px-4"
              disabled={authMutation.isPending}
            />
          </div>

          {isSignup && (
            <>
              <div>
                <Label htmlFor="referralCode" className="text-foreground text-sm font-medium">Referral Code (Optional)</Label>
                <Input
                  id="referralCode"
                  type="text"
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value)}
                  placeholder="Enter referral code"
                  className="mt-2 rounded-xl h-12 px-4"
                  disabled={authMutation.isPending}
                />
              </div>

              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="terms"
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  className="w-4 h-4 text-primary rounded"
                />
                <Label htmlFor="terms" className="text-foreground text-sm">
                  I agree to the Terms & Conditions
                </Label>
              </div>
            </>
          )}
          
          <Button
            type="submit"
            className="w-full btn-primary-gradient font-semibold rounded-xl h-12"
            disabled={authMutation.isPending}
          >
            {authMutation.isPending ? "Please wait..." : (isSignup ? "Create Account" : "Login")}
          </Button>
        </form>
        
        <div className="text-center mt-6">
          <Button
            variant="ghost"
            onClick={() => setIsSignup(!isSignup)}
            className="text-secondary hover:text-foreground text-sm"
          >
            {isSignup ? "Already have an account? Login" : "Don't have an account? Sign up"}
          </Button>
        </div>
      </Card>
    </div>
  );
}

// Modal component
function Modal({ isOpen, onClose, title, children }: { 
  isOpen: boolean; 
  onClose: () => void; 
  title: string; 
  children: React.ReactNode; 
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <Card className="w-full max-w-sm p-6 rounded-2xl shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-foreground">{title}</h3>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onClose}
            className="h-8 w-8 p-0 hover:bg-muted/20"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        {children}
      </Card>
    </div>
  );
}

// Watch to Earn Modal Content (no popup, direct watch)
function WatchToEarnModal({ user, onRefresh }: { user: User; onRefresh: () => void }) {
  const [isWatchingAd, setIsWatchingAd] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    if (user?.lastAdWatch) {
      const lastWatch = new Date(user.lastAdWatch).getTime();
      const now = Date.now();
      const timeDiff = now - lastWatch;
      const cooldownTime = 3000;
      
      if (timeDiff < cooldownTime) {
        setCooldown(Math.ceil((cooldownTime - timeDiff) / 1000));
        
        const timer = setInterval(() => {
          const remaining = Math.ceil((cooldownTime - (Date.now() - lastWatch)) / 1000);
          if (remaining <= 0) {
            setCooldown(0);
            clearInterval(timer);
          } else {
            setCooldown(remaining);
          }
        }, 1000);
        
        return () => clearInterval(timer);
      }
    }
  }, [user?.lastAdWatch]);

  const handleWatchAd = async () => {
    if (cooldown > 0 || isWatchingAd) return;
    
    setIsWatchingAd(true);
    try {
      // Check if Monetag SDK is available
      if (window.show_9368336) {
        // Real Monetag Rewarded Interstitial
        toast({
          title: "Loading Ad...",
          description: "Please wait while the ad loads",
        });
        
        try {
          // Show rewarded interstitial ad
          await window.show_9368336();
          
          toast({
            title: "Ad Completed!",
            description: "Processing your reward...",
          });
          
        } catch (adError) {
          console.error('Monetag ad error:', adError);
          toast({
            title: "Ad Error",
            description: "Unable to play ad. Using demo mode.",
            variant: "destructive"
          });
          // Fall back to simulation
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      } else {
        // Demo mode - simulate ad watching
        toast({
          title: "Demo Mode",
          description: "Simulating ad watch (5 seconds)",
        });
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
      
      // Process earnings after ad completion
      const response = await fetch('/api/watch-ad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });

      if (response.ok) {
        const updatedUser = await response.json();
        localStorage.setItem('lighting_sats_user', JSON.stringify(updatedUser));
        toast({
          title: "Great job!",
          description: `You earned ${updatedUser.earnedAmount} Sats!`,
        });
        onRefresh();
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.error || "Failed to process ad reward",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Ad error:', error);
      toast({
        title: "Ad Error",
        description: "There was an issue with the ad. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsWatchingAd(false);
    }
  };



  // Fetch app settings for dynamic earnings display
  const { data: settings } = useQuery({
    queryKey: ['/api/admin/settings'],
    queryFn: async () => {
      const response = await fetch('/api/admin/settings');
      return response.json();
    },
  });

  const dailyAdsWatched = user?.dailyAdsWatched || 0;
  const dailyLimit = settings?.dailyAdLimit || 250;
  const canWatchAd = cooldown === 0 && !isWatchingAd && dailyAdsWatched < dailyLimit;

  return (
    <div className="space-y-4">
      {/* Attractive Header */}
      <div className="text-center bg-gradient-to-r from-primary/20 via-secondary/20 to-accent/20 p-4 rounded-xl relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-accent/5 animate-pulse"></div>
        <div className="relative">
          <div className="text-4xl font-bold bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent mb-2">
            💰 EARN SATS! 💰
          </div>
          <div className="text-lg font-bold text-accent mb-1">{settings ? parseFloat(settings.baseEarningsPerAd || "0.01").toFixed(3) : (localStorage.getItem('admin_settings_cache') ? parseFloat(JSON.parse(localStorage.getItem('admin_settings_cache') || '{}').baseEarningsPerAd || "0.01").toFixed(3) : "0.01")} Sats per Ad</div>
          <div className="text-sm text-muted-foreground">Watch ads and earn instantly!</div>
        </div>
        <div className="absolute top-2 right-2 text-2xl animate-bounce">⚡</div>
        <div className="absolute bottom-2 left-2 text-xl animate-pulse">🎯</div>
      </div>

      {/* Big Attractive Watch Button */}
      <Button
        onClick={handleWatchAd}
        disabled={!canWatchAd}
        className="w-full bg-orange-500 hover:bg-orange-600 font-bold rounded-xl h-16 text-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 text-white"
      >
        {isWatchingAd ? (
          <div className="flex items-center gap-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white" />
            <span>Watching Ad...</span>
          </div>
        ) : cooldown > 0 ? (
          <span>Wait {cooldown}s</span>
        ) : dailyAdsWatched >= dailyLimit ? (
          <span>Daily Limit Reached</span>
        ) : (
          <div className="flex items-center gap-3">
            <Play className="h-6 w-6" />
            <span>WATCH TO EARN</span>
          </div>
        )}
      </Button>

      {/* Daily Limit - Small display under button */}
      <div className="text-center text-xs text-muted-foreground">
        Daily: {dailyAdsWatched} / {dailyLimit} ads
      </div>

      {/* Earning Info */}
      <div className="bg-gradient-to-r from-success/10 to-accent/10 p-3 rounded-xl border border-success/20">
        <div className="text-center">
          <div className="text-sm font-medium text-foreground mb-1">💡 Simple & Easy!</div>
          <div className="text-xs text-muted-foreground">Just click → Watch ad → Earn Sats!</div>
        </div>
      </div>
    </div>
  );
}

// Daily Streak Modal Content  
function DailyStreakModal({ user, onRefresh }: { user: User; onRefresh?: () => void }) {
  const [hasClaimedChannel, setHasClaimedChannel] = useState(false);
  const { toast } = useToast();
  
  // Get user streak data
  const { data: streakData } = useQuery({
    queryKey: ['/api/user-streak', user.id],
    queryFn: async () => {
      const response = await fetch(`/api/user-streak?userId=${user.id}`);
      if (!response.ok) return { currentStreak: 0, multiplier: "0.000", canClaim: true };
      return response.json();
    },
  });

  // Get app settings for dynamic earnings display
  const { data: settings } = useQuery({
    queryKey: ['/api/admin/settings'],
    queryFn: async () => {
      const response = await fetch('/api/admin/settings');
      return response.json();
    },
  });
  
  const currentStreak = streakData?.currentStreak || 0;
  const multiplier = (2.000 + parseFloat(streakData?.multiplier || "0")).toFixed(3);
  const canClaim = streakData?.canClaim !== false; // Default to true if no data
  
  // Claim daily streak mutation
  const claimStreakMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/claim-daily-streak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to claim daily bonus');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      // Refresh streak data
      queryClient.invalidateQueries({ queryKey: ['/api/user-streak'] });
      
      if (onRefresh) {
        onRefresh();
      }
      
      toast({
        title: "Daily Bonus Claimed!",
        description: `Streak day ${data.streak}! You earned +${data.bonusAmount} Sats and +${data.multiplier}× multiplier!`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  const handleClaimDaily = async () => {
    if (!canClaim || claimStreakMutation.isPending) return;
    
    try {
      // Show rewarded popup ad for streak claiming
      if (window.show_9368336) {
        window.show_9368336('pop');
      }
      
      // Claim the daily streak
      claimStreakMutation.mutate();
      
    } catch (error) {
      console.error('Streak ad error:', error);
      // Still try to claim even if ad fails
      claimStreakMutation.mutate();
    }
  };

  const handleClaimChannelTask = async () => {
    try {
      // Show rewarded popup ad for channel task
      if (window.show_9368336) {
        window.show_9368336('pop');
      }
      
      setHasClaimedChannel(true);
      toast({
        title: "Channel Task Completed!",
        description: "You earned +1 Sats for joining our channel!",
      });
    } catch (error) {
      console.error('Channel task ad error:', error);
      setHasClaimedChannel(true);
      toast({
        title: "Channel Task Completed!",
        description: "You earned +1 Sats for joining our channel!",
      });
    }
  };
  
  return (
    <div className="space-y-6">
      <div className="text-center space-y-4">
        <div>
          <div className="text-4xl font-bold text-secondary mb-2">{currentStreak}</div>
          <div className="text-sm text-muted-foreground">Day Streak</div>
        </div>
        
        <div className="bg-muted/10 p-4 rounded-xl space-y-3">
          <div className="flex justify-between">
            <span className="text-foreground">Current Multiplier:</span>
            <span className="text-accent font-bold">+{multiplier}×</span>
          </div>
          <div className="flex justify-between">
            <span className="text-foreground">Earning per Ad:</span>
            <span className="text-primary font-bold">{(parseFloat(settings?.baseEarningsPerAd || "0.01") + parseFloat(multiplier || "0")).toFixed(3)} Sats</span>
          </div>
        </div>
        
        <div className="text-xs text-muted-foreground space-y-1">
          <p>Each day adds +0.002× multiplier</p>
          <p>Applies to all ad earnings</p>
          <p>Miss a day = streak resets</p>
        </div>
      </div>
      
      <Button
        onClick={handleClaimDaily}
        disabled={!canClaim || claimStreakMutation.isPending}
        className="w-full bg-secondary hover:bg-secondary/90 font-bold rounded-xl h-12"
      >
        {claimStreakMutation.isPending ? "Claiming..." : !canClaim ? "Come back tomorrow" : "Claim Daily Bonus (+1 Sat)"}
      </Button>
      
      {/* Channel Task */}
      <div className="bg-muted/10 p-3 rounded-xl flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-sm font-medium text-foreground">Join Official Channel</span>
          <span className="text-xs text-accent font-bold">+1 Sats</span>
        </div>
        <Button
          onClick={() => {
            window.open('https://t.me/LightingSats', '_blank');
            handleClaimChannelTask();
          }}
          disabled={hasClaimedChannel}
          className="bg-primary hover:bg-primary/90 text-black font-bold rounded-lg h-8 px-3 text-xs"
        >
          {hasClaimedChannel ? "Claimed ✓" : "Claim"}
        </Button>
      </div>
      
      <div className="bg-gradient-to-r from-secondary/20 to-primary/20 p-4 rounded-xl">
        <div className="text-center">
          <div className="text-sm font-medium text-foreground mb-2">Keep your streak alive!</div>
          <div className="text-xs text-muted-foreground">Login daily to maintain your earning multiplier</div>
        </div>
      </div>
    </div>
  );
}

// Challenge Modal Content
function ChallengeModal({ user }: { user: User }) {
  const [claimedRewards, setClaimedRewards] = useState<number[]>([]);
  const { toast } = useToast();
  
  // Get user streak data
  const { data: streakData } = useQuery({
    queryKey: ['/api/user-streak', user.id],
    queryFn: async () => {
      const response = await fetch(`/api/user-streak?userId=${user.id}`);
      if (!response.ok) return { currentStreak: 0, multiplier: "0.000", canClaim: true };
      return response.json();
    },
  });
  
  const streakDay = streakData?.currentStreak || 0;
  const nextMilestone = streakDay < 10 ? 10 : streakDay < 20 ? 20 : 30;
  
  const challenges = [
    { days: 10, reward: '1-1,000 Sats', status: 'Login for claim 1 day' },
    { days: 20, reward: '1-2,000 Sats', status: 'Login for claim 1 day' },
    { days: 30, reward: '1-3,000 Sats', status: 'Login for claim 1 day' }
  ];
  
  const handleClaimReward = async (challengeDays: number) => {
    if (streakDay < challengeDays || claimedRewards.includes(challengeDays)) return;
    
    try {
      // Show rewarded popup ad for challenge reward
      if (window.show_9368336) {
        // Simplified ad call
        window.show_9368336('pop');
      }
      
      setClaimedRewards(prev => [...prev, challengeDays]);
      const randomReward = Math.floor(Math.random() * (challengeDays * 100)) + 1;
      toast({
        title: "Challenge Completed!",
        description: `You earned ${randomReward} Sats reward!`,
      });
    } catch (error) {
      console.error('Challenge ad error:', error);
      // Still allow claiming even if ad fails
      setClaimedRewards(prev => [...prev, challengeDays]);
      const randomReward = Math.floor(Math.random() * (challengeDays * 100)) + 1;
      toast({
        title: "Challenge Completed!",
        description: `You earned ${randomReward} Sats reward!`,
      });
    }
  };
  
  return (
    <div className="space-y-4 max-h-[70vh] overflow-hidden">
      {/* Header - Fixed */}
      <div className="text-center">
        <div className="text-2xl font-bold text-accent mb-1">Day {streakDay}</div>
        <div className="text-xs text-muted-foreground">Challenge Progress</div>
      </div>
      
      {/* Challenge List - Compact */}
      <div className="bg-muted/10 p-3 rounded-xl space-y-3">
        {challenges.map((challenge, index) => (
          <div key={challenge.days} className="bg-card/50 p-3 rounded-lg">
            <div className="flex justify-between items-start mb-2">
              <div className="flex flex-col">
                <span className="text-sm font-bold text-foreground">{challenge.days} Days</span>
                <span className="text-xs text-accent font-bold">{challenge.reward}</span>
              </div>
              {streakDay >= challenge.days ? (
                <Button
                  size="sm"
                  onClick={() => handleClaimReward(challenge.days)}
                  disabled={claimedRewards.includes(challenge.days)}
                  className="bg-accent hover:bg-accent/90 text-black px-3 py-1 text-xs font-bold"
                >
                  {claimedRewards.includes(challenge.days) ? "Claimed ✓" : "Claim"}
                </Button>
              ) : (
                <div className="text-xs text-muted-foreground bg-muted/30 px-3 py-1 rounded-full">
                  {Math.max(0, challenge.days - streakDay)} days left
                </div>
              )}
            </div>
            <div className="text-xs text-muted-foreground">{challenge.status}</div>
          </div>
        ))}
      </div>
      
      {/* Progress Bar - Compact */}
      <div className="bg-muted/10 p-3 rounded-xl">
        <div className="text-xs text-muted-foreground mb-2">Next milestone: {nextMilestone} days</div>
        <div className="w-full bg-card rounded-full h-2">
          <div 
            className="bg-gradient-to-r from-accent to-primary h-2 rounded-full transition-all duration-300"
            style={{ width: `${(streakDay / nextMilestone) * 100}%` }}
          />
        </div>
        <div className="text-xs text-muted-foreground mt-1">{Math.max(0, nextMilestone - streakDay)} days to go</div>
      </div>
      
      {/* Info - Compact */}
      <div className="text-center text-xs text-muted-foreground bg-muted/10 p-2 rounded-xl">
        <div>Complete daily challenges to unlock rewards!</div>
      </div>
    </div>
  );
}

// Affiliates Modal Content
function AffiliatesModal({ user, onRefresh }: { user: User; onRefresh?: () => void }) {
  const { toast } = useToast();

  const { data: referrals = [] } = useQuery({
    queryKey: ['/api/referrals', user.id],
    queryFn: async () => {
      const response = await fetch(`/api/referrals?userId=${user.id}`);
      return response.json();
    },
  });

  const copyReferralCode = async () => {
    try {
      // Show rewarded popup ad for sharing referral code
      if (window.show_9368336) {
        try {
          // Simplified ad call without await since it's async
          window.show_9368336('pop');
          
          toast({
            title: "Share Bonus Earned!",
            description: "You earned +0.5 Sats for sharing!",
          });
        } catch (adError) {
          console.error('Share ad error:', adError);
        }
      }
      
      // Try modern clipboard API first
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(user.personalCode);
      } else {
        // Fallback for older browsers or non-HTTPS
        const textArea = document.createElement('textarea');
        textArea.value = user.personalCode;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        textArea.remove();
      }
      
      toast({
        title: "Copied!",
        description: "Personal code copied to clipboard",
      });
    } catch (error) {
      console.error('Copy error:', error);
      // Final fallback - show the code in a prompt for manual copy
      const userAgent = navigator.userAgent.toLowerCase();
      if (userAgent.includes('mobile') || userAgent.includes('android') || userAgent.includes('iphone')) {
        // On mobile, show a toast with the code
        toast({
          title: "Copy Failed",
          description: `Please manually copy: ${user.personalCode}`,
          duration: 8000,
        });
      } else {
        // On desktop, show prompt
        prompt('Copy this personal code manually:', user.personalCode);
        toast({
          title: "Manual Copy",
          description: "Personal code displayed for manual copying",
        });
      }
    }
  };

  const totalCommission = referrals.reduce((sum: number, ref: any) => sum + parseFloat(ref.commission || "0"), 0);

  // Mutation for claiming commission
  const claimCommissionMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/claim-commission', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: user.id }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to claim commission');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      // Invalidate user data and referrals to refresh balances
      queryClient.invalidateQueries({ queryKey: ['/api/referrals'] });
      
      // Refresh the main user interface
      if (onRefresh) {
        onRefresh();
      }
      
      toast({
        title: "Commission Claimed!",
        description: `You earned +${data.claimedAmount} Sats commission!`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleClaimCommission = async () => {
    if (totalCommission <= 0 || referrals.length === 0) {
      toast({
        title: "No Commission Available",
        description: "You need to refer someone first to earn commission!",
        variant: "destructive"
      });
      return;
    }

    try {
      // Show rewarded popup ad for commission claiming
      if (window.show_9368336) {
        window.show_9368336('pop');
      }
      
      // Actually claim the commission via API
      claimCommissionMutation.mutate();
      
    } catch (error) {
      console.error('Commission ad error:', error);
      // Still try to claim even if ad fails
      claimCommissionMutation.mutate();
    }
  };

  return (
    <div className="space-y-4 max-h-[70vh] overflow-hidden">
      {/* Header - Fixed */}
      <div className="text-center">
        <div className="text-xl font-bold text-primary mb-1">10% Commission</div>
        <div className="text-xs text-muted-foreground">Earn from every referral</div>
      </div>
      
      {/* Personal Code - Fixed */}
      <div className="bg-muted/10 p-3 rounded-xl">
        <div className="text-center">
          <div className="text-xs text-muted-foreground mb-2">Your Personal Code</div>
          <div className="text-base font-mono font-bold text-foreground mb-2 bg-card p-2 rounded-lg border">
            {user.personalCode}
          </div>
          <Button
            onClick={copyReferralCode}
            className="w-full bg-secondary hover:bg-secondary/90 rounded-xl h-9 flex items-center gap-2 text-sm"
          >
            <Copy className="h-3 w-3" />
            Copy Code
          </Button>
        </div>
      </div>

      {/* Stats - Fixed */}
      <div className="grid grid-cols-2 gap-3">
        <div className="text-center bg-muted/10 p-2 rounded-xl">
          <div className="text-xl font-bold text-foreground">{referrals.length}</div>
          <div className="text-xs text-muted-foreground">Total Referrals</div>
        </div>
        <div className="text-center bg-muted/10 p-2 rounded-xl">
          <div className="text-xl font-bold text-accent">{totalCommission.toFixed(2)}</div>
          <div className="text-xs text-muted-foreground">Sats Earned</div>
          <Button
            onClick={handleClaimCommission}
            disabled={totalCommission <= 0 || referrals.length === 0 || claimCommissionMutation.isPending}
            className="w-full mt-2 bg-success hover:bg-success/90 font-bold rounded-lg h-8 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {claimCommissionMutation.isPending ? "Claiming..." : totalCommission <= 0 ? "No Commission Yet" : "Claim Commission"}
          </Button>
        </div>
      </div>

      {/* Referrals List - Scrollable */}
      {referrals.length > 0 && (
        <div className="bg-muted/10 rounded-xl overflow-hidden">
          <div className="p-3 border-b border-muted/20">
            <div className="text-sm font-medium text-foreground">Referrals List:</div>
          </div>
          <div className="max-h-32 overflow-y-auto scrollbar-thin">
            <div className="p-3 space-y-2">
              {referrals.map((ref: any, index: number) => (
                <div key={ref.id} className="flex justify-between items-center text-xs bg-card/50 p-2 rounded-lg">
                  <div className="flex flex-col">
                    <span className="text-foreground font-medium">{ref.refereeEmail}</span>
                    <span className="text-muted-foreground text-xs">User #{index + 1}</span>
                  </div>
                  <span className="text-accent font-bold">+{ref.commission} sats</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Info - Fixed */}
      <div className="text-center text-xs text-muted-foreground bg-muted/10 p-2 rounded-xl">
        <div>Share your code and earn 10% commission!</div>
      </div>
    </div>
  );
}

// Sats Converter Modal Content
function SatsConverterModal() {
  const [satsAmount, setSatsAmount] = useState("");
  const [usdAmount, setUsdAmount] = useState("");
  const [btcPrice, setBtcPrice] = useState(0);
  const { toast } = useToast();

  // Fetch Bitcoin price for conversion
  useEffect(() => {
    const fetchBtcPrice = async () => {
      try {
        const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
        const data = await response.json();
        setBtcPrice(data.bitcoin.usd);
      } catch (error) {
        console.error('Failed to fetch BTC price:', error);
        setBtcPrice(60000); // Fallback price
      }
    };

    fetchBtcPrice();
  }, []);

  const convertSatsToUsd = (sats: string) => {
    if (!sats || !btcPrice) return "";
    const satsNum = parseFloat(sats);
    const btcAmount = satsNum / 100000000; // 1 BTC = 100,000,000 sats
    const usdValue = btcAmount * btcPrice;
    return usdValue.toFixed(6);
  };

  const convertUsdToSats = (usd: string) => {
    if (!usd || !btcPrice) return "";
    const usdNum = parseFloat(usd);
    const btcAmount = usdNum / btcPrice;
    const satsValue = btcAmount * 100000000;
    return Math.floor(satsValue).toString();
  };

  const handleSatsChange = (value: string) => {
    setSatsAmount(value);
    setUsdAmount(convertSatsToUsd(value));
  };

  const handleUsdChange = (value: string) => {
    setUsdAmount(value);
    setSatsAmount(convertUsdToSats(value));
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="text-sm text-muted-foreground mb-2">
          Bitcoin Price: ${btcPrice.toLocaleString()}
        </div>
      </div>

      {/* Sats to USD */}
      <div>
        <Label htmlFor="sats-input" className="text-foreground text-sm font-medium">Satoshis</Label>
        <Input
          id="sats-input"
          type="number"
          value={satsAmount}
          onChange={(e) => handleSatsChange(e.target.value)}
          placeholder="Enter sats amount"
          className="mt-2 rounded-xl h-12 px-4"
        />
      </div>

      <div className="text-center">
        <div className="text-2xl">⇅</div>
      </div>

      {/* USD to Sats */}
      <div>
        <Label htmlFor="usd-input" className="text-foreground text-sm font-medium">USD</Label>
        <Input
          id="usd-input"
          type="number"
          step="0.000001"
          value={usdAmount}
          onChange={(e) => handleUsdChange(e.target.value)}
          placeholder="Enter USD amount"
          className="mt-2 rounded-xl h-12 px-4"
        />
      </div>

      {/* Info */}
      <div className="bg-muted/10 p-3 rounded-xl text-xs text-muted-foreground text-center">
        <div>1 Bitcoin = 100,000,000 Satoshis</div>
        <div>Prices are live from CoinGecko</div>
      </div>
    </div>
  );
}

// Cashout Modal Content
function CashoutModal({ user }: { user: User }) {
  const [amount, setAmount] = useState("");
  const [lightningAddress, setLightningAddress] = useState("");
  const [name, setName] = useState("");
  const [telegramUsername, setTelegramUsername] = useState("");
  const { toast } = useToast();

  // Fetch app settings for withdrawal validation
  const { data: settings } = useQuery({
    queryKey: ['/api/admin/settings'],
    queryFn: async () => {
      const response = await fetch('/api/admin/settings');
      return response.json();
    },
  });

  // Fetch withdrawal history
  const { data: withdrawalHistory = [] } = useQuery({
    queryKey: ['/api/withdrawals', user.id],
    queryFn: async () => {
      const response = await fetch(`/api/withdrawals?userId=${user.id}`);
      return response.json();
    },
  });

  // Calculate pending withdrawals
  const pendingWithdrawals = withdrawalHistory
    .filter((w: any) => w.status === 'pending')
    .reduce((total: number, w: any) => total + parseFloat(w.amount || "0"), 0);

  // Calculate available balance (total balance minus pending withdrawals)
  const totalBalance = parseFloat(user.withdrawBalance || "0");
  const availableBalance = totalBalance - pendingWithdrawals;

  const withdrawMutation = useMutation({
    mutationFn: async (data: { userId: string; amount: string; lightningAddress: string; telegramUsername: string }) => {
      const response = await fetch('/api/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Withdrawal failed');
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate withdrawal history to show the new request immediately
      queryClient.invalidateQueries({ queryKey: ['/api/withdrawals', user.id] });
      
      toast({
        title: "Withdrawal Requested!",
        description: "Your withdrawal request has been submitted for processing.",
      });
      setAmount("");
      setLightningAddress("");
      setName("");
      setTelegramUsername("");
    },
    onError: (error: Error) => {
      toast({
        title: "Withdrawal Failed",
        description: error.message,
        variant: "destructive"
      });
    },
  });

  const handleWithdraw = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!amount || !lightningAddress || !telegramUsername) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    const withdrawAmount = parseFloat(amount);
    const adsWatched = user.adsWatched || 0;
    
    // Get dynamic settings for validation
    const minAdsRequired = settings?.minAdsForWithdrawal || 500;
    const minWithdrawal = parseFloat(settings?.minWithdrawal || "2500");
    
    // Ads requirement
    if (adsWatched < minAdsRequired) {
      toast({
        title: "Error",
        description: `You need to watch ${minAdsRequired - adsWatched} more ads. Minimum ${minAdsRequired} ads required for withdrawal.`,
        variant: "destructive"
      });
      return;
    }

    // Minimum withdrawal amount
    if (withdrawAmount < minWithdrawal) {
      toast({
        title: "Error",
        description: `Minimum withdrawal amount is ${minWithdrawal.toLocaleString()} sats`,
        variant: "destructive"
      });
      return;
    }

    if (withdrawAmount <= 0) {
      toast({
        title: "Error",
        description: "Withdrawal amount must be greater than 0",
        variant: "destructive"
      });
      return;
    }

    // Check available balance (after pending withdrawals)
    if (withdrawAmount > availableBalance) {
      toast({
        title: "Error",
        description: `Insufficient available balance. You have ${availableBalance.toLocaleString()} sats available (${pendingWithdrawals.toLocaleString()} sats pending withdrawal)`,
        variant: "destructive"
      });
      return;
    }

    // TEMPORARY: Balance check disabled for testing
    // if (withdrawAmount > parseFloat(user.withdrawBalance || "0")) {
    //   toast({
    //     title: "Error",
    //     description: "Insufficient balance",
    //     variant: "destructive"
    //   });
    //   return;
    // }

    withdrawMutation.mutate({
      userId: user.id,
      amount,
      lightningAddress,
      telegramUsername,
    });
  };

  const balance = parseFloat(user.withdrawBalance || "0");
  const adsWatched = user.adsWatched || 0;
  // TEMPORARY: All withdrawal restrictions disabled for testing
  const canWithdraw = true; // adsWatched >= 500 && balance >= 2500;

  return (
    <div className="space-y-6">
      {/* Balance Display */}
      <div className="text-center">
        <div className="text-3xl font-bold text-success mb-2">{balance.toLocaleString()}</div>
        <div className="text-sm text-muted-foreground">Available Balance</div>
      </div>

      {/* Simple Withdrawal Form */}
      <form onSubmit={handleWithdraw} className="space-y-4">
        <div>
          <Label htmlFor="telegramUsername" className="text-foreground text-sm font-medium">Telegram Username</Label>
          <Input
            id="telegramUsername"
            type="text"
            value={telegramUsername}
            onChange={(e) => setTelegramUsername(e.target.value)}
            placeholder="@yourusername"
            className="mt-2 rounded-xl h-12 px-4"
            disabled={withdrawMutation.isPending}
          />
        </div>

        <div>
          <Label htmlFor="lightningAddress" className="text-foreground text-sm font-medium">Wallet Address</Label>
          <Input
            id="lightningAddress"
            type="text"
            value={lightningAddress}
            onChange={(e) => setLightningAddress(e.target.value)}
            placeholder="user@wallet.com or BTC Lightning address"
            className="mt-2 rounded-xl h-12 px-4"
            disabled={withdrawMutation.isPending}
          />
          {!user.email.includes('@gmail.com') && (
            <div className="mt-2 text-xs text-muted-foreground">
              Don't have a lightning wallet? 
              <Button
                type="button"
                variant="link"
                onClick={() => window.open('https://links.speed.app/referral?referral_code=CH265L', '_blank')}
                className="p-0 h-auto text-primary underline text-xs ml-1"
              >
                Create your lightning wallet
              </Button>
            </div>
          )}
        </div>

        <div>
          <Label htmlFor="amount" className="text-foreground text-sm font-medium">Amount (Sats)</Label>
          <Input
            id="amount"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Enter amount"
            className="mt-2 rounded-xl h-12 px-4"
            disabled={withdrawMutation.isPending}
          />
        </div>

        <Button
          type="submit"
          disabled={withdrawMutation.isPending || !amount || !lightningAddress || !telegramUsername}
          className="w-full bg-success hover:bg-success/90 font-bold rounded-xl h-12"
        >
          {withdrawMutation.isPending ? "Processing..." : "Submit Request"}
        </Button>
      </form>

      {/* Withdrawal History */}
      {withdrawalHistory.length > 0 && (
        <div className="bg-muted/10 p-4 rounded-xl">
          <h3 className="text-sm font-medium text-foreground mb-3">Withdrawal History</h3>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {withdrawalHistory.slice(0, 5).map((withdrawal: any, index: number) => (
              <div key={withdrawal.id} className="flex justify-between items-center text-xs bg-card/50 p-2 rounded-lg">
                <div className="flex flex-col">
                  <span className="text-foreground font-medium">{parseFloat(withdrawal.amount).toLocaleString()} Sats</span>
                  <span className="text-muted-foreground">{new Date(withdrawal.createdAt).toLocaleDateString()}</span>
                </div>
                <span className={`font-bold px-2 py-1 rounded-full text-xs ${
                  withdrawal.status === 'completed' ? 'text-success bg-success/10' :
                  withdrawal.status === 'pending' ? 'text-warning bg-warning/10' :
                  'text-destructive bg-destructive/10'
                }`}>
                  {withdrawal.status === 'completed' ? '✅ Paid' :
                   withdrawal.status === 'pending' ? '⏳ Pending' :
                   '❌ Failed'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Main Dashboard
function MainApp({ user, onLogout, canLogout, onSwitchToAdmin, isAdmin }: { user: User; onLogout: () => void; canLogout: boolean; onSwitchToAdmin?: () => void; isAdmin?: boolean }) {
  const [activeModal, setActiveModal] = useState<string | null>(null);

  // Fetch withdrawal data for balance calculation
  const { data: withdrawalHistory = [] } = useQuery({
    queryKey: ['/api/withdrawals', user.id],
    queryFn: async () => {
      const response = await fetch(`/api/withdrawals?userId=${user.id}`);
      return response.json();
    },
  });

  // Calculate pending withdrawals and available balance
  const pendingWithdrawals = withdrawalHistory
    .filter((w: any) => w.status === 'pending')
    .reduce((total: number, w: any) => total + parseFloat(w.amount || "0"), 0);

  const totalBalance = parseFloat(user.withdrawBalance || "0");
  const availableBalance = totalBalance - pendingWithdrawals;

  const refreshUser = () => {
    window.location.reload();
  };

  const openModal = (modalName: string) => {
    setActiveModal(modalName);
  };

  const closeModal = () => {
    setActiveModal(null);
  };

  return (
    <div className="min-h-screen bg-background fixed inset-0 overflow-hidden">
      <div className="max-w-sm mx-auto h-full overflow-y-auto p-4 space-y-2">
        {/* Header */}
        <div className="text-center pt-2 pb-1">
          <h1 className="text-3xl font-bold text-primary mb-1">Lighting Sats</h1>
          <div className="flex justify-center gap-2 mb-1">
            {isAdmin && onSwitchToAdmin && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={onSwitchToAdmin}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Admin Dashboard
              </Button>
            )}
            {canLogout && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={onLogout}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Admin Logout
              </Button>
            )}
          </div>
        </div>

        {/* Balance Display */}
        <Card className="p-6 bg-gradient-to-br from-primary/30 via-secondary/20 to-accent/30 border-primary/40 rounded-2xl shadow-2xl relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-accent/10 animate-pulse"></div>
          <div className="relative text-center">
            <div className="text-3xl font-bold bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent mb-2">
              {availableBalance.toLocaleString()}
            </div>
            <div className="text-base font-semibold text-foreground bg-gradient-to-r from-primary/20 to-accent/20 px-3 py-1 rounded-full mb-2">
              Available Balance
            </div>
            {pendingWithdrawals > 0 && (
              <div className="text-sm text-muted-foreground bg-warning/10 px-2 py-1 rounded-full">
                {pendingWithdrawals.toLocaleString()} sats pending withdrawal
              </div>
            )}
          </div>
          <div className="absolute top-2 right-2 text-2xl animate-bounce">⚡</div>
          <div className="absolute bottom-2 left-2 text-xl animate-pulse">💰</div>
        </Card>

        {/* Dashboard Sections */}
        <div className="space-y-1">
          {/* Streak and Affiliates (Side by Side) */}
          <div className="grid grid-cols-2 gap-3">
            <Card 
              className="p-3 cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-lg bg-gradient-to-r from-secondary/10 to-secondary/20 border-secondary/30 rounded-xl"
              onClick={() => openModal('streak')}
            >
              <div className="flex flex-col items-center space-y-2">
                <div className="p-2 bg-secondary/20 rounded-full">
                  <Zap className="h-4 w-4 text-secondary" />
                </div>
                <h3 className="text-sm font-semibold text-foreground text-center">Streak</h3>
              </div>
            </Card>

            <Card 
              className="p-3 cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-lg bg-gradient-to-r from-success/10 to-success/20 border-success/30 rounded-xl"
              onClick={() => openModal('affiliates')}
            >
              <div className="flex flex-col items-center space-y-2">
                <div className="p-2 bg-success/20 rounded-full">
                  <Users className="h-4 w-4 text-success" />
                </div>
                <h3 className="text-sm font-semibold text-foreground text-center">Affiliates</h3>
              </div>
            </Card>
          </div>

          {/* Watch to Earn - Highlighted and moved above challenges */}
          <Card 
            className="p-5 cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-xl bg-gradient-to-r from-primary/20 to-yellow/30 border-primary/50 rounded-xl shadow-lg ring-2 ring-primary/20"
            onClick={() => openModal('watch')}
          >
            <div className="flex items-center justify-center">
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-primary/30 rounded-full animate-pulse">
                  <Play className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-bold text-foreground">Watch to Earn</h3>
              </div>
            </div>
          </Card>

          {/* Challenges */}
          <Card 
            className="p-4 cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-lg bg-gradient-to-r from-accent/10 to-accent/20 border-accent/30 rounded-xl"
            onClick={() => openModal('challenge')}
          >
            <div className="flex items-center justify-center">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-accent/20 rounded-full">
                  <Trophy className="h-5 w-5 text-accent" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">Challenges</h3>
              </div>
            </div>
          </Card>

          {/* Cashout */}
          <Card 
            className="p-4 cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-lg bg-gradient-to-r from-success/10 to-accent/10 border-success/30 rounded-xl"
            onClick={() => openModal('cashout')}
          >
            <div className="flex items-center justify-center">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-success/20 rounded-full">
                  <Wallet className="h-5 w-5 text-success" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">Cashout</h3>
              </div>
            </div>
          </Card>

          {/* Support & Sats Converter - Grouped together */}
          <div className="bg-muted/10 p-3 rounded-xl space-y-3">
            <Button
              onClick={() => window.open('https://t.me/szxzyz', '_blank')}
              variant="outline"
              className="w-full rounded-xl h-10 flex items-center gap-2 text-sm"
            >
              <ExternalLink className="h-4 w-4" />
              Support
            </Button>
            
            <Button
              onClick={() => openModal('converter')}
              variant="outline"
              className="w-full rounded-xl h-10 flex items-center gap-2 text-sm"
            >
              <Wallet className="h-4 w-4" />
              Sats Converter
            </Button>
          </div>
        </div>
      </div>

      {/* Modals */}
      <Modal isOpen={activeModal === 'watch'} onClose={closeModal} title="Watch to Earn">
        <WatchToEarnModal user={user} onRefresh={refreshUser} />
      </Modal>

      <Modal isOpen={activeModal === 'streak'} onClose={closeModal} title="Daily Streak">
        <DailyStreakModal user={user} onRefresh={refreshUser} />
      </Modal>

      <Modal isOpen={activeModal === 'challenge'} onClose={closeModal} title="Challenges">
        <ChallengeModal user={user} />
      </Modal>

      <Modal isOpen={activeModal === 'affiliates'} onClose={closeModal} title="Affiliates">
        <AffiliatesModal user={user} onRefresh={refreshUser} />
      </Modal>

      <Modal isOpen={activeModal === 'cashout'} onClose={closeModal} title="Cashout">
        <CashoutModal user={user} />
      </Modal>

      <Modal isOpen={activeModal === 'converter'} onClose={closeModal} title="Sats Converter">
        <SatsConverterModal />
      </Modal>

      {/* Music Player - Floating (only controls for admin, always background music) */}
      <MusicPlayer isAdmin={isAdmin} />
    </div>
  );
}

// Music Player Component - Background music for all, controls only for admins
function MusicPlayer({ isAdmin }: { isAdmin?: boolean }) {
  const [currentSong, setCurrentSong] = useState<any>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMinimized, setIsMinimized] = useState(true); // Start minimized for background play
  const audioRef = useRef<HTMLAudioElement>(null);

  // Fetch music settings for music controls (public access)
  const { data: settings } = useQuery({
    queryKey: ['/api/music/settings'],
    queryFn: async () => {
      const response = await fetch('/api/music/settings');
      return response.json();
    },
    refetchInterval: 5000, // Check for settings updates every 5 seconds
  });

  // Fetch active songs
  const { data: songs = [] } = useQuery({
    queryKey: ['/api/songs'],
    queryFn: async () => {
      const response = await fetch('/api/songs');
      return response.json();
    },
    refetchInterval: 10000, // Check for new songs every 10 seconds
  });

  // Play count mutation
  const playCountMutation = useMutation({
    mutationFn: async (songId: string) => {
      const response = await fetch(`/api/songs/${songId}/play`, {
        method: 'POST',
      });
      return response.json();
    },
  });

  // Auto-start music when songs are available - aggressive auto-play
  useEffect(() => {
    if (songs.length > 0 && !currentSong) {
      const firstSong = songs[0];
      setCurrentSong(firstSong);
      setCurrentIndex(0);
      console.log('Setting first song:', firstSong.title, 'by', firstSong.artist);
      
      // Immediately try to start playing with multiple strategies
      setTimeout(() => {
        if (audioRef.current) {
          // Set volume to maximum
          audioRef.current.volume = 1.0;
          console.log('Attempting to auto-start music:', firstSong.title);
          
          // Strategy 1: Direct play attempt
          audioRef.current.play().then(() => {
            setIsPlaying(true);
            playCountMutation.mutate(firstSong.id);
            console.log('✅ Music auto-started successfully:', firstSong.title);
          }).catch((error) => {
            console.log('❌ Browser blocked autoplay:', error.message);
            
            // Strategy 2: Add click listener to start music on any user interaction
            const startOnInteraction = () => {
              if (audioRef.current) {
                audioRef.current.play().then(() => {
                  setIsPlaying(true);
                  playCountMutation.mutate(firstSong.id);
                  console.log('✅ Music started after user interaction:', firstSong.title);
                  // Remove the listener once music starts
                  document.removeEventListener('click', startOnInteraction);
                  document.removeEventListener('touchstart', startOnInteraction);
                  document.removeEventListener('keydown', startOnInteraction);
                }).catch(() => {
                  console.log('Still failed to start music after interaction');
                });
              }
            };
            
            // Listen for any user interaction to start music
            document.addEventListener('click', startOnInteraction);
            document.addEventListener('touchstart', startOnInteraction);
            document.addEventListener('keydown', startOnInteraction);
            
            // Also try when page becomes visible/focused
            document.addEventListener('visibilitychange', startOnInteraction);
            window.addEventListener('focus', startOnInteraction);
            
            console.log('🎵 Music will start on first user interaction (click, touch, key press, or page focus)');
          });
        }
      }, 500);
    }
  }, [songs, currentSong]);

  // Set volume from admin settings
  useEffect(() => {
    if (audioRef.current && settings?.musicVolume !== undefined) {
      // Ensure volume is properly set (musicVolume should be 0-100, convert to 0-1)
      const volume = Math.max(0, Math.min(1, settings.musicVolume > 1 ? settings.musicVolume / 100 : settings.musicVolume));
      audioRef.current.volume = volume;
      console.log('Audio volume set to:', volume, 'from setting:', settings.musicVolume);
    }
  }, [settings?.musicVolume]);

  // Update time progress and add comprehensive audio debugging
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => {
      setCurrentTime(audio.currentTime);
      setDuration(audio.duration || 0);
    };

    const handleLoadedMetadata = () => {
      setDuration(audio.duration || 0);
      console.log('🎵 Audio metadata loaded:', {
        duration: audio.duration,
        src: audio.src,
        readyState: audio.readyState,
        networkState: audio.networkState
      });
    };

    const handleCanPlay = () => {
      console.log('🎵 Audio can play:', audio.src);
    };

    const handleCanPlayThrough = () => {
      console.log('🎵 Audio can play through:', audio.src);
    };

    const handlePlay = () => {
      setIsPlaying(true);
      console.log('▶️ Audio started playing:', currentSong?.title);
    };
    
    const handlePause = () => {
      setIsPlaying(false);
      console.log('⏸️ Audio paused:', currentSong?.title);
    };

    const handleError = (e: any) => {
      console.error('❌ Audio error:', e.target.error, 'for file:', audio.src);
    };

    const handleLoadStart = () => {
      console.log('📥 Audio load started:', audio.src);
    };

    const handleLoadedData = () => {
      console.log('📄 Audio data loaded:', audio.src);
    };

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('canplaythrough', handleCanPlayThrough);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('error', handleError);
    audio.addEventListener('loadstart', handleLoadStart);
    audio.addEventListener('loadeddata', handleLoadedData);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('canplaythrough', handleCanPlayThrough);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('loadstart', handleLoadStart);
      audio.removeEventListener('loadeddata', handleLoadedData);
    };
  }, [currentSong]);

  // Auto-advance to next song when current song ends
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleEnded = () => {
      if (songs.length === 0) return;
      
      let nextIndex;
      if (settings?.shuffleMode) {
        nextIndex = Math.floor(Math.random() * songs.length);
      } else {
        nextIndex = (currentIndex + 1) % songs.length;
      }
      
      const nextSong = songs[nextIndex];
      setCurrentSong(nextSong);
      setCurrentIndex(nextIndex);
      
      // Auto-play next song immediately to keep music playing continuously  
      setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.volume = 1.0; // Ensure volume is at maximum
          audioRef.current.play().then(() => {
            setIsPlaying(true);
            playCountMutation.mutate(nextSong.id);
            console.log('Next song auto-playing:', nextSong.title);
          }).catch(() => {
            console.log('Retrying next song play...');
            // Retry playing after short delay
            setTimeout(() => {
              if (audioRef.current) {
                audioRef.current.play().catch(console.error);
                setIsPlaying(true);
                playCountMutation.mutate(nextSong.id);
              }
            }, 1000);
          });
        }
      }, 100);
    };

    audio.addEventListener('ended', handleEnded);
    return () => audio.removeEventListener('ended', handleEnded);
  }, [currentIndex, songs, settings?.shuffleMode]);

  // Update current song when song list changes (admin adds/removes songs)
  useEffect(() => {
    if (songs.length > 0 && currentSong) {
      // Check if current song still exists in the active list
      const songExists = songs.find((song: any) => song.id === currentSong.id);
      if (!songExists) {
        // Current song was removed, switch to first available song
        const newSong = songs[0];
        setCurrentSong(newSong);
        setCurrentIndex(0);
        
        if (isPlaying) {
          setTimeout(() => {
            if (audioRef.current) {
              audioRef.current.volume = 1.0;
              audioRef.current.play().then(() => {
                playCountMutation.mutate(newSong.id);
                console.log('Switched to new song and continued playing:', newSong.title);
              }).catch(() => {
                // Retry if initial play fails
                setTimeout(() => {
                  if (audioRef.current) {
                    audioRef.current.play().catch(console.error);
                    playCountMutation.mutate(newSong.id);
                  }
                }, 1000);
              });
            }
          }, 200);
        }
      }
    }
  }, [songs, currentSong, isPlaying]);

  // Listen for admin control events
  useEffect(() => {
    const handleAdminPlaySong = (event: any) => {
      const { songId } = event.detail;
      const song = songs.find((s: any) => s.id === songId);
      if (song) {
        setCurrentSong(song);
        setCurrentIndex(songs.indexOf(song));
        setTimeout(() => {
          if (audioRef.current) {
            audioRef.current.play().catch(console.error);
            setIsPlaying(true);
            playCountMutation.mutate(songId);
          }
        }, 100);
      }
    };

    const handleAdminPauseMusic = () => {
      if (audioRef.current) {
        audioRef.current.pause();
        setIsPlaying(false);
      }
    };

    const handleAdminResumeMusic = () => {
      if (audioRef.current && currentSong) {
        audioRef.current.play().catch(console.error);
        setIsPlaying(true);
      }
    };

    const handleAdminSkipSong = () => {
      if (songs.length === 0) return;

      let nextIndex;
      if (settings?.shuffleMode) {
        nextIndex = Math.floor(Math.random() * songs.length);
      } else {
        nextIndex = (currentIndex + 1) % songs.length;
      }

      const nextSong = songs[nextIndex];
      setCurrentSong(nextSong);
      setCurrentIndex(nextIndex);

      if (audioRef.current) {
        setTimeout(() => {
          audioRef.current?.play().catch(console.error);
          setIsPlaying(true);
          playCountMutation.mutate(nextSong.id);
        }, 100);
      }
    };

    window.addEventListener('adminPlaySong', handleAdminPlaySong);
    window.addEventListener('adminPauseMusic', handleAdminPauseMusic);
    window.addEventListener('adminResumeMusic', handleAdminResumeMusic);
    window.addEventListener('adminSkipSong', handleAdminSkipSong);

    return () => {
      window.removeEventListener('adminPlaySong', handleAdminPlaySong);
      window.removeEventListener('adminPauseMusic', handleAdminPauseMusic);
      window.removeEventListener('adminResumeMusic', handleAdminResumeMusic);
      window.removeEventListener('adminSkipSong', handleAdminSkipSong);
    };
  }, [songs, currentSong, currentIndex, settings?.shuffleMode, playCountMutation]);

  // Music control functions
  const togglePlayPause = async () => {
    if (!audioRef.current || !currentSong) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      try {
        await audioRef.current.play();
        setIsPlaying(true);
        playCountMutation.mutate(currentSong.id);
      } catch (error) {
        console.error('Error playing audio:', error);
      }
    }
  };

  const playNext = () => {
    if (songs.length === 0) return;

    let nextIndex;
    if (settings?.shuffleMode) {
      nextIndex = Math.floor(Math.random() * songs.length);
    } else {
      nextIndex = (currentIndex + 1) % songs.length;
    }

    const nextSong = songs[nextIndex];
    setCurrentSong(nextSong);
    setCurrentIndex(nextIndex);

    if (audioRef.current) {
      setTimeout(() => {
        audioRef.current?.play().catch(console.error);
        setIsPlaying(true);
        playCountMutation.mutate(nextSong.id);
      }, 100);
    }
  };

  const playPrevious = () => {
    if (songs.length === 0) return;

    let prevIndex;
    if (settings?.shuffleMode) {
      prevIndex = Math.floor(Math.random() * songs.length);
    } else {
      prevIndex = currentIndex === 0 ? songs.length - 1 : currentIndex - 1;
    }

    const prevSong = songs[prevIndex];
    setCurrentSong(prevSong);
    setCurrentIndex(prevIndex);

    if (audioRef.current) {
      setTimeout(() => {
        audioRef.current?.play().catch(console.error);
        setIsPlaying(true);
        playCountMutation.mutate(prevSong.id);
      }, 100);
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !duration) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const newTime = (clickX / width) * duration;
    
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Always load music if there are songs
  if (songs.length === 0) {
    return null;
  }

  // If no current song but songs exist, set the first one
  if (!currentSong && songs.length > 0) {
    const firstSong = songs[0];
    setCurrentSong(firstSong);
    setCurrentIndex(0);
  }
  
  // Don't show anything if no current song
  if (!currentSong) {
    return null;
  }

  return (
    <div className={isAdmin ? `fixed bottom-4 right-4 z-40 transition-all duration-300 ${isMinimized ? 'w-16 h-16' : 'w-80'}` : 'hidden'}>
      <audio
        ref={audioRef}
        src={currentSong.filename.startsWith('/') ? currentSong.filename : `/${currentSong.filename}`}
        loop={false}
        preload="auto"
        autoPlay={true}
      />
      
      {/* Music start button for all users */}
      {currentSong && !isPlaying && (
        <div className="fixed top-4 right-4 z-50 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm cursor-pointer animate-pulse" onClick={async () => {
          if (audioRef.current) {
            try {
              console.log('🎵 Manual play button clicked for:', currentSong.title);
              audioRef.current.volume = 1.0;
              await audioRef.current.play();
              setIsPlaying(true);
              playCountMutation.mutate(currentSong.id);
              console.log('✅ Music started via manual button');
            } catch (error) {
              console.error('❌ Manual play failed:', error);
            }
          }
        }}>
          ▶️ Start Music: {currentSong.title}
        </div>
      )}
      
      {/* Current song display */}
      {currentSong && isPlaying && (
        <div className="fixed top-4 right-4 z-50 bg-black/80 text-white px-3 py-2 rounded-lg text-xs">
          🎵 Playing: {currentSong.title} - {currentSong.artist}
        </div>
      )}
      
      {isAdmin && (
      <Card className="bg-card/95 backdrop-blur border shadow-xl overflow-hidden">
        {isMinimized ? (
          // Minimized view - just play/pause button
          <div className="flex items-center justify-center h-16 w-16">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMinimized(false)}
              className="w-12 h-12 rounded-full text-lg"
              data-testid="button-expand-player"
              title={isPlaying ? "Music playing" : "Music paused"}
            >
              {isPlaying ? '🎵' : '⏸️'}
            </Button>
          </div>
        ) : (
          // Full player view
          <div className="p-4 space-y-3">
            {/* Header with minimize button */}
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">🎵 Music Player</div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMinimized(true)}
                className="w-6 h-6 rounded-full p-0 text-xs"
                data-testid="button-minimize-player"
              >
                −
              </Button>
            </div>

            {/* Song info */}
            <div className="text-center space-y-1">
              <div className="font-semibold text-sm truncate">{currentSong.title}</div>
              <div className="text-xs text-muted-foreground truncate">{currentSong.artist}</div>
            </div>

            {/* Progress bar */}
            <div className="space-y-1">
              <div 
                className="w-full bg-muted rounded-full h-2 cursor-pointer"
                onClick={handleSeek}
              >
                <div 
                  className="bg-primary h-2 rounded-full transition-all duration-100" 
                  style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Control buttons */}
            <div className="flex items-center justify-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={playPrevious}
                className="w-8 h-8 rounded-full"
                data-testid="button-previous-song"
                title="Previous Song"
              >
                ⏮️
              </Button>
              
              <Button
                variant="default"
                size="sm"
                onClick={togglePlayPause}
                className="w-12 h-12 rounded-full text-lg"
                data-testid="button-play-pause"
                title={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? '⏸️' : '▶️'}
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={playNext}
                className="w-8 h-8 rounded-full"
                data-testid="button-next-song"
                title="Next Song"
              >
                ⏭️
              </Button>
            </div>

            {/* Track info and status */}
            <div className="text-center space-y-1">
              <div className="text-xs text-muted-foreground">
                Track {currentIndex + 1} of {songs.length}
              </div>
              <div className="text-xs text-muted-foreground flex items-center justify-center gap-2">
                {settings?.shuffleMode && <span>🔀</span>}
                {settings?.autoPlay && <span>🔁</span>}
                <span>Vol: {settings?.musicVolume || 50}%</span>
              </div>
            </div>
          </div>
        )}
      </Card>
      )}
    </div>
  );
}

// Admin Music Controls Component
function AdminMusicControls({ user }: { user: User }) {
  const { toast } = useToast();

  // Fetch current music settings and songs
  const { data: songs = [] } = useQuery({
    queryKey: ['/api/songs'],
    queryFn: async () => {
      const response = await fetch('/api/songs');
      return response.json();
    },
  });

  const { data: musicSettings } = useQuery({
    queryKey: ['/api/music/settings'],
    queryFn: async () => {
      const response = await fetch('/api/music/settings');
      return response.json();
    },
  });

  // Update current playing song mutation
  const updateCurrentSongMutation = useMutation({
    mutationFn: async (songId: string | null) => {
      const response = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, currentSongId: songId }),
      });
      if (!response.ok) throw new Error('Failed to update current song');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/settings'] });
      queryClient.invalidateQueries({ queryKey: ['/api/music/settings'] });
      toast({ title: "Music Updated", description: "Current song has been updated" });
    },
  });

  // Play specific song
  const handlePlaySong = (songId: string) => {
    updateCurrentSongMutation.mutate(songId);
    // Trigger play event for all connected clients
    window.dispatchEvent(new CustomEvent('adminPlaySong', { detail: { songId } }));
  };

  // Pause music
  const handlePauseMusic = () => {
    window.dispatchEvent(new CustomEvent('adminPauseMusic'));
    toast({ title: "Music Paused", description: "Music has been paused for all users" });
  };

  // Resume music
  const handleResumeMusic = () => {
    window.dispatchEvent(new CustomEvent('adminResumeMusic'));
    toast({ title: "Music Resumed", description: "Music has been resumed for all users" });
  };

  // Skip to next song
  const handleSkipSong = () => {
    window.dispatchEvent(new CustomEvent('adminSkipSong'));
    toast({ title: "Song Skipped", description: "Skipped to next song for all users" });
  };

  return (
    <div className="space-y-4">
      {/* Current Status */}
      <div className="bg-muted/10 p-3 rounded-xl">
        <h4 className="text-sm font-medium mb-2">Current Status</h4>
        <div className="space-y-2 text-xs">
          <div className="flex justify-between">
            <span>Background Music:</span>
            <span className={musicSettings?.backgroundMusic ? "text-green-600" : "text-red-600"}>
              {musicSettings?.backgroundMusic ? "Enabled" : "Disabled"}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Volume:</span>
            <span>{musicSettings?.musicVolume || 50}%</span>
          </div>
          <div className="flex justify-between">
            <span>Active Songs:</span>
            <span>{songs.length} songs</span>
          </div>
        </div>
      </div>

      {/* Global Music Controls */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium">Global Controls</h4>
        <div className="grid grid-cols-2 gap-2">
          <Button
            onClick={handlePauseMusic}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
            data-testid="button-pause-all-music"
          >
            ⏸️ Pause All
          </Button>
          <Button
            onClick={handleResumeMusic}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
            data-testid="button-resume-all-music"
          >
            ▶️ Resume All
          </Button>
          <Button
            onClick={handleSkipSong}
            variant="outline"
            size="sm"
            className="flex items-center gap-2 col-span-2"
            data-testid="button-skip-song"
          >
            ⏭️ Skip to Next Song
          </Button>
        </div>
      </div>

      {/* Song Selection */}
      {songs.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium">Play Specific Song</h4>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {songs.map((song: any) => (
              <div
                key={song.id}
                className="flex items-center justify-between p-2 bg-muted/5 rounded-lg"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{song.title}</div>
                  <div className="text-xs text-muted-foreground truncate">by {song.artist}</div>
                </div>
                <Button
                  onClick={() => handlePlaySong(song.id)}
                  size="sm"
                  variant="outline"
                  className="ml-2 flex-shrink-0"
                  disabled={updateCurrentSongMutation.isPending}
                  data-testid={`button-play-song-${song.id}`}
                >
                  ▶️ Play
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {songs.length === 0 && (
        <div className="text-center py-4 text-muted-foreground">
          <div className="text-2xl mb-2">🎵</div>
          <p className="text-sm">No active songs available</p>
        </div>
      )}
    </div>
  );
}

// Music Management Panel Component
function MusicManagementPanel({ user }: { user: User }) {
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  // Fetch songs
  const { data: songs = [], refetch: refetchSongs } = useQuery({
    queryKey: ['/api/admin/songs'],
    queryFn: async () => {
      const response = await fetch(`/api/admin/songs?email=${user.email}`);
      return response.json();
    },
  });

  // Delete song mutation
  const deleteSongMutation = useMutation({
    mutationFn: async (songId: string) => {
      const response = await fetch(`/api/admin/songs/${songId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email }),
      });
      if (!response.ok) throw new Error('Failed to delete song');
      return response.json();
    },
    onSuccess: () => {
      refetchSongs();
      toast({ title: "Song Deleted", description: "Song has been removed from the library" });
    },
  });

  // Toggle song active status
  const toggleSongMutation = useMutation({
    mutationFn: async ({ songId, isActive }: { songId: string; isActive: boolean }) => {
      const response = await fetch(`/api/admin/songs/${songId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, isActive }),
      });
      if (!response.ok) throw new Error('Failed to update song');
      return response.json();
    },
    onSuccess: () => {
      refetchSongs();
      toast({ title: "Song Updated", description: "Song status has been updated" });
    },
  });


  // File upload handler
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!user?.email) {
      toast({
        title: "Error",
        description: "Admin authentication required. Please refresh the page.",
        variant: "destructive"
      });
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('audioFile', file);
      formData.append('email', user.email);
      console.log('Uploading with email:', user.email);

      const response = await fetch('/api/admin/songs/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const result = await response.json();
      
      refetchSongs();
      toast({ 
        title: "File Uploaded Successfully", 
        description: `"${result.metadata.title}" by ${result.metadata.artist} has been added to the library` 
      });
      
      // Clear the file input
      event.target.value = '';
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Upload Failed",
        description: "There was an error uploading the audio file",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* File Upload */}
      <div className="bg-muted/10 p-4 rounded-xl">
        <h4 className="text-sm font-medium mb-3">🎵 Upload Audio File</h4>
        <div className="space-y-3">
          <div>
            <input
              type="file"
              accept="audio/*"
              onChange={handleFileUpload}
              className="w-full p-2 border rounded-lg bg-background"
              data-testid="input-audio-file"
            />
            <div className="text-xs text-muted-foreground mt-1">
              Upload MP3, WAV, OGG, or other audio files. Title and artist will be detected automatically.
            </div>
          </div>
          {isUploading && (
            <div className="text-center text-sm text-muted-foreground">
              Uploading and processing audio file...
            </div>
          )}
        </div>
      </div>


      {/* Song List */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium">Music Library ({songs.length} songs)</h4>
        {songs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <div className="text-4xl mb-2">🎵</div>
            <p>No songs uploaded yet</p>
            <p className="text-sm">Add your first song to get started!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {songs.map((song: any) => (
              <div
                key={song.id}
                className="flex items-center justify-between p-3 bg-muted/10 rounded-lg"
              >
                <div className="flex-1">
                  <div className="font-medium">{song.title}</div>
                  <div className="text-sm text-muted-foreground">by {song.artist}</div>
                  <div className="text-xs text-muted-foreground">
                    Plays: {song.playCount || 0} • Added: {new Date(song.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant={song.isActive ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleSongMutation.mutate({ songId: song.id, isActive: !song.isActive })}
                    disabled={toggleSongMutation.isPending}
                    data-testid={`button-toggle-song-${song.id}`}
                  >
                    {song.isActive ? "Active" : "Inactive"}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => deleteSongMutation.mutate(song.id)}
                    disabled={deleteSongMutation.isPending}
                    data-testid={`button-delete-song-${song.id}`}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Admin Panel - Enhanced Dashboard Design
function AdminPanel({ user, onLogout, canLogout, onSwitchToEarn }: { user: User; onLogout: () => void; canLogout: boolean; onSwitchToEarn?: () => void }) {
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'withdrawals' | 'settings'>('overview');
  const [userSearch, setUserSearch] = useState('');
  const [userFilter, setUserFilter] = useState<'all' | 'active' | 'banned'>('all');
  const [chartPeriod, setChartPeriod] = useState<'7days' | '30days'>('7days');
  
  // Local state for settings values to make them controlled inputs
  const [settingsValues, setSettingsValues] = useState<any>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const { data: stats } = useQuery({
    queryKey: ['/api/admin/stats'],
    queryFn: async () => {
      const response = await fetch(`/api/admin/stats?email=${user.email}`);
      return response.json();
    },
  });

  const { data: users = [] } = useQuery({
    queryKey: ['/api/admin/users'],
    queryFn: async () => {
      const response = await fetch(`/api/admin/users?email=${user.email}`);
      return response.json();
    },
  });

  const { data: withdrawals = [] } = useQuery({
    queryKey: ['/api/admin/withdrawals'],
    queryFn: async () => {
      const response = await fetch(`/api/admin/withdrawals?email=${user.email}`);
      return response.json();
    },
  });

  const { data: settings } = useQuery({
    queryKey: ['/api/admin/settings'],
    queryFn: async () => {
      const response = await fetch(`/api/admin/settings?email=${user.email}`);
      return response.json();
    },
  });

  // Sync local state with fetched settings and persist to localStorage
  useEffect(() => {
    if (settings) {
      const newSettingsValues = {
        minWithdrawal: parseFloat(settings.minWithdrawal || "2500"),
        maxWithdrawal: parseFloat(settings.maxWithdrawal || "100000"),
        withdrawalCooldown: settings.withdrawalCooldown || 7,
        minAdsForWithdrawal: settings.minAdsForWithdrawal || 500,
        baseEarningsPerAd: parseFloat(settings.baseEarningsPerAd || "0.01"),
        dailyAdLimit: settings.dailyAdLimit || 250,
        newUserBonus: parseFloat(settings.newUserBonus || "55"),
        referralCommissionRate: (parseFloat(settings.referralCommissionRate || "0.10") * 100),
        musicVolume: settings.musicVolume || 50,
        dailyStreakMultiplier: parseFloat(settings.dailyStreakMultiplier || "0.002"),
        soundEnabled: settings.soundEnabled !== false,
        backgroundMusic: settings.backgroundMusic === true,
        autoPlay: settings.autoPlay === true,
        shuffleMode: settings.shuffleMode === true
      };
      setSettingsValues(newSettingsValues);
      // Store settings in localStorage for persistence
      localStorage.setItem('admin_settings_cache', JSON.stringify(newSettingsValues));
      setHasUnsavedChanges(false);
    }
  }, [settings]);

  // Load settings from localStorage on component mount
  useEffect(() => {
    const cachedSettings = localStorage.getItem('admin_settings_cache');
    if (cachedSettings && !settings) {
      try {
        setSettingsValues(JSON.parse(cachedSettings));
      } catch (error) {
        console.error('Failed to parse cached settings:', error);
      }
    }
  }, []);

  // Mutation for processing withdrawal requests
  const processWithdrawalMutation = useMutation({
    mutationFn: async ({ withdrawalId, status, adminNotes }: { withdrawalId: string; status: string; adminNotes?: string }) => {
      const response = await fetch(`/api/admin/withdrawal/${withdrawalId}/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: user.email,
          status,
          adminNotes,
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to process withdrawal');
      }
      
      return response.json();
    },
    onSuccess: () => {
      // Refetch admin data
      queryClient.invalidateQueries({ queryKey: ['/api/admin/withdrawals'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      
      // Also invalidate user withdrawal history queries so users see updates in real-time
      queryClient.invalidateQueries({ queryKey: ['/api/withdrawals'] });
      
      toast({
        title: "Withdrawal Processed",
        description: "The withdrawal request has been updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation for updating user
  const updateUserMutation = useMutation({
    mutationFn: async ({ userId, updates }: { userId: string; updates: any }) => {
      const response = await fetch(`/api/admin/user/${userId}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, ...updates }),
      });
      if (!response.ok) throw new Error('Failed to update user');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      toast({ title: "User Updated", description: "User has been updated successfully" });
    },
  });

  // Mutation for updating settings with explicit save
  const updateSettingsMutation = useMutation({
    mutationFn: async (updates: any) => {
      const response = await fetch(`/api/admin/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, ...updates }),
      });
      if (!response.ok) throw new Error('Failed to update settings');
      return response.json();
    },
    onSuccess: (updatedSettings, variables) => {
      // Update localStorage cache with new settings
      const updatedCache = { ...settingsValues, ...variables };
      localStorage.setItem('admin_settings_cache', JSON.stringify(updatedCache));
      
      // Invalidate ALL settings-related queries to ensure fresh data everywhere
      queryClient.invalidateQueries({ queryKey: ['/api/admin/settings'] });
      queryClient.invalidateQueries({ queryKey: ['/api/music/settings'] }); // Also refresh public music settings
      queryClient.invalidateQueries({ queryKey: ['/api/admin/stats'] });
      
      setHasUnsavedChanges(false);
      toast({ title: "Settings Saved!", description: "All settings have been saved successfully and will persist" });
    },
  });

  // Function to handle manual save
  const handleSaveSettings = () => {
    if (hasUnsavedChanges) {
      // Convert referral commission back to decimal for API
      const settingsToSave = {
        ...settingsValues,
        referralCommissionRate: (settingsValues.referralCommissionRate / 100).toString(),
        baseEarningsPerAd: settingsValues.baseEarningsPerAd.toString(),
        minWithdrawal: settingsValues.minWithdrawal.toString(),
        maxWithdrawal: settingsValues.maxWithdrawal.toString(),
        newUserBonus: settingsValues.newUserBonus.toString(),
        dailyStreakMultiplier: settingsValues.dailyStreakMultiplier.toString()
      };
      updateSettingsMutation.mutate(settingsToSave);
    }
  };

  // Function to update local state only (not save immediately)
  const updateLocalSetting = (key: string, value: any) => {
    setSettingsValues((prev: any) => ({ ...prev, [key]: value }));
    setHasUnsavedChanges(true);
  };

  const handleProcessWithdrawal = (withdrawalId: string, status: 'completed' | 'rejected', adminNotes?: string) => {
    processWithdrawalMutation.mutate({ withdrawalId, status, adminNotes });
  };

  const handleUserAction = (userId: string, action: 'ban' | 'unban') => {
    updateUserMutation.mutate({ userId, updates: { banned: action === 'ban' } });
  };

  const { toast } = useToast();

  // Filter users based on search and filter
  const filteredUsers = users.filter((u: any) => {
    const matchesSearch = !userSearch || 
      u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.username.toLowerCase().includes(userSearch.toLowerCase());
    
    const matchesFilter = 
      userFilter === 'all' || 
      (userFilter === 'active' && !u.banned) ||
      (userFilter === 'banned' && u.banned);
    
    return matchesSearch && matchesFilter;
  });

  // Prepare chart data
  const chartData = stats ? (chartPeriod === '7days' ? stats.dailyAdsChart7Days : stats.dailyAdsChart30Days) : [];

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Fixed Header */}
      <div className="flex-shrink-0">
        <div className="flex justify-between items-center p-6 bg-gradient-to-r from-primary/10 to-secondary/10 border-b">
          <div>
            <h1 className="text-3xl font-bold text-primary">⚡ Admin Dashboard</h1>
            <p className="text-sm text-muted-foreground">LightingSats Management Center</p>
          </div>
          <div className="flex gap-3">
            {onSwitchToEarn && (
              <Button 
                variant="outline" 
                onClick={onSwitchToEarn}
                className="flex items-center gap-2"
              >
                <Wallet className="w-4 h-4" />
                Earning View
              </Button>
            )}
            {canLogout && (
              <Button 
                variant="ghost" 
                onClick={onLogout}
                className="flex items-center gap-2"
              >
                <X className="w-4 h-4" />
                Logout
              </Button>
            )}
          </div>
        </div>

        {/* Fixed Navigation Tabs */}
        <div className="overflow-x-auto border-b bg-card/50">
          <div className="flex min-w-fit">
            {[
              { id: 'overview', label: 'Overview', icon: '📊' },
              { id: 'users', label: 'User Management', icon: '👥' },
              { id: 'withdrawals', label: 'Withdrawals', icon: '💰' },
              { id: 'settings', label: 'Settings', icon: '⚙️' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-6 py-4 font-medium text-sm transition-colors border-b-2 whitespace-nowrap flex-shrink-0 ${
                  activeTab === tab.id
                    ? 'border-primary text-primary bg-primary/5'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
                data-testid={`tab-${tab.id}`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Scrollable Main Content Area */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6">
          {/* Overview Tab */}
          {activeTab === 'overview' && stats && (
            <div className="space-y-6">
              {/* Key Metrics Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card className="p-6 bg-gradient-to-br from-primary/10 to-primary/5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-2xl font-bold text-primary">{stats.totalUsers}</p>
                      <p className="text-sm text-muted-foreground">👥 Total Users</p>
                    </div>
                  </div>
                </Card>
                <Card className="p-6 bg-gradient-to-br from-green-500/10 to-green-500/5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-2xl font-bold text-green-600">{stats.activeUsersToday}</p>
                      <p className="text-sm text-muted-foreground">📊 Active Today</p>
                    </div>
                  </div>
                </Card>
                <Card className="p-6 bg-gradient-to-br from-blue-500/10 to-blue-500/5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-2xl font-bold text-blue-600">{stats.totalAdsWatched.toLocaleString()}</p>
                      <p className="text-sm text-muted-foreground">🎥 Total Ads (Lifetime)</p>
                    </div>
                  </div>
                </Card>
                <Card className="p-6 bg-gradient-to-br from-orange-500/10 to-orange-500/5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-2xl font-bold text-orange-600">{stats.totalSatsPaidOut.toLocaleString()}</p>
                      <p className="text-sm text-muted-foreground">💰 Total Sats Rewarded</p>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Additional Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-4">📈 Ads Watched</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Today:</span>
                      <span className="font-medium">{stats.adsWatchedToday || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">7 Days:</span>
                      <span className="font-medium">{stats.adsWatched7Days || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">30 Days:</span>
                      <span className="font-medium">{stats.adsWatched30Days || 0}</span>
                    </div>
                  </div>
                </Card>
                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-4">💵 Pending Withdrawals</h3>
                  <div className="text-center space-y-2">
                    <p className="text-3xl font-bold text-orange-600">{stats.pendingWithdrawals || 0}</p>
                    <p className="text-sm text-muted-foreground">Requests</p>
                    <p className="text-lg font-semibold">{(stats.pendingWithdrawalAmount || 0).toLocaleString()} Sats</p>
                  </div>
                </Card>
                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-4">📊 Revenue</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">7 Days:</span>
                      <span className="font-medium">{(stats.revenue7Days || 0).toLocaleString()} Sats</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">30 Days:</span>
                      <span className="font-medium">{(stats.revenue30Days || 0).toLocaleString()} Sats</span>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Chart Section */}
              <Card className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-semibold">📈 Ads Watched per Day</h3>
                  <div className="flex gap-2">
                    <Button
                      variant={chartPeriod === '7days' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setChartPeriod('7days')}
                      data-testid="button-chart-7days"
                    >
                      7 Days
                    </Button>
                    <Button
                      variant={chartPeriod === '30days' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setChartPeriod('30days')}
                      data-testid="button-chart-30days"
                    >
                      30 Days
                    </Button>
                  </div>
                </div>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="ads" stroke="#3b82f6" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>
          )}

          {/* User Management Tab */}
          {activeTab === 'users' && (
            <div className="space-y-6">
              {/* Search and Filter Controls */}
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <Input
                      placeholder="Search by email or username..."
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      className="pl-10"
                      data-testid="input-user-search"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant={userFilter === 'all' ? 'default' : 'outline'}
                    onClick={() => setUserFilter('all')}
                    data-testid="filter-all-users"
                  >
                    All ({users.length})
                  </Button>
                  <Button
                    variant={userFilter === 'active' ? 'default' : 'outline'}
                    onClick={() => setUserFilter('active')}
                    data-testid="filter-active-users"
                  >
                    Active ({users.filter((u: any) => !u.banned).length})
                  </Button>
                  <Button
                    variant={userFilter === 'banned' ? 'default' : 'outline'}
                    onClick={() => setUserFilter('banned')}
                    data-testid="filter-banned-users"
                  >
                    Banned ({users.filter((u: any) => u.banned).length})
                  </Button>
                </div>
              </div>

              {/* Users Table */}
              <Card>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-4 font-medium">Gmail ID</th>
                        <th className="text-left p-4 font-medium">Registration Date</th>
                        <th className="text-left p-4 font-medium">Ads Watched</th>
                        <th className="text-left p-4 font-medium">Wallet Balance</th>
                        <th className="text-left p-4 font-medium">Referrals</th>
                        <th className="text-left p-4 font-medium">Status</th>
                        <th className="text-left p-4 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map((u: any) => (
                        <tr key={u.id} className="border-b hover:bg-muted/50" data-testid={`user-row-${u.id}`}>
                          <td className="p-4">
                            <div>
                              <p className="font-medium">{u.email}</p>
                              <p className="text-sm text-muted-foreground">PC: {u.personalCode}</p>
                            </div>
                          </td>
                          <td className="p-4">
                            <p className="text-sm">{new Date(u.createdAt).toLocaleDateString()}</p>
                          </td>
                          <td className="p-4">
                            <div>
                              <p className="font-medium">{u.adsWatched || 0} <span className="text-sm text-muted-foreground">lifetime</span></p>
                              <p className="text-sm text-muted-foreground">{u.dailyAdsWatched || 0} today</p>
                            </div>
                          </td>
                          <td className="p-4">
                            <div>
                              <p className="font-medium text-green-600">{(u.availableBalance || parseFloat(u.withdrawBalance || "0")).toLocaleString()} sats</p>
                              <p className="text-xs text-muted-foreground">Available</p>
                              {u.pendingWithdrawals > 0 && (
                                <p className="text-xs text-orange-600">{u.pendingWithdrawals.toLocaleString()} pending</p>
                              )}
                            </div>
                          </td>
                          <td className="p-4">
                            <div>
                              <p className="font-medium">{u.referralCount || 0}</p>
                              <p className="text-sm text-muted-foreground">{parseFloat(u.totalEarnings || "0").toLocaleString()} sats earned</p>
                            </div>
                          </td>
                          <td className="p-4">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              u.banned 
                                ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' 
                                : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                            }`}>
                              {u.banned ? '🚫 Banned' : '✅ Active'}
                            </span>
                          </td>
                          <td className="p-4">
                            <Button
                              variant={u.banned ? 'outline' : 'destructive'}
                              size="sm"
                              onClick={() => handleUserAction(u.id, u.banned ? 'unban' : 'ban')}
                              data-testid={`button-${u.banned ? 'unban' : 'ban'}-${u.id}`}
                            >
                              {u.banned ? 'Unban' : 'Ban'}
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}

          {/* Withdrawals Tab */}
          {activeTab === 'withdrawals' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">💰 Withdrawal Requests</h2>
                <div className="text-sm text-muted-foreground">
                  {withdrawals.filter((w: any) => w.status === 'pending').length} pending requests
                </div>
              </div>

              <div className="space-y-4">
                {withdrawals.map((w: any) => (
                  <Card key={w.id} className="p-6" data-testid={`withdrawal-card-${w.id}`}>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      
                      {/* User Basic Info */}
                      <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-primary flex items-center gap-2">
                          👤 User Information
                        </h3>
                        <div className="space-y-3">
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">Gmail / User ID</label>
                            <p className="font-medium">{w.userEmail || w.email}</p>
                            <p className="text-sm text-muted-foreground">PC: {w.personalCode}</p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">Registration Date</label>
                            <p className="text-sm">{new Date(w.userCreatedAt).toLocaleDateString()}</p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">Last Login</label>
                            {w.lastLoginAt ? (
                              <div className="text-sm">
                                <p>{new Date(w.lastLoginAt).toLocaleDateString()} at {new Date(w.lastLoginAt).toLocaleTimeString()}</p>
                                <p className="text-xs text-muted-foreground">IP: {w.lastLoginIp || 'Unknown'}</p>
                                <p className="text-xs text-muted-foreground">Device: {w.lastLoginDevice || 'Unknown'}</p>
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground">No login data</p>
                            )}
                          </div>
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">User Stats</label>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div>Ads: <span className="font-medium">{w.adsWatched || 0}</span></div>
                              <div>Level: <span className="font-medium">{w.level || 1}</span></div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Withdrawal Request Info */}
                      <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-orange-600 flex items-center gap-2">
                          💸 Withdrawal Details
                        </h3>
                        <div className="space-y-3">
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">Request ID</label>
                            <p className="font-mono text-sm">{w.id.substring(0, 8)}...</p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">Requested Amount</label>
                            <p className="text-xl font-bold text-orange-600">{parseFloat(w.amount || "0").toLocaleString()} sats</p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">User Balance</label>
                            <div className="space-y-1">
                              <p className="font-medium text-green-600">{(w.availableBalance || parseFloat(w.withdrawBalance || "0")).toLocaleString()} sats available</p>
                              {w.pendingWithdrawals > 0 && (
                                <p className="text-sm text-orange-600">{w.pendingWithdrawals.toLocaleString()} sats pending withdrawal</p>
                              )}
                            </div>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">Wallet Address</label>
                            <p className="font-mono text-sm bg-muted p-2 rounded break-all">{w.walletAddress}</p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">Request Date & Time</label>
                            <p className="text-sm">{new Date(w.createdAt).toLocaleDateString()} at {new Date(w.createdAt).toLocaleTimeString()}</p>
                          </div>
                          {w.name && (
                            <div>
                              <label className="text-sm font-medium text-muted-foreground">Name</label>
                              <p className="text-sm">{w.name}</p>
                            </div>
                          )}
                          {w.telegramUsername && (
                            <div>
                              <label className="text-sm font-medium text-muted-foreground">Telegram Username</label>
                              <p className="text-sm">@{w.telegramUsername}</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Status & Actions */}
                      <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-blue-600 flex items-center gap-2">
                          ⚙️ Status & Actions
                        </h3>
                        <div className="space-y-4">
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">Request Status</label>
                            <div className="mt-2">
                              <span className={`px-3 py-2 rounded-full text-sm font-medium ${
                                w.status === 'pending' 
                                  ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
                                  : w.status === 'completed'
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                                  : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
                              }`}>
                                {w.status === 'pending' ? '⏳ Pending' : 
                                 w.status === 'completed' ? '✅ Paid' : '❌ Rejected'}
                              </span>
                            </div>
                          </div>
                          
                          {w.processedAt && (
                            <div>
                              <label className="text-sm font-medium text-muted-foreground">Processed At</label>
                              <p className="text-sm">{new Date(w.processedAt).toLocaleDateString()} at {new Date(w.processedAt).toLocaleTimeString()}</p>
                            </div>
                          )}
                          
                          {w.adminNotes && (
                            <div>
                              <label className="text-sm font-medium text-muted-foreground">Admin Notes</label>
                              <p className="text-sm bg-muted p-2 rounded">{w.adminNotes}</p>
                            </div>
                          )}

                          {w.status === 'pending' && (
                            <div className="space-y-2">
                              <label className="text-sm font-medium text-muted-foreground">Quick Actions</label>
                              <div className="flex flex-col gap-2">
                                <Button
                                  onClick={() => handleProcessWithdrawal(w.id, 'completed')}
                                  className="bg-green-600 hover:bg-green-700 w-full"
                                  data-testid={`button-approve-${w.id}`}
                                >
                                  ✅ Approve & Pay
                                </Button>
                                <Button
                                  variant="destructive"
                                  onClick={() => handleProcessWithdrawal(w.id, 'rejected', 'Rejected by admin')}
                                  className="w-full"
                                  data-testid={`button-reject-${w.id}`}
                                >
                                  ❌ Reject Request
                                </Button>
                              </div>
                            </div>
                          )}
                          
                          {/* User Account Actions */}
                          <div className="space-y-2 pt-4 border-t">
                            <label className="text-sm font-medium text-muted-foreground">User Account</label>
                            <div className="flex flex-col gap-2">
                              <span className={`px-2 py-1 rounded text-xs font-medium text-center ${
                                w.banned 
                                  ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' 
                                  : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                              }`}>
                                {w.banned ? '🚫 User Banned' : '✅ User Active'}
                              </span>
                              <Button
                                variant={w.banned ? 'outline' : 'destructive'}
                                size="sm"
                                onClick={() => handleUserAction(w.userId, w.banned ? 'unban' : 'ban')}
                                className="text-xs"
                                data-testid={`button-${w.banned ? 'unban' : 'ban'}-user-${w.userId}`}
                              >
                                {w.banned ? 'Unban User' : 'Ban User'}
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
                
                {withdrawals.length === 0 && (
                  <Card className="p-8 text-center">
                    <div className="text-4xl mb-4">💰</div>
                    <h3 className="text-lg font-semibold mb-2">No withdrawal requests</h3>
                    <p className="text-muted-foreground">All withdrawal requests will appear here</p>
                  </Card>
                )}
              </div>
            </div>
          )}

          {/* Settings Tab */}
          {activeTab === 'settings' && settings && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">⚙️ Settings</h2>
                <div className="flex items-center gap-3">
                  {hasUnsavedChanges && (
                    <span className="text-sm text-orange-600 font-medium animate-pulse">• Unsaved changes</span>
                  )}
                  <Button
                    onClick={handleSaveSettings}
                    disabled={!hasUnsavedChanges || updateSettingsMutation.isPending}
                    className="bg-green-600 hover:bg-green-700 font-bold px-6"
                    data-testid="button-save-settings"
                  >
                    {updateSettingsMutation.isPending ? (
                      <div className="flex items-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                        <span>Saving...</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        💾 <span>Save All Settings</span>
                      </div>
                    )}
                  </Button>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Withdrawal Settings */}
                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-4">Withdrawal Settings</h3>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="min-withdrawal" className="text-sm font-medium">Minimum Withdrawal Amount (sats)</Label>
                      <Input
                        id="min-withdrawal"
                        type="number"
                        value={settingsValues.minWithdrawal || ''}
                        onChange={(e) => {
                          const value = parseFloat(e.target.value) || 0;
                          updateLocalSetting('minWithdrawal', value);
                        }}
                        className="mt-1 h-9"
                        placeholder="2500"
                        data-testid="input-min-withdrawal"
                      />
                    </div>
                    <div>
                      <Label htmlFor="max-withdrawal" className="text-sm font-medium">Maximum Withdrawal Amount (sats)</Label>
                      <Input
                        id="max-withdrawal"
                        type="number"
                        value={settingsValues.maxWithdrawal || ''}
                        onChange={(e) => {
                          const value = parseFloat(e.target.value) || 0;
                          updateLocalSetting('maxWithdrawal', value);
                        }}
                        className="mt-1 h-9"
                        placeholder="100000"
                        data-testid="input-max-withdrawal"
                      />
                    </div>
                    <div>
                      <Label htmlFor="withdrawal-cooldown" className="text-sm font-medium">Withdrawal Cooldown (days)</Label>
                      <Input
                        id="withdrawal-cooldown"
                        type="number"
                        value={settingsValues.withdrawalCooldown || ''}
                        onChange={(e) => {
                          const value = parseInt(e.target.value) || 0;
                          updateLocalSetting('withdrawalCooldown', value);
                        }}
                        className="mt-1 h-9"
                        placeholder="7"
                        data-testid="input-withdrawal-cooldown"
                      />
                    </div>
                    <div>
                      <Label htmlFor="min-ads-withdrawal" className="text-sm font-medium">Min Ads for Withdrawal</Label>
                      <Input
                        id="min-ads-withdrawal"
                        type="number"
                        value={settingsValues.minAdsForWithdrawal || ''}
                        onChange={(e) => {
                          const value = parseInt(e.target.value) || 0;
                          updateLocalSetting('minAdsForWithdrawal', value);
                        }}
                        className="mt-1 h-9"
                        placeholder="500"
                        data-testid="input-min-ads-withdrawal"
                      />
                    </div>
                  </div>
                </Card>

                {/* Ad Settings */}
                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-4">Ad Settings</h3>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="sats-per-ad" className="text-sm font-medium">Sats per Ad</Label>
                      <Input
                        id="sats-per-ad"
                        type="number"
                        step="0.001"
                        value={settingsValues.baseEarningsPerAd || ''}
                        onChange={(e) => {
                          const value = parseFloat(e.target.value) || 0;
                          updateLocalSetting('baseEarningsPerAd', value);
                        }}
                        className="mt-1 h-9"
                        placeholder="0.25"
                        data-testid="input-sats-per-ad"
                      />
                    </div>
                    <div>
                      <Label htmlFor="daily-ad-limit" className="text-sm font-medium">Daily Ad Limit per User</Label>
                      <Input
                        id="daily-ad-limit"
                        type="number"
                        value={settingsValues.dailyAdLimit || ''}
                        onChange={(e) => {
                          const value = parseInt(e.target.value) || 0;
                          updateLocalSetting('dailyAdLimit', value);
                        }}
                        className="mt-1 h-9"
                        placeholder="250"
                        data-testid="input-daily-ad-limit"
                      />
                    </div>
                    <div>
                      <Label htmlFor="new-user-bonus" className="text-sm font-medium">New User Bonus (sats)</Label>
                      <Input
                        id="new-user-bonus"
                        type="number"
                        value={settingsValues.newUserBonus || ''}
                        onChange={(e) => {
                          const value = parseFloat(e.target.value) || 0;
                          updateLocalSetting('newUserBonus', value);
                        }}
                        className="mt-1 h-9"
                        placeholder="55"
                        data-testid="input-new-user-bonus"
                      />
                    </div>
                    <div>
                      <Label htmlFor="referral-commission" className="text-sm font-medium">Referral Commission Rate (%)</Label>
                      <Input
                        id="referral-commission"
                        type="number"
                        step="0.01"
                        value={settingsValues.referralCommissionRate || ''}
                        onChange={(e) => {
                          const value = parseFloat(e.target.value) || 0;
                          updateLocalSetting('referralCommissionRate', value);
                        }}
                        className="mt-1 h-9"
                        placeholder="10"
                        data-testid="input-referral-commission"
                      />
                    </div>
                  </div>
                </Card>

                {/* Audio & Music Settings */}
                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-4">🎵 Audio & Music Settings</h3>
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="sound-enabled"
                        checked={settingsValues.soundEnabled ?? true}
                        onChange={(e) => {
                          updateLocalSetting('soundEnabled', e.target.checked);
                        }}
                        className="w-4 h-4"
                        data-testid="checkbox-sound-enabled"
                      />
                      <Label htmlFor="sound-enabled" className="text-sm font-medium">Enable Sound Effects</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="background-music"
                        checked={settingsValues.backgroundMusic ?? false}
                        onChange={(e) => {
                          updateLocalSetting('backgroundMusic', e.target.checked);
                        }}
                        className="w-4 h-4"
                        data-testid="checkbox-background-music"
                      />
                      <Label htmlFor="background-music" className="text-sm font-medium">Enable Background Music</Label>
                    </div>
                    <div>
                      <Label htmlFor="music-volume" className="text-sm font-medium">Music Volume ({settingsValues.musicVolume || 50}%)</Label>
                      <input
                        id="music-volume"
                        type="range"
                        min="0"
                        max="100"
                        value={settingsValues.musicVolume || 50}
                        onChange={(e) => {
                          const value = parseInt(e.target.value);
                          updateLocalSetting('musicVolume', value);
                        }}
                        className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer mt-1"
                        data-testid="input-music-volume"
                      />
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="auto-play"
                        checked={settingsValues.autoPlay ?? false}
                        onChange={(e) => {
                          updateLocalSetting('autoPlay', e.target.checked);
                        }}
                        className="w-4 h-4"
                        data-testid="checkbox-auto-play"
                      />
                      <Label htmlFor="auto-play" className="text-sm font-medium">Auto-play next song</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="shuffle-mode"
                        checked={settingsValues.shuffleMode ?? false}
                        onChange={(e) => {
                          updateLocalSetting('shuffleMode', e.target.checked);
                        }}
                        className="w-4 h-4"
                        data-testid="checkbox-shuffle-mode"
                      />
                      <Label htmlFor="shuffle-mode" className="text-sm font-medium">Shuffle Mode</Label>
                    </div>
                  </div>
                </Card>

                {/* Live Music Controls */}
                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-4">🎮 Live Music Controls</h3>
                  <AdminMusicControls user={user} />
                </Card>

                {/* Music Management */}
                <Card className="p-6 md:col-span-2">
                  <h3 className="text-lg font-semibold mb-4">🎵 Music Library Management</h3>
                  <MusicManagementPanel user={user} />
                </Card>

                {/* System Settings */}
                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-4">⚙️ System Settings</h3>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="streak-multiplier" className="text-sm font-medium">Daily Streak Multiplier</Label>
                      <Input
                        id="streak-multiplier"
                        type="number"
                        step="0.001"
                        value={settingsValues.dailyStreakMultiplier || ''}
                        onChange={(e) => {
                          const value = parseFloat(e.target.value) || 0;
                          updateLocalSetting('dailyStreakMultiplier', value);
                        }}
                        className="mt-1 h-9"
                        placeholder="0.002"
                        data-testid="input-streak-multiplier"
                      />
                    </div>
                    <div className="bg-muted/10 p-3 rounded-xl">
                      <h4 className="text-sm font-medium mb-2">System Stats</h4>
                      <div className="grid grid-cols-1 gap-2 text-xs text-muted-foreground">
                        <div>Total Users: {settings.totalUsers || 0}</div>
                        <div>Total Sats Paid: {parseFloat(settings.totalSatsPaidOut || "0").toLocaleString()}</div>
                        <div>Total Ads Watched: {settings.totalAdsWatched || 0}</div>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Background Ad Manager Component
function BackgroundAdManager() {
  useEffect(() => {
    // Initialize in-app interstitial ads
    if (window.show_9368336) {
      try {
        window.show_9368336({
          type: 'inApp',
          inAppSettings: {
            frequency: 2,     // Show 2 ads
            capping: 0.1,     // Within 6 minutes (0.1 hours)
            interval: 25,     // 25 seconds between ads
            timeout: 5,       // 5 second delay before first ad
            everyPage: false  // Keep session across pages
          }
        });
      } catch (error) {
        console.error('Background ad initialization error:', error);
      }
    }
  }, []);

  return null; // This component doesn't render anything
}

// Main App Component
function App() {
  const { user, isLoading, isAuthenticated, logout, canLogout, setUser } = useAuth();
  const [adminView, setAdminView] = useState<'admin' | 'earn'>('earn'); // Default to earning view

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Admin view switcher for admin users
  const isAdmin = user && ADMIN_EMAILS.includes(user.email);

  return (
    <QueryClientProvider client={queryClient}>
      <div className="dark">
        <BackgroundAdManager />
        {!isAuthenticated ? (
          <AuthForm onSuccess={setUser} />
        ) : isAdmin ? (
          adminView === 'admin' ? (
            <AdminPanel 
              user={user} 
              onLogout={logout} 
              canLogout={!!canLogout}
              onSwitchToEarn={() => setAdminView('earn')}
            />
          ) : (
            <MainApp 
              user={user} 
              onLogout={logout} 
              canLogout={!!canLogout}
              onSwitchToAdmin={() => setAdminView('admin')}
              isAdmin={true}
            />
          )
        ) : user ? (
          <MainApp user={user} onLogout={logout} canLogout={!!canLogout} />
        ) : null}
        <Toaster />
      </div>
    </QueryClientProvider>
  );
}

export default App;
