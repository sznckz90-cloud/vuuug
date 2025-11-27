import { useQuery } from "@tanstack/react-query";
import { Plus, Menu } from "lucide-react";
import { useLocation } from "wouter";
import HamburgerMenu from "./HamburgerMenu";

export default function Header() {
  const [, navigate] = useLocation();
  const { data: user } = useQuery<any>({
    queryKey: ['/api/auth/user'],
    retry: false,
  });

  const pdzBalance = parseFloat(user?.pdzBalance || "0");

  const handleTopUp = () => {
    navigate("/topup-pdz");
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-40 bg-gradient-to-b from-background to-background/95 backdrop-blur-sm border-b border-white/5">
      <div className="max-w-md mx-auto px-4 py-2 flex items-center justify-between">
        {/* Left: Hamburger Menu */}
        <HamburgerMenu />
        
        {/* Right: PDZ Balance with Top Up */}
        <div className="flex items-center gap-2 bg-gray-700/50 px-3 py-2 rounded-lg">
          <button
            onClick={handleTopUp}
            className="flex items-center gap-1 text-[#4cd3ff] hover:text-[#6ddeff] transition-colors text-xs font-medium"
          >
            <Plus className="w-3.5 h-3.5" />
            Top up
          </button>
          <div className="text-xs text-white font-semibold">
            PDZ {pdzBalance.toFixed(3)}
          </div>
        </div>
      </div>
    </div>
  );
}
