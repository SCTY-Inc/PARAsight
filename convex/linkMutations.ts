import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

// Normalize URL for deduplication (remove tracking params, trailing slashes, www, etc.)
function normalizeUrl(url: string): string {
  try {
    const urlObj = new URL(url);

    // Normalize protocol to https
    urlObj.protocol = 'https:';

    // Remove www prefix
    urlObj.hostname = urlObj.hostname.replace(/^www\./, '');

    // Remove hash/fragment
    urlObj.hash = '';

    // Remove common tracking parameters
    const trackingParams = [
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
      '_bhlid', 'ref', 'source', 'fbclid', 'gclid', 'msclkid',
      'mc_cid', 'mc_eid', '_hsenc', '_hsmi', 'si', 's', 't',
    ];

    trackingParams.forEach(param => {
      urlObj.searchParams.delete(param);
    });

    // Remove trailing slash from pathname
    if (urlObj.pathname.endsWith('/') && urlObj.pathname.length > 1) {
      urlObj.pathname = urlObj.pathname.slice(0, -1);
    }

    // Sort remaining query params for consistent comparison
    urlObj.searchParams.sort();

    // Convert to lowercase for case-insensitive comparison
    return urlObj.toString().toLowerCase();
  } catch (error) {
    // If URL parsing fails, return original URL lowercased
    return url.toLowerCase();
  }
}

// Store a link from Safari/Apple Notes
export const storeLink = internalMutation({
  args: {
    url: v.string(),
    title: v.union(v.string(), v.null()),
    description: v.union(v.string(), v.null()),
    sourceNote: v.optional(v.string()), // Optional category/note from user
  },
  handler: async (ctx, args) => {
    // Normalize URL for deduplication (removes tracking params, trailing slashes)
    const normalizedUrl = normalizeUrl(args.url);

    // Check if normalized URL already exists
    const allLinks = await ctx.db.query("links").collect();
    const existing = allLinks.find(link =>
      normalizeUrl(link.url) === normalizedUrl
    );

    if (existing) {
      console.log("Link already exists (normalized):", args.url);
      return existing._id;
    }

    // Insert new link
    const linkId = await ctx.db.insert("links", {
      ...args,
      para: null,
      tags: null,
      subcategory: null, // Default to null until classified
      createdAt: new Date().toISOString(),
    });

    console.log("Stored new link:", linkId);
    return linkId;
  },
});

// Apply PARA classification to a link
export const applyClassification = internalMutation({
  args: {
    linkId: v.id("links"),
    para: v.object({
      bucket: v.union(
        v.literal("Project"),
        v.literal("Area"),
        v.literal("Resource"),
        v.literal("Archive")
      ),
      name: v.union(v.string(), v.null()),
      reason: v.union(v.string(), v.null()),
    }),
    tags: v.array(v.string()),
    subcategory: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.linkId, {
      para: args.para,
      tags: args.tags,
      subcategory: args.subcategory,
    });
  },
});

// Update link's PARA bucket and/or subcategory (for drag-and-drop)
export const updateLinkCategory = internalMutation({
  args: {
    linkId: v.id("links"),
    bucket: v.optional(v.union(
      v.literal("Project"),
      v.literal("Area"),
      v.literal("Resource"),
      v.literal("Archive")
    )),
    subcategory: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const link = await ctx.db.get(args.linkId);
    if (!link) {
      console.error("Link not found:", args.linkId);
      return;
    }

    const updates: any = {};

    // Update PARA bucket if provided
    if (args.bucket !== undefined) {
      if (link.para) {
        // Preserve existing para fields
        updates.para = {
          ...link.para,
          bucket: args.bucket,
        };
      } else {
        // Create new para object if it doesn't exist
        updates.para = {
          bucket: args.bucket,
          name: null,
          reason: null,
        };
      }
    }

    // Update subcategory if provided
    if (args.subcategory !== undefined) {
      updates.subcategory = args.subcategory;
    }

    console.log(`Updating link ${args.linkId}:`, updates);
    await ctx.db.patch(args.linkId, updates);
  },
});

// Update link title (for inline editing)
export const updateLinkTitle = internalMutation({
  args: {
    linkId: v.id("links"),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.linkId, {
      title: args.title,
    });
  },
});

// Rename a subcategory (group) across all links in a given bucket
export const renameSubcategory = internalMutation({
  args: {
    bucket: v.union(
      v.literal("Project"),
      v.literal("Area"),
      v.literal("Resource"),
      v.literal("Archive")
    ),
    oldSubcategory: v.string(),
    newSubcategory: v.string(),
  },
  handler: async (ctx, args) => {
    const cleanNew = args.newSubcategory.trim();
    if (!cleanNew) {
      console.warn("renameSubcategory: newSubcategory is empty, skipping");
      return;
    }

    // Fetch links in the bucket to limit the scan
    const links = await ctx.db
      .query("links")
      .withIndex("by_para_bucket", (q) => q.eq("para.bucket", args.bucket))
      .filter((q) => q.eq(q.field("subcategory"), args.oldSubcategory))
      .collect();

    for (const link of links) {
      await ctx.db.patch(link._id, { subcategory: cleanNew });
    }
  },
});

// Helper to normalize URL (same logic as above, exported for reuse)
function normalizeUrlForCleanup(url: string): string {
  try {
    const urlObj = new URL(url);
    urlObj.protocol = 'https:';
    urlObj.hostname = urlObj.hostname.replace(/^www\./, '');
    urlObj.hash = '';
    const trackingParams = [
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
      '_bhlid', 'ref', 'source', 'fbclid', 'gclid', 'msclkid',
      'mc_cid', 'mc_eid', '_hsenc', '_hsmi', 'si', 's', 't',
    ];
    trackingParams.forEach(param => urlObj.searchParams.delete(param));
    if (urlObj.pathname.endsWith('/') && urlObj.pathname.length > 1) {
      urlObj.pathname = urlObj.pathname.slice(0, -1);
    }
    urlObj.searchParams.sort();
    return urlObj.toString().toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

// One-time cleanup: remove duplicate links (keeps the oldest)
export const deduplicateLinks = internalMutation({
  args: {},
  handler: async (ctx) => {
    const allLinks = await ctx.db.query("links").collect();

    // Group by normalized URL
    const urlGroups = new Map<string, typeof allLinks>();

    for (const link of allLinks) {
      const normalized = normalizeUrlForCleanup(link.url);
      const group = urlGroups.get(normalized) || [];
      group.push(link);
      urlGroups.set(normalized, group);
    }

    let deletedCount = 0;

    for (const [normalizedUrl, links] of urlGroups) {
      if (links.length > 1) {
        // Sort by creation date, keep oldest
        links.sort((a, b) => {
          const dateA = new Date(a.createdAt || 0).getTime();
          const dateB = new Date(b.createdAt || 0).getTime();
          return dateA - dateB;
        });

        // Delete all but the first (oldest)
        for (let i = 1; i < links.length; i++) {
          console.log(`Deleting duplicate: ${links[i].url} (keeping ${links[0].url})`);
          await ctx.db.delete(links[i]._id);
          deletedCount++;
        }
      }
    }

    console.log(`Deduplication complete: removed ${deletedCount} duplicates`);
    return { deletedCount, totalBefore: allLinks.length, totalAfter: allLinks.length - deletedCount };
  },
});
