import { useAuth } from "@/hooks/useAuth";
import Layout from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, CheckCircle, Target } from "lucide-react";
import { toast } from "@/hooks/use-toast";

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
}

export default function Tasks() {
  const { user, isLoading } = useAuth();
  const queryClient = useQueryClient();

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

  if (isLoading || tasksLoading) {
    return (
      <Layout>
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin text-primary text-3xl mb-4">
              <i className="fas fa-spinner"></i>
            </div>
            <div className="text-foreground font-medium">Loading tasks...</div>
          </div>
        </div>
      </Layout>
    );
  }

  const tasks = tasksData?.tasks || [];
  const activeTasks = tasks.filter(t => t.status === "active");

  return (
    <Layout>
      <main className="max-w-md mx-auto px-4 mt-6">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl font-bold text-white">
              <Target className="inline-block w-6 h-6 mr-2 mb-1" />
              Advertiser Tasks
            </h1>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => window.location.href = "/my-tasks"}
                className="text-xs"
              >
                My Tasks
              </Button>
              <Button
                size="sm"
                onClick={() => window.location.href = "/add-task"}
                className="text-xs"
              >
                Create Task
              </Button>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Click on tasks to earn rewards. You earn 1,750 PAD per task.
          </p>
        </div>

        {activeTasks.length === 0 ? (
          <Card className="minimal-card">
            <CardContent className="pt-6 pb-6 text-center">
              <Target className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
              <p className="text-muted-foreground">No active tasks available</p>
              <p className="text-xs text-muted-foreground mt-1">Check back later for new tasks</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {activeTasks.map((task) => {
              const progress = (task.currentClicks / task.totalClicksRequired) * 100;
              const remaining = task.totalClicksRequired - task.currentClicks;

              return (
                <Card key={task.id} className="minimal-card">
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-semibold text-white mb-1">{task.title}</h3>
                        <p className="text-xs text-muted-foreground mb-2">
                          Earn 1,750 PAD per click
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
      </main>
    </Layout>
  );
}
