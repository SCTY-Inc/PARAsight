"use client";

// Skeleton loader components for loading states

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

export function SkeletonCard() {
  return (
    <div className="skeleton-card">
      <Skeleton className="skeleton-title" />
      <Skeleton className="skeleton-desc" />
      <div className="skeleton-tags">
        <Skeleton className="skeleton-tag" />
        <Skeleton className="skeleton-tag" />
      </div>
    </div>
  );
}
