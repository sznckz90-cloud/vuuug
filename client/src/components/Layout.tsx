import { Link, useLocation } from "wouter";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useAdmin } from "@/hooks/useAdmin";
import { motion, AnimatePresence } from "framer-motion";
import { Home, CheckSquare, Users, Wallet } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const { isConnected } = useWebSocket();
  const { isAdmin } = useAdmin();

  // Fetch user data for balance
  const { data: user } = useQuery<any>({
    queryKey: ['/api/auth/user'],
    retry: false,
  });

  const navItems = [
    { href: "/", icon: Home, label: "Home" },
    { href: "/tasks", icon: CheckSquare, label: "Tasks" },
    { href: "/affiliates", icon: Users, label: "Affiliates" },
    { href: "/wallet", icon: Wallet, label: "Wallet" },
  ];

  // Calculate balance in PAD and USD
  const balancePAD = Math.round(parseFloat(user?.balance || "0") * 100000);
  const balanceUSD = (balancePAD / 200000).toFixed(2);

  return (
    <div className="min-h-screen bg-transparent">
      {/* Page Content with Transition */}
      <AnimatePresence mode="wait">
        <motion.div
          key={location}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ 
            duration: 0.3,
            ease: [0.4, 0, 0.2, 1]
          }}
        >
          {children}
        </motion.div>
      </AnimatePresence>

      {/* Modern Curved Bottom Navigation */}
      <motion.nav 
        className="fixed bottom-0 left-0 right-0 z-50 pb-safe"
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        <div className="max-w-md mx-auto px-3 pb-3">
          <motion.div 
            className="relative bg-card/90 backdrop-blur-xl rounded-[1.5rem] shadow-2xl neon-glow-border"
            animate={{ 
              scale: [1, 1.02, 1],
            }}
            transition={{
              duration: 0.4,
              ease: [0.65, 0, 0.35, 1],
              times: [0, 0.5, 1],
            }}
            key={location}
          >
            {/* Glow effect for active item */}
            <div className="absolute inset-0 rounded-[1.5rem] bg-gradient-to-t from-primary/10 to-transparent opacity-50 pointer-events-none" />
            
            <div className="flex justify-center items-center gap-2 py-2 px-2 relative">
              {navItems.map((item) => {
                const isActive = location === item.href;
                const Icon = item.icon;
                
                return (
                  <Link key={item.href} href={item.href}>
                    <motion.button
                      className={`relative flex flex-col items-center justify-center gap-1 w-16 h-16 rounded-xl transition-all select-none ${
                        isActive 
                          ? "text-primary" 
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                      data-testid={`link-${item.label.toLowerCase()}`}
                      style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none' }}
                      whileTap={{ scale: 0.92 }}
                      onTapStart={(e) => {
                        const target = e.target as HTMLElement;
                        target.classList.add('tap-glow');
                        setTimeout(() => target.classList.remove('tap-glow'), 400);
                      }}
                      animate={isActive ? {
                        scale: [1, 1.05, 1],
                      } : {}}
                      transition={{
                        scale: {
                          duration: 0.4,
                          ease: [0.65, 0, 0.35, 1],
                        }
                      }}
                    >
                      {/* Active background pill */}
                      {isActive && (
                        <motion.div
                          layoutId="activeTab"
                          className="absolute inset-0 bg-primary/10 rounded-xl neon-glow-border-strong"
                          initial={false}
                          transition={{
                            type: "spring",
                            stiffness: 500,
                            damping: 30
                          }}
                        />
                      )}

                      {/* Glow effect on active */}
                      {isActive && (
                        <motion.div
                          className="absolute inset-0 bg-primary/20 rounded-xl blur-lg"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: [0, 1, 0] }}
                          transition={{
                            duration: 1.5,
                            repeat: Infinity,
                            ease: "easeInOut"
                          }}
                        />
                      )}

                      {/* Icon */}
                      <motion.div 
                        className="relative z-10"
                        animate={isActive ? {
                          y: [0, -2, 0],
                        } : {}}
                        transition={{
                          duration: 0.4,
                          ease: [0.65, 0, 0.35, 1]
                        }}
                      >
                        <Icon 
                          className={`transition-all duration-300 ${
                            isActive 
                              ? "w-6 h-6 drop-shadow-[0_0_10px_rgba(139,92,246,0.6)]" 
                              : "w-5 h-5"
                          }`}
                          strokeWidth={isActive ? 2.5 : 2}
                        />
                      </motion.div>

                      {/* Label */}
                      <motion.span 
                        className={`text-[10px] font-medium relative z-10 transition-all duration-300 ${
                          isActive ? "font-semibold" : ""
                        }`}
                        animate={isActive ? {
                          scale: [1, 1.05, 1],
                        } : {}}
                        transition={{
                          duration: 0.4,
                          ease: [0.65, 0, 0.35, 1]
                        }}
                      >
                        {item.label}
                      </motion.span>
                    </motion.button>
                  </Link>
                );
              })}
            </div>
          </motion.div>
        </div>
      </motion.nav>

    </div>
  );
}
