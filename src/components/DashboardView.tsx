"use client";

import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Doc } from "../../convex/_generated/dataModel";
import type { ViewMode, DashboardStats } from "../lib/types";
import { getFaviconUrl, formatRelativeTime } from "../lib/utils";
import { UrlInput } from "./UrlInput";
import { Skeleton, SkeletonCard } from "./Skeleton";

interface DashboardViewProps {
  stats: DashboardStats | undefined;
  onViewChange: (view: ViewMode) => void;
  onTagFilter: (tag: string) => void;
}

export function DashboardView({
  stats,
  onViewChange,
  onTagFilter,
}: DashboardViewProps) {
  const deleteLink = useMutation(api.links.deleteLink);

  if (!stats) {
    return (
      <div className="dashboard-loading">
        <div className="dashboard-grid">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="stat-card skeleton-stat">
              <Skeleton className="skeleton-stat-title" />
              <Skeleton className="skeleton-stat-value" />
            </div>
          ))}
        </div>
        <div className="section">
          <Skeleton className="skeleton-section-title" />
          {[1, 2, 3, 4].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  const handleDelete = async (link: Doc<"links">) => {
    if (window.confirm("Delete this link?")) {
      await deleteLink({ id: link._id });
    }
  };

  return (
    <>
      <div className="quick-capture">
        <UrlInput />
      </div>

      <div className="dashboard-grid">
        <div
          className="stat-card"
          style={{ "--card-accent": "var(--accent-cyan)" } as React.CSSProperties}
        >
          <div className="stat-card-header">
            <span className="stat-card-title">Total Links</span>
            <span className="stat-card-icon">◎</span>
          </div>
          <div className="stat-card-value">{stats.total}</div>
          {stats.addedThisWeek > 0 && (
            <div className="stat-card-delta">↑ {stats.addedThisWeek} this week</div>
          )}
        </div>

        <div
          className="stat-card"
          style={{ "--card-accent": "var(--accent-blue)" } as React.CSSProperties}
        >
          <div className="stat-card-header">
            <span className="stat-card-title">Projects</span>
            <span className="stat-card-icon">🎯</span>
          </div>
          <div className="stat-card-value">{stats.bucketCounts.Project}</div>
        </div>

        <div
          className="stat-card"
          style={{ "--card-accent": "var(--accent-green)" } as React.CSSProperties}
        >
          <div className="stat-card-header">
            <span className="stat-card-title">Areas</span>
            <span className="stat-card-icon">🔄</span>
          </div>
          <div className="stat-card-value">{stats.bucketCounts.Area}</div>
        </div>

        <div
          className="stat-card"
          style={{ "--card-accent": "var(--accent-amber)" } as React.CSSProperties}
        >
          <div className="stat-card-header">
            <span className="stat-card-title">Resources</span>
            <span className="stat-card-icon">📚</span>
          </div>
          <div className="stat-card-value">{stats.bucketCounts.Resource}</div>
        </div>
      </div>

      <div className="section">
        <div className="section-header">
          <h2 className="section-title">⚡ Recent Activity</h2>
          <button className="section-action" onClick={() => onViewChange("para")}>
            View all →
          </button>
        </div>
        <div className="activity-list">
          {stats.recentLinks.map((link: Doc<"links">) => (
            <div key={link._id} className="activity-item-wrapper">
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="activity-item"
              >
                <div className="activity-favicon">
                  <img
                    src={getFaviconUrl(link.url)}
                    alt=""
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                </div>
                <div className="activity-info">
                  <div className="activity-title">{link.title || "Untitled"}</div>
                  <div className="activity-meta">
                    {link.para?.bucket && (
                      <span
                        className={`activity-bucket ${link.para.bucket.toLowerCase()}`}
                      >
                        {link.para.bucket}
                      </span>
                    )}
                  </div>
                </div>
                <span className="activity-time">
                  {link.createdAt ? formatRelativeTime(link.createdAt) : ""}
                </span>
              </a>
              <button
                className="activity-delete"
                onClick={(e) => {
                  e.preventDefault();
                  handleDelete(link);
                }}
                title="Delete"
              >
                ×
              </button>
            </div>
          ))}
          {stats.recentLinks.length === 0 && (
            <div className="empty">No recent activity</div>
          )}
        </div>
      </div>

      {stats.topTags.length > 0 && (
        <div className="section">
          <div className="section-header">
            <h2 className="section-title">🏷️ Top Tags</h2>
          </div>
          <div className="tags-cloud">
            {stats.topTags.map((tag) => (
              <button
                key={tag.tag}
                className="tag-chip"
                onClick={() => onTagFilter(tag.tag)}
              >
                {tag.tag}
                <span className="tag-chip-count">{tag.count}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
