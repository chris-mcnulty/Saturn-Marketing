import React, { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout";
import {
  useListAssets,
  useListCategories,
  useGeneratePromotionalEmail,
  useListSavedEmails,
  useSaveGeneratedEmail,
  useDeleteSavedEmail,
  type GenerateEmailBodyPlatform,
  type GenerateEmailBodyTone,
  type GenerateEmailResponse,
  type SavedEmail,
} from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Mail,
  Copy,
  Check,
  Lightbulb,
  X,
  Search,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Save,
  Trash2,
  Archive,
  CheckSquare,
  Square,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import DOMPurify from "dompurify";
import { useQueryClient } from "@tanstack/react-query";

const PLATFORMS = [
  { value: "outlook", label: "Outlook" },
  { value: "hubspot_marketing", label: "HubSpot Marketing Email" },
  { value: "hubspot_1to1", label: "HubSpot 1:1 Email" },
  { value: "dynamics_customer", label: "Dynamics 365 Customer Email" },
] as const;

const TONES = [
  { value: "professional", label: "Professional" },
  { value: "friendly", label: "Friendly" },
  { value: "urgent", label: "Urgent" },
] as const;

export default function EmailGenerator() {
  const { data: assets, isLoading: assetsLoading } = useListAssets();
  const { data: categories } = useListCategories();
  const generateMutation = useGeneratePromotionalEmail();
  const { data: savedEmails } = useListSavedEmails();
  const saveMutation = useSaveGeneratedEmail();
  const deleteMutation = useDeleteSavedEmail();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [selectedAssetIds, setSelectedAssetIds] = useState<number[]>([]);
  const [platform, setPlatform] = useState<GenerateEmailBodyPlatform | "">("");
  const [tone, setTone] = useState<GenerateEmailBodyTone | "">("");
  const [callToAction, setCallToAction] = useState("");
  const [recipientContext, setRecipientContext] = useState("");
  const [assetSearch, setAssetSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [copied, setCopied] = useState(false);
  const [generatedEmail, setGeneratedEmail] = useState<GenerateEmailResponse | null>(null);
  const [showCoaching, setShowCoaching] = useState(true);
  const [showAssetSelector, setShowAssetSelector] = useState(false);
  const [showSavedEmails, setShowSavedEmails] = useState(false);
  const [viewingSavedEmail, setViewingSavedEmail] = useState<SavedEmail | null>(null);

  const isHtmlPlatform = generatedEmail?.platform === "HubSpot Marketing Email";

  const activeAssets = assets?.filter((a) => a.isActive) || [];

  const filteredAssets = useMemo(() => {
    return activeAssets.filter((a) => {
      if (assetSearch) {
        const q = assetSearch.toLowerCase();
        if (
          !a.title?.toLowerCase().includes(q) &&
          !a.url.toLowerCase().includes(q)
        )
          return false;
      }
      if (categoryFilter) {
        if (String(a.categoryId) !== categoryFilter) return false;
      }
      if (dateFrom) {
        const assetDate = a.createdAt ? new Date(a.createdAt) : null;
        if (!assetDate || assetDate < new Date(dateFrom)) return false;
      }
      if (dateTo) {
        const assetDate = a.createdAt ? new Date(a.createdAt) : null;
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        if (!assetDate || assetDate > toDate) return false;
      }
      return true;
    });
  }, [activeAssets, assetSearch, categoryFilter, dateFrom, dateTo]);

  const allFilteredSelected = filteredAssets.length > 0 && filteredAssets.every((a) => selectedAssetIds.includes(a.id));

  const toggleAsset = (id: number) => {
    setSelectedAssetIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleSelectAll = () => {
    if (allFilteredSelected) {
      const filteredIds = new Set(filteredAssets.map((a) => a.id));
      setSelectedAssetIds((prev) => prev.filter((id) => !filteredIds.has(id)));
    } else {
      const filteredIds = filteredAssets.map((a) => a.id);
      setSelectedAssetIds((prev) => {
        const existing = new Set(prev);
        const combined = [...prev];
        for (const id of filteredIds) {
          if (!existing.has(id)) combined.push(id);
        }
        return combined;
      });
    }
  };

  const clearFilters = () => {
    setAssetSearch("");
    setCategoryFilter("");
    setDateFrom("");
    setDateTo("");
  };

  const hasFilters = assetSearch || categoryFilter || dateFrom || dateTo;

  const handleGenerate = () => {
    if (selectedAssetIds.length === 0) {
      toast({ title: "Select at least one asset", variant: "destructive" });
      return;
    }
    if (!platform) {
      toast({ title: "Select a platform", variant: "destructive" });
      return;
    }

    setViewingSavedEmail(null);

    if (!platform) return;
    const body: {
      assetIds: number[];
      platform: GenerateEmailBodyPlatform;
      tone?: GenerateEmailBodyTone;
      callToAction?: string;
      recipientContext?: string;
    } = {
      assetIds: selectedAssetIds,
      platform,
    };
    if (tone) body.tone = tone;
    if (callToAction) body.callToAction = callToAction;
    if (recipientContext) body.recipientContext = recipientContext;

    generateMutation.mutate(
      { data: body },
      {
        onSuccess: (data) => {
          setGeneratedEmail(data);
          toast({ title: "Email generated successfully" });
        },
        onError: () => {
          toast({
            title: "Failed to generate email",
            variant: "destructive",
          });
        },
      },
    );
  };

  const handleSave = () => {
    if (!generatedEmail || !platform) return;
    saveMutation.mutate(
      {
        data: {
          platform: generatedEmail.platform,
          emailBody: generatedEmail.emailBody,
          subjectLineSuggestions: generatedEmail.subjectLineSuggestions,
          coachingTips: generatedEmail.coachingTips,
          assetTitles: generatedEmail.assetTitles,
          assetIds: selectedAssetIds,
          tone: tone || undefined,
          callToAction: callToAction || undefined,
          recipientContext: recipientContext || undefined,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["/api/email/saved"] });
          toast({ title: "Email saved successfully" });
        },
        onError: () => {
          toast({ title: "Failed to save email", variant: "destructive" });
        },
      },
    );
  };

  const handleDeleteSaved = (id: number) => {
    deleteMutation.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["/api/email/saved"] });
          if (viewingSavedEmail?.id === id) {
            setViewingSavedEmail(null);
            setGeneratedEmail(null);
          }
          toast({ title: "Saved email deleted" });
        },
        onError: () => {
          toast({ title: "Failed to delete email", variant: "destructive" });
        },
      },
    );
  };

  const handleViewSaved = (email: SavedEmail) => {
    setViewingSavedEmail(email);
    setGeneratedEmail({
      emailBody: email.emailBody,
      subjectLineSuggestions: email.subjectLineSuggestions,
      coachingTips: email.coachingTips,
      platform: email.platform,
      assetTitles: email.assetTitles,
    });
  };

  const handleCopy = async () => {
    if (!generatedEmail) return;
    try {
      await navigator.clipboard.writeText(generatedEmail.emailBody);
      setCopied(true);
      toast({ title: "Email copied to clipboard" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Failed to copy", variant: "destructive" });
    }
  };

  const displayEmail = generatedEmail;

  return (
    <AppLayout>
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
            <Mail className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">Email Generator</h1>
            <p className="text-sm text-muted-foreground">
              Generate AI-powered promotional emails for your content assets
            </p>
          </div>
          {savedEmails && savedEmails.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSavedEmails(!showSavedEmails)}
            >
              <Archive className="w-4 h-4 mr-1.5" />
              Saved ({savedEmails.length})
            </Button>
          )}
        </div>

        <AnimatePresence>
          {showSavedEmails && savedEmails && savedEmails.length > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <Card className="p-5">
                <h3 className="text-sm font-semibold mb-3">
                  Saved Emails ({savedEmails.length})
                </h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {savedEmails.map((email) => (
                    <div
                      key={email.id}
                      className={`border rounded-lg p-3 cursor-pointer hover:border-primary transition-colors ${viewingSavedEmail?.id === email.id ? "border-primary bg-accent/30" : ""}`}
                      onClick={() => handleViewSaved(email)}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {email.platform}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(email.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteSaved(email.id);
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {email.assetTitles.join(", ")}
                      </p>
                      <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                        {email.emailBody.substring(0, 120)}...
                      </p>
                    </div>
                  ))}
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="flex flex-col gap-4">
            <Card className="p-5">
              <h3 className="text-sm font-semibold mb-3">Select Assets</h3>
              <div className="space-y-3">
                <div
                  className="border rounded-lg p-3 cursor-pointer hover:border-primary transition-colors"
                  onClick={() => setShowAssetSelector(!showAssetSelector)}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      {selectedAssetIds.length === 0
                        ? "Click to select assets..."
                        : `${selectedAssetIds.length} asset${selectedAssetIds.length > 1 ? "s" : ""} selected`}
                    </span>
                    {showAssetSelector ? (
                      <ChevronUp className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                  {selectedAssetIds.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {selectedAssetIds.map((id) => {
                        const asset = activeAssets.find((a) => a.id === id);
                        return (
                          <Badge key={id} variant="secondary" className="text-xs">
                            {asset?.title || asset?.url || `Asset #${id}`}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleAsset(id);
                              }}
                              className="ml-1 hover:text-destructive"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </Badge>
                        );
                      })}
                    </div>
                  )}
                </div>

                <AnimatePresence>
                  {showAssetSelector && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-2 mb-2">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            placeholder="Search assets..."
                            value={assetSearch}
                            onChange={(e) => setAssetSearch(e.target.value)}
                            className="pl-9"
                          />
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                            <SelectTrigger className="text-xs h-8">
                              <SelectValue placeholder="Category" />
                            </SelectTrigger>
                            <SelectContent>
                              {categories?.map((cat) => (
                                <SelectItem key={cat.id} value={String(cat.id)}>
                                  {cat.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input
                            type="date"
                            value={dateFrom}
                            onChange={(e) => setDateFrom(e.target.value)}
                            placeholder="From"
                            className="text-xs h-8"
                          />
                          <Input
                            type="date"
                            value={dateTo}
                            onChange={(e) => setDateTo(e.target.value)}
                            placeholder="To"
                            className="text-xs h-8"
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={handleSelectAll}
                              disabled={filteredAssets.length === 0}
                            >
                              {allFilteredSelected ? (
                                <CheckSquare className="w-3.5 h-3.5 mr-1" />
                              ) : (
                                <Square className="w-3.5 h-3.5 mr-1" />
                              )}
                              {allFilteredSelected ? "Deselect All" : "Select All"}
                            </Button>
                            <span className="text-xs text-muted-foreground">
                              {filteredAssets.length} result{filteredAssets.length !== 1 ? "s" : ""}
                            </span>
                          </div>
                          {hasFilters && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-muted-foreground"
                              onClick={clearFilters}
                            >
                              <X className="w-3 h-3 mr-1" />
                              Clear
                            </Button>
                          )}
                        </div>
                      </div>
                      <div className="max-h-48 overflow-y-auto border rounded-lg divide-y">
                        {assetsLoading ? (
                          <div className="p-4 text-center">
                            <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                          </div>
                        ) : filteredAssets.length === 0 ? (
                          <div className="p-4 text-center text-sm text-muted-foreground">
                            No assets found
                          </div>
                        ) : (
                          filteredAssets.map((asset) => (
                            <label
                              key={asset.id}
                              className="flex items-center gap-3 p-2.5 hover:bg-accent cursor-pointer transition-colors"
                            >
                              <input
                                type="checkbox"
                                checked={selectedAssetIds.includes(asset.id)}
                                onChange={() => toggleAsset(asset.id)}
                                className="rounded border-muted-foreground"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="text-sm font-medium truncate">
                                  {asset.title || "Untitled"}
                                </div>
                                <div className="text-xs text-muted-foreground truncate flex items-center gap-2">
                                  <span className="truncate">{asset.url}</span>
                                  {asset.categoryName && (
                                    <Badge variant="outline" className="text-[10px] shrink-0">
                                      {asset.categoryName}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </label>
                          ))
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </Card>

            <Card className="p-5">
              <h3 className="text-sm font-semibold mb-3">Email Settings</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">
                    Target Platform <span className="text-destructive">*</span>
                  </label>
                  <Select value={platform} onValueChange={setPlatform}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select platform..." />
                    </SelectTrigger>
                    <SelectContent>
                      {PLATFORMS.map((p) => (
                        <SelectItem key={p.value} value={p.value}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-1.5 block">
                    Tone (optional)
                  </label>
                  <Select value={tone} onValueChange={setTone}>
                    <SelectTrigger>
                      <SelectValue placeholder="Default tone" />
                    </SelectTrigger>
                    <SelectContent>
                      {TONES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-1.5 block">
                    Call to Action (optional)
                  </label>
                  <Input
                    placeholder='e.g., "Schedule a demo today"'
                    value={callToAction}
                    onChange={(e) => setCallToAction(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-1.5 block">
                    Recipient Context (optional)
                  </label>
                  <Textarea
                    placeholder='e.g., "Enterprise prospects in the healthcare industry"'
                    value={recipientContext}
                    onChange={(e) => setRecipientContext(e.target.value)}
                    rows={2}
                  />
                </div>
              </div>
            </Card>

            <Button
              onClick={handleGenerate}
              disabled={
                generateMutation.isPending ||
                selectedAssetIds.length === 0 ||
                !platform
              }
              className="w-full"
              size="lg"
            >
              {generateMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4 mr-2" />
                  Generate Email
                </>
              )}
            </Button>
          </div>

          <div className="flex flex-col gap-4">
            {displayEmail ? (
              <>
                <Card className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="text-sm font-semibold">
                        {viewingSavedEmail ? "Saved Email" : "Generated Email"}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Platform: {displayEmail.platform}
                        {viewingSavedEmail && (
                          <> &middot; Saved {new Date(viewingSavedEmail.createdAt).toLocaleDateString()}</>
                        )}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {!viewingSavedEmail && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleSave}
                          disabled={saveMutation.isPending}
                        >
                          {saveMutation.isPending ? (
                            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                          ) : (
                            <Save className="w-3.5 h-3.5 mr-1.5" />
                          )}
                          Save
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleGenerate}
                        disabled={generateMutation.isPending}
                      >
                        <RefreshCw
                          className={`w-3.5 h-3.5 mr-1.5 ${generateMutation.isPending ? "animate-spin" : ""}`}
                        />
                        Regenerate
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleCopy}>
                        {copied ? (
                          <Check className="w-3.5 h-3.5 mr-1.5 text-green-500" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 mr-1.5" />
                        )}
                        {copied ? "Copied" : "Copy"}
                      </Button>
                    </div>
                  </div>

                  {displayEmail.subjectLineSuggestions.length > 0 && (
                    <div className="mb-4 p-3 bg-accent/50 rounded-lg">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                        Subject Line Suggestions
                      </h4>
                      <div className="space-y-1.5">
                        {displayEmail.subjectLineSuggestions.map(
                          (subject, i) => (
                            <div
                              key={i}
                              className="text-sm flex items-start gap-2"
                            >
                              <span className="text-muted-foreground font-mono text-xs mt-0.5">
                                {i + 1}.
                              </span>
                              <span>{subject}</span>
                            </div>
                          ),
                        )}
                      </div>
                    </div>
                  )}

                  {displayEmail.platform === "HubSpot Marketing Email" ? (
                    <div className="border rounded-lg bg-white dark:bg-gray-950 overflow-hidden">
                      <div className="flex items-center gap-2 px-4 py-2 bg-accent/30 border-b">
                        <Badge variant="outline" className="text-xs">HTML Preview</Badge>
                        <span className="text-xs text-muted-foreground">Structured content for {displayEmail.platform}</span>
                      </div>
                      <div
                        className="p-0 text-sm leading-relaxed max-w-none"
                        dangerouslySetInnerHTML={{
                          __html: DOMPurify.sanitize(displayEmail.emailBody, {
                            ALLOWED_TAGS: [
                              "h1", "h2", "h3", "h4", "h5", "h6",
                              "p", "br", "hr",
                              "ul", "ol", "li",
                              "strong", "em", "b", "i", "u",
                              "a", "span", "div",
                              "table", "thead", "tbody", "tr", "th", "td",
                              "img", "blockquote", "pre", "code",
                              "center",
                            ],
                            ALLOWED_ATTR: ["href", "src", "alt", "title", "class", "style", "target", "rel", "width", "height", "cellpadding", "cellspacing", "border", "align", "valign", "bgcolor", "role"],
                            ALLOW_DATA_ATTR: false,
                          }),
                        }}
                      />
                    </div>
                  ) : (
                    <div className="border rounded-lg p-4 bg-card">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className="text-xs">Plain Text</Badge>
                        <span className="text-xs text-muted-foreground">Ready to paste into {displayEmail.platform}</span>
                      </div>
                      <pre className="whitespace-pre-wrap text-sm font-sans leading-relaxed">
                        {displayEmail.emailBody}
                      </pre>
                    </div>
                  )}

                  {displayEmail.assetTitles.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <span className="text-xs text-muted-foreground mr-1">
                        Assets:
                      </span>
                      {displayEmail.assetTitles.map((title, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {title}
                        </Badge>
                      ))}
                    </div>
                  )}
                </Card>

                <Card className="p-5">
                  <button
                    className="flex items-center justify-between w-full"
                    onClick={() => setShowCoaching(!showCoaching)}
                  >
                    <div className="flex items-center gap-2">
                      <Lightbulb className="w-4 h-4 text-amber-500" />
                      <h3 className="text-sm font-semibold">
                        Platform Coaching Tips
                      </h3>
                    </div>
                    {showCoaching ? (
                      <ChevronUp className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    )}
                  </button>
                  <AnimatePresence>
                    {showCoaching && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <ul className="mt-3 space-y-2.5">
                          {displayEmail.coachingTips.map((tip, i) => (
                            <li
                              key={i}
                              className="text-sm text-muted-foreground flex items-start gap-2"
                            >
                              <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                              {tip}
                            </li>
                          ))}
                        </ul>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Card>
              </>
            ) : (
              <Card className="p-8 flex flex-col items-center justify-center text-center min-h-[300px]">
                <div className="w-16 h-16 rounded-2xl bg-accent/50 flex items-center justify-center mb-4">
                  <Mail className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">
                  Generate a Promotional Email
                </h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Select one or more assets from your library, choose a target
                  platform, and let AI create a ready-to-use promotional email
                  with coaching tips.
                </p>
              </Card>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
