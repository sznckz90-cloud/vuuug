import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { 
  Menu, 
  Wallet, 
  Receipt, 
  TrendingUp, 
  Trophy, 
  ClipboardList,
  MessageCircle,
  Bell,
  Code2,
  HelpCircle,
  Settings,
  Award,
  PlusCircle,
  ArrowDown
} from "lucide-react";
import { useAdmin } from "@/hooks/useAdmin";
import CwalletSetupDialog from "@/components/CwalletSetupDialog";
import WithdrawDialog from "@/components/WithdrawDialog";

export default function HamburgerMenu() {
  const { isAdmin } = useAdmin();
  const [menuOpen, setMenuOpen] = useState(false);
  const [walletDialogOpen, setWalletDialogOpen] = useState(false);
  const [withdrawDialogOpen, setWithdrawDialogOpen] = useState(false);

  const { data: user } = useQuery<any>({
    queryKey: ['/api/auth/user'],
    retry: false,
  });

  const { data: leaderboardData } = useQuery<{
    userEarnerRank?: { rank: number; totalEarnings: string } | null;
  }>({
    queryKey: ['/api/leaderboard/monthly'],
    retry: false,
  });

  const photoUrl = typeof window !== 'undefined' && (window as any).Telegram?.WebApp?.initDataUnsafe?.user?.photo_url;
  const firstName = user?.firstName || user?.username || 'User';
  const username = user?.username || '';
  const uid = user?.referralCode || '';

  const handleWalletClick = () => {
    setMenuOpen(false);
    setWalletDialogOpen(true);
  };

  const handleWithdrawClick = () => {
    setMenuOpen(false);
    setWithdrawDialogOpen(true);
  };

  const handleExternalLink = (url: string) => {
    window.open(url, '_blank');
  };

  const getRankBadge = () => {
    const rank = leaderboardData?.userEarnerRank?.rank;
    
    if (!rank) {
      return null;
    }

    return (
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-gradient-to-r from-[#4cd3ff]/20 to-[#b8b8b8]/20 border border-[#4cd3ff]/30">
        <Award className="w-3.5 h-3.5 text-[#4cd3ff]" />
        <span className="text-[10px] font-bold text-[#4cd3ff]">#{rank}</span>
      </div>
    );
  };

  return (
    <>
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="w-[50px] h-[50px] bg-gray-700/50 text-white hover:bg-gray-700/70 active:bg-gray-600/80 p-0 transition-all duration-200 rounded-lg"
          >
            <Menu className="w-6 h-6" strokeWidth={2.5} />
          </Button>
        </SheetTrigger>
        <SheetContent 
          side="left" 
          className="w-[280px] bg-black/40 backdrop-blur-xl border-r border-white/10 [&>button]:hidden overflow-y-auto"
        >
          <SheetHeader className="mb-6">
            <div className="flex flex-col items-center gap-3 pt-4">
              {photoUrl ? (
                <div className="flex flex-col items-center gap-2">
                  <img 
                    src={photoUrl} 
                    alt="Profile" 
                    className="w-20 h-20 rounded-full border-4 border-[#4cd3ff] shadow-[0_0_20px_rgba(76,211,255,0.5)]"
                  />
                  {getRankBadge()}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#4cd3ff] to-[#b8b8b8] flex items-center justify-center border-4 border-[#4cd3ff] shadow-[0_0_20px_rgba(76,211,255,0.5)]">
                    <span className="text-black font-bold text-3xl">
                      {firstName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  {getRankBadge()}
                </div>
              )}
              
              <div className="flex flex-col items-center gap-1">
                <h3 className="text-lg font-bold text-white">{firstName}</h3>
                {username && <p className="text-sm text-gray-400">@{username}</p>}
                <p className="text-xs text-[#4cd3ff] font-mono">UID: {uid}</p>
              </div>
            </div>
          </SheetHeader>
          
          <div className="flex flex-col gap-1.5">
            <Button
              variant="ghost"
              className="w-full justify-start h-11 text-white hover:bg-[#4cd3ff]/10 hover:text-[#4cd3ff]"
              onClick={handleWalletClick}
            >
              <Wallet className="w-5 h-5 mr-3 text-[#4cd3ff]" />
              <span className="text-sm">Wallet Set-up</span>
            </Button>

            <Button
              variant="ghost"
              className="w-full justify-start h-11 text-white hover:bg-[#4cd3ff]/10 hover:text-[#4cd3ff]"
              onClick={handleWithdrawClick}
            >
              <ArrowDown className="w-5 h-5 mr-3 text-[#4cd3ff]" />
              <span className="text-sm">Withdraw</span>
            </Button>

            <Link href="/affiliates">
              <Button
                variant="ghost"
                className="w-full justify-start h-11 text-white hover:bg-[#4cd3ff]/10 hover:text-[#4cd3ff]"
                onClick={() => setMenuOpen(false)}
              >
                <TrendingUp className="w-5 h-5 mr-3 text-[#4cd3ff]" />
                <span className="text-sm">Affiliate Center</span>
              </Button>
            </Link>

            <Link href="/leaderboard">
              <Button
                variant="ghost"
                className="w-full justify-start h-11 text-white hover:bg-[#4cd3ff]/10 hover:text-[#4cd3ff]"
                onClick={() => setMenuOpen(false)}
              >
                <Trophy className="w-5 h-5 mr-3 text-[#4cd3ff]" />
                <span className="text-sm">Leaderboard</span>
              </Button>
            </Link>

            <Link href="/create-task">
              <Button
                variant="ghost"
                className="w-full justify-start h-11 text-white hover:bg-[#4cd3ff]/10 hover:text-[#4cd3ff]"
                onClick={() => setMenuOpen(false)}
              >
                <PlusCircle className="w-5 h-5 mr-3 text-[#4cd3ff]" />
                <span className="text-sm">Create Task</span>
              </Button>
            </Link>

            <Separator className="my-2 bg-white/10" />
            
            <div className="px-3 py-1">
              <p className="text-xs font-semibold text-[#4cd3ff] mb-2">Community & Info</p>
            </div>

            <Button
              variant="ghost"
              className="w-full justify-start h-11 text-white hover:bg-[#4cd3ff]/10 hover:text-[#4cd3ff]"
              onClick={() => handleExternalLink('https://t.me/+EcYwkUBmI5JiMzE1')}
            >
              <MessageCircle className="w-5 h-5 mr-3 text-[#4cd3ff]" />
              <span className="text-sm">Community Chat</span>
            </Button>

            <Button
              variant="ghost"
              className="w-full justify-start h-11 text-white hover:bg-[#4cd3ff]/10 hover:text-[#4cd3ff]"
              onClick={() => handleExternalLink('https://t.me/PaidAdsNews')}
            >
              <Bell className="w-5 h-5 mr-3 text-[#4cd3ff]" />
              <span className="text-sm">Announcements/Updates</span>
            </Button>

            {isAdmin && (
              <>
                <Separator className="my-2 bg-white/10" />
                <Link href="/admin">
                  <Button
                    variant="ghost"
                    className="w-full justify-start h-11 text-white hover:bg-[#4cd3ff]/10 hover:text-[#4cd3ff]"
                    onClick={() => setMenuOpen(false)}
                  >
                    <Settings className="w-5 h-5 mr-3 text-[#4cd3ff]" />
                    <span className="text-sm">Settings</span>
                  </Button>
                </Link>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <CwalletSetupDialog 
        open={walletDialogOpen}
        onOpenChange={setWalletDialogOpen}
      />

      <WithdrawDialog 
        open={withdrawDialogOpen}
        onOpenChange={setWithdrawDialogOpen}
      />
    </>
  );
}
