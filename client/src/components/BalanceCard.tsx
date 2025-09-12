
interface BalanceCardProps {
  user: any;
  stats: any;
}

export default function BalanceCard({ user, stats }: BalanceCardProps) {
  return (
    <div className="bg-gradient-to-r from-primary to-secondary p-4 rounded-xl mt-4 text-center shadow-lg">
      <div className="text-primary-foreground/80 text-xs font-medium mb-1">Available PADZ Token</div>
      <div className="text-3xl font-bold text-white" data-testid="text-user-balance">
        {user ? (parseFloat(user.balance || "0")).toFixed(0) : "0"} PADZ
      </div>
    </div>
  );
}
