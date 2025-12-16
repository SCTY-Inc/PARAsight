// Shared utility functions

import type { MediaType } from "./mediaType";

// Get favicon URL from a page URL
export function getFaviconUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `https://www.google.com/s2/favicons?domain=${parsed.hostname}&sz=64`;
  } catch {
    return "";
  }
}

// Extract clean display name from URL
export function getCleanDisplayName(
  url: string,
  title: string | null,
  mediaType: MediaType
): string {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    const pathname = parsed.pathname;

    if (hostname.includes("github.com")) {
      const parts = pathname.split("/").filter(Boolean);
      if (parts.length >= 2) return `${parts[0]}/${parts[1]}`;
    }
    if (hostname.includes("arxiv.org")) {
      const match = pathname.match(/(?:abs|pdf)\/(\d+\.\d+)/);
      if (match) {
        if (title && !title.startsWith("arXiv")) {
          return title.replace(/^\[\d+\.\d+\]\s*/, "").substring(0, 60);
        }
        return `arXiv:${match[1]}`;
      }
    }
    if (title) {
      return title.replace(/ \| .*$/, "").replace(/ - .*$/, "").substring(0, 50);
    }
    return hostname.replace("www.", "");
  } catch {
    return title || "Untitled";
  }
}

// Format relative time from ISO date string
export function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

// Group links by subcategory
export function groupBySubcategory<T extends { subcategory?: string | null }>(
  links: T[]
): Record<string, T[]> {
  const groups: Record<string, T[]> = {};
  links.forEach((link) => {
    const subcategory = link.subcategory || "Uncategorized";
    if (!groups[subcategory]) groups[subcategory] = [];
    groups[subcategory].push(link);
  });
  return groups;
}

// Get substack key for library grouping
export function getSubStackKey<T extends { url: string; para?: { bucket?: string } | null }>(
  url: string,
  link: T,
  mediaType: MediaType
): string {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    const pathname = parsed.pathname;
    if (hostname.includes("github.com") || hostname.includes("huggingface.co")) {
      const parts = pathname.split("/").filter(Boolean);
      if (parts.length >= 1) return parts[0];
    }
    return link.para?.bucket || "Uncategorized";
  } catch {
    return link.para?.bucket || "Uncategorized";
  }
}
