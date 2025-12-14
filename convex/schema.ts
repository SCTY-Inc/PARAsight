import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  links: defineTable({
    url: v.string(),
    title: v.union(v.string(), v.null()),
    description: v.union(v.string(), v.null()),

    // Source tracking (now from Safari/Apple Notes instead of email)
    sourceNote: v.optional(v.string()), // Optional note/category from user

    // Legacy email source fields (for backwards compatibility)
    sourceEmailId: v.optional(v.string()),
    sourceFrom: v.optional(v.string()),
    sourceSubject: v.optional(v.string()),

    // LLM-derived fields
    para: v.union(
      v.object({
        bucket: v.union(
          v.literal("Project"),
          v.literal("Area"),
          v.literal("Resource"),
          v.literal("Archive")
        ),
        name: v.union(v.string(), v.null()), // Project/Area name or Resource subcategory
        reason: v.union(v.string(), v.null()),
      }),
      v.null()
    ),
    tags: v.union(v.array(v.string()), v.null()),

    // Subcategory for organizing within PARA buckets
    // Examples: "Tools", "Learning", "givecare", "scty"
    subcategory: v.optional(v.union(v.string(), v.null())),

    createdAt: v.string(),
  })
    .index("by_url", ["url"])
    .index("by_para_bucket", ["para.bucket"])
    .index("by_createdAt", ["createdAt"]),
});
