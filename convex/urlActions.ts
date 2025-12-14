"use node";

import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

// PARA Classification Prompt for Links
const LINK_CLASSIFICATION_PROMPT = `You are a PARA classification system for web links/resources. PARA stands for Projects, Areas, Resources, and Archive.

Given a link with its title and context, classify it into exactly ONE bucket:

**Project**: Time-bounded outcome with specific steps. Has a clear end goal and deadline. Examples:
- "Tutorial: Build a React App in 30 Days" → Project, subcategory: project name (e.g., "Learning React")
- "Workshop registration: AI Bootcamp 2025" → Project, subcategory: "AI Bootcamp"
- "Implementation guide for X feature" → Project, subcategory: project name

**Area**: Ongoing responsibility or sphere of activity. No end date, requires continuous attention. Examples:
- "Best practices for team management" → Area, subcategory: "Management"
- "Health and wellness resources" → Area, subcategory: "Health"
- "Continuous learning materials" → Area, subcategory: "Learning"

**Resource**: Reference material, learning content, or inspiration. Things you want to learn from or refer back to. Examples:
- GitHub repos/tools → Resource, subcategory: "Tools" or "Development"
- Research papers → Resource, subcategory: "Research" or "Learning"
- Articles/blog posts → Resource, subcategory: "Learning" or specific topic
- Design/CSS frameworks → Resource, subcategory: "Design" or "Development"

**Archive**: No future value, completed, or no longer relevant.

IMPORTANT: Provide a subcategory with emoji prefix to group related items:
- For Projects/Areas: Use the project/area name with emoji (e.g., "🏥 givecare", "🚀 scty", "🌐 personal-website")
- For Resources: Use a topic category with emoji (e.g., "🛠️ Tools", "📖 Learning", "🤖 AI Research", "💻 Development", "🎨 Design", "👨‍⚕️ Caregiving")

Return ONLY valid JSON in this exact format:
{
  "summary": "One high-signal line (8-16 words) stating the core claim/insight; never mention 'abstract', 'arXiv', or paper IDs",
  "tags": ["tag1", "tag2"],
  "subcategory": "emoji + category name for grouping (e.g., '🛠️ Tools')",
  "para": {
    "bucket": "Project|Area|Resource|Archive",
    "name": "short label or null",
    "reason": "1-2 sentence explanation"
  }
}`;

// Check if URL is a Twitter/X tweet
function isTweetUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    return (hostname.includes("twitter.com") || hostname.includes("x.com")) &&
           parsed.pathname.includes("/status/");
  } catch {
    return false;
  }
}

// Extract links from a tweet using Twitter's oEmbed API
async function extractLinksFromTweet(tweetUrl: string): Promise<string[]> {
  try {
    const axios = (await import("axios")).default;

    // Normalize URL (x.com -> twitter.com for oEmbed)
    const normalizedUrl = tweetUrl.replace("x.com", "twitter.com");

    // Use Twitter's oEmbed API to get tweet HTML
    const oEmbedUrl = `https://publish.twitter.com/oembed?url=${encodeURIComponent(normalizedUrl)}&omit_script=true`;
    console.log(`Fetching tweet oEmbed: ${oEmbedUrl}`);

    const response = await axios.get(oEmbedUrl, { timeout: 10000 });
    const html = response.data?.html || "";

    // Extract all URLs from the tweet HTML
    // Look for links that aren't twitter.com (external links)
    const linkRegex = /href="(https?:\/\/[^"]+)"/g;
    const links: string[] = [];
    let match;

    while ((match = linkRegex.exec(html)) !== null) {
      const link = match[1];
      // Skip twitter/x.com internal links (hashtags, mentions, etc.)
      if (!link.includes("twitter.com") && !link.includes("x.com")) {
        links.push(link);
      }
    }

    // Also look for t.co links and resolve them
    const tcoRegex = /https?:\/\/t\.co\/[a-zA-Z0-9]+/g;
    const tcoLinks = html.match(tcoRegex) || [];

    for (const tcoLink of tcoLinks) {
      try {
        // Resolve t.co redirect to get actual URL
        const resolved = await axios.head(tcoLink, {
          timeout: 5000,
          maxRedirects: 5,
          validateStatus: () => true,
        });
        const finalUrl = resolved.request?.res?.responseUrl || resolved.headers?.location;
        if (finalUrl && !finalUrl.includes("twitter.com") && !finalUrl.includes("x.com") && !finalUrl.includes("t.co")) {
          links.push(finalUrl);
        }
      } catch (e) {
        console.warn(`Failed to resolve t.co link: ${tcoLink}`);
      }
    }

    // Deduplicate
    const uniqueLinks = [...new Set(links)];
    console.log(`Extracted ${uniqueLinks.length} links from tweet: ${uniqueLinks.join(", ")}`);

    return uniqueLinks;
  } catch (error: any) {
    console.error(`Failed to extract links from tweet: ${error.message}`);
    return [];
  }
}

// Fetch metadata for arXiv IDs via the official API (more reliable than HTML scraping)
async function fetchArxivMetadata(paperId: string): Promise<{ title: string | null; description: string | null }> {
  try {
    const axios = (await import("axios")).default;
    const cheerio = await import("cheerio");

    const apiUrl = `https://export.arxiv.org/api/query?id_list=${paperId}`;
    const response = await axios.get(apiUrl, { timeout: 12000 });

    const $ = cheerio.load(response.data, { xmlMode: true });
    const title = $('entry > title').first().text().trim();
    const summary = $('entry > summary').first().text().replace(/\s+/g, ' ').trim();

    if (title || summary) {
      console.log(`Fetched arXiv metadata for ${paperId}`);
      return { title: title || null, description: summary || null };
    }
  } catch (error: any) {
    console.warn(`Failed to fetch arXiv metadata for ${paperId}: ${error.message}`);
  }

  return { title: null, description: null };
}

// Fetch URL metadata (title, description) using web scraping and arXiv API when applicable
async function fetchUrlMetadata(url: string): Promise<{ title: string | null; description: string | null }> {
  try {
    const axios = (await import("axios")).default;
    // Use module import (cheerio has no useful .default)
    const cheerio = await import("cheerio");

    // Normalize arXiv URLs: convert PDF links to abstract pages for better metadata
    let fetchUrl = url;
    if (url.includes('arxiv.org/pdf/')) {
      fetchUrl = url.replace('/pdf/', '/abs/').replace(/\.pdf$/, '');
      console.log(`Normalized arXiv URL: ${url} → ${fetchUrl}`);
    }

    console.log(`Fetching metadata for: ${fetchUrl}`);

    // arXiv fast path: use API before HTML scrape for reliable title/abstract
    const arxivMatch = fetchUrl.match(/arxiv\.org\/(?:abs|pdf)\/([0-9.]+)/);
    if (arxivMatch) {
      const paperId = arxivMatch[1].replace(/\.pdf$/, "");
      const arxivMeta = await fetchArxivMetadata(paperId);
      if (arxivMeta.title || arxivMeta.description) {
        return arxivMeta;
      }
    }

    const response = await axios.get(fetchUrl, {
      timeout: 15000,
      maxRedirects: 5,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
      validateStatus: (status) => status < 500, // Accept 4xx responses
    });

    if (response.status >= 400) {
      console.warn(`Got ${response.status} for ${url}, using URL as fallback`);
      return { title: extractTitleFromUrl(url), description: null };
    }

    const $ = cheerio.load(response.data || "");
    const urlObj = new URL(url);
    const isArxiv = urlObj.hostname.includes('arxiv.org');

    // Extract title with multiple fallbacks
    let title = $('title').first().text().trim();
    console.log(`Raw title from <title> tag: "${title}"`);

    // Special handling for arXiv: clean up title format
    if (isArxiv && title) {
      // arXiv titles are like "[2510.24702] Actual Paper Title"
      const match = title.match(/^\[[\d.]+\]\s*(.+)$/);
      if (match) {
        title = match[1].trim();
        console.log(`Cleaned arXiv title: "${title}"`);
      } else {
        console.log(`arXiv title regex didn't match`);
      }
      // Also try the h1.title element which has clean title
      if (!title || title.length < 3) {
        const h1Title = $('h1.title').text().replace(/^Title:\s*/i, '').trim();
        if (h1Title) {
          title = h1Title;
          console.log(`Used h1.title: "${title}"`);
        }
      }
    }

    if (!title || title.length < 3) {
      title = $('meta[property="og:title"]').attr('content')?.trim() || '';
    }
    if (!title || title.length < 3) {
      title = $('meta[name="twitter:title"]').attr('content')?.trim() || '';
    }
    if (!title || title.length < 3) {
      title = $('h1').first().text().trim();
    }
    if (!title || title.length < 3) {
      title = extractTitleFromUrl(url);
    }

    // Extract description
    let description = $('meta[name="description"]').attr('content')?.trim() ||
                      $('meta[property="og:description"]').attr('content')?.trim() ||
                      $('meta[name="twitter:description"]').attr('content')?.trim() ||
                      null;

    // For arXiv, try to get the abstract
    if (isArxiv && (!description || description.length < 50)) {
      const abstract = $('blockquote.abstract').text()
        .replace(/^Abstract:\s*/i, '')
        .trim();
      if (abstract && abstract.length > 50) {
        description = abstract;
      }
    }

    console.log(`✓ Fetched: "${title}" from ${url}`);
    return { title, description };
  } catch (error: any) {
    console.error(`✗ Error fetching ${url}:`, error.message);
    console.error(`  Error code: ${error.code}, Status: ${error.response?.status}`);
    // Fallback: extract a reasonable title from the URL
    const fallbackTitle = extractTitleFromUrl(url);
    console.log(`  Using fallback title: "${fallbackTitle}"`);
    return { title: fallbackTitle, description: null };
  }
}

// Extract a human-readable title from URL as fallback
function extractTitleFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.replace('www.', '');
    const path = urlObj.pathname;

    // For GitHub repos: extract owner/repo
    if (hostname === 'github.com') {
      const parts = path.split('/').filter(p => p);
      if (parts.length >= 2) {
        return `${parts[0]}/${parts[1]}`;
      }
    }

    // For arXiv: extract paper ID (works for both /abs/ and /pdf/ paths)
    // Note: arXiv uses both arxiv.org and export.arxiv.org
    if (hostname.includes('arxiv.org')) {
      const match = path.match(/\/(abs|pdf)\/([0-9.]+)/);
      if (match) {
        // Remove trailing .pdf if present
        const paperId = match[2].replace(/\.pdf$/, '');
        return `arXiv:${paperId}`;
      }
    }

    // Generic: use last path segment or domain
    const lastSegment = path.split('/').filter(p => p).pop();
    if (lastSegment && lastSegment.length > 3) {
      return lastSegment.replace(/[-_]/g, ' ').replace(/\.\w+$/, '');
    }

    return hostname;
  } catch {
    return url.substring(0, 50);
  }
}

// Classify a single URL using Gemini
async function classifyUrl(url: string, title: string | null, description: string | null, sourceNote?: string) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not set");
    }
    const { GoogleGenerativeAI, SchemaType } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(apiKey);

    const paraSchema = {
      type: SchemaType.OBJECT,
      properties: {
        summary: {
          type: SchemaType.STRING,
          description: "ONE concise sentence summarizing the key insight (no 'This is a...', just the core point)",
        },
        tags: {
          type: SchemaType.ARRAY,
          items: { type: SchemaType.STRING },
          description: "Relevant tags for the link",
        },
        subcategory: {
          type: SchemaType.STRING,
          description: "Subcategory for grouping within PARA bucket (e.g., 'Tools', 'Learning', project name)",
          nullable: true,
        },
        para: {
          type: SchemaType.OBJECT,
          properties: {
            bucket: {
              type: SchemaType.STRING,
              enum: ["Project", "Area", "Resource", "Archive"],
              description: "PARA bucket classification",
            },
            name: {
              type: SchemaType.STRING,
              description: "Short label",
              nullable: true,
            },
            reason: {
              type: SchemaType.STRING,
              description: "1-2 sentence explanation",
              nullable: true,
            },
          },
          required: ["bucket", "name", "reason"],
        },
      },
      required: ["summary", "tags", "subcategory", "para"],
    } as const;

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash-lite",
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 512,
        responseMimeType: "application/json",
        responseSchema: paraSchema as any,
      },
    });

    const prompt = `${LINK_CLASSIFICATION_PROMPT}

Link to classify:
URL: ${url}
Title: ${title || "No title"}
Description: ${description || "No description"}
${sourceNote ? `User's note: ${sourceNote}` : ''}`;

    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    return JSON.parse(text);
  } catch (error) {
    console.error(`Error classifying URL ${url}:`, error);
    return null;
  }
}

// Process a single URL: fetch metadata, store, and classify
export const processSingleUrl = internalAction({
  args: {
    url: v.string(),
    sourceNote: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ success: boolean; linkId?: any; error?: string; extractedUrls?: string[] }> => {
    try {
      console.log(`Processing URL: ${args.url}`);

      // Check if this is a tweet - if so, extract linked URLs
      if (isTweetUrl(args.url)) {
        console.log(`Detected tweet URL, extracting linked URLs...`);
        const extractedUrls = await extractLinksFromTweet(args.url);

        if (extractedUrls.length > 0) {
          console.log(`Found ${extractedUrls.length} links in tweet, processing those instead`);

          // Process each extracted URL
          const results: any[] = [];
          for (const extractedUrl of extractedUrls) {
            // Recursively process the extracted URL
            const result = await processUrlDirect(ctx, extractedUrl, args.sourceNote ? `via tweet: ${args.sourceNote}` : "via tweet");
            results.push(result);
          }

          // Return success if at least one URL was processed
          const successResults = results.filter((r: any) => r.success);
          if (successResults.length > 0) {
            return {
              success: true,
              linkId: successResults[0].linkId,
              extractedUrls,
            };
          }
        }

        // If no links extracted, fall through to process the tweet itself
        console.log(`No external links found in tweet, saving tweet URL itself`);
      }

      // Standard URL processing
      return await processUrlDirect(ctx, args.url, args.sourceNote);
    } catch (error) {
      console.error(`Error processing URL ${args.url}:`, error);
      return { success: false, error: String(error) };
    }
  },
});

// Direct URL processing (extracted for reuse)
async function processUrlDirect(ctx: any, url: string, sourceNote?: string): Promise<{ success: boolean; linkId?: any; error?: string }> {
  try {
    // Fetch metadata from the URL
    const { title, description } = await fetchUrlMetadata(url);

    // Classify the link first to get AI-generated summary
    const classification = await classifyUrl(url, title, description, sourceNote);

    // Use AI summary if description is missing or too short
    const finalDescription = description && description.length > 20
      ? description
      : classification?.summary || description;

    // Store the link with improved description
    const linkId: any = await ctx.runMutation(internal.linkMutations.storeLink, {
      url,
      title,
      description: finalDescription,
      sourceNote,
    });

    if (classification) {
      await ctx.runMutation(internal.linkMutations.applyClassification, {
        linkId,
        para: classification.para,
        tags: classification.tags || [],
        subcategory: classification.subcategory || null,
      });

      console.log(`Classified link ${linkId}: ${classification.para.bucket} > ${classification.subcategory || 'Uncategorized'}`);
    }

    return { success: true, linkId };
  } catch (error) {
    console.error(`Error processing URL ${url}:`, error);
    return { success: false, error: String(error) };
  }
}

// Process multiple URLs from a text list (like Safari tabs from Apple Notes)
// This is a public action that can be called from the frontend
export const processBatchUrls = action({
  args: {
    urls: v.array(v.string()),
    sourceNote: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Array<{ url: string; success: boolean; linkId?: any; error?: string }>> => {
    const results: Array<{ url: string; success: boolean; linkId?: any; error?: string }> = [];

    for (const url of args.urls) {
      const result: any = await ctx.runAction(internal.urlActions.processSingleUrl, {
        url,
        sourceNote: args.sourceNote,
      });
      results.push({ url, ...result });
    }

    return results;
  },
});
