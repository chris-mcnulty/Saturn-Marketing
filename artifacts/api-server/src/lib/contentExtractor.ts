import { db, assetsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";
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

  const selectors = ["article", "main", "[role='main']"];
  for (const selector of selectors) {
    const el = $(selector);
    if (el.length) {
      const text = el.text().replace(/[^\S\r\n]+/g, " ").trim();
      if (text.length > 50) {
        return text.slice(0, 2000);
      }
    }
  }

  const paragraphs: string[] = [];
  $("p").each((_, el) => {
    const text = $(el).text().trim();
    if (text.length > 20) {
      paragraphs.push(text);
    }
  });

  if (paragraphs.length > 0) {
    return paragraphs.join(" ").slice(0, 2000);
  }

  const bodyText = $("body").text().replace(/[^\S\r\n]+/g, " ").trim();
  return bodyText.slice(0, 2000);
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
        const basePrompt = hasMetaDescription
          ? "You are a social media marketing expert. Generate a concise, engaging social media post caption (1-2 sentences) based on the following web page content. Make it compelling and shareable. Do not include hashtags."
          : "You are a social media marketing expert. Distill the following web page content into a concise, engaging social media post caption (1-2 sentences). Make it compelling and shareable. Do not include hashtags.";
        const systemPromptParts = [basePrompt];
        if (groundingContext) {
          systemPromptParts.push(groundingContext);
        }

        const userContent = hasMetaDescription
          ? `Page title: ${title || "Unknown"}\nPage description: ${textContent}\nURL: ${asset.url}`
          : `Page title: ${title || "Unknown"}\nPage content: ${textContent}\nURL: ${asset.url}`;

        const completion = await openai.chat.completions.create({
          model: "gpt-5-mini",
          max_completion_tokens: 200,
          messages: [
            {
              role: "system",
              content: systemPromptParts.join("\n\n"),
            },
            {
              role: "user",
              content: userContent,
            },
          ],
        });
        summaryText = completion.choices[0]?.message?.content || textContent;
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
