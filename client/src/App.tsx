import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import AppNotification from "@/components/AppNotification";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import Tasks from "@/pages/Tasks";
import Landing from "@/pages/Landing";
import Admin from "@/pages/Admin";
import Affiliates from "@/pages/Affiliates";
import { useEffect } from "react";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/tasks" component={Tasks} />
      <Route path="/affiliates" component={Affiliates} />
      <Route path="/profile" component={Landing} />
      <Route path="/admin" component={Admin} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.ready();
      console.log('🚀 Telegram WebApp initialized globally');
      
      // Cache user data if available
      if (tg.initDataUnsafe?.user) {
        localStorage.setItem("tg_user", JSON.stringify(tg.initDataUnsafe.user));
        console.log('💾 Telegram user cached:', tg.initDataUnsafe.user.id);
      }
      
      // CRITICAL FIX: ALWAYS call auth endpoint - never skip!
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      let body: any = {};
      
      if (tg.initData) {
        // Has initData - send it normally
        body = { initData: tg.initData };
        console.log('🔐 Authenticating with Telegram initData...');
      } else {
        // No initData - check for cached user_id
        const cachedUser = localStorage.getItem("tg_user");
        if (cachedUser) {
          try {
            const user = JSON.parse(cachedUser);
            headers["x-user-id"] = user.id.toString();
            console.log('🔐 Authenticating with cached user_id:', user.id);
          } catch (err) {
            console.warn('⚠️ Failed to parse cached user:', err);
          }
        } else {
          console.log('ℹ️ No initData or cached user - sending empty auth request for skipAuth');
        }
      }
      
      // ALWAYS call the auth endpoint to refresh session (even with empty body)
      fetch("/api/auth/telegram", {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      })
      .then(() => console.log('✅ Background Telegram auth successful'))
      .catch((err) => console.warn('⚠️ Background auth failed (non-blocking):', err.message));
      
    } else {
      console.log('ℹ️ Telegram WebApp not available - running in browser mode');
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppNotification />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
