import { useAuth } from "@/hooks/useAuth";
import Layout from "@/components/Layout";
import AdWatchingSection from "@/components/AdWatchingSection";
import StreakCard from "@/components/StreakCard";
import PromoCodeDialog from "@/components/PromoCodeDialog";
import WalletDialog from "@/components/WalletDialog";
import WithdrawDialog from "@/components/WithdrawDialog";
import HistoryDialog from "@/components/HistoryDialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import React from "react";
import { useAdmin } from "@/hooks/useAdmin";
import { useLocation } from "wouter";
import { Settings, Gift, Zap, Wallet as WalletIcon, ArrowDown, History, Ticket } from "lucide-react";

interface User {
  id?: string;
  telegramId?: string;
  balance?: string;
  lastStreakDate?: string;
  username?: string;
  firstName?: string;
  [key: string]: any;
}

export default function Home() {
  const { user, isLoading } = useAuth();
  const { isAdmin } = useAdmin();
  const [, setLocation] = useLocation();
  const [streakDialogOpen, setStreakDialogOpen] = React.useState(false);
  const [promoDialogOpen, setPromoDialogOpen] = React.useState(false);
  const [walletDialogOpen, setWalletDialogOpen] = React.useState(false);
  const [withdrawDialogOpen, setWithdrawDialogOpen] = React.useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = React.useState(false);

  const { data: stats, isLoading: statsLoading } = useQuery<{
    todayEarnings?: string;
    referralEarnings?: string;
  }>({
    queryKey: ["/api/user/stats"],
    retry: false,
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

  const balancePAD = Math.round(parseFloat((user as User)?.balance || "0") * 100000);
  const todayEarnings = Math.round(parseFloat(stats?.todayEarnings || "0") * 100000);
  const allTimeEarnings = balancePAD;
  const referralEarnings = Math.round(parseFloat(stats?.referralEarnings || "0") * 100000);
  
  const referralCode = (user as User)?.referralCode || "000000";
  const formattedUserId = referralCode.slice(-6).toUpperCase();

  return (
    <Layout>
      <main className="max-w-md mx-auto px-4 pb-24 pt-4">
        {/* Balance + UID Section */}
        <div className="mb-4">
          <Card className="neon-glow-border">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between mb-4">
                <div className="text-white text-xs">
                  UID: #{formattedUserId}
                </div>
                
                <div className="flex gap-2">
                  <Button
                    size="icon"
                    className="h-8 w-8 bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={() => setPromoDialogOpen(true)}
                  >
                    <Ticket className="w-4 h-4" />
                  </Button>
                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-8 h-8"
                      onClick={() => setLocation("/admin")}
                    >
                      <Settings className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
              
              <div className="text-center">
                <div className="text-muted-foreground text-xs mb-1">Balance</div>
                <div className="text-foreground font-bold text-2xl">{balancePAD.toLocaleString()} PAD</div>
                <div className="text-muted-foreground text-xs mt-1">
                  ≈ ${(balancePAD / 100000).toFixed(4)} USD
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Wallet Navigation Buttons */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <Button 
            variant="outline" 
            className="w-full h-14 flex flex-col gap-1 border-primary/30 hover:bg-primary/10"
            onClick={() => setWalletDialogOpen(true)}
          >
            <WalletIcon className="w-5 h-5" />
            <span className="text-xs">Wallet</span>
          </Button>
          <Button 
            variant="outline" 
            className="w-full h-14 flex flex-col gap-1 border-primary/30 hover:bg-primary/10"
            onClick={() => setWithdrawDialogOpen(true)}
          >
            <ArrowDown className="w-5 h-5" />
            <span className="text-xs">Withdraw</span>
          </Button>
          <Button 
            variant="outline" 
            className="w-full h-14 flex flex-col gap-1 border-primary/30 hover:bg-primary/10"
            onClick={() => setHistoryDialogOpen(true)}
          >
            <History className="w-5 h-5" />
            <span className="text-xs">History</span>
          </Button>
        </div>

        {/* Income Statistics */}
        <Card className="mb-4 neon-glow-border">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Income statistics</h3>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <div className="text-xs text-muted-foreground mb-1">Today</div>
                <div className="text-foreground font-semibold">{todayEarnings.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">All time</div>
                <div className="text-foreground font-semibold">{allTimeEarnings.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">On referrals</div>
                <div className="text-foreground font-semibold">{referralEarnings.toLocaleString()}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Viewing Ads Section */}
        <AdWatchingSection user={user as User} />

        {/* Claim and Boost Buttons */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            className="w-full h-12 border-primary/30 hover:bg-primary/10"
            onClick={() => setStreakDialogOpen(true)}
          >
            <Gift className="w-5 h-5 mr-2" />
            Claim
          </Button>
          
          <Button
            variant="outline"
            className="w-full h-12 border-primary/30 hover:bg-primary/10"
            onClick={() => setLocation("/affiliates")}
          >
            <Zap className="w-5 h-5 mr-2" />
            Boost
          </Button>
        </div>

        {/* Streak Dialog */}
        <StreakCard 
          user={user as User} 
          open={streakDialogOpen}
          onOpenChange={setStreakDialogOpen}
        />

        {/* Promo Code Dialog */}
        <PromoCodeDialog 
          open={promoDialogOpen}
          onOpenChange={setPromoDialogOpen}
        />

        {/* Wallet Dialog */}
        <WalletDialog 
          open={walletDialogOpen}
          onOpenChange={setWalletDialogOpen}
        />

        {/* Withdraw Dialog */}
        <WithdrawDialog 
          open={withdrawDialogOpen}
          onOpenChange={setWithdrawDialogOpen}
        />

        {/* History Dialog */}
        <HistoryDialog 
          open={historyDialogOpen}
          onOpenChange={setHistoryDialogOpen}
        />
      </main>
    </Layout>
  );
}
