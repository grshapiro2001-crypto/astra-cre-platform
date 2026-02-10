/**
 * Library Page - Deal Pipeline Command Center
 * Shows property deal cards in grid/list layout with filtering, search, sort, and batch comparison.
 * Integrates with real API via propertyService and dealFolderService.
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Search,
  Plus,
  LayoutGrid,
  List,
  ArrowUpDown,
  ChevronDown,
  Check,
  MapPin,
  Building2,
  BarChart3,
  Upload,
  FolderPlus,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { propertyService } from '@/services/propertyService';
import { dealFolderService, type DealFolder } from '@/services/dealFolderService';
import { scoringService } from '@/services/scoringService';
import type { DealScoreResult } from '@/services/scoringService';
import { DealScoreBadge } from '@/components/scoring/DealScoreBadge';
import { DealScoreModal } from '@/components/scoring/DealScoreModal';
import type { PropertyListItem } from '@/types/property';
import { CreateFolderModal } from '@/components/library/CreateFolderModal';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LibrarySkeleton } from '@/components/ui/PageSkeleton';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Extended property type including financial fields the backend returns */
interface PropertyWithFinancials extends PropertyListItem {
  t12_noi?: number | null;
  y1_noi?: number | null;
  t3_noi?: number | null;
  total_sf?: number | null;
  status?: string;
}

type DealStatus = 'all' | 'active' | 'new' | 'review' | 'passed' | 'closed';
type ViewMode = 'grid' | 'list';
type SortOption = 'dateAdded' | 'name' | 'noi' | 'capRate';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<
  string,
  { label: string; badgeClass: string; dotClass: string }
> = {
  new: {
    label: 'NEW',
    badgeClass:
      'bg-blue-500/10 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400',
    dotClass: 'bg-blue-500',
  },
  active: {
    label: 'ACTIVE',
    badgeClass:
      'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400',
    dotClass: 'bg-emerald-500',
  },
  review: {
    label: 'REVIEW',
    badgeClass:
      'bg-amber-500/10 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400',
    dotClass: 'bg-amber-500',
  },
  passed: {
    label: 'PASSED',
    badgeClass:
      'bg-slate-500/10 text-slate-500 dark:bg-slate-500/15 dark:text-slate-400',
    dotClass: 'bg-slate-400',
  },
  closed: {
    label: 'CLOSED',
    badgeClass:
      'bg-purple-500/10 text-purple-600 dark:bg-purple-500/15 dark:text-purple-400',
    dotClass: 'bg-purple-500',
  },
};

const SORT_OPTIONS: { id: SortOption; label: string }[] = [
  { id: 'dateAdded', label: 'Most Recent' },
  { id: 'name', label: 'Name (A-Z)' },
  { id: 'noi', label: 'Highest NOI' },
  { id: 'capRate', label: 'Cap Rate' },
];

const FILTER_TABS: { id: DealStatus; label: string }[] = [
  { id: 'all', label: 'All Deals' },
  { id: 'active', label: 'Active' },
  { id: 'new', label: 'New' },
  { id: 'review', label: 'In Review' },
  { id: 'passed', label: 'Passed' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatPrice(num: number | null | undefined): string {
  if (!num) return '\u2014';
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `$${(num / 1_000).toFixed(0)}K`;
  return `$${num.toLocaleString()}`;
}

function formatDate(dateString?: string): string {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const Library = () => {
  const navigate = useNavigate();

  // ---- Data state ----
  const [properties, setProperties] = useState<PropertyWithFinancials[]>([]);
  const [folders, setFolders] = useState<DealFolder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ---- UI state ----
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<DealStatus>('all');
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<number[]>([]);
  const [hoveredDealId, setHoveredDealId] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('dateAdded');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // ---- Scoring state ----
  const [scores, setScores] = useState<Record<number, DealScoreResult>>({});
  const [scoreModalPropertyId, setScoreModalPropertyId] = useState<number | null>(null);

  // ---- Data fetching ----
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [propertiesResult, foldersResult] = await Promise.all([
        propertyService.listProperties({}),
        dealFolderService.listFolders('active'),
      ]);
      setProperties(
        propertiesResult.properties as PropertyWithFinancials[],
      );
      setFolders(foldersResult);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Failed to load data. Please try again.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ---- Batch score fetch ----
  useEffect(() => {
    if (!properties.length) return;
    const ids = properties.map((p) => p.id);
    scoringService.getScores(ids).then(setScores).catch(() => {});
  }, [properties]);

  // ---- Folder status map ----
  const folderStatusMap = useMemo(() => {
    const map = new Map<number, string>();
    folders.forEach((f) => map.set(f.id, f.status || 'active'));
    return map;
  }, [folders]);

  // Derive a status for each property based on its folder
  const getPropertyStatus = useCallback(
    (property: PropertyWithFinancials): string => {
      if (property.status) return property.status;
      if (property.deal_folder_id) {
        return folderStatusMap.get(property.deal_folder_id) || 'active';
      }
      return 'active';
    },
    [folderStatusMap],
  );

  // ---- Filtering & sorting ----
  const filteredProperties = useMemo(() => {
    return properties
      .filter((p) => {
        // Status filter
        if (selectedFilter !== 'all') {
          const status = getPropertyStatus(p);
          if (status !== selectedFilter) return false;
        }
        // Search filter
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          return (
            p.deal_name?.toLowerCase().includes(q) ||
            p.property_name?.toLowerCase().includes(q) ||
            p.property_address?.toLowerCase().includes(q) ||
            p.submarket?.toLowerCase().includes(q) ||
            p.property_type?.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case 'noi':
            return (
              (b.t12_noi ?? b.y1_noi ?? 0) - (a.t12_noi ?? a.y1_noi ?? 0)
            );
          case 'name':
            return (a.deal_name || '').localeCompare(b.deal_name || '');
          case 'capRate':
          case 'dateAdded':
          default:
            return (
              new Date(b.upload_date || 0).getTime() -
              new Date(a.upload_date || 0).getTime()
            );
        }
      });
  }, [properties, selectedFilter, searchQuery, sortBy, getPropertyStatus]);

  // ---- Pipeline stats ----
  const pipelineStats = useMemo(
    () => ({
      totalDeals: properties.length,
      totalUnits: properties.reduce(
        (sum, p) => sum + (p.total_units || 0),
        0,
      ),
      activeDeals: properties.filter(
        (p) => getPropertyStatus(p) === 'active',
      ).length,
    }),
    [properties, getPropertyStatus],
  );

  // ---- Status counts for filter badges ----
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: properties.length };
    properties.forEach((p) => {
      const s = getPropertyStatus(p);
      counts[s] = (counts[s] || 0) + 1;
    });
    return counts;
  }, [properties, getPropertyStatus]);

  // ---- Selection helpers ----
  const togglePropertySelection = (propertyId: number) => {
    setSelectedPropertyIds((prev) =>
      prev.includes(propertyId)
        ? prev.filter((id) => id !== propertyId)
        : prev.length < 5
          ? [...prev, propertyId]
          : prev,
    );
  };

  const handleCompare = () => {
    if (selectedPropertyIds.length >= 2) {
      navigate(`/compare?ids=${selectedPropertyIds.join(',')}`);
    }
  };

  const handleFolderCreated = () => {
    fetchData();
  };

  // ---------- Render ----------
  return (
    <div className="min-h-full -m-4 lg:-m-6">
      {/* ================================================================ */}
      {/* STICKY HEADER / TOOLBAR                                          */}
      {/* ================================================================ */}
      <div className="sticky top-16 z-20 bg-background/85 backdrop-blur-xl border-b border-border">
        <div className="px-6 lg:px-8 py-5">
          {/* Top row: title + actions */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            {/* Title block */}
            <div>
              <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                Deal Library
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                <span className="font-mono text-primary">
                  {filteredProperties.length}
                </span>{' '}
                deals
                {pipelineStats.totalUnits > 0 && (
                  <>
                    {' \u00b7 '}
                    <span className="font-mono">
                      {pipelineStats.totalUnits.toLocaleString()}
                    </span>{' '}
                    units
                  </>
                )}
              </p>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-3 flex-wrap">
              {/* Search */}
              <div
                className={cn(
                  'relative transition-all duration-300',
                  searchFocused ? 'w-full sm:w-[300px]' : 'w-full sm:w-[220px]',
                )}
              >
                <input
                  type="text"
                  placeholder="Search deals..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setSearchFocused(false)}
                  className={cn(
                    'w-full py-2.5 pl-10 pr-4 rounded-xl text-sm outline-none transition-all duration-300',
                    'bg-card border text-foreground placeholder:text-muted-foreground',
                    searchFocused ? 'border-primary/40 ring-1 ring-primary/20' : 'border-border',
                  )}
                />
                <Search
                  className={cn(
                    'w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors',
                    searchFocused ? 'text-primary' : 'text-muted-foreground',
                  )}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Compare button (appears when 2+ selected) */}
              <div
                className={cn(
                  'transition-all duration-300 overflow-hidden',
                  selectedPropertyIds.length >= 2
                    ? 'max-w-[200px] opacity-100'
                    : 'max-w-0 opacity-0',
                )}
              >
                <button
                  onClick={handleCompare}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 whitespace-nowrap text-white bg-gradient-to-r from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/20 transition-all duration-300 hover:shadow-emerald-500/30"
                >
                  <BarChart3 className="w-4 h-4" />
                  Compare ({selectedPropertyIds.length})
                </button>
              </div>

              {/* New Folder */}
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 whitespace-nowrap border border-border bg-card text-foreground hover:bg-accent transition-all duration-200"
              >
                <FolderPlus className="w-4 h-4" />
                <span className="hidden sm:inline">New Folder</span>
              </button>

              {/* Upload */}
              <Link
                to="/upload"
                className="px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 whitespace-nowrap text-white bg-gradient-to-r from-primary to-violet-700 dark:from-violet-500 dark:to-purple-600 shadow-lg shadow-primary/20 transition-all duration-300"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">New Deal</span>
              </Link>
            </div>
          </div>

          {/* Toolbar row */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-5">
            <div className="flex items-center gap-3 flex-wrap">
              {/* Filter tabs */}
              <div className="flex items-center gap-0.5 rounded-lg bg-muted/50 p-1 overflow-x-auto">
                {FILTER_TABS.map((filter) => (
                  <button
                    key={filter.id}
                    onClick={() => setSelectedFilter(filter.id)}
                    className={cn(
                      'px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-all duration-200 whitespace-nowrap',
                      selectedFilter === filter.id
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {filter.label}
                    <span className="ml-1 font-mono text-[10px] text-muted-foreground">
                      {statusCounts[filter.id] ?? 0}
                    </span>
                  </button>
                ))}
              </div>

              {/* View mode toggle */}
              <div className="flex items-center rounded-lg bg-muted/50 p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={cn(
                    'p-2 rounded-md transition-all duration-200',
                    viewMode === 'grid'
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                  title="Grid view"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={cn(
                    'p-2 rounded-md transition-all duration-200',
                    viewMode === 'list'
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                  title="List view"
                >
                  <List className="w-4 h-4" />
                </button>
              </div>

              {/* Sort dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowSortMenu((v) => !v)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 text-sm text-muted-foreground hover:text-foreground transition-all duration-200"
                >
                  <ArrowUpDown className="w-4 h-4" />
                  <span className="hidden sm:inline">
                    Sort:{' '}
                    {SORT_OPTIONS.find((o) => o.id === sortBy)?.label}
                  </span>
                  <ChevronDown
                    className={cn(
                      'w-3.5 h-3.5 transition-transform duration-200',
                      showSortMenu && 'rotate-180',
                    )}
                  />
                </button>

                {showSortMenu && (
                  <div className="absolute top-full left-0 mt-2 w-44 rounded-xl overflow-hidden z-50 bg-card border border-border shadow-xl">
                    {SORT_OPTIONS.map((option) => (
                      <button
                        key={option.id}
                        onClick={() => {
                          setSortBy(option.id);
                          setShowSortMenu(false);
                        }}
                        className={cn(
                          'w-full px-4 py-2.5 text-left text-sm transition-colors duration-150',
                          sortBy === option.id
                            ? 'bg-primary/10 text-primary'
                            : 'text-foreground hover:bg-muted',
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Selection info */}
            {selectedPropertyIds.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {selectedPropertyIds.length} selected
                  <span className="text-xs ml-1">(max 5)</span>
                </span>
                <button
                  onClick={() => setSelectedPropertyIds([])}
                  className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                >
                  Clear
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ================================================================ */}
      {/* MAIN CONTENT                                                     */}
      {/* ================================================================ */}
      <div className="p-6 lg:p-8">
        {/* Error banner */}
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <AnimatePresence mode="wait">
        {isLoading ? (
          <motion.div key="skeleton" initial={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
            <LibrarySkeleton />
          </motion.div>
        ) : (
          <motion.div key="content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
        {/* ============================================================ */}
        {/* GRID VIEW                                                     */}
        {/* ============================================================ */}
        {viewMode === 'grid' && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5">
            {filteredProperties.map((property) => {
              const isSelected = selectedPropertyIds.includes(property.id);
              const isHovered = hoveredDealId === property.id;
              const status = getPropertyStatus(property);
              const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.active;
              const displayName =
                property.property_name || property.deal_name;

              return (
                <div
                  key={property.id}
                  className="relative group"
                  onMouseEnter={() => setHoveredDealId(property.id)}
                  onMouseLeave={() => setHoveredDealId(null)}
                >
                  {/* Hover glow */}
                  <div className="absolute -inset-1.5 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-primary/5 dark:bg-primary/10 blur-xl pointer-events-none" />

                  {/* Card */}
                  <div
                    className={cn(
                      'relative rounded-2xl overflow-hidden transition-all duration-300 cursor-pointer',
                      'border bg-card',
                      isSelected
                        ? 'border-primary ring-2 ring-primary/30'
                        : isHovered
                          ? 'border-primary/30 shadow-lg shadow-primary/5 -translate-y-1'
                          : 'border-border',
                    )}
                  >
                    {/* Top gradient area */}
                    <div className="relative h-32 bg-gradient-to-br from-primary/20 via-primary/10 to-accent/20 dark:from-primary/10 dark:via-primary/5 dark:to-accent/10 overflow-hidden">
                      {/* Decorative pattern */}
                      <div className="absolute inset-0 opacity-[0.04] dark:opacity-[0.06]">
                        <div className="absolute top-4 right-4 w-24 h-24 border border-current rounded-full" />
                        <div className="absolute top-8 right-8 w-16 h-16 border border-current rounded-full" />
                        <div className="absolute -bottom-4 -left-4 w-20 h-20 border border-current rounded-full" />
                      </div>

                      {/* Checkbox */}
                      <button
                        className="absolute top-3 left-3 z-10"
                        onClick={(e) => {
                          e.stopPropagation();
                          togglePropertySelection(property.id);
                        }}
                        aria-label={
                          isSelected
                            ? 'Deselect property'
                            : 'Select property'
                        }
                      >
                        <div
                          className={cn(
                            'w-6 h-6 rounded-lg flex items-center justify-center transition-all duration-200 border',
                            isSelected
                              ? 'bg-primary border-primary'
                              : 'bg-background/80 dark:bg-background/50 backdrop-blur-sm border-border hover:border-primary/40',
                          )}
                        >
                          {isSelected && (
                            <Check className="w-3.5 h-3.5 text-white" />
                          )}
                        </div>
                      </button>

                      {/* Status badge */}
                      <div className="absolute top-3 right-3 z-10">
                        <span
                          className={cn(
                            'px-2.5 py-1 rounded-lg text-[10px] font-bold tracking-wider',
                            cfg.badgeClass,
                          )}
                        >
                          {cfg.label}
                        </span>
                      </div>

                      {/* Property type label */}
                      <div className="absolute bottom-3 left-3">
                        <span className="text-[10px] font-bold tracking-[0.15em] text-primary dark:text-primary uppercase">
                          {(
                            property.property_type ||
                            property.document_type ||
                            'PROPERTY'
                          ).toUpperCase()}
                        </span>
                      </div>

                      {/* Deal Score Badge */}
                      <div className="absolute bottom-2 right-3 z-10">
                        <DealScoreBadge
                          score={scores[property.id]?.total_score ?? null}
                          size="sm"
                          onClick={() => {
                            if (scores[property.id]) {
                              setScoreModalPropertyId(property.id);
                            }
                          }}
                        />
                      </div>
                    </div>

                    {/* Card body */}
                    <div
                      className="p-4 pt-3"
                      onClick={() =>
                        navigate(`/library/${property.id}`)
                      }
                    >
                      {/* Title */}
                      <h3
                        className={cn(
                          'font-display text-lg font-bold tracking-tight transition-colors duration-200 line-clamp-1',
                          isHovered
                            ? 'text-primary'
                            : 'text-foreground',
                        )}
                      >
                        {displayName}
                      </h3>

                      {/* Location */}
                      {(property.submarket ||
                        property.property_address) && (
                        <p className="text-sm mt-1 flex items-center gap-1.5 text-muted-foreground">
                          <MapPin className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">
                            {[property.submarket, property.property_address]
                              .filter(Boolean)
                              .join(' \u00b7 ')}
                          </span>
                        </p>
                      )}

                      {/* Tags */}
                      <div className="flex gap-1.5 mt-3 flex-wrap">
                        {property.document_subtype && (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                            {property.document_subtype}
                          </span>
                        )}
                        {property.property_type && (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                            {property.property_type}
                          </span>
                        )}
                      </div>

                      {/* Key metrics */}
                      <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-border">
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                            Units
                          </p>
                          <p className="font-mono text-sm font-semibold mt-0.5 text-foreground">
                            {property.total_units?.toLocaleString() ||
                              '\u2014'}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                            T12 NOI
                          </p>
                          <p className="font-mono text-sm font-semibold mt-0.5 text-emerald-600 dark:text-emerald-400">
                            {formatPrice(property.t12_noi)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                            Y1 NOI
                          </p>
                          <p className="font-mono text-sm font-semibold mt-0.5 text-foreground">
                            {formatPrice(property.y1_noi)}
                          </p>
                        </div>
                      </div>

                      {/* Footer */}
                      <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                        <p className="text-xs text-muted-foreground">
                          Added {formatDate(property.upload_date)}
                        </p>
                        {property.deal_folder_id && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Building2 className="w-3 h-3" />
                            Folder
                          </span>
                        )}
                      </div>

                      {/* Hover CTA */}
                      <div
                        className={cn(
                          'overflow-hidden transition-all duration-200',
                          isHovered
                            ? 'max-h-14 opacity-100 mt-3'
                            : 'max-h-0 opacity-0',
                        )}
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/library/${property.id}`);
                          }}
                          className="w-full py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-primary to-violet-700 dark:from-violet-500 dark:to-purple-600 transition-all duration-200 hover:opacity-90"
                        >
                          View Analysis &rarr;
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Add New Deal card */}
            <Link
              to="/upload"
              className={cn(
                'min-h-[380px] rounded-2xl border-2 border-dashed border-border',
                'flex flex-col items-center justify-center cursor-pointer',
                'transition-all duration-300 group',
                'hover:border-primary/30 hover:bg-primary/5 dark:hover:bg-primary/5',
              )}
            >
              <div className="w-16 h-16 rounded-2xl bg-muted border border-border flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110">
                <Upload className="w-7 h-7 text-muted-foreground" />
              </div>
              <p className="font-display text-lg font-semibold text-foreground">
                Add New Deal
              </p>
              <p className="text-sm mt-1 text-muted-foreground">
                Upload an OM or create manually
              </p>
            </Link>
          </div>
        )}

        {/* ============================================================ */}
        {/* LIST VIEW                                                     */}
        {/* ============================================================ */}
        {viewMode === 'list' && filteredProperties.length > 0 && (
          <div className="border border-border rounded-2xl bg-card overflow-hidden">
            {/* Table header */}
            <div
              className="grid items-center px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted/50 border-b border-border"
              style={{
                gridTemplateColumns:
                  '40px 2fr 1.2fr 90px 100px 100px 90px 110px',
              }}
            >
              <div />
              <div>Property</div>
              <div>Location</div>
              <div className="text-right">Units</div>
              <div className="text-right">T12 NOI</div>
              <div className="text-right">Y1 NOI</div>
              <div className="text-center">Type</div>
              <div className="text-center">Status</div>
            </div>

            {/* Table rows */}
            {filteredProperties.map((property, index) => {
              const isSelected = selectedPropertyIds.includes(property.id);
              const isHovered = hoveredDealId === property.id;
              const status = getPropertyStatus(property);
              const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.active;
              const displayName =
                property.property_name || property.deal_name;

              return (
                <div
                  key={property.id}
                  className={cn(
                    'grid items-center px-4 py-3.5 cursor-pointer transition-colors duration-150 border-b border-border last:border-b-0',
                    isHovered
                      ? 'bg-accent/50'
                      : index % 2 === 0
                        ? 'bg-transparent'
                        : 'bg-muted/20',
                  )}
                  style={{
                    gridTemplateColumns:
                      '40px 2fr 1.2fr 90px 100px 100px 90px 110px',
                  }}
                  onMouseEnter={() => setHoveredDealId(property.id)}
                  onMouseLeave={() => setHoveredDealId(null)}
                  onClick={() => navigate(`/library/${property.id}`)}
                >
                  {/* Checkbox */}
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      togglePropertySelection(property.id);
                    }}
                  >
                    <div
                      className={cn(
                        'w-5 h-5 rounded-md flex items-center justify-center transition-all duration-200 border',
                        isSelected
                          ? 'bg-primary border-primary'
                          : 'bg-transparent border-border hover:border-primary/40',
                      )}
                    >
                      {isSelected && (
                        <Check className="w-3 h-3 text-white" />
                      )}
                    </div>
                  </div>

                  {/* Property name */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 dark:from-primary/10 dark:to-accent/10 flex items-center justify-center shrink-0">
                      <Building2 className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p
                        className={cn(
                          'font-semibold text-sm truncate transition-colors duration-200',
                          isHovered
                            ? 'text-primary'
                            : 'text-foreground',
                        )}
                      >
                        {displayName}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {property.property_type ||
                          property.document_type}
                      </p>
                    </div>
                  </div>

                  {/* Location */}
                  <div className="min-w-0">
                    <p className="text-sm text-foreground truncate">
                      {property.property_address || '\u2014'}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {property.submarket || ''}
                    </p>
                  </div>

                  {/* Units */}
                  <div className="text-right font-mono text-sm text-foreground">
                    {property.total_units?.toLocaleString() || '\u2014'}
                  </div>

                  {/* T12 NOI */}
                  <div className="text-right font-mono text-sm text-emerald-600 dark:text-emerald-400">
                    {formatPrice(property.t12_noi)}
                  </div>

                  {/* Y1 NOI */}
                  <div className="text-right font-mono text-sm text-foreground">
                    {formatPrice(property.y1_noi)}
                  </div>

                  {/* Type */}
                  <div className="flex justify-center">
                    <span className="font-mono font-semibold text-[11px] px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                      {property.document_type || '\u2014'}
                    </span>
                  </div>

                  {/* Status */}
                  <div className="flex justify-center">
                    <span
                      className={cn(
                        'px-2.5 py-1 rounded-lg text-[10px] font-bold tracking-wider',
                        cfg.badgeClass,
                      )}
                    >
                      {cfg.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ============================================================ */}
        {/* EMPTY STATE                                                   */}
        {/* ============================================================ */}
        {filteredProperties.length === 0 && !error && (
          <div className="text-center py-20">
            <div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
              <Search className="w-10 h-10 text-muted-foreground" />
            </div>
            <p className="text-lg font-display font-semibold text-foreground">
              No deals found
            </p>
            <p className="text-sm mt-1 text-muted-foreground max-w-md mx-auto">
              {searchQuery || selectedFilter !== 'all'
                ? 'Try adjusting your search or filters'
                : 'Get started by uploading your first property document'}
            </p>
            {!searchQuery && selectedFilter === 'all' && (
              <Link
                to="/upload"
                className="inline-flex items-center gap-2 mt-6 px-5 py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-primary to-violet-700 dark:from-violet-500 dark:to-purple-600 shadow-lg shadow-primary/20 transition-all duration-300"
              >
                <Upload className="w-4 h-4" />
                Upload Document
              </Link>
            )}
          </div>
        )}
          </motion.div>
        )}
        </AnimatePresence>
      </div>

      {/* ================================================================ */}
      {/* OVERLAYS                                                         */}
      {/* ================================================================ */}

      {/* Sort menu backdrop */}
      {showSortMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowSortMenu(false)}
        />
      )}

      {/* Create Folder Modal */}
      <CreateFolderModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={handleFolderCreated}
      />

      {/* Deal Score Modal */}
      <DealScoreModal
        open={scoreModalPropertyId !== null}
        onClose={() => setScoreModalPropertyId(null)}
        scoreData={scoreModalPropertyId ? scores[scoreModalPropertyId] ?? null : null}
        propertyName={
          scoreModalPropertyId
            ? properties.find((p) => p.id === scoreModalPropertyId)?.deal_name
            : undefined
        }
      />
    </div>
  );
};
