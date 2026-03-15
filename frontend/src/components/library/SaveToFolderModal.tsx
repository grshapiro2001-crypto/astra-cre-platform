import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { dealFolderService, type DealFolder } from '../../services/dealFolderService';
import { propertyService } from '../../services/propertyService';
import type { UploadResponse } from '../../types/property';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface SaveToFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  extractionResult: UploadResponse;
  filename: string;
  pdfPath: string;
}

const DOCUMENT_SUBTYPES = ['OM', 'BOV', 'Rent Roll', 'T-12', 'Other'];

export const SaveToFolderModal = ({
  isOpen,
  onClose,
  extractionResult,
  filename,
  pdfPath,
}: SaveToFolderModalProps) => {
  const navigate = useNavigate();

  // Radio selection: "new" or "existing"
  const [folderOption, setFolderOption] = useState<'new' | 'existing'>('new');

  // New folder inputs
  const [newFolderName, setNewFolderName] = useState('');

  // Existing folder selection
  const [existingFolders, setExistingFolders] = useState<DealFolder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);
  const [loadingFolders, setLoadingFolders] = useState(false);

  // Document subtype (auto-detected but editable)
  const [documentSubtype, setDocumentSubtype] = useState<string>('');

  // Save state
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Duplicate handling state
  const [duplicateDetected, setDuplicateDetected] = useState(false);
  const [existingProperty, setExistingProperty] = useState<any | null>(null);
  const [pendingSaveFolderId, setPendingSaveFolderId] = useState<number | null>(null);

  // Initialize default values when modal opens
  useEffect(() => {
    if (isOpen) {
      // Pre-fill folder name with property name or filename
      const defaultName =
        extractionResult.extraction_result.property_info.deal_name ||
        filename.replace('.pdf', '');
      setNewFolderName(defaultName);

      // Auto-detect document subtype from document_type
      const detectedType = extractionResult.extraction_result.document_type;
      if (detectedType === 'OM' || detectedType === 'BOV') {
        setDocumentSubtype(detectedType);
      } else {
        setDocumentSubtype('Other');
      }

      // Load existing folders
      loadExistingFolders();
    }
  }, [isOpen, extractionResult, filename]);

  const loadExistingFolders = async () => {
    setLoadingFolders(true);
    try {
      const folders = await dealFolderService.listFolders('active');
      setExistingFolders(folders);
      if (folders.length > 0) {
        setSelectedFolderId(folders[0].id);
      }
    } catch (err) {
    } finally {
      setLoadingFolders(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    let folderId: number | undefined;  // ← Moved OUTSIDE try block so catch can access it

    try {

      if (folderOption === 'new') {
        // Validate new folder name
        if (!newFolderName.trim()) {
          setError('Please enter a folder name');
          setIsSaving(false);
          return;
        }

        // Create new folder first
        const pInfo = extractionResult.extraction_result.property_info;
        const newFolder = await dealFolderService.createFolder({
          folder_name: newFolderName.trim(),
          property_type: pInfo.property_type ?? undefined,
          property_address: pInfo.property_address ?? undefined,
          submarket: pInfo.submarket ?? undefined,
          total_units: pInfo.total_units ?? undefined,
          total_sf: pInfo.total_sf ?? undefined,
          status: 'active',
        });

        folderId = newFolder.id;
      } else {
        // Use existing folder
        if (!selectedFolderId) {
          setError('Please select a folder');
          setIsSaving(false);
          return;
        }
        folderId = selectedFolderId;
      }

      // Save property to library with folder association
      const savedProperty = await propertyService.saveToLibrary(
        extractionResult,
        filename,
        pdfPath,
        folderId,
        documentSubtype || undefined
      );

      // Navigate to the saved property's detail page
      navigate(`/library/${savedProperty.id}`);
    } catch (err: any) {

      // Check if this is a duplicate property error (409 Conflict)
      if (err.response?.status === 409 && err.response?.data?.detail?.existing_property) {
        if (!folderId) {
          setError('Internal error: folder ID is missing. Please try again.');
          setIsSaving(false);
          return;
        }

        // Show duplicate confirmation modal
        setDuplicateDetected(true);
        setExistingProperty(err.response.data.detail.existing_property);
        setPendingSaveFolderId(folderId);
        setIsSaving(false);
        return;
      }

      // Other errors
      const errorMessage = typeof err.response?.data?.detail === 'string'
        ? err.response.data.detail
        : err.response?.data?.detail?.message || 'Failed to save property. Please try again.';
      setError(errorMessage);
      setIsSaving(false);
    }
  };

  const handleReplaceExisting = async () => {
    if (!existingProperty || !pendingSaveFolderId) {
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      // Delete existing property
      await propertyService.deleteProperty(existingProperty.id);

      // Save new property to same folder
      const savedProperty = await propertyService.saveToLibrary(
        extractionResult,
        filename,
        pdfPath,
        pendingSaveFolderId,
        documentSubtype || undefined
      );

      // Navigate to the saved property's detail page
      navigate(`/library/${savedProperty.id}`);
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || 'Failed to replace property. Please try again.';
      setError(errorMessage);
      setIsSaving(false);
    }
  };

  const handleKeepBoth = async () => {
    if (!pendingSaveFolderId) {
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      // Save with force=true to skip duplicate check
      const savedProperty = await propertyService.saveToLibrary(
        extractionResult,
        filename,
        pdfPath,
        pendingSaveFolderId,
        documentSubtype || undefined,
        true  // force=true
      );

      // Navigate to the saved property's detail page
      navigate(`/library/${savedProperty.id}`);
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || 'Failed to save property. Please try again.';
      setError(errorMessage);
      setIsSaving(false);
    }
  };

  const handleCancelDuplicate = () => {
    setDuplicateDetected(false);
    setExistingProperty(null);
    setPendingSaveFolderId(null);
    setError(null);
  };

  // Show duplicate confirmation modal if duplicate detected
  if (duplicateDetected && existingProperty) {
    return (
      <Dialog open={true} onOpenChange={handleCancelDuplicate}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Similar Property Exists</DialogTitle>
            <DialogDescription>
              A property with the same name already exists. What would you like to do?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Comparison Cards */}
            <div className="grid grid-cols-2 gap-4">
              {/* Existing Property */}
              <Card className="bg-yellow-50 border-yellow-200">
                <CardHeader>
                  <CardTitle className="text-base">Existing Property</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium text-muted-foreground">Name:</span>
                    <p className="text-foreground">{existingProperty.deal_name}</p>
                  </div>
                  {existingProperty.property_address && (
                    <div>
                      <span className="font-medium text-muted-foreground">Address:</span>
                      <p className="text-foreground">{existingProperty.property_address}</p>
                    </div>
                  )}
                  <div>
                    <span className="font-medium text-muted-foreground">Uploaded:</span>
                    <p className="text-foreground">
                      {existingProperty.upload_date
                        ? new Date(existingProperty.upload_date).toLocaleDateString()
                        : 'N/A'}
                    </p>
                  </div>
                  {(existingProperty.t12_noi || existingProperty.y1_noi) && (
                    <div>
                      <span className="font-medium text-muted-foreground">NOI:</span>
                      <p className="text-foreground">
                        {existingProperty.y1_noi
                          ? `Y1: $${(existingProperty.y1_noi / 1000000).toFixed(1)}M`
                          : existingProperty.t12_noi
                          ? `T12: $${(existingProperty.t12_noi / 1000000).toFixed(1)}M`
                          : 'N/A'}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* New Property */}
              <Card className="bg-green-50 border-green-200">
                <CardHeader>
                  <CardTitle className="text-base">New Property</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium text-muted-foreground">Name:</span>
                    <p className="text-foreground">
                      {extractionResult.extraction_result.property_info.deal_name || filename}
                    </p>
                  </div>
                  {extractionResult.extraction_result.property_info.property_address && (
                    <div>
                      <span className="font-medium text-muted-foreground">Address:</span>
                      <p className="text-foreground">
                        {extractionResult.extraction_result.property_info.property_address}
                      </p>
                    </div>
                  )}
                  <div>
                    <span className="font-medium text-muted-foreground">Uploaded:</span>
                    <p className="text-foreground">Today</p>
                  </div>
                  {(extractionResult.extraction_result.financials_by_period.y1?.noi ||
                    extractionResult.extraction_result.financials_by_period.t12?.noi) && (
                    <div>
                      <span className="font-medium text-muted-foreground">NOI:</span>
                      <p className="text-foreground">
                        {extractionResult.extraction_result.financials_by_period.y1?.noi
                          ? `Y1: $${(
                              extractionResult.extraction_result.financials_by_period.y1.noi / 1000000
                            ).toFixed(1)}M`
                          : extractionResult.extraction_result.financials_by_period.t12?.noi
                          ? `T12: $${(
                              extractionResult.extraction_result.financials_by_period.t12.noi / 1000000
                            ).toFixed(1)}M`
                          : 'N/A'}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Error Message */}
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={handleCancelDuplicate}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={handleKeepBoth}
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Keep Both'}
            </Button>
            <Button
              variant="destructive"
              onClick={handleReplaceExisting}
              disabled={isSaving}
            >
              {isSaving ? 'Replacing...' : 'Replace Existing'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Save to Folder</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
            {/* Folder Selection */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Choose Folder</Label>

              <RadioGroup
                value={folderOption}
                onValueChange={(value) => setFolderOption(value as 'new' | 'existing')}
                disabled={isSaving}
              >
                {/* Create New Folder */}
                <div className="flex items-start space-x-3">
                  <RadioGroupItem value="new" id="new-folder" className="mt-1" />
                  <div className="flex-1 space-y-2">
                    <Label htmlFor="new-folder" className="text-sm font-medium cursor-pointer">
                      Create New Folder
                    </Label>
                    {folderOption === 'new' && (
                      <Input
                        type="text"
                        value={newFolderName}
                        onChange={(e) => setNewFolderName(e.target.value)}
                        placeholder="Enter folder name"
                        disabled={isSaving}
                      />
                    )}
                  </div>
                </div>

                {/* Add to Existing Folder */}
                <div className="flex items-start space-x-3">
                  <RadioGroupItem
                    value="existing"
                    id="existing-folder"
                    disabled={existingFolders.length === 0}
                    className="mt-1"
                  />
                  <div className="flex-1 space-y-2">
                    <Label htmlFor="existing-folder" className="text-sm font-medium cursor-pointer">
                      Add to Existing Folder
                      {existingFolders.length === 0 && (
                        <span className="ml-2 text-xs text-muted-foreground">(No folders yet)</span>
                      )}
                    </Label>
                    {folderOption === 'existing' && existingFolders.length > 0 && (
                      <Select
                        value={selectedFolderId?.toString() || ''}
                        onValueChange={(value) => setSelectedFolderId(Number(value))}
                        disabled={isSaving || loadingFolders}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a folder" />
                        </SelectTrigger>
                        <SelectContent>
                          {existingFolders.map((folder) => (
                            <SelectItem key={folder.id} value={folder.id.toString()}>
                              {folder.folder_name} ({folder.document_count}{' '}
                              {folder.document_count === 1 ? 'document' : 'documents'})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>
              </RadioGroup>
            </div>

            {/* Document Type */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Document Type</Label>
              <Select
                value={documentSubtype}
                onValueChange={setDocumentSubtype}
                disabled={isSaving}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_SUBTYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Auto-detected: {extractionResult.extraction_result.document_type}
              </p>
            </div>

            {/* Property Preview */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Property Summary</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-1">
                <p>
                  <strong>Name:</strong>{' '}
                  {extractionResult.extraction_result.property_info.deal_name || filename}
                </p>
                {extractionResult.extraction_result.property_info.property_type && (
                  <p>
                    <strong>Type:</strong>{' '}
                    {extractionResult.extraction_result.property_info.property_type}
                  </p>
                )}
                {extractionResult.extraction_result.property_info.property_address && (
                  <p>
                    <strong>Address:</strong>{' '}
                    {extractionResult.extraction_result.property_info.property_address}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Error Message */}
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save to Folder'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
