import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { RefreshCw, Tv, ArrowRight, Check, ExternalLink } from 'lucide-react';

interface Task {
  taskType: string;
  progress: number;
  required: number;
  completed: boolean;
  claimed: boolean;
  rewardAmount: string;
  status: 'in_progress' | 'claimable' | 'completed';
}

interface TasksResponse {
  tasks: Task[];
  adsWatchedToday: number;
}

// Function to check if we're in Telegram WebApp environment
const getTelegramInitData = (): string | null => {
  if (typeof window !== 'undefined') {
    // First try to get from Telegram WebApp
    if (window.Telegram?.WebApp?.initData) {
      return window.Telegram.WebApp.initData;
    }
    
    // Fallback: try to get from URL params (for testing)
    const urlParams = new URLSearchParams(window.location.search);
    const tgData = urlParams.get('tgData');
    if (tgData) {
      return tgData;
    }
  }
  return null;
};

// Task configuration
const taskConfig = {
  channel_visit: {
    title: 'Visit Channel',
    description: 'Visit our Telegram channel for updates',
    icon: Tv,
    color: 'blue',
    channelUrl: 'https://t.me/your_channel'
  },
  ads_mini: {
    title: 'Mini Goal',
    description: 'Watch 15 ads',
    icon: Tv,
    color: 'orange'
  },
  ads_light: {
    title: 'Light Goal',
    description: 'Watch 25 ads',
    icon: Tv,
    color: 'orange'
  },
  ads_medium: {
    title: 'Medium Goal',
    description: 'Watch 45 ads',
    icon: Tv,
    color: 'orange'
  },
  ads_hard: {
    title: 'Hard Goal',
    description: 'Watch 75 ads',
    icon: Tv,
    color: 'orange'
  }
};

export default function TaskSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [telegramInitData, setTelegramInitData] = useState<string | null>(null);

  // Check for Telegram environment on component mount
  useEffect(() => {
    const initData = getTelegramInitData();
    setTelegramInitData(initData);
  }, []);

  // Fetch task statuses using new API
  const { data: tasksResponse, isLoading: tasksLoading, refetch: refetchTasks } = useQuery<TasksResponse>({
    queryKey: ['/api/tasks/status'],
    retry: false,
  });
  
  const tasks = tasksResponse?.tasks || [];
  const adsWatchedToday = tasksResponse?.adsWatchedToday || 0;


  // Complete channel visit mutation
  const completeChannelVisitMutation = useMutation({
    mutationFn: async () => {
      const currentTelegramData = getTelegramInitData();
      
      if (!currentTelegramData) {
        throw new Error('Please open this app inside Telegram to complete tasks');
      }
      
      const response = await fetch('/api/tasks/channel-visit/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-telegram-data': currentTelegramData,
        },
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to complete task');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Channel Visit Completed",
        description: "You can now claim your reward!",
      });
      refetchTasks();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to complete channel visit",
        variant: "destructive",
      });
    },
  });

  // Complete share link mutation
  const completeShareLinkMutation = useMutation({
    mutationFn: async () => {
      const currentTelegramData = getTelegramInitData();
      
      if (!currentTelegramData) {
        throw new Error('Please open this app inside Telegram to complete tasks');
      }
      
      const response = await fetch('/api/tasks/share-link/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-telegram-data': currentTelegramData,
        },
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to complete task');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Share Link Completed",
        description: "You can now claim your reward!",
      });
      refetchTasks();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to complete share link",
        variant: "destructive",
      });
    },
  });

  // Claim task reward mutation
  const claimTaskMutation = useMutation({
    mutationFn: async (taskType: string) => {
      const currentTelegramData = getTelegramInitData();
      
      if (!currentTelegramData) {
        throw new Error('Please open this app inside Telegram to complete tasks');
      }
      
      const response = await fetch(`/api/tasks/${taskType}/claim`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-telegram-data': currentTelegramData,
        },
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to claim task');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Reward Claimed!",
        description: `You earned ${parseFloat(data.rewardAmount).toFixed(7)} TON`,
      });
      refetchTasks();
      // Refresh balance
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user/stats'] });
    },
    onError: (error: any) => {
      toast({
        title: "Claim Failed",
        description: error.message || "Failed to claim task reward",
        variant: "destructive",
      });
    },
  });

  // Handle channel visit button click
  const handleChannelVisit = () => {
    const channelUrl = taskConfig.channel_visit.channelUrl;
    // Open the channel link
    window.open(channelUrl, '_blank');
    
    // Complete the task after opening the channel
    setTimeout(() => {
      completeChannelVisitMutation.mutate();
    }, 2000);
  };

  // Handle share link button click
  const handleShareLink = () => {
    const referralCode = userData?.user?.referralCode || 'default';
    const botUsername = 'cashwatch_bot'; // Replace with actual bot username
    const affiliateLink = `https://t.me/${botUsername}?start=${referralCode}`;
    
    const shareMessage = `👋 Hey, I'm using this app to earn TON by watching ads & completing tasks.
You can join too and start earning instantly! 🚀

🔗 Join with my invite link: ${affiliateLink}

💡 When you sign up using my link, we both get rewards 🎁`;

    // Copy message to clipboard and show notification
    navigator.clipboard?.writeText(shareMessage);
    toast({
      title: "Share Message Copied",
      description: "Share message copied to clipboard! Share it with friends.",
    });
    
    // Complete the task after initiating share
    setTimeout(() => {
      completeShareLinkMutation.mutate();
    }, 1000);
  };

  // Format TON amount to 7 decimal places
  const formatTON = (amount: string) => {
    return parseFloat(amount).toFixed(7);
  };

  // Get task configuration
  const getTaskConfig = (taskType: string) => {
    return taskConfig[taskType as keyof typeof taskConfig] || {
      title: taskType,
      description: 'Complete this task',
      icon: ArrowRight,
      color: 'gray'
    };
  };

  // Render task card
  const renderTaskCard = (task: Task) => {
    const config = getTaskConfig(task.taskType);
    const IconComponent = config.icon;
    const progressPercentage = task.required > 0 ? (task.progress / task.required) * 100 : 0;
    
    return (
      <Card key={task.taskType} className="mb-4">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg bg-${config.color}-100 text-${config.color}-600`}>
                <IconComponent size={20} />
              </div>
              <div>
                <CardTitle className="text-lg">{config.title}</CardTitle>
                <CardDescription>{config.description}</CardDescription>
              </div>
            </div>
            <Badge 
              variant={task.claimed ? "secondary" : task.completed ? "default" : "outline"}
              className="ml-2"
            >
              {formatTON(task.rewardAmount)} TON
            </Badge>
          </div>
        </CardHeader>
        
        <CardContent className="pt-0">
          {/* Progress bar for tasks with progress */}
          {task.required > 1 && (
            <div className="mb-3">
              <div className="flex justify-between text-sm text-muted-foreground mb-1">
                <span>Progress</span>
                <span>{task.progress}/{task.required}</span>
              </div>
              <Progress value={progressPercentage} className="h-2" />
            </div>
          )}
          
          {/* Action button */}
          <div className="flex justify-end">
            {task.claimed ? (
              <Button disabled className="flex items-center gap-2">
                <Check size={16} />
                Done
              </Button>
            ) : task.completed ? (
              <Button 
                onClick={() => claimTaskMutation.mutate(task.taskType)}
                disabled={claimTaskMutation.isPending}
                className="flex items-center gap-2"
              >
                {claimTaskMutation.isPending ? (
                  <RefreshCw size={16} className="animate-spin" />
                ) : (
                  <ArrowRight size={16} />
                )}
                Claim
              </Button>
            ) : (
              <div>
                {task.taskType === 'channel_visit' && (
                  <Button 
                    onClick={handleChannelVisit}
                    disabled={completeChannelVisitMutation.isPending}
                    className="flex items-center gap-2"
                  >
                    <ExternalLink size={16} />
                    Visit Channel
                  </Button>
                )}
                {task.taskType === 'share_link' && (
                  <Button 
                    onClick={handleShareLink}
                    disabled={completeShareLinkMutation.isPending}
                    className="flex items-center gap-2"
                  >
                    <Share2 size={16} />
                    Share Link
                  </Button>
                )}
                {task.taskType === 'invite_friend' && (
                  <Button disabled variant="outline">
                    Invite Friend
                  </Button>
                )}
                {task.taskType.startsWith('ads_') && (
                  <Button disabled variant="outline">
                    Watch Ads ({task.progress}/{task.required})
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  if (tasksLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <RefreshCw className="animate-spin text-muted-foreground" size={24} />
      </div>
    );
  }

  if (!telegramInitData) {
    return (
      <Alert className="mb-4">
        <AlertDescription>
          This app is designed to work as a Telegram Mini App. For full functionality, access it through your Telegram bot.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {/* Task list header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Daily Tasks</h2>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => refetchTasks()}
          disabled={tasksLoading}
        >
          <RefreshCw size={16} className={tasksLoading ? "animate-spin" : ""} />
        </Button>
      </div>

      {/* Ads counter display */}
      <Card className="bg-muted/50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Tv className="text-orange-600" size={20} />
              <span className="font-medium">Ads Watched Today</span>
            </div>
            <Badge variant="secondary">{adsWatchedToday}</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Task cards */}
      {tasks.length > 0 ? (
        <div>
          {tasks.map(renderTaskCard)}
        </div>
      ) : (
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground">No tasks available at the moment.</p>
            <p className="text-sm text-muted-foreground mt-2">Daily tasks reset at 12:00 PM UTC</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}