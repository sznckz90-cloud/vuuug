import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface Promotion {
  id: string;
  title: string;
  description: string;
  type: 'subscribe' | 'bot';
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
}

export default function TaskSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'subscribe' | 'bot'>('subscribe');

  // Fetch all active tasks
  const { data: tasksResponse, isLoading: tasksLoading } = useQuery<{success: boolean, tasks: Promotion[]}>({
    queryKey: ['/api/tasks'],
    retry: false,
  });
  
  const tasks = tasksResponse?.tasks || [];

  // Filter tasks by category
  const subscribeTasks = tasks.filter(task => task.type === 'subscribe');
  const botTasks = tasks.filter(task => task.type === 'bot');

  // Complete task mutation
  const completeTaskMutation = useMutation({
    mutationFn: async (promotionId: string) => {
      const response = await fetch(`/api/tasks/${promotionId}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to complete task');
      }
      
      return response.json();
    },
    onSuccess: (data, promotionId) => {
      toast({
        title: "Task Completed! 🎉",
        description: `You earned $${data.rewardAmount || '0.00045'}!`,
      });
      
      // Invalidate and refetch relevant queries
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      queryClient.invalidateQueries({ queryKey: [`/api/tasks`, promotionId, 'status'] });
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

  const handleCompleteTask = async (task: Promotion) => {
    if (task.type === 'subscribe' && task.channelUsername) {
      // Open Telegram channel
      const channelUrl = `https://t.me/${task.channelUsername}`;
      window.open(channelUrl, '_blank');
    } else if (task.type === 'bot' && task.botUsername) {
      // Open Telegram bot
      const botUrl = `https://t.me/${task.botUsername}`;
      window.open(botUrl, '_blank');
    }

    // Wait a moment for user to complete the action
    setTimeout(() => {
      completeTaskMutation.mutate(task.id);
    }, 3000);
  };

  const TaskCard = ({ task }: { task: Promotion }) => {
    // Check if user has completed this task
    const { data: statusData } = useQuery<TaskCompletionStatus>({
      queryKey: ['/api/tasks', task.id, 'status'],
      retry: false,
    });

    const isCompleted = statusData?.completed;
    const isTaskFull = task.completedCount >= task.totalSlots;
    const remainingSlots = task.totalSlots - task.completedCount;

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
                <>
                  <span className="text-green-600 dark:text-green-400 font-medium">
                    {remainingSlots} slots left
                  </span>
                  {' '}of {task.totalSlots}
                </>
              ) : (
                <span className="text-red-600 dark:text-red-400 font-medium">$0.00025</span>
              )}
            </div>
            <Button
              size="sm"
              onClick={() => handleCompleteTask(task)}
              disabled={isCompleted || isTaskFull || completeTaskMutation.isPending}
              data-testid={`button-complete-${task.id}`}
              className="h-8 px-3 text-xs"
            >
              {completeTaskMutation.isPending 
                ? "Processing..." 
                : isCompleted 
                  ? "Completed ✓" 
                  : isTaskFull 
                    ? "$0.00025" 
                    : "Complete"
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
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'subscribe' | 'bot')}>
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="subscribe" data-testid="tab-subscribe">
            <i className="fas fa-users mr-2"></i>
            Subscribe ({subscribeTasks.length})
          </TabsTrigger>
          <TabsTrigger value="bot" data-testid="tab-bot">
            <i className="fas fa-robot mr-2"></i>
            Bot ({botTasks.length})
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
      </Tabs>

      {tasks.length === 0 && (
        <div className="text-center py-8" data-testid="text-no-tasks">
          <i className="fas fa-tasks text-3xl text-muted-foreground mb-3"></i>
          <div className="text-muted-foreground font-medium">No tasks available</div>
          <div className="text-xs text-muted-foreground mt-1">
            Tasks are created through the Telegram bot and will sync automatically
          </div>
        </div>
      )}
    </div>
  );
}