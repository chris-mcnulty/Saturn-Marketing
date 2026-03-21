import { db, assetsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import * as cheerio from "cheerio";
import { logger } from "./logger";
import { getGroundingContext } from "./groundingContext";

function sanitizeText(text: string): string {
  let cleaned = text.replace(/<[^>]*>/g, "");
  cleaned = cleaned.replace(/[^\P{Cc}\r\n]/gu, "");
  cleaned = cleaned.replace(/\0/g, "");
  return cleaned.trim();
}

function extractVisibleText($: cheerio.CheerioAPI): string {
  $("script, style, noscript, iframe, svg, head").remove();
  $("nav, header, footer, [role='navigation'], [role='banner'], [role='contentinfo']").remove();
  $(".nav, .navbar, .header, .footer, .sidebar, .menu, .breadcrumb, .cookie-banner").remove();

  const selectors = ["article", "main", "[role='main']", ".post-content", ".entry-content", ".page-content"];
  for (const selector of selectors) {
    const el = $(selector);
    if (el.length) {
      const text = el.text().replace(/[^\S\r\n]+/g, " ").trim();
      if (text.length > 50) {
        return text.slice(0, 3000);
      }
    }
  }

  const paragraphs: string[] = [];
  $("p").each((_, el) => {
    const text = $(el).text().trim();
    if (text.length > 30) {
      paragraphs.push(text);
    }
  });

  if (paragraphs.length > 0) {
    return paragraphs.join("\n").slice(0, 3000);
  }

  const bodyText = $("body").text().replace(/[^\S\r\n]+/g, " ").trim();
  return bodyText.slice(0, 3000);
}

export async function extractContent(assetId: number): Promise<void> {
  const [asset] = await db.select().from(assetsTable).where(eq(assetsTable.id, assetId));
  if (!asset) return;

  await db.update(assetsTable).set({ extractionStatus: "processing" }).where(eq(assetsTable.id, assetId));

  try {
    const response = await fetch(asset.url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; MarketingBot/1.0)",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const ogTitle = $('meta[property="og:title"]').attr("content");
    const ogDescription = $('meta[property="og:description"]').attr("content");
    const ogImage = $('meta[property="og:image"]').attr("content");
    const metaDescription = $('meta[name="description"]').attr("content");
    const pageTitle = $("title").text().trim();

    const title = asset.title || ogTitle || pageTitle || null;

    let imageUrl = ogImage || null;
    if (!imageUrl) {
      const firstImg = $("article img, main img, .content img, img").first().attr("src");
      if (firstImg) {
        try {
          imageUrl = new URL(firstImg, asset.url).href;
        } catch {
          imageUrl = firstImg;
        }
      }
    }

    const rawMetaText = ogDescription || metaDescription || "";
    const sanitizedMetaText = sanitizeText(rawMetaText);
    const hasMetaDescription = sanitizedMetaText.length > 0;
    const textContent = hasMetaDescription ? sanitizedMetaText : sanitizeText(extractVisibleText($));
    let summaryText = textContent;

    if (textContent) {
      try {
        const groundingContext = await getGroundingContext(asset.tenantId);
        const basePrompt = `You are a social media marketing expert writing post captions that will be published directly to social media platforms.

IMPORTANT RULES:
- Write 1-2 concise, engaging sentences that read as a standalone social media post.
- The caption must make sense on its own without any additional context.
- Do NOT include navigation text, page section headers, download links, file sizes, or website UI elements.
- Do NOT include hashtags — those are added separately.
- Do NOT start with the company or brand name unless it's essential to the message.
- Focus on the VALUE or KEY TAKEAWAY of the content — what would make someone want to click or engage.
- Write in an active, conversational tone appropriate for LinkedIn, Twitter/X, or Facebook.
- Output ONLY the caption text — no labels, no quotes, no preamble.`;
        const systemPromptParts = [basePrompt];
        if (groundingContext) {
          systemPromptParts.push(groundingContext);
        }

        const userContent = `Page title: ${title || "Unknown"}\nURL: ${asset.url}\n\nPage content (ignore navigation, headers, footers, and download links — focus on the main content):\n${textContent}`;

        const message = await anthropic.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 8192,
          system: systemPromptParts.join("\n\n"),
          messages: [
            {
              role: "user",
              content: userContent,
            },
          ],
        });
        const block = message.content[0];
        summaryText = (block.type === "text" ? block.text : null) || textContent;
      } catch (e) {
        logger.warn({ err: e }, "AI summary generation failed, using extracted text");
        summaryText = textContent;
      }
    }

    summaryText = summaryText ? sanitizeText(summaryText) : "";

    await db.update(assetsTable).set({
      title: title,
      summaryText: summaryText || null,
      suggestedImageUrl: imageUrl,
      extractionStatus: "completed",
    }).where(eq(assetsTable.id, assetId));
  } catch (e) {
    logger.error({ err: e, assetId }, "Content extraction failed");
    await db.update(assetsTable).set({ extractionStatus: "failed" }).where(eq(assetsTable.id, assetId));
  }
}
