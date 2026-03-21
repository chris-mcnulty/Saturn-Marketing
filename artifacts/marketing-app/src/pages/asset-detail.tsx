import React, { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout";
import {
  useGetAsset,
  useUpdateAsset,
  useExtractAssetContent,
  useListCategories,
  useCreateCampaign,
  useAddCampaignAsset,
  useListSocialAccounts,
  useAddCampaignSocialAccount,
  useGenerateCampaignPosts,
  getGetAssetQueryKey,
  getListAssetsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useRoute, Link, useLocation } from "wouter";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  ArrowLeft,
  Loader2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Save,
  X,
  Pencil,
  Link as LinkIcon,
  Calendar,
  Clock,
  Megaphone,
} from "lucide-react";
import { format } from "date-fns";

const editSchema = z.object({
  title: z.string().optional(),
  url: z.string().url("Must be a valid URL"),
  categoryId: z.coerce.number().optional().nullable(),
  isActive: z.boolean(),
  summaryText: z.string().optional().nullable(),
});

type EditFormValues = z.infer<typeof editSchema>;

function ExtractionStatusBadge({ status }: { status: string }) {
  const config: Record<string, { icon: React.ReactNode; className: string }> = {
    completed: {
      icon: <CheckCircle2 className="w-4 h-4" />,
      className: "bg-green-500/10 text-green-600 border-green-500/20",
    },
    pending: {
      icon: <div className="w-2 h-2 rounded-full bg-yellow-500" />,
      className: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
    },
    processing: {
      icon: <Loader2 className="w-4 h-4 animate-spin" />,
      className: "bg-primary/10 text-primary border-primary/20",
    },
    failed: {
      icon: <XCircle className="w-4 h-4" />,
      className: "bg-destructive/10 text-destructive border-destructive/20",
    },
  };

  const { icon, className } = config[status] || config.pending;

  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${className}`}>
      {icon}
      <span className="capitalize">{status}</span>
    </span>
  );
}

export default function AssetDetail() {
  const [, params] = useRoute("/assets/:id");
  const id = parseInt(params?.id || "0");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [isEditing, setIsEditing] = useState(false);
  const [isInstantCampaignOpen, setIsInstantCampaignOpen] = useState(false);
  const [instantDuration, setInstantDuration] = useState(14);
  const [isCreatingCampaign, setIsCreatingCampaign] = useState(false);

  const isValidId = Number.isFinite(id) && id > 0;
  const { data: asset, isLoading, error: fetchError } = useGetAsset(id, {
    query: { enabled: isValidId },
  });
  const { data: categories } = useListCategories();
  const updateMutation = useUpdateAsset();
  const extractMutation = useExtractAssetContent();
  const createCampaignMut = useCreateCampaign();
  const addCampaignAssetMut = useAddCampaignAsset();
  const { data: socialAccounts } = useListSocialAccounts();
  const addAccountMut = useAddCampaignSocialAccount();
  const generatePostsMut = useGenerateCampaignPosts();

  const handleInstantCampaign = async () => {
    if (!asset) return;
    setIsCreatingCampaign(true);
    try {
      const campaignName = `${asset.title || "Untitled"} Campaign`;
      const now = new Date();
      const startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const newCampaign = await createCampaignMut.mutateAsync({
        data: {
          name: campaignName,
          startDate,
          durationDays: instantDuration,
          postsPerDay: 2,
          postingTimes: "09:00,15:00",
        },
      });
      await addCampaignAssetMut.mutateAsync({
        id: newCampaign.id,
        data: { assetId: id },
      });
      if (socialAccounts && socialAccounts.length > 0) {
        for (const account of socialAccounts) {
          try {
            await addAccountMut.mutateAsync({
              id: newCampaign.id,
              data: { socialAccountId: account.id },
            });
          } catch { /* skip if linking fails */ }
        }
        generatePostsMut.mutate({ id: newCampaign.id });
        toast({ title: "Campaign created & post generation started!" });
      } else {
        toast({ title: "Campaign created! Add social accounts to generate posts." });
      }
      setIsInstantCampaignOpen(false);
      setLocation(`/campaigns/${newCampaign.id}`);
    } catch {
      toast({ title: "Failed to create campaign", variant: "destructive" });
    } finally {
      setIsCreatingCampaign(false);
    }
  };

  const form = useForm<EditFormValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      title: "",
      url: "",
      categoryId: null,
      isActive: true,
      summaryText: "",
    },
  });

  useEffect(() => {
    if (asset) {
      form.reset({
        title: asset.title || "",
        url: asset.url,
        categoryId: asset.categoryId || null,
        isActive: asset.isActive,
        summaryText: asset.summaryText || "",
      });
    }
  }, [asset, form]);

  const onSubmit = (data: EditFormValues) => {
    updateMutation.mutate(
      {
        id,
        data: {
          title: data.title || null,
          url: data.url,
          categoryId: data.categoryId || null,
          isActive: data.isActive,
          summaryText: data.summaryText || null,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetAssetQueryKey(id) });
          queryClient.invalidateQueries({ queryKey: getListAssetsQueryKey() });
          setIsEditing(false);
          toast({ title: "Asset updated successfully" });
        },
        onError: () => {
          toast({ title: "Failed to update asset", variant: "destructive" });
        },
      }
    );
  };

  const handleExtract = () => {
    extractMutation.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetAssetQueryKey(id) });
          queryClient.invalidateQueries({ queryKey: getListAssetsQueryKey() });
          toast({ title: "Content extraction triggered" });
        },
        onError: () => {
          toast({ title: "Extraction failed", variant: "destructive" });
        },
      }
    );
  };

  const handleCancelEdit = () => {
    if (asset) {
      form.reset({
        title: asset.title || "",
        url: asset.url,
        categoryId: asset.categoryId || null,
        isActive: asset.isActive,
        summaryText: asset.summaryText || "",
      });
    }
    setIsEditing(false);
  };

  if (!isValidId) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <p className="text-muted-foreground text-lg">Invalid asset link</p>
          <Link href="/assets">
            <Button variant="outline" className="rounded-xl">
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to Asset Library
            </Button>
          </Link>
        </div>
      </AppLayout>
    );
  }

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (fetchError) {
    const is404 = fetchError?.message?.includes("404") || fetchError?.message?.includes("not found");
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <p className="text-muted-foreground text-lg">
            {is404 ? "Asset not found" : "Failed to load asset"}
          </p>
          {!is404 && (
            <p className="text-sm text-muted-foreground">Please try again later.</p>
          )}
          <Link href="/assets">
            <Button variant="outline" className="rounded-xl">
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to Asset Library
            </Button>
          </Link>
        </div>
      </AppLayout>
    );
  }

  if (!asset) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <p className="text-muted-foreground text-lg">Asset not found</p>
          <Link href="/assets">
            <Button variant="outline" className="rounded-xl">
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to Asset Library
            </Button>
          </Link>
        </div>
      </AppLayout>
    );
  }

  const categoryName = asset.categoryName || categories?.find((c) => c.id === asset.categoryId)?.name;

  return (
    <AppLayout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/assets">
              <Button variant="ghost" size="icon" className="rounded-xl h-10 w-10">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-display font-bold text-foreground">
                {asset.title || "Untitled Asset"}
              </h1>
              <a
                href={asset.url}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-primary hover:underline flex items-center gap-1 mt-0.5"
              >
                {asset.url}
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="rounded-xl h-10"
              onClick={handleExtract}
              disabled={asset.extractionStatus === "processing" || extractMutation.isPending}
            >
              <RefreshCw
                className={`w-4 h-4 mr-2 ${
                  asset.extractionStatus === "processing" || extractMutation.isPending
                    ? "animate-spin"
                    : ""
                }`}
              />
              Re-extract Content
            </Button>
            <Button
              variant="outline"
              className="rounded-xl h-10"
              onClick={() => setIsInstantCampaignOpen(true)}
            >
              <Megaphone className="w-4 h-4 mr-2" /> Instant Campaign
            </Button>
            {!isEditing && (
              <Button
                className="rounded-xl h-10 bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:-translate-y-0.5 transition-all"
                onClick={() => setIsEditing(true)}
              >
                <Pencil className="w-4 h-4 mr-2" /> Edit
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 flex flex-col gap-6">
            {isEditing ? (
              <Card className="rounded-2xl border-border/50 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg font-display">Edit Asset</CardTitle>
                </CardHeader>
                <CardContent>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                      <FormField
                        control={form.control}
                        name="title"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Title</FormLabel>
                            <FormControl>
                              <Input placeholder="Asset title" className="rounded-xl" {...field} value={field.value || ""} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="url"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>URL</FormLabel>
                            <FormControl>
                              <Input placeholder="https://..." className="rounded-xl" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="categoryId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Category</FormLabel>
                            <FormControl>
                              <select
                                className="w-full h-10 px-3 py-2 rounded-xl border border-input bg-background text-sm"
                                onChange={(e) =>
                                  field.onChange(e.target.value ? Number(e.target.value) : null)
                                }
                                value={field.value || ""}
                              >
                                <option value="">No category</option>
                                {categories?.map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.name}
                                  </option>
                                ))}
                              </select>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="isActive"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Status</FormLabel>
                            <FormControl>
                              <div className="flex items-center gap-3">
                                <button
                                  type="button"
                                  onClick={() => field.onChange(!field.value)}
                                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                    field.value ? "bg-green-500" : "bg-muted"
                                  }`}
                                >
                                  <span
                                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                      field.value ? "translate-x-6" : "translate-x-1"
                                    }`}
                                  />
                                </button>
                                <span className="text-sm text-muted-foreground">
                                  {field.value ? "Active" : "Inactive"}
                                </span>
                              </div>
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="summaryText"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>AI Summary</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="AI-generated summary text..."
                                className="rounded-xl min-h-[120px]"
                                {...field}
                                value={field.value || ""}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="flex items-center gap-3 pt-2">
                        <Button
                          type="submit"
                          disabled={updateMutation.isPending}
                          className="rounded-xl bg-primary text-primary-foreground"
                        >
                          {updateMutation.isPending && (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          )}
                          <Save className="w-4 h-4 mr-2" /> Save Changes
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="rounded-xl"
                          onClick={handleCancelEdit}
                        >
                          <X className="w-4 h-4 mr-2" /> Cancel
                        </Button>
                      </div>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            ) : (
              <>
                <Card className="rounded-2xl border-border/50 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-lg font-display">Details</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <dl className="space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4">
                        <dt className="text-sm font-medium text-muted-foreground w-32 shrink-0">Title</dt>
                        <dd className="text-sm text-foreground">{asset.title || "—"}</dd>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4">
                        <dt className="text-sm font-medium text-muted-foreground w-32 shrink-0">URL</dt>
                        <dd className="text-sm">
                          <a
                            href={asset.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary hover:underline flex items-center gap-1 break-all"
                          >
                            {asset.url}
                            <ExternalLink className="w-3 h-3 shrink-0" />
                          </a>
                        </dd>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                        <dt className="text-sm font-medium text-muted-foreground w-32 shrink-0">Category</dt>
                        <dd className="text-sm text-foreground">{categoryName || "—"}</dd>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                        <dt className="text-sm font-medium text-muted-foreground w-32 shrink-0">Status</dt>
                        <dd>
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-medium ${
                              asset.isActive
                                ? "bg-green-500/10 text-green-600"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {asset.isActive ? "Active" : "Inactive"}
                          </span>
                        </dd>
                      </div>
                    </dl>
                  </CardContent>
                </Card>

                <Card className="rounded-2xl border-border/50 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-lg font-display">AI Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {asset.summaryText ? (
                      <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                        {asset.summaryText}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">
                        No summary available. Click "Re-extract Content" to generate one.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </div>

          <div className="flex flex-col gap-6">
            <Card className="rounded-2xl border-border/50 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-display">Suggested Image</CardTitle>
              </CardHeader>
              <CardContent>
                {asset.suggestedImageUrl ? (
                  <div className="rounded-xl overflow-hidden border border-border/50">
                    <img
                      src={asset.suggestedImageUrl}
                      alt={asset.title || "Suggested image"}
                      className="w-full h-auto object-cover"
                    />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground rounded-xl border-2 border-dashed border-border/50">
                    <LinkIcon className="w-8 h-8 mb-2 opacity-50" />
                    <p className="text-sm">No image available</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-border/50 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-display">Extraction</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Status</span>
                    <ExtractionStatusBadge status={asset.extractionStatus} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-border/50 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-display">Timestamps</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Created:</span>
                    <span className="text-foreground">
                      {format(new Date(asset.createdAt), "MMM d, yyyy 'at' h:mm a")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Updated:</span>
                    <span className="text-foreground">
                      {format(new Date(asset.updatedAt), "MMM d, yyyy 'at' h:mm a")}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <Dialog open={isInstantCampaignOpen} onOpenChange={setIsInstantCampaignOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-xl font-display">Instant Campaign</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">
                Create a campaign for <span className="font-semibold text-foreground">{asset.title || "this asset"}</span> with default settings. You can customize everything on the campaign page afterward.
              </p>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Campaign Duration (Days)</label>
                <Input
                  type="number"
                  min={1}
                  max={365}
                  value={instantDuration}
                  onChange={e => setInstantDuration(parseInt(e.target.value) || 14)}
                  className="rounded-xl h-11"
                />
                <p className="text-xs text-muted-foreground mt-1">Defaults: 2 posts/day at 9:00 AM and 3:00 PM, starting today.</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsInstantCampaignOpen(false)} className="rounded-xl">Cancel</Button>
              <Button onClick={handleInstantCampaign} disabled={isCreatingCampaign} className="rounded-xl bg-primary text-primary-foreground">
                {isCreatingCampaign && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                <Megaphone className="w-4 h-4 mr-2" /> Create Campaign
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
