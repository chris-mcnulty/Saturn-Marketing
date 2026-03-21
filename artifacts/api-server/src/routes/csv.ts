import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, campaignsTable, campaignAssetsTable, assetsTable, campaignSocialAccountsTable, socialAccountsTable } from "@workspace/db";
import {
  GenerateCampaignPostsParams,
  ExportCampaignCsvParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { getGroundingContext } from "../lib/groundingContext";
import { logger } from "../lib/logger";

const router: IRouter = Router();

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

async function generateVariation(originalText: string, groundingContext: string): Promise<string> {
  try {
    const systemPromptParts = [
      "You are a social media marketing expert. Rewrite the following social media post with different wording while keeping the same core message. Make it sound fresh and engaging. Return only the rewritten post text, nothing else.",
    ];
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
  })
    .from(campaignAssetsTable)
    .innerJoin(assetsTable, eq(campaignAssetsTable.assetId, assetsTable.id))
    .where(eq(campaignAssetsTable.campaignId, campaignId));

  const activeAssets = campaignAssets.filter(a => a.isActive);
  if (activeAssets.length === 0) throw new Error("No active assets in campaign");

  const socialAccounts = await db.select({
    socialPilotAccountId: socialAccountsTable.socialPilotAccountId,
  })
    .from(campaignSocialAccountsTable)
    .innerJoin(socialAccountsTable, eq(campaignSocialAccountsTable.socialAccountId, socialAccountsTable.id))
    .where(eq(campaignSocialAccountsTable.campaignId, campaignId));

  if (socialAccounts.length === 0) throw new Error("No social accounts assigned to campaign");

  const groundingContext = await getGroundingContext(tenantId);

  const postingTimesArr = campaign.postingTimes
    ? campaign.postingTimes.split(",").map((t: string) => t.trim())
    : generateDefaultTimes(campaign.postsPerDay);

  const startDate = new Date(campaign.startDate);
  const posts: PostSlot[] = [];
  const assetUsageTracker: Map<number, Date> = new Map();

  for (let day = 0; day < campaign.durationDays; day++) {
    for (let postIdx = 0; postIdx < campaign.postsPerDay; postIdx++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(currentDate.getDate() + day);

      const timeStr = postingTimesArr[postIdx % postingTimesArr.length] || "09:00";
      const [hours, minutes] = timeStr.split(":").map(Number);
      currentDate.setHours(hours || 9, minutes || 0, 0, 0);

      const dateTimeStr = formatDateForSocialPilot(currentDate);

      let selectedAsset = null;
      for (const asset of activeAssets) {
        const lastUsed = assetUsageTracker.get(asset.assetId);
        if (!lastUsed) {
          selectedAsset = asset;
          break;
        }
        const daysSinceUse = Math.floor((currentDate.getTime() - lastUsed.getTime()) / (1000 * 60 * 60 * 24));
        if (daysSinceUse >= campaign.repetitionIntervalDays) {
          selectedAsset = asset;
          break;
        }
      }

      if (!selectedAsset) {
        const slotIndex = (day * campaign.postsPerDay + postIdx) % activeAssets.length;
        selectedAsset = activeAssets[slotIndex];
      }

      const postText = selectedAsset.overrideSummaryText || selectedAsset.summaryText || `Check out: ${selectedAsset.url}`;
      const imageUrl = selectedAsset.overrideImageUrl || selectedAsset.suggestedImageUrl || null;

      const isReuse = assetUsageTracker.has(selectedAsset.assetId);
      let finalText = postText;
      if (isReuse) {
        finalText = await generateVariation(postText, groundingContext);
      }

      const campaignHashtags = campaign.hashtags
        ? campaign.hashtags.split(";").map((h: string) => h.trim()).filter(Boolean)
        : [];

      if (campaignHashtags.length > 0) {
        const hashtagStr = campaignHashtags.join(" ");
        if (!finalText.includes(hashtagStr)) {
          finalText = `${finalText}\n\n${hashtagStr}`;
        }
      }

      const generatedHashtags = await generateHashtags(
        finalText,
        selectedAsset.title,
        selectedAsset.url,
        groundingContext,
        campaignHashtags,
      );

      if (generatedHashtags.length > 0) {
        finalText = `${finalText} ${generatedHashtags.join(" ")}`;
      }

      finalText += `\n${selectedAsset.url}`;

      assetUsageTracker.set(selectedAsset.assetId, currentDate);

      const allTagsForCsv = [
        ...campaignHashtags.map((h: string) => h.replace(/#/g, "")),
        ...generatedHashtags.map((h: string) => h.replace(/#/g, "")),
      ].filter(Boolean).join(";");

      for (const account of socialAccounts) {
        posts.push({
          postContent: finalText,
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

router.post("/campaigns/:id/generate-posts", requireAuth, async (req, res): Promise<void> => {
  const params = GenerateCampaignPostsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  try {
    const posts = await generatePosts(params.data.id, req.tenantId!);
    res.json(posts);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.post("/campaigns/:id/export-csv", requireAuth, async (req, res): Promise<void> => {
  const params = ExportCampaignCsvParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  try {
    const posts = await generatePosts(params.data.id, req.tenantId!);

    const headers = ["Post Content", "Image URL", "Date/Time", "Account ID", "First Comment", "Tags"];
    const csvRows = [headers.join(",")];

    for (const post of posts) {
      const row = [
        `"${(post.postContent || "").replace(/"/g, '""')}"`,
        `"${post.imageUrls || ""}"`,
        `"${post.dateTime}"`,
        `"${post.accountId}"`,
        `"${post.firstComment || ""}"`,
        `"${post.tags || ""}"`,
      ];
      csvRows.push(row.join(","));
    }

    const csvContent = csvRows.join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="campaign_${params.data.id}_posts.csv"`);
    res.send(csvContent);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default router;
