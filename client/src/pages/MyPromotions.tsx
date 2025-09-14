import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import Layout from '@/components/Layout';
import { formatCurrency } from '@/lib/utils';

interface UserPromotion {
  id: string;
  title: string;
  description: string;
  type: 'channel' | 'bot';
  rewardPerUser: string;
  limit: number;
  claimedCount: number;
  status: string;
  cost: string;
  createdAt: string;
  channelPostUrl?: string;
}

export default function MyPromotions() {
  // Fetch user's promotions
  const { data: promotionsResponse, isLoading } = useQuery<{success: boolean, promotions: UserPromotion[]}>({
    queryKey: ['/api/user/promotions'],
    retry: false,
  });

  const promotions = promotionsResponse?.promotions || [];

  const PromotionCard = ({ promotion }: { promotion: UserPromotion }) => {
    const progressPercentage = (promotion.claimedCount / promotion.limit) * 100;
    const remainingSlots = promotion.limit - promotion.claimedCount;
    const totalSpent = parseFloat(promotion.rewardPerUser) * promotion.claimedCount;

    return (
      <Card className="shadow-sm border border-border">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-base font-semibold text-foreground">{promotion.title}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">{promotion.description}</p>
            </div>
            <div className="flex flex-col items-end gap-1 ml-2">
              <Badge variant={promotion.status === 'active' ? "default" : "secondary"}>
                {promotion.status}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {promotion.type}
              </Badge>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="pt-0 space-y-4">
          {/* Progress Section */}
          <div>
            <div className="flex justify-between text-sm font-medium mb-2">
              <span>Progress</span>
              <span>{promotion.claimedCount}/{promotion.limit}</span>
            </div>
            <Progress value={progressPercentage} className="h-2 mb-2" />
            <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground">
              <div>
                <span className="font-medium text-green-600">{promotion.claimedCount}</span> completed
              </div>
              <div>
                <span className="font-medium text-orange-600">{remainingSlots}</span> remaining
              </div>
            </div>
          </div>

          {/* Financial Info */}
          <div className="bg-muted/50 rounded-lg p-3 space-y-2">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground">Reward/User</div>
                <div className="font-medium">{formatCurrency(promotion.rewardPerUser)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Total Budget</div>
                <div className="font-medium">{formatCurrency(promotion.cost)}</div>
              </div>
            </div>
            <div className="border-t border-border pt-2">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Amount Spent:</span>
                <span className="font-medium text-red-600">{formatCurrency(totalSpent)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Remaining Budget:</span>
                <span className="font-medium text-green-600">{formatCurrency(parseFloat(promotion.cost) - totalSpent)}</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            {promotion.channelPostUrl && (
              <Button 
                size="sm" 
                variant="outline" 
                className="flex-1"
                onClick={() => window.open(promotion.channelPostUrl, '_blank')}
              >
                <i className="fas fa-external-link-alt mr-1"></i>
                View Post
              </Button>
            )}
            <Button 
              size="sm" 
              variant="outline" 
              className="flex-1"
              disabled={promotion.status !== 'active'}
            >
              <i className="fas fa-edit mr-1"></i>
              Manage
            </Button>
          </div>

          {/* Created Date */}
          <div className="text-xs text-muted-foreground text-center">
            Created {new Date(promotion.createdAt).toLocaleDateString()}
          </div>
        </CardContent>
      </Card>
    );
  };

  if (isLoading) {
    return (
      <div className="max-w-md mx-auto p-4 pb-20">
        <div className="text-center py-8">
          <div className="animate-spin text-primary text-xl mb-2">
            <i className="fas fa-spinner"></i>
          </div>
          <div className="text-muted-foreground">Loading your promotions...</div>
        </div>
      </div>
    );
  }

  return (
    <Layout>
      <div className="max-w-md mx-auto p-4 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Promotions</h1>
          <p className="text-sm text-muted-foreground">Manage your created tasks</p>
        </div>
        <Link href="/create-task">
          <Button size="sm" className="gap-1">
            <i className="fas fa-plus"></i>
            Create
          </Button>
        </Link>
      </div>

      {/* Promotions List */}
      {promotions.length > 0 ? (
        <div className="space-y-4">
          {promotions.map((promotion) => (
            <PromotionCard key={promotion.id} promotion={promotion} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="bg-muted/30 rounded-full p-6 w-20 h-20 mx-auto mb-4 flex items-center justify-center">
            <i className="fas fa-megaphone text-2xl text-muted-foreground"></i>
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">No Promotions Yet</h3>
          <p className="text-muted-foreground mb-4 text-sm">
            Create your first task to start promoting your content
          </p>
          <Link href="/create-task">
            <Button>
              <i className="fas fa-plus mr-2"></i>
              Create Your First Task
            </Button>
          </Link>
        </div>
      )}
      </div>
    </Layout>
  );
}