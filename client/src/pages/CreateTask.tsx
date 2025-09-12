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
import { apiRequest } from '@/lib/queryClient';

interface CreateTaskForm {
  type: 'subscribe' | 'bot';
  url: string;
}

export default function CreateTask() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<CreateTaskForm>({
    type: 'subscribe',
    url: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!form.url.trim()) newErrors.url = 'Channel/Bot URL is required';
    
    // Validate and normalize URL format
    let urlToValidate = form.url.trim();
    if (urlToValidate && !urlToValidate.startsWith('http')) {
      urlToValidate = 'https://' + urlToValidate;
    }
    
    try {
      const url = new URL(urlToValidate);
      if (!url.hostname.includes('t.me') && !url.hostname.includes('telegram.me')) {
        newErrors.url = 'Please enter a valid Telegram URL (t.me or telegram.me)';
      }
    } catch {
      newErrors.url = 'Please enter a valid URL';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const createTaskMutation = useMutation({
    mutationFn: async (taskData: CreateTaskForm) => {
      // Add fixed values for cost, reward, limit, and title
      const taskPayload = {
        ...taskData,
        cost: '0.01',
        rewardPerUser: '0.00025',
        limit: 1000,
        title: `${taskData.type === 'subscribe' ? 'Subscribe to' : 'Start'} ${taskData.url.replace('https://t.me/', '@')}`,
      };

      const response = await apiRequest('POST', '/api/promotions/create', taskPayload);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Task Created Successfully! 🎉",
        description: `Your promotional task has been created and posted to the channel.`,
      });
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user/promotions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/promotions'] });
      
      // Reset form
      setForm({
        type: 'subscribe',
        url: ''
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

            {/* Fixed Cost Info */}
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="text-sm font-medium text-foreground mb-2">Task Details:</div>
              <div className="space-y-1 text-sm text-muted-foreground">
                <div className="flex justify-between">
                  <span>Ad Cost:</span>
                  <span className="font-medium">$0.01</span>
                </div>
                <div className="flex justify-between">
                  <span>Max Participants:</span>
                  <span className="font-medium">1,000 users</span>
                </div>
                <div className="flex justify-between">
                  <span>Reward per User:</span>
                  <span className="font-medium">$0.00001</span>
                </div>
              </div>
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