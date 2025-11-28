import { useAuth } from "@/hooks/useAuth";
import Layout from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle, Target, Radio, Bot as BotIcon, Sparkles, ChevronRight, Handshake } from "lucide-react";
import { showNotification } from "@/components/AppNotification";
import { useState } from "react";
import { useLocation } from "wouter";

interface Task {
  id: string;
  taskType: string;
  title: string;
  link: string;
  totalClicksRequired: number;
  currentClicks: number;
  costPerClick: string;
  totalCost: string;
  status: string;
  advertiserId: string;
  createdAt: string;
  completedAt?: string;
}

interface AppSettings {
  taskCostPerClick?: number;
  taskRewardPerClick?: number;
  taskRewardPAD?: number;
  partnerTaskRewardPAD?: number;
  [key: string]: any;
}

export default function Tasks() {
  const { user, isLoading, authenticateWithTelegramWebApp } = useAuth();
  const queryClient = useQueryClient();
  const [clickedTasks, setClickedTasks] = useState<Set<string>>(new Set());
  const [, setLocation] = useLocation();
  const [selectedCategory, setSelectedCategory] = useState<"channel" | "bot" | "partner" | null>(null);

  const { data: appSettings } = useQuery<AppSettings>({
    queryKey: ['/api/app-settings'],
    retry: false,
    refetchOnMount: true,
  });

  const costPerClick = appSettings?.taskCostPerClick || 0.0003;
  const rewardPerClick = appSettings?.taskRewardPerClick || 0.000175;
  const rewardPAD = appSettings?.taskRewardPAD || 1750;
  const partnerRewardPAD = 5;

  const { data: tasksData, isLoading: tasksLoading } = useQuery<{
    success: boolean;
    tasks: Task[];
  }>({
    queryKey: ["/api/advertiser-tasks"],
    retry: false,
    refetchOnMount: true,
  });

  const checkTaskClickedMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const response = await fetch(`/api/advertiser-tasks/${taskId}/has-clicked`, {
        credentials: "include",
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const error: any = new Error(errorData.message || "Failed to check task status");
        error.status = response.status;
        error.errorCode = errorData.error_code;
        throw error;
      }
      return response.json();
    },
  });

  const clickTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const response = await fetch(`/api/advertiser-tasks/${taskId}/click`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message);
      }
      return data;
    },
    onSuccess: (data, taskId) => {
      const padReward = Math.floor(parseFloat(data.reward) * 10000000);
      showNotification(`You earned ${padReward.toLocaleString()} PAD!`, "success");
      queryClient.invalidateQueries({ queryKey: ["/api/advertiser-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      setClickedTasks(prev => {
        const newSet = new Set(prev);
        newSet.delete(taskId);
        return newSet;
      });
    },
    onError: (error: Error, taskId) => {
      showNotification(error.message || "Failed to complete task", "error");
      setClickedTasks(prev => {
        const newSet = new Set(prev);
        newSet.delete(taskId);
        return newSet;
      });
    },
  });

  const handleTaskClick = async (task: Task) => {
    if (!task.link || task.link.trim() === '') {
      showNotification("Task link is missing or invalid", "error");
      return;
    }

    if (clickedTasks.has(task.id)) {
      clickTaskMutation.mutate(task.id);
      return;
    }

    try {
      const checkResult = await checkTaskClickedMutation.mutateAsync(task.id);
      if (checkResult.hasClicked) {
        showNotification("You have already completed this task", "error");
        return;
      }
    } catch (error: any) {
      console.error("Failed to check task status:", error);
      
      if (error.status === 401 || error.status === 403 || error.errorCode === 'SESSION_EXPIRED') {
        console.log('Session expired, attempting re-authentication...');
        try {
          authenticateWithTelegramWebApp();
          await new Promise(resolve => setTimeout(resolve, 2000));
          const retryResult = await checkTaskClickedMutation.mutateAsync(task.id);
          if (retryResult.hasClicked) {
            showNotification("You have already completed this task", "error");
            return;
          }
        } catch (retryError) {
          console.error("Failed to re-authenticate:", retryError);
        }
      }
    }

    let linkToOpen = task.link.trim();
    
    if (!linkToOpen.startsWith('http://') && !linkToOpen.startsWith('https://')) {
      if (linkToOpen.match(/^(t\.me|telegram\.me)\//)) {
        linkToOpen = 'https://' + linkToOpen;
      } else {
        linkToOpen = 'https://' + linkToOpen;
      }
    }

    let opened = false;
    
    if (window.Telegram?.WebApp) {
      const isTelegramLink = linkToOpen.includes('t.me/') || linkToOpen.includes('telegram.me/');
      
      if (isTelegramLink) {
        if (window.Telegram.WebApp.openTelegramLink) {
          window.Telegram.WebApp.openTelegramLink(linkToOpen);
          opened = true;
        }
      } else {
        if (window.Telegram.WebApp.openLink) {
          window.Telegram.WebApp.openLink(linkToOpen);
          opened = true;
        }
      }
    }
    
    if (!opened) {
      window.open(linkToOpen, "_blank");
    }

    setClickedTasks(prev => new Set(prev).add(task.id));
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin text-primary text-3xl mb-4">
              <i className="fas fa-spinner"></i>
            </div>
            <div className="text-foreground font-medium">Loading...</div>
          </div>
        </div>
      </Layout>
    );
  }

  const allTasks = tasksData?.tasks || [];
  const filteredTasks = selectedCategory 
    ? allTasks.filter(task => task.taskType === selectedCategory)
    : allTasks;

  const getTaskReward = (task: Task) => {
    if (task.taskType === 'partner') {
      return partnerRewardPAD;
    }
    return rewardPAD;
  };

  const getTaskIcon = (taskType: string) => {
    switch (taskType) {
      case 'channel':
        return <Radio className="w-4 h-4" />;
      case 'bot':
        return <BotIcon className="w-4 h-4" />;
      case 'partner':
        return <Handshake className="w-4 h-4" />;
      default:
        return <Radio className="w-4 h-4" />;
    }
  };

  return (
    <Layout>
      <main className="max-w-md mx-auto px-4 mt-6 pb-24">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
            <CheckCircle className="w-6 h-6 text-primary" />
            Tasks
          </h1>
          <p className="text-sm text-muted-foreground">
            Earn PAD by completing tasks
          </p>
        </div>

        <Card 
          className="minimal-card mb-4 cursor-pointer hover:bg-[#1A1A1A] transition-colors"
          onClick={() => setLocation("/create-task")}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#4cd3ff] to-[#007BFF] flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-white font-semibold text-sm">Create My Task</h3>
                <p className="text-muted-foreground text-xs mt-0.5">Promote your channel or bot</p>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-3 gap-2 mb-6">
          <button
            onClick={() => setSelectedCategory(selectedCategory === 'channel' ? null : 'channel')}
            className={`flex items-center justify-center p-2.5 rounded-lg border transition-all ${
              selectedCategory === 'channel'
                ? 'bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border-blue-500 shadow-lg shadow-blue-500/20'
                : 'bg-[#1A1A1A] border-[#2A2A2A] hover:border-blue-500/50'
            }`}
          >
            <Radio className={`w-4 h-4 ${selectedCategory === 'channel' ? 'text-blue-400' : 'text-gray-400'}`} />
          </button>
          <button
            onClick={() => setSelectedCategory(selectedCategory === 'bot' ? null : 'bot')}
            className={`flex items-center justify-center p-2.5 rounded-lg border transition-all ${
              selectedCategory === 'bot'
                ? 'bg-gradient-to-br from-purple-500/20 to-pink-500/20 border-purple-500 shadow-lg shadow-purple-500/20'
                : 'bg-[#1A1A1A] border-[#2A2A2A] hover:border-purple-500/50'
            }`}
          >
            <BotIcon className={`w-4 h-4 ${selectedCategory === 'bot' ? 'text-purple-400' : 'text-gray-400'}`} />
          </button>
          <button
            onClick={() => setSelectedCategory(selectedCategory === 'partner' ? null : 'partner')}
            className={`flex items-center justify-center p-2.5 rounded-lg border transition-all ${
              selectedCategory === 'partner'
                ? 'bg-gradient-to-br from-green-500/20 to-emerald-500/20 border-green-500 shadow-lg shadow-green-500/20'
                : 'bg-[#1A1A1A] border-[#2A2A2A] hover:border-green-500/50'
            }`}
          >
            <Handshake className={`w-4 h-4 ${selectedCategory === 'partner' ? 'text-green-400' : 'text-gray-400'}`} />
          </button>
        </div>

        {tasksLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin text-primary text-2xl mb-2">
              <i className="fas fa-spinner"></i>
            </div>
            <p className="text-muted-foreground">Loading tasks...</p>
          </div>
        ) : filteredTasks.length === 0 ? (
          <Card className="minimal-card">
            <CardContent className="pt-6 pb-6 text-center">
              <Target className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
              <p className="text-muted-foreground">
                {selectedCategory 
                  ? `No ${selectedCategory} tasks available` 
                  : 'No active tasks available'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Check back later for new tasks</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredTasks.map((task) => {
              const padReward = getTaskReward(task);
              const hasClicked = clickedTasks.has(task.id);

              return (
                <Card key={task.id} className="minimal-card">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className={`w-9 h-9 rounded-full bg-[#1A1A1A] border border-[#2A2A2A] flex items-center justify-center flex-shrink-0 ${
                          task.taskType === 'channel' ? 'text-blue-500' :
                          task.taskType === 'bot' ? 'text-purple-500' :
                          'text-green-500'
                        }`}>
                          {getTaskIcon(task.taskType)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-white font-medium text-xs truncate">{task.title}</h3>
                          <p className="text-[#007BFF] text-xs font-bold">+{padReward.toLocaleString()} PAD</p>
                        </div>
                      </div>
                      <Button
                        onClick={() => handleTaskClick(task)}
                        disabled={clickTaskMutation.isPending}
                        className="h-8 px-3 text-xs flex-shrink-0 min-w-[70px] btn-primary"
                      >
                        {clickTaskMutation.isPending ? "Processing..." : (hasClicked ? "Check" : "Start")}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </Layout>
  );
}
