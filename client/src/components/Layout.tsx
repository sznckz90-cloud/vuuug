import { Link, useLocation } from "wouter";
import GhostLogo from "./GhostLogo";
import { useWebSocket } from "@/hooks/useWebSocket";

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const { isConnected } = useWebSocket(); // Initialize WebSocket connection

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-50 backdrop-blur-sm">
        <div className="max-w-md mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/">
            <div 
              className="flex items-center gap-3 cursor-pointer"
              onClick={(e) => {
                // Secret admin access - click 5 times quickly
                const clickCount = (window as any).adminClickCount || 0;
                (window as any).adminClickCount = clickCount + 1;
                
                setTimeout(() => {
                  (window as any).adminClickCount = 0;
                }, 3000); // Reset after 3 seconds
                
                if ((window as any).adminClickCount >= 5) {
                  e.preventDefault();
                  window.location.href = '/admin';
                  (window as any).adminClickCount = 0;
                }
              }}
            >
              <GhostLogo />
              <div>
                <p className="text-muted-foreground text-xs">Watch ads and earn crypto</p>
              </div>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/promote">
              <button className="px-3 py-2 rounded-full bg-muted hover:bg-accent transition-colors flex items-center gap-2">
                <i className="fas fa-bullhorn text-muted-foreground"></i>
                <span className="text-xs font-medium text-muted-foreground">Promote</span>
              </button>
            </Link>
          </div>
        </div>
      </header>

      {children}

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border">
        <div className="max-w-md mx-auto flex justify-center items-center py-3 gap-4">
          <Link href="/">
            <button className={`flex flex-col items-center p-2 transition-colors ${
              location === "/" ? "text-primary" : "text-muted-foreground hover:text-primary"
            }`} data-testid="link-home">
              <i className="fas fa-home text-lg mb-1" style={{fontFamily: 'Font Awesome 5 Free', fontWeight: 900}}></i>
              <span className="text-xs font-medium">Home</span>
            </button>
          </Link>
          <Link href="/tasks">
            <button className={`flex flex-col items-center p-2 transition-colors ${
              location === "/tasks" ? "text-primary" : "text-muted-foreground hover:text-primary"
            }`} data-testid="link-tasks">
              <i className="fas fa-tasks text-lg mb-1" style={{fontFamily: 'Font Awesome 5 Free', fontWeight: 900}}></i>
              <span className="text-xs font-medium">Tasks</span>
            </button>
          </Link>
          <Link href="/wallet">
            <button className={`flex flex-col items-center p-2 transition-colors ${
              location === "/wallet" ? "text-primary" : "text-muted-foreground hover:text-primary"
            }`} data-testid="link-wallet">
              <i className="fas fa-wallet text-lg mb-1" style={{fontFamily: 'Font Awesome 5 Free', fontWeight: 900}}></i>
              <span className="text-xs font-medium">Wallet</span>
            </button>
          </Link>
          <Link href="/exchange">
            <button className={`flex flex-col items-center p-2 transition-colors ${
              location === "/exchange" ? "text-primary" : "text-muted-foreground hover:text-primary"
            }`} data-testid="link-exchange">
              <i className="fas fa-exchange-alt text-lg mb-1" style={{fontFamily: 'Font Awesome 5 Free', fontWeight: 900}}></i>
              <span className="text-xs font-medium">Exchange</span>
            </button>
          </Link>
          <Link href="/affiliates">
            <button className={`flex flex-col items-center p-2 transition-colors ${
              location === "/affiliates" ? "text-primary" : "text-muted-foreground hover:text-primary"
            }`} data-testid="link-affiliates">
              <i className="fas fa-users text-lg mb-1" style={{fontFamily: 'Font Awesome 5 Free', fontWeight: 900}}></i>
              <span className="text-xs">Affiliates</span>
            </button>
          </Link>
        </div>
      </nav>

    </div>
  );
}
