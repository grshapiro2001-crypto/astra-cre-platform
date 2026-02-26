/**
 * Folder Detail Page - Shows documents in a deal folder
 * Phase 3A Priority 3
 */
import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { dealFolderService, type DealFolder, type FolderProperty } from '../services/dealFolderService';
import { DeleteFolderModal } from '../components/library/DeleteFolderModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';

export const FolderDetail = () => {
  const { folderId } = useParams<{ folderId: string }>();
  const navigate = useNavigate();

  const [folder, setFolder] = useState<DealFolder | null>(null);
  const [properties, setProperties] = useState<FolderProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');

  useEffect(() => {
    loadFolderData();
  }, [folderId]);

  const loadFolderData = async () => {
    if (!folderId) return;

    setLoading(true);
    setError(null);

    try {
      const [folderData, propertiesData] = await Promise.all([
        dealFolderService.getFolder(Number(folderId)),
        dealFolderService.getFolderProperties(Number(folderId)),
      ]);

      setFolder(folderData);
      setProperties(propertiesData);
    } catch (err: any) {
      console.error('Failed to load folder:', err);
      setError(err.response?.data?.detail || 'Failed to load folder');
    } finally {
      setLoading(false);
    }
  };

  // Handle folder deletion success
  const handleFolderDeleted = () => {
    navigate('/library');
  };

  // Handle rename
  const startEdit = () => {
    if (folder) {
      setEditedName(folder.folder_name);
      setIsEditingName(true);
    }
  };

  const cancelEdit = () => {
    setIsEditingName(false);
    setEditedName('');
  };

  const saveEdit = async () => {
    if (!folder || !editedName.trim()) return;
    try {
      await dealFolderService.updateFolder(folder.id, { folder_name: editedName.trim() });
      await loadFolderData();
      setIsEditingName(false);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to rename folder');
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto">
        {/* Header Skeleton */}
        <div className="mb-6">
          <Skeleton className="h-4 w-32 mb-4" />
          <div className="flex items-center justify-between mb-4">
            <div className="flex-1">
              <Skeleton className="h-10 w-64 mb-2" />
              <Skeleton className="h-4 w-40" />
            </div>
            <div className="flex space-x-3">
              <Skeleton className="h-10 w-32" />
              <Skeleton className="h-10 w-40" />
            </div>
          </div>
          <Skeleton className="h-20 w-full" />
        </div>

        {/* Document List Skeleton */}
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center space-x-3">
                      <Skeleton className="h-6 w-48" />
                      <Skeleton className="h-5 w-16" />
                    </div>
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                  </div>
                  <Skeleton className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error || !folder) {
    return (
      <div className="max-w-4xl mx-auto">
        <Alert variant="destructive">
          <AlertDescription>
            <div className="space-y-2">
              <p className="font-semibold">Error Loading Folder</p>
              <p>{error || 'Folder not found'}</p>
              <Link
                to="/library"
                className="inline-block text-sm font-medium hover:underline"
              >
                ← Back to Library
              </Link>
            </div>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          to="/library"
          className="inline-flex items-center text-sm font-medium text-emerald-600 hover:text-emerald-700 mb-4"
        >
          <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Library
        </Link>

        <div className="flex items-center justify-between">
          <div className="flex-1">
            {isEditingName ? (
              <div className="flex items-center space-x-2">
                <Input
                  type="text"
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' ? saveEdit() : e.key === 'Escape' && cancelEdit()}
                  className="text-3xl font-bold"
                  autoFocus
                />
                <Button size="sm" onClick={saveEdit}>
                  Save
                </Button>
                <Button size="sm" variant="outline" onClick={cancelEdit}>
                  Cancel
                </Button>
              </div>
            ) : (
              <h1 className="text-3xl font-bold cursor-pointer hover:text-primary" onClick={startEdit}>
                {folder.folder_name}
              </h1>
            )}
            <p className="mt-1 text-sm text-muted-foreground">
              {folder.document_count} {folder.document_count === 1 ? 'document' : 'documents'}
              {folder.property_type && ` • ${folder.property_type}`}
            </p>
          </div>

          <div className="flex space-x-3">
            <Button
              variant="destructive"
              onClick={() => setIsDeleteModalOpen(true)}
            >
              Delete Folder
            </Button>
            <Button asChild>
              <Link to="/upload">
                + Upload Document
              </Link>
            </Button>
          </div>
        </div>

        {/* Folder Info */}
        {(folder.property_address || folder.submarket || folder.total_units) && (
          <Card className="mt-4">
            <CardContent className="pt-6">
              <div className="grid grid-cols-3 gap-4 text-sm">
                {folder.property_address && (
                  <div>
                    <span className="font-medium text-muted-foreground">Address:</span>{' '}
                    <span className="text-foreground">{folder.property_address}</span>
                  </div>
                )}
                {folder.submarket && (
                  <div>
                    <span className="font-medium text-muted-foreground">Submarket:</span>{' '}
                    <span className="text-foreground">{folder.submarket}</span>
                  </div>
                )}
                {folder.total_units && (
                  <div>
                    <span className="font-medium text-muted-foreground">Units:</span>{' '}
                    <span className="text-foreground">{folder.total_units.toLocaleString()}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Documents List */}
      {properties.length === 0 ? (
        <Card className="text-center p-12">
          <svg
            className="h-12 w-12 mx-auto text-muted-foreground mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <h3 className="text-lg font-medium mb-2">No documents yet</h3>
          <p className="text-muted-foreground mb-4">Upload your first document to get started</p>
          <Button asChild>
            <Link to="/upload">
              Upload Document
            </Link>
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {properties.map((property) => (
            <Link key={property.id} to={`/library/${property.id}`}>
              <Card className="hover:shadow-lg transition-all cursor-pointer hover:border-primary">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-lg font-semibold">{property.deal_name}</h3>
                        {property.document_subtype && (
                          <Badge variant="default">{property.document_subtype}</Badge>
                        )}
                        {property.document_type && (
                          <Badge variant="secondary">{property.document_type}</Badge>
                        )}
                      </div>

                      <div className="grid grid-cols-3 gap-4 text-sm text-muted-foreground">
                        {property.property_type && (
                          <div>
                            <span className="font-medium">Type:</span> {property.property_type}
                          </div>
                        )}
                        {property.property_address && (
                          <div className="col-span-2">
                            <span className="font-medium">Address:</span> {property.property_address}
                          </div>
                        )}
                      </div>

                      {(property.t12_noi || property.y1_noi) && (
                        <div className="mt-3 flex items-center space-x-4 text-sm">
                          {property.t12_noi && (
                            <div>
                              <span className="text-muted-foreground">T12 NOI:</span>{' '}
                              <span className="font-semibold">
                                ${property.t12_noi.toLocaleString()}
                              </span>
                            </div>
                          )}
                          {property.y1_noi && (
                            <div>
                              <span className="text-muted-foreground">Y1 NOI:</span>{' '}
                              <span className="font-semibold">
                                ${property.y1_noi.toLocaleString()}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <svg
                      className="h-5 w-5 text-muted-foreground"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Delete Folder Modal */}
      {folder && (
        <DeleteFolderModal
          isOpen={isDeleteModalOpen}
          folderName={folder.folder_name}
          folderId={folder.id}
          documentCount={folder.document_count}
          onClose={() => setIsDeleteModalOpen(false)}
          onSuccess={handleFolderDeleted}
        />
      )}
    </div>
  );
};
