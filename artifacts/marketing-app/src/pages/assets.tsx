import React, { useState, useRef } from "react";
import { AppLayout } from "@/components/layout";
import { 
  useListAssets, 
  useCreateAsset, 
  useDeleteAsset, 
  useExtractAssetContent,
  useUpdateAsset,
  useListCategories,
  getListAssetsQueryKey,
  useImportAssetsCsv,
  useConfirmAssetsImport,
} from "@workspace/api-client-react";
import type { ImportCsvRow, ImportCsvValidationResult, CategoryDecision } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2, Plus, Search, Link as LinkIcon, Trash2, Edit, RefreshCw, CheckCircle2, XCircle, Eye, Download, Upload, Filter, X } from "lucide-react";
import { format, isAfter, isBefore, startOfDay, endOfDay, parseISO } from "date-fns";
import { useLocation } from "wouter";

const createSchema = z.object({
  url: z.string().url("Must be a valid URL"),
  title: z.string().optional(),
  categoryId: z.coerce.number().optional(),
});

export default function Assets() {
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [filterDateFrom, setFilterDateFrom] = useState<string>("");
  const [filterDateTo, setFilterDateTo] = useState<string>("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importValidation, setImportValidation] = useState<ImportCsvValidationResult | null>(null);
  const [categoryDecisions, setCategoryDecisions] = useState<Record<string, "create" | "skip">>({});
  const [importResult, setImportResult] = useState<{ created: number; skipped: number; failed: number; errors: string[] } | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  const { data: assets, isLoading } = useListAssets();
  const { data: categories } = useListCategories();
  
  const createMutation = useCreateAsset();
  const deleteMutation = useDeleteAsset();
  const extractMutation = useExtractAssetContent();
  const updateMutation = useUpdateAsset();
  const importCsvMutation = useImportAssetsCsv();
  const confirmImportMutation = useConfirmAssetsImport();

  const form = useForm<z.infer<typeof createSchema>>({
    resolver: zodResolver(createSchema),
    defaultValues: { url: "", title: "" },
  });

  const onSubmit = (data: z.infer<typeof createSchema>) => {
    createMutation.mutate({ data }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAssetsQueryKey() });
        setIsCreateOpen(false);
        form.reset();
        toast({ title: "Asset added" });
      },
      onError: () => {
        toast({ title: "Failed to add asset", variant: "destructive" });
      }
    });
  };

  const handleExtract = (id: number) => {
    extractMutation.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAssetsQueryKey() });
        toast({ title: "Extraction triggered successfully" });
      },
      onError: () => {
        toast({ title: "Extraction failed", variant: "destructive" });
      }
    });
  };

  const toggleActive = (id: number, currentActive: boolean) => {
    updateMutation.mutate({ id, data: { isActive: !currentActive } }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListAssetsQueryKey() })
    });
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}api/assets/export-csv`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Export failed");
      const csvText = await response.text();
      const blob = new Blob([csvText], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "assets_export.csv";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "CSV exported successfully" });
    } catch {
      toast({ title: "Failed to export CSV", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    importCsvMutation.mutate({ data: { csvContent: text } }, {
      onSuccess: (result) => {
        setImportValidation(result);
        const decisions: Record<string, "create" | "skip"> = {};
        for (const cat of result.unknownCategories) {
          decisions[cat] = "create";
        }
        setCategoryDecisions(decisions);
        setImportResult(null);
        setIsImportDialogOpen(true);
      },
      onError: () => {
        toast({ title: "Failed to parse CSV file", variant: "destructive" });
      }
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleConfirmImport = () => {
    if (!importValidation) return;

    const decisions: CategoryDecision[] = Object.entries(categoryDecisions).map(
      ([categoryName, action]) => ({ categoryName, action })
    );

    confirmImportMutation.mutate({
      data: {
        rows: importValidation.validRows,
        categoryDecisions: decisions,
      }
    }, {
      onSuccess: (result) => {
        setImportResult(result);
        queryClient.invalidateQueries({ queryKey: getListAssetsQueryKey() });
      },
      onError: () => {
        toast({ title: "Import failed", variant: "destructive" });
      }
    });
  };

  const hasActiveFilters = filterCategory !== "" || filterDateFrom !== "" || filterDateTo !== "";

  const clearFilters = () => {
    setFilterCategory("");
    setFilterDateFrom("");
    setFilterDateTo("");
  };

  const filteredAssets = assets?.filter(a => {
    const matchesSearch = a.url.toLowerCase().includes(search.toLowerCase()) || 
      (a.title && a.title.toLowerCase().includes(search.toLowerCase()));
    
    const matchesCategory = filterCategory === "" || 
      (filterCategory === "uncategorized" ? !a.categoryId : String(a.categoryId) === filterCategory);
    
    let matchesDate = true;
    if (filterDateFrom) {
      const fromDate = startOfDay(parseISO(filterDateFrom));
      matchesDate = matchesDate && isAfter(new Date(a.createdAt), fromDate);
    }
    if (filterDateTo) {
      const toDate = endOfDay(parseISO(filterDateTo));
      matchesDate = matchesDate && isBefore(new Date(a.createdAt), toDate);
    }

    return matchesSearch && matchesCategory && matchesDate;
  });

  return (
    <AppLayout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Asset Library</h1>
            <p className="text-muted-foreground mt-1">Manage web content used to generate posts.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleExport}
              disabled={isExporting}
              className="rounded-xl px-4 h-11"
            >
              {isExporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
              Export CSV
            </Button>
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={importCsvMutation.isPending}
              className="rounded-xl px-4 h-11"
            >
              {importCsvMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
              Import CSV
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleFileSelect}
            />
            <Button onClick={() => setIsCreateOpen(true)} className="rounded-xl px-6 h-11 bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:-translate-y-0.5 transition-all">
              <Plus className="w-4 h-4 mr-2" /> Add Asset
            </Button>
          </div>
        </div>

        <Card className="rounded-2xl border-border/50 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-border/50 bg-secondary/20 space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder="Search assets..." 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-11 rounded-xl bg-background"
                />
              </div>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="h-11 px-3 rounded-xl border border-input bg-background text-sm min-w-[160px]"
              >
                <option value="">All Categories</option>
                <option value="uncategorized">Uncategorized</option>
                {categories?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={filterDateFrom}
                  onChange={(e) => setFilterDateFrom(e.target.value)}
                  placeholder="From"
                  className="h-11 rounded-xl bg-background w-[150px] text-sm"
                />
                <span className="text-muted-foreground text-sm">to</span>
                <Input
                  type="date"
                  value={filterDateTo}
                  onChange={(e) => setFilterDateTo(e.target.value)}
                  placeholder="To"
                  className="h-11 rounded-xl bg-background w-[150px] text-sm"
                />
              </div>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="h-11 px-3 text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4 mr-1" /> Clear
                </Button>
              )}
            </div>
            {hasActiveFilters && (
              <p className="text-xs text-muted-foreground">
                Showing {filteredAssets?.length ?? 0} of {assets?.length ?? 0} assets
              </p>
            )}
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-secondary/40 text-muted-foreground uppercase text-xs font-semibold tracking-wider">
                <tr>
                  <th className="px-6 py-4">Content</th>
                  <th className="px-6 py-4">Category</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">AI Extraction</th>
                  <th className="px-6 py-4">Added</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {isLoading ? (
                  <tr><td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">Loading assets...</td></tr>
                ) : filteredAssets?.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center">
                        <img src={`${import.meta.env.BASE_URL}images/empty-state.png`} className="w-32 h-32 opacity-50 mb-4" alt="Empty" />
                        <p className="text-muted-foreground font-medium">No assets found</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredAssets?.map(asset => (
                    <tr key={asset.id} className="hover:bg-secondary/20 transition-colors cursor-pointer" onClick={() => navigate(`/assets/${asset.id}`)}>
                      <td className="px-6 py-4 max-w-[300px]">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center shrink-0 overflow-hidden">
                            {asset.suggestedImageUrl ? (
                              <img src={asset.suggestedImageUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <LinkIcon className="w-4 h-4 text-muted-foreground" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-foreground truncate">{asset.title || "Untitled Asset"}</p>
                            <a href={asset.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-xs text-primary hover:underline truncate block max-w-xs">
                              {asset.url}
                            </a>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {asset.categoryName ? (
                          <span className="px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                            {asset.categoryName}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <button 
                          onClick={(e) => { e.stopPropagation(); toggleActive(asset.id, asset.isActive); }}
                          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                            asset.isActive ? "bg-green-500/10 text-green-600 hover:bg-green-500/20" : "bg-muted text-muted-foreground hover:bg-muted/80"
                          }`}
                        >
                          {asset.isActive ? "Active" : "Inactive"}
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {asset.extractionStatus === 'completed' && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                          {asset.extractionStatus === 'pending' && <div className="w-2 h-2 rounded-full bg-yellow-500" />}
                          {asset.extractionStatus === 'processing' && <Loader2 className="w-4 h-4 text-primary animate-spin" />}
                          {asset.extractionStatus === 'failed' && <XCircle className="w-4 h-4 text-destructive" />}
                          <span className="text-xs font-medium capitalize">{asset.extractionStatus}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {format(new Date(asset.createdAt), "MMM d, yyyy")}
                      </td>
                      <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 text-xs font-medium"
                            onClick={() => handleExtract(asset.id)}
                            disabled={asset.extractionStatus === 'processing' || extractMutation.isPending}
                          >
                            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${asset.extractionStatus === 'processing' ? 'animate-spin' : ''}`} /> 
                            Extract
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 text-xs font-medium"
                            onClick={() => navigate(`/assets/${asset.id}`)}
                          >
                            <Eye className="w-3.5 h-3.5 mr-1.5" /> View
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => {
                              if(confirm('Delete this asset?')) {
                                deleteMutation.mutate({ id: asset.id }, {
                                  onSuccess: () => queryClient.invalidateQueries({ queryKey: getListAssetsQueryKey() })
                                });
                              }
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <DialogPrimitive.Root open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogPrimitive.Portal>
            <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
            <DialogPrimitive.Content className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-2xl duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-2xl">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <DialogHeader>
                    <DialogTitle className="text-xl font-display">Add Content Asset</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <FormField control={form.control} name="url" render={({ field }) => (
                      <FormItem>
                        <FormLabel>URL</FormLabel>
                        <FormControl><Input placeholder="https://..." className="rounded-xl" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="title" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Title (Optional)</FormLabel>
                        <FormControl><Input placeholder="Blog Post Title" className="rounded-xl" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    {categories && categories.length > 0 && (
                      <FormField control={form.control} name="categoryId" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Category</FormLabel>
                          <FormControl>
                            <select 
                              className="w-full h-10 px-3 py-2 rounded-xl border border-input bg-background"
                              onChange={(e) => field.onChange(e.target.value)}
                              value={field.value || ""}
                            >
                              <option value="">Select a category</option>
                              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    )}
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)} className="rounded-xl">Cancel</Button>
                    <Button type="submit" disabled={createMutation.isPending} className="rounded-xl bg-primary text-primary-foreground">
                      {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Save Asset
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        </DialogPrimitive.Root>

        <DialogPrimitive.Root open={isImportDialogOpen} onOpenChange={(open) => {
          setIsImportDialogOpen(open);
          if (!open) {
            setImportValidation(null);
            setImportResult(null);
            setCategoryDecisions({});
          }
        }}>
          <DialogPrimitive.Portal>
            <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
            <DialogPrimitive.Content className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-2xl duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-2xl max-h-[80vh] overflow-y-auto">
              {importResult ? (
                <div className="space-y-4">
                  <DialogHeader>
                    <DialogTitle className="text-xl font-display">Import Complete</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3 py-4">
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-green-500/10">
                      <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                      <span className="text-sm font-medium">{importResult.created} asset{importResult.created !== 1 ? "s" : ""} created</span>
                    </div>
                    {importResult.skipped > 0 && (
                      <div className="flex items-center gap-3 p-3 rounded-xl bg-yellow-500/10">
                        <XCircle className="w-5 h-5 text-yellow-600 shrink-0" />
                        <span className="text-sm font-medium">{importResult.skipped} duplicate{importResult.skipped !== 1 ? "s" : ""} skipped</span>
                      </div>
                    )}
                    {importResult.failed > 0 && (
                      <div className="p-3 rounded-xl bg-destructive/10 space-y-2">
                        <div className="flex items-center gap-3">
                          <XCircle className="w-5 h-5 text-destructive shrink-0" />
                          <span className="text-sm font-medium">{importResult.failed} row{importResult.failed !== 1 ? "s" : ""} failed</span>
                        </div>
                        {importResult.errors.length > 0 && (
                          <ul className="text-xs text-destructive space-y-1 ml-8">
                            {importResult.errors.map((err, i) => (
                              <li key={i}>{err}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                  <DialogFooter>
                    <Button onClick={() => setIsImportDialogOpen(false)} className="rounded-xl">
                      Done
                    </Button>
                  </DialogFooter>
                </div>
              ) : importValidation ? (
                <div className="space-y-4">
                  <DialogHeader>
                    <DialogTitle className="text-xl font-display">Import Preview</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3 py-4">
                    <p className="text-sm text-muted-foreground">
                      {importValidation.validRows.length} valid row{importValidation.validRows.length !== 1 ? "s" : ""} ready to import
                    </p>

                    {importValidation.duplicateUrls.length > 0 && (
                      <div className="p-3 rounded-xl bg-yellow-500/10 space-y-1">
                        <p className="text-sm font-medium text-yellow-700">{importValidation.duplicateUrls.length} duplicate URL{importValidation.duplicateUrls.length !== 1 ? "s" : ""} will be skipped:</p>
                        <ul className="text-xs text-yellow-600 space-y-0.5 ml-4 list-disc">
                          {importValidation.duplicateUrls.slice(0, 5).map((url, i) => (
                            <li key={i} className="truncate max-w-md">{url}</li>
                          ))}
                          {importValidation.duplicateUrls.length > 5 && (
                            <li>...and {importValidation.duplicateUrls.length - 5} more</li>
                          )}
                        </ul>
                      </div>
                    )}

                    {importValidation.errorRows.length > 0 && (
                      <div className="p-3 rounded-xl bg-destructive/10 space-y-1">
                        <p className="text-sm font-medium text-destructive">{importValidation.errorRows.length} row{importValidation.errorRows.length !== 1 ? "s" : ""} with errors:</p>
                        <ul className="text-xs text-destructive space-y-0.5 ml-4 list-disc">
                          {importValidation.errorRows.slice(0, 5).map((row, i) => (
                            <li key={i}>Row {row.rowNumber}: {row.error}</li>
                          ))}
                          {importValidation.errorRows.length > 5 && (
                            <li>...and {importValidation.errorRows.length - 5} more</li>
                          )}
                        </ul>
                      </div>
                    )}

                    {importValidation.unknownCategories.length > 0 && (
                      <div className="p-3 rounded-xl bg-secondary space-y-3">
                        <p className="text-sm font-medium">Unknown categories found:</p>
                        <div className="space-y-2">
                          {importValidation.unknownCategories.map((cat) => (
                            <div key={cat} className="flex items-center justify-between gap-4">
                              <span className="text-sm font-medium truncate">{cat}</span>
                              <select
                                className="h-8 px-2 py-1 rounded-lg border border-input bg-background text-sm"
                                value={categoryDecisions[cat] || "create"}
                                onChange={(e) => setCategoryDecisions(prev => ({ ...prev, [cat]: e.target.value as "create" | "skip" }))}
                              >
                                <option value="create">Create new category</option>
                                <option value="skip">Leave blank</option>
                              </select>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsImportDialogOpen(false)} className="rounded-xl">Cancel</Button>
                    <Button
                      onClick={handleConfirmImport}
                      disabled={confirmImportMutation.isPending || importValidation.validRows.length === 0}
                      className="rounded-xl bg-primary text-primary-foreground"
                    >
                      {confirmImportMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Import {importValidation.validRows.length} Asset{importValidation.validRows.length !== 1 ? "s" : ""}
                    </Button>
                  </DialogFooter>
                </div>
              ) : null}
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
      </div>
    </AppLayout>
  );
}
