import { Router, type IRouter } from "express";
import { eq, and, inArray } from "drizzle-orm";
import { db, assetsTable } from "@workspace/db";
import { GeneratePromotionalEmailBody } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";
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
  hubspot_marketing: `Generate a structured marketing email suitable for HubSpot Marketing Email.
- Use HTML-friendly content with clear sections
- Include placeholder markers like [CTA_BUTTON] for call-to-action buttons
- Reference asset images with markers like [IMAGE: asset_title]
- Use headers, bullet points, and clear visual hierarchy
- Include a compelling opening, value proposition sections, and a strong closing CTA
- Format for a broad audience newsletter style`,
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

    const groundingContext = await getGroundingContext(tenantId);

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

    const emailBody = emailBodyMatch
      ? emailBodyMatch[1].trim()
      : rawText.trim();

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

export default router;
