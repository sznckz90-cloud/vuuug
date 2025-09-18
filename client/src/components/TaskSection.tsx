import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
// Removed Tabs import - no longer using tabs, only Daily Tasks
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface Promotion {
  id: string;
  title: string;
  description: string;
  type: 'fix' | 'channel_visit' | 'share_link' | 'invite_friend' | 'ads_goal_mini' | 'ads_goal_light' | 'ads_goal_medium' | 'ads_goal_hard' | 'channel' | 'bot' | 'daily';
  channelUsername?: string;
  botUsername?: string;
  reward: string;
  completedCount: number;
  totalSlots: number;
  isActive: boolean;
  createdAt: string;
  claimUrl?: string;
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

  // Complete task mutation
  const completeTaskMutation = useMutation({
    mutationFn: async (params: { promotionId: string; task: Promotion }) => {
      const currentTelegramData = getTelegramInitData();
      
      if (!currentTelegramData) {
        throw new Error('Please open this app inside Telegram to complete tasks');
      }
      
      const response = await fetch(`/api/tasks/${params.promotionId}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-telegram-data': currentTelegramData,
        },
        body: JSON.stringify({
          taskType: params.task.type,
          channelUsername: params.task.channelUsername,
          botUsername: params.task.botUsername,
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to complete task');
      }
      
      return response.json();
    },
    onSuccess: (data, params) => {
      // Purple notification will be shown via WebSocket balance_update message
      // Removed duplicate client-side notification to prevent duplicates
      
      // Invalidate and refetch relevant queries
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      queryClient.invalidateQueries({ queryKey: [`/api/tasks`, params.promotionId, 'status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user/balance'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user/stats'] });
    },
    onError: (error: any) => {
      toast({
        title: "Task Failed",
        description: error.message || "Failed to complete task",
        variant: "destructive",
      });
    },
  });

  const handleTaskAction = async (task: Promotion, phase: string, setPhase: (phase: 'click' | 'check' | 'processing') => void) => {
    if (phase === 'click') {
      // First click - show check button
      setPhase('check');
    } else if (phase === 'check') {
      // Second click - open link and process reward
      setPhase('processing');
      
      // Use the properly generated claimUrl from the backend
      const url = (task as any).claimUrl;
      if (url) {
        // Check if on mobile device
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        // For fix tasks, open the URL directly
        window.open(url, '_blank');
      } else {
        console.error('No claimUrl available for task:', task);
      }

      // Wait a moment for user to complete the action
      setTimeout(() => {
        completeTaskMutation.mutate({ promotionId: task.id, task });
        setPhase('click'); // Reset for next time
      }, 3000);
    }
  };

  const TaskCard = ({ task }: { task: Promotion }) => {
    const [buttonPhase, setButtonPhase] = useState<'click' | 'check' | 'processing'>('click');
    
    // Check if user has completed this task
    const { data: statusData } = useQuery<TaskCompletionStatus>({
      queryKey: ['/api/tasks', task.id, 'status'],
      retry: false,
    });

    const isCompleted = statusData?.completed;
    const isTaskFull = task.completedCount >= task.totalSlots;
    const remainingSlots = task.totalSlots - task.completedCount;
    
    // All tasks are daily tasks now - always show TON
    const isDailyTask = true; // All tasks shown are daily tasks
    const canComplete = !isCompleted && !isTaskFull;

    // Hide completed tasks entirely
    if (isCompleted) {
      return null;
    }

    return (
      <Card className="shadow-sm border border-border" data-testid={`card-task-${task.id}`}>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-sm font-semibold text-foreground">{task.title}</CardTitle>
            </div>
            <Badge variant={isCompleted ? "default" : "secondary"} className="ml-2 text-xs">
              {parseFloat(task.reward).toFixed(7)} TON
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-0 pb-3">
          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground">
              {remainingSlots > 0 ? (
                <span className="text-green-600 dark:text-green-400 font-medium">
                  {remainingSlots}
                </span>
              ) : (
                <span className="text-red-600 dark:text-red-400 font-medium">Sold Out</span>
              )}
            </div>
            <Button
              size="sm"
              onClick={() => handleTaskAction(task, buttonPhase, setButtonPhase)}
              disabled={!canComplete || (buttonPhase === 'processing')}
              data-testid={`button-complete-${task.id}`}
              className="h-7 px-2 text-xs"
            >
              {buttonPhase === 'processing' 
                ? "Processing..." 
                : isTaskFull 
                  ? "Sold Out" 
                  : !isCompleted
                    ? (buttonPhase === 'click' ? "👆🏻" : "✓ Check")
                    : "Completed ✓"
              }
            </Button>
          </div>
          
          {/* Progress bar */}
          <div className="mt-2">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>Progress</span>
              <span>{task.completedCount}/{task.totalSlots}</span>
            </div>
            <div className="w-full bg-secondary rounded-full h-1">
              <div 
                className="bg-primary h-1 rounded-full transition-all duration-300"
                style={{ width: `${(task.completedCount / task.totalSlots) * 100}%` }}
              />
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