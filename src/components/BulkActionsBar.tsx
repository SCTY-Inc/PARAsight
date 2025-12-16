"use client";

import { useState } from "react";

interface BulkActionsBarProps {
  selectedCount: number;
  onDelete: () => void;
  onMove: (bucket: string) => void;
  onClear: () => void;
}

export function BulkActionsBar({
  selectedCount,
  onDelete,
  onMove,
  onClear,
}: BulkActionsBarProps) {
  const [showMoveMenu, setShowMoveMenu] = useState(false);

  if (selectedCount === 0) return null;

  return (
    <div className="bulk-actions-bar">
      <span className="bulk-count">{selectedCount} selected</span>
      <div className="bulk-buttons">
        <div className="move-dropdown">
          <button
            className="bulk-btn move"
            onClick={() => setShowMoveMenu(!showMoveMenu)}
          >
            Move to...
          </button>
          {showMoveMenu && (
            <div className="move-menu">
              <button
                onClick={() => {
                  onMove("Project");
                  setShowMoveMenu(false);
                }}
              >
                🎯 Projects
              </button>
              <button
                onClick={() => {
                  onMove("Area");
                  setShowMoveMenu(false);
                }}
              >
                🔄 Areas
              </button>
              <button
                onClick={() => {
                  onMove("Resource");
                  setShowMoveMenu(false);
                }}
              >
                📚 Resources
              </button>
              <button
                onClick={() => {
                  onMove("Archive");
                  setShowMoveMenu(false);
                }}
              >
                📦 Archive
              </button>
            </div>
          )}
        </div>
        <button className="bulk-btn delete" onClick={onDelete}>
          Delete
        </button>
        <button className="bulk-btn clear" onClick={onClear}>
          Cancel
        </button>
      </div>
    </div>
  );
}
