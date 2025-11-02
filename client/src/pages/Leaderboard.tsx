import { useAuth } from "@/hooks/useAuth";
import Layout from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { Trophy, Users } from "lucide-react";
import { tonToPAD, formatCompactNumber } from "@shared/constants";
import { useState } from "react";

interface LeaderboardUser {
  rank: number;
  username: string;
  profileImage: string;
  userId: string;
}

interface EarnerUser extends LeaderboardUser {
  totalEarnings: string;
}

interface ReferrerUser extends LeaderboardUser {
  totalReferrals: number;
}

interface LeaderboardData {
  topEarners: EarnerUser[];
  topReferrers: ReferrerUser[];
}

export default function Leaderboard() {
  const { isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<'earners' | 'referrers'>('earners');

  const { data: leaderboardData, isLoading: leaderboardLoading } = useQuery<LeaderboardData>({
    queryKey: ["/api/leaderboard/monthly"],
    retry: false,
    refetchOnMount: true,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin text-primary text-3xl mb-4">
            <i className="fas fa-spinner"></i>
          </div>
          <div className="text-foreground font-medium">Loading...</div>
        </div>
      </div>
    );
  }

  const topEarners = leaderboardData?.topEarners || [];
  const topReferrers = leaderboardData?.topReferrers || [];

  const getRankEmoji = (rank: number) => {
    switch (rank) {
      case 1: return '🥇';
      case 2: return '🥈';
      case 3: return '🥉';
      default: return `#${rank}`;
    }
  };

  return (
    <Layout>
      <main className="max-w-md mx-auto px-4 mt-6 pb-24">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
            <Trophy className="w-6 h-6 text-primary" />
            Monthly Leaderboard
          </h1>
          <p className="text-sm text-muted-foreground">
            Top performers this month
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <Button
            onClick={() => setActiveTab('earners')}
            className={`h-10 ${
              activeTab === 'earners'
                ? 'btn-primary'
                : 'bg-[#1A1A1A] border border-[#2A2A2A] text-muted-foreground hover:bg-[#2A2A2A]'
            }`}
          >
            <Trophy className="w-4 h-4 mr-2" />
            PAD Earners
          </Button>
          <Button
            onClick={() => setActiveTab('referrers')}
            className={`h-10 ${
              activeTab === 'referrers'
                ? 'btn-primary'
                : 'bg-[#1A1A1A] border border-[#2A2A2A] text-muted-foreground hover:bg-[#2A2A2A]'
            }`}
          >
            <Users className="w-4 h-4 mr-2" />
            Top Referrers
          </Button>
        </div>

        {/* PAD Earners Ranking */}
        {activeTab === 'earners' && (
          <div>
            {leaderboardLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin text-primary text-2xl mb-2">
                  <i className="fas fa-spinner"></i>
                </div>
                <p className="text-muted-foreground">Loading rankings...</p>
              </div>
            ) : topEarners.length === 0 ? (
              <Card className="minimal-card">
                <CardContent className="pt-6 pb-6 text-center">
                  <Trophy className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                  <p className="text-muted-foreground">No earnings data available</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {topEarners.map((earner) => (
                  <Card key={earner.userId} className="minimal-card">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-3">
                        <div className="text-lg font-bold text-primary min-w-[40px]">
                          {getRankEmoji(earner.rank)}
                        </div>
                        {earner.profileImage ? (
                          <img 
                            src={earner.profileImage} 
                            alt={earner.username}
                            className="w-10 h-10 rounded-full"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-bold">
                            {earner.username?.[0] || '?'}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-white font-medium text-sm truncate">
                            {earner.username || 'Anonymous'}
                          </div>
                          <div className="text-primary text-xs font-bold">
                            {formatCompactNumber(tonToPAD(earner.totalEarnings))} PAD
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Top Referrers Ranking */}
        {activeTab === 'referrers' && (
          <div>
            {leaderboardLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin text-primary text-2xl mb-2">
                  <i className="fas fa-spinner"></i>
                </div>
                <p className="text-muted-foreground">Loading rankings...</p>
              </div>
            ) : topReferrers.length === 0 ? (
              <Card className="minimal-card">
                <CardContent className="pt-6 pb-6 text-center">
                  <Users className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                  <p className="text-muted-foreground">No referrals data available</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {topReferrers.map((referrer) => (
                  <Card key={referrer.userId} className="minimal-card">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-3">
                        <div className="text-lg font-bold text-primary min-w-[40px]">
                          {getRankEmoji(referrer.rank)}
                        </div>
                        {referrer.profileImage ? (
                          <img 
                            src={referrer.profileImage} 
                            alt={referrer.username}
                            className="w-10 h-10 rounded-full"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-bold">
                            {referrer.username?.[0] || '?'}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-white font-medium text-sm truncate">
                            {referrer.username || 'Anonymous'}
                          </div>
                          <div className="text-primary text-xs font-bold">
                            {referrer.totalReferrals} referrals
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </Layout>
  );
}
