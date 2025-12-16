"use client";

import type { ViewMode } from "../lib/types";

interface MobileNavProps {
  currentView: ViewMode;
  onViewChange: (view: ViewMode) => void;
}

export function MobileNav({ currentView, onViewChange }: MobileNavProps) {
  return (
    <nav className="mobile-nav">
      <button
        className={`mobile-nav-item ${currentView === "dashboard" ? "active" : ""}`}
        onClick={() => onViewChange("dashboard")}
      >
        <span className="mobile-nav-item-icon">⌂</span>
        Home
      </button>
      <button
        className={`mobile-nav-item ${currentView === "para" ? "active" : ""}`}
        onClick={() => onViewChange("para")}
      >
        <span className="mobile-nav-item-icon">▦</span>
        PARA
      </button>
      <button
        className={`mobile-nav-item ${currentView === "library" ? "active" : ""}`}
        onClick={() => onViewChange("library")}
      >
        <span className="mobile-nav-item-icon">◫</span>
        Library
      </button>
    </nav>
  );
}
