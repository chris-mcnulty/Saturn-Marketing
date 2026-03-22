import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth-context";
import { ThemeProvider } from "@/lib/theme-context";
import { MarketProvider } from "@/lib/market-context";

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
import GroundingDocs from "@/pages/grounding-docs";
import EmailGenerator from "@/pages/email-generator";
import Markets from "@/pages/markets";
import AdminTenants from "@/pages/admin-tenants";
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
      <Route path="/grounding-docs" component={GroundingDocs} />
      <Route path="/email-generator" component={EmailGenerator} />
      <Route path="/markets" component={Markets} />
      <Route path="/admin/tenants" component={AdminTenants} />
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
              <MarketProvider>
                <Router />
              </MarketProvider>
            </AuthProvider>
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
