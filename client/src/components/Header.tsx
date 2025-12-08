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
    <div className="fixed top-0 left-0 right-0 z-40 bg-black border-b border-[#1A1A1A]">
      <div className="max-w-md mx-auto px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-[#1A1A1A] px-4 h-10 rounded-xl min-w-[85px]">
            <DiamondIcon size={16} withGlow />
            <div className="text-sm text-white font-semibold">
              {padBalance.toLocaleString()}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-[#1A1A1A] px-4 h-10 rounded-xl min-w-[85px]">
            <div className="w-5 h-5 rounded-full overflow-hidden flex items-center justify-center">
              <img src="/images/ton.png" alt="TON" className="w-full h-full object-cover" />
            </div>
            <div className="text-sm text-white font-semibold">
              {tonBalance.toFixed(4)}
            </div>
          </div>
          
          <div className="flex items-center gap-2 bg-[#1A1A1A] px-4 h-10 rounded-xl min-w-[85px]">
            <span className="text-green-400 font-semibold text-base">$</span>
            <div className="text-sm text-white font-semibold">
              {usdBalance.toFixed(3)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
