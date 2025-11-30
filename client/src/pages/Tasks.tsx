import { useAuth } from "@/hooks/useAuth";
import Layout from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle, ClipboardList, Send, Bot as BotIcon, Sparkles, ChevronRight, Handshake } from "lucide-react";
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
  channelTaskReward?: number;
  botTaskReward?: number;
  partnerTaskReward?: number;
  [key: string]: any;
}

export default function Tasks() {
  const { user, isLoading, authenticateWithTelegramWebApp } = useAuth();
  const queryClient = useQueryClient();
  const [clickedTasks, setClickedTasks] = useState<Set<string>>(new Set());
  const [loadingTaskId, setLoadingTaskId] = useState<string | null>(null);
  const [completedTaskIds, setCompletedTaskIds] = useState<Set<string>>(new Set());
  const [, setLocation] = useLocation();
  const [selectedCategory, setSelectedCategory] = useState<"channel" | "bot" | "partner" | null>(null);

  const { data: appSettings } = useQuery<AppSettings>({
    queryKey: ['/api/app-settings'],
    retry: false,
    refetchOnMount: true,
  });

  const channelRewardPAD = appSettings?.channelTaskReward || 30;
  const botRewardPAD = appSettings?.botTaskReward || 20;
  const partnerRewardPAD = appSettings?.partnerTaskReward || 5;

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
      setLoadingTaskId(taskId);
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
      const padReward = parseInt(data.reward) || 0;
      showNotification(`You earned ${padReward.toLocaleString()} PAD!`, "success");
      setCompletedTaskIds(prev => new Set(prev).add(taskId));
      setClickedTasks(prev => {
        const newSet = new Set(prev);
        newSet.delete(taskId);
        return newSet;
      });
      setLoadingTaskId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    },
    onError: (error: Error, taskId) => {
      showNotification(error.message || "Failed to complete task", "error");
      setClickedTasks(prev => {
        const newSet = new Set(prev);
        newSet.delete(taskId);
        return newSet;
      });
      setLoadingTaskId(null);
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
            <div className="flex gap-1 justify-center mb-4">
              <div className="w-2 h-2 rounded-full bg-[#4cd3ff] animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-2 h-2 rounded-full bg-[#4cd3ff] animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-2 h-2 rounded-full bg-[#4cd3ff] animate-bounce" style={{ animationDelay: '300ms' }}></div>
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
    } else if (task.taskType === 'channel') {
      return channelRewardPAD;
    } else {
      return botRewardPAD;
    }
  };

  const getTaskIcon = (taskType: string) => {
    switch (taskType) {
      case 'channel':
        return <Send className="w-4 h-4" />;
      case 'bot':
        return <BotIcon className="w-4 h-4" />;
      case 'partner':
        return <Handshake className="w-4 h-4" />;
      default:
        return <Send className="w-4 h-4" />;
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
          onClick={() => setLocation("/task/create")}
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
            className={`flex items-center justify-center p-2.5 rounded-xl border transition-all ${
              selectedCategory === 'channel'
                ? 'bg-gradient-to-br from-blue-500/30 to-cyan-500/30 border-blue-400 shadow-lg shadow-blue-500/30'
                : 'bg-[#1A1A1A] border-[#2A2A2A] hover:border-blue-500/50 hover:bg-[#1A1A1A]/80'
            }`}
          >
            <Send className={`w-4 h-4 ${selectedCategory === 'channel' ? 'text-blue-400' : 'text-gray-400'}`} />
          </button>
          <button
            onClick={() => setSelectedCategory(selectedCategory === 'bot' ? null : 'bot')}
            className={`flex items-center justify-center p-2.5 rounded-xl border transition-all ${
              selectedCategory === 'bot'
                ? 'bg-gradient-to-br from-purple-500/30 to-pink-500/30 border-purple-400 shadow-lg shadow-purple-500/30'
                : 'bg-[#1A1A1A] border-[#2A2A2A] hover:border-purple-500/50 hover:bg-[#1A1A1A]/80'
            }`}
          >
            <BotIcon className={`w-4 h-4 ${selectedCategory === 'bot' ? 'text-purple-400' : 'text-gray-400'}`} />
          </button>
          <button
            onClick={() => setSelectedCategory(selectedCategory === 'partner' ? null : 'partner')}
            className={`flex items-center justify-center p-2.5 rounded-xl border transition-all ${
              selectedCategory === 'partner'
                ? 'bg-gradient-to-br from-green-500/30 to-emerald-500/30 border-green-400 shadow-lg shadow-green-500/30'
                : 'bg-[#1A1A1A] border-[#2A2A2A] hover:border-green-500/50 hover:bg-[#1A1A1A]/80'
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
              <ClipboardList className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
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
            {filteredTasks.filter(task => !completedTaskIds.has(task.id)).map((task) => {
              const padReward = getTaskReward(task);
              const hasClicked = clickedTasks.has(task.id);
              const isLoading = loadingTaskId === task.id;

              const getIconBg = (type: string) => {
                switch(type) {
                  case 'channel': return 'bg-gradient-to-br from-blue-500 to-cyan-500';
                  case 'bot': return 'bg-gradient-to-br from-purple-500 to-pink-500';
                  case 'partner': return 'bg-gradient-to-br from-green-500 to-emerald-500';
                  default: return 'bg-gradient-to-br from-blue-500 to-cyan-500';
                }
              };

              const getRewardColor = (type: string) => {
                switch(type) {
                  case 'channel': return 'text-cyan-400';
                  case 'bot': return 'text-purple-400';
                  case 'partner': return 'text-green-400';
                  default: return 'text-cyan-400';
                }
              };

              return (
                <Card key={task.id} className="minimal-card hover:bg-[#1A1A1A]/50 transition-all">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className={`w-10 h-10 rounded-xl ${getIconBg(task.taskType)} flex items-center justify-center flex-shrink-0 shadow-lg`}>
                          <span className="text-white">{getTaskIcon(task.taskType)}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-white font-semibold text-sm truncate">{task.title}</h3>
                          <p className={`text-xs font-bold ${getRewardColor(task.taskType)}`}>+{padReward.toLocaleString()} PAD</p>
                        </div>
                      </div>
                      <Button
                        onClick={() => handleTaskClick(task)}
                        disabled={isLoading}
                        className={`h-9 px-4 text-xs flex-shrink-0 min-w-[75px] font-semibold rounded-xl ${
                          hasClicked 
                            ? 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600' 
                            : 'bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600'
                        } text-white border-0 shadow-md`}
                      >
                        {isLoading ? (
                          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                        ) : (hasClicked ? "Claim" : "Start")}
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
