import React, { useState } from "react";
import { AppLayout } from "@/components/layout";
import {
  useListMarkets,
  useCreateMarket,
  useUpdateMarket,
  useDeleteMarket,
  getListMarketsQueryKey,
  type Market,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, MapPin, Pencil, Archive, Star, Check } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export default function Markets() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingMarket, setEditingMarket] = useState<{
    id: number;
    name: string;
    description: string;
    isDefault: boolean;
  } | null>(null);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newIsDefault, setNewIsDefault] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: markets, isLoading } = useListMarkets();
  const createMutation = useCreateMarket();
  const updateMutation = useUpdateMarket();
  const deleteMutation = useDeleteMarket();

  const isAdmin = user?.role === "Global Admin" || user?.role === "Domain Admin";

  const resetCreate = () => {
    setIsCreateOpen(false);
    setNewName("");
    setNewDescription("");
    setNewIsDefault(false);
  };

  const handleCreate = () => {
    if (!newName.trim()) return;
    createMutation.mutate(
      { data: { name: newName.trim(), description: newDescription.trim() || undefined, isDefault: newIsDefault } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListMarketsQueryKey() });
          queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
          resetCreate();
          toast({ title: "Market created" });
        },
        onError: () => {
          toast({ title: "Failed to create market", variant: "destructive" });
        },
      }
    );
  };

  const handleUpdate = () => {
    if (!editingMarket || !editingMarket.name.trim()) return;
    updateMutation.mutate(
      {
        id: editingMarket.id,
        data: {
          name: editingMarket.name.trim(),
          description: editingMarket.description.trim() || undefined,
          isDefault: editingMarket.isDefault,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListMarketsQueryKey() });
          queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
          setEditingMarket(null);
          toast({ title: "Market updated" });
        },
        onError: () => {
          toast({ title: "Failed to update market", variant: "destructive" });
        },
      }
    );
  };

  const handleArchive = (id: number, name: string) => {
    if (!confirm(`Archive market "${name}"? This cannot be undone.`)) return;
    deleteMutation.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListMarketsQueryKey() });
          queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
          toast({ title: "Market archived" });
        },
        onError: (err: any) => {
          toast({
            title: "Failed to archive market",
            description: err?.data?.error || "Cannot archive the default market",
            variant: "destructive",
          });
        },
      }
    );
  };

  const activeMarkets: Market[] = markets?.filter((m: Market) => m.status === "active") || [];
  const archivedMarkets: Market[] = markets?.filter((m: Market) => m.status === "archived") || [];

  return (
    <AppLayout>
      <div className="flex flex-col gap-6 max-w-4xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Markets</h1>
            <p className="text-muted-foreground mt-1">
              Manage market segments for your organization.
            </p>
          </div>
          {isAdmin && (
            <Button
              onClick={() => setIsCreateOpen(true)}
              className="rounded-xl px-6 h-11 bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:-translate-y-0.5 transition-all"
            >
              <Plus className="w-4 h-4 mr-2" /> New Market
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : activeMarkets.length === 0 ? (
          <Card className="flex flex-col items-center justify-center py-20 border-dashed border-2">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <MapPin className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">No markets yet</h3>
            <p className="text-muted-foreground mb-6 text-center max-w-md">
              Create your first market to segment your content and campaigns.
            </p>
            {isAdmin && (
              <Button onClick={() => setIsCreateOpen(true)} className="rounded-xl">
                Create Market
              </Button>
            )}
          </Card>
        ) : (
          <div className="grid gap-4">
            {activeMarkets.map((market) => (
              <Card
                key={market.id}
                className="p-5 flex items-center justify-between rounded-2xl border-border/50 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-5 h-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-lg truncate">{market.name}</h4>
                      {market.isDefault && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 text-[10px] font-semibold uppercase flex items-center gap-1">
                          <Star className="w-2.5 h-2.5" /> Default
                        </span>
                      )}
                    </div>
                    {market.description && (
                      <p className="text-sm text-muted-foreground truncate">{market.description}</p>
                    )}
                  </div>
                </div>
                {isAdmin && (
                  <div className="flex gap-1 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-primary hover:bg-primary/10"
                      onClick={() =>
                        setEditingMarket({
                          id: market.id,
                          name: market.name,
                          description: market.description || "",
                          isDefault: market.isDefault,
                        })
                      }
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    {!market.isDefault && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleArchive(market.id, market.name)}
                      >
                        <Archive className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}

        {archivedMarkets.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Archived Markets
            </h3>
            <div className="grid gap-3">
              {archivedMarkets.map((market) => (
                <Card
                  key={market.id}
                  className="p-4 flex items-center justify-between rounded-xl border-border/50 opacity-60"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-sm font-medium truncate">{market.name}</span>
                    <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-[10px] font-semibold uppercase">
                      Archived
                    </span>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        <DialogPrimitive.Root open={isCreateOpen} onOpenChange={(open) => !open && resetCreate()}>
          <DialogPrimitive.Portal>
            <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
            <DialogPrimitive.Content className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-md translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-2xl duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out sm:rounded-2xl">
              <DialogHeader>
                <DialogTitle className="text-xl font-display">Create Market</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Name</label>
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. North America, EMEA, Enterprise"
                    className="rounded-xl h-11"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Description</label>
                  <Textarea
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="Optional description for this market"
                    className="rounded-xl"
                  />
                </div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newIsDefault}
                    onChange={(e) => setNewIsDefault(e.target.checked)}
                    className="rounded border-muted-foreground"
                  />
                  <span className="text-sm">Set as default market</span>
                </label>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={resetCreate} className="rounded-xl">
                  Cancel
                </Button>
                <Button
                  onClick={handleCreate}
                  disabled={createMutation.isPending || !newName.trim()}
                  className="rounded-xl bg-primary text-primary-foreground"
                >
                  {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Create
                </Button>
              </DialogFooter>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        </DialogPrimitive.Root>

        <DialogPrimitive.Root
          open={!!editingMarket}
          onOpenChange={(open) => !open && setEditingMarket(null)}
        >
          <DialogPrimitive.Portal>
            <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
            <DialogPrimitive.Content className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-md translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-2xl duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out sm:rounded-2xl">
              <DialogHeader>
                <DialogTitle className="text-xl font-display">Edit Market</DialogTitle>
              </DialogHeader>
              {editingMarket && (
                <div className="space-y-4 py-2">
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Name</label>
                    <Input
                      value={editingMarket.name}
                      onChange={(e) =>
                        setEditingMarket({ ...editingMarket, name: e.target.value })
                      }
                      className="rounded-xl h-11"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Description</label>
                    <Textarea
                      value={editingMarket.description}
                      onChange={(e) =>
                        setEditingMarket({ ...editingMarket, description: e.target.value })
                      }
                      className="rounded-xl"
                    />
                  </div>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingMarket.isDefault}
                      onChange={(e) =>
                        setEditingMarket({ ...editingMarket, isDefault: e.target.checked })
                      }
                      className="rounded border-muted-foreground"
                    />
                    <span className="text-sm">Set as default market</span>
                  </label>
                </div>
              )}
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setEditingMarket(null)}
                  className="rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleUpdate}
                  disabled={updateMutation.isPending || !editingMarket?.name.trim()}
                  className="rounded-xl bg-primary text-primary-foreground"
                >
                  {updateMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
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
