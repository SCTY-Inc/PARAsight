"use client";

import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Doc } from "../../convex/_generated/dataModel";

interface LinkCardProps {
  link: Doc<"links">;
  onDragStart?: (link: Doc<"links">) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (targetLink: Doc<"links">) => void;
}

export function LinkCard({ link, onDragStart, onDragOver, onDrop }: LinkCardProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(link.title || link.para?.name || "");

  const updateTitle = useAction(api.linkActions.updateTitle);

  const handleDragStart = (e: React.DragEvent) => {
    console.log('Drag started:', link.title || link.para?.name);
    setIsDragging(true);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData('text/plain', link._id); // Set data for drag
    onDragStart?.(link);
  };

  const handleDragEnd = () => {
    console.log('Drag ended');
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
    // Only clear if actually leaving the card
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;

    if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) {
      setIsDragOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    console.log('Drop on:', link.title || link.para?.name);
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    onDrop?.(link);
  };

  return (
    <div
      className={`link-card ${isDragging ? 'dragging' : ''} ${isDragOver ? 'drag-over' : ''}`}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isEditing ? (
        <input
          type="text"
          value={editedTitle}
          onChange={(e) => setEditedTitle(e.target.value)}
          onBlur={async () => {
            setIsEditing(false);
            if (editedTitle.trim() && editedTitle !== link.title) {
              await updateTitle({
                linkId: link._id,
                title: editedTitle.trim(),
              });
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.currentTarget.blur();
            }
            if (e.key === 'Escape') {
              setEditedTitle(link.title || link.para?.name || "");
              setIsEditing(false);
            }
          }}
          className="link-title-edit"
          autoFocus
          onDragStart={(e) => e.preventDefault()}
        />
      ) : (
        <div className="link-title-container">
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="link-title"
            onDragStart={(e) => e.preventDefault()}
          >
            {link.title || link.para?.name || "Untitled Link"}
          </a>
          <button
            className="edit-title-btn"
            onClick={(e) => {
              e.preventDefault();
              setIsEditing(true);
            }}
            onDragStart={(e) => e.preventDefault()}
          >
            ✎
          </button>
        </div>
      )}

      {link.description && (
        <div className="link-description">{link.description}</div>
      )}

      {link.tags && link.tags.length > 0 && (
        <div className="tags">
          {link.tags.map((tag, i) => (
            <button
              key={i}
              className="tag"
              onClick={(e) => {
                e.preventDefault();
                // Copy tag to clipboard for now (can expand to filter later)
                navigator.clipboard.writeText(tag);
              }}
              title={`Click to copy "${tag}"`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {link.sourceNote && (
        <div className="link-meta">
          <div className="source">Note: {link.sourceNote}</div>
        </div>
      )}
    </div>
  );
}
