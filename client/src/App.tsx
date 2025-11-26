import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import AppNotification from "@/components/AppNotification";
import { useEffect, lazy, Suspense, useState } from "react";
import { setupDeviceTracking } from "@/lib/deviceId";
import BanScreen from "@/components/BanScreen";
import SeasonEndOverlay from "@/components/SeasonEndOverlay";
import { SeasonEndContext } from "@/lib/SeasonEndContext";
import { useAdmin } from "@/hooks/useAdmin";

const Home = lazy(() => import("@/pages/Home"));
const Landing = lazy(() => import("@/pages/Landing"));
const Admin = lazy(() => import("@/pages/Admin"));
const Affiliates = lazy(() => import("@/pages/Affiliates"));
const Tasks = lazy(() => import("@/pages/Tasks"));
const CreateTask = lazy(() => import("@/pages/CreateTask"));
const Leaderboard = lazy(() => import("@/pages/Leaderboard"));
const WalletActivity = lazy(() => import("@/pages/WalletActivity"));
const WalletSetup = lazy(() => import("@/pages/WalletSetup"));
const Withdraw = lazy(() => import("@/pages/Withdraw"));
const TopUpPDZ = lazy(() => import("@/pages/TopUpPDZ"));
const AdList = lazy(() => import("@/pages/AdList"));
const NotFound = lazy(() => import("@/pages/not-found"));

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>
  );
}

function Router() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/tasks" component={Tasks} />
        <Route path="/create-task" component={CreateTask} />
        <Route path="/affiliates" component={Affiliates} />
        <Route path="/leaderboard" component={Leaderboard} />
        <Route path="/wallet-activity" component={WalletActivity} />
        <Route path="/wallet-setup" component={WalletSetup} />
        <Route path="/withdraw" component={Withdraw} />
        <Route path="/topup-pdz" component={TopUpPDZ} />
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

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.ready();
      
      if (tg.initDataUnsafe?.user) {
        localStorage.setItem("tg_user", JSON.stringify(tg.initDataUnsafe.user));
      }
      
      const { deviceId, fingerprint } = setupDeviceTracking();
      
      const headers: Record<string, string> = { 
        "Content-Type": "application/json",
        "x-device-id": deviceId,
        "x-device-fingerprint": JSON.stringify(fingerprint)
      };
      let body: any = {};
      
      if (tg.initData) {
        body = { initData: tg.initData };
      } else {
        const cachedUser = localStorage.getItem("tg_user");
        if (cachedUser) {
          try {
            const user = JSON.parse(cachedUser);
            headers["x-user-id"] = user.id.toString();
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
          }
        })
        .catch(() => {});
    }
  }, []);

  if (isBanned) {
    return <BanScreen reason={banReason} />;
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
