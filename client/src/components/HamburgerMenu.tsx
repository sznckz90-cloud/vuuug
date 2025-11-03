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
  Award
} from "lucide-react";
import { useAdmin } from "@/hooks/useAdmin";
import CwalletSetupDialog from "@/components/CwalletSetupDialog";

export default function HamburgerMenu() {
  const { isAdmin } = useAdmin();
  const [menuOpen, setMenuOpen] = useState(false);
  const [walletDialogOpen, setWalletDialogOpen] = useState(false);

  const { data: user } = useQuery<any>({
    queryKey: ['/api/auth/user'],
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

  const handleExternalLink = (url: string) => {
    window.open(url, '_blank');
  };

  const getRankBadge = () => {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-gradient-to-r from-yellow-500/20 to-amber-500/20 border border-yellow-500/30">
        <Award className="w-3.5 h-3.5 text-yellow-500" />
        <span className="text-[10px] font-bold text-yellow-500">Top 1%</span>
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
            className="w-[50px] h-[50px] text-[#4cd3ff] hover:text-[#6ddeff] hover:bg-[#4cd3ff]/10 p-0"
          >
            <Menu className="w-[45px] h-[45px]" strokeWidth={4} />
          </Button>
        </SheetTrigger>
        <SheetContent 
          side="right" 
          className="w-[280px] bg-black/40 backdrop-blur-xl border-l border-white/10 [&>button]:hidden overflow-y-auto"
        >
          <SheetHeader className="mb-6">
            <div className="flex flex-col items-center gap-3 pt-4">
              {photoUrl ? (
                <div className="relative">
                  <img 
                    src={photoUrl} 
                    alt="Profile" 
                    className="w-20 h-20 rounded-full border-4 border-[#4cd3ff] shadow-[0_0_20px_rgba(76,211,255,0.5)]"
                  />
                  <div className="absolute -bottom-1 -right-1">
                    {getRankBadge()}
                  </div>
                </div>
              ) : (
                <div className="relative">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#4cd3ff] to-[#b8b8b8] flex items-center justify-center border-4 border-[#4cd3ff] shadow-[0_0_20px_rgba(76,211,255,0.5)]">
                    <span className="text-black font-bold text-3xl">
                      {firstName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="absolute -bottom-1 -right-1">
                    {getRankBadge()}
                  </div>
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
              <Wallet className="w-5 h-5 mr-3" />
              <span className="text-sm">Wallet Set-up</span>
            </Button>

            <Link href="/wallet-activity">
              <Button
                variant="ghost"
                className="w-full justify-start h-11 text-white hover:bg-[#4cd3ff]/10 hover:text-[#4cd3ff]"
                onClick={() => setMenuOpen(false)}
              >
                <Receipt className="w-5 h-5 mr-3" />
                <span className="text-sm">View Wallet Activity</span>
              </Button>
            </Link>

            <Link href="/affiliates">
              <Button
                variant="ghost"
                className="w-full justify-start h-11 text-white hover:bg-[#4cd3ff]/10 hover:text-[#4cd3ff]"
                onClick={() => setMenuOpen(false)}
              >
                <TrendingUp className="w-5 h-5 mr-3" />
                <span className="text-sm">Affiliate Center</span>
              </Button>
            </Link>

            <Link href="/leaderboard">
              <Button
                variant="ghost"
                className="w-full justify-start h-11 text-white hover:bg-[#4cd3ff]/10 hover:text-[#4cd3ff]"
                onClick={() => setMenuOpen(false)}
              >
                <Trophy className="w-5 h-5 mr-3" />
                <span className="text-sm">Leaderboard</span>
              </Button>
            </Link>

            <Link href="/tasks">
              <Button
                variant="ghost"
                className="w-full justify-start h-11 text-white hover:bg-[#4cd3ff]/10 hover:text-[#4cd3ff]"
                onClick={() => setMenuOpen(false)}
              >
                <ClipboardList className="w-5 h-5 mr-3" />
                <span className="text-sm">Active Tasks</span>
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
              <MessageCircle className="w-5 h-5 mr-3" />
              <span className="text-sm">Community Chat</span>
            </Button>

            <Button
              variant="ghost"
              className="w-full justify-start h-11 text-white hover:bg-[#4cd3ff]/10 hover:text-[#4cd3ff]"
              onClick={() => handleExternalLink('https://t.me/PaidAdsNews')}
            >
              <Bell className="w-5 h-5 mr-3" />
              <span className="text-sm">Announcements/Updates</span>
            </Button>

            <Button
              variant="ghost"
              className="w-full justify-start h-11 text-white hover:bg-[#4cd3ff]/10 hover:text-[#4cd3ff]"
              onClick={() => handleExternalLink('https://t.me/szxzyz')}
            >
              <Code2 className="w-5 h-5 mr-3" />
              <span className="text-sm">Developer</span>
            </Button>

            <Button
              variant="ghost"
              className="w-full justify-start h-11 text-white hover:bg-[#4cd3ff]/10 hover:text-[#4cd3ff]"
              onClick={() => handleExternalLink('https://t.me/+EcYwkUBmI5JiMzE1')}
            >
              <HelpCircle className="w-5 h-5 mr-3" />
              <span className="text-sm">Help & Support</span>
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
                    <Settings className="w-5 h-5 mr-3" />
                    <span className="text-sm">Settings</span>
                  </Button>
                </Link>
              </>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-white/10">
            <p className="text-center text-xs text-gray-400 font-medium">
              Earn • Grow • Dominate — PAD Season 2🔥
            </p>
          </div>
        </SheetContent>
      </Sheet>

      <CwalletSetupDialog 
        open={walletDialogOpen}
        onOpenChange={setWalletDialogOpen}
      />
    </>
  );
}
