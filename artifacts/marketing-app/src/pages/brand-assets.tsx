import React, { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout";
import { 
  useListBrandAssets, 
  useCreateBrandAsset, 
  useUpdateBrandAsset,
  useDeleteBrandAsset,
  useListBrandAssetCategories,
  getListBrandAssetsQueryKey
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
import { Loader2, Plus, Image as ImageIcon, Trash2, Filter, Pencil } from "lucide-react";
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
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: assets, isLoading } = useListBrandAssets();
  const { data: brandCategories } = useListBrandAssetCategories();
  const createMutation = useCreateBrandAsset();
  const updateMutation = useUpdateBrandAsset();
  const deleteMutation = useDeleteBrandAsset();

  const form = useForm<z.infer<typeof createSchema>>({
    resolver: zodResolver(createSchema),
    defaultValues: { imageUrl: "", title: "", description: "", tags: "", categoryId: "" },
  });

  const filteredAssets = useMemo(() => {
    if (!assets) return [];
    if (filterCategoryId === "all") return assets;
    if (filterCategoryId === "uncategorized") return assets.filter(a => !a.categoryId);
    return assets.filter(a => a.categoryId === Number(filterCategoryId));
  }, [assets, filterCategoryId]);

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

  return (
    <AppLayout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Brand Assets</h1>
            <p className="text-muted-foreground mt-1">Approved visuals for your marketing campaigns.</p>
          </div>
          <Button onClick={() => setIsCreateOpen(true)} className="rounded-xl px-6 h-11 bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:-translate-y-0.5 transition-all">
            <Plus className="w-4 h-4 mr-2" /> Add Image
          </Button>
        </div>

        {brandCategories && brandCategories.length > 0 && (
          <div className="flex items-center gap-3 flex-wrap">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setFilterCategoryId("all")}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  filterCategoryId === "all"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                }`}
              >
                All
              </button>
              {brandCategories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setFilterCategoryId(String(cat.id))}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    filterCategoryId === String(cat.id)
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                  }`}
                >
                  {cat.name}
                </button>
              ))}
              <button
                onClick={() => setFilterCategoryId("uncategorized")}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  filterCategoryId === "uncategorized"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                }`}
              >
                Uncategorized
              </button>
            </div>
          </div>
        )}

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
              {filterCategoryId !== "all" ? "No assets in this category" : "No brand assets yet"}
            </h3>
            <p className="text-muted-foreground mb-6">
              {filterCategoryId !== "all" ? "Try selecting a different category or add new assets." : "Upload your first approved image to use in campaigns."}
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
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <Button variant="secondary" size="icon" onClick={() => handleStartEdit(asset)} className="rounded-full w-10 h-10 shadow-lg scale-0 group-hover:scale-100 transition-transform delay-75">
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="destructive" size="icon" onClick={() => handleDelete(asset.id)} className="rounded-full w-10 h-10 shadow-lg scale-0 group-hover:scale-100 transition-transform delay-100">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    {asset.categoryName && (
                      <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-primary/90 text-primary-foreground text-[10px] font-semibold uppercase tracking-wider backdrop-blur-sm">
                        {asset.categoryName}
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <h4 className="font-semibold text-foreground truncate">{asset.title}</h4>
                    {asset.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{asset.description}</p>}
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
      </div>
    </AppLayout>
  );
}
