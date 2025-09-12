import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface Promotion {
  id: string;
  title: string;
  description: string;
  type: 'subscribe' | 'bot' | 'daily';
  channelUsername?: string;
  botUsername?: string;
  reward: string;
  completedCount: number;
  totalSlots: number;
  isActive: boolean;
  createdAt: string;
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
  const [activeTab, setActiveTab] = useState<'subscribe' | 'bot' | 'daily'>('subscribe');
  const [telegramInitData, setTelegramInitData] = useState<string | null>(null);

  // Check for Telegram environment on component mount
  useEffect(() => {
    const initData = getTelegramInitData();
    setTelegramInitData(initData);
  }, []);

  // Fetch all active tasks
  const { data: tasksResponse, isLoading: tasksLoading } = useQuery<{success: boolean, tasks: Promotion[]}>({
    queryKey: ['/api/tasks'],
    retry: false,
  });
  
  const tasks = tasksResponse?.tasks || [];

  // Filter tasks by category
  const subscribeTasks = tasks.filter(task => task.type === 'subscribe');
  const botTasks = tasks.filter(task => task.type === 'bot');
  
  // Daily task (hardcoded)
  const dailyTask: Promotion = {
    id: 'daily-check-update',
    title: 'check update',
    description: 'Check our latest updates and news',
    type: 'daily',
    channelUsername: 'PaidAdsNews',
    reward: '1000',
    completedCount: 0,
    totalSlots: 1000,
    isActive: true,
    createdAt: new Date().toISOString()
  };

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
      toast({
        title: "Task Completed! 🎉",
        description: `You earned $${data.rewardAmount || '0.00045'}!`,
      });
      
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
      
      if (task.type === 'subscribe' && task.channelUsername) {
        const channelUrl = `https://t.me/${task.channelUsername}`;
        window.open(channelUrl, '_blank');
      } else if (task.type === 'bot' && task.botUsername) {
        const botUrl = `https://t.me/${task.botUsername}`;
        window.open(botUrl, '_blank');
      } else if (task.type === 'daily' && task.channelUsername) {
        const channelUrl = `https://t.me/${task.channelUsername}`;
        window.open(channelUrl, '_blank');
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
    
    // Check if daily task is available (24 hour cooldown)
    const isDailyAvailable = () => {
      if (task.type !== 'daily') return true;
      if (!statusData?.completedAt) return true;
      
      const completedTime = new Date(statusData.completedAt).getTime();
      const now = new Date().getTime();
      const hoursPassed = (now - completedTime) / (1000 * 60 * 60);
      return hoursPassed >= 24;
    };
    
    const canComplete = isDailyAvailable() && !isCompleted && !isTaskFull;

    return (
      <Card className="shadow-sm border border-border" data-testid={`card-task-${task.id}`}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-base font-semibold text-foreground">{task.title}</CardTitle>
            </div>
            <Badge variant={isCompleted ? "default" : "secondary"} className="ml-2">
              ${task.reward}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground">
              {remainingSlots > 0 ? (
                <span className="text-green-600 dark:text-green-400 font-medium">
                  {remainingSlots}
                </span>
              ) : (
                <span className="text-red-600 dark:text-red-400 font-medium">$0.00025</span>
              )}
            </div>
            <Button
              size="sm"
              onClick={() => handleTaskAction(task, buttonPhase, setButtonPhase)}
              disabled={!canComplete || (buttonPhase === 'processing')}
              data-testid={`button-complete-${task.id}`}
              className="h-8 px-3 text-xs"
            >
              {buttonPhase === 'processing' 
                ? "Processing..." 
                : isCompleted 
                  ? "Completed ✓" 
                  : !isDailyAvailable() && task.type === 'daily'
                    ? "⏰ Wait 24h"
                    : isTaskFull 
                      ? "$0.00025" 
                      : buttonPhase === 'click'
                        ? "👆🏻"
                        : "✓ Check"
              }
            </Button>
          </div>
          
          {/* Progress bar */}
          <div className="mt-3">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>Progress</span>
              <span>{task.completedCount}/{task.totalSlots}</span>
            </div>
            <div className="w-full bg-secondary rounded-full h-1.5">
              <div 
                className="bg-primary h-1.5 rounded-full transition-all duration-300"
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
      
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'subscribe' | 'bot' | 'daily')}>
        <TabsList className="grid w-full grid-cols-3 mb-4 h-auto">
          <TabsTrigger value="subscribe" data-testid="tab-subscribe" className="px-2 py-2 text-xs">
            <i className="fas fa-users mr-1"></i>
            <span className="hidden sm:inline">Subscribe</span>
            <span className="sm:hidden">Sub</span>
            <span className="ml-1">({subscribeTasks.length})</span>
          </TabsTrigger>
          <TabsTrigger value="bot" data-testid="tab-bot" className="px-2 py-2 text-xs">
            <i className="fas fa-robot mr-1"></i>
            <span className="hidden sm:inline">Bot</span>
            <span className="sm:hidden">Bot</span>
            <span className="ml-1">({botTasks.length})</span>
          </TabsTrigger>
          <TabsTrigger value="daily" data-testid="tab-daily" className="px-2 py-2 text-xs">
            <i className="fas fa-calendar-day mr-1"></i>
            <span className="hidden sm:inline">Daily</span>
            <span className="sm:hidden">Day</span>
            <span className="ml-1">(1)</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="subscribe" className="space-y-3">
          {subscribeTasks.length > 0 ? (
            subscribeTasks.map((task) => (
              <TaskCard key={task.id} task={task} />
            ))
          ) : (
            <div className="text-center py-8" data-testid="text-no-subscribe-tasks">
              <i className="fas fa-users text-3xl text-muted-foreground mb-3"></i>
              <div className="text-muted-foreground">No subscription tasks available</div>
              <div className="text-xs text-muted-foreground mt-1">New tasks will appear here automatically</div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="bot" className="space-y-3">
          {botTasks.length > 0 ? (
            botTasks.map((task) => (
              <TaskCard key={task.id} task={task} />
            ))
          ) : (
            <div className="text-center py-8" data-testid="text-no-bot-tasks">
              <i className="fas fa-robot text-3xl text-muted-foreground mb-3"></i>
              <div className="text-muted-foreground">No bot tasks available</div>
              <div className="text-xs text-muted-foreground mt-1">New tasks will appear here automatically</div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="daily" className="space-y-3">
          <TaskCard key={dailyTask.id} task={dailyTask} />
        </TabsContent>
      </Tabs>

    </div>
  );
}