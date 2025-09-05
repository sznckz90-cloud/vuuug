import { useState } from "react";
import { Link, useLocation } from "wouter";
import GhostLogo from "./GhostLogo";
import PromoCodeDialog from "./PromoCodeDialog";

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const [promoDialogOpen, setPromoDialogOpen] = useState(false);

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
          <div className="flex items-center gap-2">
            <button 
              className="p-2 rounded-full bg-muted hover:bg-accent transition-colors"
              onClick={() => setPromoDialogOpen(true)}
            >
              <i className="fas fa-ticket-alt text-muted-foreground"></i>
            </button>
            <Link href="/profile">
              <button className="p-2 rounded-full bg-muted hover:bg-accent transition-colors">
                <i className="fas fa-user text-muted-foreground"></i>
              </button>
            </Link>
          </div>
        </div>
      </header>

      {children}

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border">
        <div className="max-w-md mx-auto flex justify-center items-center py-3 gap-8">
          <Link href="/">
            <button className={`flex flex-col items-center p-3 transition-colors ${
              location === "/" ? "text-primary" : "text-muted-foreground hover:text-primary"
            }`} data-testid="link-home">
              <i className="fas fa-home text-xl mb-1" style={{fontFamily: 'Font Awesome 5 Free', fontWeight: 900}}></i>
              <span className="text-xs font-medium">Home</span>
            </button>
          </Link>
          <Link href="/stats">
            <button className={`flex flex-col items-center p-3 transition-colors ${
              location === "/stats" ? "text-primary" : "text-muted-foreground hover:text-primary"
            }`} data-testid="link-stats">
              <i className="fas fa-chart-bar text-xl mb-1" style={{fontFamily: 'Font Awesome 5 Free', fontWeight: 900}}></i>
              <span className="text-xs">Stats</span>
            </button>
          </Link>
          <Link href="/profile">
            <button className={`flex flex-col items-center p-3 transition-colors ${
              location === "/profile" ? "text-primary" : "text-muted-foreground hover:text-primary"
            }`} data-testid="link-profile">
              <i className="fas fa-user-circle text-xl mb-1" style={{fontFamily: 'Font Awesome 5 Free', fontWeight: 900}}></i>
              <span className="text-xs">Profile</span>
            </button>
          </Link>
        </div>
      </nav>

      <PromoCodeDialog open={promoDialogOpen} onOpenChange={setPromoDialogOpen} />
    </div>
  );
}
