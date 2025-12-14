import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// List links by PARA bucket
export const listByBucket = query({
  args: {
    bucket: v.union(
      v.literal("Project"),
      v.literal("Area"),
      v.literal("Resource"),
      v.literal("Archive")
    ),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("links")
      .withIndex("by_para_bucket", (q) => q.eq("para.bucket", args.bucket))
      .order("desc")
      .take(100);
  },
});

// Get a specific link
export const get = query({
  args: { id: v.id("links") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Get all links
export const listAll = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("links").collect();
  },
});

// Search links with optional tag filter
export const search = query({
  args: {
    query: v.optional(v.string()),
    tag: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let links = await ctx.db.query("links").collect();

    // Filter by tag if provided
    if (args.tag) {
      links = links.filter(link => link.tags?.includes(args.tag!));
    }

    // Filter by search query if provided
    if (args.query) {
      const q = args.query.toLowerCase();
      links = links.filter(
        (link) =>
          link.title?.toLowerCase().includes(q) ||
          link.description?.toLowerCase().includes(q) ||
          link.url.toLowerCase().includes(q) ||
          link.tags?.some(tag => tag.toLowerCase().includes(q))
      );
    }

    return links;
  },
});

// List links by tag
export const listByTag = query({
  args: { tag: v.string() },
  handler: async (ctx, args) => {
    const allLinks = await ctx.db.query("links").collect();
    return allLinks.filter(link => link.tags?.includes(args.tag));
  },
});

// Get all unique tags with counts
export const getAllTags = query({
  args: {},
  handler: async (ctx) => {
    const allLinks = await ctx.db.query("links").collect();
    const tagCounts: Record<string, number> = {};

    allLinks.forEach(link => {
      link.tags?.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });

    return Object.entries(tagCounts)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count);
  },
});

// Delete a single link
export const deleteLink = mutation({
  args: { id: v.id("links") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
    return { success: true };
  },
});

// Delete multiple links (bulk delete)
export const deleteMany = mutation({
  args: { ids: v.array(v.id("links")) },
  handler: async (ctx, args) => {
    for (const id of args.ids) {
      await ctx.db.delete(id);
    }
    return { deleted: args.ids.length };
  },
});

// Update link details
export const updateLink = mutation({
  args: {
    id: v.id("links"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const filtered = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );
    await ctx.db.patch(id, filtered);
    return { success: true };
  },
});

// Move multiple links to a bucket (bulk move)
export const moveMany = mutation({
  args: {
    ids: v.array(v.id("links")),
    bucket: v.union(
      v.literal("Project"),
      v.literal("Area"),
      v.literal("Resource"),
      v.literal("Archive")
    ),
  },
  handler: async (ctx, args) => {
    for (const id of args.ids) {
      const link = await ctx.db.get(id);
      if (link) {
        await ctx.db.patch(id, {
          para: {
            bucket: args.bucket,
            name: link.para?.name ?? null,
            reason: link.para?.reason ?? null,
          },
        });
      }
    }
    return { moved: args.ids.length };
  },
});

// Normalize URL for deduplication
function normalizeUrl(url: string): string {
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
export const deduplicate = mutation({
  args: {},
  handler: async (ctx) => {
    const allLinks = await ctx.db.query("links").collect();
    const urlGroups = new Map<string, typeof allLinks>();

    for (const link of allLinks) {
      const normalized = normalizeUrl(link.url);
      const group = urlGroups.get(normalized) || [];
      group.push(link);
      urlGroups.set(normalized, group);
    }

    let deletedCount = 0;

    for (const [, links] of urlGroups) {
      if (links.length > 1) {
        links.sort((a, b) => {
          const dateA = new Date(a.createdAt || 0).getTime();
          const dateB = new Date(b.createdAt || 0).getTime();
          return dateA - dateB;
        });

        for (let i = 1; i < links.length; i++) {
          console.log(`Deleting duplicate: ${links[i].url}`);
          await ctx.db.delete(links[i]._id);
          deletedCount++;
        }
      }
    }

    return { deletedCount, totalBefore: allLinks.length, totalAfter: allLinks.length - deletedCount };
  },
});
