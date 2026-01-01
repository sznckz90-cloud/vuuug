import { useState, useEffect, useCallback } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { showNotification } from '@/components/AppNotification';
import { PlayCircle, Share2, Send, Users, Check, Flame, Zap, Gift, Loader2 } from 'lucide-react';

interface User {
  referralCode?: string;
}

interface AppSettings {
  streakReward?: number;
  shareTaskReward?: number;
  channelTaskRewardPAD?: number;
  communityTaskReward?: number;
  [key: string]: any;
}

type TaskStep = 'idle' | 'started' | 'countdown' | 'ready' | 'claiming' | 'completed';

export default function TaskSection() {
  const queryClient = useQueryClient();
  
  const [shareStep, setShareStep] = useState<TaskStep>('idle');
  const [shareCountdown, setShareCountdown] = useState(3);
  const [channelStep, setChannelStep] = useState<TaskStep>('idle');
  const [channelCountdown, setChannelCountdown] = useState(3);
  const [communityStep, setCommunityStep] = useState<TaskStep>('idle');
  const [communityCountdown, setCommunityCountdown] = useState(3);
  const [streakCompleted, setStreakCompleted] = useState(false);

  const { data: user } = useQuery<User>({
    queryKey: ['/api/auth/user'],
    retry: false,
  });

  const { data: appSettings } = useQuery<AppSettings>({
    queryKey: ['/api/app-settings'],
    retry: false,
  });

  const { data: taskStatus } = useQuery({
    queryKey: ['/api/tasks/daily/status'],
    queryFn: async () => {
      const res = await fetch('/api/tasks/daily/status', {
        credentials: 'include',
      });
      if (!res.ok) return { completedTasks: [] };
      return res.json();
    },
    retry: false,
  });

  useEffect(() => {
    if (taskStatus?.completedTasks) {
      const completed = new Set(taskStatus.completedTasks);
      if (completed.has('claim-streak')) setStreakCompleted(true);
      if (completed.has('share-friends')) setShareStep('completed');
      if (completed.has('check-updates')) setChannelStep('completed');
      if (completed.has('join-community')) setCommunityStep('completed');
    }
  }, [taskStatus]);

  const streakRewardPAD = appSettings?.streakReward || 100;
  const shareTaskRewardPAD = appSettings?.shareTaskReward || 1000;
  const channelTaskRewardPAD = appSettings?.channelTaskRewardPAD || 1000;
  const communityTaskRewardPAD = appSettings?.communityTaskReward || 1000;

  const claimStreakMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/streak/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) {
        const errorObj = new Error(data.message || 'Failed to claim streak');
        (errorObj as any).isAlreadyClaimed = data.message === "You have already claimed today's streak!";
        throw errorObj;
      }
      return data;
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tasks/daily/status'] });
      setStreakCompleted(true);
      const rewardAmount = parseFloat(data.rewardEarned || '0');
      if (rewardAmount > 0) {
        const rewardPAD = Math.round(rewardAmount);
        const message = data.isBonusDay 
          ? `5-day streak bonus! +${rewardPAD.toLocaleString()} PAD`
          : `Streak claimed! +${rewardPAD.toLocaleString()} PAD`;
        showNotification(message, 'success');
      } else {
        showNotification("Streak claimed!", 'success');
      }
    },
    onError: (error: any) => {
      if (error.isAlreadyClaimed) {
        setStreakCompleted(true);
      }
      showNotification(error.message || 'Failed to claim streak', error.isAlreadyClaimed ? "info" : "error");
    },
  });

  const shareTaskMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/tasks/complete/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to complete task');
      return data;
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tasks/daily/status'] });
      setShareStep('completed');
      const rewardAmount = Number(data.reward ?? shareTaskRewardPAD);
      showNotification(`+${rewardAmount.toLocaleString()} PAD earned!`, 'success');
    },
    onError: (error: any) => {
      showNotification(error.message || 'Failed to complete task', 'error');
      setShareStep('ready');
    },
  });

  const channelTaskMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/tasks/complete/channel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to complete task');
      return data;
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tasks/daily/status'] });
      setChannelStep('completed');
      const rewardAmount = Number(data.reward ?? channelTaskRewardPAD);
      showNotification(`+${rewardAmount.toLocaleString()} PAD earned!`, 'success');
    },
    onError: (error: any) => {
      showNotification(error.message || 'Failed to complete task', 'error');
      setChannelStep('ready');
    },
  });

  const communityTaskMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/tasks/complete/community', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to complete task');
      return data;
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tasks/daily/status'] });
      setCommunityStep('completed');
      const rewardAmount = Number(data.reward ?? communityTaskRewardPAD);
      showNotification(`+${rewardAmount.toLocaleString()} PAD earned!`, 'success');
    },
    onError: (error: any) => {
      showNotification(error.message || 'Failed to complete task', 'error');
      setCommunityStep('ready');
    },
  });

  const handleClaimStreak = () => {
    if (streakCompleted || claimStreakMutation.isPending) return;
    claimStreakMutation.mutate();
  };

  const handleShareTask = useCallback(() => {
    if (shareStep !== 'idle') return;
    
    const botUsername = import.meta.env.VITE_BOT_USERNAME || 'PaidAdzbot';
    const referralLink = user?.referralCode 
      ? `https://t.me/${botUsername}?start=${user.referralCode}`
      : '';
    
    if (!referralLink) {
      showNotification('Unable to generate referral link', 'error');
      return;
    }
    
    const shareText = `Earn PAD in Telegram!`;
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent(shareText)}`;
    
    if (window.Telegram?.WebApp?.openTelegramLink) {
      window.Telegram.WebApp.openTelegramLink(shareUrl);
    } else if (navigator.share) {
      navigator.share({
        title: 'Join CashWatch',
        text: shareText,
        url: referralLink,
      }).catch(() => {});
    } else {
      window.open(shareUrl, '_blank');
    }
    
    setShareStep('countdown');
    setShareCountdown(3);
  }, [shareStep, user?.referralCode]);

  const handleClaimShare = useCallback(() => {
    if (shareTaskMutation.isPending || shareStep !== 'ready') return;
    setShareStep('claiming');
    shareTaskMutation.mutate();
  }, [shareTaskMutation, shareStep]);

  const handleChannelTask = useCallback(() => {
    if (channelStep !== 'idle') return;
    
    if (window.Telegram?.WebApp?.openTelegramLink) {
      window.Telegram.WebApp.openTelegramLink('https://t.me/MoneyAdz');
    } else {
      window.open('https://t.me/MoneyAdz', '_blank');
    }
    
    setChannelStep('countdown');
    setChannelCountdown(3);
  }, [channelStep]);

  const handleClaimChannel = useCallback(() => {
    if (channelTaskMutation.isPending || channelStep !== 'ready') return;
    setChannelStep('claiming');
    channelTaskMutation.mutate();
  }, [channelTaskMutation, channelStep]);

  const handleCommunityTask = useCallback(() => {
    if (communityStep !== 'idle') return;
    
    if (window.Telegram?.WebApp?.openTelegramLink) {
      window.Telegram.WebApp.openTelegramLink('https://t.me/MoneyAdzChat');
    } else {
      window.open('https://t.me/MoneyAdzChat', '_blank');
    }
    
    setCommunityStep('countdown');
    setCommunityCountdown(3);
  }, [communityStep]);

  const handleClaimCommunity = useCallback(() => {
    if (communityTaskMutation.isPending || communityStep !== 'ready') return;
    setCommunityStep('claiming');
    communityTaskMutation.mutate();
  }, [communityTaskMutation, communityStep]);

  useEffect(() => {
    if (shareStep === 'countdown' && shareCountdown > 0) {
      const timer = setTimeout(() => setShareCountdown(prev => prev - 1), 1000);
      return () => clearTimeout(timer);
    } else if (shareStep === 'countdown' && shareCountdown === 0) {
      setShareStep('ready');
    }
  }, [shareStep, shareCountdown]);

  useEffect(() => {
    if (channelStep === 'countdown' && channelCountdown > 0) {
      const timer = setTimeout(() => setChannelCountdown(prev => prev - 1), 1000);
      return () => clearTimeout(timer);
    } else if (channelStep === 'countdown' && channelCountdown === 0) {
      setChannelStep('ready');
    }
  }, [channelStep, channelCountdown]);

  useEffect(() => {
    if (communityStep === 'countdown' && communityCountdown > 0) {
      const timer = setTimeout(() => setCommunityCountdown(prev => prev - 1), 1000);
      return () => clearTimeout(timer);
    } else if (communityStep === 'countdown' && communityCountdown === 0) {
      setCommunityStep('ready');
    }
  }, [communityStep, communityCountdown]);

  const renderTask = (
    icon: React.ReactNode,
    iconBg: string,
    title: string,
    reward: string,
    rewardColor: string,
    step: TaskStep,
    countdown: number,
    onStart: () => void,
    onClaim: () => void,
    isClaimPending: boolean
  ) => {
    const isCompleted = step === 'completed';
    
    const getButtonContent = () => {
      if (isCompleted) {
        return (
          <span className="flex items-center gap-1">
            <Check className="w-3 h-3" />
            Done
          </span>
        );
      }
      if (step === 'claiming' || isClaimPending) {
        return <Loader2 className="w-4 h-4 animate-spin" />;
      }
      if (step === 'countdown') {
        return `${countdown}s`;
      }
      if (step === 'ready') {
        return 'Claim';
      }
      return 'Start';
    };

    const getButtonClass = () => {
      if (isCompleted) {
        return 'bg-gradient-to-r from-green-500 to-emerald-500';
      }
      if (step === 'countdown') {
        return 'bg-gradient-to-r from-gray-500 to-gray-600';
      }
      if (step === 'ready') {
        return 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600';
      }
      return 'bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600';
    };

    const handleClick = () => {
      if (isCompleted || step === 'claiming' || isClaimPending || step === 'countdown') return;
      if (step === 'ready') {
        onClaim();
      } else if (step === 'idle') {
        onStart();
      }
    };
    
    return (
      <Card className="minimal-card mb-3 hover:bg-[#1A1A1A]/50 transition-all">
        <CardContent className="p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center flex-shrink-0 shadow-lg`}>
                <span className="text-white">{icon}</span>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-white font-semibold text-sm truncate">{title}</h3>
                <div className="flex items-center gap-1">
                  <Zap className={`w-3 h-3 ${rewardColor}`} />
                  <p className={`text-xs font-bold ${rewardColor}`}>{reward}</p>
                </div>
              </div>
            </div>
            <Button
              onClick={handleClick}
              disabled={isCompleted || step === 'countdown' || step === 'claiming' || isClaimPending}
              className={`h-9 px-4 text-xs flex-shrink-0 min-w-[75px] font-semibold rounded-xl border-0 shadow-md ${getButtonClass()} text-white`}
            >
              {getButtonContent()}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      <Tabs defaultValue="main" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="main" className="flex items-center gap-2">
            <PlayCircle className="w-4 h-4" />
            Main
          </TabsTrigger>
          <TabsTrigger value="partner" className="flex items-center gap-2">
            <Share2 className="w-4 h-4" />
            Partner
          </TabsTrigger>
        </TabsList>

        <TabsContent value="main" className="space-y-0">
          <Card className="minimal-card mb-3 hover:bg-[#1A1A1A]/50 transition-all">
            <CardContent className="p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center flex-shrink-0 shadow-lg">
                    <span className="text-white"><Flame className="w-5 h-5" /></span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-white font-semibold text-sm truncate">Claim Streak</h3>
                    <div className="flex items-center gap-1">
                      <Zap className="w-3 h-3 text-orange-400" />
                      <p className="text-xs font-bold text-orange-400">+{streakRewardPAD.toLocaleString()} PAD</p>
                    </div>
                  </div>
                </div>
                <Button
                  onClick={handleClaimStreak}
                  disabled={streakCompleted || claimStreakMutation.isPending}
                  className={`h-9 px-4 text-xs flex-shrink-0 min-w-[75px] font-semibold rounded-xl border-0 shadow-md ${
                    streakCompleted 
                      ? 'bg-gradient-to-r from-green-500 to-emerald-500' 
                      : 'bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600'
                  } text-white`}
                >
                  {streakCompleted ? (
                    <span className="flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      Done
                    </span>
                  ) : claimStreakMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    'Claim'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
          
          {renderTask(
            <Gift className="w-5 h-5" />,
            'bg-gradient-to-br from-pink-500 to-rose-500',
            'Share with Friends',
            `+${shareTaskRewardPAD.toLocaleString()} PAD`,
            'text-pink-400',
            shareStep,
            shareCountdown,
            handleShareTask,
            handleClaimShare,
            shareTaskMutation.isPending
          )}
          
          {renderTask(
            <Send className="w-5 h-5" />,
            'bg-gradient-to-br from-blue-500 to-cyan-500',
            'Check for Updates',
            `+${channelTaskRewardPAD.toLocaleString()} PAD`,
            'text-cyan-400',
            channelStep,
            channelCountdown,
            handleChannelTask,
            handleClaimChannel,
            channelTaskMutation.isPending
          )}
          
          {renderTask(
            <Users className="w-5 h-5" />,
            'bg-gradient-to-br from-purple-500 to-violet-500',
            'Join community',
            `+${communityTaskRewardPAD.toLocaleString()} PAD`,
            'text-purple-400',
            communityStep,
            communityCountdown,
            handleCommunityTask,
            handleClaimCommunity,
            communityTaskMutation.isPending
          )}
        </TabsContent>

        <TabsContent value="partner" className="space-y-0">
          <Card className="minimal-card">
            <CardContent className="p-6 text-center">
              <Share2 className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground text-sm">Partner tasks coming soon</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
