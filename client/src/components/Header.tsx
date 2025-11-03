import { useQuery } from "@tanstack/react-query";
import HamburgerMenu from "@/components/HamburgerMenu";

export default function Header() {
  const { data: user } = useQuery<any>({
    queryKey: ['/api/auth/user'],
    retry: false,
  });

  const photoUrl = typeof window !== 'undefined' && (window as any).Telegram?.WebApp?.initDataUnsafe?.user?.photo_url;
  const firstName = user?.firstName || user?.username || 'User';
  const uid = user?.referralCode || '';

  return (
    <div className="fixed top-0 left-0 right-0 z-40 bg-gradient-to-b from-background to-background/95 backdrop-blur-sm border-b border-white/5">
      <div className="max-w-md mx-auto pl-4 pr-1 py-3 flex items-center justify-between">
        {/* Left: Profile Photo + First Name + UID (Vertical) */}
        <div className="flex items-center gap-3">
          {photoUrl ? (
            <img 
              src={photoUrl} 
              alt="Profile" 
              className="w-[45px] h-[45px] rounded-full border-2 border-[#4cd3ff]/30"
            />
          ) : (
            <div className="w-[45px] h-[45px] rounded-full bg-gradient-to-br from-[#4cd3ff] to-[#b8b8b8] flex items-center justify-center">
              <span className="text-black font-bold text-base">
                {firstName.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <div className="flex flex-col gap-0.5">
            <span className="text-sm text-white font-bold leading-tight">{firstName}</span>
            <span className="text-[11px] text-[#c0c0c0] font-medium leading-tight">UID: {uid}</span>
          </div>
        </div>

        {/* Right: Hamburger Menu */}
        <HamburgerMenu />
      </div>
    </div>
  );
}
