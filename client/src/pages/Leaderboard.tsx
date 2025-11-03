import { useAuth } from "@/hooks/useAuth";
import Layout from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { Trophy, Users, Gem, UserPlus } from "lucide-react";
import { tonToPAD, formatCompactNumber } from "@shared/constants";
import { useState } from "react";
import type { User } from "@shared/schema";

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
  userEarnerRank?: { rank: number; totalEarnings: string } | null;
  userReferrerRank?: { rank: number; totalReferrals: number } | null;
}

export default function Leaderboard() {
  const { isLoading, user } = useAuth();
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
              <>
                <div className="space-y-2">
                  {topEarners.map((earner) => (
                    <Card key={earner.userId} className="minimal-card">
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="text-lg font-bold text-primary min-w-[40px]">
                              {getRankEmoji(earner.rank)}
                            </div>
                            {earner.profileImage ? (
                              <img 
                                src={earner.profileImage} 
                                alt={earner.username}
                                className="w-10 h-10 rounded-full flex-shrink-0"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-bold flex-shrink-0">
                                {earner.username?.[0] || '?'}
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="text-white font-medium text-sm truncate">
                                {earner.username || 'Anonymous'}
                              </div>
                            </div>
                          </div>
                          <div className="text-primary text-sm font-bold flex-shrink-0 flex items-center gap-1">
                            <Gem className="w-4 h-4" />
                            {formatCompactNumber(tonToPAD(earner.totalEarnings))} PAD
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                
                {/* Your Rank Section for Earners */}
                {leaderboardData?.userEarnerRank && leaderboardData.userEarnerRank.rank > 10 && (
                  <Card className="minimal-card mt-4 border-primary/30">
                    <CardContent className="p-3">
                      <div className="text-xs text-muted-foreground mb-2">Your Rank</div>
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="text-lg font-bold text-primary min-w-[40px]">
                            #{leaderboardData.userEarnerRank.rank}
                          </div>
                          {(user as User)?.profileImageUrl ? (
                            <img 
                              src={(user as User).profileImageUrl!} 
                              alt={(user as User).username || 'You'}
                              className="w-10 h-10 rounded-full flex-shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-bold flex-shrink-0">
                              {(user as User)?.username?.[0] || 'Y'}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="text-white font-medium text-sm truncate">
                              {(user as User)?.username || 'You'}
                            </div>
                          </div>
                        </div>
                        <div className="text-primary text-sm font-bold flex-shrink-0 flex items-center gap-1">
                          <Gem className="w-4 h-4" />
                          {formatCompactNumber(tonToPAD(leaderboardData.userEarnerRank.totalEarnings))} PAD
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
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
              <>
                <div className="space-y-2">
                  {topReferrers.map((referrer) => (
                    <Card key={referrer.userId} className="minimal-card">
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="text-lg font-bold text-primary min-w-[40px]">
                              {getRankEmoji(referrer.rank)}
                            </div>
                            {referrer.profileImage ? (
                              <img 
                                src={referrer.profileImage} 
                                alt={referrer.username}
                                className="w-10 h-10 rounded-full flex-shrink-0"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-bold flex-shrink-0">
                                {referrer.username?.[0] || '?'}
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="text-white font-medium text-sm truncate">
                                {referrer.username || 'Anonymous'}
                              </div>
                            </div>
                          </div>
                          <div className="text-primary text-sm font-bold flex-shrink-0 flex items-center gap-1">
                            <UserPlus className="w-4 h-4" />
                            {referrer.totalReferrals} referrals
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                
                {/* Your Rank Section for Referrers */}
                {leaderboardData?.userReferrerRank && leaderboardData.userReferrerRank.rank > 50 && (
                  <Card className="minimal-card mt-4 border-primary/30">
                    <CardContent className="p-3">
                      <div className="text-xs text-muted-foreground mb-2">Your Rank</div>
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="text-lg font-bold text-primary min-w-[40px]">
                            #{leaderboardData.userReferrerRank.rank}
                          </div>
                          {(user as User)?.profileImageUrl ? (
                            <img 
                              src={(user as User).profileImageUrl!} 
                              alt={(user as User).username || 'You'}
                              className="w-10 h-10 rounded-full flex-shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-bold flex-shrink-0">
                              {(user as User)?.username?.[0] || 'Y'}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="text-white font-medium text-sm truncate">
                              {(user as User)?.username || 'You'}
                            </div>
                          </div>
                        </div>
                        <div className="text-primary text-sm font-bold flex-shrink-0 flex items-center gap-1">
                          <UserPlus className="w-4 h-4" />
                          {leaderboardData.userReferrerRank.totalReferrals} referrals
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </div>
        )}
      </main>
    </Layout>
  );
}
