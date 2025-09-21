import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Share2, RefreshCw, Users, Tv, ArrowRight, Check } from 'lucide-react';

interface Promotion {
  id: string;
  title: string;
  description: string;
  type: 'channel_visit' | 'share_link' | 'invite_friend' | 'ads_goal_mini' | 'ads_goal_light' | 'ads_goal_medium' | 'ads_goal_hard';
  channelUsername?: string;
  botUsername?: string;
  reward: string;
  completedCount: number;
  totalSlots: number;
  isActive: boolean;
  createdAt: string;
  claimUrl?: string;
  // New task status system fields
  completionStatus: 'locked' | 'claimable' | 'claimed';
  statusMessage: string;
  buttonText: string;
  progress?: {
    current: number;
    required: number;
    percentage: number;
  };
}

interface TaskCompletionStatus {
  completed: boolean;
  completedAt?: string;
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

export default function TaskSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [telegramInitData, setTelegramInitData] = useState<string | null>(null);

  // Check for Telegram environment on component mount
  useEffect(() => {
    const initData = getTelegramInitData();
    setTelegramInitData(initData);
  }, []);

  // Listen for real-time task removal events
  useEffect(() => {
    const handleTaskRemoved = (event: CustomEvent) => {
      const { promotionId } = event.detail;
      console.log(`🗑️ Task removed: ${promotionId}, refreshing task list`);
      
      // Invalidate queries to trigger refetch of tasks
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      queryClient.invalidateQueries({ queryKey: [`/api/tasks`, promotionId, 'status'] });
      
      // Show notification about task removal
      toast({
        title: "Task Removed",
        description: "A task has been removed and the list has been updated",
        variant: "destructive"
      });
    };

    // Add event listener for taskRemoved events from WebSocket
    window.addEventListener('taskRemoved', handleTaskRemoved as EventListener);

    // Cleanup event listener on component unmount
    return () => {
      window.removeEventListener('taskRemoved', handleTaskRemoved as EventListener);
    };
  }, [queryClient, toast]);

  // Fetch all active tasks
  const { data: tasksResponse, isLoading: tasksLoading } = useQuery<{success: boolean, tasks: Promotion[]}>({
    queryKey: ['/api/tasks'],
    retry: false,
  });
  
  const tasks = tasksResponse?.tasks || [];

  // Filter tasks - only show daily tasks, remove fix tasks completely
  const dailyTasks = tasks.filter(task => 
    ['channel_visit', 'share_link', 'invite_friend', 'ads_goal_mini', 'ads_goal_light', 'ads_goal_medium', 'ads_goal_hard'].includes(task.type)
  );

  // Get user referral link for sharing
  const { data: userData } = useQuery({
    queryKey: ['/api/auth/user'],
    retry: false,
  });

  // Verify task mutation (makes task claimable)
  const verifyTaskMutation = useMutation({
    mutationFn: async (params: { promotionId: string; taskType: string }) => {
      const currentTelegramData = getTelegramInitData();
      
      if (!currentTelegramData) {
        throw new Error('Please open this app inside Telegram to complete tasks');
      }
      
      const response = await fetch(`/api/tasks/${params.promotionId}/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-telegram-data': currentTelegramData,
        },
        body: JSON.stringify({
          taskType: params.taskType,
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to verify task');
      }
      
      return response.json();
    },
    onSuccess: (data, params) => {
      // Refresh task list to show updated status
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
    },
    onError: (error: any) => {
      toast({
        title: "Verification Failed",
        description: error.message || "Failed to verify task",
        variant: "destructive",
      });
    },
  });

  // Claim task mutation (credits reward)
  const claimTaskMutation = useMutation({
    mutationFn: async (params: { promotionId: string }) => {
      const currentTelegramData = getTelegramInitData();
      
      if (!currentTelegramData) {
        throw new Error('Please open this app inside Telegram to complete tasks');
      }
      
      const response = await fetch(`/api/tasks/${params.promotionId}/claim`, {
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
    onSuccess: (data, params) => {
      // Balance update will be shown via WebSocket
      
      // Invalidate and refetch relevant queries
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user/balance'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user/stats'] });
    },
    onError: (error: any) => {
      toast({
        title: "Claim Failed",
        description: error.message || "Failed to claim task",
        variant: "destructive",
      });
    },
  });

  // Handle task actions based on completion status and type
  const handleTaskAction = (task: Promotion) => {
    if (task.completionStatus === 'claimed') {
      // Task already claimed, do nothing
      return;
    }
    
    if (task.completionStatus === 'claimable') {
      // Task is ready to claim
      claimTaskMutation.mutate({ promotionId: task.id });
      return;
    }
    
    // Task is locked, perform the action to verify it
    if (task.type === 'channel_visit') {
      // Open channel link, then verify
      if (task.claimUrl) {
        window.open(task.claimUrl, '_blank');
      }
      // Immediately verify (no extra message needed)
      verifyTaskMutation.mutate({ promotionId: task.id, taskType: task.type });
      
    } else if (task.type === 'share_link') {
      // Open Telegram share with formatted message
      if (userData?.referralLink) {
        const message = `👋 Hey, I'm using this app to earn TON by watching ads & completing tasks.  
You can join too and start earning instantly! 🚀  

🔗 Join with my invite link: ${userData.referralLink}  

💡 When you sign up using my link, we both get rewards 🎁`;
        
        const encodedMessage = encodeURIComponent(message);
        const shareUrl = `https://t.me/share/url?text=${encodedMessage}`;
        window.open(shareUrl, '_blank');
        
        // The backend will verify via webhook when sharing is done
        // For now, we can verify immediately for testing
        verifyTaskMutation.mutate({ promotionId: task.id, taskType: task.type });
      }
      
    } else if (task.type === 'invite_friend') {
      // Show invite link for user to copy
      if (userData?.referralLink) {
        navigator.clipboard.writeText(userData.referralLink);
        toast({
          title: "Link Copied!",
          description: "Share this link to invite friends. Task will unlock when someone joins!",
        });
      }
      // Backend will verify when someone actually joins via referral
      
    } else if (task.type.startsWith('ads_goal_')) {
      // Redirect to ads section (you can implement this)
      toast({
        title: "Watch Ads",
        description: "Go to the Ads section to watch more ads!",
      });
      // Backend will verify when ads goal is reached
      
    } else {
      // Default verification for other task types
      verifyTaskMutation.mutate({ promotionId: task.id, taskType: task.type });
    }
  };

  // Function to get task icon based on type
  const getTaskIcon = (type: string) => {
    switch (type) {
      case 'share_link':
        return <Share2 className="w-6 h-6 text-green-500" />;
      case 'channel_visit':
        return <RefreshCw className="w-6 h-6 text-green-500" />;
      case 'invite_friend':
        return <Users className="w-6 h-6 text-green-500" />;
      case 'ads_goal_mini':
      case 'ads_goal_light':
      case 'ads_goal_medium':
      case 'ads_goal_hard':
        return <Tv className="w-6 h-6 text-green-500" />;
      default:
        return <ArrowRight className="w-6 h-6 text-green-500" />;
    }
  };

  const TaskCard = ({ task }: { task: Promotion }) => {
    const isTaskFull = task.completedCount >= task.totalSlots;
    const isProcessing = verifyTaskMutation.isPending || claimTaskMutation.isPending;
    
    // ALWAYS show tasks - never filter out
    return (
      <Card className="shadow-sm border border-border bg-card hover:bg-accent/5 transition-colors" data-testid={`card-task-${task.id}`}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            {/* Left: Icon and content */}
            <div className="flex items-center space-x-4 flex-1">
              {/* Task Icon */}
              <div className="flex-shrink-0">
                {getTaskIcon(task.type)}
              </div>
              
              {/* Task Info */}
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold text-foreground mb-1">
                  {task.title}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {task.statusMessage}
                </p>
                {task.progress && task.type.startsWith('ads_goal_') && (
                  <div className="text-xs text-muted-foreground mt-1">
                    Progress: {task.progress.current}/{task.progress.required} ads
                  </div>
                )}
              </div>
            </div>

            {/* Center: Reward Display */}
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <div className="text-2xl font-bold text-foreground">
                  {parseFloat(task.reward).toFixed(5)} TON
                </div>
              </div>
              
              {/* Right: Action Button */}
              <Button
                onClick={() => handleTaskAction(task)}
                disabled={isTaskFull || isProcessing || task.completionStatus === 'claimed'}
                data-testid={`button-complete-${task.id}`}
                className="flex-shrink-0 min-w-[80px] h-12"
                variant={task.completionStatus === 'claimed' ? "secondary" : "default"}
                size="sm"
              >
                {(() => {
                  if (isProcessing) {
                    return <div className="animate-spin">⏳</div>;
                  }
                  if (task.completionStatus === 'claimed') {
                    return <div className="text-green-600 flex items-center">✅ Done</div>;
                  }
                  if (task.completionStatus === 'claimable') {
                    return "Claim";
                  }
                  // Use the button text from backend
                  return task.buttonText || "Start";
                })()}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (tasksLoading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin text-primary text-xl mb-2">
          <i className="fas fa-spinner"></i>
        </div>
        <div className="text-muted-foreground">Loading tasks...</div>
      </div>
    );
  }

  return (
    <div data-testid="card-task-section">
      {/* Show warning if Telegram WebApp is not available */}
      {!telegramInitData && (
        <Alert className="mb-4 border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20">
          <AlertDescription className="text-yellow-800 dark:text-yellow-200">
            ⚠️ Please open this app inside Telegram to complete tasks and earn rewards.
          </AlertDescription>
        </Alert>
      )}
      
      {/* Daily Tasks Section Only */}
      <div className="space-y-2 mt-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-foreground flex items-center">
            <i className="fas fa-calendar-alt mr-2 text-green-600"></i>
            Daily Tasks
            <span className="ml-2 text-sm text-muted-foreground">Reset at 12:00 PM UTC</span>
          </h3>
        </div>
        
        {dailyTasks.length > 0 ? (
          dailyTasks.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))
        ) : (
          <div className="text-center py-8" data-testid="text-no-daily-tasks">
            <i className="fas fa-calendar-alt text-4xl text-muted-foreground mb-4"></i>
            <div className="text-muted-foreground text-lg font-medium">No daily tasks available</div>
            <div className="text-sm text-muted-foreground mt-2">Daily tasks reset at 12:00 PM UTC</div>
          </div>
        )}
      </div>

    </div>
  );
}