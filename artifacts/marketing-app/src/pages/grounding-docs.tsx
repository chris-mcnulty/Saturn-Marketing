import React, { useState } from "react";
import { AppLayout } from "@/components/layout";
import {
  useListGroundingDocs,
  useCreateGroundingDoc,
  useUpdateGroundingDoc,
  useDeleteGroundingDoc,
  getListGroundingDocsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2, Plus, FileText, Trash2, BookOpen } from "lucide-react";
import { motion } from "framer-motion";

const CATEGORIES = [
  { value: "brand_voice", label: "Brand Voice" },
  { value: "messaging_framework", label: "Messaging Framework" },
  { value: "marketing_guidelines", label: "Marketing Guidelines" },
  { value: "methodology", label: "Methodology" },
] as const;

const categoryColors: Record<string, string> = {
  brand_voice: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  messaging_framework: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  marketing_guidelines: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  methodology: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
};

const createSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  category: z.enum(["brand_voice", "messaging_framework", "marketing_guidelines", "methodology"]),
  content: z.string().min(1, "Content is required"),
});

export default function GroundingDocs() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: docs, isLoading } = useListGroundingDocs();
  const createMutation = useCreateGroundingDoc();
  const updateMutation = useUpdateGroundingDoc();
  const deleteMutation = useDeleteGroundingDoc();

  const form = useForm<z.infer<typeof createSchema>>({
    resolver: zodResolver(createSchema),
    defaultValues: { name: "", description: "", category: "brand_voice", content: "" },
  });

  const onSubmit = (data: z.infer<typeof createSchema>) => {
    createMutation.mutate(
      { data: { ...data } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListGroundingDocsQueryKey() });
          setIsCreateOpen(false);
          form.reset();
          toast({ title: "Grounding document added" });
        },
        onError: () => {
          toast({ title: "Failed to add document", variant: "destructive" });
        },
      }
    );
  };

  const handleToggleActive = (id: number, currentActive: boolean) => {
    updateMutation.mutate(
      { id, data: { isActive: !currentActive } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListGroundingDocsQueryKey() });
        },
      }
    );
  };

  const handleDelete = (id: number) => {
    deleteMutation.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListGroundingDocsQueryKey() });
          setDeleteConfirmId(null);
          toast({ title: "Document deleted" });
        },
      }
    );
  };

  const getCategoryLabel = (value: string) => {
    return CATEGORIES.find((c) => c.value === value)?.label || value;
  };

  return (
    <AppLayout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Grounding Docs</h1>
            <p className="text-muted-foreground mt-1">
              Brand voice and messaging guidelines that shape AI-generated content.
            </p>
          </div>
          <Button
            onClick={() => setIsCreateOpen(true)}
            className="rounded-xl px-6 h-11 bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:-translate-y-0.5 transition-all"
          >
            <Plus className="w-4 h-4 mr-2" /> Add Document
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : docs?.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-card rounded-2xl border border-border/50">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <BookOpen className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">No grounding documents yet</h3>
            <p className="text-muted-foreground mb-6 text-center max-w-md">
              Add brand voice guidelines, messaging frameworks, or marketing methodology to help AI generate content that matches your brand.
            </p>
            <Button onClick={() => setIsCreateOpen(true)} className="rounded-xl">
              Add Document
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {docs?.map((doc, i) => (
              <motion.div
                key={doc.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card className="rounded-2xl border-border/50 p-5 flex flex-col gap-4 h-full">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <h4 className="font-semibold text-foreground truncate">{doc.name}</h4>
                      </div>
                      {doc.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2">{doc.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Switch
                        checked={doc.isActive}
                        onCheckedChange={() => handleToggleActive(doc.id, doc.isActive)}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary" className={`text-[10px] ${categoryColors[doc.category] || ""}`}>
                      {getCategoryLabel(doc.category)}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">
                      {doc.wordCount.toLocaleString()} words
                    </span>
                    {doc.originalFileName && (
                      <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">
                        {doc.originalFileName}
                      </span>
                    )}
                    {!doc.isActive && (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">
                        Inactive
                      </Badge>
                    )}
                  </div>

                  <div className="bg-secondary/50 rounded-xl p-3 flex-1 min-h-0">
                    <p className="text-xs text-muted-foreground line-clamp-4 whitespace-pre-wrap">
                      {doc.extractedText}
                    </p>
                  </div>

                  <div className="flex justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteConfirmId(doc.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        )}

        <DialogPrimitive.Root open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogPrimitive.Portal>
            <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
            <DialogPrimitive.Content className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-2xl duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out sm:rounded-2xl max-h-[90vh] overflow-y-auto">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <DialogHeader>
                    <DialogTitle className="text-xl font-display">Add Grounding Document</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-2">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Document Name</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. Brand Voice Guide" className="rounded-xl" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description (optional)</FormLabel>
                          <FormControl>
                            <Input placeholder="Brief description of this document" className="rounded-xl" {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="category"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Category</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger className="rounded-xl">
                                <SelectValue placeholder="Select category" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {CATEGORIES.map((cat) => (
                                <SelectItem key={cat.value} value={cat.value}>
                                  {cat.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="content"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Content</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Paste your brand voice guidelines, messaging framework, or marketing methodology here..."
                              className="rounded-xl min-h-[160px]"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)} className="rounded-xl">
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={createMutation.isPending}
                      className="rounded-xl bg-primary text-primary-foreground"
                    >
                      {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Save
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        </DialogPrimitive.Root>

        <DialogPrimitive.Root
          open={deleteConfirmId !== null}
          onOpenChange={(open) => !open && setDeleteConfirmId(null)}
        >
          <DialogPrimitive.Portal>
            <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
            <DialogPrimitive.Content className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-sm translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-2xl duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out sm:rounded-2xl">
              <DialogHeader>
                <DialogTitle className="text-lg font-display">Delete Document</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">
                Are you sure you want to delete this grounding document? This action cannot be undone.
              </p>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDeleteConfirmId(null)} className="rounded-xl">
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
                  disabled={deleteMutation.isPending}
                  className="rounded-xl"
                >
                  {deleteMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Delete
                </Button>
              </DialogFooter>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
      </div>
    </AppLayout>
  );
}
