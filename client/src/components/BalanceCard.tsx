import { Button } from "@/components/ui/button";

interface BalanceCardProps {
  user: any;
  stats: any;
}

export default function BalanceCard({ user, stats }: BalanceCardProps) {
  return (
    <div className="bg-gradient-to-r from-primary to-secondary p-4 rounded-xl mt-4 text-center shadow-lg">
      <div className="text-primary-foreground/80 text-xs font-medium mb-1">Available Balance</div>
      <div className="text-3xl font-bold mb-4 text-white" data-testid="text-user-balance">
        ${user ? (parseFloat(user.balance || "0")).toFixed(5) : "0.00000"}
      </div>
      <Button
        onClick={() => window.location.href = '/profile'}
        className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm"
        data-testid="button-withdraw"
      >
        Withdraw
      </Button>
    </div>
  );
}
