import React, { useState } from "react";
import { AppLayout } from "@/components/layout";
import { 
  useGetTenant, 
  useUpdateTenant,
  useListCategories,
  useCreateCategory,
  useDeleteCategory,
  useListBrandAssetCategories,
  useCreateBrandAssetCategory,
  useDeleteBrandAssetCategory,
  getListCategoriesQueryKey,
  getListBrandAssetCategoriesQueryKey,
  getGetTenantQueryKey,
  useListTenantUsers
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Trash2 } from "lucide-react";

export default function Settings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: tenant } = useGetTenant();
  const { data: categories } = useListCategories();
  const { data: brandAssetCategories } = useListBrandAssetCategories();
  const { data: users } = useListTenantUsers();

  const updateTenantMut = useUpdateTenant();
  const createCategoryMut = useCreateCategory();
  const deleteCategoryMut = useDeleteCategory();
  const createBrandCatMut = useCreateBrandAssetCategory();
  const deleteBrandCatMut = useDeleteBrandAssetCategory();

  const [tenantName, setTenantName] = useState(tenant?.name || "");
  const [newCatName, setNewCatName] = useState("");
  const [newBrandCatName, setNewBrandCatName] = useState("");

  const handleUpdateTenant = () => {
    updateTenantMut.mutate({ data: { name: tenantName } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetTenantQueryKey() });
        toast({ title: "Organization updated" });
      }
    });
  };

  const handleCreateCat = () => {
    if(!newCatName) return;
    createCategoryMut.mutate({ data: { name: newCatName } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListCategoriesQueryKey() });
        setNewCatName("");
      }
    });
  };

  const handleCreateBrandCat = () => {
    if(!newBrandCatName) return;
    createBrandCatMut.mutate({ data: { name: newBrandCatName } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListBrandAssetCategoriesQueryKey() });
        setNewBrandCatName("");
      }
    });
  };

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto flex flex-col gap-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground mt-1">Manage organization preferences and taxonomies.</p>
        </div>

        <Card className="rounded-2xl border-border/50">
          <CardHeader>
            <CardTitle className="font-display">Organization Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Organization Name</label>
              <div className="flex gap-4">
                <Input 
                  value={tenantName || tenant?.name || ""} 
                  onChange={(e) => setTenantName(e.target.value)} 
                  className="rounded-xl h-11 max-w-md"
                />
                <Button onClick={handleUpdateTenant} disabled={updateTenantMut.isPending} className="h-11 rounded-xl">
                  {updateTenantMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/50">
          <CardHeader>
            <CardTitle className="font-display">Content Categories</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 mb-6">
              <Input 
                value={newCatName} 
                onChange={(e) => setNewCatName(e.target.value)} 
                placeholder="New Category Name" 
                className="rounded-xl h-11 max-w-sm"
                onKeyDown={(e) => e.key === "Enter" && handleCreateCat()}
              />
              <Button onClick={handleCreateCat} disabled={createCategoryMut.isPending || !newCatName} variant="secondary" className="h-11 rounded-xl">
                Add
              </Button>
            </div>
            
            <div className="flex flex-wrap gap-2">
              {categories?.map(cat => (
                <div key={cat.id} className="flex items-center gap-2 px-3 py-1.5 bg-secondary rounded-lg text-sm font-medium">
                  {cat.name}
                  <button onClick={() => {
                    deleteCategoryMut.mutate({ id: cat.id }, {
                      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListCategoriesQueryKey() })
                    })
                  }} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/50">
          <CardHeader>
            <CardTitle className="font-display">Brand Asset Categories</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 mb-6">
              <Input 
                value={newBrandCatName} 
                onChange={(e) => setNewBrandCatName(e.target.value)} 
                placeholder="New Brand Category Name" 
                className="rounded-xl h-11 max-w-sm"
                onKeyDown={(e) => e.key === "Enter" && handleCreateBrandCat()}
              />
              <Button onClick={handleCreateBrandCat} disabled={createBrandCatMut.isPending || !newBrandCatName} variant="secondary" className="h-11 rounded-xl">
                Add
              </Button>
            </div>
            
            <div className="flex flex-wrap gap-2">
              {brandAssetCategories?.map(cat => (
                <div key={cat.id} className="flex items-center gap-2 px-3 py-1.5 bg-secondary rounded-lg text-sm font-medium">
                  {cat.name}
                  <button onClick={() => {
                    deleteBrandCatMut.mutate({ id: cat.id }, {
                      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListBrandAssetCategoriesQueryKey() })
                    })
                  }} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/50">
          <CardHeader>
            <CardTitle className="font-display">Team Members</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-border/50">
              {users?.map(user => (
                <div key={user.id} className="py-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">{user.name}</p>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                  </div>
                  <div className="px-3 py-1 rounded-full bg-secondary text-xs font-semibold uppercase tracking-wider">
                    {user.role}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

      </div>
    </AppLayout>
  );
}
