import { useState, useCallback, useEffect, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { FileText, AlertCircle, Upload, X } from 'lucide-react';
import { propertyService } from '../../services/propertyService';
import { cn } from '@/lib/utils';
import type { UploadResponse } from '../../types/property';

interface PDFUploaderProps {
  onUploadComplete: (result: UploadResponse, filename: string, pdfPath: string) => void;
}

// ============================================================
// Progress messages that cycle during upload
// ============================================================
const PROGRESS_MESSAGES = [
  'Uploading document...',
  'AI is reading your document...',
  'Extracting financial metrics...',
  'Almost done...',
];

// ============================================================
// Upload Progress Bar
// ============================================================
const UploadProgress = ({ isUploading }: { isUploading: boolean }) => {
  const [progress, setProgress] = useState(0);
  const [messageIndex, setMessageIndex] = useState(0);
  const startTimeRef = useRef(0);

  useEffect(() => {
    if (!isUploading) {
      setProgress(0);
      setMessageIndex(0);
      return;
    }

    startTimeRef.current = Date.now();

    // Progress animation: 0% → 90% over ~15 seconds
    const progressInterval = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const target = Math.min(90, (elapsed / 15000) * 90);
      setProgress(target);
    }, 200);

    // Cycle messages every 3 seconds
    const messageInterval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % PROGRESS_MESSAGES.length);
    }, 3000);

    return () => {
      clearInterval(progressInterval);
      clearInterval(messageInterval);
    };
  }, [isUploading]);

  if (!isUploading) return null;

  return (
    <div className="space-y-3">
      {/* Progress bar */}
      <div className="h-2 rounded-full bg-primary/20 overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all duration-1000 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
      {/* Status message */}
      <p className="text-sm text-muted-foreground text-center animate-pulse">
        {PROGRESS_MESSAGES[messageIndex]}
      </p>
    </div>
  );
};

// ============================================================
// Document type pills
// ============================================================
const DOC_TYPES = ['Offering Memorandums', 'BOV Reports', 'Rent Rolls'];

// ============================================================
// PDFUploader Component
// ============================================================
export const PDFUploader = ({ onUploadComplete }: PDFUploaderProps) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[]) => {
    if (rejectedFiles.length > 0) {
      const rejection = rejectedFiles[0];
      if (rejection.errors[0].code === 'file-too-large') {
        setError('File too large. Maximum size is 25MB.');
      } else if (rejection.errors[0].code === 'file-invalid-type') {
        setError('Invalid file type. Only PDF files are allowed.');
      } else {
        setError('File rejected. Please try again.');
      }
      return;
    }

    if (acceptedFiles.length > 0) {
      setSelectedFile(acceptedFiles[0]);
      setError(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxSize: 25 * 1024 * 1024, // 25MB
    multiple: false,
  });

  const handleAnalyze = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setError(null);

    try {
      const result = await propertyService.uploadPDF(selectedFile);
      // Pass result, filename, and PDF path (which backend returns) to parent
      const pdfPath = result.file_path || '';
      onUploadComplete(result, selectedFile.name, pdfPath);
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || 'Upload failed. Please try again.';
      setError(errorMessage);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemove = () => {
    setSelectedFile(null);
    setError(null);
  };

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
          isUploading && 'pointer-events-none opacity-50'
        )}
      >
        <input {...getInputProps()} />
        <div className="space-y-4">
          {/* Document type pills header */}
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

          {/* Upload icon in circle */}
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <Upload
              className={cn(
                'w-7 h-7 transition-colors',
                isDragActive ? 'text-primary' : 'text-primary'
              )}
            />
          </div>

          {/* Text */}
          <div className="space-y-1">
            <p className="text-foreground font-medium">
              {isDragActive ? 'Drop PDF here' : 'Drag & drop your document here'}
            </p>
            <p className="text-sm text-muted-foreground">
              or click to browse &middot; PDF files up to 25MB
            </p>
          </div>
        </div>
      </div>

      {/* Selected File Display */}
      {selectedFile && (
        <div className="flex items-center justify-between bg-primary/5 p-4 rounded-xl border border-primary/20">
          <div className="flex items-center space-x-3">
            <FileText className="h-8 w-8 text-primary" />
            <div>
              <p className="font-medium text-foreground">{selectedFile.name}</p>
              <p className="text-sm text-muted-foreground">
                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
          </div>
          {!isUploading && (
            <button
              onClick={handleRemove}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      )}

      {/* Upload Progress */}
      <UploadProgress isUploading={isUploading} />

      {/* Error Display */}
      {error && (
        <div className="bg-destructive/10 border border-destructive/20 p-4 rounded-xl">
          <div className="flex items-start">
            <AlertCircle className="h-5 w-5 text-destructive mt-0.5 mr-3 shrink-0" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        </div>
      )}

      {/* Analyze Button */}
      <button
        onClick={handleAnalyze}
        disabled={!selectedFile || isUploading}
        className={cn(
          'w-full h-12 text-base font-semibold rounded-xl transition-all',
          selectedFile && !isUploading
            ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20'
            : 'bg-muted text-muted-foreground cursor-not-allowed'
        )}
      >
        {isUploading ? 'Analyzing...' : 'Analyze Document'}
      </button>
    </div>
  );
};
