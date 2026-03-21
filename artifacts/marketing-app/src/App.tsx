import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth-context";
import { ThemeProvider } from "@/lib/theme-context";

import Login from "@/pages/login";
import Register from "@/pages/register";
import Dashboard from "@/pages/dashboard";
import Assets from "@/pages/assets";
import AssetDetail from "@/pages/asset-detail";
import BrandAssets from "@/pages/brand-assets";
import Campaigns from "@/pages/campaigns";
import CampaignDetail from "@/pages/campaign-detail";
import SocialAccounts from "@/pages/social-accounts";
import Settings from "@/pages/settings";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/" component={Dashboard} />
      <Route path="/assets" component={Assets} />
      <Route path="/assets/:id" component={AssetDetail} />
      <Route path="/brand-assets" component={BrandAssets} />
      <Route path="/campaigns" component={Campaigns} />
      <Route path="/campaigns/:id" component={CampaignDetail} />
      <Route path="/social-accounts" component={SocialAccounts} />
      <Route path="/settings" component={Settings} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <AuthProvider>
              <Router />
            </AuthProvider>
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
