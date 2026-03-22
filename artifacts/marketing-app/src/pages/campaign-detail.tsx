import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { AppLayout } from "@/components/layout";
import { 
  useGetCampaign, 
  useUpdateCampaign, 
  useDeleteCampaign,
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
  useUpdateGeneratedPost,
  useDeleteGeneratedPost,
  useDeleteAllGeneratedPosts,
  useListBrandAssets,
  useListBrandAssetCategories,
  getGetCampaignQueryKey,
  getListCampaignsQueryKey,
  getListGeneratedPostsQueryKey,
  getGeneratePostsStatus,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, Plus, Download, Wand2, Link as LinkIcon, Trash2, Edit, Pencil, Save, X, Search, Image as ImageIcon, RotateCcw } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Link } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import * as DialogPrimitive from "@radix-ui/react-dialog";

export default function CampaignDetail() {
  const [, params] = useRoute("/campaigns/:id");
  const id = parseInt(params?.id || "0");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const { data: campaign, isLoading } = useGetCampaign(id);
  const deleteCampaignMut = useDeleteCampaign();
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
  const updatePostMut = useUpdateGeneratedPost();
  const deletePostMut = useDeleteGeneratedPost();
  const deleteAllPostsMut = useDeleteAllGeneratedPosts();

  const [editingPostId, setEditingPostId] = useState<number | null>(null);
  const [editPostContent, setEditPostContent] = useState("");
  const [editPostTags, setEditPostTags] = useState("");

  const [isOverrideDialogOpen, setIsOverrideDialogOpen] = useState(false);
  const [overrideAssetId, setOverrideAssetId] = useState<number | null>(null);
  const [overrideImageUrl, setOverrideImageUrl] = useState("");
  const [overrideSummaryText, setOverrideSummaryText] = useState("");
  const [originalImageUrl, setOriginalImageUrl] = useState("");
  const [originalSummaryText, setOriginalSummaryText] = useState("");
  const [brandAssetSearch, setBrandAssetSearch] = useState("");
  const [brandAssetCategoryFilter, setBrandAssetCategoryFilter] = useState<string>("all");
  const [showBrandPicker, setShowBrandPicker] = useState(false);

  const { data: brandAssets } = useListBrandAssets();
  const { data: brandCategories } = useListBrandAssetCategories();

  const filteredBrandAssets = useMemo(() => {
    if (!brandAssets) return [];
    let filtered = brandAssets;
    if (brandAssetCategoryFilter === "uncategorized") {
      filtered = filtered.filter(a => !a.categoryId);
    } else if (brandAssetCategoryFilter !== "all") {
      filtered = filtered.filter(a => a.categoryId === Number(brandAssetCategoryFilter));
    }
    if (brandAssetSearch.trim()) {
      const q = brandAssetSearch.toLowerCase();
      filtered = filtered.filter(a =>
        (a.title && a.title.toLowerCase().includes(q)) ||
        (a.description && a.description.toLowerCase().includes(q)) ||
        (a.tags && a.tags.toLowerCase().includes(q))
      );
    }
    return filtered;
  }, [brandAssets, brandAssetCategoryFilter, brandAssetSearch]);

  const openOverrideDialog = (ca: { assetId: number; overrideImageUrl: string | null; overrideSummaryText: string | null; asset: { suggestedImageUrl: string | null; summaryText: string | null } }) => {
    setOverrideAssetId(ca.assetId);
    setOverrideImageUrl(ca.overrideImageUrl ?? ca.asset.suggestedImageUrl ?? "");
    setOverrideSummaryText(ca.overrideSummaryText ?? ca.asset.summaryText ?? "");
    setOriginalImageUrl(ca.asset.suggestedImageUrl || "");
    setOriginalSummaryText(ca.asset.summaryText || "");
    setBrandAssetSearch("");
    setBrandAssetCategoryFilter("all");
    setShowBrandPicker(false);
    setIsOverrideDialogOpen(true);
  };

  const handleSaveOverride = () => {
    if (overrideAssetId === null) return;
    const hasImageOverride = overrideImageUrl !== originalImageUrl;
    const hasSummaryOverride = overrideSummaryText !== originalSummaryText;
    updateAssetMut.mutate({
      campaignId: id,
      assetId: overrideAssetId,
      data: {
        overrideImageUrl: hasImageOverride ? (overrideImageUrl.trim() || null) : null,
        overrideSummaryText: hasSummaryOverride ? (overrideSummaryText.trim() || null) : null,
      },
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCampaignQueryKey(id) });
        setIsOverrideDialogOpen(false);
        toast({ title: "Asset override saved" });
      },
      onError: () => {
        toast({ title: "Failed to save override", variant: "destructive" });
      },
    });
  };

  const handleClearOverride = () => {
    if (overrideAssetId === null) return;
    updateAssetMut.mutate({
      campaignId: id,
      assetId: overrideAssetId,
      data: {
        overrideImageUrl: null,
        overrideSummaryText: null,
      },
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCampaignQueryKey(id) });
        setIsOverrideDialogOpen(false);
        toast({ title: "Override cleared — reverted to original" });
      },
      onError: () => {
        toast({ title: "Failed to clear override", variant: "destructive" });
      },
    });
  };
  const [isDeleteAllPostsOpen, setIsDeleteAllPostsOpen] = useState(false);

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
  const [editTimeSlots, setEditTimeSlots] = useState<string[]>(["09:00"]);

  const getExclusiveMax = (endTime: string | undefined) => {
    if (!endTime) return undefined;
    const [h, m] = endTime.split(":").map(Number);
    const totalMins = h * 60 + m - 1;
    if (totalMins < 0) return undefined;
    return `${String(Math.floor(totalMins / 60)).padStart(2, "0")}:${String(totalMins % 60).padStart(2, "0")}`;
  };
  const [editFields, setEditFields] = useState({
    name: "", description: "", startDate: "", durationDays: 7,
    postsPerDay: 1, postingTimes: "", hashtags: "",
    businessHoursOnly: false, businessHoursStart: "09:00", businessHoursEnd: "17:00",
    includeSaturday: true, includeSunday: true,
  });

  useEffect(() => {
    if (savedPosts && savedPosts.length > 0) {
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
    let startDateStr: string;
    if (typeof campaign.startDate === "string") {
      startDateStr = campaign.startDate.split("T")[0];
    } else {
      const d = new Date(campaign.startDate);
      startDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }
    const times = (campaign.postingTimes || "09:00").split(",").map((t: string) => t.trim()).filter(Boolean);
    setEditTimeSlots(times.length > 0 ? times : ["09:00"]);
    setEditFields({
      name: campaign.name,
      description: campaign.description || "",
      startDate: startDateStr,
      durationDays: campaign.durationDays,
      postsPerDay: campaign.postsPerDay,
      postingTimes: campaign.postingTimes || "",
      hashtags: campaign.hashtags || "",
      businessHoursOnly: campaign.businessHoursOnly ?? false,
      businessHoursStart: campaign.businessHoursStart || "09:00",
      businessHoursEnd: campaign.businessHoursEnd || "17:00",
      includeSaturday: campaign.includeSaturday ?? true,
      includeSunday: campaign.includeSunday ?? true,
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
      postingTimes: editTimeSlots.join(",") || undefined,
      hashtags: editFields.hashtags || undefined,
      businessHoursOnly: editFields.businessHoursOnly,
      businessHoursStart: editFields.businessHoursStart,
      businessHoursEnd: editFields.businessHoursEnd,
      includeSaturday: editFields.includeSaturday,
      includeSunday: editFields.includeSunday,
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
              queryClient.invalidateQueries({ queryKey: getListGeneratedPostsQueryKey(id) });
              setGeneratedPosts(null);
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
              <Button
                variant="outline"
                className="h-11 rounded-xl text-destructive hover:bg-destructive/10 border-destructive/30"
                onClick={() => setIsDeleteOpen(true)}
              >
                <Trash2 className="w-4 h-4 mr-2" /> Delete
              </Button>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-x-8 gap-y-4 mt-8 pt-6 border-t border-border/50 text-sm">
            <div><span className="text-muted-foreground">Start:</span> <span className="font-semibold">{typeof campaign.startDate === "string" ? campaign.startDate.split("T")[0] : campaign.startDate}</span></div>
            <div><span className="text-muted-foreground">Duration:</span> <span className="font-semibold">{campaign.durationDays} days</span></div>
            <div><span className="text-muted-foreground">Freq:</span> <span className="font-semibold">{campaign.postsPerDay}/day</span></div>
            {campaign.postingTimes && <div><span className="text-muted-foreground">Times:</span> <span className="font-semibold">{campaign.postingTimes}</span></div>}
            {campaign.businessHoursOnly && <div><span className="text-muted-foreground">Hours:</span> <span className="font-semibold">{campaign.businessHoursStart}–{campaign.businessHoursEnd}</span></div>}
            <div><span className="text-muted-foreground">Days:</span> <span className="font-semibold">Mon–Fri{campaign.includeSaturday ? ', Sat' : ''}{campaign.includeSunday ? ', Sun' : ''}</span></div>
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
                        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary" onClick={() => openOverrideDialog(ca)}><Edit className="w-4 h-4" /></Button>
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
              <div className="flex justify-between items-center flex-wrap gap-2">
                <h3 className="text-lg font-semibold">Post Previews <span className="text-sm font-normal text-muted-foreground">({posts.length})</span></h3>
                {posts.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button variant="outline" size="sm" className="rounded-xl text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => setIsDeleteAllPostsOpen(true)}>
                      <Trash2 className="w-4 h-4 mr-1" /> Delete All
                    </Button>
                    <Button variant="outline" size="sm" className="rounded-xl" onClick={handleGenerate} disabled={isGenerating}>
                      <Wand2 className="w-4 h-4 mr-1" /> Regenerate
                    </Button>
                    <select
                      value={exportFormat}
                      onChange={(e) => setExportFormat(e.target.value)}
                      className="h-9 px-3 rounded-xl border border-input bg-background text-sm font-medium"
                    >
                      {exportFormats.map(f => (
                        <option key={f.value} value={f.value}>{f.label}</option>
                      ))}
                    </select>
                    <Button onClick={handleExport} disabled={isExporting} size="sm" className="rounded-xl bg-green-600 hover:bg-green-700 text-white">
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
                    <Card key={post.id ?? i} className="p-4 rounded-2xl border-border/50">
                      {editingPostId === post.id ? (
                        <div className="space-y-3">
                          <div className="flex justify-between items-start text-xs text-muted-foreground font-medium">
                            <span className="bg-primary/10 text-primary px-2 py-1 rounded-md">{post.dateTime}</span>
                            <span>Acct: {post.accountId}</span>
                          </div>
                          <textarea
                            className="w-full min-h-[120px] p-3 rounded-xl border border-input bg-background text-sm resize-y"
                            value={editPostContent}
                            onChange={(e) => setEditPostContent(e.target.value)}
                          />
                          <Input
                            placeholder="Tags (semicolon-separated)"
                            value={editPostTags}
                            onChange={(e) => setEditPostTags(e.target.value)}
                            className="rounded-xl"
                          />
                          <div className="flex gap-2 justify-end">
                            <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setEditingPostId(null)}>
                              <X className="w-4 h-4 mr-1" /> Cancel
                            </Button>
                            <Button size="sm" className="rounded-xl" disabled={updatePostMut.isPending} onClick={() => {
                              updatePostMut.mutate({ id, postId: post.id, data: { postContent: editPostContent, tags: editPostTags || null } }, {
                                onSuccess: (updated) => {
                                  setGeneratedPosts(prev => (prev || []).map(p => p.id === post.id ? { ...p, postContent: updated.postContent, tags: updated.tags } : p));
                                  queryClient.invalidateQueries({ queryKey: getListGeneratedPostsQueryKey(id) });
                                  setEditingPostId(null);
                                  toast({ title: "Post updated" });
                                },
                                onError: () => toast({ title: "Failed to update post", variant: "destructive" }),
                              });
                            }}>
                              {updatePostMut.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                              <Save className="w-4 h-4 mr-1" /> Save
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col md:flex-row gap-4">
                          {post.imageUrls && (
                            <div className="w-full md:w-32 aspect-video md:aspect-square bg-secondary rounded-xl overflow-hidden shrink-0">
                              <img src={post.imageUrls.split(';')[0]} className="w-full h-full object-cover" />
                            </div>
                          )}
                          <div className="flex-1">
                            <div className="flex justify-between items-start mb-2 text-xs text-muted-foreground font-medium">
                              <span className="bg-primary/10 text-primary px-2 py-1 rounded-md">{post.dateTime}</span>
                              <div className="flex items-center gap-2">
                                <span>Acct: {post.accountId}</span>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                                  setEditingPostId(post.id);
                                  setEditPostContent(post.postContent);
                                  setEditPostTags(post.tags || "");
                                }}>
                                  <Pencil className="w-3.5 h-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" disabled={deletePostMut.isPending} onClick={() => {
                                  deletePostMut.mutate({ id, postId: post.id }, {
                                    onSuccess: () => {
                                      setGeneratedPosts(prev => (prev || []).filter(p => p.id !== post.id));
                                      queryClient.invalidateQueries({ queryKey: getListGeneratedPostsQueryKey(id) });
                                      toast({ title: "Post deleted" });
                                    },
                                    onError: () => toast({ title: "Failed to delete post", variant: "destructive" }),
                                  });
                                }}>
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
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
                      )}
                    </Card>
                  ))}
                </div>
              ) : null}

              <Dialog open={isDeleteAllPostsOpen} onOpenChange={setIsDeleteAllPostsOpen}>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Delete All Posts</DialogTitle>
                  </DialogHeader>
                  <p className="text-sm text-muted-foreground">
                    Are you sure you want to delete all {posts.length} generated posts? This action cannot be undone.
                  </p>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsDeleteAllPostsOpen(false)} className="rounded-xl">Cancel</Button>
                    <Button
                      variant="destructive"
                      className="rounded-xl"
                      disabled={deleteAllPostsMut.isPending}
                      onClick={() => {
                        deleteAllPostsMut.mutate({ id }, {
                          onSuccess: () => {
                            setGeneratedPosts([]);
                            queryClient.invalidateQueries({ queryKey: getListGeneratedPostsQueryKey(id) });
                            setIsDeleteAllPostsOpen(false);
                            toast({ title: "All posts deleted" });
                          },
                          onError: () => toast({ title: "Failed to delete posts", variant: "destructive" }),
                        });
                      }}
                    >
                      {deleteAllPostsMut.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      <Trash2 className="w-4 h-4 mr-2" /> Delete All
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
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
              <div className="md:col-span-2 space-y-2">
                <Label className="text-sm font-medium">Posting Times</Label>
                <div className="space-y-2">
                  {editTimeSlots.map((slot, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Input
                        type="time"
                        value={slot}
                        min={editFields.businessHoursOnly ? editFields.businessHoursStart : undefined}
                        max={editFields.businessHoursOnly ? getExclusiveMax(editFields.businessHoursEnd) : undefined}
                        onChange={(e) => {
                          const updated = [...editTimeSlots];
                          updated[idx] = e.target.value;
                          setEditTimeSlots(updated);
                        }}
                        className="rounded-xl h-11 w-40"
                      />
                      {editTimeSlots.length > 1 && (
                        <Button type="button" variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 h-9 w-9" onClick={() => setEditTimeSlots(editTimeSlots.filter((_, i) => i !== idx))}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={() => setEditTimeSlots([...editTimeSlots, "12:00"])}>
                    <Plus className="w-3 h-3 mr-1" /> Add Time Slot
                  </Button>
                </div>
              </div>

              <div className="md:col-span-2 space-y-4 rounded-xl border border-border/50 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium">Business Hours Only</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">Restrict posting to business hours</p>
                  </div>
                  <Switch checked={editFields.businessHoursOnly} onCheckedChange={(v) => setEditFields(f => ({...f, businessHoursOnly: v}))} />
                </div>
                {editFields.businessHoursOnly && (
                  <div className="flex items-center gap-3 pl-1">
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground">From</Label>
                      <Input type="time" value={editFields.businessHoursStart} onChange={e => setEditFields(f => ({...f, businessHoursStart: e.target.value}))} className="rounded-xl h-9 w-32" />
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground">To</Label>
                      <Input type="time" value={editFields.businessHoursEnd} onChange={e => setEditFields(f => ({...f, businessHoursEnd: e.target.value}))} className="rounded-xl h-9 w-32" />
                    </div>
                  </div>
                )}
              </div>

              <div className="md:col-span-2 space-y-3">
                <Label className="text-sm font-medium">Weekend Scheduling</Label>
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <Checkbox id="edit-sat" checked={editFields.includeSaturday} onCheckedChange={(v) => setEditFields(f => ({...f, includeSaturday: !!v}))} />
                    <Label htmlFor="edit-sat" className="text-sm cursor-pointer">Include Saturday</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox id="edit-sun" checked={editFields.includeSunday} onCheckedChange={(v) => setEditFields(f => ({...f, includeSunday: !!v}))} />
                    <Label htmlFor="edit-sun" className="text-sm cursor-pointer">Include Sunday</Label>
                  </div>
                </div>
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

        <DialogPrimitive.Root open={isOverrideDialogOpen} onOpenChange={setIsOverrideDialogOpen}>
          <DialogPrimitive.Portal>
            <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
            <DialogPrimitive.Content className="fixed left-[50%] top-[50%] z-50 w-full max-w-2xl translate-x-[-50%] translate-y-[-50%] border bg-background p-6 shadow-2xl duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out sm:rounded-2xl max-h-[90vh] overflow-y-auto">
              <DialogPrimitive.Title className="text-xl font-display font-bold">Edit Asset Override</DialogPrimitive.Title>
              <p className="text-sm text-muted-foreground mt-1">Customize the image and summary for this campaign asset.</p>

              <div className="space-y-5 mt-5">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Image Preview</label>
                  <div className="w-full h-40 rounded-xl bg-secondary overflow-hidden flex items-center justify-center">
                    {overrideImageUrl ? (
                      <img src={overrideImageUrl} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <ImageIcon className="w-8 h-8" />
                        <span className="text-xs">No image set</span>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-1.5 block">Override Image URL</label>
                  <Input
                    value={overrideImageUrl}
                    onChange={(e) => setOverrideImageUrl(e.target.value)}
                    placeholder="https://..."
                    className="rounded-xl"
                  />
                </div>

                <div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-xl"
                    onClick={() => setShowBrandPicker(!showBrandPicker)}
                  >
                    <ImageIcon className="w-4 h-4 mr-2" />
                    {showBrandPicker ? "Hide Brand Assets" : "Browse Brand Assets"}
                  </Button>

                  {showBrandPicker && (
                    <div className="mt-3 border rounded-xl p-3 bg-secondary/20">
                      <div className="flex flex-col sm:flex-row gap-2 mb-3">
                        <div className="relative flex-1">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            placeholder="Search brand assets..."
                            value={brandAssetSearch}
                            onChange={(e) => setBrandAssetSearch(e.target.value)}
                            className="pl-9 h-9 rounded-lg bg-background text-sm"
                          />
                        </div>
                        {brandCategories && brandCategories.length > 0 && (
                          <select
                            value={brandAssetCategoryFilter}
                            onChange={(e) => setBrandAssetCategoryFilter(e.target.value)}
                            className="h-9 rounded-lg border bg-background px-2 text-sm"
                          >
                            <option value="all">All Categories</option>
                            {brandCategories.map(cat => (
                              <option key={cat.id} value={String(cat.id)}>{cat.name}</option>
                            ))}
                            <option value="uncategorized">Uncategorized</option>
                          </select>
                        )}
                      </div>

                      {!brandAssets ? (
                        <div className="flex items-center justify-center py-6">
                          <Loader2 className="w-5 h-5 animate-spin text-primary" />
                        </div>
                      ) : filteredBrandAssets.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-6">No brand assets found.</p>
                      ) : (
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-48 overflow-y-auto">
                          {filteredBrandAssets.map(asset => (
                            <button
                              key={asset.id}
                              type="button"
                              onClick={() => {
                                setOverrideImageUrl(asset.imageUrl);
                                setShowBrandPicker(false);
                              }}
                              className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all hover:border-primary hover:shadow-md ${
                                overrideImageUrl === asset.imageUrl ? "border-primary ring-2 ring-primary/30" : "border-transparent"
                              }`}
                            >
                              <img src={asset.imageUrl} alt={asset.title || "Brand asset"} className="w-full h-full object-cover" />
                              {asset.title && (
                                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-1">
                                  <span className="text-[10px] text-white font-medium truncate block">{asset.title}</span>
                                </div>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-sm font-medium mb-1.5 block">Override Summary Text</label>
                  <textarea
                    value={overrideSummaryText}
                    onChange={(e) => setOverrideSummaryText(e.target.value)}
                    placeholder="Custom summary text..."
                    rows={3}
                    className="flex w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between mt-6">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-foreground rounded-xl"
                  onClick={handleClearOverride}
                  disabled={updateAssetMut.isPending}
                >
                  <RotateCcw className="w-4 h-4 mr-2" /> Clear All Overrides
                </Button>
                <div className="flex gap-3">
                  <Button type="button" variant="outline" onClick={() => setIsOverrideDialogOpen(false)} className="rounded-xl">Cancel</Button>
                  <Button
                    onClick={handleSaveOverride}
                    disabled={updateAssetMut.isPending}
                    className="rounded-xl bg-primary text-primary-foreground"
                  >
                    {updateAssetMut.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Save Override
                  </Button>
                </div>
              </div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        </DialogPrimitive.Root>

        <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Delete Campaign</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete <span className="font-semibold text-foreground">{campaign.name}</span>? This will permanently remove the campaign, all linked assets, social accounts, and generated posts. This action cannot be undone.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDeleteOpen(false)} className="rounded-xl">Cancel</Button>
              <Button
                variant="destructive"
                className="rounded-xl"
                disabled={deleteCampaignMut.isPending}
                onClick={() => {
                  deleteCampaignMut.mutate(
                    { id },
                    {
                      onSuccess: () => {
                        queryClient.invalidateQueries({ queryKey: getListCampaignsQueryKey() });
                        toast({ title: "Campaign deleted" });
                        setLocation("/campaigns");
                      },
                      onError: () => {
                        toast({ title: "Failed to delete campaign", variant: "destructive" });
                      },
                    },
                  );
                }}
              >
                {deleteCampaignMut.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                <Trash2 className="w-4 h-4 mr-2" /> Delete Campaign
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
