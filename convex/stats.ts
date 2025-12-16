import { query } from "./_generated/server";

// Get dashboard stats with optimized queries
export const getDashboardStats = query({
  args: {},
  handler: async (ctx) => {
    // Use indexed query with limit for better performance
    const allLinks = await ctx.db
      .query("links")
      .withIndex("by_createdAt")
      .order("desc")
      .take(1000); // Limit scan for performance

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Count by bucket
    const bucketCounts = {
      Project: 0,
      Area: 0,
      Resource: 0,
      Archive: 0,
    };

    // Links added this week (for stats)
    let addedThisWeek = 0;

    // Tag frequency
    const tagCounts: Record<string, number> = {};

    allLinks.forEach((link) => {
      const bucket = link.para?.bucket;
      if (bucket && bucket in bucketCounts) {
        bucketCounts[bucket as keyof typeof bucketCounts]++;
      }

      // Check if added this week
      if (link.createdAt) {
        const createdDate = new Date(link.createdAt);
        if (createdDate >= weekAgo) {
          addedThisWeek++;
        }
      }

      // Count tags
      if (link.tags) {
        link.tags.forEach((tag) => {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        });
      }
    });

    // Top tags
    const topTags = Object.entries(tagCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([tag, count]) => ({ tag, count }));

    // Recent links are already sorted by createdAt desc
    const recentLinks = allLinks.slice(0, 8);

    return {
      total: allLinks.length,
      bucketCounts,
      recentLinks,
      addedThisWeek,
      topTags,
    };
  },
});
