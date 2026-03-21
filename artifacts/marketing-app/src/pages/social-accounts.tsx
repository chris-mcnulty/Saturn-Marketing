import React, { useState } from "react";
import { AppLayout } from "@/components/layout";
import { 
  useListSocialAccounts, 
  useCreateSocialAccount,
  useDeleteSocialAccount,
  getListSocialAccountsQueryKey
} from "@workspace/api-client-react";
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
import { Loader2, Plus, Share2, Trash2 } from "lucide-react";

const createSchema = z.object({
  platform: z.string().min(1, "Platform is required"),
  accountName: z.string().min(1, "Name is required"),
  socialPilotAccountId: z.string().min(1, "ID is required"),
});

export default function SocialAccounts() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: accounts, isLoading } = useListSocialAccounts();
  const createMutation = useCreateSocialAccount();
  const deleteMutation = useDeleteSocialAccount();

  const form = useForm<z.infer<typeof createSchema>>({
    resolver: zodResolver(createSchema),
    defaultValues: { platform: "twitter", accountName: "", socialPilotAccountId: "" },
  });

  const onSubmit = (data: z.infer<typeof createSchema>) => {
    createMutation.mutate({ data }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListSocialAccountsQueryKey() });
        setIsCreateOpen(false);
        form.reset();
        toast({ title: "Account linked" });
      }
    });
  };

  return (
    <AppLayout>
      <div className="flex flex-col gap-6 max-w-4xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Social Accounts</h1>
            <p className="text-muted-foreground mt-1">Manage target accounts mapped from SocialPilot.</p>
          </div>
          <Button onClick={() => setIsCreateOpen(true)} className="rounded-xl px-6 h-11 bg-primary text-primary-foreground">
            <Plus className="w-4 h-4 mr-2" /> Add Account
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : accounts?.length === 0 ? (
          <Card className="flex flex-col items-center justify-center py-20 border-dashed border-2">
            <Share2 className="w-12 h-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-xl font-semibold mb-2">No accounts connected</h3>
            <p className="text-muted-foreground mb-6">Map your SocialPilot accounts here to use them in campaigns.</p>
            <Button onClick={() => setIsCreateOpen(true)}>Add Account</Button>
          </Card>
        ) : (
          <div className="grid gap-4">
            {accounts?.map(acc => (
              <Card key={acc.id} className="p-5 flex items-center justify-between rounded-2xl border-border/50 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center font-display font-bold text-lg text-primary uppercase">
                    {acc.platform.substring(0,1)}
                  </div>
                  <div>
                    <h4 className="font-semibold text-lg">{acc.accountName}</h4>
                    <p className="text-sm text-muted-foreground capitalize">{acc.platform} • ID: {acc.socialPilotAccountId}</p>
                  </div>
                </div>
                <Button variant="ghost" className="text-destructive hover:bg-destructive/10" onClick={() => {
                  if(confirm('Delete account?')) {
                    deleteMutation.mutate({ id: acc.id }, {
                      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListSocialAccountsQueryKey() })
                    })
                  }
                }}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </Card>
            ))}
          </div>
        )}

        {/* Create Dialog */}
        <DialogPrimitive.Root open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogPrimitive.Portal>
            <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm" />
            <DialogPrimitive.Content className="fixed left-[50%] top-[50%] z-50 w-full max-w-md translate-x-[-50%] translate-y-[-50%] bg-background p-6 shadow-2xl sm:rounded-2xl border">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <h2 className="text-xl font-display font-bold mb-4">Add SocialPilot Account</h2>
                  <FormField control={form.control} name="platform" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Platform</FormLabel>
                      <FormControl>
                        <select className="w-full h-11 px-3 border rounded-xl bg-background" {...field}>
                          <option value="twitter">Twitter</option>
                          <option value="linkedin">LinkedIn</option>
                          <option value="facebook">Facebook</option>
                          <option value="instagram">Instagram</option>
                        </select>
                      </FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="accountName" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Account Name (Internal)</FormLabel>
                      <FormControl><Input className="rounded-xl h-11" placeholder="Corporate Twitter" {...field} /></FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="socialPilotAccountId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>SocialPilot Account ID</FormLabel>
                      <FormControl><Input className="rounded-xl h-11" placeholder="12345678" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <div className="flex justify-end gap-2 mt-6">
                    <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={createMutation.isPending}>
                      {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Save
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
      </div>
    </AppLayout>
  );
}
