import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { 
  Zap,
  TrendingUp,
  Clock,
  Sparkles,
  Crown,
  Percent,
  Star,
  Rocket
} from "lucide-react";

interface Booster {
  id: string;
  title: string;
  bonus: string;
  duration: string;
  price: string;
  icon: React.ReactNode;
  gradient: string;
  bgGradient: string;
  popular?: boolean;
}

const boosters: Booster[] = [
  {
    id: "boost-10-week",
    title: "Starter Boost",
    bonus: "+10%",
    duration: "1 week",
    price: "500 PAD",
    icon: <TrendingUp className="w-6 h-6" />,
    gradient: "from-emerald-400 to-emerald-600",
    bgGradient: "from-emerald-500/10 via-emerald-500/5 to-transparent"
  },
  {
    id: "boost-20-day",
    title: "Quick Boost",
    bonus: "+20%",
    duration: "1 day",
    price: "200 PAD",
    icon: <Zap className="w-6 h-6" />,
    gradient: "from-blue-400 to-blue-600",
    bgGradient: "from-blue-500/10 via-blue-500/5 to-transparent"
  },
  {
    id: "boost-20-week",
    title: "Power Boost",
    bonus: "+20%",
    duration: "1 week",
    price: "1000 PAD",
    icon: <Rocket className="w-6 h-6" />,
    gradient: "from-indigo-400 to-indigo-600",
    bgGradient: "from-indigo-500/10 via-indigo-500/5 to-transparent",
    popular: true
  },
  {
    id: "boost-25-day",
    title: "Pro Boost",
    bonus: "+25%",
    duration: "1 day",
    price: "300 PAD",
    icon: <Star className="w-6 h-6" />,
    gradient: "from-purple-400 to-purple-600",
    bgGradient: "from-purple-500/10 via-purple-500/5 to-transparent"
  },
  {
    id: "boost-25-week",
    title: "Elite Boost",
    bonus: "+25%",
    duration: "1 week",
    price: "1500 PAD",
    icon: <Sparkles className="w-6 h-6" />,
    gradient: "from-pink-400 to-pink-600",
    bgGradient: "from-pink-500/10 via-pink-500/5 to-transparent"
  },
  {
    id: "boost-50-day",
    title: "Ultra Boost",
    bonus: "+50%",
    duration: "1 day",
    price: "500 PAD",
    icon: <Crown className="w-6 h-6" />,
    gradient: "from-amber-400 to-orange-500",
    bgGradient: "from-amber-500/10 via-amber-500/5 to-transparent"
  },
  {
    id: "boost-50-week",
    title: "Supreme Boost",
    bonus: "+50%",
    duration: "1 week",
    price: "2500 PAD",
    icon: <Crown className="w-6 h-6" />,
    gradient: "from-orange-400 to-red-500",
    bgGradient: "from-orange-500/10 via-orange-500/5 to-transparent",
    popular: true
  },
  {
    id: "zero-fee",
    title: "Zero Fee Pass",
    bonus: "0%",
    duration: "1 use",
    price: "1000 PAD",
    icon: <Percent className="w-6 h-6" />,
    gradient: "from-cyan-400 to-teal-500",
    bgGradient: "from-cyan-500/10 via-cyan-500/5 to-transparent"
  }
];

function BoosterCard({ booster }: { booster: Booster }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${booster.bgGradient} border border-white/5 backdrop-blur-sm`}>
      {booster.popular && (
        <div className="absolute top-0 right-0">
          <div className="bg-gradient-to-r from-[#ADFF2F] to-[#7FFF00] text-black text-[9px] font-bold px-2.5 py-0.5 rounded-bl-lg">
            POPULAR
          </div>
        </div>
      )}
      
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${booster.gradient} flex items-center justify-center text-white shadow-lg`}>
            {booster.icon}
          </div>
          <div className="text-right">
            <div className={`text-2xl font-black bg-gradient-to-r ${booster.gradient} bg-clip-text text-transparent`}>
              {booster.bonus}
            </div>
            <div className="text-[10px] text-gray-400 font-medium">income boost</div>
          </div>
        </div>
        
        <div className="mb-3">
          <h3 className="text-white font-bold text-sm mb-1">{booster.title}</h3>
          <div className="flex items-center gap-1.5">
            <Clock className="w-3 h-3 text-gray-500" />
            <span className="text-xs text-gray-400">{booster.duration}</span>
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="text-[#ADFF2F] font-bold text-sm">{booster.price}</div>
          <Button 
            size="sm"
            className={`h-8 px-4 bg-gradient-to-r ${booster.gradient} hover:opacity-90 text-white font-semibold text-xs rounded-lg shadow-md transition-all`}
          >
            Buy
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function Store() {
  return (
    <Layout>
      <main className="max-w-md mx-auto px-4 pt-4 pb-6">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[#ADFF2F] to-[#7FFF00] mb-3 shadow-lg shadow-[#ADFF2F]/20">
            <Rocket className="w-8 h-8 text-black" />
          </div>
          <h1 className="text-2xl font-black text-white mb-1">Booster Shop</h1>
          <p className="text-gray-400 text-sm">Supercharge your earnings</p>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          {boosters.map((booster) => (
            <BoosterCard key={booster.id} booster={booster} />
          ))}
        </div>

        <div className="bg-[#111] rounded-2xl p-4 border border-white/5">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-[#ADFF2F]/20 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-[#ADFF2F]" />
            </div>
            <span className="text-white text-sm font-bold">How boosters work</span>
          </div>
          <p className="text-gray-400 text-xs leading-relaxed">
            Boosters multiply your PAD earnings from watching ads. The percentage boost is applied to all rewards during the active period. Zero Fee Pass removes withdrawal fees for one transaction.
          </p>
        </div>
      </main>
    </Layout>
  );
}
