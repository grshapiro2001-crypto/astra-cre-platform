import { useState, useCallback, useEffect, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { FileSpreadsheet, AlertCircle, X, ChevronDown, Loader2 } from 'lucide-react';
import { propertyService } from '../../services/propertyService';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface ExcelUploaderProps {
  onSuccess: (propertyId: number) => void;
}

// ============================================================
// File type detection from filename
// ============================================================
type DetectedType = 't12' | 'rent_roll' | 'unknown';

function detectFileType(filename: string): DetectedType {
  const lower = filename.toLowerCase();
  if (/t[_-]?12|trailing/.test(lower)) return 't12';
  if (/rent[_ ]?roll|unit[_ ]?mix|\brr\b/.test(lower)) return 'rent_roll';
  return 'unknown';
}

const TYPE_LABELS: Record<DetectedType, string> = {
  t12: 'T-12',
  rent_roll: 'Rent Roll',
  unknown: 'Unknown',
};

const TYPE_BADGE_CLASSES: Record<DetectedType, string> = {
  t12: 'bg-amber-500/10 text-amber-400',
  rent_roll: 'bg-primary/10 text-primary',
  unknown: 'bg-muted text-muted-foreground',
};

// ============================================================
// Progress messages during extraction
// ============================================================
const PROGRESS_MESSAGES = [
  'Uploading files...',
  'Classifying document type...',
  'Extracting financial data...',
  'Building property record...',
  'Almost done...',
];

// ============================================================
// File entry with detected/manual type
// ============================================================
interface FileEntry {
  file: File;
  detectedType: DetectedType;
  manualType: DetectedType | null;
}

// ============================================================
// ExcelUploader Component
// ============================================================
export const ExcelUploader = ({ onSuccess }: ExcelUploaderProps) => {
  const [fileEntries, setFileEntries] = useState<FileEntry[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [propertyName, setPropertyName] = useState('');
  const [address, setAddress] = useState('');
  const [totalUnits, setTotalUnits] = useState('');
  const [submarket, setSubmarket] = useState('');
  const [metro, setMetro] = useState('Atlanta');

  // Progress animation
  const [messageIndex, setMessageIndex] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isUploading) {
      setMessageIndex(0);
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % PROGRESS_MESSAGES.length);
    }, 3000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isUploading]);

  const onDrop = useCallback(
    (acceptedFiles: File[], rejectedFiles: any[]) => {
      if (rejectedFiles.length > 0) {
        const err = rejectedFiles[0].errors[0];
        if (err.code === 'file-too-large') {
          setError('File too large. Maximum size is 25MB.');
        } else if (err.code === 'file-invalid-type') {
          setError('Invalid file type. Only .xlsx, .xlsm, and .csv files are allowed.');
        } else {
          setError('File rejected. Please try again.');
        }
        return;
      }

      const remaining = 2 - fileEntries.length;
      if (remaining <= 0) {
        setError('Maximum 2 files allowed. Remove a file first.');
        return;
      }

      const newEntries: FileEntry[] = acceptedFiles.slice(0, remaining).map((file) => ({
        file,
        detectedType: detectFileType(file.name),
        manualType: null,
      }));

      // Try to pre-fill property name from first file
      if (fileEntries.length === 0 && newEntries.length > 0 && !propertyName) {
        const name = newEntries[0].file.name
          .replace(/\.(xlsx|xlsm|csv)$/i, '')
          .replace(/[_-]/g, ' ')
          .replace(/\b(t12|t-12|rent roll|rr|trailing|unit mix)\b/gi, '')
          .trim();
        if (name.length > 2) {
          setPropertyName(name);
        }
      }

      setFileEntries((prev) => [...prev, ...newEntries]);
      setError(null);
    },
    [fileEntries, propertyName]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel.sheet.macroEnabled.12': ['.xlsm'],
      'text/csv': ['.csv'],
    },
    maxSize: 25 * 1024 * 1024,
    multiple: true,
    disabled: fileEntries.length >= 2 || isUploading,
  });

  const removeFile = (index: number) => {
    setFileEntries((prev) => prev.filter((_, i) => i !== index));
    setError(null);
  };

  const setManualType = (index: number, type: DetectedType) => {
    setFileEntries((prev) =>
      prev.map((entry, i) => (i === index ? { ...entry, manualType: type } : entry))
    );
  };

  const effectiveType = (entry: FileEntry): DetectedType =>
    entry.manualType ?? entry.detectedType;

  const canSubmit =
    fileEntries.length >= 1 &&
    propertyName.trim().length > 0 &&
    address.trim().length > 0 &&
    !isUploading;

  const handleSubmit = async () => {
    if (!canSubmit) return;

    setIsUploading(true);
    setError(null);

    try {
      const result = await propertyService.uploadExcelAnalysis(
        fileEntries.map((e) => e.file),
        {
          property_name: propertyName.trim(),
          property_address: address.trim(),
          total_units: totalUnits ? parseInt(totalUnits, 10) : undefined,
          submarket: submarket.trim() || undefined,
          metro: metro.trim() || undefined,
        }
      );

      if (result.success && result.property_id) {
        onSuccess(result.property_id);
      } else {
        setError('Upload completed but no property was created. Please try again.');
      }
    } catch (err: any) {
      console.error('Excel analysis upload error:', err);
      const rawDetail = err.response?.data?.detail;
      const errorMessage: string =
        typeof rawDetail === 'string'
          ? rawDetail
          : Array.isArray(rawDetail)
            ? rawDetail.map((d: any) => d.msg || JSON.stringify(d)).join('; ')
            : 'Upload failed. Please try again.';
      setError(errorMessage);
    } finally {
      setIsUploading(false);
    }
  };

  const DOC_TYPES = ['T-12 Statement', 'Rent Roll'];

  return (
    <div className="space-y-4">
      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={cn(
          'border border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-300 min-h-48 flex items-center justify-center',
          isDragActive
            ? 'border-primary border-solid bg-primary/5 ring-2 ring-primary/20 shadow-lg shadow-primary/10'
            : 'border-border/60 bg-card/50 hover:border-primary/40 hover:bg-primary/5',
          (isUploading || fileEntries.length >= 2) && 'pointer-events-none opacity-50'
        )}
      >
        <input {...getInputProps()} />
        <div className="space-y-4">
          {/* Document type pills */}
          <div className="flex items-center justify-center gap-2">
            {DOC_TYPES.map((type) => (
              <span
                key={type}
                className="inline-flex text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary/70"
              >
                {type}
              </span>
            ))}
          </div>

          {/* Upload icon */}
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <FileSpreadsheet className="w-7 h-7 text-primary" />
          </div>

          {/* Text */}
          <div className="space-y-1">
            <p className="text-foreground font-medium">
              {isDragActive ? 'Drop files here' : 'Drop your T12 or Rent Roll files here'}
            </p>
            <p className="text-sm text-muted-foreground">
              Upload one or both to start your analysis &middot; .xlsx, .xlsm, .csv
            </p>
          </div>
        </div>
      </div>

      {/* File List */}
      {fileEntries.length > 0 && (
        <div className="space-y-2">
          {fileEntries.map((entry, index) => (
            <div
              key={`${entry.file.name}-${index}`}
              className="flex items-center justify-between bg-primary/5 p-4 rounded-xl border border-primary/20"
            >
              <div className="flex items-center space-x-3 min-w-0 flex-1">
                <FileSpreadsheet className="h-8 w-8 text-primary shrink-0" />
                <div className="min-w-0">
                  <p className="font-medium text-foreground truncate">{entry.file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(entry.file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {/* Type badge / selector */}
                {effectiveType(entry) !== 'unknown' ? (
                  <span
                    className={cn(
                      'text-xs font-medium px-2 py-0.5 rounded-full',
                      TYPE_BADGE_CLASSES[effectiveType(entry)]
                    )}
                  >
                    {TYPE_LABELS[effectiveType(entry)]}
                  </span>
                ) : (
                  <div className="relative">
                    <select
                      value={entry.manualType ?? 'unknown'}
                      onChange={(e) => setManualType(index, e.target.value as DetectedType)}
                      className="appearance-none text-xs font-medium px-2 py-0.5 pr-6 rounded-full bg-muted text-muted-foreground border border-border cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary/40"
                    >
                      <option value="unknown">Select type...</option>
                      <option value="t12">T-12</option>
                      <option value="rent_roll">Rent Roll</option>
                    </select>
                    <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
                  </div>
                )}

                {!isUploading && (
                  <button
                    onClick={() => removeFile(index)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Property Info Form */}
      {fileEntries.length > 0 && (
        <div className="space-y-4 pt-2">
          <h4 className="font-sans text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Property Information
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="font-sans text-sm text-muted-foreground block mb-1">
                Property Name <span className="text-destructive">*</span>
              </label>
              <Input
                value={propertyName}
                onChange={(e) => setPropertyName(e.target.value)}
                placeholder="e.g. 1160 Hammond Apartments"
                disabled={isUploading}
              />
            </div>

            <div className="sm:col-span-2">
              <label className="font-sans text-sm text-muted-foreground block mb-1">
                Address <span className="text-destructive">*</span>
              </label>
              <Input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. 1160 Hammond Dr NE, Atlanta, GA 30328"
                disabled={isUploading}
              />
            </div>

            <div>
              <label className="font-sans text-sm text-muted-foreground block mb-1">
                Total Units
              </label>
              <Input
                type="number"
                value={totalUnits}
                onChange={(e) => setTotalUnits(e.target.value)}
                placeholder="Auto-detected from Rent Roll"
                disabled={isUploading}
              />
            </div>

            <div>
              <label className="font-sans text-sm text-muted-foreground block mb-1">
                Submarket
              </label>
              <Input
                value={submarket}
                onChange={(e) => setSubmarket(e.target.value)}
                placeholder="e.g. Sandy Springs"
                disabled={isUploading}
              />
            </div>

            <div>
              <label className="font-sans text-sm text-muted-foreground block mb-1">
                Metro
              </label>
              <Input
                value={metro}
                onChange={(e) => setMetro(e.target.value)}
                placeholder="Atlanta"
                disabled={isUploading}
              />
            </div>
          </div>
        </div>
      )}

      {/* Progress indicator */}
      {isUploading && (
        <div className="flex items-center justify-center gap-3 py-2">
          <Loader2 className="w-5 h-5 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground animate-pulse">
            {PROGRESS_MESSAGES[messageIndex]}
          </p>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-destructive/10 border border-destructive/20 p-4 rounded-xl">
          <div className="flex items-start">
            <AlertCircle className="h-5 w-5 text-destructive mt-0.5 mr-3 shrink-0" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        </div>
      )}

      {/* Submit Button */}
      <Button
        onClick={handleSubmit}
        disabled={!canSubmit}
        size="xl"
        className="w-full"
      >
        {isUploading ? 'Extracting data...' : 'Start Analysis'}
      </Button>
    </div>
  );
};
