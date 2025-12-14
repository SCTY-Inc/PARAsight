"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useAction, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { LinkCard } from "../components/LinkCard";
import { UrlInput } from "../components/UrlInput";
import type { Doc, Id } from "../../convex/_generated/dataModel";
import {
  groupByMediaType,
  MEDIA_TYPES,
  MEDIA_TYPE_ORDER,
  type MediaType,
} from "../lib/mediaType";

type ViewMode = "dashboard" | "para" | "library";
type Theme = "dark" | "light";

// Group links by subcategory
function groupBySubcategory(links: any[]) {
  const groups: Record<string, any[]> = {};
  links.forEach((link) => {
    const subcategory = link.subcategory || "Uncategorized";
    if (!groups[subcategory]) groups[subcategory] = [];
    groups[subcategory].push(link);
  });
  return groups;
}

// Get favicon URL
function getFaviconUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `https://www.google.com/s2/favicons?domain=${parsed.hostname}&sz=64`;
  } catch {
    return "";
  }
}

// Extract clean display name
function getCleanDisplayName(url: string, title: string | null, mediaType: MediaType): string {
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

// Get substack key for grouping
function getSubStackKey(url: string, link: Doc<"links">, mediaType: MediaType): string {
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

// Format relative time
function formatRelativeTime(dateStr: string): string {
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

// Skeleton Loader Component
function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

function SkeletonCard() {
  return (
    <div className="skeleton-card">
      <Skeleton className="skeleton-title" />
      <Skeleton className="skeleton-desc" />
      <div className="skeleton-tags">
        <Skeleton className="skeleton-tag" />
        <Skeleton className="skeleton-tag" />
      </div>
    </div>
  );
}

// Theme Toggle Component
function ThemeToggle({ theme, onToggle }: { theme: Theme; onToggle: () => void }) {
  return (
    <button className="theme-toggle" onClick={onToggle} title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}>
      {theme === "dark" ? "☀" : "☾"}
    </button>
  );
}

// Sidebar Component
function Sidebar({
  currentView,
  onViewChange,
  stats,
  filterTag,
  onClearFilter,
}: {
  currentView: ViewMode;
  onViewChange: (view: ViewMode) => void;
  stats: any;
  filterTag: string | null;
  onClearFilter: () => void;
}) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">◈</div>
          <span className="sidebar-logo-text">Parasight</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section">
          <button
            className={`nav-item ${currentView === "dashboard" ? "active" : ""}`}
            onClick={() => onViewChange("dashboard")}
          >
            <span className="nav-item-icon">⌂</span>
            Dashboard
          </button>
        </div>

        <div className="nav-section">
          <div className="nav-section-title">Views</div>
          <button
            className={`nav-item ${currentView === "para" ? "active" : ""}`}
            onClick={() => onViewChange("para")}
          >
            <span className="nav-item-icon">▦</span>
            PARA
            <span className="nav-item-badge">{stats?.total || 0}</span>
          </button>
          <button
            className={`nav-item ${currentView === "library" ? "active" : ""}`}
            onClick={() => onViewChange("library")}
          >
            <span className="nav-item-icon">◫</span>
            Library
          </button>
        </div>

        <div className="nav-section">
          <div className="nav-section-title">Buckets</div>
          <button className="nav-item" onClick={() => onViewChange("para")}>
            <span className="nav-item-icon">🎯</span>
            Projects
            <span className="nav-item-badge">{stats?.bucketCounts?.Project || 0}</span>
          </button>
          <button className="nav-item" onClick={() => onViewChange("para")}>
            <span className="nav-item-icon">🔄</span>
            Areas
            <span className="nav-item-badge">{stats?.bucketCounts?.Area || 0}</span>
          </button>
          <button className="nav-item" onClick={() => onViewChange("para")}>
            <span className="nav-item-icon">📚</span>
            Resources
            <span className="nav-item-badge">{stats?.bucketCounts?.Resource || 0}</span>
          </button>
          <button className="nav-item" onClick={() => onViewChange("para")}>
            <span className="nav-item-icon">📦</span>
            Archive
            <span className="nav-item-badge">{stats?.bucketCounts?.Archive || 0}</span>
          </button>
        </div>

        {filterTag && (
          <div className="nav-section">
            <div className="nav-section-title">Active Filter</div>
            <div className="active-filter">
              <span className="filter-tag">🏷️ {filterTag}</span>
              <button className="clear-filter" onClick={onClearFilter}>×</button>
            </div>
          </div>
        )}
      </nav>

      <div className="sidebar-footer">
        <div className="kbd-hint">
          <kbd className="kbd">⌘</kbd>
          <kbd className="kbd">K</kbd>
          <span>to search</span>
        </div>
      </div>
    </aside>
  );
}

// Command Palette with keyboard navigation
function CommandPalette({
  isOpen,
  onClose,
  links,
  onNavigate,
  onTagFilter,
  allTags,
}: {
  isOpen: boolean;
  onClose: () => void;
  links: Doc<"links">[] | undefined;
  onNavigate: (view: ViewMode) => void;
  onTagFilter: (tag: string) => void;
  allTags: { tag: string; count: number }[] | undefined;
}) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      inputRef.current?.focus();
    }
  }, [isOpen]);

  const filteredLinks = links?.filter(
    (link) =>
      link.title?.toLowerCase().includes(query.toLowerCase()) ||
      link.url.toLowerCase().includes(query.toLowerCase()) ||
      link.tags?.some(tag => tag.toLowerCase().includes(query.toLowerCase()))
  ).slice(0, 6) || [];

  const filteredTags = allTags?.filter(
    t => t.tag.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 4) || [];

  const navItems = !query ? [
    { type: "nav", id: "dashboard", icon: "⌂", title: "Dashboard" },
    { type: "nav", id: "para", icon: "▦", title: "PARA View" },
    { type: "nav", id: "library", icon: "◫", title: "Library View" },
  ] : [];

  const allItems = [
    ...navItems,
    ...filteredTags.map(t => ({ type: "tag", id: t.tag, icon: "🏷️", title: t.tag, count: t.count })),
    ...filteredLinks.map(l => ({ type: "link", id: l._id, icon: "↗", title: l.title || "Untitled", url: l.url, bucket: l.para?.bucket })),
  ];

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, allItems.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && allItems[selectedIndex]) {
      e.preventDefault();
      const item = allItems[selectedIndex];
      if (item.type === "nav") {
        onNavigate(item.id as ViewMode);
        onClose();
      } else if (item.type === "tag") {
        onTagFilter(item.id);
        onClose();
      } else if (item.type === "link") {
        window.open((item as any).url, "_blank");
        onClose();
      }
    }
  };

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen, selectedIndex, allItems]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  if (!isOpen) return null;

  return (
    <div className="command-palette-overlay" onClick={onClose}>
      <div className="command-palette" onClick={(e) => e.stopPropagation()}>
        <div className="command-palette-input-wrapper">
          <span className="command-palette-icon">⌕</span>
          <input
            ref={inputRef}
            type="text"
            className="command-palette-input"
            placeholder="Search links, tags, navigate..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="command-palette-results">
          {allItems.length === 0 && query && (
            <div className="empty">No results found</div>
          )}
          {navItems.length > 0 && (
            <div className="command-group">
              <div className="command-group-title">Navigate</div>
              {navItems.map((item, i) => (
                <div
                  key={item.id}
                  className={`command-item ${selectedIndex === i ? "selected" : ""}`}
                  onClick={() => { onNavigate(item.id as ViewMode); onClose(); }}
                  onMouseEnter={() => setSelectedIndex(i)}
                >
                  <span className="command-item-icon">{item.icon}</span>
                  <div className="command-item-text">
                    <div className="command-item-title">{item.title}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {filteredTags.length > 0 && (
            <div className="command-group">
              <div className="command-group-title">Tags</div>
              {filteredTags.map((tag, i) => {
                const idx = navItems.length + i;
                return (
                  <div
                    key={tag.tag}
                    className={`command-item ${selectedIndex === idx ? "selected" : ""}`}
                    onClick={() => { onTagFilter(tag.tag); onClose(); }}
                    onMouseEnter={() => setSelectedIndex(idx)}
                  >
                    <span className="command-item-icon">🏷️</span>
                    <div className="command-item-text">
                      <div className="command-item-title">{tag.tag}</div>
                      <div className="command-item-desc">{tag.count} links</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {filteredLinks.length > 0 && (
            <div className="command-group">
              <div className="command-group-title">Links</div>
              {filteredLinks.map((link, i) => {
                const idx = navItems.length + filteredTags.length + i;
                return (
                  <a
                    key={link._id}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`command-item ${selectedIndex === idx ? "selected" : ""}`}
                    onClick={onClose}
                    onMouseEnter={() => setSelectedIndex(idx)}
                  >
                    <span className="command-item-icon">↗</span>
                    <div className="command-item-text">
                      <div className="command-item-title">{link.title || "Untitled"}</div>
                      <div className="command-item-desc">{link.para?.bucket}</div>
                    </div>
                  </a>
                );
              })}
            </div>
          )}
        </div>
        <div className="command-palette-footer">
          <span><kbd>↑↓</kbd> navigate</span>
          <span><kbd>↵</kbd> select</span>
          <span><kbd>esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}

// Bulk Actions Bar
function BulkActionsBar({
  selectedCount,
  onDelete,
  onMove,
  onClear,
}: {
  selectedCount: number;
  onDelete: () => void;
  onMove: (bucket: string) => void;
  onClear: () => void;
}) {
  const [showMoveMenu, setShowMoveMenu] = useState(false);

  if (selectedCount === 0) return null;

  return (
    <div className="bulk-actions-bar">
      <span className="bulk-count">{selectedCount} selected</span>
      <div className="bulk-buttons">
        <div className="move-dropdown">
          <button className="bulk-btn move" onClick={() => setShowMoveMenu(!showMoveMenu)}>
            Move to...
          </button>
          {showMoveMenu && (
            <div className="move-menu">
              <button onClick={() => { onMove("Project"); setShowMoveMenu(false); }}>🎯 Projects</button>
              <button onClick={() => { onMove("Area"); setShowMoveMenu(false); }}>🔄 Areas</button>
              <button onClick={() => { onMove("Resource"); setShowMoveMenu(false); }}>📚 Resources</button>
              <button onClick={() => { onMove("Archive"); setShowMoveMenu(false); }}>📦 Archive</button>
            </div>
          )}
        </div>
        <button className="bulk-btn delete" onClick={onDelete}>Delete</button>
        <button className="bulk-btn clear" onClick={onClear}>Cancel</button>
      </div>
    </div>
  );
}

// Dashboard View
function DashboardView({
  stats,
  onViewChange,
  onTagFilter,
}: {
  stats: any;
  onViewChange: (view: ViewMode) => void;
  onTagFilter: (tag: string) => void;
}) {
  const deleteLink = useMutation(api.links.deleteLink);

  if (!stats) {
    return (
      <div className="dashboard-loading">
        <div className="dashboard-grid">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="stat-card skeleton-stat">
              <Skeleton className="skeleton-stat-title" />
              <Skeleton className="skeleton-stat-value" />
            </div>
          ))}
        </div>
        <div className="section">
          <Skeleton className="skeleton-section-title" />
          {[1, 2, 3, 4].map(i => <SkeletonCard key={i} />)}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="quick-capture">
        <UrlInput />
      </div>

      <div className="dashboard-grid">
        <div className="stat-card" style={{ "--card-accent": "var(--accent-cyan)" } as React.CSSProperties}>
          <div className="stat-card-header">
            <span className="stat-card-title">Total Links</span>
            <span className="stat-card-icon">◎</span>
          </div>
          <div className="stat-card-value">{stats.total}</div>
          {stats.addedThisWeek > 0 && (
            <div className="stat-card-delta">↑ {stats.addedThisWeek} this week</div>
          )}
        </div>

        <div className="stat-card" style={{ "--card-accent": "var(--accent-blue)" } as React.CSSProperties}>
          <div className="stat-card-header">
            <span className="stat-card-title">Projects</span>
            <span className="stat-card-icon">🎯</span>
          </div>
          <div className="stat-card-value">{stats.bucketCounts.Project}</div>
        </div>

        <div className="stat-card" style={{ "--card-accent": "var(--accent-green)" } as React.CSSProperties}>
          <div className="stat-card-header">
            <span className="stat-card-title">Areas</span>
            <span className="stat-card-icon">🔄</span>
          </div>
          <div className="stat-card-value">{stats.bucketCounts.Area}</div>
        </div>

        <div className="stat-card" style={{ "--card-accent": "var(--accent-amber)" } as React.CSSProperties}>
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
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                </div>
                <div className="activity-info">
                  <div className="activity-title">{link.title || "Untitled"}</div>
                  <div className="activity-meta">
                    {link.para?.bucket && (
                      <span className={`activity-bucket ${link.para.bucket.toLowerCase()}`}>
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
                onClick={async (e) => {
                  e.preventDefault();
                  if (confirm("Delete this link?")) {
                    await deleteLink({ id: link._id });
                  }
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
            {stats.topTags.map((tag: { tag: string; count: number }) => (
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

// PARA Column
function ParaColumn({
  title,
  links,
  color,
  bucket,
  onDragStart,
  onDrop,
  onDropOnColumn,
  onRenameGroup,
  onTagClick,
  selectionMode,
  selectedIds,
  onSelect,
}: {
  title: string;
  links: any[] | undefined;
  color: string;
  bucket: "Project" | "Area" | "Resource" | "Archive";
  onDragStart: (link: Doc<"links">) => void;
  onDrop: (targetLink: Doc<"links">, bucket: string) => void;
  onDropOnColumn?: (bucket: string) => void;
  onRenameGroup?: (bucket: string, oldName: string, newName: string) => Promise<void>;
  onTagClick: (tag: string) => void;
  selectionMode: boolean;
  selectedIds: Set<Id<"links">>;
  onSelect: (id: Id<"links">, selected: boolean) => void;
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [editingGroup, setEditingGroup] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<string>("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(true); };
  const handleDragLeave = () => setIsDragOver(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (onDropOnColumn) onDropOnColumn(bucket);
  };

  if (links === undefined) {
    return (
      <div className={`para-column ${color}`}>
        <h2>{title}</h2>
        {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
      </div>
    );
  }

  if (links.length === 0) {
    return (
      <div
        className={`para-column ${color} ${isDragOver ? "drag-over-column" : ""}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <h2>{title} (0)</h2>
        <div className="empty">No items yet</div>
      </div>
    );
  }

  const grouped = groupBySubcategory(links);
  const subcategories = Object.keys(grouped).sort();

  return (
    <div
      className={`para-column ${color} ${isDragOver ? "drag-over-column" : ""}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <h2>{title} ({links.length})</h2>

      {subcategories.map((subcategory) => (
        <div key={subcategory} className="subcategory-group">
          <div className="subcategory-title-row">
            {editingGroup === subcategory ? (
              <input
                className="subcategory-input"
                value={editingValue}
                onChange={(e) => setEditingValue(e.target.value)}
                autoFocus
                onBlur={async () => {
                  const newName = editingValue.trim();
                  if (newName && newName !== subcategory && onRenameGroup) {
                    await onRenameGroup(bucket, subcategory, newName);
                  }
                  setEditingGroup(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                  if (e.key === "Escape") setEditingGroup(null);
                }}
              />
            ) : (
              <>
                <button
                  className="subcategory-toggle"
                  onClick={() => setCollapsed((prev) => ({ ...prev, [subcategory]: !prev[subcategory] }))}
                >
                  {collapsed[subcategory] ? "▸" : "▾"}
                </button>
                <h3 className="subcategory-title">{subcategory}</h3>
                {subcategory !== "Uncategorized" && onRenameGroup && (
                  <button
                    className="edit-subcategory-btn"
                    onClick={() => { setEditingGroup(subcategory); setEditingValue(subcategory); }}
                  >
                    ✎
                  </button>
                )}
              </>
            )}
          </div>
          {!collapsed[subcategory] &&
            grouped[subcategory].map((link) => (
              <LinkCard
                key={link._id}
                link={link}
                onDragStart={onDragStart}
                onDrop={(targetLink) => onDrop(targetLink, bucket)}
                onTagClick={onTagClick}
                selectionMode={selectionMode}
                isSelected={selectedIds.has(link._id)}
                onSelect={onSelect}
              />
            ))}
        </div>
      ))}
    </div>
  );
}

// Library Stack
function LibraryStack({
  mediaType,
  links,
  isExpanded,
  onToggle,
  onTagClick,
  onDelete,
}: {
  mediaType: MediaType;
  links: Doc<"links">[];
  isExpanded: boolean;
  onToggle: () => void;
  onTagClick: (tag: string) => void;
  onDelete: (id: Id<"links">) => void;
}) {
  const [expandedSubStack, setExpandedSubStack] = useState<string | null>(null);
  const info = MEDIA_TYPES[mediaType];
  const previewLinks = links.slice(0, 4);

  if (links.length === 0) return null;

  const subStacks: Record<string, Doc<"links">[]> = {};
  links.forEach((link) => {
    const key = getSubStackKey(link.url, link, mediaType);
    if (!subStacks[key]) subStacks[key] = [];
    subStacks[key].push(link);
  });

  const sortedSubStacks = Object.entries(subStacks).sort(([, a], [, b]) => b.length - a.length);
  const useSubStacks = sortedSubStacks.length > 1 && sortedSubStacks.filter(([, items]) => items.length > 1).length > 1;

  return (
    <div
      className={`library-stack ${isExpanded ? "expanded" : ""}`}
      style={{ "--stack-color": info.color } as React.CSSProperties}
    >
      <button className="stack-header" onClick={onToggle}>
        <div className="stack-icon">{info.emoji}</div>
        <div className="stack-info">
          <span className="stack-label">{info.label}</span>
          <span className="stack-count">
            {links.length} items{useSubStacks ? ` · ${sortedSubStacks.length} groups` : ""}
          </span>
        </div>
        <div className="stack-chevron">{isExpanded ? "▾" : "▸"}</div>
      </button>

      {!isExpanded && (
        <div className="stack-preview" onClick={onToggle}>
          <div className="stack-cards">
            {previewLinks.map((link, i) => (
              <div
                key={link._id}
                className="stack-card-preview"
                style={{ "--offset": i, "--total": Math.min(previewLinks.length, 4) } as React.CSSProperties}
              >
                <img
                  src={getFaviconUrl(link.url)}
                  alt=""
                  className="stack-card-favicon"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              </div>
            ))}
          </div>
          {links.length > 4 && <div className="stack-more">+{links.length - 4} more</div>}
        </div>
      )}

      {isExpanded && (
        <div className="stack-expanded">
          {useSubStacks ? (
            <div className="sub-stacks-container">
              {sortedSubStacks.map(([groupName, groupLinks]) => (
                <div key={groupName} className={`sub-stack ${expandedSubStack === groupName ? "expanded" : ""}`}>
                  <button
                    className="sub-stack-header"
                    onClick={() => setExpandedSubStack(expandedSubStack === groupName ? null : groupName)}
                  >
                    <span className="sub-stack-name">{groupName}</span>
                    <span className="sub-stack-count">{groupLinks.length}</span>
                    <span className="sub-stack-chevron">{expandedSubStack === groupName ? "▾" : "▸"}</span>
                  </button>
                  {expandedSubStack === groupName && (
                    <div className="sub-stack-items">
                      {groupLinks.map((link) => (
                        <div key={link._id} className="stack-item-wrapper">
                          <a href={link.url} target="_blank" rel="noopener noreferrer" className="stack-item compact">
                            <img
                              src={getFaviconUrl(link.url)}
                              alt=""
                              className="stack-item-favicon-small"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                            />
                            <div className="stack-item-info">
                              <div className="stack-item-title">{getCleanDisplayName(link.url, link.title, mediaType)}</div>
                            </div>
                          </a>
                          <button className="stack-item-delete" onClick={() => onDelete(link._id)}>×</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="stack-items-grid">
              {links.map((link) => (
                <div key={link._id} className="stack-item-wrapper">
                  <a href={link.url} target="_blank" rel="noopener noreferrer" className="stack-item">
                    <div className="stack-item-visual">
                      <img
                        src={getFaviconUrl(link.url)}
                        alt=""
                        className="stack-item-favicon"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                      <div className="stack-item-type-badge">{info.emoji}</div>
                    </div>
                    <div className="stack-item-info">
                      <div className="stack-item-title">{getCleanDisplayName(link.url, link.title, mediaType)}</div>
                      {link.para?.bucket && <div className="stack-item-bucket">{link.para.bucket}</div>}
                    </div>
                  </a>
                  <button className="stack-item-delete" onClick={() => onDelete(link._id)}>×</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Library View
function LibraryView({
  linksByMediaType,
  onTagClick,
  onDelete,
}: {
  linksByMediaType: Record<MediaType, Doc<"links">[]>;
  onTagClick: (tag: string) => void;
  onDelete: (id: Id<"links">) => void;
}) {
  const [expandedStack, setExpandedStack] = useState<MediaType | null>(null);
  const nonEmptyTypes = MEDIA_TYPE_ORDER.filter((type) => linksByMediaType[type].length > 0);

  if (nonEmptyTypes.length === 0) {
    return (
      <div className="empty">
        <div className="empty-icon">📭</div>
        <div className="empty-title">No links yet</div>
        <div className="empty-desc">Add some URLs to get started</div>
      </div>
    );
  }

  return (
    <div className="library-stacks">
      {nonEmptyTypes.map((mediaType) => (
        <LibraryStack
          key={mediaType}
          mediaType={mediaType}
          links={linksByMediaType[mediaType]}
          isExpanded={expandedStack === mediaType}
          onToggle={() => setExpandedStack(expandedStack === mediaType ? null : mediaType)}
          onTagClick={onTagClick}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}

// Mobile Nav
function MobileNav({ currentView, onViewChange }: { currentView: ViewMode; onViewChange: (view: ViewMode) => void }) {
  return (
    <nav className="mobile-nav">
      <button className={`mobile-nav-item ${currentView === "dashboard" ? "active" : ""}`} onClick={() => onViewChange("dashboard")}>
        <span className="mobile-nav-item-icon">⌂</span>
        Home
      </button>
      <button className={`mobile-nav-item ${currentView === "para" ? "active" : ""}`} onClick={() => onViewChange("para")}>
        <span className="mobile-nav-item-icon">▦</span>
        PARA
      </button>
      <button className={`mobile-nav-item ${currentView === "library" ? "active" : ""}`} onClick={() => onViewChange("library")}>
        <span className="mobile-nav-item-icon">◫</span>
        Library
      </button>
    </nav>
  );
}

// Main App
export default function Home() {
  const [viewMode, setViewMode] = useState<ViewMode>("dashboard");
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>("dark");
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<Id<"links">>>(new Set());

  // Queries
  const stats = useQuery(api.stats.getDashboardStats);
  const projects = useQuery(api.links.listByBucket, { bucket: "Project" });
  const areas = useQuery(api.links.listByBucket, { bucket: "Area" });
  const resources = useQuery(api.links.listByBucket, { bucket: "Resource" });
  const archive = useQuery(api.links.listByBucket, { bucket: "Archive" });
  const allLinks = useQuery(api.links.listAll);
  const filteredLinks = useQuery(api.links.listByTag, filterTag ? { tag: filterTag } : "skip");
  const allTags = useQuery(api.links.getAllTags);

  // Mutations
  const deleteMany = useMutation(api.links.deleteMany);
  const moveMany = useMutation(api.links.moveMany);
  const deleteLink = useMutation(api.links.deleteLink);

  // Actions
  const updateCategory = useAction(api.linkActions.updateCategory);
  const renameSubcategory = useAction(api.linkActions.renameSubcategory);
  const groupLinks = useAction(api.groupActions.groupLinks);

  const [draggedLink, setDraggedLink] = useState<Doc<"links"> | null>(null);

  // Get links to display (filtered or all)
  const displayLinks = filterTag ? filteredLinks : allLinks;
  const linksByMediaType = displayLinks ? groupByMediaType(displayLinks) : null;

  // Theme effect
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    const saved = localStorage.getItem("theme") as Theme | null;
    if (saved) setTheme(saved);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "\\") {
        e.preventDefault();
        setTheme(t => t === "dark" ? "light" : "dark");
      }
      if (e.key === "Escape" && selectionMode) {
        setSelectionMode(false);
        setSelectedIds(new Set());
      }
      // Number shortcuts for views
      if (!e.metaKey && !e.ctrlKey && !e.altKey) {
        if (e.key === "1") setViewMode("dashboard");
        if (e.key === "2") setViewMode("para");
        if (e.key === "3") setViewMode("library");
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [selectionMode]);

  const handleTagFilter = (tag: string) => {
    setFilterTag(tag);
    setViewMode("para");
  };

  const handleClearFilter = () => {
    setFilterTag(null);
  };

  const handleDragStart = (link: Doc<"links">) => setDraggedLink(link);

  const handleDrop = async (targetLink: Doc<"links">, targetBucket: string) => {
    if (!draggedLink || draggedLink._id === targetLink._id) {
      setDraggedLink(null);
      return;
    }
    try {
      await groupLinks({ link1Id: draggedLink._id, link2Id: targetLink._id });
      await updateCategory({ linkId: draggedLink._id, bucket: targetBucket as any });
    } catch (error) {
      console.error("Error grouping:", error);
    }
    setDraggedLink(null);
  };

  const handleDropOnColumn = async (targetBucket: string) => {
    if (!draggedLink) return;
    try {
      await updateCategory({ linkId: draggedLink._id, bucket: targetBucket as any, subcategory: null });
    } catch (error) {
      console.error("Error moving:", error);
    }
    setDraggedLink(null);
  };

  const handleRenameGroup = async (bucket: string, oldName: string, newName: string) => {
    try {
      await renameSubcategory({ bucket: bucket as any, oldSubcategory: oldName, newSubcategory: newName });
    } catch (error) {
      console.error("Error renaming:", error);
    }
  };

  const handleSelect = (id: Id<"links">, selected: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (selected) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleBulkDelete = async () => {
    if (confirm(`Delete ${selectedIds.size} links?`)) {
      await deleteMany({ ids: Array.from(selectedIds) });
      setSelectedIds(new Set());
      setSelectionMode(false);
    }
  };

  const handleBulkMove = async (bucket: string) => {
    await moveMany({ ids: Array.from(selectedIds), bucket: bucket as any });
    setSelectedIds(new Set());
    setSelectionMode(false);
  };

  const handleDeleteLink = async (id: Id<"links">) => {
    if (confirm("Delete this link?")) {
      await deleteLink({ id });
    }
  };

  const getPageTitle = () => {
    if (filterTag) return `🏷️ ${filterTag}`;
    switch (viewMode) {
      case "dashboard": return "Dashboard";
      case "para": return "PARA View";
      case "library": return "Library";
      default: return "Parasight";
    }
  };

  // Filter links by tag for PARA view
  const getFilteredBucketLinks = (links: any[] | undefined) => {
    if (!filterTag || !links) return links;
    return links.filter(link => link.tags?.includes(filterTag));
  };

  return (
    <div className="app-layout" data-theme={theme}>
      <Sidebar
        currentView={viewMode}
        onViewChange={setViewMode}
        stats={stats}
        filterTag={filterTag}
        onClearFilter={handleClearFilter}
      />

      <main className="main-content">
        <header className="main-header">
          <div className="header-left">
            <h1 className="page-title">{getPageTitle()}</h1>
            {filterTag && (
              <button className="clear-filter-btn" onClick={handleClearFilter}>
                Clear filter
              </button>
            )}
          </div>
          <div className="header-right">
            {viewMode === "para" && (
              <button
                className={`selection-toggle ${selectionMode ? "active" : ""}`}
                onClick={() => {
                  setSelectionMode(!selectionMode);
                  setSelectedIds(new Set());
                }}
              >
                {selectionMode ? "Cancel" : "Select"}
              </button>
            )}
            <button className="search-trigger" onClick={() => setCommandPaletteOpen(true)}>
              <span className="search-trigger-icon">⌕</span>
              <span className="search-trigger-text">Search...</span>
              <span className="search-trigger-kbd">⌘K</span>
            </button>
            <ThemeToggle theme={theme} onToggle={() => setTheme(t => t === "dark" ? "light" : "dark")} />
          </div>
        </header>

        {selectionMode && (
          <BulkActionsBar
            selectedCount={selectedIds.size}
            onDelete={handleBulkDelete}
            onMove={handleBulkMove}
            onClear={() => { setSelectionMode(false); setSelectedIds(new Set()); }}
          />
        )}

        <div className="page-content">
          {viewMode === "dashboard" && (
            <DashboardView stats={stats} onViewChange={setViewMode} onTagFilter={handleTagFilter} />
          )}

          {viewMode === "para" && (
            <>
              <div className="quick-capture">
                <UrlInput />
              </div>
              <div className="para-grid">
                <ParaColumn
                  title="🎯 Projects"
                  links={getFilteredBucketLinks(projects)}
                  color="projects"
                  bucket="Project"
                  onDragStart={handleDragStart}
                  onDrop={handleDrop}
                  onDropOnColumn={handleDropOnColumn}
                  onRenameGroup={handleRenameGroup}
                  onTagClick={handleTagFilter}
                  selectionMode={selectionMode}
                  selectedIds={selectedIds}
                  onSelect={handleSelect}
                />
                <ParaColumn
                  title="🔄 Areas"
                  links={getFilteredBucketLinks(areas)}
                  color="areas"
                  bucket="Area"
                  onDragStart={handleDragStart}
                  onDrop={handleDrop}
                  onDropOnColumn={handleDropOnColumn}
                  onRenameGroup={handleRenameGroup}
                  onTagClick={handleTagFilter}
                  selectionMode={selectionMode}
                  selectedIds={selectedIds}
                  onSelect={handleSelect}
                />
                <ParaColumn
                  title="📚 Resources"
                  links={getFilteredBucketLinks(resources)}
                  color="resources"
                  bucket="Resource"
                  onDragStart={handleDragStart}
                  onDrop={handleDrop}
                  onDropOnColumn={handleDropOnColumn}
                  onRenameGroup={handleRenameGroup}
                  onTagClick={handleTagFilter}
                  selectionMode={selectionMode}
                  selectedIds={selectedIds}
                  onSelect={handleSelect}
                />
                <ParaColumn
                  title="📦 Archive"
                  links={getFilteredBucketLinks(archive)}
                  color="archive"
                  bucket="Archive"
                  onDragStart={handleDragStart}
                  onDrop={handleDrop}
                  onDropOnColumn={handleDropOnColumn}
                  onRenameGroup={handleRenameGroup}
                  onTagClick={handleTagFilter}
                  selectionMode={selectionMode}
                  selectedIds={selectedIds}
                  onSelect={handleSelect}
                />
              </div>
            </>
          )}

          {viewMode === "library" && (
            <>
              <div className="quick-capture">
                <UrlInput />
              </div>
              {linksByMediaType ? (
                <LibraryView
                  linksByMediaType={linksByMediaType}
                  onTagClick={handleTagFilter}
                  onDelete={handleDeleteLink}
                />
              ) : (
                <div className="library-loading">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="skeleton-stack">
                      <Skeleton className="skeleton-stack-header" />
                      <Skeleton className="skeleton-stack-preview" />
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </main>

      <MobileNav currentView={viewMode} onViewChange={setViewMode} />
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        links={allLinks}
        onNavigate={setViewMode}
        onTagFilter={handleTagFilter}
        allTags={allTags}
      />
    </div>
  );
}
