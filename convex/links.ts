import { query } from "./_generated/server";
import { v } from "convex/values";

// List links by PARA bucket
export const listByBucket = query({
  args: { bucket: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("links")
      .withIndex("by_para_bucket")
      .filter((q) => q.eq(q.field("para.bucket"), args.bucket))
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

// Get all links (for debugging)
export const listAll = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("links").collect();
  },
});

// Search links
export const search = query({
  args: { query: v.string() },
  handler: async (ctx, args) => {
    const allLinks = await ctx.db.query("links").collect();
    return allLinks.filter(
      (link) =>
        link.title?.toLowerCase().includes(args.query.toLowerCase()) ||
        link.description?.toLowerCase().includes(args.query.toLowerCase()) ||
        link.url.toLowerCase().includes(args.query.toLowerCase())
    );
  },
});
