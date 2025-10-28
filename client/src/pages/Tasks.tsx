import { useAuth } from "@/hooks/useAuth";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, CheckCircle, Target, PlusCircle, FileText, Clock, TrendingUp, Info } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useState } from "react";
import { tonToPAD } from "@shared/constants";

interface Task {
  id: string;
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
  const [activeTab, setActiveTab] = useState("public");

  const [title, setTitle] = useState("");
  const [link, setLink] = useState("");
  const [totalClicks, setTotalClicks] = useState("100");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [additionalClicks, setAdditionalClicks] = useState("100");

  const costPerClick = 3500;
  const rewardPerClick = 1750;
  const clicksNum = parseInt(totalClicks) || 0;
  const totalCost = costPerClick * clicksNum;
  const totalRewards = rewardPerClick * clicksNum;
  const balancePAD = tonToPAD((user as any)?.balance || "0");
  const additionalCost = costPerClick * (parseInt(additionalClicks) || 0);

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
    enabled: activeTab === "my-tasks",
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
      toast({
        title: "Success!",
        description: data.message + ` You earned ${Math.floor(parseFloat(data.reward) * 10000000)} PAD!`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/advertiser-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
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
    onSuccess: () => {
      toast({
        title: "Success!",
        description: "Task created and published successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/advertiser-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/advertiser-tasks/my-tasks"] });
      setTitle("");
      setLink("");
      setTotalClicks("100");
      setActiveTab("my-tasks");
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
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      setSelectedTask(null);
      setAdditionalClicks("100");
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

    if (!title.trim()) {
      toast({
        title: "Error",
        description: "Please enter a task title",
        variant: "destructive",
      });
      return;
    }

    if (!link.trim() || !link.startsWith("http")) {
      toast({
        title: "Error",
        description: "Please enter a valid URL starting with http:// or https://",
        variant: "destructive",
      });
      return;
    }

    if (clicksNum < 100) {
      toast({
        title: "Error",
        description: "Minimum 100 clicks required",
        variant: "destructive",
      });
      return;
    }

    if (balancePAD < totalCost) {
      toast({
        title: "Insufficient balance",
        description: `You don't have enough PAD balance. You need ${totalCost.toLocaleString()} PAD but only have ${balancePAD.toLocaleString()} PAD`,
        variant: "destructive",
      });
      return;
    }

    createTaskMutation.mutate();
  };

  const handleIncreaseClicks = () => {
    if (!selectedTask) return;

    const clicks = parseInt(additionalClicks);
    if (clicks < 100) {
      toast({
        title: "Error",
        description: "Minimum 100 additional clicks required",
        variant: "destructive",
      });
      return;
    }

    if (balancePAD < additionalCost) {
      toast({
        title: "Insufficient balance",
        description: `You need ${additionalCost.toLocaleString()} PAD`,
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
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-2">
            <Target className="inline-block w-6 h-6 mr-2 mb-1" />
            Task Section
          </h1>
          <p className="text-sm text-muted-foreground">
            Earn PAD by completing tasks or create your own
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="public">Public Tasks</TabsTrigger>
            <TabsTrigger value="add-task">Add Task</TabsTrigger>
            <TabsTrigger value="my-tasks">My Tasks</TabsTrigger>
          </TabsList>

          <TabsContent value="public">
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
                  const progress = (task.currentClicks / task.totalClicksRequired) * 100;
                  const remaining = task.totalClicksRequired - task.currentClicks;

                  return (
                    <Card key={task.id} className="minimal-card">
                      <CardContent className="pt-4 pb-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <h3 className="font-semibold text-white mb-1">{task.title}</h3>
                            <p className="text-xs text-muted-foreground mb-2">
                              Earn {rewardPerClick.toLocaleString()} PAD per click
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
          </TabsContent>

          <TabsContent value="add-task">
            <Card className="minimal-card">
              <CardContent className="pt-6">
                <form onSubmit={handleCreateTask} className="space-y-4">
                  <div>
                    <Label htmlFor="title">Task Title</Label>
                    <Input
                      id="title"
                      placeholder="Enter your task title or short description"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="link">Task Link</Label>
                    <Input
                      id="link"
                      type="url"
                      placeholder="Paste the link you want users to visit"
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
                      min="100"
                      step="100"
                      placeholder="100"
                      value={totalClicks}
                      onChange={(e) => setTotalClicks(e.target.value)}
                      className="mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Minimum 100 clicks
                    </p>
                  </div>

                  <div className="bg-secondary/50 rounded-lg p-4 space-y-2">
                    <h3 className="font-semibold text-white text-sm mb-3">Summary</h3>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Total clicks:</span>
                      <span className="font-semibold text-white">{clicksNum.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Total rewards paid:</span>
                      <span className="font-semibold text-green-500">{totalRewards.toLocaleString()} PAD</span>
                    </div>
                    <div className="flex justify-between text-sm pt-2 border-t border-border">
                      <span className="text-muted-foreground font-semibold">Total cost:</span>
                      <span className="font-bold text-white">{totalCost.toLocaleString()} PAD</span>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full btn-primary"
                    disabled={createTaskMutation.isPending || balancePAD < totalCost}
                  >
                    <PlusCircle className="w-4 h-4 mr-2" />
                    {createTaskMutation.isPending ? "Creating..." : `Create Task (${totalCost.toLocaleString()} PAD)`}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="my-tasks">
            {myTasksLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin text-primary text-2xl mb-2">
                  <i className="fas fa-spinner"></i>
                </div>
                <p className="text-muted-foreground">Loading your tasks...</p>
              </div>
            ) : myTasks.length === 0 ? (
              <Card className="minimal-card">
                <CardContent className="pt-6 pb-6 text-center">
                  <FileText className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                  <p className="text-muted-foreground mb-4">No tasks created yet</p>
                  <Button
                    className="btn-primary"
                    onClick={() => setActiveTab("add-task")}
                  >
                    <PlusCircle className="w-4 h-4 mr-2" />
                    Create Your First Task
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <>
                {activeMyTasks.length > 0 && (
                  <>
                    <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                      <Clock className="w-5 h-5" />
                      Active Tasks ({activeMyTasks.length})
                    </h2>
                    <div className="space-y-3 mb-6">
                      {activeMyTasks.map((task) => {
                        const progress = (task.currentClicks / task.totalClicksRequired) * 100;
                        const remaining = task.totalClicksRequired - task.currentClicks;

                        return (
                          <Card key={task.id} className="minimal-card">
                            <CardContent className="pt-4 pb-4">
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex-1">
                                  <h3 className="font-semibold text-white mb-1">{task.title}</h3>
                                  <p className="text-xs text-muted-foreground break-all mb-2">
                                    {task.link}
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
                                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                                  <span>{progress.toFixed(1)}% complete</span>
                                  <span>Cost: {Math.floor(parseFloat(task.totalCost) * 10000000).toLocaleString()} PAD</span>
                                </div>
                              </div>

                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full"
                                    onClick={() => setSelectedTask(task)}
                                  >
                                    <TrendingUp className="w-4 h-4 mr-2" />
                                    Add More Clicks
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>Add More Clicks</DialogTitle>
                                  </DialogHeader>
                                  <div className="space-y-4">
                                    <div>
                                      <p className="text-sm text-muted-foreground mb-2">
                                        Task: <span className="text-white font-semibold">{task.title}</span>
                                      </p>
                                      <p className="text-sm text-muted-foreground">
                                        Current: {task.currentClicks} / {task.totalClicksRequired} clicks
                                      </p>
                                    </div>

                                    <div>
                                      <Label htmlFor="additional-clicks">Additional Clicks</Label>
                                      <Input
                                        id="additional-clicks"
                                        type="number"
                                        min="100"
                                        step="100"
                                        value={additionalClicks}
                                        onChange={(e) => setAdditionalClicks(e.target.value)}
                                        className="mt-1"
                                      />
                                      <p className="text-xs text-muted-foreground mt-1">
                                        Minimum 100 clicks
                                      </p>
                                    </div>

                                    <div className="bg-secondary/50 rounded-lg p-3 space-y-1">
                                      <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Cost per click:</span>
                                        <span className="text-white">{costPerClick.toLocaleString()} PAD</span>
                                      </div>
                                      <div className="flex justify-between text-sm font-semibold">
                                        <span className="text-muted-foreground">Total cost:</span>
                                        <span className="text-white">{additionalCost.toLocaleString()} PAD</span>
                                      </div>
                                      <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Your balance:</span>
                                        <span className="text-white">{balancePAD.toLocaleString()} PAD</span>
                                      </div>
                                    </div>

                                    <Button
                                      className="w-full btn-primary"
                                      onClick={handleIncreaseClicks}
                                      disabled={increaseClicksMutation.isPending || balancePAD < additionalCost}
                                    >
                                      {increaseClicksMutation.isPending ? "Processing..." : `Add ${additionalClicks} Clicks`}
                                    </Button>
                                  </div>
                                </DialogContent>
                              </Dialog>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </>
                )}

                {completedMyTasks.length > 0 && (
                  <>
                    <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                      Completed Tasks ({completedMyTasks.length})
                    </h2>
                    <div className="space-y-3">
                      {completedMyTasks.map((task) => (
                        <Card key={task.id} className="minimal-card opacity-75">
                          <CardContent className="pt-4 pb-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <h3 className="font-semibold text-white mb-1">{task.title}</h3>
                                <p className="text-xs text-muted-foreground break-all mb-2">
                                  {task.link}
                                </p>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <CheckCircle className="w-3 h-3 text-green-500" />
                                  <span>Completed</span>
                                  <span>•</span>
                                  <span>{task.totalClicksRequired} clicks delivered</span>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </Layout>
  );
}
