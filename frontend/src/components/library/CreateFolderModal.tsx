/**
 * CreateFolderModal - Modal for creating empty deal folders
 * Phase 3A Priority 2
 */
import { useState } from 'react';
import { dealFolderService } from '../../services/dealFolderService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface CreateFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const PROPERTY_TYPES = ['Multifamily', 'Office', 'Retail', 'Industrial', 'Other'];

export const CreateFolderModal = ({ isOpen, onClose, onSuccess }: CreateFolderModalProps) => {
  // State
  const [folderName, setFolderName] = useState('');
  const [propertyType, setPropertyType] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Validation
  const isValid = folderName.trim().length > 0 && folderName.length <= 255;

  const handleCreate = async () => {
    if (!isValid) {
      setError('Folder name is required (max 255 characters)');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      await dealFolderService.createFolder({
        folder_name: folderName.trim(),
        property_type: propertyType || undefined,
      });

      // Reset form
      setFolderName('');
      setPropertyType('');

      // Notify parent and close
      onSuccess();
      onClose();
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || 'Failed to create folder';
      setError(errorMessage);
    } finally {
      setIsCreating(false);
    }
  };

  const handleCancel = () => {
    setFolderName('');
    setPropertyType('');
    setError(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Deal Folder</DialogTitle>
          <DialogDescription>
            Create an empty folder to organize your deals
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Folder Name Input */}
          <div className="space-y-2">
            <Label htmlFor="folder-name">
              Folder Name <span className="text-red-600">*</span>
            </Label>
            <Input
              id="folder-name"
              type="text"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              placeholder="e.g., Tower on Piedmont"
              maxLength={255}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              {folderName.length}/255 characters
            </p>
          </div>

          {/* Property Type Dropdown */}
          <div className="space-y-2">
            <Label htmlFor="property-type">
              Property Type <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Select value={propertyType} onValueChange={setPropertyType}>
              <SelectTrigger id="property-type">
                <SelectValue placeholder="Select property type..." />
              </SelectTrigger>
              <SelectContent>
                {PROPERTY_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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
            disabled={isCreating}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!isValid || isCreating}
          >
            {isCreating ? 'Creating...' : 'Create Folder'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
