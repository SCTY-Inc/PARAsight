"use client";

import { useState } from "react";
import type { Doc, Id } from "../../convex/_generated/dataModel";
import type { ParaBucket } from "../lib/types";
import { groupBySubcategory } from "../lib/utils";
import { LinkCard } from "./LinkCard";
import { SkeletonCard } from "./Skeleton";

interface ParaColumnProps {
  title: string;
  links: Doc<"links">[] | undefined;
  color: string;
  bucket: ParaBucket;
  onDragStart: (link: Doc<"links">) => void;
  onDrop: (targetLink: Doc<"links">, bucket: string) => void;
  onDropOnColumn?: (bucket: string) => void;
  onRenameGroup?: (
    bucket: string,
    oldName: string,
    newName: string
  ) => Promise<void>;
  onTagClick: (tag: string) => void;
  selectionMode: boolean;
  selectedIds: Set<Id<"links">>;
  onSelect: (id: Id<"links">, selected: boolean) => void;
}

export function ParaColumn({
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
}: ParaColumnProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [editingGroup, setEditingGroup] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<string>("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };
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
        {[1, 2, 3].map((i) => (
          <SkeletonCard key={i} />
        ))}
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
      <h2>
        {title} ({links.length})
      </h2>

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
                  onClick={() =>
                    setCollapsed((prev) => ({
                      ...prev,
                      [subcategory]: !prev[subcategory],
                    }))
                  }
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
