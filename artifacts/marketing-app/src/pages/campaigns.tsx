import React, { useState } from "react";
import { AppLayout } from "@/components/layout";
import { 
  useListCampaigns, 
  useCreateCampaign,
  getListCampaignsQueryKey
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
import { Loader2, Plus, Calendar, Clock, Hash, ChevronRight } from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";

const createSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  startDate: z.string().min(1, "Start date required"),
  durationDays: z.coerce.number().min(1),
  postsPerDay: z.coerce.number().min(1),
  postingTimes: z.string().optional(),
  hashtags: z.string().optional(),
  repetitionIntervalDays: z.coerce.number().min(1).optional(),
});

export default function Campaigns() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: campaigns, isLoading } = useListCampaigns();
  const createMutation = useCreateCampaign();

  const form = useForm<z.infer<typeof createSchema>>({
    resolver: zodResolver(createSchema),
    defaultValues: { 
      name: "", description: "", startDate: new Date().toISOString().split('T')[0],
      durationDays: 14, postsPerDay: 2, postingTimes: "09:00,15:00",
      hashtags: "#marketing", repetitionIntervalDays: 7
    },
  });

  const onSubmit = (data: z.infer<typeof createSchema>) => {
    createMutation.mutate({ data }, {
      onSuccess: (newCampaign) => {
        queryClient.invalidateQueries({ queryKey: getListCampaignsQueryKey() });
        setIsCreateOpen(false);
        form.reset();
        toast({ title: "Campaign created" });
        // Redirect to detail page
        window.location.href = `/campaigns/${newCampaign.id}`;
      },
      onError: () => {
        toast({ title: "Failed to create campaign", variant: "destructive" });
      }
    });
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'active': return 'bg-chart-4/10 text-chart-4 border-chart-4/20';
      case 'scheduled': return 'bg-primary/10 text-primary border-primary/20';
      case 'draft': return 'bg-muted text-muted-foreground border-border';
      case 'paused': return 'bg-chart-5/10 text-chart-5 border-chart-5/20';
      default: return 'bg-muted text-muted-foreground border-border';
    }
  };

  return (
    <AppLayout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Campaigns</h1>
            <p className="text-muted-foreground mt-1">Plan and schedule automated content distribution.</p>
          </div>
          <Button onClick={() => setIsCreateOpen(true)} className="rounded-xl px-6 h-11 bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:-translate-y-0.5 transition-all">
            <Plus className="w-4 h-4 mr-2" /> New Campaign
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : campaigns?.length === 0 ? (
          <Card className="flex flex-col items-center justify-center py-20 border-dashed border-2">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <Calendar className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">No campaigns found</h3>
            <p className="text-muted-foreground mb-6 text-center max-w-md">Create your first campaign to start scheduling social media posts automatically.</p>
            <Button onClick={() => setIsCreateOpen(true)} className="rounded-xl">Create Campaign</Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {campaigns?.map((campaign) => (
              <Link key={campaign.id} href={`/campaigns/${campaign.id}`}>
                <Card className="rounded-2xl border-border/50 hover:shadow-xl hover:border-primary/30 transition-all cursor-pointer group flex flex-col h-full overflow-hidden">
                  <div className="p-6 flex-1">
                    <div className="flex justify-between items-start mb-4">
                      <div className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(campaign.status)} capitalize`}>
                        {campaign.status}
                      </div>
                      <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                        <ChevronRight className="w-4 h-4" />
                      </div>
                    </div>
                    <h3 className="text-xl font-display font-bold text-foreground mb-2 group-hover:text-primary transition-colors">{campaign.name}</h3>
                    {campaign.description && <p className="text-sm text-muted-foreground line-clamp-2 mb-4">{campaign.description}</p>}
                    
                    <div className="space-y-2 mt-auto pt-4">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="w-4 h-4" />
                        <span>Starts {format(new Date(campaign.startDate), "MMM d, yyyy")} ({campaign.durationDays} days)</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="w-4 h-4" />
                        <span>{campaign.postsPerDay} posts/day</span>
                      </div>
                      {campaign.hashtags && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Hash className="w-4 h-4" />
                          <span className="truncate">{campaign.hashtags}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="bg-secondary/30 px-6 py-3 border-t border-border/50 text-xs font-medium text-muted-foreground flex justify-between">
                    <span>ID: {campaign.id}</span>
                    <span>Updated {format(new Date(campaign.updatedAt), "MMM d")}</span>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}

        {/* Create Modal */}
        <DialogPrimitive.Root open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogPrimitive.Portal>
            <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out" />
            <DialogPrimitive.Content className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-2xl translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-2xl duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out sm:rounded-3xl max-h-[90vh] overflow-y-auto">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <DialogHeader>
                    <DialogTitle className="text-2xl font-display">Create Campaign</DialogTitle>
                  </DialogHeader>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
                    <FormField control={form.control} name="name" render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>Campaign Name</FormLabel>
                        <FormControl><Input placeholder="Q3 Product Launch" className="rounded-xl h-11" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="description" render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>Description</FormLabel>
                        <FormControl><Input placeholder="Optional notes" className="rounded-xl h-11" {...field} /></FormControl>
                      </FormItem>
                    )} />
                    
                    <FormField control={form.control} name="startDate" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start Date</FormLabel>
                        <FormControl><Input type="date" className="rounded-xl h-11" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="durationDays" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Duration (Days)</FormLabel>
                        <FormControl><Input type="number" min={1} className="rounded-xl h-11" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    
                    <FormField control={form.control} name="postsPerDay" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Posts Per Day</FormLabel>
                        <FormControl><Input type="number" min={1} className="rounded-xl h-11" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="repetitionIntervalDays" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Repeat Interval (Days)</FormLabel>
                        <FormControl><Input type="number" min={1} className="rounded-xl h-11" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="postingTimes" render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>Posting Times (comma separated)</FormLabel>
                        <FormControl><Input placeholder="09:00, 15:00" className="rounded-xl h-11" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    
                    <FormField control={form.control} name="hashtags" render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>Mandatory Hashtags</FormLabel>
                        <FormControl><Input placeholder="#Marketing #AI" className="rounded-xl h-11" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>

                  <DialogFooter className="sticky bottom-0 bg-background pt-4 border-t border-border/50">
                    <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)} className="rounded-xl h-11 px-6">Cancel</Button>
                    <Button type="submit" disabled={createMutation.isPending} className="rounded-xl h-11 px-6 bg-primary text-primary-foreground">
                      {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Create & Continue
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
      </div>
    </AppLayout>
  );
}
