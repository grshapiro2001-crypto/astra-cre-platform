import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload as UploadIcon, Sparkles, CheckCircle2, FileText, ArrowRight } from 'lucide-react';
import { PDFUploader } from '../components/upload/PDFUploader';
import { ExtractionPreview } from '../components/upload/ExtractionPreview';
import { propertyService } from '../services/propertyService';
import { cn } from '@/lib/utils';
import type { UploadResponse, PropertyListItem } from '../types/property';

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
  const [uploadResult, setUploadResult] = useState<UploadResponse | null>(null);
  const [uploadedFilename, setUploadedFilename] = useState<string>('');
  const [pdfPath, setPdfPath] = useState<string>('');
  const [recentProperties, setRecentProperties] = useState<PropertyListItem[]>([]);
  const [recentLoading, setRecentLoading] = useState(true);

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
  }, [uploadResult]); // re-fetch after a successful upload

  const handleUploadComplete = (result: UploadResponse, filename: string, pdfPath: string) => {
    setUploadResult(result);
    setUploadedFilename(filename);
    setPdfPath(pdfPath);
  };

  const handleUploadAnother = () => {
    setUploadResult(null);
    setUploadedFilename('');
    setPdfPath('');
  };

  if (uploadResult) {
    return (
      <div className="max-w-5xl mx-auto">
        <ExtractionPreview
          result={uploadResult}
          filename={uploadedFilename}
          pdfPath={pdfPath}
          onUploadAnother={handleUploadAnother}
        />
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
