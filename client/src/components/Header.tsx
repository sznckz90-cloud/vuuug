import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Wallet } from "lucide-react";
import CwalletSetupDialog from "@/components/CwalletSetupDialog";

export default function Header() {
  const [cwalletDialogOpen, setCwalletDialogOpen] = useState(false);
  
  const { data: user } = useQuery<any>({
    queryKey: ['/api/auth/user'],
    retry: false,
  });

  const photoUrl = typeof window !== 'undefined' && window.Telegram?.WebApp?.initDataUnsafe?.user?.photo_url;
  const uid = user?.referralCode || '';

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
                className="w-[35px] h-[35px] rounded-full border-2 border-[#4cd3ff]/30"
              />
            ) : (
              <div className="w-[35px] h-[35px] rounded-full bg-gradient-to-br from-[#4cd3ff] to-[#b8b8b8] flex items-center justify-center">
                <span className="text-black font-bold text-sm">
                  {user?.username?.charAt(0).toUpperCase() || 'U'}
                </span>
              </div>
            )}
            <span className="text-xs text-[#c0c0c0] font-medium">{uid}</span>
          </div>

          {/* Center: App Title */}
          <h1 className="text-lg font-bold bg-gradient-to-r from-[#4cd3ff] to-[#b8b8b8] bg-clip-text text-transparent">
            PaidAds
          </h1>

          {/* Right: Cwallet Button */}
          <Button
            variant="ghost"
            size="icon"
            className="w-[35px] h-[35px]"
            onClick={() => setCwalletDialogOpen(true)}
          >
            <Wallet className="w-5 h-5 text-[#4cd3ff]" />
          </Button>
        </div>
      </div>

      <CwalletSetupDialog 
        open={cwalletDialogOpen}
        onOpenChange={setCwalletDialogOpen}
      />
    </>
  );
}
