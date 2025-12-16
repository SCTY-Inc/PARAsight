"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { Doc } from "../../convex/_generated/dataModel";
import type { ViewMode, TagWithCount } from "../lib/types";

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  links: Doc<"links">[] | undefined;
  onNavigate: (view: ViewMode) => void;
  onTagFilter: (tag: string) => void;
  allTags: TagWithCount[] | undefined;
}

type CommandItem =
  | { type: "nav"; id: string; icon: string; title: string }
  | { type: "tag"; id: string; icon: string; title: string; count: number }
  | {
      type: "link";
      id: string;
      icon: string;
      title: string;
      url: string;
      bucket?: string;
    };

export function CommandPalette({
  isOpen,
  onClose,
  links,
  onNavigate,
  onTagFilter,
  allTags,
}: CommandPaletteProps) {
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

  const filteredLinks =
    links
      ?.filter(
        (link) =>
          link.title?.toLowerCase().includes(query.toLowerCase()) ||
          link.url.toLowerCase().includes(query.toLowerCase()) ||
          link.tags?.some((tag) =>
            tag.toLowerCase().includes(query.toLowerCase())
          )
      )
      .slice(0, 6) || [];

  const filteredTags =
    allTags
      ?.filter((t) => t.tag.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 4) || [];

  const navItems: CommandItem[] = !query
    ? [
        { type: "nav", id: "dashboard", icon: "⌂", title: "Dashboard" },
        { type: "nav", id: "para", icon: "▦", title: "PARA View" },
        { type: "nav", id: "library", icon: "◫", title: "Library View" },
      ]
    : [];

  const allItems: CommandItem[] = [
    ...navItems,
    ...filteredTags.map((t) => ({
      type: "tag" as const,
      id: t.tag,
      icon: "🏷️",
      title: t.tag,
      count: t.count,
    })),
    ...filteredLinks.map((l) => ({
      type: "link" as const,
      id: l._id,
      icon: "↗",
      title: l.title || "Untitled",
      url: l.url,
      bucket: l.para?.bucket,
    })),
  ];

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, allItems.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
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
          window.open(item.url, "_blank");
          onClose();
        }
      }
    },
    [allItems, selectedIndex, onClose, onNavigate, onTagFilter]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

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
                  onClick={() => {
                    onNavigate(item.id as ViewMode);
                    onClose();
                  }}
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
                    onClick={() => {
                      onTagFilter(tag.tag);
                      onClose();
                    }}
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
                      <div className="command-item-title">
                        {link.title || "Untitled"}
                      </div>
                      <div className="command-item-desc">{link.para?.bucket}</div>
                    </div>
                  </a>
                );
              })}
            </div>
          )}
        </div>
        <div className="command-palette-footer">
          <span>
            <kbd>↑↓</kbd> navigate
          </span>
          <span>
            <kbd>↵</kbd> select
          </span>
          <span>
            <kbd>esc</kbd> close
          </span>
        </div>
      </div>
    </div>
  );
}
