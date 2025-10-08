
import { formatCurrency } from "@/lib/utils";

interface BalanceCardProps {
  user: any;
}

export default function BalanceCard({ user }: BalanceCardProps) {
  return (
    <div className="gradient-button p-4 rounded-[18px] mt-3 text-center shadow-xl tap-glow">
      <div className="text-white/80 text-xs font-medium mb-1 tracking-wide">Available Balance</div>
      <div className="text-3xl font-bold text-white title-text" data-testid="text-user-balance">
        {formatCurrency(user?.balance || "0")}
      </div>
    </div>
  );
}
