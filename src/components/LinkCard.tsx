"use client";

import { useState } from "react";
import { useAction, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Doc, Id } from "../../convex/_generated/dataModel";

interface LinkCardProps {
  link: Doc<"links">;
  onDragStart?: (link: Doc<"links">) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (targetLink: Doc<"links">) => void;
  onTagClick?: (tag: string) => void;
  isSelected?: boolean;
  onSelect?: (id: Id<"links">, selected: boolean) => void;
  selectionMode?: boolean;
}

export function LinkCard({
  link,
  onDragStart,
  onDragOver,
  onDrop,
  onTagClick,
  isSelected,
  onSelect,
  selectionMode,
}: LinkCardProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(link.title || link.para?.name || "");
  const [showActions, setShowActions] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const updateTitle = useAction(api.linkActions.updateTitle);
  const deleteLink = useMutation(api.links.deleteLink);

  const handleDragStart = (e: React.DragEvent) => {
    setIsDragging(true);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", link._id);
    onDragStart?.(link);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    setIsDragOver(true);
    onDragOver?.(e);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) {
      setIsDragOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    onDrop?.(link);
  };

  const handleDelete = async () => {
    if (confirmDelete) {
      await deleteLink({ id: link._id });
      setConfirmDelete(false);
    } else {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
    }
  };

  const getFaviconUrl = (url: string) => {
    try {
      const parsed = new URL(url);
      return `https://www.google.com/s2/favicons?domain=${parsed.hostname}&sz=32`;
    } catch {
      return "";
    }
  };

  return (
    <div
      className={`link-card ${isDragging ? "dragging" : ""} ${isDragOver ? "drag-over" : ""} ${isSelected ? "selected" : ""}`}
      draggable={!selectionMode}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => { setShowActions(false); setConfirmDelete(false); }}
    >
      {selectionMode && (
        <label className="link-checkbox">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => onSelect?.(link._id, e.target.checked)}
          />
          <span className="checkmark" />
        </label>
      )}

      <div className="link-content">
        {isEditing ? (
          <input
            type="text"
            value={editedTitle}
            onChange={(e) => setEditedTitle(e.target.value)}
            onBlur={async () => {
              setIsEditing(false);
              if (editedTitle.trim() && editedTitle !== link.title) {
                await updateTitle({ linkId: link._id, title: editedTitle.trim() });
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") {
                setEditedTitle(link.title || link.para?.name || "");
                setIsEditing(false);
              }
            }}
            className="link-title-edit"
            autoFocus
            onDragStart={(e) => e.preventDefault()}
          />
        ) : (
          <div className="link-title-row">
            <img
              src={getFaviconUrl(link.url)}
              alt=""
              className="link-favicon"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="link-title"
              onDragStart={(e) => e.preventDefault()}
            >
              {link.title || link.para?.name || "Untitled Link"}
            </a>
          </div>
        )}

        {link.description && (
          <div className="link-description">{link.description}</div>
        )}

        {link.tags && link.tags.length > 0 && (
          <div className="tags">
            {link.tags.slice(0, 5).map((tag, i) => (
              <button
                key={i}
                className="tag"
                onClick={(e) => {
                  e.preventDefault();
                  onTagClick?.(tag);
                }}
                title={`Filter by "${tag}"`}
              >
                {tag}
              </button>
            ))}
            {link.tags.length > 5 && (
              <span className="tag tag-more">+{link.tags.length - 5}</span>
            )}
          </div>
        )}
      </div>

      <div className={`link-actions ${showActions ? "visible" : ""}`}>
        <button
          className="action-btn edit"
          onClick={(e) => {
            e.preventDefault();
            setIsEditing(true);
          }}
          title="Edit title"
        >
          ✎
        </button>
        <button
          className={`action-btn delete ${confirmDelete ? "confirm" : ""}`}
          onClick={(e) => {
            e.preventDefault();
            handleDelete();
          }}
          title={confirmDelete ? "Click again to confirm" : "Delete link"}
        >
          {confirmDelete ? "✓" : "×"}
        </button>
      </div>
    </div>
  );
}
