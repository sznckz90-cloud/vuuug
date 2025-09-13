import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import Tasks from "@/pages/Tasks";
import Profile from "@/pages/Profile";
import Promote from "@/pages/Promote";
import Admin from "@/pages/Admin";
import CreateTask from "@/pages/CreateTask";
import MyPromotions from "@/pages/MyPromotions";
import Wallet from "@/pages/Wallet";
import Affiliates from "@/pages/Affiliates";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/tasks" component={Tasks} />
      <Route path="/create-task" component={CreateTask} />
      <Route path="/my-promotions" component={MyPromotions} />
      <Route path="/wallet" component={Wallet} />
      <Route path="/affiliates" component={Affiliates} />
      <Route path="/profile" component={Profile} />
      <Route path="/promote" component={Promote} />
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
