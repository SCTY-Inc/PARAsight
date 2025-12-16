"use client";

import { useState } from "react";
import type { Doc, Id } from "../../convex/_generated/dataModel";
import {
  type MediaType,
  MEDIA_TYPES,
  MEDIA_TYPE_ORDER,
} from "../lib/mediaType";
import { getFaviconUrl, getCleanDisplayName, getSubStackKey } from "../lib/utils";

interface LibraryStackProps {
  mediaType: MediaType;
  links: Doc<"links">[];
  isExpanded: boolean;
  onToggle: () => void;
  onTagClick: (tag: string) => void;
  onDelete: (id: Id<"links">) => void;
}

function LibraryStack({
  mediaType,
  links,
  isExpanded,
  onToggle,
  onTagClick,
  onDelete,
}: LibraryStackProps) {
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

  const sortedSubStacks = Object.entries(subStacks).sort(
    ([, a], [, b]) => b.length - a.length
  );
  const useSubStacks =
    sortedSubStacks.length > 1 &&
    sortedSubStacks.filter(([, items]) => items.length > 1).length > 1;

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
            {links.length} items
            {useSubStacks ? ` · ${sortedSubStacks.length} groups` : ""}
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
                style={
                  {
                    "--offset": i,
                    "--total": Math.min(previewLinks.length, 4),
                  } as React.CSSProperties
                }
              >
                <img
                  src={getFaviconUrl(link.url)}
                  alt=""
                  className="stack-card-favicon"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              </div>
            ))}
          </div>
          {links.length > 4 && (
            <div className="stack-more">+{links.length - 4} more</div>
          )}
        </div>
      )}

      {isExpanded && (
        <div className="stack-expanded">
          {useSubStacks ? (
            <div className="sub-stacks-container">
              {sortedSubStacks.map(([groupName, groupLinks]) => (
                <div
                  key={groupName}
                  className={`sub-stack ${expandedSubStack === groupName ? "expanded" : ""}`}
                >
                  <button
                    className="sub-stack-header"
                    onClick={() =>
                      setExpandedSubStack(
                        expandedSubStack === groupName ? null : groupName
                      )
                    }
                  >
                    <span className="sub-stack-name">{groupName}</span>
                    <span className="sub-stack-count">{groupLinks.length}</span>
                    <span className="sub-stack-chevron">
                      {expandedSubStack === groupName ? "▾" : "▸"}
                    </span>
                  </button>
                  {expandedSubStack === groupName && (
                    <div className="sub-stack-items">
                      {groupLinks.map((link) => (
                        <div key={link._id} className="stack-item-wrapper">
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="stack-item compact"
                          >
                            <img
                              src={getFaviconUrl(link.url)}
                              alt=""
                              className="stack-item-favicon-small"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display =
                                  "none";
                              }}
                            />
                            <div className="stack-item-info">
                              <div className="stack-item-title">
                                {getCleanDisplayName(
                                  link.url,
                                  link.title,
                                  mediaType
                                )}
                              </div>
                            </div>
                          </a>
                          <button
                            className="stack-item-delete"
                            onClick={() => onDelete(link._id)}
                          >
                            ×
                          </button>
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
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="stack-item"
                  >
                    <div className="stack-item-visual">
                      <img
                        src={getFaviconUrl(link.url)}
                        alt=""
                        className="stack-item-favicon"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                      <div className="stack-item-type-badge">{info.emoji}</div>
                    </div>
                    <div className="stack-item-info">
                      <div className="stack-item-title">
                        {getCleanDisplayName(link.url, link.title, mediaType)}
                      </div>
                      {link.para?.bucket && (
                        <div className="stack-item-bucket">{link.para.bucket}</div>
                      )}
                    </div>
                  </a>
                  <button
                    className="stack-item-delete"
                    onClick={() => onDelete(link._id)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface LibraryViewProps {
  linksByMediaType: Record<MediaType, Doc<"links">[]>;
  onTagClick: (tag: string) => void;
  onDelete: (id: Id<"links">) => void;
}

export function LibraryView({
  linksByMediaType,
  onTagClick,
  onDelete,
}: LibraryViewProps) {
  const [expandedStack, setExpandedStack] = useState<MediaType | null>(null);
  const nonEmptyTypes = MEDIA_TYPE_ORDER.filter(
    (type) => linksByMediaType[type].length > 0
  );

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
          onToggle={() =>
            setExpandedStack(expandedStack === mediaType ? null : mediaType)
          }
          onTagClick={onTagClick}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
