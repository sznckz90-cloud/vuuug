import { Link, useLocation } from "wouter";
import GhostLogo from "./GhostLogo";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useAdmin } from "@/hooks/useAdmin";

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const { isConnected } = useWebSocket(); // Initialize WebSocket connection
  const { isAdmin } = useAdmin();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-50 backdrop-blur-sm">
        <div className="max-w-md mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/">
            <div className="flex items-center gap-3 cursor-pointer">
              <GhostLogo />
              <div>
                <p className="text-muted-foreground text-xs">Watch ads and earn crypto</p>
              </div>
            </div>
          </Link>
          
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

      {children}

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border">
        <div className="max-w-md mx-auto flex justify-center items-center py-3 gap-2">
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
          <Link href="/affiliates">
            <button className={`flex flex-col items-center p-2 transition-colors ${
              location === "/affiliates" ? "text-primary" : "text-muted-foreground hover:text-primary"
            }`} data-testid="link-affiliates">
              <i className="fas fa-users text-lg mb-1" style={{fontFamily: 'Font Awesome 5 Free', fontWeight: 900}}></i>
              <span className="text-xs font-medium">Affiliates</span>
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
        </div>
      </nav>

    </div>
  );
}
