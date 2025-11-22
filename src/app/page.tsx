"use client";

import { useState } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { LinkCard } from "../components/LinkCard";
import { UrlInput } from "../components/UrlInput";
import type { Doc } from "../../convex/_generated/dataModel";

// Group links by subcategory
function groupBySubcategory(links: any[]) {
  const groups: Record<string, any[]> = {};

  links.forEach(link => {
    const subcategory = link.subcategory || "Uncategorized";
    if (!groups[subcategory]) {
      groups[subcategory] = [];
    }
    groups[subcategory].push(link);
  });

  return groups;
}

// Render a PARA column with subcategory grouping
function ParaColumn({
  title,
  links,
  color,
  bucket,
  onDragStart,
  onDrop,
  onDropOnColumn,
  onRenameGroup,
}: {
  title: string;
  links: any[] | undefined;
  color: string;
  bucket: "Project" | "Area" | "Resource" | "Archive";
  onDragStart: (link: Doc<"links">) => void;
  onDrop: (targetLink: Doc<"links">, bucket: string) => void;
  onDropOnColumn?: (bucket: string) => void;
  onRenameGroup?: (bucket: string, oldName: string, newName: string) => Promise<void>;
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [editingGroup, setEditingGroup] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<string>("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    // Handle drop on empty column - move to this bucket without grouping
    if (onDropOnColumn) {
      onDropOnColumn(bucket);
    }
  };

  if (!links || links.length === 0) {
    return (
      <div
        className={`para-column ${color} ${isDragOver ? 'drag-over-column' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <h2>{title} (0)</h2>
        <div className="empty">No {title.toLowerCase()} yet. Drag links here!</div>
      </div>
    );
  }

  const grouped = groupBySubcategory(links);
  const subcategories = Object.keys(grouped).sort();

  return (
    <div
      className={`para-column ${color} ${isDragOver ? 'drag-over-column' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <h2>{title} ({links.length})</h2>

      {subcategories.map(subcategory => (
        <div key={subcategory} className="subcategory-group">
          <div className="subcategory-header">
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
                onKeyDown={async (e) => {
                  if (e.key === "Enter") {
                    e.currentTarget.blur();
                  } else if (e.key === "Escape") {
                    setEditingGroup(null);
                  }
                }}
              />
            ) : (
              <div className="subcategory-title-row">
                <button
                  type="button"
                  className="subcategory-toggle"
                  onClick={() =>
                    setCollapsed((prev) => ({
                      ...prev,
                      [subcategory]: !prev[subcategory],
                    }))
                  }
                  onDragStart={(e) => e.preventDefault()}
                  aria-label={collapsed[subcategory] ? "Expand group" : "Collapse group"}
                >
                  {collapsed[subcategory] ? "▸" : "▾"}
                </button>
                <h3 className="subcategory-title">{subcategory}</h3>
                {subcategory !== "Uncategorized" && onRenameGroup && (
                  <button
                    className="edit-subcategory-btn"
                    onClick={() => {
                      setEditingGroup(subcategory);
                      setEditingValue(subcategory);
                    }}
                    onDragStart={(e) => e.preventDefault()}
                  >
                    ✎
                  </button>
                )}
              </div>
            )}
          </div>
          {!collapsed[subcategory] &&
            grouped[subcategory].map(link => (
              <LinkCard
                key={link._id}
                link={link}
                onDragStart={onDragStart}
                onDrop={(targetLink) => onDrop(targetLink, bucket)}
              />
            ))}
        </div>
      ))}
    </div>
  );
}

export default function Home() {
  const projects = useQuery(api.links.listByBucket, { bucket: "Project" });
  const areas = useQuery(api.links.listByBucket, { bucket: "Area" });
  const resources = useQuery(api.links.listByBucket, { bucket: "Resource" });
  const archive = useQuery(api.links.listByBucket, { bucket: "Archive" });

  const updateCategory = useAction(api.linkActions.updateCategory);
  const renameSubcategory = useAction(api.linkActions.renameSubcategory);
  const groupLinks = useAction(api.groupActions.groupLinks);

  const [draggedLink, setDraggedLink] = useState<Doc<"links"> | null>(null);

  const isLoading = projects === undefined || areas === undefined ||
                    resources === undefined || archive === undefined;

  const handleDragStart = (link: Doc<"links">) => {
    setDraggedLink(link);
  };

  const handleDrop = async (targetLink: Doc<"links">, targetBucket: string) => {
    console.log('handleDrop called', { draggedLink, targetLink, targetBucket });

    if (!draggedLink) {
      console.log('No dragged link');
      return;
    }

    // If dropping on same link, do nothing
    if (draggedLink._id === targetLink._id) {
      console.log('Dropping on same link, ignoring');
      setDraggedLink(null);
      return;
    }

    try {
      // Group the two links together with AI-generated name
      console.log('Creating group with AI-generated name...');
      const result = await groupLinks({
        link1Id: draggedLink._id,
        link2Id: targetLink._id,
      });

      console.log(`✓ Created group "${result.groupName}" containing both links`);

      // Move dragged link into the target bucket so column changes reflect immediately
      await updateCategory({
        linkId: draggedLink._id,
        bucket: targetBucket as "Project" | "Area" | "Resource" | "Archive",
      });
    } catch (error) {
      console.error("✗ Error grouping links:", error);
      alert(`Error: ${error}`);
    }

    setDraggedLink(null);
  };

  const handleDropOnColumn = async (targetBucket: string) => {
    console.log('handleDropOnColumn called', { draggedLink, targetBucket });

    if (!draggedLink) {
      console.log('No dragged link');
      return;
    }

    try {
      // Move to new bucket, keep subcategory
      console.log('Moving to new bucket and clearing subcategory...');
      await updateCategory({
        linkId: draggedLink._id,
        bucket: targetBucket as "Project" | "Area" | "Resource" | "Archive",
        subcategory: null, // clear old group label when dropping on a column
      });

      console.log(`✓ Moved "${draggedLink.title || draggedLink.para?.name}" to ${targetBucket}`);
    } catch (error) {
      console.error("✗ Error moving link:", error);
      alert(`Error: ${error}`);
    }

    setDraggedLink(null);
  };

  const handleRenameGroup = async (bucket: string, oldName: string, newName: string) => {
    try {
      await renameSubcategory({
        bucket: bucket as "Project" | "Area" | "Resource" | "Archive",
        oldSubcategory: oldName,
        newSubcategory: newName,
      });
      console.log(`✓ Renamed group \"${oldName}\" → \"${newName}\"`);
    } catch (error) {
      console.error("✗ Error renaming group:", error);
      alert(`Error renaming group: ${error}`);
    }
  };

  return (
    <div className="container">
      <div className="header">
        <h1>PARAsight: Intelligent tab management</h1>
        <p>
          Automatically classify and organize your Safari tabs using PARA (Projects, Areas, Resources, Archive)
        </p>
      </div>

      <UrlInput />

      {isLoading ? (
        <div className="loading">Loading links...</div>
      ) : (
        <div className="para-grid">
          <ParaColumn
            title="🎯 Projects"
            links={projects}
            color="projects"
            bucket="Project"
            onDragStart={handleDragStart}
            onDrop={handleDrop}
            onDropOnColumn={handleDropOnColumn}
            onRenameGroup={handleRenameGroup}
          />
          <ParaColumn
            title="🔄 Areas"
            links={areas}
            color="areas"
            bucket="Area"
            onDragStart={handleDragStart}
            onDrop={handleDrop}
            onDropOnColumn={handleDropOnColumn}
            onRenameGroup={handleRenameGroup}
          />
          <ParaColumn
            title="📚 Resources"
            links={resources}
            color="resources"
            bucket="Resource"
            onDragStart={handleDragStart}
            onDrop={handleDrop}
            onDropOnColumn={handleDropOnColumn}
            onRenameGroup={handleRenameGroup}
          />
          <ParaColumn
            title="📦 Archive"
            links={archive}
            color="archive"
            bucket="Archive"
            onDragStart={handleDragStart}
            onDrop={handleDrop}
            onDropOnColumn={handleDropOnColumn}
            onRenameGroup={handleRenameGroup}
          />
        </div>
      )}
    </div>
  );
}
