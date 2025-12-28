import { Link, useLocation } from "wouter";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useAdmin } from "@/hooks/useAdmin";
import { motion, AnimatePresence } from "framer-motion";
import { Home, CheckSquare, Users, Wallet } from "lucide-react";

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const { isConnected } = useWebSocket();
  const { isAdmin } = useAdmin();

  const navItems = [
    { href: "/", icon: Home, label: "Home" },
    { href: "/tasks", icon: CheckSquare, label: "Tasks" },
    { href: "/affiliates", icon: Users, label: "Affiliates" },
    { href: "/wallet", icon: Wallet, label: "Wallet" },
  ];

  return (
    <div className="min-h-screen bg-transparent">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-50 backdrop-blur-sm">
        <div className="max-w-md mx-auto px-4 py-4 flex justify-end items-center">
          {/* Admin Button - Top Right */}
          {isAdmin && (
            <Link href="/admin">
              <button className={`p-2 rounded-lg transition-colors ${
                location === "/admin" ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground"
              }`} data-testid="admin-button">
                <i className="fas fa-cog text-lg" style={{fontFamily: 'Font Awesome 5 Free', fontWeight: 900}}></i>
              </button>
            </Link>
          )}
        </div>
      </header>

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
        <div className="max-w-md mx-auto px-4 pb-4">
          <motion.div 
            className="relative bg-card/80 backdrop-blur-xl rounded-[2rem] shadow-2xl border border-border/50"
            animate={{ 
              scale: [1, 1.02, 1],
            }}
            transition={{
              duration: 0.3,
              times: [0, 0.5, 1],
            }}
            key={location}
          >
            {/* Glow effect for active item */}
            <div className="absolute inset-0 rounded-[2rem] bg-gradient-to-t from-primary/10 to-transparent opacity-50 pointer-events-none" />
            
            <div className="flex justify-around items-center py-3 px-2 relative">
              {navItems.map((item) => {
                const isActive = location === item.href;
                const Icon = item.icon;
                
                return (
                  <Link key={item.href} href={item.href}>
                    <motion.button
                      className={`relative flex flex-col items-center gap-1 px-6 py-2.5 rounded-2xl transition-all duration-300 select-none ${
                        isActive 
                          ? "text-primary" 
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                      data-testid={`link-${item.label.toLowerCase()}`}
                      style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none' }}
                      whileTap={{ scale: 0.95 }}
                      animate={isActive ? {
                        scale: [1, 1.1, 1],
                      } : {}}
                      transition={{
                        scale: {
                          duration: 0.3,
                          ease: [0.34, 1.56, 0.64, 1], // Bounce effect
                        }
                      }}
                    >
                      {/* Active background pill */}
                      {isActive && (
                        <motion.div
                          layoutId="activeTab"
                          className="absolute inset-0 bg-primary/10 rounded-2xl"
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
                          className="absolute inset-0 bg-primary/20 rounded-2xl blur-lg"
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
                          duration: 0.3,
                          ease: "easeInOut"
                        }}
                      >
                        <Icon 
                          className={`transition-all duration-300 ${
                            isActive 
                              ? "w-6 h-6 drop-shadow-[0_0_8px_rgba(139,92,246,0.5)]" 
                              : "w-5 h-5"
                          }`}
                          strokeWidth={isActive ? 2.5 : 2}
                        />
                      </motion.div>

                      {/* Label */}
                      <motion.span 
                        className={`text-xs font-medium relative z-10 transition-all duration-300 ${
                          isActive ? "font-semibold" : ""
                        }`}
                        animate={isActive ? {
                          scale: [1, 1.05, 1],
                        } : {}}
                        transition={{
                          duration: 0.3,
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
