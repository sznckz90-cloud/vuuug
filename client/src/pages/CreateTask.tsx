import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import Layout from '@/components/Layout';

interface CreateTaskForm {
  type: 'subscribe' | 'bot';
  url: string;
  cost: string;
  rewardPerUser: string;
  limit: number;
  title: string;
  description: string;
}

export default function CreateTask() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<CreateTaskForm>({
    type: 'subscribe',
    url: '',
    cost: '',
    rewardPerUser: '',
    limit: 100,
    title: '',
    description: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!form.title.trim()) newErrors.title = 'Title is required';
    if (!form.description.trim()) newErrors.description = 'Description is required';
    if (!form.url.trim()) newErrors.url = 'URL is required';
    if (!form.cost || parseFloat(form.cost) <= 0) newErrors.cost = 'Cost must be greater than 0';
    if (!form.rewardPerUser || parseFloat(form.rewardPerUser) <= 0) newErrors.rewardPerUser = 'Reward must be greater than 0';
    if (form.limit <= 0) newErrors.limit = 'Limit must be greater than 0';
    
    // Validate URL format
    try {
      new URL(form.url);
    } catch {
      newErrors.url = 'Please enter a valid URL';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const createTaskMutation = useMutation({
    mutationFn: async (taskData: CreateTaskForm) => {
      const response = await fetch('/api/promotions/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(taskData)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create task');
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Task Created Successfully! 🎉",
        description: `Your ${form.type} task "${form.title}" has been created and posted to the channel.`,
      });
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user/promotions'] });
      
      // Reset form
      setForm({
        type: 'subscribe',
        url: '',
        cost: '',
        rewardPerUser: '',
        limit: 100,
        title: '',
        description: ''
      });
      setErrors({});
      
      // Navigate to promotions management
      setLocation('/my-promotions');
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Create Task",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      createTaskMutation.mutate(form);
    }
  };

  const updateForm = (field: keyof CreateTaskForm, value: string | number) => {
    setForm(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const totalCost = parseFloat(form.cost || '0');
  const rewardPerUser = parseFloat(form.rewardPerUser || '0');
  const calculatedCost = rewardPerUser * form.limit;

  return (
    <Layout>
      <div className="max-w-md mx-auto p-4 pb-20">
      <Card className="shadow-sm border border-border">
        <CardHeader className="pb-4">
          <CardTitle className="text-xl font-bold text-foreground flex items-center gap-2">
            <i className="fas fa-plus-circle text-primary"></i>
            Create New Task
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Create a task for other users to complete and earn rewards
          </p>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Task Type */}
            <div className="space-y-2">
              <Label htmlFor="type">Task Type</Label>
              <Select value={form.type} onValueChange={(value: 'subscribe' | 'bot') => updateForm('type', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select task type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="subscribe">
                    <div className="flex items-center gap-2">
                      <i className="fas fa-users text-blue-600"></i>
                      Channel Subscription
                    </div>
                  </SelectItem>
                  <SelectItem value="bot">
                    <div className="flex items-center gap-2">
                      <i className="fas fa-robot text-green-600"></i>
                      Bot Interaction
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">Task Title</Label>
              <Input
                id="title"
                value={form.title}
                onChange={(e) => updateForm('title', e.target.value)}
                placeholder="e.g., Subscribe to our crypto channel"
                className={errors.title ? 'border-red-500' : ''}
              />
              {errors.title && <p className="text-sm text-red-500">{errors.title}</p>}
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={(e) => updateForm('description', e.target.value)}
                placeholder="Describe what users need to do..."
                rows={3}
                className={errors.description ? 'border-red-500' : ''}
              />
              {errors.description && <p className="text-sm text-red-500">{errors.description}</p>}
            </div>

            {/* URL */}
            <div className="space-y-2">
              <Label htmlFor="url">{form.type === 'subscribe' ? 'Channel URL' : 'Bot URL'}</Label>
              <Input
                id="url"
                value={form.url}
                onChange={(e) => updateForm('url', e.target.value)}
                placeholder={form.type === 'subscribe' ? 'https://t.me/yourchannel' : 'https://t.me/yourbot'}
                className={errors.url ? 'border-red-500' : ''}
              />
              {errors.url && <p className="text-sm text-red-500">{errors.url}</p>}
            </div>

            {/* Reward Per User */}
            <div className="space-y-2">
              <Label htmlFor="rewardPerUser">Reward Per User ($)</Label>
              <Input
                id="rewardPerUser"
                type="number"
                step="0.00001"
                min="0.00001"
                value={form.rewardPerUser}
                onChange={(e) => updateForm('rewardPerUser', e.target.value)}
                placeholder="0.50"
                className={errors.rewardPerUser ? 'border-red-500' : ''}
              />
              {errors.rewardPerUser && <p className="text-sm text-red-500">{errors.rewardPerUser}</p>}
            </div>

            {/* Limit */}
            <div className="space-y-2">
              <Label htmlFor="limit">Maximum Participants</Label>
              <Input
                id="limit"
                type="number"
                min="1"
                value={form.limit}
                onChange={(e) => updateForm('limit', parseInt(e.target.value) || 0)}
                placeholder="100"
                className={errors.limit ? 'border-red-500' : ''}
              />
              {errors.limit && <p className="text-sm text-red-500">{errors.limit}</p>}
            </div>

            {/* Total Cost */}
            <div className="space-y-2">
              <Label htmlFor="cost">Total Budget ($)</Label>
              <Input
                id="cost"
                type="number"
                step="0.00001"
                min="0"
                value={form.cost}
                onChange={(e) => updateForm('cost', e.target.value)}
                placeholder="50.00"
                className={errors.cost ? 'border-red-500' : ''}
              />
              {errors.cost && <p className="text-sm text-red-500">{errors.cost}</p>}
              
              {/* Cost Calculator */}
              {rewardPerUser > 0 && form.limit > 0 && (
                <div className="bg-muted p-3 rounded-lg">
                  <div className="text-sm text-muted-foreground mb-1">Calculated Cost:</div>
                  <div className="font-medium">
                    ${rewardPerUser.toFixed(5)} × {form.limit} = ${calculatedCost.toFixed(5)}
                  </div>
                  {totalCost > 0 && totalCost !== calculatedCost && (
                    <Badge variant={totalCost >= calculatedCost ? "default" : "destructive"} className="mt-1">
                      {totalCost >= calculatedCost ? '✓ Sufficient budget' : '⚠ Insufficient budget'}
                    </Badge>
                  )}
                </div>
              )}
            </div>

            {/* Submit Button */}
            <Button 
              type="submit" 
              className="w-full" 
              disabled={createTaskMutation.isPending}
            >
              {createTaskMutation.isPending ? (
                <>
                  <i className="fas fa-spinner fa-spin mr-2"></i>
                  Creating Task...
                </>
              ) : (
                <>
                  <i className="fas fa-rocket mr-2"></i>
                  Create & Launch Task
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
      </div>
    </Layout>
  );
}