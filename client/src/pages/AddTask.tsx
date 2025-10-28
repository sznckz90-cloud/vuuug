import { useAuth } from "@/hooks/useAuth";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PlusCircle, Info } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useState } from "react";
import { useLocation } from "wouter";
import { tonToPAD } from "@shared/constants";

export default function AddTask() {
  const { user, isLoading } = useAuth();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  
  const [title, setTitle] = useState("");
  const [link, setLink] = useState("");
  const [totalClicks, setTotalClicks] = useState("100");

  const costPerClick = 3500;
  const rewardPerClick = 1750;
  const clicksNum = parseInt(totalClicks) || 0;
  const totalCost = costPerClick * clicksNum;
  const totalRewards = rewardPerClick * clicksNum;

  const balancePAD = tonToPAD((user as any)?.balance || "0");

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
        description: "Task created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/advertiser-tasks"] });
      setLocation("/my-tasks");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
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
        description: `You need ${totalCost.toLocaleString()} PAD but only have ${balancePAD.toLocaleString()} PAD`,
        variant: "destructive",
      });
      return;
    }

    createTaskMutation.mutate();
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

  return (
    <Layout>
      <main className="max-w-md mx-auto px-4 mt-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-2">
            <PlusCircle className="inline-block w-6 h-6 mr-2 mb-1" />
            Create Task
          </h1>
          <p className="text-sm text-muted-foreground">
            Create a promotional task for users to complete
          </p>
        </div>

        <Card className="minimal-card mb-4">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Info className="w-5 h-5" />
              Pricing Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cost per click:</span>
                <span className="font-semibold text-white">{costPerClick.toLocaleString()} PAD</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Publisher earns:</span>
                <span className="font-semibold text-green-500">{rewardPerClick.toLocaleString()} PAD</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Your balance:</span>
                <span className="font-semibold text-white">{balancePAD.toLocaleString()} PAD</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="minimal-card">
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="title">Task Title</Label>
                <Input
                  id="title"
                  placeholder="e.g., Visit our website"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="link">Task Link (URL)</Label>
                <Input
                  id="link"
                  type="url"
                  placeholder="https://example.com"
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="clicks">Number of Clicks</Label>
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
                {createTaskMutation.isPending ? "Creating..." : `Create Task (${totalCost.toLocaleString()} PAD)`}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </Layout>
  );
}
