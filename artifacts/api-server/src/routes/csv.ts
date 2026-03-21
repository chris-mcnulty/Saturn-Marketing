import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, campaignsTable, campaignAssetsTable, assetsTable, campaignSocialAccountsTable, socialAccountsTable, generatedPostsTable } from "@workspace/db";
import {
  GenerateCampaignPostsParams,
  ExportCampaignCsvParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { getGroundingContext } from "../lib/groundingContext";
import { logger } from "../lib/logger";

const router: IRouter = Router();

interface GenerationJob {
  status: "processing" | "complete" | "error";
  posts?: PostSlot[];
  error?: string;
  startedAt: number;
}

const generationJobs = new Map<string, GenerationJob>();

setInterval(() => {
  const now = Date.now();
  for (const [id, job] of generationJobs) {
    if (now - job.startedAt > 10 * 60 * 1000) {
      generationJobs.delete(id);
    }
  }
}, 60 * 1000);

async function runWithConcurrency<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < tasks.length) {
      const idx = nextIndex++;
      results[idx] = await tasks[idx]();
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, () => worker()));
  return results;
}

interface PostSlot {
  postContent: string;
  imageUrls: string | null;
  dateTime: string;
  accountId: string;
  firstComment: string | null;
  tags: string | null;
  assetId: number;
  assetTitle: string | null;
}

async function generateHashtags(
  postContent: string,
  assetTitle: string | null,
  assetUrl: string,
  groundingContext: string,
  existingHashtags: string[],
): Promise<string[]> {
  try {
    const systemPromptParts = [
      "You are a social media marketing expert specializing in hashtag strategy. Generate 3-5 contextually relevant hashtags for the given social media post. The hashtags should be specific to the post's content and topic, not generic.",
      "Rules:",
      "- Return ONLY the hashtags, one per line, each starting with #",
      "- Do NOT duplicate any of the existing campaign hashtags listed below",
      "- Keep hashtags concise and relevant",
      "- Use camelCase for multi-word hashtags (e.g., #ContentMarketing)",
      existingHashtags.length > 0
        ? `\nExisting campaign hashtags to AVOID duplicating: ${existingHashtags.join(" ")}`
        : "",
    ];
    if (groundingContext) {
      systemPromptParts.push(groundingContext);
    }

    const userContent = [
      `Post content: ${postContent}`,
      assetTitle ? `Asset title: ${assetTitle}` : "",
      `Asset URL: ${assetUrl}`,
    ]
      .filter(Boolean)
      .join("\n");

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 256,
      system: systemPromptParts.filter(Boolean).join("\n"),
      messages: [{ role: "user", content: userContent }],
    });
    const block = message.content[0];
    const text = block.type === "text" ? block.text : "";
    const existingLower = new Set(existingHashtags.map((h: string) => h.toLowerCase().replace(/#/g, "")));
    const hashtags = text
      .split("\n")
      .map((line: string) => line.trim())
      .filter((line: string) => line.startsWith("#"))
      .filter((line: string) => !existingLower.has(line.toLowerCase().replace(/#/g, "")))
      .slice(0, 5);
    return hashtags;
  } catch (e) {
    logger.warn({ err: e }, "AI hashtag generation failed, falling back to no generated hashtags");
    return [];
  }
}

async function generateVariation(originalText: string, groundingContext: string, hasTwitter: boolean = false): Promise<string> {
  try {
    const systemPromptParts = [
      "You are a social media marketing expert. Rewrite the following social media post with different wording while keeping the same core message. Make it sound fresh and engaging. Return only the rewritten post text, nothing else.",
    ];
    if (hasTwitter) {
      systemPromptParts.push("IMPORTANT: This post will be published on Twitter/X. The ENTIRE post including hashtags and URL MUST be 280 characters or fewer. Keep the message concise.");
    }
    if (groundingContext) {
      systemPromptParts.push(groundingContext);
    }

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      system: systemPromptParts.join("\n\n"),
      messages: [
        {
          role: "user",
          content: originalText,
        },
      ],
    });
    const block = message.content[0];
    return (block.type === "text" ? block.text : null) || originalText;
  } catch {
    return originalText;
  }
}

async function generatePosts(campaignId: number, tenantId: number): Promise<PostSlot[]> {
  const [campaign] = await db.select().from(campaignsTable)
    .where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.tenantId, tenantId)));

  if (!campaign) throw new Error("Campaign not found");

  const campaignAssets = await db.select({
    assetId: campaignAssetsTable.assetId,
    overrideSummaryText: campaignAssetsTable.overrideSummaryText,
    overrideImageUrl: campaignAssetsTable.overrideImageUrl,
    url: assetsTable.url,
    title: assetsTable.title,
    summaryText: assetsTable.summaryText,
    suggestedImageUrl: assetsTable.suggestedImageUrl,
    isActive: assetsTable.isActive,
    mentions: assetsTable.mentions,
    hashtags: assetsTable.hashtags,
  })
    .from(campaignAssetsTable)
    .innerJoin(assetsTable, eq(campaignAssetsTable.assetId, assetsTable.id))
    .where(eq(campaignAssetsTable.campaignId, campaignId));

  const activeAssets = campaignAssets.filter(a => a.isActive);
  if (activeAssets.length === 0) throw new Error("No active assets in campaign");

  const socialAccounts = await db.select({
    socialPilotAccountId: socialAccountsTable.socialPilotAccountId,
    platform: socialAccountsTable.platform,
  })
    .from(campaignSocialAccountsTable)
    .innerJoin(socialAccountsTable, eq(campaignSocialAccountsTable.socialAccountId, socialAccountsTable.id))
    .where(eq(campaignSocialAccountsTable.campaignId, campaignId));

  if (socialAccounts.length === 0) throw new Error("No social accounts assigned to campaign");

  const hasTwitter = socialAccounts.some(a => a.platform.toLowerCase() === "twitter" || a.platform.toLowerCase() === "x");

  const groundingContext = await getGroundingContext(tenantId);

  const postingTimesArr = campaign.postingTimes
    ? campaign.postingTimes.split(",").map((t: string) => t.trim())
    : generateDefaultTimes(campaign.postsPerDay);

  const campaignHashtags = campaign.hashtags
    ? campaign.hashtags.split(";").map((h: string) => h.trim()).filter(Boolean)
    : [];

  const VARIATIONS_PER_ASSET = 3;
  const AI_CONCURRENCY = 5;

  const aiStart = Date.now();
  const aiTasks = activeAssets.map((asset) => async () => {
    const postText = asset.overrideSummaryText || asset.summaryText || `Check out: ${asset.url}`;

    const [hashtags, ...variations] = await Promise.all([
      generateHashtags(postText, asset.title, asset.url, groundingContext, campaignHashtags),
      ...Array.from({ length: VARIATIONS_PER_ASSET }, () =>
        generateVariation(postText, groundingContext, hasTwitter)
      ),
    ]);

    return {
      assetId: asset.assetId,
      hashtags,
      variations: variations.filter((v) => v !== postText),
    };
  });

  const aiResults = await runWithConcurrency(aiTasks, AI_CONCURRENCY);
  logger.info({ assetCount: activeAssets.length, aiDurationMs: Date.now() - aiStart }, "AI pre-generation complete");

  const hashtagCache = new Map<number, string[]>();
  const variationCache = new Map<number, string[]>();
  for (const r of aiResults) {
    hashtagCache.set(r.assetId, r.hashtags);
    variationCache.set(r.assetId, r.variations);
  }

  let startDate: Date;
  if (typeof campaign.startDate === "string") {
    const parts = campaign.startDate.split("T")[0].split("-");
    startDate = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  } else {
    startDate = new Date(campaign.startDate);
  }
  const posts: PostSlot[] = [];
  const assetUsageCount = new Map<number, number>();

  const includeSaturday = campaign.includeSaturday ?? true;
  const includeSunday = campaign.includeSunday ?? true;

  for (let day = 0; day < campaign.durationDays; day++) {
    for (let postIdx = 0; postIdx < campaign.postsPerDay; postIdx++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(currentDate.getDate() + day);

      const dayOfWeek = currentDate.getDay();
      if (dayOfWeek === 0 && !includeSunday) continue;
      if (dayOfWeek === 6 && !includeSaturday) continue;

      const timeStr = postingTimesArr[postIdx % postingTimesArr.length] || "09:00";
      let [hours, minutes] = timeStr.split(":").map(Number);

      if (campaign.businessHoursOnly) {
        const [startH, startM] = (campaign.businessHoursStart || "09:00").split(":").map(Number);
        const [endH, endM] = (campaign.businessHoursEnd || "17:00").split(":").map(Number);
        const timeVal = (hours || 9) * 60 + (minutes || 0);
        const startVal = startH * 60 + startM;
        const endVal = endH * 60 + endM;
        if (timeVal < startVal) { hours = startH; minutes = startM; }
        if (timeVal >= endVal) {
          const lastMinute = endVal - 1;
          hours = Math.floor(lastMinute / 60);
          minutes = lastMinute % 60;
        }
      }

      currentDate.setHours(hours || 9, minutes || 0, 0, 0);

      const dateTimeStr = formatDateForSocialPilot(currentDate);

      const slotIndex = (day * campaign.postsPerDay + postIdx) % activeAssets.length;
      const selectedAsset = activeAssets[slotIndex];

      const postText = selectedAsset.overrideSummaryText || selectedAsset.summaryText || `Check out: ${selectedAsset.url}`;
      const imageUrl = selectedAsset.overrideImageUrl || selectedAsset.suggestedImageUrl || null;

      const usageCount = assetUsageCount.get(selectedAsset.assetId) || 0;
      let finalText = postText;

      if (usageCount > 0) {
        const variations = variationCache.get(selectedAsset.assetId) || [];
        if (variations.length > 0) {
          finalText = variations[(usageCount - 1) % variations.length];
        }
      }

      const assetMentions = selectedAsset.mentions
        ? selectedAsset.mentions.split(",").map((m: string) => m.trim()).filter(Boolean)
        : [];
      if (assetMentions.length > 0) {
        finalText = `${finalText}\n\n${assetMentions.join(" ")}`;
      }

      const assetHashtags = selectedAsset.hashtags
        ? selectedAsset.hashtags.split(",").map((h: string) => {
            const tag = h.trim();
            return tag.startsWith("#") ? tag : `#${tag}`;
          }).filter((h: string) => h !== "#")
        : [];

      if (campaignHashtags.length > 0 || assetHashtags.length > 0) {
        const allHashtags = [...campaignHashtags, ...assetHashtags];
        const uniqueHashtags = [...new Set(allHashtags)];
        const hashtagStr = uniqueHashtags.join(" ");
        if (!finalText.includes(hashtagStr)) {
          finalText = `${finalText}\n\n${hashtagStr}`;
        }
      }

      const generatedHashtags = hashtagCache.get(selectedAsset.assetId) || [];
      if (generatedHashtags.length > 0) {
        finalText = `${finalText} ${generatedHashtags.join(" ")}`;
      }

      finalText += `\n${selectedAsset.url}`;

      assetUsageCount.set(selectedAsset.assetId, usageCount + 1);

      const allTagsForCsv = [
        ...campaignHashtags.map((h: string) => h.replace(/#/g, "")),
        ...assetHashtags.map((h: string) => h.replace(/#/g, "")),
        ...generatedHashtags.map((h: string) => h.replace(/#/g, "")),
      ].filter(Boolean).join(";");

      for (const account of socialAccounts) {
        const isTwitterAccount = account.platform.toLowerCase() === "twitter" || account.platform.toLowerCase() === "x";
        let accountPostContent = finalText;
        if (isTwitterAccount && accountPostContent.length > 280) {
          const urlSuffix = `\n${selectedAsset.url}`;
          const mentionSection = assetMentions.length > 0 ? assetMentions.join(" ") : "";
          const hashtagSection = [
            ...campaignHashtags,
            ...assetHashtags,
            ...generatedHashtags,
          ].filter(Boolean).join(" ");
          const trailingSections = [mentionSection, hashtagSection].filter(Boolean).join(" ");
          const reservedLength = urlSuffix.length + (trailingSections ? trailingSections.length + 2 : 0);
          const maxBodyLength = 280 - reservedLength;
          const bodyParts = accountPostContent.split("\n\n");
          let body = bodyParts[0] || "";
          if (body.length > maxBodyLength) {
            body = body.substring(0, maxBodyLength - 1) + "…";
          }
          accountPostContent = trailingSections
            ? `${body}\n\n${trailingSections}${urlSuffix}`
            : `${body}${urlSuffix}`;
          if (accountPostContent.length > 280) {
            accountPostContent = accountPostContent.substring(0, 279) + "…";
          }
        }
        posts.push({
          postContent: accountPostContent,
          imageUrls: imageUrl,
          dateTime: dateTimeStr,
          accountId: account.socialPilotAccountId,
          firstComment: null,
          tags: allTagsForCsv || null,
          assetId: selectedAsset.assetId,
          assetTitle: selectedAsset.title,
        });
      }
    }
  }

  return posts.slice(0, 500);
}

function generateDefaultTimes(postsPerDay: number): string[] {
  const times: string[] = [];
  const startHour = 9;
  const endHour = 17;
  const interval = Math.floor((endHour - startHour) / postsPerDay);

  for (let i = 0; i < postsPerDay; i++) {
    const hour = startHour + (i * interval);
    times.push(`${hour.toString().padStart(2, "0")}:00`);
  }
  return times;
}

function formatDateForSocialPilot(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  const hours = date.getHours().toString().padStart(2, "0");
  const mins = date.getMinutes().toString().padStart(2, "0");
  return `${year}/${month}/${day} ${hours}:${mins}`;
}

function formatDateMMDDYYYY_HHMM(date: Date): string {
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  const year = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, "0");
  const mins = date.getMinutes().toString().padStart(2, "0");
  return `${month}/${day}/${year} ${hours}:${mins}`;
}

function formatDateISO_Local(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  const hours = date.getHours().toString().padStart(2, "0");
  const mins = date.getMinutes().toString().padStart(2, "0");
  const secs = date.getSeconds().toString().padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${mins}:${secs}`;
}

function csvEscape(val: string): string {
  return `"${(val || "").replace(/"/g, '""')}"`;
}

type CsvFormat = "socialpilot" | "hootsuite" | "sproutsocial" | "buffer";

function formatPostsToCsv(posts: PostSlot[], format: CsvFormat): string {
  const rows: string[] = [];

  switch (format) {
    case "hootsuite": {
      rows.push(["Date", "Time", "Message", "Media URLs"].join(","));
      for (const post of posts) {
        const rawDate = parseSocialPilotDate(post.dateTime);
        const datePart = rawDate ? formatDateMMDDYYYY_HHMM(rawDate).split(" ")[0] : post.dateTime.split(" ")[0] || "";
        const timePart = rawDate
          ? `${rawDate.getHours().toString().padStart(2, "0")}:${rawDate.getMinutes().toString().padStart(2, "0")}`
          : post.dateTime.split(" ")[1] || "";
        rows.push([
          csvEscape(datePart),
          csvEscape(timePart),
          csvEscape(post.postContent),
          csvEscape(post.imageUrls || ""),
        ].join(","));
      }
      break;
    }
    case "sproutsocial": {
      rows.push(["Text", "Image URL", "Publish Date", "Profile", "Tags"].join(","));
      for (const post of posts) {
        const rawDate = parseSocialPilotDate(post.dateTime);
        rows.push([
          csvEscape(post.postContent),
          csvEscape(post.imageUrls || ""),
          csvEscape(rawDate ? formatDateMMDDYYYY_HHMM(rawDate) : post.dateTime),
          csvEscape(post.accountId),
          csvEscape(post.tags?.replace(/;/g, ",") || ""),
        ].join(","));
      }
      break;
    }
    case "buffer": {
      rows.push(["Text", "Link", "Scheduled At", "Image URL"].join(","));
      for (const post of posts) {
        const rawDate = parseSocialPilotDate(post.dateTime);
        const linkMatch = post.postContent.match(/https?:\/\/[^\s]+$/m);
        const link = linkMatch ? linkMatch[0] : "";
        rows.push([
          csvEscape(post.postContent),
          csvEscape(link),
          csvEscape(rawDate ? formatDateISO_Local(rawDate) : post.dateTime),
          csvEscape(post.imageUrls || ""),
        ].join(","));
      }
      break;
    }
    case "socialpilot":
    default: {
      rows.push(["Post Content", "Image URL", "Date/Time", "Account ID", "First Comment", "Tags"].join(","));
      for (const post of posts) {
        rows.push([
          csvEscape(post.postContent),
          csvEscape(post.imageUrls || ""),
          csvEscape(post.dateTime),
          csvEscape(post.accountId),
          csvEscape(post.firstComment || ""),
          csvEscape(post.tags || ""),
        ].join(","));
      }
      break;
    }
  }

  return rows.join("\n");
}

function parseSocialPilotDate(dateStr: string): Date | null {
  const match = dateStr.match(/^(\d{4})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})$/);
  if (!match) return null;
  return new Date(
    parseInt(match[1]),
    parseInt(match[2]) - 1,
    parseInt(match[3]),
    parseInt(match[4]),
    parseInt(match[5]),
  );
}

router.get("/campaigns/:id/generated-posts", requireAuth, async (req, res): Promise<void> => {
  const params = GenerateCampaignPostsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const rows = await db.select().from(generatedPostsTable)
    .where(and(
      eq(generatedPostsTable.campaignId, params.data.id),
      eq(generatedPostsTable.tenantId, req.tenantId!),
    ))
    .orderBy(generatedPostsTable.id);

  const posts = rows.map(r => ({
    postContent: r.postContent,
    imageUrls: r.imageUrls,
    dateTime: r.dateTime,
    accountId: r.accountId,
    firstComment: r.firstComment,
    tags: r.tags,
    assetId: r.assetId,
    assetTitle: r.assetTitle,
  }));

  res.json(posts);
});

router.post("/campaigns/:id/generate-posts", requireAuth, async (req, res): Promise<void> => {
  const params = GenerateCampaignPostsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const jobId = `gen_${params.data.id}_${Date.now()}`;
  const campaignId = params.data.id;
  const tenantId = req.tenantId!;

  generationJobs.set(jobId, { status: "processing", startedAt: Date.now() });

  (async () => {
    try {
      const posts = await generatePosts(campaignId, tenantId);

      await db.delete(generatedPostsTable).where(and(
        eq(generatedPostsTable.campaignId, campaignId),
        eq(generatedPostsTable.tenantId, tenantId),
      ));

      if (posts.length > 0) {
        const rows = posts.map(p => ({
          campaignId,
          tenantId,
          postContent: p.postContent,
          imageUrls: p.imageUrls,
          dateTime: p.dateTime,
          accountId: p.accountId,
          firstComment: p.firstComment,
          tags: p.tags,
          assetId: p.assetId,
          assetTitle: p.assetTitle,
        }));

        const BATCH_SIZE = 100;
        for (let i = 0; i < rows.length; i += BATCH_SIZE) {
          await db.insert(generatedPostsTable).values(rows.slice(i, i + BATCH_SIZE));
        }
      }

      logger.info({ campaignId, postCount: posts.length, jobId }, "Generated posts saved");
      generationJobs.set(jobId, { status: "complete", posts, startedAt: Date.now() });
    } catch (e: any) {
      logger.error({ campaignId, jobId, err: e }, "Post generation failed");
      generationJobs.set(jobId, { status: "error", error: e.message, startedAt: Date.now() });
    }
  })();

  res.status(202).json({ jobId });
});

router.get("/campaigns/:id/generate-posts-status", requireAuth, async (req, res): Promise<void> => {
  const jobId = req.query.jobId as string;
  if (!jobId) {
    res.status(400).json({ error: "jobId query parameter required" });
    return;
  }

  const job = generationJobs.get(jobId);
  if (!job) {
    res.status(404).json({ error: "Job not found or expired" });
    return;
  }

  if (job.status === "complete") {
    generationJobs.delete(jobId);
    res.json({ status: "complete", posts: job.posts });
  } else if (job.status === "error") {
    generationJobs.delete(jobId);
    res.json({ status: "error", error: job.error });
  } else {
    res.json({ status: "processing" });
  }
});

router.post("/campaigns/:id/export-csv", requireAuth, async (req, res): Promise<void> => {
  const params = ExportCampaignCsvParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const validFormats: CsvFormat[] = ["socialpilot", "hootsuite", "sproutsocial", "buffer"];
  const format = (typeof req.query.format === "string" && validFormats.includes(req.query.format as CsvFormat))
    ? req.query.format as CsvFormat
    : "socialpilot";

  try {
    const savedRows = await db.select().from(generatedPostsTable)
      .where(and(
        eq(generatedPostsTable.campaignId, params.data.id),
        eq(generatedPostsTable.tenantId, req.tenantId!),
      ))
      .orderBy(generatedPostsTable.id);

    let posts: PostSlot[];
    if (savedRows.length > 0) {
      posts = savedRows.map(r => ({
        postContent: r.postContent,
        imageUrls: r.imageUrls,
        dateTime: r.dateTime,
        accountId: r.accountId,
        firstComment: r.firstComment,
        tags: r.tags,
        assetId: r.assetId,
        assetTitle: r.assetTitle,
      }));
    } else {
      posts = await generatePosts(params.data.id, req.tenantId!);
    }

    const csvContent = formatPostsToCsv(posts, format);

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="campaign_${params.data.id}_${format}.csv"`);
    res.send(csvContent);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default router;
