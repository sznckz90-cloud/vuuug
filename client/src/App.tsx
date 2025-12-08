import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import AppNotification from "@/components/AppNotification";
import { useEffect, lazy, Suspense, useState, memo, useCallback } from "react";
import { setupDeviceTracking } from "@/lib/deviceId";
import BanScreen from "@/components/BanScreen";
import SeasonEndOverlay from "@/components/SeasonEndOverlay";
import { SeasonEndContext } from "@/lib/SeasonEndContext";
import { useAdmin } from "@/hooks/useAdmin";
import MandatoryJoinScreen from "@/components/MandatoryJoinScreen";

const Home = lazy(() => import("@/pages/Home"));
const Landing = lazy(() => import("@/pages/Landing"));
const Admin = lazy(() => import("@/pages/Admin"));
const Affiliates = lazy(() => import("@/pages/Affiliates"));
const Missions = lazy(() => import("@/pages/Missions"));
const CreateTask = lazy(() => import("@/pages/CreateTask"));
const WalletActivity = lazy(() => import("@/pages/WalletActivity"));
const WalletSetup = lazy(() => import("@/pages/WalletSetup"));
const Withdraw = lazy(() => import("@/pages/Withdraw"));
const AdList = lazy(() => import("@/pages/AdList"));
const NotFound = lazy(() => import("@/pages/not-found"));

const PageLoader = memo(function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-black">
      <div className="flex gap-1">
        <div className="w-2 h-2 rounded-full bg-[#4cd3ff] animate-bounce" style={{ animationDelay: '0ms' }}></div>
        <div className="w-2 h-2 rounded-full bg-[#4cd3ff] animate-bounce" style={{ animationDelay: '150ms' }}></div>
        <div className="w-2 h-2 rounded-full bg-[#4cd3ff] animate-bounce" style={{ animationDelay: '300ms' }}></div>
      </div>
    </div>
  );
});

function Router() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/tasks" component={Missions} />
        <Route path="/missions" component={Missions} />
        <Route path="/task/create" component={CreateTask} />
        <Route path="/affiliates" component={Affiliates} />
        <Route path="/wallet-activity" component={WalletActivity} />
        <Route path="/wallet-setup" component={WalletSetup} />
        <Route path="/withdraw" component={Withdraw} />
        <Route path="/ad-list" component={AdList} />
        <Route path="/profile" component={Landing} />
        <Route path="/admin" component={Admin} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function AppContent() {
  const [showSeasonEnd, setShowSeasonEnd] = useState(false);
  const [seasonLockActive, setSeasonLockActive] = useState(false);
  const { isAdmin } = useAdmin();

  useEffect(() => {
    const checkSeasonStatus = () => {
      fetch("/api/app-settings")
        .then(res => res.json())
        .then(settings => {
          if (settings.seasonBroadcastActive) {
            setSeasonLockActive(true);
            setShowSeasonEnd(true);
          } else {
            setSeasonLockActive(false);
            localStorage.removeItem("season_end_seen");
          }
        })
        .catch(() => {});
    };

    checkSeasonStatus();
    const interval = setInterval(checkSeasonStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleCloseSeasonEnd = () => {
    if (!seasonLockActive) {
      localStorage.setItem("season_end_seen", "true");
      setShowSeasonEnd(false);
    }
  };

  const shouldShowSeasonEnd = showSeasonEnd && !isAdmin;

  return (
    <SeasonEndContext.Provider value={{ showSeasonEnd: shouldShowSeasonEnd }}>
      <AppNotification />
      {shouldShowSeasonEnd && <SeasonEndOverlay onClose={handleCloseSeasonEnd} isLocked={seasonLockActive} />}
      <Router />
    </SeasonEndContext.Provider>
  );
}

function App() {
  const [isBanned, setIsBanned] = useState(false);
  const [banReason, setBanReason] = useState<string>();
  const [isChannelGroupVerified, setIsChannelGroupVerified] = useState<boolean | null>(null);
  const [telegramId, setTelegramId] = useState<string | null>(null);
  const [isCheckingMembership, setIsCheckingMembership] = useState(true);
  
  const isDevMode = import.meta.env.DEV || import.meta.env.MODE === 'development';

  const checkMembership = useCallback(async () => {
    try {
      const response = await fetch(`/api/membership/check`);
      const data = await response.json();
      
      if (data.success && data.isVerified) {
        setIsChannelGroupVerified(true);
      } else {
        setIsChannelGroupVerified(false);
      }
    } catch (err) {
      console.error("Membership check error:", err);
      setIsChannelGroupVerified(false);
    } finally {
      setIsCheckingMembership(false);
    }
  }, []);

  useEffect(() => {
    if (isDevMode) {
      console.log('🔧 Development mode: Skipping Telegram authentication');
      setTelegramId('dev-user-123');
      setIsChannelGroupVerified(true);
      setIsCheckingMembership(false);
      return;
    }
    
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.ready();
      
      if (tg.initDataUnsafe?.user) {
        localStorage.setItem("tg_user", JSON.stringify(tg.initDataUnsafe.user));
        setTelegramId(tg.initDataUnsafe.user.id.toString());
      }
      
      const { deviceId, fingerprint } = setupDeviceTracking();
      
      const headers: Record<string, string> = { 
        "Content-Type": "application/json",
        "x-device-id": deviceId,
        "x-device-fingerprint": JSON.stringify(fingerprint)
      };
      let body: any = {};
      let userTelegramId: string | null = null;
      
      if (tg.initData) {
        body = { initData: tg.initData };
        if (tg.initDataUnsafe?.user?.id) {
          userTelegramId = tg.initDataUnsafe.user.id.toString();
        }
      } else {
        const cachedUser = localStorage.getItem("tg_user");
        if (cachedUser) {
          try {
            const user = JSON.parse(cachedUser);
            headers["x-user-id"] = user.id.toString();
            userTelegramId = user.id.toString();
          } catch {}
        }
      }
      
      fetch("/api/auth/telegram", {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      })
        .then(res => res.json())
        .then(data => {
          if (data.banned) {
            setIsBanned(true);
            setBanReason(data.reason);
            setIsCheckingMembership(false);
          } else if (userTelegramId) {
            setTelegramId(userTelegramId);
            checkMembership();
          } else {
            setIsCheckingMembership(false);
            setIsChannelGroupVerified(false);
          }
        })
        .catch(() => {
          setIsCheckingMembership(false);
          setIsChannelGroupVerified(false);
        });
    } else {
      setIsCheckingMembership(false);
      setIsChannelGroupVerified(false);
    }
  }, [checkMembership, isDevMode]);

  const handleMembershipVerified = useCallback(() => {
    setIsChannelGroupVerified(true);
  }, []);

  if (isBanned) {
    return <BanScreen reason={banReason} />;
  }

  if (isCheckingMembership) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
        <div className="flex gap-1">
          <div className="w-2 h-2 rounded-full bg-[#4cd3ff] animate-bounce" style={{ animationDelay: '0ms' }}></div>
          <div className="w-2 h-2 rounded-full bg-[#4cd3ff] animate-bounce" style={{ animationDelay: '150ms' }}></div>
          <div className="w-2 h-2 rounded-full bg-[#4cd3ff] animate-bounce" style={{ animationDelay: '300ms' }}></div>
        </div>
      </div>
    );
  }

  if (!isChannelGroupVerified) {
    if (telegramId) {
      return <MandatoryJoinScreen telegramId={telegramId} onVerified={handleMembershipVerified} />;
    } else {
      return (
        <div className="fixed inset-0 z-[9999] bg-black flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-gradient-to-b from-gray-900 to-black rounded-2xl border border-gray-800 p-6 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
            </div>
            <h1 className="text-xl font-bold text-white mb-2">Open in Telegram</h1>
            <p className="text-gray-400 text-sm">
              Please open this app from Telegram to continue. This app requires Telegram authentication.
            </p>
          </div>
        </div>
      );
    }
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppContent />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
