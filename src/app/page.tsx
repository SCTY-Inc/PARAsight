"use client";

import { useState, useEffect, useCallback } from "react";
import { useQuery, useAction, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Doc, Id } from "../../convex/_generated/dataModel";
import type { ViewMode, Theme, DashboardStats, ParaBucket } from "../lib/types";
import { groupByMediaType } from "../lib/mediaType";

// Components
import { Sidebar } from "../components/Sidebar";
import { CommandPalette } from "../components/CommandPalette";
import { DashboardView } from "../components/DashboardView";
import { ParaColumn } from "../components/ParaColumn";
import { LibraryView } from "../components/LibraryView";
import { UrlInput } from "../components/UrlInput";
import { ThemeToggle } from "../components/ThemeToggle";
import { MobileNav } from "../components/MobileNav";
import { BulkActionsBar } from "../components/BulkActionsBar";
import { Skeleton } from "../components/Skeleton";

export default function Home() {
  // UI State
  const [viewMode, setViewMode] = useState<ViewMode>("dashboard");
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>("dark");
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<Id<"links">>>(new Set());
  const [draggedLink, setDraggedLink] = useState<Doc<"links"> | null>(null);

  // Queries
  const stats = useQuery(api.stats.getDashboardStats) as DashboardStats | undefined;
  const projects = useQuery(api.links.listByBucket, { bucket: "Project" });
  const areas = useQuery(api.links.listByBucket, { bucket: "Area" });
  const resources = useQuery(api.links.listByBucket, { bucket: "Resource" });
  const archive = useQuery(api.links.listByBucket, { bucket: "Archive" });
  const allLinks = useQuery(api.links.listAll, {});
  const filteredLinks = useQuery(
    api.links.listByTag,
    filterTag ? { tag: filterTag } : "skip"
  );
  const allTags = useQuery(api.links.getAllTags, {});

  // Mutations
  const deleteMany = useMutation(api.links.deleteMany);
  const moveMany = useMutation(api.links.moveMany);
  const deleteLink = useMutation(api.links.deleteLink);

  // Actions
  const updateCategory = useAction(api.linkActions.updateCategory);
  const renameSubcategory = useAction(api.linkActions.renameSubcategory);
  const groupLinks = useAction(api.groupActions.groupLinks);

  // Derived state
  const displayLinks = filterTag ? filteredLinks : allLinks;
  const linksByMediaType = displayLinks ? groupByMediaType(displayLinks) : null;

  // Theme persistence
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
        setTheme((t) => (t === "dark" ? "light" : "dark"));
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

  // Handlers
  const handleTagFilter = useCallback((tag: string) => {
    setFilterTag(tag);
    setViewMode("para");
  }, []);

  const handleClearFilter = useCallback(() => {
    setFilterTag(null);
  }, []);

  const handleDragStart = useCallback((link: Doc<"links">) => {
    setDraggedLink(link);
  }, []);

  const handleDrop = useCallback(
    async (targetLink: Doc<"links">, targetBucket: string) => {
      if (!draggedLink || draggedLink._id === targetLink._id) {
        setDraggedLink(null);
        return;
      }
      try {
        await groupLinks({ link1Id: draggedLink._id, link2Id: targetLink._id });
        await updateCategory({
          linkId: draggedLink._id,
          bucket: targetBucket as ParaBucket,
        });
      } catch (error) {
        console.error("Error grouping:", error);
      }
      setDraggedLink(null);
    },
    [draggedLink, groupLinks, updateCategory]
  );

  const handleDropOnColumn = useCallback(
    async (targetBucket: string) => {
      if (!draggedLink) return;
      try {
        await updateCategory({
          linkId: draggedLink._id,
          bucket: targetBucket as ParaBucket,
          subcategory: null,
        });
      } catch (error) {
        console.error("Error moving:", error);
      }
      setDraggedLink(null);
    },
    [draggedLink, updateCategory]
  );

  const handleRenameGroup = useCallback(
    async (bucket: string, oldName: string, newName: string) => {
      try {
        await renameSubcategory({
          bucket: bucket as ParaBucket,
          oldSubcategory: oldName,
          newSubcategory: newName,
        });
      } catch (error) {
        console.error("Error renaming:", error);
      }
    },
    [renameSubcategory]
  );

  const handleSelect = useCallback((id: Id<"links">, selected: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (selected) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const handleBulkDelete = useCallback(async () => {
    if (window.confirm(`Delete ${selectedIds.size} links?`)) {
      await deleteMany({ ids: Array.from(selectedIds) });
      setSelectedIds(new Set());
      setSelectionMode(false);
    }
  }, [selectedIds, deleteMany]);

  const handleBulkMove = useCallback(
    async (bucket: string) => {
      await moveMany({
        ids: Array.from(selectedIds),
        bucket: bucket as ParaBucket,
      });
      setSelectedIds(new Set());
      setSelectionMode(false);
    },
    [selectedIds, moveMany]
  );

  const handleDeleteLink = useCallback(
    async (id: Id<"links">) => {
      if (window.confirm("Delete this link?")) {
        await deleteLink({ id });
      }
    },
    [deleteLink]
  );

  const getPageTitle = () => {
    if (filterTag) return `🏷️ ${filterTag}`;
    switch (viewMode) {
      case "dashboard":
        return "Dashboard";
      case "para":
        return "PARA View";
      case "library":
        return "Library";
      default:
        return "Parasight";
    }
  };

  // Filter links by tag for PARA view
  const getFilteredBucketLinks = (links: Doc<"links">[] | undefined) => {
    if (!filterTag || !links) return links;
    return links.filter((link) => link.tags?.includes(filterTag));
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
            <button
              className="search-trigger"
              onClick={() => setCommandPaletteOpen(true)}
            >
              <span className="search-trigger-icon">⌕</span>
              <span className="search-trigger-text">Search...</span>
              <span className="search-trigger-kbd">⌘K</span>
            </button>
            <ThemeToggle
              theme={theme}
              onToggle={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
            />
          </div>
        </header>

        {selectionMode && (
          <BulkActionsBar
            selectedCount={selectedIds.size}
            onDelete={handleBulkDelete}
            onMove={handleBulkMove}
            onClear={() => {
              setSelectionMode(false);
              setSelectedIds(new Set());
            }}
          />
        )}

        <div className="page-content">
          {viewMode === "dashboard" && (
            <DashboardView
              stats={stats}
              onViewChange={setViewMode}
              onTagFilter={handleTagFilter}
            />
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
                  {[1, 2, 3].map((i) => (
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
