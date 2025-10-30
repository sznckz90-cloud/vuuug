import { useAuth } from "@/hooks/useAuth";
import Layout from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, CheckCircle, Target, PlusCircle, FileText, Clock, TrendingUp, Radio, Bot as BotIcon, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { showNotification } from "@/components/AppNotification";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";

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
  const [location] = useLocation();
  
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [createDialogTab, setCreateDialogTab] = useState("add-task");
  const [isAddClicksDialogOpen, setIsAddClicksDialogOpen] = useState(false);

  // Check URL parameters to auto-open create dialog
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('create') === 'true') {
      setIsCreateDialogOpen(true);
      setTaskType("channel");
      // Clean up URL
      window.history.replaceState({}, '', '/tasks');
    }
  }, [location]);
  
  const [taskType, setTaskType] = useState<"channel" | "bot" | null>(null);
  const [title, setTitle] = useState("");
  const [link, setLink] = useState("");
  const [totalClicks, setTotalClicks] = useState("500");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [additionalClicks, setAdditionalClicks] = useState("500");
  const [clickedTasks, setClickedTasks] = useState<Set<string>>(new Set());

  const costPerClick = 0.0003;
  const rewardPerClick = 0.000175;
  const clicksNum = parseInt(totalClicks) || 0;
  const totalCostTON = costPerClick * clicksNum;
  const totalRewardsPAD = rewardPerClick * clicksNum * 10000000;
  const tonBalance = parseFloat((user as any)?.tonBalance || "0");
  const additionalCostTON = costPerClick * (parseInt(additionalClicks) || 0);

  const { data: tasksData, isLoading: tasksLoading } = useQuery<{
    success: boolean;
    tasks: Task[];
  }>({
    queryKey: ["/api/advertiser-tasks"],
    retry: false,
    refetchOnMount: true,
  });

  const { data: myTasksData, isLoading: myTasksLoading } = useQuery<{
    success: boolean;
    tasks: Task[];
  }>({
    queryKey: ["/api/advertiser-tasks/my-tasks"],
    retry: false,
    refetchOnMount: true,
    enabled: isCreateDialogOpen && createDialogTab === "my-task",
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

  const createTaskMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/advertiser-tasks/create", {
        taskType,
        title,
        link,
        totalClicksRequired: clicksNum,
      });
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message);
      }
      return data;
    },
    onSuccess: (data) => {
      showNotification("Task created successfully!", "success");
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/advertiser-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/advertiser-tasks/my-tasks"] });
      
      setIsCreateDialogOpen(false);
      setTitle("");
      setLink("");
      setTotalClicks("500");
      setTaskType("channel");
    },
    onError: (error: Error) => {
      showNotification(error.message || "Failed to create task", "error");
    },
  });

  const increaseClicksMutation = useMutation({
    mutationFn: async ({ taskId, clicks }: { taskId: string; clicks: number }) => {
      const response = await fetch(`/api/advertiser-tasks/${taskId}/increase-limit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ additionalClicks: clicks }),
      });
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message);
      }
      return data;
    },
    onSuccess: () => {
      showNotification("Clicks added successfully!", "success");
      queryClient.invalidateQueries({ queryKey: ["/api/advertiser-tasks/my-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      setIsAddClicksDialogOpen(false);
      setSelectedTask(null);
      setAdditionalClicks("500");
    },
    onError: (error: Error) => {
      showNotification(error.message || "Not enough TON balance", "error");
    },
  });

  const handleTaskClick = async (task: Task) => {
    if (clickedTasks.has(task.id)) {
      clickTaskMutation.mutate(task.id);
      return;
    }

    const checkResult = await checkTaskClickedMutation.mutateAsync(task.id);
    
    if (checkResult.hasClicked) {
      showNotification("You have already clicked this task", "error");
      return;
    }

    // Handle Telegram links specially
    let linkToOpen = task.link;
    if (task.link.includes('t.me/')) {
      // Extract username from t.me link
      const match = task.link.match(/t\.me\/([^/?]+)/);
      if (match && match[1]) {
        const username = match[1];
        linkToOpen = `tg://resolve?domain=${username}`;
      }
    }

    // Try to open with Telegram WebApp if available, otherwise use window.open
    if (window.Telegram?.WebApp?.openTelegramLink && linkToOpen.startsWith('tg://')) {
      window.Telegram.WebApp.openTelegramLink(linkToOpen);
    } else {
      window.open(linkToOpen, "_blank");
    }

    setClickedTasks(prev => new Set(prev).add(task.id));

    setTimeout(() => {
      clickTaskMutation.mutate(task.id);
    }, 3000);
  };

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();

    if (!taskType) {
      showNotification("Please select a task type (Channel or Bot)", "error");
      return;
    }

    if (!title.trim()) {
      showNotification("Please enter a task title", "error");
      return;
    }

    if (!link.trim() || (!link.startsWith("http") && !link.startsWith("t.me"))) {
      showNotification("Please enter a valid Telegram link", "error");
      return;
    }

    if (clicksNum < 500) {
      showNotification("Minimum 500 clicks required", "error");
      return;
    }

    if (tonBalance < totalCostTON) {
      showNotification("Insufficient TON balance", "error");
      return;
    }

    createTaskMutation.mutate();
  };

  const handleIncreaseClicks = () => {
    if (!selectedTask) return;

    const clicks = parseInt(additionalClicks);
    if (clicks < 500) {
      showNotification("Minimum 500 additional clicks required", "error");
      return;
    }

    if (tonBalance < additionalCostTON) {
      showNotification("Insufficient TON balance", "error");
      return;
    }

    increaseClicksMutation.mutate({ taskId: selectedTask.id, clicks });
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
  const activePublicTasks = publicTasks.filter(t => t.status === "active");
  const myTasks = myTasksData?.tasks || [];
  const activeMyTasks = myTasks.filter(t => t.status === "active");
  const completedMyTasks = myTasks.filter(t => t.status === "completed");

  return (
    <Layout>
      <main className="max-w-md mx-auto px-4 mt-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
            <CheckCircle className="w-6 h-6 text-primary" />
            Tasks
          </h1>
          <p className="text-sm text-muted-foreground">
            Earn PAD by completing tasks
          </p>
        </div>

        <div className="hidden">
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                className="btn-primary"
                onClick={() => setTaskType("channel")}
              >
                <PlusCircle className="w-4 h-4 mr-1" />
                +Task
              </Button>
            </DialogTrigger>
            <DialogContent 
              className="sm:max-w-md max-h-[90vh] flex flex-col frosted-glass border border-white/10 rounded-2xl p-0 overflow-hidden"
              onInteractOutside={(e) => e.preventDefault()}
              hideCloseButton
            >
              <DialogHeader className="px-6 pt-6 pb-4 shrink-0">
                <DialogTitle>Manage Tasks</DialogTitle>
              </DialogHeader>
              
              <Tabs value={createDialogTab} onValueChange={setCreateDialogTab} className="w-full flex-1 flex flex-col overflow-hidden">
                <div className="grid grid-cols-2 gap-2 mx-6 mb-4 shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    className={`h-auto py-3 transition-all font-bold text-sm ${
                      createDialogTab === "add-task" 
                        ? "bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border-cyan-500 text-cyan-300 shadow-lg shadow-cyan-500/20" 
                        : "hover:bg-cyan-500/10 hover:border-cyan-500/50 text-muted-foreground"
                    }`}
                    onClick={() => setCreateDialogTab("add-task")}
                  >
                    Add Task
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className={`h-auto py-3 transition-all font-bold text-sm ${
                      createDialogTab === "my-task" 
                        ? "bg-gradient-to-r from-pink-500/20 to-purple-500/20 border-pink-500 text-pink-300 shadow-lg shadow-pink-500/20" 
                        : "hover:bg-pink-500/10 hover:border-pink-500/50 text-muted-foreground"
                    }`}
                    onClick={() => setCreateDialogTab("my-task")}
                  >
                    My Task
                  </Button>
                </div>

                <TabsContent value="add-task" className="space-y-4 overflow-y-auto px-6 flex-1">
                  <div className="space-y-4">
                    <div>
                      <Label className="text-xs font-medium mb-2 block text-muted-foreground">Select Type:</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          className={`h-auto py-2.5 flex items-center justify-center gap-2 transition-all ${
                            taskType === "channel" 
                              ? "bg-purple-500/20 border-purple-500 text-purple-400 hover:bg-purple-500/30" 
                              : "hover:bg-purple-500/10 hover:border-purple-500/50"
                          }`}
                          onClick={() => setTaskType("channel")}
                        >
                          <Radio className="w-4 h-4" />
                          <span className="font-semibold text-sm">Channel</span>
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className={`h-auto py-2.5 flex items-center justify-center gap-2 transition-all ${
                            taskType === "bot" 
                              ? "bg-blue-500/20 border-blue-500 text-blue-400 hover:bg-blue-500/30" 
                              : "hover:bg-blue-500/10 hover:border-blue-500/50"
                          }`}
                          onClick={() => setTaskType("bot")}
                        >
                          <BotIcon className="w-4 h-4" />
                          <span className="font-semibold text-sm">Bot</span>
                        </Button>
                      </div>
                    </div>

                    {taskType && (
                      <>
                        <form onSubmit={handleCreateTask} className="space-y-4">
                          <div>
                            <Label htmlFor="title">Task Title</Label>
                            <Input
                              id="title"
                              placeholder="Short description"
                              value={title}
                              onChange={(e) => setTitle(e.target.value)}
                              className="mt-1"
                            />
                          </div>

                          <div>
                            <Label htmlFor="link">
                              {taskType === "channel" ? "Telegram Channel Link" : "Bot Link"}
                            </Label>
                            <Input
                              id="link"
                              type="text"
                              placeholder={taskType === "channel" ? "https://t.me/yourchannel" : "https://t.me/yourbot"}
                              value={link}
                              onChange={(e) => setLink(e.target.value)}
                              className="mt-1"
                            />
                          </div>

                          <div>
                            <Label htmlFor="clicks">Total Clicks Required</Label>
                            <Input
                              id="clicks"
                              type="number"
                              min="500"
                              step="100"
                              placeholder="500"
                              value={totalClicks}
                              onChange={(e) => setTotalClicks(e.target.value)}
                              className="mt-1"
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                              Minimum 500 clicks
                            </p>
                          </div>

                          <Button
                            type="submit"
                            className="w-full btn-primary"
                            disabled={createTaskMutation.isPending || tonBalance < totalCostTON}
                          >
                            {createTaskMutation.isPending ? "Publishing..." : `Pay ${totalCostTON.toFixed(4)} TON & Publish`}
                          </Button>
                        </form>
                      </>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="my-task" className="overflow-y-auto px-6 flex-1">
                  {myTasksLoading ? (
                    <div className="text-center py-8">
                      <div className="animate-spin text-primary text-2xl mb-2">
                        <i className="fas fa-spinner"></i>
                      </div>
                      <p className="text-muted-foreground">Loading your tasks...</p>
                    </div>
                  ) : myTasks.length === 0 ? (
                    <div className="text-center py-8">
                      <FileText className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                      <p className="text-muted-foreground mb-4">No tasks created yet</p>
                      <Button
                        className="btn-primary"
                        onClick={() => setCreateDialogTab("add-task")}
                      >
                        <PlusCircle className="w-4 h-4 mr-2" />
                        Create Your First Task
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4 pb-4">
                      {activeMyTasks.length > 0 && (
                        <>
                          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            Active Tasks ({activeMyTasks.length})
                          </h2>
                          <div className="space-y-3">
                            {activeMyTasks.map((task) => {
                              const progress = (task.currentClicks / task.totalClicksRequired) * 100;
                              const remaining = task.totalClicksRequired - task.currentClicks;

                              return (
                                <Card key={task.id} className="minimal-card">
                                  <CardContent className="pt-3 pb-3">
                                    <div className="mb-2">
                                      <div className="flex items-center gap-2 mb-1">
                                        {task.taskType === "channel" ? (
                                          <Radio className="w-4 h-4 text-primary" />
                                        ) : (
                                          <BotIcon className="w-4 h-4 text-primary" />
                                        )}
                                        <span className="text-xs text-muted-foreground uppercase">
                                          {task.taskType}
                                        </span>
                                      </div>
                                      <h3 className="font-semibold text-white text-sm">{task.title}</h3>
                                      <p className="text-xs text-muted-foreground">
                                        {task.currentClicks} / {task.totalClicksRequired} clicks • {remaining} remaining
                                      </p>
                                    </div>

                                    <div className="mb-2">
                                      <div className="w-full bg-secondary rounded-full h-2">
                                        <div
                                          className="bg-primary h-2 rounded-full transition-all"
                                          style={{ width: `${progress}%` }}
                                        />
                                      </div>
                                      <div className="flex justify-between text-xs text-muted-foreground mt-1">
                                        <span>{progress.toFixed(1)}% complete</span>
                                        <span>
                                          {task.status === "active" ? "Active" : "Completed"}
                                        </span>
                                      </div>
                                    </div>

                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="w-full text-xs h-8"
                                      onClick={() => {
                                        setSelectedTask(task);
                                        setIsAddClicksDialogOpen(true);
                                      }}
                                    >
                                      <TrendingUp className="w-3 h-3 mr-2" />
                                      Add More Clicks (min +500)
                                    </Button>
                                  </CardContent>
                                </Card>
                              );
                            })}
                          </div>
                        </>
                      )}

                      {completedMyTasks.length > 0 && (
                        <>
                          <h2 className="text-sm font-semibold text-white flex items-center gap-2 mt-6">
                            <CheckCircle className="w-4 h-4" />
                            Completed Tasks ({completedMyTasks.length})
                          </h2>
                          <div className="space-y-3">
                            {completedMyTasks.map((task) => (
                              <Card key={task.id} className="minimal-card opacity-60">
                                <CardContent className="pt-3 pb-3">
                                  <div className="flex items-center gap-2 mb-1">
                                    {task.taskType === "channel" ? (
                                      <Radio className="w-4 h-4 text-muted-foreground" />
                                    ) : (
                                      <BotIcon className="w-4 h-4 text-muted-foreground" />
                                    )}
                                    <span className="text-xs text-muted-foreground uppercase">
                                      {task.taskType}
                                    </span>
                                  </div>
                                  <h3 className="font-semibold text-white text-sm">{task.title}</h3>
                                  <p className="text-xs text-muted-foreground">
                                    {task.totalClicksRequired} clicks completed
                                  </p>
                                  <p className="text-xs text-green-500 mt-1">✓ Completed</p>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
              
              <div className="px-6 pb-4 pt-3 border-t border-border shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-9 text-sm"
                  onClick={() => {
                    setIsCreateDialogOpen(false);
                    setTaskType("channel");
                    setTitle("");
                    setLink("");
                    setTotalClicks("500");
                  }}
                >
                  Close
                </Button>
              </div>
            </DialogContent>
          </Dialog>
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
          <div className="space-y-3 pb-20">
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

        {/* Add More Clicks Dialog */}
        <Dialog open={isAddClicksDialogOpen} onOpenChange={setIsAddClicksDialogOpen}>
          <DialogContent 
            className="sm:max-w-md max-h-[90vh] flex flex-col frosted-glass border border-white/10 rounded-2xl p-0 overflow-hidden"
            onInteractOutside={(e) => e.preventDefault()}
            hideCloseButton={false}
          >
            <DialogHeader className="px-6 pt-6 pb-4 shrink-0 relative">
              <DialogTitle>Add More Clicks</DialogTitle>
              <button
                onClick={() => setIsAddClicksDialogOpen(false)}
                className="absolute top-6 right-6 text-muted-foreground hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </DialogHeader>
            {selectedTask && (
              <div className="space-y-4 overflow-y-auto px-6 pb-6 flex-1">
                <div>
                  <p className="text-sm text-muted-foreground mb-2">
                    Task: <span className="text-white font-semibold">{selectedTask.title}</span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Current: {selectedTask.currentClicks} / {selectedTask.totalClicksRequired} clicks
                  </p>
                </div>

                <div>
                  <Label htmlFor="additional-clicks">Additional Clicks</Label>
                  <Input
                    id="additional-clicks"
                    type="number"
                    min="500"
                    step="100"
                    value={additionalClicks}
                    onChange={(e) => setAdditionalClicks(e.target.value)}
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Minimum 500 clicks
                  </p>
                </div>

                <div className="bg-secondary/50 rounded-lg p-3 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Cost per click:</span>
                    <span className="text-white">0.0003 TON</span>
                  </div>
                  <div className="flex justify-between text-sm font-semibold">
                    <span className="text-muted-foreground">Total cost:</span>
                    <span className="text-white">{additionalCostTON.toFixed(4)} TON</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Your TON balance:</span>
                    <span className={`${tonBalance >= additionalCostTON ? "text-green-500" : "text-red-500"}`}>
                      {tonBalance.toFixed(4)} TON
                    </span>
                  </div>
                </div>

                <Button
                  className="w-full btn-primary"
                  onClick={handleIncreaseClicks}
                  disabled={increaseClicksMutation.isPending || tonBalance < additionalCostTON}
                >
                  {increaseClicksMutation.isPending ? "Processing..." : `Pay & Add`}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </Layout>
  );
}
