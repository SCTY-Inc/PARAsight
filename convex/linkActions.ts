import { action, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

// Public action to update link category (called from drag-and-drop)
export const updateCategory = action({
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
    await ctx.runMutation(internal.linkMutations.updateLinkCategory, args);
  },
});

// Get a single link (internal query for groupActions)
export const getLink = internalQuery({
  args: { linkId: v.id("links") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.linkId);
  },
});

// Update link title
export const updateTitle = action({
  args: {
    linkId: v.id("links"),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.runMutation(internal.linkMutations.updateLinkTitle, args);
  },
});

// Rename a subcategory (group) across all links in a bucket
export const renameSubcategory = action({
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
    await ctx.runMutation(internal.linkMutations.renameSubcategory, args);
  },
});
