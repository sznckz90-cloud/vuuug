import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import AppNotification from "@/components/AppNotification";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import Tasks from "@/pages/Tasks";
import Spin from "@/pages/Spin";
import Landing from "@/pages/Landing";
import Admin from "@/pages/Admin";
import Wallet from "@/pages/Wallet";
import Affiliates from "@/pages/Affiliates";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/tasks" component={Tasks} />
      <Route path="/spin" component={Spin} />
      <Route path="/wallet" component={Wallet} />
      <Route path="/affiliates" component={Affiliates} />
      <Route path="/profile" component={Landing} />
      <Route path="/admin" component={Admin} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
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
