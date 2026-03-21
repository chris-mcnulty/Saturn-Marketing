import React from "react";
import { AppLayout } from "@/components/layout";
import { 
  useListAssets, 
  useListCampaigns, 
  useListBrandAssets 
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Files, Megaphone, Image as ImageIcon, Activity, ArrowRight
} from "lucide-react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { format } from "date-fns";

export default function Dashboard() {
  const { data: assets } = useListAssets();
  const { data: campaigns } = useListCampaigns();
  const { data: brandAssets } = useListBrandAssets();

  const activeCampaigns = campaigns?.filter(c => c.status === "active" || c.status === "scheduled") || [];
  const recentAssets = assets?.slice(0, 5) || [];

  const stats = [
    { name: "Total Assets", value: assets?.length || 0, icon: Files, color: "text-primary", bg: "bg-primary/10" },
    { name: "Active Campaigns", value: activeCampaigns.length, icon: Megaphone, color: "text-secondary", bg: "bg-secondary/10" },
    { name: "Brand Images", value: brandAssets?.length || 0, icon: ImageIcon, color: "text-chart-3", bg: "bg-chart-3/10" },
    { name: "Total Campaigns", value: campaigns?.length || 0, icon: Activity, color: "text-chart-4", bg: "bg-chart-4/10" },
  ];

  return (
    <AppLayout>
      <div className="flex flex-col gap-8 pb-10">
        
        <div className="relative overflow-hidden rounded-3xl aurora-bg border border-primary/10 p-8 sm:p-10">
          <div className="relative z-10 max-w-2xl">
            <h1 className="text-4xl font-display font-bold text-foreground mb-4">
              Marketing Command Center
            </h1>
            <p className="text-lg text-muted-foreground mb-6">
              Manage your content assets, configure bulk campaigns, and auto-generate social media posts for SocialPilot.
            </p>
            <div className="flex gap-4">
              <Link 
                href="/campaigns" 
                className="inline-flex items-center justify-center px-6 py-3 rounded-xl saturn-gradient text-white font-medium shadow-lg hover:opacity-90 hover:-translate-y-0.5 transition-all"
              >
                View Campaigns
              </Link>
              <Link 
                href="/assets" 
                className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-card border border-border text-foreground font-medium shadow-sm hover:bg-accent transition-all"
              >
                Manage Assets
              </Link>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <Card className="glass-card rounded-2xl border-border/50 hover:shadow-md transition-all">
                <CardContent className="p-6 flex items-center gap-4">
                  <div className={`p-4 rounded-2xl ${stat.bg}`}>
                    <stat.icon className={`w-6 h-6 ${stat.color}`} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{stat.name}</p>
                    <h3 className="text-3xl font-display font-bold text-foreground mt-1">{stat.value}</h3>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card className="glass-card rounded-2xl border-border/50 page-header-gradient-bar">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xl font-display font-semibold">Recent Assets</CardTitle>
              <Link href="/assets" className="text-sm font-medium text-primary hover:underline flex items-center gap-1">
                View all <ArrowRight className="w-4 h-4" />
              </Link>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 mt-4">
                {recentAssets.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">No assets added yet</div>
                ) : (
                  recentAssets.map((asset) => (
                    <div key={asset.id} className="flex items-center gap-4 p-3 rounded-xl hover:bg-accent/50 transition-colors">
                      <div className="w-12 h-12 rounded-lg bg-accent flex items-center justify-center shrink-0">
                        {asset.suggestedImageUrl ? (
                          <img src={asset.suggestedImageUrl} alt={asset.title || "Asset"} className="w-full h-full object-cover rounded-lg" />
                        ) : (
                          <Files className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {asset.title || asset.url}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">{asset.url}</p>
                      </div>
                      <div className="shrink-0 text-xs text-muted-foreground">
                        {format(new Date(asset.createdAt), "MMM d")}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card rounded-2xl border-border/50 page-header-gradient-bar">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xl font-display font-semibold">Active Campaigns</CardTitle>
              <Link href="/campaigns" className="text-sm font-medium text-primary hover:underline flex items-center gap-1">
                View all <ArrowRight className="w-4 h-4" />
              </Link>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 mt-4">
                {activeCampaigns.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">No active campaigns</div>
                ) : (
                  activeCampaigns.slice(0,5).map((campaign) => (
                    <Link key={campaign.id} href={`/campaigns/${campaign.id}`}>
                      <div className="flex items-center justify-between p-4 rounded-xl border border-border/50 hover:border-primary/30 hover:bg-primary/5 transition-all mb-3 cursor-pointer group">
                        <div>
                          <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                            {campaign.name}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Starts {format(new Date(campaign.startDate), "MMM d, yyyy")} - {campaign.durationDays} days
                          </p>
                        </div>
                        <div className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium capitalize">
                          {campaign.status}
                        </div>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

      </div>
    </AppLayout>
  );
}
