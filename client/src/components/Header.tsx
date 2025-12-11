import { useQuery } from "@tanstack/react-query";
import { Bug } from "lucide-react";

export default function Header() {
  const { data: user } = useQuery<any>({
    queryKey: ['/api/auth/user'],
    retry: false,
  });

  const usdBalance = parseFloat(user?.usdBalance || "0");
  const bugBalance = parseFloat(user?.bugBalance || "0");

  return (
    <div className="fixed top-0 left-0 right-0 z-40 bg-black border-b border-[#1A1A1A] pt-[env(safe-area-inset-top,8px)]">
      <div className="max-w-md mx-auto px-4 py-2.5 pt-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-[#1A1A1A] px-4 h-10 rounded-xl min-w-[85px]">
            <Bug className="w-5 h-5 text-lime-400" />
            <span className="text-base text-lime-400 font-semibold">
              {Math.floor(bugBalance).toLocaleString()}
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-[#1A1A1A] px-4 h-10 rounded-xl min-w-[85px]">
            <span className="text-green-400 font-semibold text-base">$</span>
            <div className="text-base text-white font-semibold">
              {usdBalance.toFixed(3)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
