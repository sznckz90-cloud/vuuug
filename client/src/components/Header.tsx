import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Wallet, Settings } from "lucide-react";
import CwalletSetupDialog from "@/components/CwalletSetupDialog";
import { useAdmin } from "@/hooks/useAdmin";

export default function Header() {
  const [cwalletDialogOpen, setCwalletDialogOpen] = useState(false);
  
  const { data: user } = useQuery<any>({
    queryKey: ['/api/auth/user'],
    retry: false,
  });

  const { isAdmin } = useAdmin();

  const photoUrl = typeof window !== 'undefined' && window.Telegram?.WebApp?.initDataUnsafe?.user?.photo_url;
  const uid = user?.referralCode || '';
  const cwalletId = user?.cwalletId;

  return (
    <>
      <div className="fixed top-0 left-0 right-0 z-40 bg-gradient-to-b from-background to-background/95 backdrop-blur-sm border-b border-white/5">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
          {/* Left: Profile Photo & UID */}
          <div className="flex items-center gap-2">
            {photoUrl ? (
              <img 
                src={photoUrl} 
                alt="Profile" 
                className="w-[45px] h-[45px] rounded-full border-2 border-[#4cd3ff]/30"
              />
            ) : (
              <div className="w-[45px] h-[45px] rounded-full bg-gradient-to-br from-[#4cd3ff] to-[#b8b8b8] flex items-center justify-center">
                <span className="text-black font-bold text-base">
                  {user?.username?.charAt(0).toUpperCase() || 'U'}
                </span>
              </div>
            )}
            <span className="text-xs text-[#c0c0c0] font-medium">{uid}</span>
          </div>

          {/* Right: Wallet Button + Admin Button */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={() => setCwalletDialogOpen(true)}
              className="h-9 px-3 text-[#4cd3ff] hover:text-[#6ddeff] hover:bg-[#4cd3ff]/10"
            >
              <Wallet className="w-4 h-4 mr-2" />
              {cwalletId ? cwalletId : 'Set Wallet'}
            </Button>
            
            {isAdmin && (
              <Link href="/admin">
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-9 h-9 text-[#4cd3ff] hover:text-[#6ddeff] hover:bg-[#4cd3ff]/10"
                >
                  <Settings className="w-5 h-5" />
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>

      <CwalletSetupDialog 
        open={cwalletDialogOpen}
        onOpenChange={setCwalletDialogOpen}
      />
    </>
  );
}
