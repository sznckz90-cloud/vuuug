import { useQuery } from "@tanstack/react-query";
import Layout from "@/components/Layout";
import { 
  Users, 
  Activity, 
  Coins, 
  Bug, 
  Wallet, 
  CheckCircle, 
  PlusCircle, 
  TrendingUp,
  Loader2,
  ChevronRight,
  Database,
  DollarSign,
  PieChart,
  BarChart3,
  Globe,
  Zap
} from "lucide-react";
import CryptoConversionWidget from "@/components/CryptoConversionWidget";

interface AppStats {
  totalUsers: number;
  activeUsersToday: number;
  newUsersLast24h: number;
  totalEarnings: string;
  totalBugEarned: string;
  totalWithdrawn: string;
  totalReferralEarnings: string;
  tasksCompleted: number;
  tasksCreated: number;
  withdrawalRequests: {
    pending: number;
    approved: number;
    rejected: number;
  };
}

export default function Statistics() {
  const { data: stats, isLoading } = useQuery<AppStats>({
    queryKey: ['/api/app-stats'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (isLoading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center bg-black">
          <Loader2 className="w-8 h-8 animate-spin text-[#4cd3ff]" />
        </div>
      </Layout>
    );
  }

  const StatItem = ({ title, value, icon: Icon, colorClass, description }: any) => (
    <div className="bg-[#111] rounded-2xl p-4 border border-white/5 flex items-center gap-4 active:scale-[0.98] transition-transform">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-lg ${colorClass}`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-1">{title}</p>
        <div className="text-xl font-black text-white leading-none truncate">{value}</div>
        {description && <p className="text-gray-600 text-[10px] mt-1 truncate">{description}</p>}
      </div>
      <ChevronRight className="w-4 h-4 text-gray-800" />
    </div>
  );

  return (
    <Layout>
      <main className="max-w-md mx-auto px-4 pt-4 pb-12 bg-black min-h-screen">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-[0_0_20px_rgba(99,102,241,0.3)]">
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white leading-none tracking-tight">Analytics</h1>
              <p className="text-indigo-500 text-[10px] uppercase font-bold tracking-[0.2em] mt-1.5">Live Ecosystem Pulse</p>
            </div>
          </div>
          <div className="px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></div>
            <span className="text-indigo-500 text-[10px] font-black uppercase tracking-wider">Live</span>
          </div>
        </div>

        <div className="space-y-3">
          {/* Platform Reach */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-gray-500 text-[10px] font-black uppercase tracking-[0.2em]">Global Reach</h3>
              <Globe className="w-3 h-3 text-gray-700" />
            </div>
            <StatItem 
              title="Total Community" 
              value={stats?.totalUsers?.toLocaleString()} 
              icon={Users} 
              colorClass="bg-gradient-to-br from-blue-500 to-blue-700 shadow-blue-500/20"
              description="Registered active members"
            />
            <div className="grid grid-cols-2 gap-2">
              <StatItem 
                title="Active Now" 
                value={stats?.activeUsersToday?.toLocaleString()} 
                icon={Activity} 
                colorClass="bg-gradient-to-br from-emerald-500 to-emerald-700 shadow-emerald-500/20"
              />
              <StatItem 
                title="New Arrivals" 
                value={stats?.newUsersLast24h?.toLocaleString()} 
                icon={PlusCircle} 
                colorClass="bg-gradient-to-br from-violet-500 to-violet-700 shadow-violet-500/20"
              />
            </div>
          </div>

          {/* Value Flow */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-gray-500 text-[10px] font-black uppercase tracking-[0.2em]">Economic Flow</h3>
              <Zap className="w-3 h-3 text-gray-700" />
            </div>
            <StatItem 
              title="Total PAD Minted" 
              value={parseInt(stats?.totalEarnings || "0").toLocaleString()} 
              icon={Coins} 
              colorClass="bg-gradient-to-br from-cyan-500 to-blue-600 shadow-cyan-500/20"
              description="Value generated by community"
            />
            <div className="grid grid-cols-2 gap-2">
              <StatItem 
                title="BUG Utility" 
                value={parseInt(stats?.totalBugEarned || "0").toLocaleString()} 
                icon={Bug} 
                colorClass="bg-gradient-to-br from-teal-500 to-emerald-600 shadow-teal-500/20"
              />
              <StatItem 
                title="USD Payouts" 
                value={`$${parseFloat(stats?.totalWithdrawn || "0").toFixed(2)}`} 
                icon={DollarSign} 
                colorClass="bg-gradient-to-br from-orange-500 to-red-600 shadow-orange-500/20"
              />
            </div>
          </div>

          {/* Operational Health */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-gray-500 text-[10px] font-black uppercase tracking-[0.2em]">Operations</h3>
              <PieChart className="w-3 h-3 text-gray-700" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <StatItem 
                title="Missions Done" 
                value={stats?.tasksCompleted?.toLocaleString()} 
                icon={CheckCircle} 
                colorClass="bg-gradient-to-br from-indigo-500 to-blue-700 shadow-indigo-500/20"
              />
              <StatItem 
                title="Open Tasks" 
                value={stats?.tasksCreated?.toLocaleString()} 
                icon={Database} 
                colorClass="bg-gradient-to-br from-rose-500 to-pink-700 shadow-rose-500/20"
              />
            </div>
          </div>

          {/* Liquidity Status */}
          <div className="bg-[#111] rounded-[2rem] p-6 border border-white/5 mt-4 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Wallet className="w-20 h-20 text-white" />
            </div>
            <h3 className="text-gray-500 text-[10px] font-black uppercase tracking-[0.3em] mb-5 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div>
              Withdrawal Pipeline
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-3 text-center">
                <div className="text-amber-500 text-[9px] font-black uppercase tracking-wider mb-1">Queue</div>
                <div className="text-xl font-black text-white">{stats?.withdrawalRequests.pending}</div>
              </div>
              <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-3 text-center">
                <div className="text-emerald-500 text-[9px] font-black uppercase tracking-wider mb-1">Cleared</div>
                <div className="text-xl font-black text-white">{stats?.withdrawalRequests.approved}</div>
              </div>
              <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-3 text-center">
                <div className="text-rose-500 text-[9px] font-black uppercase tracking-wider mb-1">Failed</div>
                <div className="text-xl font-black text-white">{stats?.withdrawalRequests.rejected}</div>
              </div>
            </div>
          </div>

          {/* Real-time Markets */}
          <div className="pt-4">
            <div className="bg-[#111] rounded-[2rem] p-1 border border-white/5 overflow-hidden">
               <CryptoConversionWidget />
            </div>
          </div>
        </div>
      </main>
    </Layout>
  );
}

