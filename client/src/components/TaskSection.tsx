import { useState, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { showNotification } from '@/components/AppNotification';
import { PlayCircle, Share2, Send, Users, Play, Check, Flame, Zap, Gift } from 'lucide-react';

interface User {
  referralCode?: string;
}

export default function TaskSection() {
  const queryClient = useQueryClient();
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set());

  const { data: user } = useQuery<User>({
    queryKey: ['/api/auth/user'],
    retry: false,
  });

  // Fetch daily task completion status from backend
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

  // Update completedTasks from backend data
  useEffect(() => {
    if (taskStatus?.completedTasks) {
      setCompletedTasks(new Set(taskStatus.completedTasks));
    }
  }, [taskStatus]);

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
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ['/api/auth/user'] }),
        queryClient.refetchQueries({ queryKey: ['/api/user/stats'] })
      ]);
      setCompletedTasks(prev => new Set([...prev, 'claim-streak']));
      const rewardAmount = parseFloat(data.rewardEarned || '0');
      if (rewardAmount > 0) {
        const rewardPAD = Math.round(rewardAmount);
        const message = data.isBonusDay 
          ? `🔥 5-day streak bonus! You've claimed today's streak reward! +${rewardPAD.toLocaleString()} PAD`
          : `✅ You've claimed today's streak reward! +${rewardPAD.toLocaleString()} PAD`;
        showNotification(message, 'success');
      } else {
        showNotification("✅ You've claimed today's streak reward!", 'success');
      }
    },
    onError: (error: any) => {
      const notificationType = error.isAlreadyClaimed ? "info" : "error";
      showNotification(error.message || 'Failed to claim streak', notificationType);
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
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ['/api/auth/user'] }),
        queryClient.refetchQueries({ queryKey: ['/api/user/stats'] })
      ]);
      setCompletedTasks(prev => new Set([...prev, 'share-friends']));
      showNotification('You received 1,000 PAD on your balance', 'success');
    },
    onError: (error: any) => {
      showNotification(error.message || 'Failed to complete task', 'error');
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
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ['/api/auth/user'] }),
        queryClient.refetchQueries({ queryKey: ['/api/user/stats'] })
      ]);
      setCompletedTasks(prev => new Set([...prev, 'check-updates']));
      showNotification('You received 1,000 PAD on your balance', 'success');
    },
    onError: (error: any) => {
      showNotification(error.message || 'Failed to complete task', 'error');
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
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ['/api/auth/user'] }),
        queryClient.refetchQueries({ queryKey: ['/api/user/stats'] })
      ]);
      setCompletedTasks(prev => new Set([...prev, 'join-community']));
      showNotification('You received 1,000 PAD on your balance', 'success');
    },
    onError: (error: any) => {
      showNotification(error.message || 'Failed to complete task', 'error');
    },
  });

  const handleClaimStreak = () => {
    if (completedTasks.has('claim-streak')) return;
    claimStreakMutation.mutate();
  };

  const handleShareTask = () => {
    if (completedTasks.has('share-friends')) return;
    
    const botUsername = import.meta.env.VITE_BOT_USERNAME || 'Paid_Adzbot';
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
    
    shareTaskMutation.mutate();
  };

  const handleChannelTask = () => {
    if (completedTasks.has('check-updates')) return;
    
    window.open('https://t.me/PaidAdsNews', '_blank');
    
    setTimeout(() => {
      channelTaskMutation.mutate();
    }, 2000);
  };

  const handleCommunityTask = () => {
    if (completedTasks.has('join-community')) return;
    
    window.open('https://t.me/PaidAdsCommunity', '_blank');
    
    setTimeout(() => {
      communityTaskMutation.mutate();
    }, 2000);
  };

  const renderTask = (
    id: string,
    icon: React.ReactNode,
    iconBg: string,
    title: string,
    reward: string,
    rewardColor: string,
    buttonText: string,
    onClick: () => void,
    isLoading: boolean
  ) => {
    const isCompleted = completedTasks.has(id);
    
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
              onClick={onClick}
              disabled={isCompleted || isLoading}
              className={`h-9 px-4 text-xs flex-shrink-0 min-w-[75px] font-semibold rounded-xl border-0 shadow-md ${
                isCompleted 
                  ? 'bg-gradient-to-r from-green-500 to-emerald-500' 
                  : 'bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600'
              } text-white`}
            >
              {isCompleted ? (
                <span className="flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  Done
                </span>
              ) : isLoading ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              ) : (
                buttonText
              )}
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
          {renderTask(
            'claim-streak',
            <Flame className="w-5 h-5" />,
            'bg-gradient-to-br from-orange-500 to-red-500',
            'Claim Streak',
            '+100 PAD',
            'text-orange-400',
            'Claim',
            handleClaimStreak,
            claimStreakMutation.isPending
          )}
          
          {renderTask(
            'share-friends',
            <Gift className="w-5 h-5" />,
            'bg-gradient-to-br from-pink-500 to-rose-500',
            'Share with Friends',
            '+1,000 PAD',
            'text-pink-400',
            'Share',
            handleShareTask,
            shareTaskMutation.isPending
          )}
          
          {renderTask(
            'check-updates',
            <Send className="w-5 h-5" />,
            'bg-gradient-to-br from-blue-500 to-cyan-500',
            'Check for Updates',
            '+1,000 PAD',
            'text-cyan-400',
            'Start',
            handleChannelTask,
            channelTaskMutation.isPending
          )}
          
          {renderTask(
            'join-community',
            <Users className="w-5 h-5" />,
            'bg-gradient-to-br from-purple-500 to-violet-500',
            'Join community',
            '+1,000 PAD',
            'text-purple-400',
            'Join',
            handleCommunityTask,
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
