import React, { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout";
import { useAuth } from "@/lib/auth-context";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Building2, Pencil, Users, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface TenantItem {
  id: number;
  name: string;
  domain: string;
  plan: string;
  status: string;
  userCount: number;
  createdAt: string;
}

export default function AdminTenants() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tenants, setTenants] = useState<TenantItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editingTenant, setEditingTenant] = useState<{
    id: number;
    name: string;
    plan: string;
    status: string;
  } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const isGlobalAdmin = user?.role === "Global Admin";

  const fetchTenants = async () => {
    try {
      const baseUrl = import.meta.env.BASE_URL || "/";
      const resp = await fetch(`${baseUrl}api/admin/tenants`, { credentials: "include" });
      if (!resp.ok) throw new Error("Failed to fetch");
      const data = await resp.json();
      setTenants(data);
    } catch {
      toast({ title: "Failed to load tenants", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isGlobalAdmin) fetchTenants();
  }, [isGlobalAdmin]);

  const handleUpdate = async () => {
    if (!editingTenant) return;
    setIsSaving(true);
    try {
      const baseUrl = import.meta.env.BASE_URL || "/";
      const resp = await fetch(`${baseUrl}api/admin/tenants/${editingTenant.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: editingTenant.name,
          plan: editingTenant.plan,
          status: editingTenant.status,
        }),
      });
      if (!resp.ok) throw new Error("Failed to update");
      setEditingTenant(null);
      toast({ title: "Tenant updated" });
      fetchTenants();
    } catch {
      toast({ title: "Failed to update tenant", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  if (!isGlobalAdmin) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center py-20">
          <Building2 className="w-12 h-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-muted-foreground">
            Only Global Admins can access the Tenant Administration page.
          </p>
        </div>
      </AppLayout>
    );
  }

  const filteredTenants = tenants.filter(
    (t) =>
      !search ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.domain.toLowerCase().includes(search.toLowerCase())
  );

  const getPlanColor = (plan: string) => {
    switch (plan) {
      case "enterprise":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300";
      case "pro":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
      case "trial":
        return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
      case "suspended":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <AppLayout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Tenant Administration</h1>
            <p className="text-muted-foreground mt-1">Manage all tenants across the platform.</p>
          </div>
        </div>

        <Card className="rounded-2xl border-border/50 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-border/50 bg-secondary/20">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search tenants..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-11 rounded-xl bg-background"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-secondary/40 text-muted-foreground uppercase text-xs font-semibold tracking-wider">
                <tr>
                  <th className="px-6 py-4">Organization</th>
                  <th className="px-6 py-4">Domain</th>
                  <th className="px-6 py-4">Plan</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Users</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                    </td>
                  </tr>
                ) : filteredTenants.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-16 text-center">
                      <p className="text-muted-foreground">No tenants found</p>
                    </td>
                  </tr>
                ) : (
                  filteredTenants.map((tenant) => (
                    <tr key={tenant.id} className="hover:bg-secondary/20 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Building2 className="w-4 h-4 text-primary" />
                          </div>
                          <div>
                            <p className="font-semibold">{tenant.name}</p>
                            <p className="text-xs text-muted-foreground">ID: {tenant.id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">{tenant.domain}</td>
                      <td className="px-6 py-4">
                        <Badge variant="secondary" className={`text-xs ${getPlanColor(tenant.plan)}`}>
                          {tenant.plan}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        <Badge
                          variant="secondary"
                          className={`text-xs capitalize ${getStatusColor(tenant.status)}`}
                        >
                          {tenant.status}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Users className="w-3.5 h-3.5" />
                          <span>{tenant.userCount}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs"
                          onClick={() =>
                            setEditingTenant({
                              id: tenant.id,
                              name: tenant.name,
                              plan: tenant.plan,
                              status: tenant.status,
                            })
                          }
                        >
                          <Pencil className="w-3.5 h-3.5 mr-1.5" /> Edit
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <DialogPrimitive.Root
          open={!!editingTenant}
          onOpenChange={(open) => !open && setEditingTenant(null)}
        >
          <DialogPrimitive.Portal>
            <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
            <DialogPrimitive.Content className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-md translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-2xl duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out sm:rounded-2xl">
              <DialogHeader>
                <DialogTitle className="text-xl font-display">Edit Tenant</DialogTitle>
              </DialogHeader>
              {editingTenant && (
                <div className="space-y-4 py-2">
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Name</label>
                    <Input
                      value={editingTenant.name}
                      onChange={(e) =>
                        setEditingTenant({ ...editingTenant, name: e.target.value })
                      }
                      className="rounded-xl h-11"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Plan</label>
                    <select
                      className="w-full h-11 px-3 border rounded-xl bg-background"
                      value={editingTenant.plan}
                      onChange={(e) =>
                        setEditingTenant({ ...editingTenant, plan: e.target.value })
                      }
                    >
                      <option value="free">Free</option>
                      <option value="trial">Trial</option>
                      <option value="pro">Pro</option>
                      <option value="enterprise">Enterprise</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Status</label>
                    <select
                      className="w-full h-11 px-3 border rounded-xl bg-background"
                      value={editingTenant.status}
                      onChange={(e) =>
                        setEditingTenant({ ...editingTenant, status: e.target.value })
                      }
                    >
                      <option value="active">Active</option>
                      <option value="suspended">Suspended</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                </div>
              )}
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setEditingTenant(null)}
                  className="rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleUpdate}
                  disabled={isSaving}
                  className="rounded-xl bg-primary text-primary-foreground"
                >
                  {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Save Changes
                </Button>
              </DialogFooter>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
      </div>
    </AppLayout>
  );
}
