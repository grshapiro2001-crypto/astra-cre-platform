import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload as UploadIcon, Sparkles, CheckCircle2, FileText, ArrowRight, Loader2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { PDFUploader } from '../components/upload/PDFUploader';
import { propertyService } from '../services/propertyService';
import { dealFolderService } from '../services/dealFolderService';
import { cn } from '@/lib/utils';
import type { UploadResponse, PropertyListItem } from '../types/property';

const SAVE_TIMEOUT_MS = 30_000; // 30 seconds

// ============================================================
// How-It-Works Steps
// ============================================================

const STEPS = [
  {
    icon: UploadIcon,
    title: 'Upload PDF',
    description: 'Drag & drop your OM or BOV document',
  },
  {
    icon: Sparkles,
    title: 'AI Extracts',
    description: 'Claude analyzes and extracts key metrics',
  },
  {
    icon: CheckCircle2,
    title: 'Review & Save',
    description: 'Verify data and save to your library',
  },
];

const HowItWorks = () => (
  <div className="flex items-start justify-center gap-8 py-8">
    {STEPS.map((step) => (
      <div key={step.title} className="flex flex-col items-center text-center w-44">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
          <step.icon className="w-5 h-5 text-primary" />
        </div>
        <h4 className="text-sm font-semibold text-foreground mb-0.5">{step.title}</h4>
        <p className="text-xs text-muted-foreground leading-relaxed">{step.description}</p>
      </div>
    ))}
  </div>
);

// ============================================================
// Recent Uploads Section
// ============================================================

const RecentUploads = ({
  properties,
  isLoading,
}: {
  properties: PropertyListItem[];
  isLoading: boolean;
}) => {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="space-y-3">
        <h3 className="font-display text-lg font-semibold text-foreground">Recent Uploads</h3>
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-14 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (properties.length === 0) {
    return (
      <div className="space-y-3">
        <h3 className="font-display text-lg font-semibold text-foreground">Recent Uploads</h3>
        <div className="flex flex-col items-center justify-center py-10 rounded-xl border border-dashed border-border bg-card gap-2">
          <FileText className="w-8 h-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">No documents uploaded yet</p>
          <p className="text-xs text-muted-foreground/70">Upload your first offering memorandum to get started</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="font-display text-lg font-semibold text-foreground">Recent Uploads</h3>
      <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border">
        {properties.map((prop) => (
          <button
            key={prop.id}
            onClick={() => navigate(`/library/${prop.id}`)}
            className="w-full flex items-center gap-4 px-4 py-3 text-left cursor-pointer hover:bg-primary/5 transition-colors group"
          >
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground truncate">
                {prop.deal_name || prop.property_name || 'Untitled'}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {prop.property_address || prop.submarket || 'No address'}
              </p>
            </div>
            <span
              className={cn(
                'text-xs font-medium px-2 py-0.5 rounded-full shrink-0',
                prop.document_type === 'OM'
                  ? 'bg-blue-500/10 text-blue-400'
                  : 'bg-primary/10 text-primary'
              )}
            >
              {prop.document_type}
            </span>
            {prop.upload_date && (
              <span className="text-xs text-muted-foreground shrink-0 hidden sm:block">
                {new Date(prop.upload_date).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            )}
            <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
};

// ============================================================
// Upload Page
// ============================================================

export const Upload = () => {
  const navigate = useNavigate();
  const [recentProperties, setRecentProperties] = useState<PropertyListItem[]>([]);
  const [recentLoading, setRecentLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastUploadData, setLastUploadData] = useState<{
    result: UploadResponse;
    filename: string;
    pdfPath: string;
  } | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timeout on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    propertyService
      .listProperties({ sort_by: 'upload_date', sort_direction: 'desc' })
      .then((res) => {
        if (!cancelled) setRecentProperties(res.properties.slice(0, 5));
      })
      .catch(() => {
        // silently fail — recent uploads is non-critical
      })
      .finally(() => {
        if (!cancelled) setRecentLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleUploadComplete = async (result: UploadResponse, filename: string, pdfPath: string) => {
    // If the API ever returns a property ID directly, navigate straight to it
    const propertyId = (result as any).property_id ?? (result as any).id;
    if (propertyId) {
      navigate(`/library/${propertyId}`);
      return;
    }

    // Store upload data for potential retry
    setLastUploadData({ result, filename, pdfPath });

    // Auto-save: create a folder and save the property, then navigate to detail
    setIsSaving(true);
    setSaveError(null);

    // Safety timeout — if save hangs for 30s, recover instead of showing blank page forever
    const timeoutId = setTimeout(() => {
      setIsSaving(false);
      const msg = 'Save timed out. The server may be slow or unavailable.';
      setSaveError(msg);
      toast.error('Save timed out', {
        description: 'The server may be slow or unavailable. You can retry below.',
      });
    }, SAVE_TIMEOUT_MS);
    saveTimeoutRef.current = timeoutId;

    try {
      // Defensive: guard against malformed extraction responses
      if (!result.extraction_result || !result.extraction_result.property_info) {
        throw new Error('Extraction returned an incomplete response. Please re-upload.');
      }

      const pInfo = result.extraction_result.property_info;
      const dealName = pInfo.deal_name || filename.replace('.pdf', '');
      const docType = result.extraction_result.document_type;

      // Create a deal folder named after the property
      const folder = await dealFolderService.createFolder({
        folder_name: dealName,
        property_type: pInfo.property_type ?? undefined,
        property_address: pInfo.property_address ?? undefined,
        submarket: pInfo.submarket ?? undefined,
        total_units: pInfo.total_units ?? undefined,
        total_sf: pInfo.total_sf ?? undefined,
        status: 'active',
      });

      // Save the property to the new folder
      const savedProperty = await propertyService.saveToLibrary(
        result,
        filename,
        pdfPath,
        folder.id,
        docType === 'OM' || docType === 'BOV' ? docType : undefined,
        true // force=true to skip duplicate check on auto-save
      );

      // Clear timeout on success
      clearTimeout(timeoutId);
      saveTimeoutRef.current = null;

      // Reset saving state BEFORE navigating to prevent stale state during route transition
      setIsSaving(false);

      // Navigate to the property detail page
      navigate(`/library/${savedProperty.id}`);
    } catch (err: any) {
      // Clear timeout on failure
      clearTimeout(timeoutId);
      saveTimeoutRef.current = null;

      console.error('Auto-save failed:', err);
      // CRITICAL: FastAPI Pydantic errors return `detail` as an array of objects
      // e.g. [{type, loc, msg, input, url}]. Rendering an object as a React child
      // crashes the entire tree. Always coerce to a plain string.
      const rawDetail = err.response?.data?.detail;
      const errorMsg: string =
        typeof rawDetail === 'string'
          ? rawDetail
          : Array.isArray(rawDetail)
            ? rawDetail.map((d: any) => {
              const field = Array.isArray(d.loc) ? d.loc.join('.') : '';
              return field ? `${field}: ${d.msg}` : (d.msg || JSON.stringify(d));
            }).join('; ')
            : 'Failed to save property. Please try again.';
      setSaveError(errorMsg);
      toast.error('Save failed', { description: errorMsg });
      setIsSaving(false);
    }
  };

  const handleRetry = () => {
    if (lastUploadData) {
      handleUploadComplete(lastUploadData.result, lastUploadData.filename, lastUploadData.pdfPath);
    }
  };

  const handleCancelSave = () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    setIsSaving(false);
    setSaveError('Save was cancelled. Your extraction data is preserved — you can retry.');
    toast.info('Save cancelled');
  };

  // Saving transition state — includes cancel button so user is never stuck
  if (isSaving) {
    return (
      <div className="max-w-2xl mx-auto flex flex-col items-center justify-center py-32 gap-4">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Loader2 className="w-7 h-7 text-primary animate-spin" />
        </div>
        <div className="text-center space-y-1">
          <p className="text-lg font-medium text-foreground">Extraction complete!</p>
          <p className="text-sm text-muted-foreground">Saving to your library and loading property details...</p>
        </div>
        <button
          onClick={handleCancelSave}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors underline mt-2"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-10">
      {/* Header */}
      <div className="text-center">
        <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
          Upload Property Document
        </h1>
        <p className="text-sm mt-1 text-muted-foreground">
          Upload an Offering Memorandum or BOV for AI-powered extraction
        </p>
      </div>

      {/* Save Error with Retry */}
      {saveError && (
        <div className="max-w-2xl mx-auto bg-destructive/10 border border-destructive/20 p-4 rounded-xl flex items-center justify-between gap-4">
          <p className="text-sm text-destructive">{saveError}</p>
          {lastUploadData && (
            <button
              onClick={handleRetry}
              className="flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Retry
            </button>
          )}
        </div>
      )}

      {/* Upload Card */}
      <div className="relative max-w-2xl mx-auto">
        {/* Ambient orb */}
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-72 h-72 bg-primary/5 rounded-full blur-3xl pointer-events-none dark:bg-primary/10" />

        <div className="relative bg-card shadow-lg shadow-primary/5 rounded-2xl border border-border p-8">
          <PDFUploader onUploadComplete={handleUploadComplete} />
        </div>
      </div>

      {/* How It Works */}
      <HowItWorks />

      {/* Recent Uploads */}
      <div className="max-w-2xl mx-auto">
        <RecentUploads properties={recentProperties} isLoading={recentLoading} />
      </div>
    </div>
  );
};
