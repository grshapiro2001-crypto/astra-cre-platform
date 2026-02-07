/**
 * Skeleton loading placeholders for data-heavy pages.
 * Each variant mirrors the actual page layout structure.
 */

const Bone = ({ className }: { className?: string }) => (
  <div className={`bg-muted animate-pulse rounded-xl ${className ?? ''}`} />
);

// ============================================================
// Dashboard Skeleton
// ============================================================

export const DashboardSkeleton = () => (
  <div className="space-y-6">
    {/* Header: greeting + actions */}
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
      <div className="space-y-2">
        <Bone className="h-8 w-64" />
        <Bone className="h-4 w-40" />
      </div>
      <div className="flex gap-3">
        <Bone className="h-10 w-28" />
        <Bone className="h-10 w-24" />
        <Bone className="h-10 w-10" />
      </div>
    </div>

    {/* Tag pills */}
    <div className="flex gap-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <Bone key={i} className="h-8 w-20 shrink-0" />
      ))}
    </div>

    {/* Metrics grid: 8 cards */}
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <Bone key={i} className="h-24 rounded-2xl" />
      ))}
    </div>

    {/* Kanban columns */}
    <div className="flex gap-4 overflow-hidden">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="flex-shrink-0 w-72 rounded-2xl border border-border bg-card overflow-hidden"
        >
          <Bone className="h-12 w-full rounded-none" />
          <div className="p-3 space-y-3">
            <Bone className="h-20 w-full" />
            <Bone className="h-20 w-full" />
          </div>
        </div>
      ))}
    </div>

    {/* Charts row */}
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Bone className="h-64 rounded-2xl" />
      <Bone className="h-64 rounded-2xl" />
      <Bone className="h-64 rounded-2xl" />
    </div>
  </div>
);

// ============================================================
// Library Skeleton
// ============================================================

export const LibrarySkeleton = () => (
  <div className="space-y-5">
    {/* Toolbar: search + filters */}
    <div className="flex items-center gap-4">
      <Bone className="h-10 flex-1 max-w-sm" />
      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Bone key={i} className="h-9 w-16" />
        ))}
      </div>
      <Bone className="h-9 w-28 ml-auto" />
    </div>

    {/* Card grid */}
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="border border-border rounded-2xl bg-card overflow-hidden"
        >
          <Bone className="h-32 w-full rounded-none" />
          <div className="p-4 space-y-3">
            <Bone className="h-5 w-3/4" />
            <Bone className="h-4 w-1/2" />
            <div className="flex gap-2">
              <Bone className="h-4 w-16" />
              <Bone className="h-4 w-16" />
              <Bone className="h-4 w-16" />
            </div>
            <Bone className="h-4 w-full" />
          </div>
        </div>
      ))}
    </div>
  </div>
);

// ============================================================
// Comparison Skeleton
// ============================================================

export const ComparisonSkeleton = () => (
  <div className="space-y-6">
    {/* Preset selector */}
    <div className="flex gap-2">
      {Array.from({ length: 3 }).map((_, i) => (
        <Bone key={i} className="h-10 w-36" />
      ))}
    </div>

    {/* Property score cards */}
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="border border-border rounded-2xl bg-card overflow-hidden"
        >
          <Bone className="h-24 w-full rounded-none" />
          <div className="p-4 space-y-3">
            <div className="flex justify-between">
              <div className="space-y-2 flex-1">
                <Bone className="h-5 w-3/4" />
                <Bone className="h-4 w-1/2" />
              </div>
              <Bone className="h-14 w-14 rounded-full shrink-0" />
            </div>
            <div className="space-y-2 pt-3 border-t border-border">
              <Bone className="h-3 w-full" />
              <Bone className="h-3 w-full" />
              <Bone className="h-3 w-4/5" />
            </div>
          </div>
        </div>
      ))}
    </div>

    {/* Bar chart area */}
    <div className="grid grid-cols-12 gap-6">
      <div className="col-span-12 lg:col-span-8">
        <Bone className="h-80 rounded-2xl" />
      </div>
      <div className="col-span-12 lg:col-span-4 space-y-6">
        <Bone className="h-52 rounded-2xl" />
        <Bone className="h-44 rounded-2xl" />
      </div>
    </div>
  </div>
);

// ============================================================
// Property Detail Skeleton
// ============================================================

export const PropertyDetailSkeleton = () => (
  <div className="max-w-6xl mx-auto space-y-8">
    {/* Header: back + title */}
    <div className="flex items-center gap-4">
      <Bone className="h-10 w-10" />
      <div className="space-y-2 flex-1">
        <Bone className="h-6 w-64" />
        <Bone className="h-4 w-40" />
      </div>
      <div className="flex gap-3">
        <Bone className="h-10 w-28" />
        <Bone className="h-10 w-28" />
      </div>
    </div>

    {/* Hero / snapshot section */}
    <Bone className="h-72 w-full rounded-2xl" />

    {/* Two-column financial tables */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Bone className="h-72 rounded-2xl" />
      <Bone className="h-72 rounded-2xl" />
    </div>

    {/* Full-width section */}
    <Bone className="h-96 w-full rounded-2xl" />
  </div>
);
