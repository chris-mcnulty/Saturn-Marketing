import React, { useState, useEffect, useRef, useCallback } from "react";
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
  useListGeneratedPosts,
  getGetCampaignQueryKey,
  getGeneratePostsStatus,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, Plus, Download, Wand2, Link as LinkIcon, Trash2, Edit, Pencil, Save, X } from "lucide-react";
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
  const { data: savedPosts } = useListGeneratedPosts(id);

  // Mutations
  const updateCampaignMut = useUpdateCampaign();
  const addAssetMut = useAddCampaignAsset();
  const removeAssetMut = useRemoveCampaignAsset();
  const updateAssetMut = useUpdateCampaignAsset();
  const addAccountMut = useAddCampaignSocialAccount();
  const removeAccountMut = useRemoveCampaignSocialAccount();
  const generatePostsMut = useGenerateCampaignPosts();

  const exportFormats = [
    { value: "socialpilot", label: "SocialPilot" },
    { value: "hootsuite", label: "Hootsuite" },
    { value: "sproutsocial", label: "Sprout Social" },
    { value: "buffer", label: "Buffer" },
  ] as const;

  // State
  const [activeTab, setActiveTab] = useState("assets");
  const [isAddAssetOpen, setIsAddAssetOpen] = useState(false);
  const [assetCategoryFilter, setAssetCategoryFilter] = useState<string>("");
  const [isAddAccountOpen, setIsAddAccountOpen] = useState(false);
  const [generatedPosts, setGeneratedPosts] = useState<any[] | null>(null);
  const [exportFormat, setExportFormat] = useState<string>("socialpilot");
  const [selectedAssetIds, setSelectedAssetIds] = useState<Set<number>>(new Set());
  const [isAddingAssets, setIsAddingAssets] = useState(false);
  const [isEditingCampaign, setIsEditingCampaign] = useState(false);
  const [editFields, setEditFields] = useState({
    name: "", description: "", startDate: "", durationDays: 7,
    postsPerDay: 1, postingTimes: "", hashtags: "",
  });

  useEffect(() => {
    if (savedPosts && savedPosts.length > 0 && generatedPosts === null) {
      setGeneratedPosts(savedPosts);
    }
  }, [savedPosts]);

  const posts = generatedPosts || [];

  const handleStatusChange = (newStatus: "draft" | "scheduled" | "active" | "paused" | "completed") => {
    updateCampaignMut.mutate({ id, data: { status: newStatus } }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetCampaignQueryKey(id) })
    });
  };

  const openEditCampaign = () => {
    if (!campaign) return;
    const startDateStr = typeof campaign.startDate === "string"
      ? campaign.startDate.split("T")[0]
      : new Date(campaign.startDate).toISOString().split("T")[0];
    setEditFields({
      name: campaign.name,
      description: campaign.description || "",
      startDate: startDateStr,
      durationDays: campaign.durationDays,
      postsPerDay: campaign.postsPerDay,
      postingTimes: campaign.postingTimes || "",
      hashtags: campaign.hashtags || "",
    });
    setIsEditingCampaign(true);
  };

  const saveEditCampaign = () => {
    updateCampaignMut.mutate({ id, data: {
      name: editFields.name,
      description: editFields.description || undefined,
      startDate: editFields.startDate,
      durationDays: editFields.durationDays,
      postsPerDay: editFields.postsPerDay,
      postingTimes: editFields.postingTimes || undefined,
      hashtags: editFields.hashtags || undefined,
    }}, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCampaignQueryKey(id) });
        setIsEditingCampaign(false);
        toast({ title: "Campaign updated" });
      },
      onError: () => toast({ title: "Failed to update campaign", variant: "destructive" }),
    });
  };

  const closeAddAssetDialog = () => {
    setIsAddAssetOpen(false);
    setAssetCategoryFilter("");
    setSelectedAssetIds(new Set());
  };

  const toggleAssetSelection = (assetId: number) => {
    setSelectedAssetIds(prev => {
      const next = new Set(prev);
      if (next.has(assetId)) next.delete(assetId);
      else next.add(assetId);
      return next;
    });
  };

  const handleAddSelectedAssets = async () => {
    if (selectedAssetIds.size === 0) return;
    setIsAddingAssets(true);
    let added = 0;
    for (const assetId of selectedAssetIds) {
      try {
        await new Promise<void>((resolve, reject) => {
          addAssetMut.mutate({ id, data: { assetId } }, {
            onSuccess: () => { added++; resolve(); },
            onError: (err) => reject(err),
          });
        });
      } catch { /* skip failures */ }
    }
    queryClient.invalidateQueries({ queryKey: getGetCampaignQueryKey(id) });
    closeAddAssetDialog();
    setIsAddingAssets(false);
    toast({ title: `${added} asset${added !== 1 ? "s" : ""} added` });
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

  const [showPostWarning, setShowPostWarning] = useState(false);
  const [estimatedPostCount, setEstimatedPostCount] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  const doGenerate = useCallback(() => {
    setIsGenerating(true);
    generatePostsMut.mutate({ id }, {
      onSuccess: (data: any) => {
        const jobId = data?.jobId;
        if (!jobId) {
          setIsGenerating(false);
          toast({ title: "Generation failed", description: "No job ID returned", variant: "destructive" });
          return;
        }
        pollingRef.current = setInterval(async () => {
          try {
            const status = await getGeneratePostsStatus(id, { jobId });
            if (status.status === "complete") {
              if (pollingRef.current) clearInterval(pollingRef.current);
              pollingRef.current = null;
              setIsGenerating(false);
              setGeneratedPosts(status.posts || []);
              setActiveTab("previews");
              toast({ title: "Posts generated successfully" });
            } else if (status.status === "error") {
              if (pollingRef.current) clearInterval(pollingRef.current);
              pollingRef.current = null;
              setIsGenerating(false);
              toast({ title: "Generation failed", description: status.error || "Unknown error", variant: "destructive" });
            }
          } catch {
            if (pollingRef.current) clearInterval(pollingRef.current);
            pollingRef.current = null;
            setIsGenerating(false);
            toast({ title: "Generation failed", description: "Lost connection to server", variant: "destructive" });
          }
        }, 2000);
      },
      onError: (err: any) => {
        setIsGenerating(false);
        const description = err.data?.error || err.message || "Something went wrong";
        toast({ title: "Generation failed", description, variant: "destructive" });
      }
    });
  }, [id, generatePostsMut, toast]);

  const handleGenerate = () => {
    if (!campaign) return;
    const accountCount = campaign.socialAccounts?.length || 1;
    const assetCount = campaign.assets?.length || 0;
    if (assetCount === 0) {
      doGenerate();
      return;
    }
    const estimated = campaign.durationDays * campaign.postsPerDay * accountCount;
    if (estimated > 500) {
      setEstimatedPostCount(estimated);
      setShowPostWarning(true);
    } else {
      doGenerate();
    }
  };

  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const baseUrl = import.meta.env.BASE_URL || "/";
      const response = await fetch(`${baseUrl}api/campaigns/${id}/export-csv?format=${exportFormat}`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.error || `Export failed (${response.status})`);
      }
      const csvData = await response.text();
      const blob = new Blob([csvData], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const formatLabel = exportFormats.find(f => f.value === exportFormat)?.label || exportFormat;
      a.download = `campaign-${id}-${exportFormat}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast({ title: `${formatLabel} CSV Downloaded` });
    } catch (err: any) {
      toast({ title: "Export failed", description: err.message || "An unexpected error occurred", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
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
              <Button variant="outline" onClick={openEditCampaign} className="h-11 rounded-xl">
                <Pencil className="w-4 h-4 mr-2" /> Edit
              </Button>
              <select 
                value={campaign.status}
                onChange={(e) => handleStatusChange(e.target.value as any)}
                className="h-11 px-4 rounded-xl border border-input bg-background font-medium capitalize"
              >
                {['draft', 'scheduled', 'active', 'paused', 'completed'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <Button onClick={handleGenerate} disabled={isGenerating} className="h-11 rounded-xl bg-gradient-to-r from-accent to-primary text-white shadow-lg shadow-primary/20 hover:shadow-primary/40">
                {isGenerating ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</>
                ) : (
                  <><Wand2 className="w-4 h-4 mr-2" /> Generate Posts</>
                )}
              </Button>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-x-8 gap-y-4 mt-8 pt-6 border-t border-border/50 text-sm">
            <div><span className="text-muted-foreground">Start:</span> <span className="font-semibold">{typeof campaign.startDate === "string" ? campaign.startDate.split("T")[0] : campaign.startDate}</span></div>
            <div><span className="text-muted-foreground">Duration:</span> <span className="font-semibold">{campaign.durationDays} days</span></div>
            <div><span className="text-muted-foreground">Freq:</span> <span className="font-semibold">{campaign.postsPerDay}/day</span></div>
            {campaign.postingTimes && <div><span className="text-muted-foreground">Times:</span> <span className="font-semibold">{campaign.postingTimes}</span></div>}
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
                {posts.length > 0 && (
                  <div className="flex items-center gap-2">
                    <select
                      value={exportFormat}
                      onChange={(e) => setExportFormat(e.target.value)}
                      className="h-10 px-3 rounded-xl border border-input bg-background text-sm font-medium"
                    >
                      {exportFormats.map(f => (
                        <option key={f.value} value={f.value}>{f.label}</option>
                      ))}
                    </select>
                    <Button onClick={handleExport} disabled={isExporting} className="rounded-xl bg-green-600 hover:bg-green-700 text-white">
                      {isExporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />} Export CSV
                    </Button>
                  </div>
                )}
              </div>
              
              {isGenerating && (
                <div className="flex items-center gap-3 p-4 rounded-2xl bg-primary/10 border border-primary/20 mb-4">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  <div>
                    <p className="font-medium text-sm">Generating posts...</p>
                    <p className="text-xs text-muted-foreground">AI is creating unique variations and hashtags for each asset. This may take 20–30 seconds.</p>
                  </div>
                </div>
              )}

              {!isGenerating && posts.length === 0 ? (
                <div className="text-center py-16 border-2 border-dashed rounded-2xl bg-secondary/10">
                  <p className="text-muted-foreground mb-4">Click 'Generate Posts' to preview the campaign schedule.</p>
                  <Button onClick={handleGenerate} variant="secondary">Generate Now</Button>
                </div>
              ) : posts.length > 0 ? (
                <div className="space-y-4">
                  {posts.map((post, i) => (
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
              ) : null}
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
              <div className="max-h-96 overflow-y-auto space-y-1">
                {(() => {
                  const available = allAssets
                    ?.filter(a => !campaign.assets.find(ca => ca.assetId === a.id))
                    .filter(a => !assetCategoryFilter || a.categoryId === Number(assetCategoryFilter)) || [];
                  if (available.length > 0) {
                    return (
                      <>
                        <button
                          type="button"
                          className="text-xs font-medium text-primary hover:underline mb-2 px-1"
                          onClick={() => {
                            if (selectedAssetIds.size === available.length) {
                              setSelectedAssetIds(new Set());
                            } else {
                              setSelectedAssetIds(new Set(available.map(a => a.id)));
                            }
                          }}
                        >
                          {selectedAssetIds.size === available.length ? "Deselect all" : "Select all"}
                        </button>
                        {available.map(asset => (
                          <label
                            key={asset.id}
                            className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-colors ${
                              selectedAssetIds.has(asset.id) ? "bg-primary/10 border-primary/30" : "hover:bg-secondary/50"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={selectedAssetIds.has(asset.id)}
                              onChange={() => toggleAssetSelection(asset.id)}
                              className="w-4 h-4 rounded accent-primary"
                            />
                            <div className="truncate min-w-0">
                              <p className="font-medium text-sm truncate">{asset.title || asset.url}</p>
                            </div>
                          </label>
                        ))}
                      </>
                    );
                  }
                  return <p className="text-center py-8 text-muted-foreground text-sm">No assets available to add.</p>;
                })()}
              </div>
              <div className="mt-4 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {selectedAssetIds.size > 0 ? `${selectedAssetIds.size} selected` : ""}
                </span>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={closeAddAssetDialog}>Cancel</Button>
                  <Button
                    onClick={handleAddSelectedAssets}
                    disabled={selectedAssetIds.size === 0 || isAddingAssets}
                  >
                    {isAddingAssets ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    Add {selectedAssetIds.size > 0 ? selectedAssetIds.size : ""} Asset{selectedAssetIds.size !== 1 ? "s" : ""}
                  </Button>
                </div>
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

        <Dialog open={isEditingCampaign} onOpenChange={setIsEditingCampaign}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-xl font-display">Edit Campaign</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
              <div className="md:col-span-2">
                <label className="text-sm font-medium mb-1.5 block">Campaign Name</label>
                <Input value={editFields.name} onChange={e => setEditFields(f => ({...f, name: e.target.value}))} className="rounded-xl h-11" />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium mb-1.5 block">Description</label>
                <Input value={editFields.description} onChange={e => setEditFields(f => ({...f, description: e.target.value}))} className="rounded-xl h-11" placeholder="Optional notes" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Start Date</label>
                <Input type="date" value={editFields.startDate} onChange={e => setEditFields(f => ({...f, startDate: e.target.value}))} className="rounded-xl h-11" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Duration (Days)</label>
                <Input type="number" min={1} value={editFields.durationDays} onChange={e => setEditFields(f => ({...f, durationDays: parseInt(e.target.value) || 1}))} className="rounded-xl h-11" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Posts Per Day</label>
                <Input type="number" min={1} value={editFields.postsPerDay} onChange={e => setEditFields(f => ({...f, postsPerDay: parseInt(e.target.value) || 1}))} className="rounded-xl h-11" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Posting Times</label>
                <Input value={editFields.postingTimes} onChange={e => setEditFields(f => ({...f, postingTimes: e.target.value}))} className="rounded-xl h-11" placeholder="09:00, 15:00" />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium mb-1.5 block">Always-Include Hashtags</label>
                <Input value={editFields.hashtags} onChange={e => setEditFields(f => ({...f, hashtags: e.target.value}))} className="rounded-xl h-11" placeholder="#Marketing; #AI" />
                <p className="text-xs text-muted-foreground mt-1">Separate with semicolons.</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditingCampaign(false)} className="rounded-xl">Cancel</Button>
              <Button onClick={saveEditCampaign} disabled={updateCampaignMut.isPending || !editFields.name} className="rounded-xl bg-primary text-primary-foreground">
                {updateCampaignMut.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                <Save className="w-4 h-4 mr-2" /> Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showPostWarning} onOpenChange={setShowPostWarning}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Large Campaign Warning</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <p>
                This campaign would generate approximately <span className="font-bold text-primary">{estimatedPostCount.toLocaleString()}</span> posts, 
                but the maximum is <span className="font-bold">500 posts</span> per generation.
              </p>
              <p className="text-muted-foreground">
                To get all your posts, consider splitting this into smaller campaigns with fewer days, fewer posts per day, or fewer social accounts.
              </p>
              <div className="bg-secondary/50 rounded-lg p-3 text-xs text-muted-foreground">
                Current settings: {campaign?.durationDays} days x {campaign?.postsPerDay} posts/day x {campaign?.socialAccounts?.length || 0} accounts = {estimatedPostCount.toLocaleString()} posts
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowPostWarning(false)}>Cancel</Button>
              <Button onClick={() => { setShowPostWarning(false); doGenerate(); }}>
                Generate First 500
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
