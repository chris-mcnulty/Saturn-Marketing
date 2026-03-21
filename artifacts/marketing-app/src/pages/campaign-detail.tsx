import React, { useState } from "react";
import { AppLayout } from "@/components/layout";
import { 
  useGetCampaign, 
  useUpdateCampaign, 
  useAddCampaignAsset,
  useRemoveCampaignAsset,
  useUpdateCampaignAsset,
  useListAssets,
  useListCategories,
  useListSocialAccounts,
  useAddCampaignSocialAccount,
  useRemoveCampaignSocialAccount,
  useGenerateCampaignPosts,
  useExportCampaignCsv,
  getGetCampaignQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, Plus, Download, Wand2, Link as LinkIcon, Trash2, Edit } from "lucide-react";
import { Link } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import * as DialogPrimitive from "@radix-ui/react-dialog";

export default function CampaignDetail() {
  const [, params] = useRoute("/campaigns/:id");
  const id = parseInt(params?.id || "0");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: campaign, isLoading } = useGetCampaign(id);
  const { data: allAssets } = useListAssets();
  const { data: categories } = useListCategories();
  const { data: allAccounts } = useListSocialAccounts();

  // Mutations
  const updateCampaignMut = useUpdateCampaign();
  const addAssetMut = useAddCampaignAsset();
  const removeAssetMut = useRemoveCampaignAsset();
  const updateAssetMut = useUpdateCampaignAsset();
  const addAccountMut = useAddCampaignSocialAccount();
  const removeAccountMut = useRemoveCampaignSocialAccount();
  const generatePostsMut = useGenerateCampaignPosts();
  const exportCsvMut = useExportCampaignCsv();

  // State
  const [activeTab, setActiveTab] = useState("assets");
  const [isAddAssetOpen, setIsAddAssetOpen] = useState(false);
  const [assetCategoryFilter, setAssetCategoryFilter] = useState<string>("");
  const [isAddAccountOpen, setIsAddAccountOpen] = useState(false);
  const [generatedPosts, setGeneratedPosts] = useState<any[]>([]);

  const handleStatusChange = (newStatus: "draft" | "scheduled" | "active" | "paused" | "completed") => {
    updateCampaignMut.mutate({ id, data: { status: newStatus } }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetCampaignQueryKey(id) })
    });
  };

  const closeAddAssetDialog = () => {
    setIsAddAssetOpen(false);
    setAssetCategoryFilter("");
  };

  const handleAddAsset = (assetId: number) => {
    addAssetMut.mutate({ id, data: { assetId } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCampaignQueryKey(id) });
        closeAddAssetDialog();
        toast({ title: "Asset added" });
      }
    });
  };

  const handleAddAccount = (socialAccountId: number) => {
    addAccountMut.mutate({ id, data: { socialAccountId } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCampaignQueryKey(id) });
        setIsAddAccountOpen(false);
        toast({ title: "Account linked" });
      }
    });
  };

  const handleGenerate = () => {
    generatePostsMut.mutate({ id }, {
      onSuccess: (data) => {
        setGeneratedPosts(data);
        setActiveTab("previews");
        toast({ title: "Posts generated successfully" });
      },
      onError: (err: any) => {
        toast({ title: "Generation failed", description: err.data?.error, variant: "destructive" });
      }
    });
  };

  const handleExport = () => {
    exportCsvMut.mutate({ id }, {
      onSuccess: (csvData) => {
        const blob = new Blob([csvData], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `campaign-${id}-export.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        toast({ title: "CSV Downloaded" });
      },
      onError: (err: any) => {
        toast({ title: "Export failed", description: err.data?.error || err.message || "An unexpected error occurred", variant: "destructive" });
      }
    });
  };

  if (isLoading || !campaign) return (
    <AppLayout><div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div></AppLayout>
  );

  return (
    <AppLayout>
      <div className="flex flex-col gap-6 max-w-5xl mx-auto">
        <Link href="/campaigns" className="text-sm font-medium text-muted-foreground hover:text-primary flex items-center gap-1 w-fit">
          <ArrowLeft className="w-4 h-4" /> Back to campaigns
        </Link>
        
        <div className="bg-card rounded-3xl p-6 md:p-8 border border-border/50 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-start justify-between gap-6">
            <div>
              <h1 className="text-4xl font-display font-bold text-foreground">{campaign.name}</h1>
              <p className="text-muted-foreground mt-2 text-lg">{campaign.description || "No description provided."}</p>
            </div>
            <div className="flex items-center gap-3">
              <select 
                value={campaign.status}
                onChange={(e) => handleStatusChange(e.target.value as any)}
                className="h-11 px-4 rounded-xl border border-input bg-background font-medium capitalize"
              >
                {['draft', 'scheduled', 'active', 'paused', 'completed'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <Button onClick={handleGenerate} className="h-11 rounded-xl bg-gradient-to-r from-accent to-primary text-white shadow-lg shadow-primary/20 hover:shadow-primary/40">
                <Wand2 className="w-4 h-4 mr-2" /> Generate Posts
              </Button>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-x-8 gap-y-4 mt-8 pt-6 border-t border-border/50 text-sm">
            <div><span className="text-muted-foreground">Start:</span> <span className="font-semibold">{campaign.startDate}</span></div>
            <div><span className="text-muted-foreground">Duration:</span> <span className="font-semibold">{campaign.durationDays} days</span></div>
            <div><span className="text-muted-foreground">Freq:</span> <span className="font-semibold">{campaign.postsPerDay}/day</span></div>
            <div><span className="text-muted-foreground">Always-Include Tags:</span> <span className="font-semibold">{campaign.hashtags || 'None'}</span></div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-border/50 pb-px">
          {['assets', 'accounts', 'previews'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === tab ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30'
              }`}
            >
              {tab === 'assets' ? 'Content Assets' : tab === 'accounts' ? 'Social Accounts' : 'Generated Previews'}
            </button>
          ))}
        </div>

        {/* Content based on Tab */}
        <div className="min-h-[400px]">
          {activeTab === 'assets' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Associated Content</h3>
                <Button variant="outline" onClick={() => setIsAddAssetOpen(true)} className="rounded-xl"><Plus className="w-4 h-4 mr-2" /> Add Asset</Button>
              </div>
              
              {campaign.assets.length === 0 ? (
                <div className="text-center py-16 border-2 border-dashed rounded-2xl">
                  <p className="text-muted-foreground mb-4">No content assets linked to this campaign.</p>
                  <Button onClick={() => setIsAddAssetOpen(true)}>Select Assets</Button>
                </div>
              ) : (
                <div className="grid gap-4">
                  {campaign.assets.map((ca) => (
                    <Card key={ca.assetId} className="p-4 rounded-2xl flex flex-col md:flex-row gap-4 border-border/50 items-start md:items-center">
                      <div className="w-16 h-16 rounded-xl bg-secondary flex-shrink-0 flex items-center justify-center overflow-hidden">
                        {ca.overrideImageUrl || ca.asset.suggestedImageUrl ? (
                          <img src={ca.overrideImageUrl || ca.asset.suggestedImageUrl!} alt="" className="w-full h-full object-cover" />
                        ) : <LinkIcon className="w-6 h-6 text-muted-foreground" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold truncate">{ca.asset.title || ca.asset.url}</h4>
                        <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                          {ca.overrideSummaryText || ca.asset.summaryText || "No summary available"}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {/* Simple placeholder for edit override - full implementation would open dialog */}
                        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary"><Edit className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => {
                          removeAssetMut.mutate({ campaignId: id, assetId: ca.assetId }, {
                            onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetCampaignQueryKey(id) })
                          })
                        }}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'accounts' && (
            <div className="space-y-4">
               <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Target Accounts</h3>
                <Button variant="outline" onClick={() => setIsAddAccountOpen(true)} className="rounded-xl"><Plus className="w-4 h-4 mr-2" /> Add Account</Button>
              </div>
              {campaign.socialAccounts.length === 0 ? (
                <div className="text-center py-16 border-2 border-dashed rounded-2xl">
                  <p className="text-muted-foreground mb-4">No social accounts linked.</p>
                  <Button onClick={() => setIsAddAccountOpen(true)}>Select Accounts</Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {campaign.socialAccounts.map(acc => (
                    <Card key={acc.id} className="p-4 rounded-xl flex justify-between items-center border-border/50">
                      <div>
                        <p className="font-semibold">{acc.accountName}</p>
                        <p className="text-xs text-muted-foreground uppercase mt-1">{acc.platform} • ID: {acc.socialPilotAccountId}</p>
                      </div>
                      <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => {
                        removeAccountMut.mutate({ campaignId: id, accountId: acc.id }, {
                          onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetCampaignQueryKey(id) })
                        })
                      }}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'previews' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Post Previews</h3>
                {generatedPosts.length > 0 && (
                  <Button onClick={handleExport} disabled={exportCsvMut.isPending} className="rounded-xl bg-green-600 hover:bg-green-700 text-white">
                    {exportCsvMut.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />} Export CSV
                  </Button>
                )}
              </div>
              
              {generatedPosts.length === 0 ? (
                <div className="text-center py-16 border-2 border-dashed rounded-2xl bg-secondary/10">
                  <p className="text-muted-foreground mb-4">Click 'Generate Posts' to preview the campaign schedule.</p>
                  <Button onClick={handleGenerate} variant="secondary">Generate Now</Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {generatedPosts.map((post, i) => (
                    <Card key={i} className="p-4 rounded-2xl border-border/50">
                      <div className="flex flex-col md:flex-row gap-4">
                        {post.imageUrls && (
                          <div className="w-full md:w-32 aspect-video md:aspect-square bg-secondary rounded-xl overflow-hidden shrink-0">
                            <img src={post.imageUrls.split(';')[0]} className="w-full h-full object-cover" />
                          </div>
                        )}
                        <div className="flex-1">
                          <div className="flex justify-between items-start mb-2 text-xs text-muted-foreground font-medium">
                            <span className="bg-primary/10 text-primary px-2 py-1 rounded-md">{post.dateTime}</span>
                            <span>Acct: {post.accountId}</span>
                          </div>
                          <p className="text-sm whitespace-pre-wrap">{post.postContent}</p>
                          {post.tags && (
                            <div className="flex flex-wrap gap-1.5 mt-3">
                              {post.tags.split(';').map((t: string, idx: number) => (
                                <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-primary/10 text-primary">
                                  #{t.trim()}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Add Asset Dialog */}
        <DialogPrimitive.Root open={isAddAssetOpen} onOpenChange={(open) => { if (!open) closeAddAssetDialog(); else setIsAddAssetOpen(true); }}>
          <DialogPrimitive.Portal>
            <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm" />
            <DialogPrimitive.Content className="fixed left-[50%] top-[50%] z-50 w-full max-w-lg translate-x-[-50%] translate-y-[-50%] bg-background p-6 shadow-2xl sm:rounded-2xl border">
              <h2 className="text-xl font-display font-bold mb-4">Select Asset</h2>
              {categories && categories.length > 0 && (
                <div className="mb-3">
                  <select
                    className="w-full h-10 px-3 py-2 rounded-xl border border-input bg-background text-sm"
                    value={assetCategoryFilter}
                    onChange={(e) => setAssetCategoryFilter(e.target.value)}
                  >
                    <option value="">All Categories</option>
                    {categories.map(c => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
                  </select>
                </div>
              )}
              <div className="max-h-96 overflow-y-auto space-y-2">
                {allAssets
                  ?.filter(a => !campaign.assets.find(ca => ca.assetId === a.id))
                  .filter(a => !assetCategoryFilter || a.categoryId === Number(assetCategoryFilter))
                  .map(asset => (
                  <div key={asset.id} className="flex items-center justify-between p-3 border rounded-xl hover:bg-secondary/50">
                    <div className="truncate pr-4">
                      <p className="font-medium text-sm truncate">{asset.title || asset.url}</p>
                    </div>
                    <Button size="sm" onClick={() => handleAddAsset(asset.id)}>Add</Button>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex justify-end">
                <Button variant="outline" onClick={closeAddAssetDialog}>Close</Button>
              </div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        </DialogPrimitive.Root>

        {/* Add Account Dialog */}
        <DialogPrimitive.Root open={isAddAccountOpen} onOpenChange={setIsAddAccountOpen}>
          <DialogPrimitive.Portal>
            <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm" />
            <DialogPrimitive.Content className="fixed left-[50%] top-[50%] z-50 w-full max-w-lg translate-x-[-50%] translate-y-[-50%] bg-background p-6 shadow-2xl sm:rounded-2xl border">
              <h2 className="text-xl font-display font-bold mb-4">Select Social Account</h2>
              <div className="max-h-96 overflow-y-auto space-y-2">
                {allAccounts?.filter(a => !campaign.socialAccounts.find(ca => ca.id === a.id)).map(acc => (
                  <div key={acc.id} className="flex items-center justify-between p-3 border rounded-xl hover:bg-secondary/50">
                    <div>
                      <p className="font-medium text-sm">{acc.accountName}</p>
                      <p className="text-xs text-muted-foreground uppercase">{acc.platform}</p>
                    </div>
                    <Button size="sm" onClick={() => handleAddAccount(acc.id)}>Select</Button>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex justify-end">
                <Button variant="outline" onClick={() => setIsAddAccountOpen(false)}>Close</Button>
              </div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
      </div>
    </AppLayout>
  );
}
