// Media type detection for Library view

export type MediaType =
  | "paper"      // arXiv, academic papers, PDFs
  | "repo"       // GitHub, GitLab repos
  | "video"      // YouTube, Vimeo, etc.
  | "docs"       // Documentation sites
  | "tool"       // Apps, tools, products
  | "article"    // Blog posts, news articles
  | "social"     // Twitter, LinkedIn, etc.
  | "other";

export interface MediaTypeInfo {
  type: MediaType;
  label: string;
  emoji: string;
  color: string;
}

export const MEDIA_TYPES: Record<MediaType, MediaTypeInfo> = {
  paper: { type: "paper", label: "Papers", emoji: "📄", color: "#a855f7" },
  repo: { type: "repo", label: "Repos", emoji: "💻", color: "#22c55e" },
  video: { type: "video", label: "Videos", emoji: "📺", color: "#ef4444" },
  docs: { type: "docs", label: "Docs", emoji: "📖", color: "#3b82f6" },
  tool: { type: "tool", label: "Tools", emoji: "🛠️", color: "#f59e0b" },
  article: { type: "article", label: "Articles", emoji: "📰", color: "#06b6d4" },
  social: { type: "social", label: "Social", emoji: "💬", color: "#ec4899" },
  other: { type: "other", label: "Other", emoji: "🔗", color: "#6b7280" },
};

// Order for display
export const MEDIA_TYPE_ORDER: MediaType[] = [
  "paper",
  "repo",
  "video",
  "docs",
  "tool",
  "article",
  "social",
  "other",
];

/**
 * Detect media type from URL
 */
export function detectMediaType(url: string): MediaType {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    const pathname = parsed.pathname.toLowerCase();

    // Papers / Academic
    if (
      hostname.includes("arxiv.org") ||
      hostname.includes("scholar.google") ||
      hostname.includes("semanticscholar.org") ||
      hostname.includes("paperswithcode.com") ||
      hostname.includes("openreview.net") ||
      hostname.includes("aclanthology.org") ||
      hostname.includes("biorxiv.org") ||
      hostname.includes("medrxiv.org") ||
      hostname.includes("ssrn.com") ||
      hostname.includes("researchgate.net") ||
      hostname.includes("academia.edu") ||
      pathname.endsWith(".pdf")
    ) {
      return "paper";
    }

    // Repos
    if (
      hostname.includes("github.com") ||
      hostname.includes("gitlab.com") ||
      hostname.includes("bitbucket.org") ||
      hostname.includes("codeberg.org") ||
      hostname.includes("sr.ht") ||
      hostname.includes("huggingface.co")
    ) {
      return "repo";
    }

    // Video
    if (
      hostname.includes("youtube.com") ||
      hostname.includes("youtu.be") ||
      hostname.includes("vimeo.com") ||
      hostname.includes("twitch.tv") ||
      hostname.includes("loom.com") ||
      hostname.includes("wistia.com")
    ) {
      return "video";
    }

    // Documentation sites
    if (
      hostname.includes("docs.") ||
      hostname.includes("documentation.") ||
      hostname.endsWith(".readthedocs.io") ||
      hostname.includes("developer.") ||
      hostname.includes("devdocs.io") ||
      pathname.includes("/docs/") ||
      pathname.includes("/documentation/") ||
      pathname.includes("/api/") ||
      pathname.includes("/reference/")
    ) {
      return "docs";
    }

    // Tools / Products (common product domains)
    if (
      hostname.includes("producthunt.com") ||
      hostname.includes(".app") ||
      hostname.includes(".io") && !hostname.includes("medium") ||
      hostname.includes("notion.so") ||
      hostname.includes("figma.com") ||
      hostname.includes("linear.app") ||
      hostname.includes("vercel.com") ||
      hostname.includes("netlify.com") ||
      hostname.includes("railway.app") ||
      hostname.includes("render.com") ||
      hostname.includes("supabase.com") ||
      hostname.includes("firebase.google.com") ||
      hostname.includes("anthropic.com") ||
      hostname.includes("openai.com")
    ) {
      return "tool";
    }

    // Social
    if (
      hostname.includes("twitter.com") ||
      hostname.includes("x.com") ||
      hostname.includes("linkedin.com") ||
      hostname.includes("reddit.com") ||
      hostname.includes("discord.com") ||
      hostname.includes("discord.gg") ||
      hostname.includes("slack.com") ||
      hostname.includes("mastodon") ||
      hostname.includes("threads.net") ||
      hostname.includes("bsky.app")
    ) {
      return "social";
    }

    // Articles / Blogs (check after other categories)
    if (
      hostname.includes("medium.com") ||
      hostname.includes("substack.com") ||
      hostname.includes("dev.to") ||
      hostname.includes("hashnode.") ||
      hostname.includes("blog.") ||
      hostname.includes("news.ycombinator.com") ||
      hostname.includes("techcrunch.com") ||
      hostname.includes("theverge.com") ||
      hostname.includes("wired.com") ||
      hostname.includes("arstechnica.com") ||
      pathname.includes("/blog/") ||
      pathname.includes("/post/") ||
      pathname.includes("/article/")
    ) {
      return "article";
    }

    return "other";
  } catch {
    return "other";
  }
}

/**
 * Group links by media type
 */
export function groupByMediaType<T extends { url: string }>(
  links: T[]
): Record<MediaType, T[]> {
  const groups: Record<MediaType, T[]> = {
    paper: [],
    repo: [],
    video: [],
    docs: [],
    tool: [],
    article: [],
    social: [],
    other: [],
  };

  links.forEach((link) => {
    const type = detectMediaType(link.url);
    groups[type].push(link);
  });

  return groups;
}
