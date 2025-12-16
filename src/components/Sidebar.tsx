"use client";

import type { ViewMode, DashboardStats } from "../lib/types";

interface SidebarProps {
  currentView: ViewMode;
  onViewChange: (view: ViewMode) => void;
  stats: DashboardStats | undefined;
  filterTag: string | null;
  onClearFilter: () => void;
}

export function Sidebar({
  currentView,
  onViewChange,
  stats,
  filterTag,
  onClearFilter,
}: SidebarProps) {
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
            <span className="nav-item-badge">
              {stats?.bucketCounts?.Project || 0}
            </span>
          </button>
          <button className="nav-item" onClick={() => onViewChange("para")}>
            <span className="nav-item-icon">🔄</span>
            Areas
            <span className="nav-item-badge">
              {stats?.bucketCounts?.Area || 0}
            </span>
          </button>
          <button className="nav-item" onClick={() => onViewChange("para")}>
            <span className="nav-item-icon">📚</span>
            Resources
            <span className="nav-item-badge">
              {stats?.bucketCounts?.Resource || 0}
            </span>
          </button>
          <button className="nav-item" onClick={() => onViewChange("para")}>
            <span className="nav-item-icon">📦</span>
            Archive
            <span className="nav-item-badge">
              {stats?.bucketCounts?.Archive || 0}
            </span>
          </button>
        </div>

        {filterTag && (
          <div className="nav-section">
            <div className="nav-section-title">Active Filter</div>
            <div className="active-filter">
              <span className="filter-tag">🏷️ {filterTag}</span>
              <button className="clear-filter" onClick={onClearFilter}>
                ×
              </button>
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
