
interface BalanceCardProps {
  user: any;
  stats: any;
}

export default function BalanceCard({ user, stats }: BalanceCardProps) {
  return (
    <div className="bg-gradient-to-r from-primary to-secondary p-3 rounded-xl mt-3 text-center shadow-lg">
      <div className="text-primary-foreground/80 text-xs font-medium mb-1">Available Balance</div>
      <div className="text-2xl font-bold text-white" data-testid="text-user-balance">
        ${user ? (parseFloat(user.balance || "0")).toFixed(5) : "0.00000"}
      </div>
    </div>
  );
}
