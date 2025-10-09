import { Link, useLocation } from "wouter";
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

      {children}

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border">
        <div className="max-w-md mx-auto flex justify-center items-center py-3 gap-4">
          <Link href="/">
            <button className={`flex flex-col items-center p-2 transition-colors select-none ${
              location === "/" ? "text-primary" : "text-muted-foreground hover:text-primary"
            }`} data-testid="link-home" style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none' }}>
              <i className="fas fa-home text-lg mb-1" style={{fontFamily: 'Font Awesome 5 Free', fontWeight: 900}}></i>
              <span className="text-xs font-medium">Home</span>
            </button>
          </Link>
          <Link href="/tasks">
            <button className={`flex flex-col items-center p-2 transition-colors select-none ${
              location === "/tasks" ? "text-primary" : "text-muted-foreground hover:text-primary"
            }`} data-testid="link-tasks" style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none' }}>
              <i className="fas fa-tasks text-lg mb-1" style={{fontFamily: 'Font Awesome 5 Free', fontWeight: 900}}></i>
              <span className="text-xs font-medium">Tasks</span>
            </button>
          </Link>
          <Link href="/affiliates">
            <button className={`flex flex-col items-center p-2 transition-colors select-none ${
              location === "/affiliates" ? "text-primary" : "text-muted-foreground hover:text-primary"
            }`} data-testid="link-affiliates" style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none' }}>
              <i className="fas fa-users text-lg mb-1" style={{fontFamily: 'Font Awesome 5 Free', fontWeight: 900}}></i>
              <span className="text-xs font-medium">Affiliates</span>
            </button>
          </Link>
          <Link href="/wallet">
            <button className={`flex flex-col items-center p-2 transition-colors select-none ${
              location === "/wallet" ? "text-primary" : "text-muted-foreground hover:text-primary"
            }`} data-testid="link-wallet" style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none' }}>
              <i className="fas fa-wallet text-lg mb-1" style={{fontFamily: 'Font Awesome 5 Free', fontWeight: 900}}></i>
              <span className="text-xs font-medium">Wallet</span>
            </button>
          </Link>
        </div>
      </nav>

    </div>
  );
}
