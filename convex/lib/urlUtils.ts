// Shared URL normalization utility
// Used across the Convex backend for deduplication and URL handling

// Common tracking parameters to remove from URLs
const TRACKING_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "_bhlid",
  "ref",
  "source",
  "fbclid",
  "gclid",
  "msclkid",
  "mc_cid",
  "mc_eid",
  "_hsenc",
  "_hsmi",
  "si",
  "s",
  "t",
];

/**
 * Normalize URL for deduplication and consistent storage.
 * - Converts to HTTPS
 * - Removes www prefix
 * - Removes hash/fragment
 * - Removes common tracking parameters
 * - Removes trailing slash
 * - Sorts remaining query params
 * - Lowercases the result
 */
export function normalizeUrl(url: string): string {
  try {
    const urlObj = new URL(url);

    // Normalize protocol to https
    urlObj.protocol = "https:";

    // Remove www prefix
    urlObj.hostname = urlObj.hostname.replace(/^www\./, "");

    // Remove hash/fragment
    urlObj.hash = "";

    // Remove common tracking parameters
    TRACKING_PARAMS.forEach((param) => {
      urlObj.searchParams.delete(param);
    });

    // Remove trailing slash from pathname
    if (urlObj.pathname.endsWith("/") && urlObj.pathname.length > 1) {
      urlObj.pathname = urlObj.pathname.slice(0, -1);
    }

    // Sort remaining query params for consistent comparison
    urlObj.searchParams.sort();

    // Convert to lowercase for case-insensitive comparison
    return urlObj.toString().toLowerCase();
  } catch {
    // If URL parsing fails, return original URL lowercased
    return url.toLowerCase();
  }
}

/**
 * Extract a human-readable title from URL as fallback
 */
export function extractTitleFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.replace("www.", "");
    const path = urlObj.pathname;

    // For GitHub repos: extract owner/repo
    if (hostname === "github.com") {
      const parts = path.split("/").filter((p) => p);
      if (parts.length >= 2) {
        return `${parts[0]}/${parts[1]}`;
      }
    }

    // For arXiv: extract paper ID (works for both /abs/ and /pdf/ paths)
    if (hostname.includes("arxiv.org")) {
      const match = path.match(/\/(abs|pdf)\/([0-9.]+)/);
      if (match) {
        // Remove trailing .pdf if present
        const paperId = match[2].replace(/\.pdf$/, "");
        return `arXiv:${paperId}`;
      }
    }

    // Generic: use last path segment or domain
    const lastSegment = path.split("/").filter((p) => p).pop();
    if (lastSegment && lastSegment.length > 3) {
      return lastSegment.replace(/[-_]/g, " ").replace(/\.\w+$/, "");
    }

    return hostname;
  } catch {
    return url.substring(0, 50);
  }
}
