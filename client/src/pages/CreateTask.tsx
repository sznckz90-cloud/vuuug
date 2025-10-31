import { useAuth } from "@/hooks/useAuth";
import Layout from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  CheckCircle, 
  PlusCircle, 
  FileText, 
  Clock, 
  TrendingUp, 
  Radio, 
  Bot as BotIcon, 
  ArrowLeft, 
  Trash2,
  Info,
  CheckCircle2
} from "lucide-react";
import { showNotification } from "@/components/AppNotification";
import { useState } from "react";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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

export default function CreateTask() {
  const { user, isLoading } = useAuth();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  
  const [activeTab, setActiveTab] = useState<"add-task" | "my-task">("add-task");
  const [taskType, setTaskType] = useState<"channel" | "bot" | null>(null);
  const [title, setTitle] = useState("");
  const [link, setLink] = useState("");
  const [totalClicks, setTotalClicks] = useState("500");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [additionalClicks, setAdditionalClicks] = useState("500");
  const [isAddClicksDialogOpen, setIsAddClicksDialogOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [showVerifyInfo, setShowVerifyInfo] = useState(false);

  const costPerClick = 0.0003;
  const rewardPerClick = 0.000175;
  const clicksNum = parseInt(totalClicks) || 0;
  const totalCostTON = costPerClick * clicksNum;
  const totalRewardsPAD = rewardPerClick * clicksNum * 10000000;
  const tonBalance = parseFloat((user as any)?.tonBalance || "0");
  const additionalCostTON = costPerClick * (parseInt(additionalClicks) || 0);

  const { data: myTasksData, isLoading: myTasksLoading, refetch: refetchMyTasks } = useQuery<{
    success: boolean;
    tasks: Task[];
  }>({
    queryKey: ["/api/advertiser-tasks/my-tasks"],
    retry: false,
    refetchOnMount: true,
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
      showNotification("Task created successfully ✅", "success");
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/advertiser-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/advertiser-tasks/my-tasks"] });
      
      setTitle("");
      setLink("");
      setTotalClicks("500");
      setTaskType("channel");
      setIsVerified(false);
      setActiveTab("my-task");
    },
    onError: (error: Error) => {
      showNotification(error.message || "Failed to create task", "error");
    },
  });

  const increaseClicksMutation = useMutation({
    mutationFn: async ({ taskId, clicks }: { taskId: string; clicks: number }) => {
      const response = await apiRequest("POST", `/api/advertiser-tasks/${taskId}/increase-limit`, {
        additionalClicks: clicks
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
      showNotification(error.message || "Insufficient TON balance", "error");
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const response = await apiRequest("DELETE", `/api/advertiser-tasks/${taskId}`);
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message);
      }
      return data;
    },
    onSuccess: () => {
      showNotification("Task deleted successfully!", "success");
      queryClient.invalidateQueries({ queryKey: ["/api/advertiser-tasks/my-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/advertiser-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      setTaskToDelete(null);
    },
    onError: (error: Error) => {
      showNotification(error.message || "Failed to delete task", "error");
    },
  });

  const handleVerifyChannel = async () => {
    if (!link.trim()) {
      showNotification("Please enter a channel link first", "error");
      return;
    }

    setIsVerifying(true);
    try {
      const response = await apiRequest("POST", "/api/advertiser-tasks/verify-channel", {
        channelLink: link
      });
      const data = await response.json();
      
      if (data.success) {
        setIsVerified(true);
        showNotification("Channel verified successfully!", "success");
      } else {
        showNotification(data.message || "Verification failed", "error");
      }
    } catch (error) {
      showNotification("Failed to verify channel", "error");
    } finally {
      setIsVerifying(false);
    }
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

    // Validate that title doesn't contain URLs or links
    const urlPattern = /(https?:\/\/|t\.me\/|\.com|\.net|\.org|\.io|www\.)/i;
    if (urlPattern.test(title)) {
      showNotification("Links are not allowed in task title", "error");
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

    if (taskType === "channel" && !isVerified) {
      showNotification("Please verify your channel first", "error");
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

  const myTasks = myTasksData?.tasks || [];
  const activeMyTasks = myTasks.filter(t => t.status === "active");
  const completedMyTasks = myTasks.filter(t => t.status === "completed");

  return (
    <Layout>
      <main className="max-w-md mx-auto px-4 mt-6 pb-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <PlusCircle className="w-6 h-6 text-primary" />
            Create Task
          </h1>
          <p className="text-sm text-muted-foreground">
            Promote your channel or bot
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-6">
          <Button
            type="button"
            variant="outline"
            className={`h-auto py-3 transition-all font-bold text-sm ${
              activeTab === "add-task" 
                ? "bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border-cyan-500 text-cyan-300 shadow-lg shadow-cyan-500/20" 
                : "hover:bg-cyan-500/10 hover:border-cyan-500/50 text-muted-foreground"
            }`}
            onClick={() => setActiveTab("add-task")}
          >
            Add Task
          </Button>
          <Button
            type="button"
            variant="outline"
            className={`h-auto py-3 transition-all font-bold text-sm ${
              activeTab === "my-task" 
                ? "bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border-blue-500 text-blue-300 shadow-lg shadow-blue-500/20" 
                : "hover:bg-blue-500/10 hover:border-blue-500/50 text-muted-foreground"
            }`}
            onClick={() => setActiveTab("my-task")}
          >
            My Task
          </Button>
        </div>

        {activeTab === "add-task" ? (
          <div className="space-y-4">
            <div>
              <Label className="text-xs font-medium mb-2 block text-muted-foreground">Select Type:</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className={`h-auto py-2.5 flex items-center justify-center gap-2 transition-all ${
                    taskType === "channel" 
                      ? "bg-blue-500/20 border-blue-500 text-blue-400 hover:bg-blue-500/30" 
                      : "hover:bg-blue-500/10 hover:border-blue-500/50"
                  }`}
                  onClick={() => {
                    setTaskType("channel");
                    setIsVerified(false);
                  }}
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
                    onChange={(e) => {
                      setLink(e.target.value);
                      setIsVerified(false);
                    }}
                    className="mt-1"
                  />
                </div>

                {taskType === "channel" && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleVerifyChannel}
                        disabled={isVerifying || !link.trim()}
                        className={`flex-1 ${
                          isVerified 
                            ? 'border-green-500 bg-green-500/10 text-green-500' 
                            : link.trim() && (link.startsWith('http') || link.includes('t.me/'))
                            ? 'border-blue-500 bg-blue-500/10 text-blue-500'
                            : ''
                        }`}
                      >
                        {isVerifying ? (
                          <>
                            <div className="animate-spin mr-2">⏳</div>
                            Verifying...
                          </>
                        ) : isVerified ? (
                          <>
                            <CheckCircle2 className="w-4 h-4 mr-2" />
                            Verified
                          </>
                        ) : (
                          "Verify Channel"
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setShowVerifyInfo(true)}
                        className="text-muted-foreground hover:text-white"
                      >
                        <Info className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}

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
                  disabled={createTaskMutation.isPending || tonBalance < totalCostTON || (taskType === "channel" && !isVerified)}
                >
                  {createTaskMutation.isPending ? "Publishing..." : `Pay ${totalCostTON.toFixed(4)} TON & Publish`}
                </Button>
              </form>
            )}
          </div>
        ) : (
          <div className="space-y-4">
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
                  onClick={() => setActiveTab("add-task")}
                >
                  <PlusCircle className="w-4 h-4 mr-2" />
                  Create Your First Task
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
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
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  {task.taskType === "channel" ? (
                                    <Radio className="w-4 h-4 text-primary" />
                                  ) : (
                                    <BotIcon className="w-4 h-4 text-primary" />
                                  )}
                                  <span className="text-xs text-muted-foreground uppercase">
                                    {task.taskType}
                                  </span>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                                  onClick={() => setTaskToDelete(task)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                              <h3 className="font-semibold text-white text-sm mb-1">{task.title}</h3>
                              <p className="text-xs text-muted-foreground mb-2">
                                {task.currentClicks} / {task.totalClicksRequired} clicks • {remaining} remaining
                              </p>

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
          </div>
        )}

        {/* Add More Clicks Dialog */}
        <Dialog open={isAddClicksDialogOpen} onOpenChange={setIsAddClicksDialogOpen}>
          <DialogContent 
            className="sm:max-w-md max-h-[90vh] flex flex-col frosted-glass border border-white/10 rounded-2xl p-0 overflow-hidden"
            onInteractOutside={(e) => e.preventDefault()}
          >
            <DialogHeader className="px-6 pt-6 pb-4 shrink-0">
              <DialogTitle>Add More Clicks</DialogTitle>
            </DialogHeader>
            {selectedTask && (
              <div className="space-y-4 overflow-y-auto px-6 flex-1">
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
              </div>
            )}
            <div className="px-6 pb-6 pt-3 border-t border-border shrink-0 space-y-2">
              <Button
                className="w-full btn-primary"
                onClick={handleIncreaseClicks}
                disabled={increaseClicksMutation.isPending || tonBalance < additionalCostTON}
              >
                {increaseClicksMutation.isPending ? "Processing..." : `Pay & Add`}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full h-9 text-sm"
                onClick={() => {
                  setIsAddClicksDialogOpen(false);
                  setSelectedTask(null);
                  setAdditionalClicks("500");
                }}
              >
                Cancel
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!taskToDelete} onOpenChange={(open) => !open && setTaskToDelete(null)}>
          <AlertDialogContent className="frosted-glass border border-white/10">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Task</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{taskToDelete?.title}"? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => taskToDelete && deleteTaskMutation.mutate(taskToDelete.id)}
                className="bg-red-500 hover:bg-red-600"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Verification Info Dialog */}
        <AlertDialog open={showVerifyInfo} onOpenChange={setShowVerifyInfo}>
          <AlertDialogContent className="frosted-glass border border-white/10">
            <AlertDialogHeader>
              <AlertDialogTitle>Channel Verification</AlertDialogTitle>
              <AlertDialogDescription className="space-y-3 text-sm">
                <p>
                  Please add <a href="https://t.me/Paid_Adzbot" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">@Paid_Adzbot</a> as an administrator to your channel.
                </p>
                <p>
                  This integration allows our system to automatically validate member activity, providing real-time verification, authentic engagement, and superior campaign performance.
                </p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction>Got it</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </Layout>
  );
}
