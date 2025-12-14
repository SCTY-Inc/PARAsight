import { query } from "./_generated/server";

// Get dashboard stats
export const getDashboardStats = query({
  args: {},
  handler: async (ctx) => {
    const allLinks = await ctx.db.query("links").collect();

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

    // Sort ALL links by date descending to get most recent
    const sortedLinks = [...allLinks].sort((a, b) => {
      const dateA = new Date(a.createdAt || 0).getTime();
      const dateB = new Date(b.createdAt || 0).getTime();
      return dateB - dateA;
    });

    // Top tags
    const topTags = Object.entries(tagCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([tag, count]) => ({ tag, count }));

    return {
      total: allLinks.length,
      bucketCounts,
      recentLinks: sortedLinks.slice(0, 8), // Most recent 8 links (regardless of date)
      addedThisWeek,
      topTags,
    };
  },
});
