import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import Tasks from "@/pages/Tasks";
import Landing from "@/pages/Landing";
import Admin from "@/pages/Admin";
import Wallet from "@/pages/Wallet";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/tasks" component={Tasks} />
      <Route path="/wallet" component={Wallet} />
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
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
