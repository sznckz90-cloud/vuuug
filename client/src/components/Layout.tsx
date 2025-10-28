import { Link, useLocation } from "wouter";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useAdmin } from "@/hooks/useAdmin";
import { motion, AnimatePresence } from "framer-motion";
import { Home, CheckSquare, Users, ClipboardList } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import Header from "@/components/Header";

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const { isConnected } = useWebSocket();
  const { isAdmin } = useAdmin();

  const { data: user } = useQuery<any>({
    queryKey: ['/api/auth/user'],
    retry: false,
  });

  const navItems = [
    { href: "/", icon: Home, label: "Home" },
    { href: "/tasks", icon: ClipboardList, label: "Tasks" },
    { href: "/affiliates", icon: Users, label: "Affiliates" },
  ];

  const balancePAD = Math.round(parseFloat(user?.balance || "0") * 100000);
  const balanceUSD = (balancePAD / 100000).toFixed(2);

  return (
    <div className="h-screen w-full flex flex-col bg-black overflow-hidden">
      {/* Header - Fixed */}
      <Header />
      
      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto scrollbar-hide" style={{ paddingBottom: '88px', paddingTop: '60px' }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={location}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ 
              duration: 0.2,
              ease: [0.645, 0.045, 0.355, 1]
            }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom Navigation - Fixed */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-black border-t border-[#1A1A1A]">
        <div className="max-w-md mx-auto px-4">
          <div className="flex justify-around items-center py-3">
            {navItems.map((item) => {
              const isActive = location === item.href;
              const Icon = item.icon;
              
              return (
                <Link key={item.href} href={item.href}>
                  <button
                    className={`flex flex-col items-center justify-center gap-1 min-w-[60px] transition-all ${
                      isActive 
                        ? "text-[#007BFF]" 
                        : "text-[#AAAAAA] hover:text-[#FFFFFF]"
                    }`}
                    data-testid={`link-${item.label.toLowerCase()}`}
                  >
                    <Icon 
                      className={`w-6 h-6 transition-all`}
                      strokeWidth={isActive ? 2.5 : 2}
                    />
                    <span className={`text-xs font-medium ${isActive ? 'font-semibold' : ''}`}>
                      {item.label}
                    </span>
                  </button>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
    </div>
  );
}
