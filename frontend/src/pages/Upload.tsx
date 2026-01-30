import { useState } from 'react';
import { PDFUploader } from '../components/upload/PDFUploader';
import { ExtractionPreview } from '../components/upload/ExtractionPreview';
import type { UploadResponse } from '../types/property';

export const Upload = () => {
  const [uploadResult, setUploadResult] = useState<UploadResponse | null>(null);
  const [uploadedFilename, setUploadedFilename] = useState<string>('');
  const [pdfPath, setPdfPath] = useState<string>('');

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

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold text-emerald-900 mb-6">Upload Property Document</h1>

      {!uploadResult ? (
        <div className="bg-white shadow-md rounded-xl border border-emerald-100 p-8">
          <PDFUploader onUploadComplete={handleUploadComplete} />
        </div>
      ) : (
        <ExtractionPreview
          result={uploadResult}
          filename={uploadedFilename}
          pdfPath={pdfPath}
          onUploadAnother={handleUploadAnother}
        />
      )}
    </div>
  );
};
