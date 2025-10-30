import { useAuth } from "@/hooks/useAuth";
import Layout from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle, Target, Radio, Bot as BotIcon } from "lucide-react";
import { showNotification } from "@/components/AppNotification";
import { useState } from "react";

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

export default function Tasks() {
  const { user, isLoading } = useAuth();
  const queryClient = useQueryClient();
  const [clickedTasks, setClickedTasks] = useState<Set<string>>(new Set());

  const costPerClick = 0.0003;
  const rewardPerClick = 0.000175;

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
        throw new Error("Failed to check task status");
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
    onError: (error: Error) => {
      showNotification(error.message || "Failed to complete task", "error");
    },
  });

  const handleTaskClick = async (task: Task) => {
    // If already clicked, complete the task
    if (clickedTasks.has(task.id)) {
      clickTaskMutation.mutate(task.id);
      return;
    }

    // Check if already completed
    try {
      const checkResult = await checkTaskClickedMutation.mutateAsync(task.id);
      if (checkResult.hasClicked) {
        showNotification("You have already completed this task", "error");
        return;
      }
    } catch (error) {
      console.error("Failed to check task status:", error);
    }

    // Prepare the link to open
    let linkToOpen = task.link;
    
    // Convert t.me links to tg:// protocol for better Telegram integration
    if (task.link.includes('t.me/')) {
      const match = task.link.match(/t\.me\/([^/?]+)/);
      if (match && match[1]) {
        const username = match[1];
        linkToOpen = `tg://resolve?domain=${username}`;
      }
    }

    // Open the link immediately
    try {
      let opened = false;
      
      // Try Telegram WebApp methods first
      if (window.Telegram?.WebApp) {
        if (linkToOpen.startsWith('tg://') && window.Telegram.WebApp.openTelegramLink) {
          window.Telegram.WebApp.openTelegramLink(linkToOpen);
          opened = true;
        } else if (window.Telegram.WebApp.openLink) {
          window.Telegram.WebApp.openLink(linkToOpen);
          opened = true;
        }
      }
      
      // Fallback to window.open
      if (!opened) {
        const newWindow = window.open(linkToOpen, "_blank", "noopener,noreferrer");
        if (newWindow && !newWindow.closed) {
          opened = true;
        }
      }

      if (!opened) {
        showNotification("Please allow popups to complete tasks", "error");
        return;
      }

      // Mark as clicked and schedule completion check
      setClickedTasks(prev => new Set(prev).add(task.id));
      
    } catch (error) {
      console.error("Failed to open link:", error);
      showNotification("Failed to open link. Please try again.", "error");
    }
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

  const publicTasks = tasksData?.tasks || [];
  const currentUserId = (user as any)?.id;
  const activePublicTasks = publicTasks.filter(t => 
    t.status === "active" && t.advertiserId !== currentUserId
  );

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

        {tasksLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin text-primary text-2xl mb-2">
              <i className="fas fa-spinner"></i>
            </div>
            <p className="text-muted-foreground">Loading tasks...</p>
          </div>
        ) : activePublicTasks.length === 0 ? (
          <Card className="minimal-card">
            <CardContent className="pt-6 pb-6 text-center">
              <Target className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
              <p className="text-muted-foreground">No active tasks available</p>
              <p className="text-xs text-muted-foreground mt-1">Check back later for new tasks</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {activePublicTasks.map((task) => {
              const padReward = Math.floor(rewardPerClick * 10000000);
              const hasClicked = clickedTasks.has(task.id);

              return (
                <Card key={task.id} className="minimal-card">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-[#1A1A1A] border border-[#2A2A2A] flex items-center justify-center text-[#007BFF] flex-shrink-0">
                          {task.taskType === "channel" ? (
                            <Radio className="w-4 h-4" />
                          ) : (
                            <BotIcon className="w-4 h-4" />
                          )}
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
