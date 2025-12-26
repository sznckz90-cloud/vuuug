import { useQuery } from "@tanstack/react-query";
import Layout from "@/components/Layout";
import { DiamondIcon } from "@/components/DiamondIcon";
import { 
  Users, 
  Activity, 
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
    <div className="bg-[#111] rounded-2xl p-4 border border-white/5 active:scale-[0.98] transition-transform">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${colorClass}`} />
        <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest">{title}</p>
      </div>
      <div className="text-xl font-black text-white leading-none">{value}</div>
      {description && <p className="text-gray-600 text-[10px] mt-2">{description}</p>}
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
              colorClass="text-blue-500"
              description="Registered active members"
            />
            <div className="space-y-2">
              <StatItem 
                title="Active Now" 
                value={stats?.activeUsersToday?.toLocaleString()} 
                icon={Activity} 
                colorClass="text-emerald-500"
              />
              <StatItem 
                title="New Arrivals" 
                value={stats?.newUsersLast24h?.toLocaleString()} 
                icon={PlusCircle} 
                colorClass="text-violet-500"
              />
            </div>
          </div>

          {/* Value Flow */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-gray-500 text-[10px] font-black uppercase tracking-[0.2em]">Economic Flow</h3>
              <Zap className="w-3 h-3 text-gray-700" />
            </div>
            <div className="bg-[#111] rounded-2xl p-4 border border-white/5 active:scale-[0.98] transition-transform">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-4 h-4">
                  <DiamondIcon size={16} />
                </div>
                <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest">Total PAD Minted</p>
              </div>
              <div className="text-xl font-black text-white leading-none">{parseInt(stats?.totalEarnings || "0").toLocaleString()}</div>
              <p className="text-gray-600 text-[10px] mt-2">Value generated by community</p>
            </div>
            <div className="space-y-2">
              <StatItem 
                title="BUG Utility" 
                value={parseInt(stats?.totalBugEarned || "0").toLocaleString()} 
                icon={Bug} 
                colorClass="text-teal-500"
              />
              <StatItem 
                title="USD Payouts" 
                value={`$${parseFloat(stats?.totalWithdrawn || "0").toFixed(2)}`} 
                icon={DollarSign} 
                colorClass="text-orange-500"
              />
            </div>
          </div>

          {/* Operational Health */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-gray-500 text-[10px] font-black uppercase tracking-[0.2em]">Operations</h3>
              <PieChart className="w-3 h-3 text-gray-700" />
            </div>
            <div className="space-y-2">
              <StatItem 
                title="Missions Done" 
                value={stats?.tasksCompleted?.toLocaleString()} 
                icon={CheckCircle} 
                colorClass="text-indigo-500"
              />
              <StatItem 
                title="Open Tasks" 
                value={stats?.tasksCreated?.toLocaleString()} 
                icon={Database} 
                colorClass="text-rose-500"
              />
            </div>
          </div>

          {/* Liquidity Status */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-gray-500 text-[10px] font-black uppercase tracking-[0.2em]">Withdrawal Pipeline</h3>
              <Wallet className="w-3 h-3 text-gray-700" />
            </div>
            <StatItem 
              title="Total Withdrawals" 
              value={((stats?.withdrawalRequests.pending || 0) + (stats?.withdrawalRequests.approved || 0) + (stats?.withdrawalRequests.rejected || 0)).toLocaleString()} 
              icon={Wallet} 
              colorClass="text-amber-500"
            />
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-[#111] rounded-2xl p-3 text-center border border-white/5">
                <div className="text-amber-500 text-[9px] font-black uppercase tracking-wider mb-2">Queue</div>
                <div className="text-xl font-black text-white">{stats?.withdrawalRequests.pending || 0}</div>
              </div>
              <div className="bg-[#111] rounded-2xl p-3 text-center border border-white/5">
                <div className="text-emerald-500 text-[9px] font-black uppercase tracking-wider mb-2">Cleared</div>
                <div className="text-xl font-black text-white">{stats?.withdrawalRequests.approved || 0}</div>
              </div>
              <div className="bg-[#111] rounded-2xl p-3 text-center border border-white/5">
                <div className="text-rose-500 text-[9px] font-black uppercase tracking-wider mb-2">Failed</div>
                <div className="text-xl font-black text-white">{stats?.withdrawalRequests.rejected || 0}</div>
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

