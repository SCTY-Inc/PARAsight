// Shared types for the application

import type { Doc, Id } from "../../convex/_generated/dataModel";

export type ViewMode = "dashboard" | "para" | "library";
export type Theme = "dark" | "light";
export type ParaBucket = "Project" | "Area" | "Resource" | "Archive";

// Dashboard stats type matching what getDashboardStats returns
export interface DashboardStats {
  total: number;
  bucketCounts: {
    Project: number;
    Area: number;
    Resource: number;
    Archive: number;
  };
  recentLinks: Doc<"links">[];
  addedThisWeek: number;
  topTags: { tag: string; count: number }[];
}

// Tag with count for filtering
export interface TagWithCount {
  tag: string;
  count: number;
}

// Re-export commonly used types
export type Link = Doc<"links">;
export type LinkId = Id<"links">;
