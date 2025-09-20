import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
// Removed Tabs import - no longer using tabs, only Daily Tasks
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Share2, RefreshCw, Users, Tv, ArrowRight } from 'lucide-react';

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
  // New enhanced task status fields
  isAvailable?: boolean;
  completionStatus?: 'claimable' | 'not_eligible' | 'completed_today' | 'unknown';
  statusMessage?: string;
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

  // Helper functions for API calls
  const recordChannelVisit = async () => {
    const response = await fetch('/api/record-channel-visit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-telegram-data': getTelegramInitData() || '',
      },
    });
    return response.json();
  };

  const recordLinkShare = async () => {
    const response = await fetch('/api/record-link-share', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-telegram-data': getTelegramInitData() || '',
      },
    });
    return response.json();
  };

  const checkTaskEligibility = async (taskType: string) => {
    const response = await fetch(`/api/user/task-eligibility/${taskType}`, {
      headers: {
        'x-telegram-data': getTelegramInitData() || '',
      },
    });
    return response.json();
  };

  const handleTaskAction = async (task: Promotion, phase: string, setPhase: (phase: 'click' | 'check' | 'processing') => void) => {
    if (phase === 'click') {
      // Handle different task types with specific flows
      if (task.type === 'channel_visit') {
        // Channel Visit Task: Show "Visit Channel" button, redirect and mark as visited
        setPhase('processing');
        try {
          // Open channel link (use task-specific channel or bot username)
          const channelUrl = task.channelUsername 
            ? `https://t.me/${task.channelUsername}`
            : task.botUsername 
            ? `https://t.me/${task.botUsername}`
            : 'https://t.me/PaidAdsNews'; // fallback
          window.open(channelUrl, '_blank');
          // Record channel visit
          await recordChannelVisit();
          toast({
            title: "Channel Visit Recorded!",
            description: "You visited the channel. You can now claim your reward.",
          });
          // Refresh task data
          queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
          setPhase('check'); // Show claim button
        } catch (error) {
          console.error('Error recording channel visit:', error);
          setPhase('click');
        }
      } else if (task.type === 'share_link') {
        // App Link Share Task: Show "Share Link" button, open share dialog and mark as shared
        setPhase('processing');
        try {
          // Get user data for affiliate link
          const user = await fetch('/api/auth/user', {
            headers: { 'x-telegram-data': getTelegramInitData() || '' }
          }).then(r => r.json());
          
          if (user.referralLink) {
            // Copy to clipboard and show share dialog
            await navigator.clipboard.writeText(user.referralLink);
            
            // Record link share
            await recordLinkShare();
            
            toast({
              title: "Link Shared!",
              description: "Your affiliate link has been copied to clipboard and share recorded.",
            });
            
            // Refresh task data
            queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
            setPhase('check'); // Show claim button
          }
        } catch (error) {
          console.error('Error recording link share:', error);
          setPhase('click');
        }
      } else if (task.type === 'invite_friend') {
        // Invite Friend Task: Check if user has made a referral today
        setPhase('processing');
        try {
          const eligibility = await checkTaskEligibility('invite_friend');
          if (eligibility.isEligible) {
            setPhase('check'); // Show claim button
          } else {
            toast({
              title: "Not Eligible Yet",
              description: "You need to invite a friend using your referral link first.",
              variant: "destructive",
            });
            setPhase('click');
          }
        } catch (error) {
          console.error('Error checking invite friend eligibility:', error);
          setPhase('click');
        }
      } else if (task.type.startsWith('ads_goal_')) {
        // Ads Task: Check if user has watched enough ads
        setPhase('processing');
        try {
          const eligibility = await checkTaskEligibility(task.type);
          if (eligibility.isEligible) {
            setPhase('check'); // Show claim button
          } else {
            toast({
              title: "Not Eligible Yet",
              description: eligibility.message || "You need to watch more ads first.",
              variant: "destructive",
            });
            setPhase('click');
          }
        } catch (error) {
          console.error('Error checking ads goal eligibility:', error);
          setPhase('click');
        }
      } else {
        // Default behavior for other task types
        setPhase('check');
      }
    } else if (phase === 'check') {
      // Claim phase - validate eligibility and claim reward
      setPhase('processing');
      
      // Final eligibility check before claiming
      try {
        const eligibility = await checkTaskEligibility(task.type);
        if (!eligibility.isEligible) {
          toast({
            title: "Not Eligible",
            description: eligibility.message || "You are not eligible to claim this reward yet.",
            variant: "destructive",
          });
          setPhase('click');
          return;
        }
        
        // Proceed with claiming
        completeTaskMutation.mutate({ promotionId: task.id, task });
        setPhase('click'); // Reset for next time
      } catch (error) {
        console.error('Error checking eligibility for claim:', error);
        // Proceed with claim anyway if eligibility check fails
        completeTaskMutation.mutate({ promotionId: task.id, task });
        setPhase('click');
      }
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
    const [buttonPhase, setButtonPhase] = useState<'click' | 'check' | 'processing'>('click');
    
    // Check if user has completed this task
    const { data: statusData } = useQuery<TaskCompletionStatus>({
      queryKey: ['/api/tasks', task.id, 'status'],
      retry: false,
    });

    const isCompleted = statusData?.completed || task.completionStatus === 'completed_today';
    const isTaskFull = task.completedCount >= task.totalSlots;
    const remainingSlots = task.totalSlots - task.completedCount;
    
    // All tasks are daily tasks now - always show TON
    const isDailyTask = true; // All tasks shown are daily tasks
    
    // Use server-side eligibility status - task.completionStatus is authoritative
    const isClaimable = task.completionStatus === 'claimable' || task.isAvailable;
    const canComplete = !isCompleted && !isTaskFull;
    
    // Determine button behavior based on server-side status
    const shouldShowClaimButton = isClaimable || buttonPhase === 'check';
    
    // Reset button phase when task status changes from server
    React.useEffect(() => {
      if (isCompleted) {
        setButtonPhase('click'); // Reset when completed
      } else if (isClaimable && buttonPhase === 'click') {
        setButtonPhase('check'); // Auto-show claim button when eligible
      }
    }, [isCompleted, isClaimable, buttonPhase]);
    
    // Don't show completed daily tasks (unless they're ads goals for progress tracking)
    if (isCompleted && !task.type.startsWith('ads_goal_')) {
      return null;
    }

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
                  {task.title} ({getActionLabel(task.type)}) → Reward: {parseFloat(task.reward).toFixed(5)} TON
                </h3>
                <p className="text-sm text-muted-foreground">
                  {task.progress && task.type.startsWith('ads_goal_') 
                    ? `Progress: ${task.progress.current}/${task.progress.required} ads watched`
                    : "Daily task completion"
                  }
                </p>
              </div>
            </div>

            {/* Center: Progress Display for ads tasks */}
            <div className="flex items-center space-x-4">
              {task.progress && task.type.startsWith('ads_goal_') && (
                <div className="text-right">
                  <div className="text-sm font-medium text-muted-foreground">
                    {task.progress.current}/{task.progress.required}
                  </div>
                </div>
              )}
              
              {/* Right: Action Button */}
              <Button
                onClick={() => handleTaskAction(task, buttonPhase, setButtonPhase)}
                disabled={isCompleted || (buttonPhase === 'processing') || (!canComplete && !isClaimable)}
                data-testid={`button-complete-${task.id}`}
                className="flex-shrink-0 min-w-fit px-4 py-2"
                variant={
                  isCompleted 
                    ? "secondary" 
                    : (isClaimable || buttonPhase === 'check') 
                    ? "default" 
                    : (!isClaimable && (task.type.startsWith('ads_goal_') || task.type === 'invite_friend'))
                    ? "secondary"
                    : "outline"
                }
                size="sm"
              >
                {(() => {
                  if (buttonPhase === 'processing') {
                    return (
                      <div className="flex items-center gap-2">
                        <div className="animate-spin">⏳</div>
                        Processing...
                      </div>
                    );
                  }
                  if (isCompleted) {
                    return (
                      <div className="flex items-center gap-2 text-green-600">
                        ✓ Completed
                      </div>
                    );
                  }
                  // Show claim button only when server confirms eligibility
                  if ((buttonPhase === 'check' || isClaimable) && !isCompleted) {
                    return (
                      <div className="flex items-center gap-2">
                        <ArrowRight className="w-4 h-4" />
                        Claim Reward
                      </div>
                    );
                  }
                  
                  // Show status message for ads goals if not claimable but not completed
                  if (task.type.startsWith('ads_goal_') && !isClaimable && !isCompleted) {
                    return (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Tv className="w-4 h-4" />
                        {task.statusMessage || "Watch more ads"}
                      </div>
                    );
                  }
                  
                  // Show status message for invite friend if not claimable
                  if (task.type === 'invite_friend' && !isClaimable && !isCompleted) {
                    return (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Users className="w-4 h-4" />
                        Need 1 referral
                      </div>
                    );
                  }
                  
                  // Initial phase - show action-specific buttons for actionable tasks
                  switch (task.type) {
                    case 'channel_visit':
                      return (
                        <div className="flex items-center gap-2">
                          <RefreshCw className="w-4 h-4" />
                          Visit Channel
                        </div>
                      );
                    case 'share_link':
                      return (
                        <div className="flex items-center gap-2">
                          <Share2 className="w-4 h-4" />
                          Share Link
                        </div>
                      );
                    case 'invite_friend':
                      return (
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4" />
                          Check Status
                        </div>
                      );
                    default: // ads goal tasks
                      return (
                        <div className="flex items-center gap-2">
                          <Tv className="w-4 h-4" />
                          Check Status
                        </div>
                      );
                  }
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