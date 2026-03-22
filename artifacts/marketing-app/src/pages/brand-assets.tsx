import React, { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout";
import { 
  useListBrandAssets, 
  useCreateBrandAsset, 
  useUpdateBrandAsset,
  useDeleteBrandAsset,
  useListBrandAssetCategories,
  useCreateBrandAssetCategory,
  useUpdateBrandAssetCategory,
  useDeleteBrandAssetCategory,
  getListBrandAssetsQueryKey,
  getListBrandAssetCategoriesQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2, Plus, Image as ImageIcon, Trash2, Pencil, Settings2, X, Search } from "lucide-react";
import { motion } from "framer-motion";

const createSchema = z.object({
  imageUrl: z.string().url("Must be a valid URL"),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  tags: z.string().optional(),
  categoryId: z.string().optional(),
});

export default function BrandAssets() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<{id: number; imageUrl: string; title: string; description: string; tags: string; categoryId: string} | null>(null);
  const [filterCategoryId, setFilterCategoryId] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [editingCategory, setEditingCategory] = useState<{id: number; name: string} | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: assets, isLoading } = useListBrandAssets();
  const { data: brandCategories } = useListBrandAssetCategories();
  const createMutation = useCreateBrandAsset();
  const updateMutation = useUpdateBrandAsset();
  const deleteMutation = useDeleteBrandAsset();
  const createCategoryMutation = useCreateBrandAssetCategory();
  const updateCategoryMutation = useUpdateBrandAssetCategory();
  const deleteCategoryMutation = useDeleteBrandAssetCategory();

  const form = useForm<z.infer<typeof createSchema>>({
    resolver: zodResolver(createSchema),
    defaultValues: { imageUrl: "", title: "", description: "", tags: "", categoryId: "" },
  });

  const filteredAssets = useMemo(() => {
    if (!assets) return [];
    let filtered = assets;
    if (filterCategoryId === "uncategorized") {
      filtered = filtered.filter(a => !a.categoryId);
    } else if (filterCategoryId !== "all") {
      filtered = filtered.filter(a => a.categoryId === Number(filterCategoryId));
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(a =>
        (a.title && a.title.toLowerCase().includes(q)) ||
        (a.description && a.description.toLowerCase().includes(q)) ||
        (a.tags && a.tags.toLowerCase().includes(q))
      );
    }
    return filtered;
  }, [assets, filterCategoryId, searchQuery]);

  const categoryTabs = useMemo(() => {
    if (!assets || !brandCategories) return [];
    const tabs = [
      { id: "all", label: "All", count: assets.length },
      ...brandCategories.map(c => ({
        id: String(c.id),
        label: c.name,
        count: assets.filter(a => a.categoryId === c.id).length,
      })),
    ];
    const uncatCount = assets.filter(a => !a.categoryId).length;
    if (uncatCount > 0) {
      tabs.push({ id: "uncategorized", label: "Uncategorized", count: uncatCount });
    }
    return tabs;
  }, [assets, brandCategories]);

  React.useEffect(() => {
    if (categoryTabs.length > 0 && !categoryTabs.some(t => t.id === filterCategoryId)) {
      setFilterCategoryId("all");
    }
  }, [categoryTabs, filterCategoryId]);

  const onSubmit = (data: z.infer<typeof createSchema>) => {
    const categoryIdNum = data.categoryId && data.categoryId !== "none" ? Number(data.categoryId) : undefined;
    createMutation.mutate({ data: {
      imageUrl: data.imageUrl,
      title: data.title,
      description: data.description || undefined,
      tags: data.tags || undefined,
      ...(categoryIdNum ? { categoryId: categoryIdNum } : {}),
    } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListBrandAssetsQueryKey() });
        setIsCreateOpen(false);
        form.reset();
        toast({ title: "Brand asset added" });
      },
      onError: () => {
        toast({ title: "Failed to add asset", variant: "destructive" });
      }
    });
  };

  const handleStartEdit = (asset: typeof filteredAssets[0]) => {
    setEditingAsset({
      id: asset.id,
      imageUrl: asset.imageUrl,
      title: asset.title || "",
      description: asset.description || "",
      tags: asset.tags || "",
      categoryId: asset.categoryId ? String(asset.categoryId) : "none",
    });
  };

  const handleEditSubmit = () => {
    if (!editingAsset) return;
    const categoryIdNum = editingAsset.categoryId && editingAsset.categoryId !== "none" ? Number(editingAsset.categoryId) : null;
    updateMutation.mutate({
      id: editingAsset.id,
      data: {
        imageUrl: editingAsset.imageUrl,
        title: editingAsset.title || null,
        description: editingAsset.description || null,
        tags: editingAsset.tags || null,
        categoryId: categoryIdNum,
      }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListBrandAssetsQueryKey() });
        setEditingAsset(null);
        toast({ title: "Brand asset updated" });
      },
      onError: () => {
        toast({ title: "Failed to update asset", variant: "destructive" });
      }
    });
  };

  const handleDelete = (id: number) => {
    if(confirm('Delete this brand asset?')) {
      deleteMutation.mutate({ id }, {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: getListBrandAssetsQueryKey() })
      });
    }
  };

  const handleCreateCategory = () => {
    if (!newCategoryName.trim()) return;
    createCategoryMutation.mutate({ data: { name: newCategoryName.trim() } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListBrandAssetCategoriesQueryKey() });
        setNewCategoryName("");
        toast({ title: "Category created" });
      },
      onError: () => {
        toast({ title: "Failed to create category", variant: "destructive" });
      }
    });
  };

  const handleUpdateCategory = () => {
    if (!editingCategory || !editingCategory.name.trim()) return;
    updateCategoryMutation.mutate({ id: editingCategory.id, data: { name: editingCategory.name.trim() } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListBrandAssetCategoriesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListBrandAssetsQueryKey() });
        setEditingCategory(null);
        toast({ title: "Category updated" });
      },
      onError: () => {
        toast({ title: "Failed to update category", variant: "destructive" });
      }
    });
  };

  const handleDeleteCategory = (id: number, name: string) => {
    if (confirm(`Delete category "${name}"? Assets in this category will become uncategorized.`)) {
      deleteCategoryMutation.mutate({ id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListBrandAssetCategoriesQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListBrandAssetsQueryKey() });
          toast({ title: "Category deleted" });
        },
        onError: () => {
          toast({ title: "Failed to delete category", variant: "destructive" });
        }
      });
    }
  };

  return (
    <AppLayout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Brand Assets</h1>
            <p className="text-muted-foreground mt-1">Approved visuals for your marketing campaigns.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setIsCategoryManagerOpen(true)} className="rounded-xl h-11">
              <Settings2 className="w-4 h-4 mr-2" /> Categories
            </Button>
            <Button onClick={() => setIsCreateOpen(true)} className="rounded-xl px-6 h-11 bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:-translate-y-0.5 transition-all">
              <Plus className="w-4 h-4 mr-2" /> Add Image
            </Button>
          </div>
        </div>

        <Card className="rounded-2xl border-border/50 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-border/50 bg-secondary/20">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Search brand assets..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-11 rounded-xl bg-background"
              />
            </div>
          </div>

          {categoryTabs.length > 1 && (
            <div className="flex items-center gap-1 px-4 py-2 border-b border-border/50 bg-secondary/10 overflow-x-auto">
              {categoryTabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setFilterCategoryId(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                    filterCategoryId === tab.id
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                  }`}
                >
                  {tab.label}
                  <span className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold ${
                    filterCategoryId === tab.id
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : "bg-secondary text-muted-foreground"
                  }`}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>
          )}
        </Card>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filteredAssets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-card rounded-2xl border border-border/50">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <ImageIcon className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">
              {filterCategoryId !== "all" || searchQuery ? "No matching assets" : "No brand assets yet"}
            </h3>
            <p className="text-muted-foreground mb-6">
              {filterCategoryId !== "all" || searchQuery ? "Try a different filter or search term." : "Upload your first approved image to use in campaigns."}
            </p>
            <Button onClick={() => setIsCreateOpen(true)} className="rounded-xl">Add Image</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredAssets.map((asset, i) => (
              <motion.div key={asset.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }}>
                <Card className="rounded-2xl border-border/50 overflow-hidden group">
                  <div className="aspect-video relative bg-secondary overflow-hidden">
                    <img src={asset.imageUrl} alt={asset.title || "Brand asset"} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    {asset.categoryName && (
                      <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-primary/90 text-primary-foreground text-[10px] font-semibold uppercase tracking-wider backdrop-blur-sm">
                        {asset.categoryName}
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h4 className="font-semibold text-foreground truncate">{asset.title}</h4>
                        {asset.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{asset.description}</p>}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button variant="ghost" size="icon" onClick={() => handleStartEdit(asset)} className="h-8 w-8 text-muted-foreground hover:text-foreground">
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(asset.id)} className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                    {asset.tags && (
                      <div className="flex gap-1 mt-3 overflow-x-auto pb-1">
                        {asset.tags.split(',').map(tag => (
                          <span key={tag} className="px-2 py-0.5 rounded-md bg-secondary text-[10px] font-medium text-secondary-foreground whitespace-nowrap">
                            {tag.trim()}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        )}

        {/* Create Brand Asset Dialog */}
        <DialogPrimitive.Root open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogPrimitive.Portal>
            <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
            <DialogPrimitive.Content className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-2xl duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out sm:rounded-2xl">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <DialogPrimitive.Title className="text-xl font-display font-bold">Add Brand Image</DialogPrimitive.Title>
                  <div className="space-y-4 py-4">
                    <FormField control={form.control} name="imageUrl" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Image URL (must be public)</FormLabel>
                        <FormControl><Input placeholder="https://..." className="rounded-xl" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="title" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Title</FormLabel>
                        <FormControl><Input placeholder="Logo, Banner..." className="rounded-xl" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="description" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl><Input placeholder="Brief description" className="rounded-xl" {...field} /></FormControl>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="tags" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tags (comma separated)</FormLabel>
                        <FormControl><Input placeholder="logo, header, dark" className="rounded-xl" {...field} /></FormControl>
                      </FormItem>
                    )} />
                    {brandCategories && brandCategories.length > 0 && (
                      <FormField control={form.control} name="categoryId" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Category</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger className="rounded-xl">
                                <SelectValue placeholder="Select a category (optional)" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="none">No category</SelectItem>
                              {brandCategories.map(cat => (
                                <SelectItem key={cat.id} value={String(cat.id)}>{cat.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )} />
                    )}
                  </div>
                  <div className="flex justify-end gap-3">
                    <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)} className="rounded-xl">Cancel</Button>
                    <Button type="submit" disabled={createMutation.isPending} className="rounded-xl bg-primary text-primary-foreground">
                      {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Save
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        </DialogPrimitive.Root>

        {/* Edit Brand Asset Dialog */}
        <DialogPrimitive.Root open={!!editingAsset} onOpenChange={(open) => { if (!open) setEditingAsset(null); }}>
          <DialogPrimitive.Portal>
            <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
            <DialogPrimitive.Content className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-2xl duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out sm:rounded-2xl">
              {editingAsset && (
                <div className="space-y-4">
                  <DialogPrimitive.Title className="text-xl font-display font-bold">Edit Brand Image</DialogPrimitive.Title>
                  <div className="space-y-4 py-4">
                    <div>
                      <label className="text-sm font-medium mb-1.5 block">Image URL</label>
                      <Input value={editingAsset.imageUrl} onChange={(e) => setEditingAsset({...editingAsset, imageUrl: e.target.value})} className="rounded-xl" />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1.5 block">Title</label>
                      <Input value={editingAsset.title} onChange={(e) => setEditingAsset({...editingAsset, title: e.target.value})} className="rounded-xl" />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1.5 block">Description</label>
                      <Input value={editingAsset.description} onChange={(e) => setEditingAsset({...editingAsset, description: e.target.value})} className="rounded-xl" />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1.5 block">Tags (comma separated)</label>
                      <Input value={editingAsset.tags} onChange={(e) => setEditingAsset({...editingAsset, tags: e.target.value})} className="rounded-xl" />
                    </div>
                    {brandCategories && brandCategories.length > 0 && (
                      <div>
                        <label className="text-sm font-medium mb-1.5 block">Category</label>
                        <Select value={editingAsset.categoryId} onValueChange={(val) => setEditingAsset({...editingAsset, categoryId: val})}>
                          <SelectTrigger className="rounded-xl">
                            <SelectValue placeholder="Select a category (optional)" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No category</SelectItem>
                            {brandCategories.map(cat => (
                              <SelectItem key={cat.id} value={String(cat.id)}>{cat.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                  <div className="flex justify-end gap-3">
                    <Button type="button" variant="outline" onClick={() => setEditingAsset(null)} className="rounded-xl">Cancel</Button>
                    <Button onClick={handleEditSubmit} disabled={updateMutation.isPending} className="rounded-xl bg-primary text-primary-foreground">
                      {updateMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Save Changes
                    </Button>
                  </div>
                </div>
              )}
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        </DialogPrimitive.Root>

        {/* Category Manager Dialog */}
        <DialogPrimitive.Root open={isCategoryManagerOpen} onOpenChange={setIsCategoryManagerOpen}>
          <DialogPrimitive.Portal>
            <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
            <DialogPrimitive.Content className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-2xl duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out sm:rounded-2xl max-h-[80vh] overflow-y-auto">
              <DialogPrimitive.Title className="text-xl font-display font-bold">Manage Categories</DialogPrimitive.Title>
              <p className="text-sm text-muted-foreground">Create and manage categories to organize your brand assets.</p>

              <div className="flex gap-2 mt-2">
                <Input
                  placeholder="New category name..."
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  className="rounded-xl flex-1"
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleCreateCategory(); } }}
                />
                <Button
                  onClick={handleCreateCategory}
                  disabled={!newCategoryName.trim() || createCategoryMutation.isPending}
                  className="rounded-xl bg-primary text-primary-foreground"
                >
                  {createCategoryMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                </Button>
              </div>

              <div className="space-y-2 mt-4">
                {!brandCategories || brandCategories.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    No categories yet. Create one above to get started.
                  </div>
                ) : (
                  brandCategories.map(cat => {
                    const assetCount = assets?.filter(a => a.categoryId === cat.id).length || 0;
                    return (
                      <div key={cat.id} className="flex items-center gap-2 p-3 rounded-xl border border-border/50 bg-card">
                        {editingCategory?.id === cat.id ? (
                          <>
                            <Input
                              value={editingCategory.name}
                              onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                              className="rounded-lg flex-1 h-9 text-sm"
                              autoFocus
                              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleUpdateCategory(); } if (e.key === "Escape") setEditingCategory(null); }}
                            />
                            <Button size="sm" onClick={handleUpdateCategory} disabled={updateCategoryMutation.isPending} className="rounded-lg h-9 px-3 bg-primary text-primary-foreground">
                              Save
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditingCategory(null)} className="rounded-lg h-9 px-3">
                              <X className="w-4 h-4" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <span className="flex-1 font-medium text-sm">{cat.name}</span>
                            <span className="text-xs text-muted-foreground px-2 py-0.5 rounded-full bg-secondary">
                              {assetCount} {assetCount === 1 ? "asset" : "assets"}
                            </span>
                            <Button variant="ghost" size="icon" onClick={() => setEditingCategory({ id: cat.id, name: cat.name })} className="h-8 w-8 text-muted-foreground hover:text-foreground">
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteCategory(cat.id, cat.name)} className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10">
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              <div className="flex justify-end mt-4">
                <Button variant="outline" onClick={() => setIsCategoryManagerOpen(false)} className="rounded-xl">Done</Button>
              </div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
      </div>
    </AppLayout>
  );
}
