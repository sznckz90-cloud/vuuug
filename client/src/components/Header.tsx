import { useQuery } from "@tanstack/react-query";
import HamburgerMenu from "./HamburgerMenu";
import { DollarSign } from "lucide-react";

export default function Header() {
  const { data: user } = useQuery<any>({
    queryKey: ['/api/auth/user'],
    retry: false,
  });

  const usdBalance = parseFloat(user?.usdBalance || "0");

  return (
    <div className="fixed top-0 left-0 right-0 z-40 bg-gradient-to-b from-background to-background/95 backdrop-blur-sm border-b border-white/5">
      <div className="max-w-md mx-auto px-4 py-2 flex items-center justify-between">
        {/* Left: Hamburger Menu */}
        <HamburgerMenu />
        
        {/* Right: USD Balance */}
        <div className="flex items-center gap-1.5 bg-gray-700/50 px-2 py-1.5 rounded-lg">
          <DollarSign className="w-4 h-4 text-green-400" />
          <div className="text-sm text-white font-bold">
            ${usdBalance.toFixed(2)} USD
          </div>
        </div>
      </div>
    </div>
  );
}
