import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Tv, Check, RefreshCw } from 'lucide-react';
import { formatCurrency, formatTaskReward } from '@/lib/utils';

interface DailyTask {
  id: number;
  level: number;
  title: string;
  description: string;
  required: number;
  progress: number;
  completed: boolean;
  claimed: boolean;
  rewardAmount: string;
  canClaim: boolean;
}

interface TasksResponse {
  success: boolean;
  tasks: DailyTask[];
  adsWatchedToday: number;
  resetInfo: {
    nextReset: string;
    resetDate: string;
  };
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

  // Fetch daily tasks using new API
  const { data: tasksResponse, isLoading: tasksLoading, refetch } = useQuery<TasksResponse>({
    queryKey: ['/api/tasks/daily'],
    retry: false,
  });
  
  // Sort tasks: unclaimed/in-progress first, then claimed tasks at bottom
  const tasks = (tasksResponse?.tasks || []).sort((a, b) => {
    if (a.claimed && !b.claimed) return 1;
    if (!a.claimed && b.claimed) return -1;
    return a.level - b.level;
  });
  const adsWatchedToday = tasksResponse?.adsWatchedToday || 0;

  // Claim task reward mutation
  const claimTaskMutation = useMutation({
    mutationFn: async (taskLevel: number) => {
      const currentTelegramData = getTelegramInitData();
      
      if (!currentTelegramData) {
        throw new Error('Please open this app inside Telegram to complete tasks');
      }
      
      const response = await fetch(`/api/tasks/claim/${taskLevel}`, {
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
        title: "🎉 Task Completed!",
        description: `You earned ${formatCurrency(data.rewardAmount)}`,
      });
      
      // Refresh tasks and balance
      refetch();
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

  // Get next claimable task
  const getNextClaimableTask = () => {
    return tasks.find(task => !task.claimed);
  };

  // Check if task is available (sequential logic)
  const isTaskAvailable = (task: DailyTask) => {
    if (task.level === 1) return true; // First task is always available
    
    // Check if previous task is claimed
    const previousTask = tasks.find(t => t.level === task.level - 1);
    return previousTask?.claimed || false;
  };

  // Render task card
  const renderTaskCard = (task: DailyTask) => {
    const progressPercentage = task.required > 0 ? (task.progress / task.required) * 100 : 0;
    const isAvailable = isTaskAvailable(task);
    
    return (
      <Card key={task.id} className={`mb-4 ${!isAvailable ? 'opacity-50' : ''}`}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100 text-purple-600">
                <Tv size={20} />
              </div>
              <CardTitle className="text-lg">{task.title}</CardTitle>
            </div>
            <Badge variant="outline" className="px-3 py-1">
              {formatTaskReward(task.rewardAmount)}
            </Badge>
          </div>
        </CardHeader>
        
        <CardContent className="pt-0">
          {/* Progress bar */}
          <div className="mb-3">
            <div className="flex justify-between text-sm text-muted-foreground mb-1">
              <span>Progress</span>
              <span>{Math.min(task.progress, task.required)}/{task.required} ads</span>
            </div>
            <Progress value={progressPercentage} className="h-2" />
          </div>
          
          {/* Show message if task is locked */}
          {!isAvailable && !task.claimed && (
            <div className="text-sm text-muted-foreground text-center py-2">
              Complete previous tasks first
            </div>
          )}

          {/* Claim button */}
          {task.claimed ? (
            <Button disabled className="w-full flex items-center gap-2 bg-green-600 text-white">
              <Check size={16} />
              Done
            </Button>
          ) : task.completed && isAvailable ? (
            <Button 
              onClick={() => claimTaskMutation.mutate(task.level)}
              disabled={claimTaskMutation.isPending}
              className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white"
            >
              {claimTaskMutation.isPending ? (
                <RefreshCw size={16} className="animate-spin" />
              ) : (
                "claim"
              )}
            </Button>
          ) : null}
        </CardContent>
      </Card>
    );
  };

  if (tasksLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <RefreshCw className="animate-spin text-muted-foreground" size={24} />
        <span className="ml-2">Loading tasks...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Show warning if Telegram WebApp is not available */}
      {!telegramInitData && (
        <Alert className="mb-4 border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20">
          <AlertDescription className="text-yellow-800 dark:text-yellow-200">
            ⚠️ Please open this app inside Telegram to complete tasks and earn rewards.
          </AlertDescription>
        </Alert>
      )}
      
      {/* Task list header */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Reset at 00:00 UTC</span>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => refetch()}
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
              <Tv className="text-purple-600" size={20} />
              <span className="font-medium">Ads Watched Today</span>
            </div>
            <Badge variant="secondary" className="text-lg px-3 py-1">
              {adsWatchedToday}/160
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Task cards */}
      {tasks.length > 0 ? (
        <div className="max-h-[400px] overflow-y-auto p-1">
          {tasks.map(renderTaskCard)}
        </div>
      ) : (
        <Card>
          <CardContent className="p-6 text-center">
            <Tv className="mx-auto text-muted-foreground mb-4" size={48} />
            <p className="text-muted-foreground">Loading your daily tasks...</p>
            <p className="text-sm text-muted-foreground mt-2">Tasks reset at 00:00 UTC daily</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}