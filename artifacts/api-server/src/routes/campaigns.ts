import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, campaignsTable, campaignAssetsTable, assetsTable, categoriesTable, campaignSocialAccountsTable, socialAccountsTable } from "@workspace/db";
import {
  ListCampaignsQueryParams,
  CreateCampaignBody,
  GetCampaignParams,
  UpdateCampaignParams,
  UpdateCampaignBody,
  DeleteCampaignParams,
  ListCampaignAssetsParams,
  AddCampaignAssetParams,
  AddCampaignAssetBody,
  UpdateCampaignAssetParams,
  UpdateCampaignAssetBody,
  RemoveCampaignAssetParams,
  ListCampaignSocialAccountsParams,
  AddCampaignSocialAccountParams,
  AddCampaignSocialAccountBody,
  RemoveCampaignSocialAccountParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

const campaignAssetSelect = {
  campaignId: campaignAssetsTable.campaignId,
  assetId: campaignAssetsTable.assetId,
  overrideSummaryText: campaignAssetsTable.overrideSummaryText,
  overrideImageUrl: campaignAssetsTable.overrideImageUrl,
  asset: {
    id: assetsTable.id,
    tenantId: assetsTable.tenantId,
    url: assetsTable.url,
    title: assetsTable.title,
    categoryId: assetsTable.categoryId,
    categoryName: categoriesTable.name,
    isActive: assetsTable.isActive,
    summaryText: assetsTable.summaryText,
    suggestedImageUrl: assetsTable.suggestedImageUrl,
    extractionStatus: assetsTable.extractionStatus,
    createdAt: assetsTable.createdAt,
    updatedAt: assetsTable.updatedAt,
  },
};

router.get("/campaigns", requireAuth, async (req, res): Promise<void> => {
  const query = ListCampaignsQueryParams.safeParse(req.query);

  const conditions = [eq(campaignsTable.tenantId, req.tenantId!)];
  if (query.success && query.data.status) {
    conditions.push(eq(campaignsTable.status, query.data.status));
  }

  const campaigns = await db.select().from(campaignsTable)
    .where(and(...conditions))
    .orderBy(campaignsTable.createdAt);

  res.json(campaigns);
});

router.post("/campaigns", requireAuth, async (req, res): Promise<void> => {
  const body = { ...req.body };
  if (typeof body.startDate === "string") {
    const parts = body.startDate.split("-");
    body.startDate = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  }
  const parsed = CreateCampaignBody.safeParse(body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const isValidTime = (t: string) => {
    if (!/^\d{2}:\d{2}$/.test(t)) return false;
    const [h, m] = t.split(":").map(Number);
    return h >= 0 && h <= 23 && m >= 0 && m <= 59;
  };

  if (parsed.data.postingTimes) {
    const times = parsed.data.postingTimes.split(",").map((t: string) => t.trim()).filter(Boolean);
    for (const t of times) {
      if (!isValidTime(t)) {
        res.status(400).json({ error: `Invalid posting time format: ${t}. Must be HH:mm (00:00–23:59)` });
        return;
      }
    }
  }

  const bhStart = parsed.data.businessHoursStart || "09:00";
  const bhEnd = parsed.data.businessHoursEnd || "17:00";
  if (parsed.data.businessHoursStart && !isValidTime(bhStart)) {
    res.status(400).json({ error: "Business hours start must be in valid HH:mm format (00:00–23:59)" });
    return;
  }
  if (parsed.data.businessHoursEnd && !isValidTime(bhEnd)) {
    res.status(400).json({ error: "Business hours end must be in valid HH:mm format (00:00–23:59)" });
    return;
  }

  if (parsed.data.businessHoursOnly) {
    if (bhStart >= bhEnd) {
      res.status(400).json({ error: "Business hours start must be before end" });
      return;
    }
    if (parsed.data.postingTimes) {
      const times = parsed.data.postingTimes.split(",").map((t: string) => t.trim()).filter(Boolean);
      for (const t of times) {
        if (t < bhStart || t >= bhEnd) {
          res.status(400).json({ error: `Posting time ${t} is outside business hours (${bhStart}–${bhEnd})` });
          return;
        }
      }
    }
  }

  const [campaign] = await db.insert(campaignsTable).values({
    tenantId: req.tenantId!,
    name: parsed.data.name,
    description: parsed.data.description || null,
    startDate: parsed.data.startDate,
    durationDays: parsed.data.durationDays,
    postsPerDay: parsed.data.postsPerDay,
    postingTimes: parsed.data.postingTimes || null,
    hashtags: parsed.data.hashtags || null,
    repetitionIntervalDays: parsed.data.repetitionIntervalDays || 7,
    alwaysIncludeImages: parsed.data.alwaysIncludeImages || false,
    businessHoursOnly: parsed.data.businessHoursOnly ?? false,
    businessHoursStart: bhStart,
    businessHoursEnd: bhEnd,
    includeSaturday: parsed.data.includeSaturday ?? true,
    includeSunday: parsed.data.includeSunday ?? true,
  }).returning();

  res.status(201).json(campaign);
});

router.get("/campaigns/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetCampaignParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [campaign] = await db.select().from(campaignsTable)
    .where(and(eq(campaignsTable.id, params.data.id), eq(campaignsTable.tenantId, req.tenantId!)));

  if (!campaign) {
    res.status(404).json({ error: "Campaign not found" });
    return;
  }

  const assets = await db.select(campaignAssetSelect)
    .from(campaignAssetsTable)
    .innerJoin(assetsTable, eq(campaignAssetsTable.assetId, assetsTable.id))
    .leftJoin(categoriesTable, eq(assetsTable.categoryId, categoriesTable.id))
    .where(eq(campaignAssetsTable.campaignId, campaign.id));

  const socialAccounts = await db.select({
    id: socialAccountsTable.id,
    tenantId: socialAccountsTable.tenantId,
    platform: socialAccountsTable.platform,
    accountName: socialAccountsTable.accountName,
    socialPilotAccountId: socialAccountsTable.socialPilotAccountId,
    createdAt: socialAccountsTable.createdAt,
  })
    .from(campaignSocialAccountsTable)
    .innerJoin(socialAccountsTable, eq(campaignSocialAccountsTable.socialAccountId, socialAccountsTable.id))
    .where(eq(campaignSocialAccountsTable.campaignId, campaign.id));

  res.json({
    ...campaign,
    assets,
    socialAccounts,
  });
});

router.patch("/campaigns/:id", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateCampaignParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const updateBody = { ...req.body };
  if (typeof updateBody.startDate === "string") {
    const parts = updateBody.startDate.split("-");
    updateBody.startDate = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  }
  const parsed = UpdateCampaignBody.safeParse(updateBody);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existingCampaign] = await db.select().from(campaignsTable)
    .where(and(eq(campaignsTable.id, params.data.id), eq(campaignsTable.tenantId, req.tenantId!)));

  if (!existingCampaign) {
    res.status(404).json({ error: "Campaign not found" });
    return;
  }

  const isValidTime = (t: string) => {
    if (!/^\d{2}:\d{2}$/.test(t)) return false;
    const [h, m] = t.split(":").map(Number);
    return h >= 0 && h <= 23 && m >= 0 && m <= 59;
  };

  if (parsed.data.postingTimes) {
    const times = parsed.data.postingTimes.split(",").map((t: string) => t.trim()).filter(Boolean);
    for (const t of times) {
      if (!isValidTime(t)) {
        res.status(400).json({ error: `Invalid posting time format: ${t}. Must be HH:mm (00:00–23:59)` });
        return;
      }
    }
  }
  if (parsed.data.businessHoursStart !== undefined && !isValidTime(parsed.data.businessHoursStart)) {
    res.status(400).json({ error: "Business hours start must be in valid HH:mm format (00:00–23:59)" });
    return;
  }
  if (parsed.data.businessHoursEnd !== undefined && !isValidTime(parsed.data.businessHoursEnd)) {
    res.status(400).json({ error: "Business hours end must be in valid HH:mm format (00:00–23:59)" });
    return;
  }

  const effectiveBhOnly = parsed.data.businessHoursOnly ?? existingCampaign.businessHoursOnly;
  if (effectiveBhOnly) {
    const bhStart = parsed.data.businessHoursStart ?? existingCampaign.businessHoursStart;
    const bhEnd = parsed.data.businessHoursEnd ?? existingCampaign.businessHoursEnd;
    if (bhStart >= bhEnd) {
      res.status(400).json({ error: "Business hours start must be before end" });
      return;
    }
    const effectivePostingTimes = parsed.data.postingTimes !== undefined ? parsed.data.postingTimes : existingCampaign.postingTimes;
    if (effectivePostingTimes) {
      const times = effectivePostingTimes.split(",").map((t: string) => t.trim()).filter(Boolean);
      for (const t of times) {
        if (t < bhStart || t >= bhEnd) {
          res.status(400).json({ error: `Posting time ${t} is outside business hours (${bhStart}–${bhEnd})` });
          return;
        }
      }
    }
  }

  const [campaign] = await db.update(campaignsTable)
    .set(parsed.data)
    .where(and(eq(campaignsTable.id, params.data.id), eq(campaignsTable.tenantId, req.tenantId!)))
    .returning();

  if (!campaign) {
    res.status(404).json({ error: "Campaign not found" });
    return;
  }

  res.json(campaign);
});

router.delete("/campaigns/:id", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteCampaignParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db.delete(campaignsTable)
    .where(and(eq(campaignsTable.id, params.data.id), eq(campaignsTable.tenantId, req.tenantId!)))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Campaign not found" });
    return;
  }

  res.sendStatus(204);
});

router.get("/campaigns/:id/assets", requireAuth, async (req, res): Promise<void> => {
  const params = ListCampaignAssetsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const campaignAssets = await db.select(campaignAssetSelect)
    .from(campaignAssetsTable)
    .innerJoin(assetsTable, eq(campaignAssetsTable.assetId, assetsTable.id))
    .leftJoin(categoriesTable, eq(assetsTable.categoryId, categoriesTable.id))
    .where(eq(campaignAssetsTable.campaignId, params.data.id));

  res.json(campaignAssets);
});

router.post("/campaigns/:id/assets", requireAuth, async (req, res): Promise<void> => {
  const params = AddCampaignAssetParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = AddCampaignAssetBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db.select().from(campaignAssetsTable)
    .where(and(
      eq(campaignAssetsTable.campaignId, params.data.id),
      eq(campaignAssetsTable.assetId, parsed.data.assetId)
    ));

  if (existing) {
    res.status(400).json({ error: "Asset already in campaign" });
    return;
  }

  await db.insert(campaignAssetsTable).values({
    campaignId: params.data.id,
    assetId: parsed.data.assetId,
  });

  const campaignAssets = await db.select(campaignAssetSelect)
    .from(campaignAssetsTable)
    .innerJoin(assetsTable, eq(campaignAssetsTable.assetId, assetsTable.id))
    .leftJoin(categoriesTable, eq(assetsTable.categoryId, categoriesTable.id))
    .where(and(
      eq(campaignAssetsTable.campaignId, params.data.id),
      eq(campaignAssetsTable.assetId, parsed.data.assetId)
    ));

  res.status(201).json(campaignAssets[0]);
});

router.patch("/campaigns/:campaignId/assets/:assetId", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateCampaignAssetParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateCampaignAssetBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [updated] = await db.update(campaignAssetsTable)
    .set(parsed.data)
    .where(and(
      eq(campaignAssetsTable.campaignId, params.data.campaignId),
      eq(campaignAssetsTable.assetId, params.data.assetId)
    ))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Campaign asset not found" });
    return;
  }

  const result = await db.select(campaignAssetSelect)
    .from(campaignAssetsTable)
    .innerJoin(assetsTable, eq(campaignAssetsTable.assetId, assetsTable.id))
    .leftJoin(categoriesTable, eq(assetsTable.categoryId, categoriesTable.id))
    .where(and(
      eq(campaignAssetsTable.campaignId, params.data.campaignId),
      eq(campaignAssetsTable.assetId, params.data.assetId)
    ));

  res.json(result[0]);
});

router.delete("/campaigns/:campaignId/assets/:assetId", requireAuth, async (req, res): Promise<void> => {
  const params = RemoveCampaignAssetParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db.delete(campaignAssetsTable)
    .where(and(
      eq(campaignAssetsTable.campaignId, params.data.campaignId),
      eq(campaignAssetsTable.assetId, params.data.assetId)
    ))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Campaign asset not found" });
    return;
  }

  res.sendStatus(204);
});

router.get("/campaigns/:id/social-accounts", requireAuth, async (req, res): Promise<void> => {
  const params = ListCampaignSocialAccountsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const accounts = await db.select({
    id: socialAccountsTable.id,
    tenantId: socialAccountsTable.tenantId,
    platform: socialAccountsTable.platform,
    accountName: socialAccountsTable.accountName,
    socialPilotAccountId: socialAccountsTable.socialPilotAccountId,
    createdAt: socialAccountsTable.createdAt,
  })
    .from(campaignSocialAccountsTable)
    .innerJoin(socialAccountsTable, eq(campaignSocialAccountsTable.socialAccountId, socialAccountsTable.id))
    .where(eq(campaignSocialAccountsTable.campaignId, params.data.id));

  res.json(accounts);
});

router.post("/campaigns/:id/social-accounts", requireAuth, async (req, res): Promise<void> => {
  const params = AddCampaignSocialAccountParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = AddCampaignSocialAccountBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db.select().from(campaignSocialAccountsTable)
    .where(and(
      eq(campaignSocialAccountsTable.campaignId, params.data.id),
      eq(campaignSocialAccountsTable.socialAccountId, parsed.data.socialAccountId)
    ));

  if (existing) {
    res.status(400).json({ error: "Social account already in campaign" });
    return;
  }

  await db.insert(campaignSocialAccountsTable).values({
    campaignId: params.data.id,
    socialAccountId: parsed.data.socialAccountId,
  });

  res.status(201).json({ message: "Social account added to campaign" });
});

router.delete("/campaigns/:campaignId/social-accounts/:accountId", requireAuth, async (req, res): Promise<void> => {
  const params = RemoveCampaignSocialAccountParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db.delete(campaignSocialAccountsTable)
    .where(and(
      eq(campaignSocialAccountsTable.campaignId, params.data.campaignId),
      eq(campaignSocialAccountsTable.socialAccountId, params.data.accountId)
    ))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Campaign social account not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
