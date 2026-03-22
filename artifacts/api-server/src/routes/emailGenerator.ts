import { Router, type IRouter } from "express";
import { eq, and, inArray, desc } from "drizzle-orm";
import { db, assetsTable, generatedEmailsTable } from "@workspace/db";
import { GeneratePromotionalEmailBody, SaveGeneratedEmailBody } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";
import { validateMarketOwnership } from "../lib/validateMarket";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { getGroundingContext } from "../lib/groundingContext";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const PLATFORM_LABELS: Record<string, string> = {
  outlook: "Outlook",
  hubspot_marketing: "HubSpot Marketing Email",
  hubspot_1to1: "HubSpot 1:1 Email",
  dynamics_customer: "Dynamics 365 Customer Email",
};

const PLATFORM_INSTRUCTIONS: Record<string, string> = {
  outlook: `Generate a clean plain-text email suitable for direct paste into Microsoft Outlook compose window.
- Use clear section breaks with blank lines
- No HTML tags
- Use plain text formatting (dashes for bullets, ALL CAPS for headers if needed)
- Keep it professional and scannable
- Include a clear call-to-action`,
  hubspot_marketing: `Generate a structured marketing email as an HTML fragment for HubSpot Marketing Email.
CRITICAL HTML RULES:
- Output ONLY the inner email content — do NOT include <html>, <head>, <body>, <meta>, or <!DOCTYPE> tags. HubSpot provides the document wrapper.
- Every opening tag MUST have a matching closing tag. Every <table> needs </table>, every <tr> needs </tr>, every <td> needs </td>.
- Use a single outer <table> with width="100%" and max-width 600px centered, with cellpadding="0" cellspacing="0".
- Use inline CSS styles on every element (no <style> blocks — HubSpot strips them).
- For CTA buttons: use an <a> tag styled as a button with inline styles: display:inline-block; padding:12px 28px; background-color:#810FFB; color:#ffffff; text-decoration:none; border-radius:6px; font-weight:bold; font-size:16px;
- Do NOT use [CTA_BUTTON] or [IMAGE: ...] placeholder markers. Use real <a> tags for buttons and real <img> tags for images.
- Keep padding minimal: use padding:16px on content cells, padding:0 on the outer table.
- Use font-family: Arial, Helvetica, sans-serif throughout.
- Include a compelling opening, value proposition sections, and a strong closing CTA button.
- Format for a broad audience newsletter style.
- Double-check that ALL table, tr, and td tags are properly closed before returning.`,
  hubspot_1to1: `Generate a conversational, personal email as if writing to one individual person.
- Keep it short and personal (3-5 paragraphs max)
- Use a warm, human tone — not templated
- No HTML formatting, just plain text
- Reference the content naturally as if recommending it to a colleague
- End with a soft, personal call-to-action (not salesy)`,
  dynamics_customer: `Generate a professional CRM-style email for Dynamics 365 Customer Email.
- Keep it concise and business-focused
- Include clear next steps or action items
- Use professional formatting with short paragraphs
- Reference specific assets/resources with clear value propositions
- Include a professional sign-off`,
};

const PLATFORM_COACHING: Record<string, string[]> = {
  outlook: [
    "Subject lines: Keep under 50 characters. Use action verbs and specific numbers when possible.",
    "Send timing: Tuesday-Thursday mornings (9-11 AM) typically see highest open rates for B2B emails.",
    "Personalization: Start with the recipient's name. Reference a recent interaction or shared context.",
    "Format: Outlook strips most HTML formatting. Stick to plain text with clear line breaks.",
    "Follow-up: If no response in 3-5 business days, send a brief follow-up referencing your original email.",
    "Attachments: Link to assets rather than attaching files to avoid spam filters.",
  ],
  hubspot_marketing: [
    "Subject lines: A/B test 2-3 variants. Use personalization tokens like {{first_name}} in subject lines.",
    "Preview text: Write compelling preview text (40-130 chars) that complements your subject line.",
    "Send timing: Use HubSpot's smart send feature to optimize delivery time per recipient.",
    "Images: Ensure images have alt text. Some email clients block images by default.",
    "CTAs: Use one primary CTA button above the fold. Secondary CTAs can go lower.",
    "List segmentation: Send to targeted segments rather than your entire database for better engagement.",
    "Mobile: Over 60% of emails are opened on mobile. Preview your email on mobile before sending.",
  ],
  hubspot_1to1: [
    "Subject lines: Keep casual and specific. 'Quick thought on [topic]' outperforms generic subjects.",
    "Length: Keep under 200 words. 1:1 emails that are too long feel like marketing emails.",
    "Personalization: Reference something specific about the recipient — their company, role, or recent activity.",
    "Tone: Write like you'd write to a colleague, not a lead. Avoid marketing speak.",
    "CTA: Ask one question or suggest one specific next step. Multiple asks reduce response rates.",
    "Timing: Send during business hours in the recipient's timezone. Avoid Mondays and Fridays.",
  ],
  dynamics_customer: [
    "Subject lines: Include the company name and a specific topic. Keep professional and direct.",
    "CRM tracking: Log the email as an activity in the contact/account record for team visibility.",
    "Templates: Save successful emails as Dynamics templates for consistent team communication.",
    "Follow-up: Set a follow-up task/reminder when sending the email for proper pipeline management.",
    "Personalization: Use Dynamics merge fields to personalize at scale while maintaining a personal feel.",
    "Compliance: Ensure the email complies with your organization's communication policies and data retention rules.",
  ],
};

router.post("/email/generate", requireAuth, async (req, res): Promise<void> => {
  const parsed = GeneratePromotionalEmailBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { assetIds, platform, tone, callToAction, recipientContext } = parsed.data;
  const tenantId = req.tenantId!;
  const marketId = parsed.data.marketId ?? undefined;

  try {
    const assets = await db
      .select({
        id: assetsTable.id,
        title: assetsTable.title,
        url: assetsTable.url,
        summaryText: assetsTable.summaryText,
        suggestedImageUrl: assetsTable.suggestedImageUrl,
      })
      .from(assetsTable)
      .where(
        and(
          eq(assetsTable.tenantId, tenantId),
          inArray(assetsTable.id, assetIds),
        ),
      );

    if (assets.length === 0) {
      res.status(400).json({ error: "No matching assets found" });
      return;
    }

    const foundIds = new Set(assets.map((a) => a.id));
    const missingIds = assetIds.filter((id) => !foundIds.has(id));
    if (missingIds.length > 0) {
      res.status(400).json({
        error: `Assets not found or not accessible: ${missingIds.join(", ")}`,
      });
      return;
    }

    const groundingContext = await getGroundingContext(tenantId, marketId);

    const assetSummaries = assets
      .map((a) => {
        const parts = [`Asset: ${a.title || "Untitled"}`, `URL: ${a.url}`];
        if (a.summaryText) parts.push(`Summary: ${a.summaryText}`);
        if (a.suggestedImageUrl) parts.push(`Image: ${a.suggestedImageUrl}`);
        return parts.join("\n");
      })
      .join("\n\n");

    const platformLabel = PLATFORM_LABELS[platform] || platform;
    const platformInstructions = PLATFORM_INSTRUCTIONS[platform] || "";

    const systemParts = [
      `You are an expert email marketing copywriter. Generate a promotional email for the ${platformLabel} platform.`,
      platformInstructions,
      tone ? `Tone: ${tone}` : "",
      callToAction ? `Include this call-to-action: ${callToAction}` : "",
      recipientContext
        ? `The recipients are: ${recipientContext}. Tailor the messaging accordingly.`
        : "",
      groundingContext || "",
      "",
      "IMPORTANT: Return your response in the following exact format:",
      "---EMAIL_BODY_START---",
      "(the email body here)",
      "---EMAIL_BODY_END---",
      "---SUBJECT_LINES_START---",
      "(3 subject line suggestions, one per line)",
      "---SUBJECT_LINES_END---",
    ];

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: systemParts.filter(Boolean).join("\n"),
      messages: [
        {
          role: "user",
          content: `Generate a promotional email featuring the following assets:\n\n${assetSummaries}`,
        },
      ],
    });

    const rawText = message.content
      .filter((block) => block.type === "text")
      .map((block) => (block as { type: "text"; text: string }).text)
      .join("\n");

    const emailBodyMatch = rawText.match(
      /---EMAIL_BODY_START---([\s\S]*?)---EMAIL_BODY_END---/,
    );
    const subjectLinesMatch = rawText.match(
      /---SUBJECT_LINES_START---([\s\S]*?)---SUBJECT_LINES_END---/,
    );

    let emailBody = emailBodyMatch
      ? emailBodyMatch[1].trim()
      : rawText.trim();

    if (platform === "hubspot_marketing" || platform === "hubspot_1to1") {
      emailBody = emailBody
        .replace(/<\/?html[^>]*>/gi, "")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<\/?head[^>]*>[\s\S]*?<\/head>/gi, "")
        .replace(/<head[^>]*>[\s\S]*$/gi, "")
        .replace(/<\/?body[^>]*>/gi, "")
        .replace(/<\/?meta[^>]*>/gi, "")
        .replace(/<!DOCTYPE[^>]*>/gi, "")
        .trim();

      emailBody = emailBody.replace(
        /\[CTA_BUTTON[:\s]*["']?([^"'\]]+)["']?\s*(?:[-–—]\s*(?:https?:\/\/\S+))?\]/gi,
        (_, label) => {
          return `<a href="#" style="display:inline-block;padding:12px 28px;background-color:#810FFB;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:bold;font-size:16px;font-family:Arial,Helvetica,sans-serif;">${label.trim()}</a>`;
        },
      );
      emailBody = emailBody.replace(
        /\[CTA_BUTTON\]/gi,
        '<a href="#" style="display:inline-block;padding:12px 28px;background-color:#810FFB;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:bold;font-size:16px;font-family:Arial,Helvetica,sans-serif;">Learn More</a>',
      );
      emailBody = emailBody.replace(
        /\[IMAGE:\s*([^\]]+)\]/gi,
        (_, alt) => `<img src="" alt="${alt.trim()}" style="max-width:100%;height:auto;display:block;" />`,
      );

      const countOpen = (tag: string) => (emailBody.match(new RegExp(`<${tag}[\\s>]`, "gi")) || []).length;
      const countClose = (tag: string) => (emailBody.match(new RegExp(`</${tag}>`, "gi")) || []).length;

      for (const tag of ["table", "tr", "td", "th", "thead", "tbody"]) {
        const opens = countOpen(tag);
        const closes = countClose(tag);
        if (opens > closes) {
          for (let i = 0; i < opens - closes; i++) {
            emailBody += `</${tag}>`;
          }
        }
      }
    }

    const subjectLineSuggestions = subjectLinesMatch
      ? subjectLinesMatch[1]
          .trim()
          .split("\n")
          .map((l: string) => l.replace(/^\d+[\.\)]\s*/, "").trim())
          .filter(Boolean)
      : ["Check out our latest content", "Something new for you", "Don't miss this"];

    const coachingTips = PLATFORM_COACHING[platform] || [];

    const assetTitles = assets.map((a) => a.title || "Untitled");

    res.json({
      emailBody,
      subjectLineSuggestions,
      coachingTips,
      platform: platformLabel,
      assetTitles,
    });
  } catch (err) {
    logger.error({ err }, "Email generation failed");
    res.status(500).json({ error: "Failed to generate email" });
  }
});

router.get("/email/saved", requireAuth, async (req, res): Promise<void> => {
  const tenantId = req.tenantId!;
  try {
    const conditions = [eq(generatedEmailsTable.tenantId, tenantId)];

    if (req.query.market_id) {
      const marketId = parseInt(req.query.market_id as string);
      if (!isNaN(marketId)) {
        conditions.push(eq(generatedEmailsTable.marketId, marketId));
      }
    }

    const emails = await db
      .select()
      .from(generatedEmailsTable)
      .where(and(...conditions))
      .orderBy(desc(generatedEmailsTable.createdAt));
    res.json(emails);
  } catch (err) {
    logger.error({ err }, "Failed to list saved emails");
    res.status(500).json({ error: "Failed to list saved emails" });
  }
});

router.post("/email/saved", requireAuth, async (req, res): Promise<void> => {
  const parsed = SaveGeneratedEmailBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const tenantId = req.tenantId!;
  const data = parsed.data;

  try {
    const marketId = parsed.data.marketId ?? null;
    if (marketId && !(await validateMarketOwnership(marketId, tenantId))) {
      res.status(400).json({ error: "Invalid market" });
      return;
    }

    const [saved] = await db
      .insert(generatedEmailsTable)
      .values({
        tenantId,
        marketId,
        platform: data.platform,
        emailBody: data.emailBody,
        subjectLineSuggestions: data.subjectLineSuggestions,
        coachingTips: data.coachingTips,
        assetTitles: data.assetTitles,
        assetIds: data.assetIds,
        tone: data.tone ?? null,
        callToAction: data.callToAction ?? null,
        recipientContext: data.recipientContext ?? null,
      })
      .returning();
    res.status(201).json(saved);
  } catch (err) {
    logger.error({ err }, "Failed to save email");
    res.status(500).json({ error: "Failed to save email" });
  }
});

router.delete("/email/saved/:id", requireAuth, async (req, res): Promise<void> => {
  const tenantId = req.tenantId!;
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  try {
    const deleted = await db
      .delete(generatedEmailsTable)
      .where(
        and(
          eq(generatedEmailsTable.id, id),
          eq(generatedEmailsTable.tenantId, tenantId),
        ),
      )
      .returning();
    if (deleted.length === 0) {
      res.status(404).json({ error: "Email not found" });
      return;
    }
    res.status(204).send();
  } catch (err) {
    logger.error({ err }, "Failed to delete email");
    res.status(500).json({ error: "Failed to delete email" });
  }
});

export default router;
