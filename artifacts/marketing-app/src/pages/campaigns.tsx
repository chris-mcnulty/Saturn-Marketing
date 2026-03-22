import React, { useState } from "react";
import { AppLayout } from "@/components/layout";
import { 
  useListCampaigns, 
  useCreateCampaign,
  useDeleteCampaign,
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
import { Loader2, Plus, Calendar, Clock, Hash, ChevronRight, Trash2 } from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

const createSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  startDate: z.string().min(1, "Start date required"),
  durationDays: z.coerce.number().min(1),
  postsPerDay: z.coerce.number().min(1),
  postingTimes: z.string().optional(),
  hashtags: z.string().optional(),
  businessHoursOnly: z.boolean().optional(),
  businessHoursStart: z.string().optional(),
  businessHoursEnd: z.string().optional(),
  includeSaturday: z.boolean().optional(),
  includeSunday: z.boolean().optional(),
});

export default function Campaigns() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: campaigns, isLoading } = useListCampaigns();
  const createMutation = useCreateCampaign();
  const deleteMutation = useDeleteCampaign();

  const [postingTimeSlots, setPostingTimeSlots] = useState<string[]>(["09:00", "15:00"]);

  const getExclusiveMax = (endTime: string | undefined) => {
    if (!endTime) return undefined;
    const [h, m] = endTime.split(":").map(Number);
    const totalMins = h * 60 + m - 1;
    if (totalMins < 0) return undefined;
    return `${String(Math.floor(totalMins / 60)).padStart(2, "0")}:${String(totalMins % 60).padStart(2, "0")}`;
  };

  const form = useForm<z.infer<typeof createSchema>>({
    resolver: zodResolver(createSchema),
    defaultValues: { 
      name: "", description: "",
      startDate: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-${String(new Date().getDate()).padStart(2, "0")}`,
      durationDays: 14, postsPerDay: 2, postingTimes: "09:00,15:00",
      hashtags: "#marketing",
      businessHoursOnly: false,
      businessHoursStart: "09:00",
      businessHoursEnd: "17:00",
      includeSaturday: false,
      includeSunday: false,
    },
  });

  const onSubmit = (data: z.infer<typeof createSchema>) => {
    const submitData = { ...data, postingTimes: postingTimeSlots.join(",") };
    createMutation.mutate({ data: submitData }, {
      onSuccess: (newCampaign) => {
        queryClient.invalidateQueries({ queryKey: getListCampaignsQueryKey() });
        setIsCreateOpen(false);
        form.reset();
        setPostingTimeSlots(["09:00", "15:00"]);
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
                        <span>Starts {typeof campaign.startDate === "string" ? campaign.startDate.split("T")[0] : format(new Date(campaign.startDate), "MMM d, yyyy")} ({campaign.durationDays} days)</span>
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
                  <div className="bg-secondary/30 px-6 py-3 border-t border-border/50 text-xs font-medium text-muted-foreground flex justify-between items-center">
                    <span>ID: {campaign.id}</span>
                    <div className="flex items-center gap-3">
                      <span>Updated {format(new Date(campaign.updatedAt), "MMM d")}</span>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setDeleteTarget({ id: campaign.id, name: campaign.name });
                        }}
                        className="text-muted-foreground hover:text-destructive transition-colors p-1 -mr-1"
                        title="Delete campaign"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}

        {/* Create Modal */}
        <DialogPrimitive.Root open={isCreateOpen} onOpenChange={(open) => { setIsCreateOpen(open); if (!open) { setPostingTimeSlots(["09:00", "15:00"]); form.reset(); } }}>
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

                    <div className="md:col-span-2 space-y-2">
                      <Label className="text-sm font-medium">Posting Times</Label>
                      <div className="space-y-2">
                        {postingTimeSlots.map((slot, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <Input
                              type="time"
                              value={slot}
                              min={form.watch("businessHoursOnly") ? form.watch("businessHoursStart") : undefined}
                              max={form.watch("businessHoursOnly") ? getExclusiveMax(form.watch("businessHoursEnd")) : undefined}
                              onChange={(e) => {
                                const updated = [...postingTimeSlots];
                                updated[idx] = e.target.value;
                                setPostingTimeSlots(updated);
                              }}
                              className="rounded-xl h-11 w-40"
                            />
                            {postingTimeSlots.length > 1 && (
                              <Button type="button" variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 h-9 w-9" onClick={() => setPostingTimeSlots(postingTimeSlots.filter((_, i) => i !== idx))}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        ))}
                        <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={() => setPostingTimeSlots([...postingTimeSlots, "12:00"])}>
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
                        <FormField control={form.control} name="businessHoursOnly" render={({ field }) => (
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        )} />
                      </div>
                      {form.watch("businessHoursOnly") && (
                        <div className="flex items-center gap-3 pl-1">
                          <FormField control={form.control} name="businessHoursStart" render={({ field }) => (
                            <div className="flex items-center gap-2">
                              <Label className="text-xs text-muted-foreground">From</Label>
                              <Input type="time" className="rounded-xl h-9 w-32" {...field} />
                            </div>
                          )} />
                          <FormField control={form.control} name="businessHoursEnd" render={({ field }) => (
                            <div className="flex items-center gap-2">
                              <Label className="text-xs text-muted-foreground">To</Label>
                              <Input type="time" className="rounded-xl h-9 w-32" {...field} />
                            </div>
                          )} />
                        </div>
                      )}
                    </div>

                    <div className="md:col-span-2 space-y-3">
                      <Label className="text-sm font-medium">Weekend Scheduling</Label>
                      <div className="flex items-center gap-6">
                        <FormField control={form.control} name="includeSaturday" render={({ field }) => (
                          <div className="flex items-center gap-2">
                            <Checkbox id="create-sat" checked={field.value} onCheckedChange={(v) => field.onChange(!!v)} />
                            <Label htmlFor="create-sat" className="text-sm cursor-pointer">Include Saturday</Label>
                          </div>
                        )} />
                        <FormField control={form.control} name="includeSunday" render={({ field }) => (
                          <div className="flex items-center gap-2">
                            <Checkbox id="create-sun" checked={field.value} onCheckedChange={(v) => field.onChange(!!v)} />
                            <Label htmlFor="create-sun" className="text-sm cursor-pointer">Include Sunday</Label>
                          </div>
                        )} />
                      </div>
                    </div>

                    <FormField control={form.control} name="hashtags" render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>Always-Include Hashtags</FormLabel>
                        <FormControl><Input placeholder="#Marketing; #AI; #Brand" className="rounded-xl h-11" {...field} /></FormControl>
                        <p className="text-xs text-muted-foreground mt-1">Separate with semicolons. These hashtags will appear on every post. Additional hashtags are generated automatically based on each post's content.</p>
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

        <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Delete Campaign</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete <span className="font-semibold text-foreground">{deleteTarget?.name}</span>? This will permanently remove the campaign and all its generated posts. This action cannot be undone.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteTarget(null)} className="rounded-xl">Cancel</Button>
              <Button
                variant="destructive"
                className="rounded-xl"
                disabled={deleteMutation.isPending}
                onClick={() => {
                  if (!deleteTarget) return;
                  deleteMutation.mutate(
                    { id: deleteTarget.id },
                    {
                      onSuccess: () => {
                        queryClient.invalidateQueries({ queryKey: getListCampaignsQueryKey() });
                        toast({ title: "Campaign deleted" });
                        setDeleteTarget(null);
                      },
                      onError: () => {
                        toast({ title: "Failed to delete campaign", variant: "destructive" });
                      },
                    },
                  );
                }}
              >
                {deleteMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                <Trash2 className="w-4 h-4 mr-2" /> Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
