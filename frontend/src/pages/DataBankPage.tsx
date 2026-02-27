import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Database,
  Upload as UploadIcon,
  FileSpreadsheet,
  FileText,
  Trash2,
  ChevronDown,
  ChevronUp,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Plus,
  Building2,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  dataBankService,
  type DataBankDocument,
  type DataBankUploadResponse,
  type SalesComp,
  type PipelineProject,
  type SubmarketInventory,
} from '@/services/dataBankService';
import { fmtCapRate as fmtCapRateShared } from '@/utils/formatUtils';

// ============================================================
// Formatting Helpers
// ============================================================

const fmtPrice = (value: number | null | undefined): string => {
  if (value == null || value === 0) return '—';
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toLocaleString()}`;
};

const fmtPerUnit = (value: number | null | undefined): string => {
  if (value == null || value === 0) return '—';
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toLocaleString()}`;
};

const fmtCapRate = (value: number | null | undefined): string => {
  return fmtCapRateShared(value);
};

const fmtNumber = (value: number | null | undefined): string => {
  if (value == null) return '—';
  return value.toLocaleString();
};

const fmtDate = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const docTypeLabel = (type: string): string => {
  const map: Record<string, string> = {
    sales_comps: 'Sales Comps',
    pipeline_tracker: 'Pipeline',
    underwriting_model: 'Underwriting',
    market_research: 'Market Research',
    unknown: 'Unknown',
  };
  return map[type] || type;
};

// ============================================================
// Status Badge Component
// ============================================================

const StatusBadge = ({ status }: { status: string }) => {
  const config: Record<string, { label: string; icon: React.ElementType; className: string }> = {
    completed: {
      label: 'Completed',
      icon: CheckCircle2,
      className: 'bg-green-500/10 text-green-600 dark:bg-green-500/15 dark:text-green-400',
    },
    processing: {
      label: 'Processing',
      icon: Loader2,
      className: 'bg-amber-500/10 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400',
    },
    pending: {
      label: 'Pending',
      icon: Clock,
      className: 'bg-blue-500/10 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400',
    },
    failed: {
      label: 'Failed',
      icon: XCircle,
      className: 'bg-red-500/10 text-red-600 dark:bg-red-500/15 dark:text-red-400',
    },
  };

  const c = config[status] || config.pending;
  const Icon = c.icon;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold',
        c.className,
      )}
    >
      <Icon className={cn('w-3 h-3', status === 'processing' && 'animate-spin')} />
      {c.label}
    </span>
  );
};

const PipelineStatusBadge = ({ status }: { status: string | null }) => {
  if (!status) return <span className="text-muted-foreground">—</span>;

  const config: Record<string, { label: string; className: string }> = {
    lease_up: {
      label: 'Lease-Up',
      className: 'bg-green-500/10 text-green-600 dark:bg-green-500/15 dark:text-green-400 border-green-500/20',
    },
    under_construction: {
      label: 'Under Construction',
      className: 'bg-amber-500/10 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400 border-amber-500/20',
    },
    proposed: {
      label: 'Proposed',
      className: 'bg-zinc-500/10 text-zinc-600 dark:bg-zinc-500/15 dark:text-zinc-400 border-zinc-500/20',
    },
  };

  const normalized = status.toLowerCase().replace(/[\s-]+/g, '_');
  const c = config[normalized] || { label: status, className: 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20' };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border',
        c.className,
      )}
    >
      {c.label}
    </span>
  );
};

// ============================================================
// Documents Tab
// ============================================================

const DocumentsTab = () => {
  const [documents, setDocuments] = useState<DataBankDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<DataBankUploadResponse | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadDocuments = useCallback(async () => {
    try {
      const data = await dataBankService.getDocuments();
      setDocuments(data.documents);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const handleUpload = async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!ext || !['xlsx', 'xlsm', 'csv', 'pdf'].includes(ext)) {
      setError('Unsupported file type. Please upload .xlsx, .xlsm, .csv, or .pdf files.');
      return;
    }

    setUploading(true);
    setUploadResult(null);
    setError(null);

    try {
      const result = await dataBankService.uploadDocument(file);
      setUploadResult(result);
      await loadDocuments();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDelete = async () => {
    if (deleteId == null) return;
    setDeleting(true);
    try {
      await dataBankService.deleteDocument(deleteId);
      setDocuments((prev) => prev.filter((d) => d.id !== deleteId));
      setDeleteId(null);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to delete document');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        className={cn(
          'relative border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-200',
          isDragOver
            ? 'border-primary bg-primary/5 scale-[1.01]'
            : 'border-border hover:border-primary/50 bg-card',
          uploading && 'pointer-events-none opacity-70',
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xlsm,.csv,.pdf"
          onChange={handleFileSelect}
          className="hidden"
        />

        {uploading ? (
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Processing upload...</p>
              <p className="text-xs text-muted-foreground mt-1">
                Extracting records from spreadsheet
              </p>
            </div>
          </div>
        ) : uploadResult ? (
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-green-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Upload complete!</p>
              <p className="text-xs text-muted-foreground mt-1">
                {uploadResult.document_type === 'market_research' && uploadResult.signal_count
                  ? `Extracted ${uploadResult.record_count - uploadResult.signal_count} comps, ${uploadResult.signal_count} market signals`
                  : `Extracted ${uploadResult.record_count} records`}{' '}
                from <span className="font-medium">{uploadResult.filename}</span>
                {' '}({docTypeLabel(uploadResult.document_type)})
              </p>
              {uploadResult.warnings.length > 0 && (
                <div className="mt-2 text-xs text-amber-500">
                  {uploadResult.warnings.map((w, i) => (
                    <p key={i}>{w}</p>
                  ))}
                </div>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setUploadResult(null)}
              className="mt-2"
            >
              Upload Another
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <UploadIcon className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                Drop your spreadsheet here, or{' '}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-primary hover:underline font-semibold"
                >
                  Browse Files
                </button>
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Supports .xlsx, .xlsm, .csv, and .pdf files (sales comps, pipeline trackers, market research reports)
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-red-500 hover:text-red-400 text-xs"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Documents Table */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-14 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : documents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 rounded-xl border border-dashed border-border bg-card gap-3">
          <FileSpreadsheet className="w-10 h-10 text-muted-foreground/40" />
          <div className="text-center">
            <p className="text-sm font-medium text-muted-foreground">No documents uploaded yet</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Upload a sales comp tracker or pipeline spreadsheet to get started.
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-8" />
                <TableHead>Filename</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right font-mono">Records</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.map((doc) => (
                <React.Fragment key={doc.id}>
                  <TableRow
                    className="cursor-pointer"
                    onClick={() => setExpandedId(expandedId === doc.id ? null : doc.id)}
                  >
                    <TableCell className="w-8 pr-0">
                      {expandedId === doc.id ? (
                        <ChevronUp className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {doc.document_type === 'market_research' ? (
                          <FileText className="w-4 h-4 text-violet-500 shrink-0" />
                        ) : (
                          <FileSpreadsheet className="w-4 h-4 text-primary shrink-0" />
                        )}
                        <span className="font-medium text-foreground truncate max-w-[200px]">
                          {doc.filename}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                        {docTypeLabel(doc.document_type)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {doc.document_type === 'market_research' && doc.signal_count != null
                        ? `${(doc.record_count ?? 0) - doc.signal_count} / ${doc.signal_count}`
                        : doc.record_count != null ? fmtNumber(doc.record_count) : '—'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {fmtDate(doc.created_at)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={doc.extraction_status} />
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-red-500"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteId(doc.id);
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                  {expandedId === doc.id && (
                    <TableRow key={`${doc.id}-expanded`} className="hover:bg-transparent">
                      <TableCell colSpan={7} className="bg-muted/30 px-8 py-4">
                        <div className="text-sm space-y-2">
                          <p className="text-muted-foreground">
                            <span className="font-medium text-foreground">Document Type:</span>{' '}
                            {docTypeLabel(doc.document_type)}
                          </p>
                          <p className="text-muted-foreground">
                            <span className="font-medium text-foreground">Records Extracted:</span>{' '}
                            <span className="font-mono">{doc.record_count ?? '—'}</span>
                          </p>
                          {doc.document_type === 'market_research' && (
                            <>
                              {doc.source_firm && (
                                <p className="text-muted-foreground">
                                  <span className="font-medium text-foreground">Source Firm:</span>{' '}
                                  {doc.source_firm}
                                </p>
                              )}
                              {doc.signal_count != null && (
                                <p className="text-muted-foreground">
                                  <span className="font-medium text-foreground">Market Signals:</span>{' '}
                                  <span className="font-mono">{doc.signal_count}</span>
                                </p>
                              )}
                              {doc.geographies_covered && (
                                <p className="text-muted-foreground">
                                  <span className="font-medium text-foreground">Geographies:</span>{' '}
                                  {doc.geographies_covered}
                                </p>
                              )}
                              {doc.publication_date && (
                                <p className="text-muted-foreground">
                                  <span className="font-medium text-foreground">Publication Date:</span>{' '}
                                  {doc.publication_date}
                                </p>
                              )}
                            </>
                          )}
                          <p className="text-muted-foreground">
                            <span className="font-medium text-foreground">Status:</span>{' '}
                            {doc.extraction_status}
                          </p>
                          <p className="text-muted-foreground">
                            <span className="font-medium text-foreground">Uploaded:</span>{' '}
                            {fmtDate(doc.created_at)}
                          </p>
                          {doc.extraction_data && (
                            <details className="mt-2">
                              <summary className="text-xs text-primary cursor-pointer hover:underline">
                                View extraction data
                              </summary>
                              <pre className="mt-2 text-xs bg-muted p-3 rounded-lg overflow-x-auto max-h-48 font-mono">
                                {(() => {
                                  try {
                                    return JSON.stringify(JSON.parse(doc.extraction_data), null, 2);
                                  } catch {
                                    return doc.extraction_data;
                                  }
                                })()}
                              </pre>
                            </details>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Document</DialogTitle>
            <DialogDescription>
              This will permanently delete the document and all extracted records (comps, pipeline
              projects). This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ============================================================
// Sales Comps Tab
// ============================================================

type SortField = 'property_name' | 'market' | 'property_type' | 'units' | 'year_built' | 'sale_price' | 'price_per_unit' | 'cap_rate' | 'sale_date';
type SortDir = 'asc' | 'desc';

const SalesCompsTab = () => {
  const [comps, setComps] = useState<SalesComp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterMetro, setFilterMetro] = useState('');
  const [filterSubmarket, setFilterSubmarket] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterMinUnits, setFilterMinUnits] = useState('');
  const [filterMaxUnits, setFilterMaxUnits] = useState('');
  const [sortField, setSortField] = useState<SortField>('sale_date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  useEffect(() => {
    const loadComps = async () => {
      setLoading(true);
      try {
        const data = await dataBankService.getComps();
        setComps(data);
      } catch (err: any) {
        setError(err.response?.data?.detail || 'Failed to load sales comps');
      } finally {
        setLoading(false);
      }
    };
    loadComps();
  }, []);

  const uniqueMetros = useMemo(() => [...new Set(comps.map((c) => c.metro).filter(Boolean))].sort(), [comps]);
  const uniqueSubmarkets = useMemo(() => [...new Set(comps.map((c) => c.submarket).filter(Boolean))].sort(), [comps]);
  const uniqueTypes = useMemo(() => [...new Set(comps.map((c) => c.property_type).filter(Boolean))].sort(), [comps]);

  const filtered = useMemo(() => {
    let result = [...comps];

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.property_name?.toLowerCase().includes(q) ||
          c.market?.toLowerCase().includes(q) ||
          c.submarket?.toLowerCase().includes(q) ||
          c.address?.toLowerCase().includes(q),
      );
    }

    if (filterMetro) result = result.filter((c) => c.metro === filterMetro);
    if (filterSubmarket) result = result.filter((c) => c.submarket === filterSubmarket);
    if (filterType) result = result.filter((c) => c.property_type === filterType);
    if (filterMinUnits) result = result.filter((c) => (c.units ?? 0) >= Number(filterMinUnits));
    if (filterMaxUnits) result = result.filter((c) => (c.units ?? Infinity) <= Number(filterMaxUnits));

    result.sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      const cmp = typeof aVal === 'string' ? aVal.localeCompare(bVal as string) : (aVal as number) - (bVal as number);
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [comps, search, filterMetro, filterSubmarket, filterType, filterMinUnits, filterMaxUnits, sortField, sortDir]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground/50" />;
    return sortDir === 'asc' ? (
      <ArrowUp className="w-3.5 h-3.5 text-primary" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-primary" />
    );
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-10 rounded-lg bg-muted animate-pulse w-72" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-12 rounded-xl bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
        <AlertCircle className="w-4 h-4 text-red-500" />
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters Row */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search comps..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>

        <select
          value={filterMetro}
          onChange={(e) => setFilterMetro(e.target.value)}
          className="h-9 px-3 rounded-md border border-border bg-background text-sm text-foreground"
        >
          <option value="">All Metros</option>
          {uniqueMetros.map((m) => (
            <option key={m} value={m!}>{m}</option>
          ))}
        </select>

        <select
          value={filterSubmarket}
          onChange={(e) => setFilterSubmarket(e.target.value)}
          className="h-9 px-3 rounded-md border border-border bg-background text-sm text-foreground"
        >
          <option value="">All Submarkets</option>
          {uniqueSubmarkets.map((s) => (
            <option key={s} value={s!}>{s}</option>
          ))}
        </select>

        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="h-9 px-3 rounded-md border border-border bg-background text-sm text-foreground"
        >
          <option value="">All Types</option>
          {uniqueTypes.map((t) => (
            <option key={t} value={t!}>{t}</option>
          ))}
        </select>

        <Input
          type="number"
          placeholder="Min units"
          value={filterMinUnits}
          onChange={(e) => setFilterMinUnits(e.target.value)}
          className="h-9 w-24"
        />
        <Input
          type="number"
          placeholder="Max units"
          value={filterMaxUnits}
          onChange={(e) => setFilterMaxUnits(e.target.value)}
          className="h-9 w-24"
        />

        <span className="text-xs text-muted-foreground ml-auto font-mono">
          {filtered.length} comp{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Comps Table */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 rounded-xl border border-dashed border-border bg-card gap-3">
          <Database className="w-10 h-10 text-muted-foreground/40" />
          <div className="text-center">
            <p className="text-sm font-medium text-muted-foreground">No sales comps found</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Upload a sales comp spreadsheet in the Documents tab to populate this view.
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>
                  <button onClick={() => handleSort('property_name')} className="flex items-center gap-1.5 hover:text-foreground">
                    Property <SortIcon field="property_name" />
                  </button>
                </TableHead>
                <TableHead>
                  <button onClick={() => handleSort('market')} className="flex items-center gap-1.5 hover:text-foreground">
                    Market <SortIcon field="market" />
                  </button>
                </TableHead>
                <TableHead>
                  <button onClick={() => handleSort('property_type')} className="flex items-center gap-1.5 hover:text-foreground">
                    Type <SortIcon field="property_type" />
                  </button>
                </TableHead>
                <TableHead className="text-right">
                  <button onClick={() => handleSort('units')} className="flex items-center gap-1.5 hover:text-foreground ml-auto">
                    Units <SortIcon field="units" />
                  </button>
                </TableHead>
                <TableHead className="text-right">
                  <button onClick={() => handleSort('year_built')} className="flex items-center gap-1.5 hover:text-foreground ml-auto">
                    Year Built <SortIcon field="year_built" />
                  </button>
                </TableHead>
                <TableHead className="text-right">
                  <button onClick={() => handleSort('sale_price')} className="flex items-center gap-1.5 hover:text-foreground ml-auto">
                    Sale Price <SortIcon field="sale_price" />
                  </button>
                </TableHead>
                <TableHead className="text-right">
                  <button onClick={() => handleSort('price_per_unit')} className="flex items-center gap-1.5 hover:text-foreground ml-auto">
                    $/Unit <SortIcon field="price_per_unit" />
                  </button>
                </TableHead>
                <TableHead className="text-right">
                  <button onClick={() => handleSort('cap_rate')} className="flex items-center gap-1.5 hover:text-foreground ml-auto">
                    Cap Rate <SortIcon field="cap_rate" />
                  </button>
                </TableHead>
                <TableHead>
                  <button onClick={() => handleSort('sale_date')} className="flex items-center gap-1.5 hover:text-foreground">
                    Sale Date <SortIcon field="sale_date" />
                  </button>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((comp) => (
                <TableRow key={comp.id}>
                  <TableCell>
                    <span className="font-medium text-foreground truncate max-w-[180px] block">
                      {comp.property_name || '—'}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {comp.submarket || comp.market || '—'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {comp.property_type || '—'}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {fmtNumber(comp.units)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {comp.year_built ?? '—'}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {fmtPrice(comp.sale_price)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {fmtPerUnit(comp.price_per_unit)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {fmtCapRate(comp.cap_rate)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {fmtDate(comp.sale_date)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

// ============================================================
// Supply Pipeline Tab
// ============================================================

const SupplyPipelineTab = () => {
  const [projects, setProjects] = useState<PipelineProject[]>([]);
  const [inventories, setInventories] = useState<SubmarketInventory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterSubmarket, setFilterSubmarket] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showInventoryDialog, setShowInventoryDialog] = useState(false);
  const [inventoryForm, setInventoryForm] = useState({ metro: '', submarket: '', total_units: '' });
  const [savingInventory, setSavingInventory] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [pipelineData, inventoryData] = await Promise.all([
          dataBankService.getPipeline(),
          dataBankService.getInventories(),
        ]);
        setProjects(pipelineData);
        setInventories(inventoryData);
      } catch (err: any) {
        setError(err.response?.data?.detail || 'Failed to load pipeline data');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const uniqueSubmarkets = useMemo(
    () => [...new Set(projects.map((p) => p.submarket).filter(Boolean))].sort(),
    [projects],
  );

  const filtered = useMemo(() => {
    let result = [...projects];
    if (filterSubmarket) result = result.filter((p) => p.submarket === filterSubmarket);
    if (filterStatus) {
      const normalized = filterStatus.toLowerCase().replace(/[\s-]+/g, '_');
      result = result.filter((p) => p.status?.toLowerCase().replace(/[\s-]+/g, '_') === normalized);
    }
    return result;
  }, [projects, filterSubmarket, filterStatus]);

  const handleSaveInventory = async () => {
    if (!inventoryForm.metro || !inventoryForm.submarket || !inventoryForm.total_units) return;
    setSavingInventory(true);
    try {
      const saved = await dataBankService.setInventory(
        inventoryForm.metro,
        inventoryForm.submarket,
        Number(inventoryForm.total_units),
      );
      setInventories((prev) => {
        const idx = prev.findIndex(
          (i) => i.metro === saved.metro && i.submarket === saved.submarket,
        );
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = saved;
          return updated;
        }
        return [...prev, saved];
      });
      setInventoryForm({ metro: '', submarket: '', total_units: '' });
      setShowInventoryDialog(false);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to save inventory');
    } finally {
      setSavingInventory(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-10 rounded-lg bg-muted animate-pulse w-48" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-12 rounded-xl bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
        <AlertCircle className="w-4 h-4 text-red-500" />
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={filterSubmarket}
          onChange={(e) => setFilterSubmarket(e.target.value)}
          className="h-9 px-3 rounded-md border border-border bg-background text-sm text-foreground"
        >
          <option value="">All Submarkets</option>
          {uniqueSubmarkets.map((s) => (
            <option key={s} value={s!}>{s}</option>
          ))}
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="h-9 px-3 rounded-md border border-border bg-background text-sm text-foreground"
        >
          <option value="">All Statuses</option>
          <option value="lease_up">Lease-Up</option>
          <option value="under_construction">Under Construction</option>
          <option value="proposed">Proposed</option>
        </select>

        <span className="text-xs text-muted-foreground font-mono">
          {filtered.length} project{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Pipeline Table */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 rounded-xl border border-dashed border-border bg-card gap-3">
          <Building2 className="w-10 h-10 text-muted-foreground/40" />
          <div className="text-center">
            <p className="text-sm font-medium text-muted-foreground">No pipeline projects found</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Upload a pipeline tracker spreadsheet in the Documents tab to populate this view.
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Project Name</TableHead>
                <TableHead>Submarket</TableHead>
                <TableHead className="text-right">Units</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Developer</TableHead>
                <TableHead>Delivery</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((proj) => (
                <TableRow key={proj.id}>
                  <TableCell>
                    <span className="font-medium text-foreground">
                      {proj.project_name || '—'}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {proj.submarket || '—'}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {fmtNumber(proj.units)}
                  </TableCell>
                  <TableCell>
                    <PipelineStatusBadge status={proj.status} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {proj.developer || '—'}
                  </TableCell>
                  <TableCell className="text-sm font-mono text-muted-foreground">
                    {proj.delivery_quarter || '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Submarket Inventory Section */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Submarket Inventory</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Set total unit counts per submarket for supply pipeline scoring
            </p>
          </div>
          <Button size="sm" onClick={() => setShowInventoryDialog(true)}>
            <Plus className="w-4 h-4 mr-1.5" />
            Add Inventory
          </Button>
        </div>

        {inventories.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">
            No submarket inventories set yet. Add one to enable supply pipeline scoring.
          </p>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Metro</TableHead>
                  <TableHead>Submarket</TableHead>
                  <TableHead className="text-right">Total Units</TableHead>
                  <TableHead>Last Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inventories.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="text-sm font-medium text-foreground">
                      {inv.metro}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {inv.submarket}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {fmtNumber(inv.total_units)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {fmtDate(inv.updated_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Add Inventory Dialog */}
      <Dialog open={showInventoryDialog} onOpenChange={setShowInventoryDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Submarket Inventory</DialogTitle>
            <DialogDescription>
              Set the total existing unit count for a submarket. This is used as the denominator
              when calculating supply pipeline pressure scores.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="inv-metro">Metro</Label>
              <Input
                id="inv-metro"
                placeholder="e.g. Atlanta"
                value={inventoryForm.metro}
                onChange={(e) => setInventoryForm((f) => ({ ...f, metro: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inv-submarket">Submarket</Label>
              <Input
                id="inv-submarket"
                placeholder="e.g. Buckhead"
                value={inventoryForm.submarket}
                onChange={(e) => setInventoryForm((f) => ({ ...f, submarket: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inv-units">Total Units</Label>
              <Input
                id="inv-units"
                type="number"
                placeholder="e.g. 45000"
                value={inventoryForm.total_units}
                onChange={(e) => setInventoryForm((f) => ({ ...f, total_units: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInventoryDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveInventory}
              disabled={
                savingInventory ||
                !inventoryForm.metro ||
                !inventoryForm.submarket ||
                !inventoryForm.total_units
              }
            >
              {savingInventory ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Inventory'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ============================================================
// Main Page
// ============================================================

export const DataBankPage = () => {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
          Data Bank
        </h1>
        <p className="text-sm mt-1 text-muted-foreground">
          Upload spreadsheets, browse sales comps, and track the supply pipeline
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="documents" className="space-y-6">
        <TabsList className="bg-muted/50 p-1">
          <TabsTrigger value="documents" className="gap-1.5">
            <FileSpreadsheet className="w-4 h-4" />
            Documents
          </TabsTrigger>
          <TabsTrigger value="comps" className="gap-1.5">
            <Database className="w-4 h-4" />
            Sales Comps
          </TabsTrigger>
          <TabsTrigger value="pipeline" className="gap-1.5">
            <Building2 className="w-4 h-4" />
            Supply Pipeline
          </TabsTrigger>
        </TabsList>

        <TabsContent value="documents">
          <DocumentsTab />
        </TabsContent>

        <TabsContent value="comps">
          <SalesCompsTab />
        </TabsContent>

        <TabsContent value="pipeline">
          <SupplyPipelineTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};
