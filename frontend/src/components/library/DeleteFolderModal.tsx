/**
 * DeleteFolderModal - Modal for deleting deal folders with confirmation
 * Phase 3A Priority 3
 */
import { useState } from 'react';
import { dealFolderService } from '../../services/dealFolderService';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface DeleteFolderModalProps {
  isOpen: boolean;
  folderName: string;
  folderId: number;
  documentCount: number;
  onClose: () => void;
  onSuccess: () => void;
}

export const DeleteFolderModal = ({
  isOpen,
  folderName,
  folderId,
  documentCount,
  onClose,
  onSuccess,
}: DeleteFolderModalProps) => {
  // State
  const [deleteMode, setDeleteMode] = useState<'folder_only' | 'folder_and_documents'>('folder_only');
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    console.log('🔴 Deleting folder:', { folderId, folderName, deleteMode, documentCount });

    setIsDeleting(true);
    setError(null);

    try {
      const deleteContents = deleteMode === 'folder_and_documents';

      await dealFolderService.deleteFolder(folderId, deleteContents);

      console.log('✅ Folder deleted successfully');

      // Notify parent and close
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('❌ Delete folder failed:', err);
      const errorMessage = err.response?.data?.detail || 'Failed to delete folder';
      setError(errorMessage);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCancel = () => {
    setDeleteMode('folder_only');
    setError(null);
    onClose();
  };

  const hasDocuments = documentCount > 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete Folder</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this folder?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Folder Info */}
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm">
                <div className="font-medium mb-1">{folderName}</div>
                <div className="text-muted-foreground">
                  {documentCount} {documentCount === 1 ? 'document' : 'documents'}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Delete Options (only show if folder has documents) */}
          {hasDocuments && (
            <div className="space-y-3">
              <Label className="text-sm font-medium">What should happen to the documents?</Label>

              <RadioGroup
                value={deleteMode}
                onValueChange={(value) => setDeleteMode(value as 'folder_only' | 'folder_and_documents')}
              >
                {/* Option 1: Delete folder only (safer) */}
                <div className="flex items-start p-3 border rounded-lg hover:bg-accent transition-colors">
                  <RadioGroupItem value="folder_only" id="folder-only" className="mt-0.5" />
                  <div className="ml-3">
                    <Label htmlFor="folder-only" className="text-sm font-medium cursor-pointer">
                      Delete folder only
                    </Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      Documents will remain in your library without a folder (orphaned).
                      You can assign them to folders later.
                    </p>
                  </div>
                </div>

                {/* Option 2: Delete folder and documents (dangerous) */}
                <div className="flex items-start p-3 border border-red-300 rounded-lg hover:bg-red-50 transition-colors">
                  <RadioGroupItem value="folder_and_documents" id="folder-and-docs" className="mt-0.5" />
                  <div className="ml-3">
                    <Label htmlFor="folder-and-docs" className="text-sm font-medium text-red-900 cursor-pointer">
                      Delete folder and all documents
                    </Label>
                    <p className="text-xs text-red-700 mt-1">
                      ⚠️ This will permanently delete all {documentCount}{' '}
                      {documentCount === 1 ? 'document' : 'documents'}. This action cannot be undone.
                    </p>
                  </div>
                </div>
              </RadioGroup>
            </div>
          )}

          {/* Empty folder message */}
          {!hasDocuments && (
            <p className="text-sm text-muted-foreground">
              This folder is empty and can be safely deleted.
            </p>
          )}

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
            onClick={handleCancel}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? 'Deleting...' : 'Delete Folder'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
