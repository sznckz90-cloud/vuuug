import { useState, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { showNotification } from '@/components/AppNotification';
import { PlayCircle, Share2, Megaphone, Users, Play, Check } from 'lucide-react';
import { tonToPAD } from '@shared/constants';

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

  const watchAdMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/ads/watch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ adType: 'task_reward' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to watch ad');
      return data;
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user/stats'] });
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ['/api/auth/user'] }),
        queryClient.refetchQueries({ queryKey: ['/api/user/stats'] })
      ]);
      setCompletedTasks(prev => new Set([...prev, 'watch-ad']));
      const rewardPAD = tonToPAD(parseFloat(data.rewardAmount || '0.000005'));
      showNotification(`You received ${rewardPAD} PAD on your balance`, 'success');
    },
    onError: (error: any) => {
      showNotification(error.message || 'Failed to complete task', 'error');
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

  const handleWatchAd = async () => {
    if (completedTasks.has('watch-ad')) return;
    
    try {
      if (typeof window.show_9368336 === 'function') {
        await window.show_9368336();
      }
      watchAdMutation.mutate();
    } catch (error) {
      console.error('Ad display error:', error);
    }
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
    title: string,
    reward: string,
    buttonText: string,
    onClick: () => void,
    isLoading: boolean
  ) => {
    const isCompleted = completedTasks.has(id);
    
    return (
      <Card className="minimal-card mb-3">
        <CardContent className="p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="w-9 h-9 rounded-full bg-[#1A1A1A] border border-[#2A2A2A] flex items-center justify-center text-[#007BFF] flex-shrink-0">
                {icon}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-white font-medium text-xs truncate">{title}</h3>
                <p className="text-[#007BFF] text-xs font-bold">{reward}</p>
              </div>
            </div>
            <Button
              onClick={onClick}
              disabled={isCompleted || isLoading}
              className={`h-8 px-3 text-xs flex-shrink-0 min-w-[70px] ${isCompleted ? 'bg-green-600' : 'btn-primary'}`}
            >
              {isCompleted ? (
                <span className="flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  Done
                </span>
              ) : isLoading ? (
                'Wait...'
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
            'watch-ad',
            <PlayCircle className="w-5 h-5" />,
            'Just check in',
            '+500 PAD',
            'Start',
            handleWatchAd,
            watchAdMutation.isPending
          )}
          
          {renderTask(
            'share-friends',
            <Share2 className="w-5 h-5" />,
            'Share with Friends',
            '+1,000 PAD',
            'Share',
            handleShareTask,
            shareTaskMutation.isPending
          )}
          
          {renderTask(
            'check-updates',
            <Megaphone className="w-5 h-5" />,
            'Check for Updates',
            '+1,000 PAD',
            'Start',
            handleChannelTask,
            channelTaskMutation.isPending
          )}
          
          {renderTask(
            'join-community',
            <Users className="w-5 h-5" />,
            'Join community',
            '+1,000 PAD',
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
