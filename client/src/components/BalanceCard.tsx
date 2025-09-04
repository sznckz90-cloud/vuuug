import { Button } from "@/components/ui/button";

interface BalanceCardProps {
  user: any;
  stats: any;
}

export default function BalanceCard({ user, stats }: BalanceCardProps) {
  return (
    <div className="bg-gradient-to-r from-primary to-secondary p-4 rounded-xl mt-4 text-center shadow-lg">
      <div className="text-primary-foreground/80 text-xs font-medium mb-1">Your Balance</div>
      <div className="text-3xl font-bold mb-1 text-white" data-testid="text-user-balance">
        ${user ? (parseFloat(user.balance || "0")).toFixed(5) : "0.00000"}
      </div>
      <div className="text-primary-foreground/60 text-xs" data-testid="text-total-earned">
        Total Earned: {user ? (() => {
          const earned = parseFloat(user.totalEarned || "0");
          return earned < 0 ? `-$${Math.abs(earned).toFixed(5)}` : `$${earned.toFixed(5)}`;
        })() : "$0.00000"}
      </div>
      <Button
        onClick={() => window.location.href = '/profile'}
        className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg mt-3 font-medium transition-colors text-sm"
        data-testid="button-withdraw"
      >
        Withdraw
      </Button>
    </div>
  );
}
