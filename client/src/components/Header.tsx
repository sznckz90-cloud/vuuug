import { useQuery } from "@tanstack/react-query";
import { DiamondIcon } from "@/components/DiamondIcon";

export default function Header() {
  const { data: user } = useQuery<any>({
    queryKey: ['/api/auth/user'],
    retry: false,
  });

  const usdBalance = parseFloat(user?.usdBalance || "0");
  const rawBalance = parseFloat(user?.balance || "0");
  const padBalance = rawBalance < 1 ? Math.round(rawBalance * 10000000) : Math.round(rawBalance);
  const tonBalance = parseFloat(user?.tonBalance || "0");

  return (
    <div className="fixed top-0 left-0 right-0 z-40 bg-gradient-to-b from-background to-background/95 backdrop-blur-sm border-b border-white/5">
      <div className="max-w-md mx-auto px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-gray-700/50 px-3 h-8 rounded-lg min-w-[80px]">
            <DiamondIcon size={14} withGlow />
            <div className="text-sm text-white font-bold">
              {padBalance.toLocaleString()}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-gray-700/50 px-3 h-8 rounded-lg min-w-[80px]">
            <img src="/images/ton.png" alt="TON" className="w-4 h-4 object-cover rounded-full" />
            <div className="text-sm text-white font-bold">
              {tonBalance.toFixed(4)}
            </div>
          </div>
          
          <div className="flex items-center gap-1.5 bg-gray-700/50 px-3 h-8 rounded-lg min-w-[80px]">
            <span className="text-green-400 font-bold text-base">$</span>
            <div className="text-sm text-white font-bold">
              {usdBalance.toFixed(3)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
