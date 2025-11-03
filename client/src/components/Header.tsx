import HamburgerMenu from "@/components/HamburgerMenu";
import { useQuery } from "@tanstack/react-query";

export default function Header() {
  const { data: user } = useQuery<any>({
    queryKey: ['/api/auth/user'],
    retry: false,
  });

  const pdzBalance = parseFloat(user?.pdzBalance || "0");

  return (
    <div className="fixed top-0 left-0 right-0 z-40 bg-gradient-to-b from-background to-background/95 backdrop-blur-sm border-b border-white/5">
      <div className="max-w-md mx-auto pl-1 pr-4 py-3 flex items-center justify-between">
        {/* Left: Hamburger Menu */}
        <HamburgerMenu />
        
        {/* Right: PDZ Balance */}
        <div className="text-xs text-primary font-semibold">
          {pdzBalance.toFixed(2)} PDZ
        </div>
      </div>
    </div>
  );
}
