import { useAuth } from "@/hooks/useAuth";
import Layout from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, CheckCircle, Target, PlusCircle, FileText, Clock, TrendingUp, Radio, Bot as BotIcon } from "lucide-react";
import { toast } from "@/hooks/use-toast";
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
  
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [createDialogTab, setCreateDialogTab] = useState("add-task");
  const [isAddClicksDialogOpen, setIsAddClicksDialogOpen] = useState(false);
  
  const [taskType, setTaskType] = useState<"channel" | "bot" | null>(null);
  const [title, setTitle] = useState("");
  const [link, setLink] = useState("");
  const [totalClicks, setTotalClicks] = useState("500");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [additionalClicks, setAdditionalClicks] = useState("500");

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
    onSuccess: (data) => {
      const padReward = Math.floor(parseFloat(data.reward) * 10000000);
      toast({
        title: "Success!",
        description: `${data.message} You earned ${padReward.toLocaleString()} PAD!`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/advertiser-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/advertiser-tasks/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          taskType,
          title,
          link,
          totalClicksRequired: clicksNum,
        }),
      });
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message);
      }
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Success!",
        description: data.message,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/advertiser-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/advertiser-tasks/my-tasks"] });
      
      setTaskType(null);
      setTitle("");
      setLink("");
      setTotalClicks("500");
      setCreateDialogTab("my-task");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
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
      toast({
        title: "Success!",
        description: "Task limit increased successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/advertiser-tasks/my-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      setSelectedTask(null);
      setAdditionalClicks("500");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleTaskClick = async (task: Task) => {
    const checkResult = await checkTaskClickedMutation.mutateAsync(task.id);
    
    if (checkResult.hasClicked) {
      toast({
        title: "Already clicked",
        description: "You have already clicked this task",
        variant: "destructive",
      });
      return;
    }

    window.open(task.link, "_blank");

    setTimeout(() => {
      clickTaskMutation.mutate(task.id);
    }, 3000);
  };

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();

    if (!taskType) {
      toast({
        title: "Error",
        description: "Please select a task type (Channel or Bot)",
        variant: "destructive",
      });
      return;
    }

    if (!title.trim()) {
      toast({
        title: "Error",
        description: "Please enter a task title",
        variant: "destructive",
      });
      return;
    }

    if (!link.trim() || (!link.startsWith("http") && !link.startsWith("t.me"))) {
      toast({
        title: "Error",
        description: "Please enter a valid Telegram link",
        variant: "destructive",
      });
      return;
    }

    if (clicksNum < 500) {
      toast({
        title: "Error",
        description: "Minimum 500 clicks required",
        variant: "destructive",
      });
      return;
    }

    if (tonBalance < totalCostTON) {
      toast({
        title: "Insufficient TON balance",
        description: "Please convert PAD to TON before creating a task.",
        variant: "destructive",
      });
      return;
    }

    createTaskMutation.mutate();
  };

  const handleIncreaseClicks = () => {
    if (!selectedTask) return;

    const clicks = parseInt(additionalClicks);
    if (clicks < 500) {
      toast({
        title: "Error",
        description: "Minimum 500 additional clicks required",
        variant: "destructive",
      });
      return;
    }

    if (tonBalance < additionalCostTON) {
      toast({
        title: "Insufficient TON balance",
        description: "Please convert PAD to TON before adding more clicks.",
        variant: "destructive",
      });
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
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white mb-2">
              <Target className="inline-block w-6 h-6 mr-2 mb-1" />
              Tasks
            </h1>
            <p className="text-sm text-muted-foreground">
              Earn PAD by completing tasks
            </p>
          </div>
          
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                className="btn-primary"
                onClick={() => setTaskType("channel")}
              >
                <PlusCircle className="w-4 h-4 mr-2" />
                Create Task
              </Button>
            </DialogTrigger>
            <DialogContent 
              className="sm:max-w-md max-h-[85vh] frosted-glass border border-white/10 rounded-2xl"
              onInteractOutside={(e) => e.preventDefault()}
              hideCloseButton
            >
              <DialogHeader>
                <DialogTitle>Manage Tasks</DialogTitle>
              </DialogHeader>
              
              <Tabs value={createDialogTab} onValueChange={setCreateDialogTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-4">
                  <TabsTrigger value="add-task">Add Task</TabsTrigger>
                  <TabsTrigger value="my-task">My Task</TabsTrigger>
                </TabsList>

                <TabsContent value="add-task" className="space-y-4">
                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm font-semibold mb-3 block">Task Type:</Label>
                      <div className="grid grid-cols-2 gap-3">
                        <Button
                          type="button"
                          variant={taskType === "channel" ? "default" : "outline"}
                          className={`h-auto py-4 flex flex-col items-center gap-2 ${taskType === "channel" ? "bg-primary" : ""}`}
                          onClick={() => setTaskType("channel")}
                        >
                          <Radio className="w-6 h-6" />
                          <span className="font-semibold">Channel</span>
                        </Button>
                        <Button
                          type="button"
                          variant={taskType === "bot" ? "default" : "outline"}
                          className={`h-auto py-4 flex flex-col items-center gap-2 ${taskType === "bot" ? "bg-primary" : ""}`}
                          onClick={() => setTaskType("bot")}
                        >
                          <BotIcon className="w-6 h-6" />
                          <span className="font-semibold">Bot</span>
                        </Button>
                      </div>
                    </div>

                    {taskType && (
                      <>
                        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                          <p className="text-sm text-blue-300">
                            {taskType === "channel" 
                              ? "Promote your Telegram Channel to real users" 
                              : "Promote your Telegram Bot to real users"}
                          </p>
                          <p className="text-xs text-blue-400 mt-2">
                            💰 Cost for 500 user clicks: 0.15 TON
                          </p>
                        </div>

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

                          <div className="bg-secondary/50 rounded-lg p-4 space-y-2">
                            <h3 className="font-semibold text-white text-sm mb-2">Cost Summary</h3>
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Total clicks:</span>
                              <span className="font-semibold text-white">{clicksNum.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Cost per click:</span>
                              <span className="text-white">0.0003 TON</span>
                            </div>
                            <div className="flex justify-between text-sm pt-2 border-t border-border">
                              <span className="text-muted-foreground font-semibold">Total cost:</span>
                              <span className="font-bold text-white">{totalCostTON.toFixed(4)} TON</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Your TON balance:</span>
                              <span className={`font-semibold ${tonBalance >= totalCostTON ? "text-green-500" : "text-red-500"}`}>
                                {tonBalance.toFixed(4)} TON
                              </span>
                            </div>
                          </div>

                          <div className="flex gap-3">
                            <Button
                              type="button"
                              variant="outline"
                              className="flex-1"
                              onClick={() => {
                                setIsCreateDialogOpen(false);
                                setTaskType(null);
                                setTitle("");
                                setLink("");
                                setTotalClicks("500");
                              }}
                            >
                              Cancel
                            </Button>
                            <Button
                              type="submit"
                              className="flex-1 btn-primary"
                              disabled={createTaskMutation.isPending || tonBalance < totalCostTON}
                            >
                              {createTaskMutation.isPending ? "Publishing..." : `Pay & Publish`}
                            </Button>
                          </div>
                        </form>
                      </>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="my-task">
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
              
              <div className="mt-4 pt-4 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
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
              const progress = (task.currentClicks / task.totalClicksRequired) * 100;
              const remaining = task.totalClicksRequired - task.currentClicks;
              const padReward = Math.floor(rewardPerClick * 10000000);

              return (
                <Card key={task.id} className="minimal-card">
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
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
                        <h3 className="font-semibold text-white mb-1">{task.title}</h3>
                        <p className="text-xs text-muted-foreground mb-2">
                          Earn {padReward.toLocaleString()} PAD per click
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{task.currentClicks} / {task.totalClicksRequired} clicks</span>
                          <span>•</span>
                          <span>{remaining} remaining</span>
                        </div>
                      </div>
                    </div>

                    <div className="mb-3">
                      <div className="w-full bg-secondary rounded-full h-2">
                        <div
                          className="bg-primary h-2 rounded-full transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>

                    <Button
                      className="w-full btn-primary"
                      onClick={() => handleTaskClick(task)}
                      disabled={clickTaskMutation.isPending}
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      {clickTaskMutation.isPending ? "Processing..." : "Visit & Earn"}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Add More Clicks Dialog */}
        <Dialog open={isAddClicksDialogOpen} onOpenChange={setIsAddClicksDialogOpen}>
          <DialogContent 
            className="sm:max-w-md max-h-[85vh] frosted-glass border border-white/10 rounded-2xl"
            onInteractOutside={(e) => e.preventDefault()}
            hideCloseButton
          >
            <DialogHeader>
              <DialogTitle>Add More Clicks</DialogTitle>
            </DialogHeader>
            {selectedTask && (
              <div className="space-y-4">
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

                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setIsAddClicksDialogOpen(false);
                      setSelectedTask(null);
                      setAdditionalClicks("500");
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="flex-1 btn-primary"
                    onClick={handleIncreaseClicks}
                    disabled={increaseClicksMutation.isPending || tonBalance < additionalCostTON}
                  >
                    {increaseClicksMutation.isPending ? "Processing..." : `Pay & Add`}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </Layout>
  );
}
