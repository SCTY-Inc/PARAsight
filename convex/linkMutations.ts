import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { normalizeUrl } from "./lib/urlUtils";

// Store a link from Safari/Apple Notes
export const storeLink = internalMutation({
  args: {
    url: v.string(),
    title: v.union(v.string(), v.null()),
    description: v.union(v.string(), v.null()),
    sourceNote: v.optional(v.string()), // Optional category/note from user
  },
  handler: async (ctx, args) => {
    // Normalize URL for deduplication
    const normalizedUrl = normalizeUrl(args.url);

    // Check if normalized URL already exists using the index
    // First check exact match, then check normalized versions
    const existingExact = await ctx.db
      .query("links")
      .withIndex("by_url", (q) => q.eq("url", args.url))
      .first();

    if (existingExact) {
      console.log("Link already exists (exact match):", args.url);
      return existingExact._id;
    }

    // Check for normalized matches - scan recent links only for performance
    const recentLinks = await ctx.db
      .query("links")
      .withIndex("by_createdAt")
      .order("desc")
      .take(500);

    const existingNormalized = recentLinks.find(
      (link) => normalizeUrl(link.url) === normalizedUrl
    );

    if (existingNormalized) {
      console.log("Link already exists (normalized):", args.url);
      return existingNormalized._id;
    }

    // Insert new link
    const linkId = await ctx.db.insert("links", {
      ...args,
      para: null,
      tags: null,
      subcategory: null,
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
    bucket: v.optional(
      v.union(
        v.literal("Project"),
        v.literal("Area"),
        v.literal("Resource"),
        v.literal("Archive")
      )
    ),
    subcategory: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const link = await ctx.db.get(args.linkId);
    if (!link) {
      console.error("Link not found:", args.linkId);
      return;
    }

    const updates: Partial<{
      para: {
        bucket: "Project" | "Area" | "Resource" | "Archive";
        name: string | null;
        reason: string | null;
      };
      subcategory: string | null;
    }> = {};

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

// One-time cleanup: remove duplicate links (keeps the oldest)
export const deduplicateLinks = internalMutation({
  args: {},
  handler: async (ctx) => {
    const allLinks = await ctx.db.query("links").collect();

    // Group by normalized URL
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
        // Sort by creation date, keep oldest
        links.sort((a, b) => {
          const dateA = new Date(a.createdAt || 0).getTime();
          const dateB = new Date(b.createdAt || 0).getTime();
          return dateA - dateB;
        });

        // Delete all but the first (oldest)
        for (let i = 1; i < links.length; i++) {
          console.log(
            `Deleting duplicate: ${links[i].url} (keeping ${links[0].url})`
          );
          await ctx.db.delete(links[i]._id);
          deletedCount++;
        }
      }
    }

    console.log(`Deduplication complete: removed ${deletedCount} duplicates`);
    return {
      deletedCount,
      totalBefore: allLinks.length,
      totalAfter: allLinks.length - deletedCount,
    };
  },
});
