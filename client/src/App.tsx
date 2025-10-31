import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import AppNotification from "@/components/AppNotification";
import { useEffect, lazy, Suspense, useState } from "react";
import { setupDeviceTracking } from "@/lib/deviceId";
import BanScreen from "@/components/BanScreen";
import SeasonEndOverlay from "@/components/SeasonEndOverlay";

const Home = lazy(() => import("@/pages/Home"));
const Landing = lazy(() => import("@/pages/Landing"));
const Admin = lazy(() => import("@/pages/Admin"));
const Affiliates = lazy(() => import("@/pages/Affiliates"));
const Tasks = lazy(() => import("@/pages/Tasks"));
const CreateTask = lazy(() => import("@/pages/CreateTask"));
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
        <Route path="/profile" component={Landing} />
        <Route path="/admin" component={Admin} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  const [isBanned, setIsBanned] = useState(false);
  const [banReason, setBanReason] = useState<string>();
  const [showSeasonEnd, setShowSeasonEnd] = useState(false);

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

    fetch("/api/app-settings")
      .then(res => res.json())
      .then(settings => {
        if (settings.seasonBroadcastActive) {
          const hasSeenSeasonEnd = localStorage.getItem("season_end_seen");
          if (!hasSeenSeasonEnd) {
            setShowSeasonEnd(true);
          }
        } else {
          localStorage.removeItem("season_end_seen");
        }
      })
      .catch(() => {});
  }, []);

  const handleCloseSeasonEnd = () => {
    localStorage.setItem("season_end_seen", "true");
    setShowSeasonEnd(false);
  };

  if (isBanned) {
    return <BanScreen reason={banReason} />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppNotification />
        {showSeasonEnd && <SeasonEndOverlay onClose={handleCloseSeasonEnd} />}
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
