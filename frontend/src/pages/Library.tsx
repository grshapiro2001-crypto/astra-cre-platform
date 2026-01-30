/**
 * Library Page - Shows deal folders in grid layout
 * Phase 3A Priority 2
 */
import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { dealFolderService, type DealFolder } from '../services/dealFolderService';
import { propertyService, type PropertyListItem } from '../services/propertyService';
import { CreateFolderModal } from '../components/library/CreateFolderModal';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';

export const Library = () => {
  const navigate = useNavigate();

  // State
  const [folders, setFolders] = useState<DealFolder[]>([]);
  const [properties, setProperties] = useState<PropertyListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Comparison mode
  const [comparisonMode, setComparisonMode] = useState(false);
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<number[]>([]);

  // Fetch folders (NO LLM - just reads from database)
  const fetchFolders = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await dealFolderService.listFolders('active');
      setFolders(result);
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || 'Failed to load folders. Please try again.';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFolders();
  }, []);

  // Handle folder creation success
  const handleFolderCreated = () => {
    console.log('✅ Folder created, refreshing list');
    fetchFolders();
  };

  // Fetch properties for comparison mode
  const fetchProperties = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await propertyService.listProperties({});
      setProperties(result.properties);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load properties');
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle comparison mode
  const toggleComparisonMode = () => {
    const newMode = !comparisonMode;
    setComparisonMode(newMode);
    setSelectedPropertyIds([]);
    if (newMode) {
      fetchProperties();
    } else {
      fetchFolders();
    }
  };

  // Toggle property selection
  const togglePropertySelection = (propertyId: number) => {
    setSelectedPropertyIds(prev => {
      if (prev.includes(propertyId)) {
        return prev.filter(id => id !== propertyId);
      } else if (prev.length < 5) {
        return [...prev, propertyId];
      }
      return prev;
    });
  };

  // Handle compare
  const handleCompare = () => {
    if (selectedPropertyIds.length >= 2) {
      navigate(`/compare?ids=${selectedPropertyIds.join(',')}`);
    }
  };

  const formatDate = (dateString?: string): string => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-emerald-900">
            {comparisonMode ? 'Select Properties to Compare' : 'Deal Folders'}
          </h1>
          <p className="mt-1 text-sm text-emerald-600">
            {comparisonMode ? `${selectedPropertyIds.length} selected (max 5)` : 'Organize your properties by deal'}
          </p>
        </div>
        <div className="flex space-x-3">
          {!comparisonMode ? (
            <>
              <Button
                variant="outline"
                onClick={toggleComparisonMode}
              >
                Compare Properties
              </Button>
              <Button
                variant="outline"
                onClick={() => setIsCreateModalOpen(true)}
              >
                + New Deal Folder
              </Button>
              <Button asChild>
                <Link to="/upload">
                  + Upload Document
                </Link>
              </Button>
            </>
          ) : (
            <>
              <Button
                onClick={handleCompare}
                disabled={selectedPropertyIds.length < 2}
              >
                Compare Selected
              </Button>
              <Button
                variant="outline"
                onClick={toggleComparisonMode}
              >
                Cancel
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
              </CardContent>
              <CardFooter className="justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-20" />
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && folders.length === 0 && !error && (
        <Card className="p-12">
          <div className="text-center">
            <svg
              className="mx-auto h-12 w-12 text-muted-foreground"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
              />
            </svg>
            <h3 className="mt-4 text-lg font-semibold">No deal folders yet</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Get started by uploading your first property document
            </p>
            <Button asChild className="mt-6">
              <Link to="/upload">
                Upload Document
              </Link>
            </Button>
          </div>
        </Card>
      )}

      {/* Folder Grid */}
      {!isLoading && !comparisonMode && folders.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {folders.map((folder) => (
            <Link key={folder.id} to={`/folders/${folder.id}`}>
              <Card className="hover:shadow-lg transition-all cursor-pointer hover:border-primary">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <svg
                        className="h-8 w-8 text-primary flex-shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                        />
                      </svg>
                      <div className="flex-1 min-w-0">
                        <CardTitle className="truncate">{folder.folder_name}</CardTitle>
                        {folder.property_type && (
                          <CardDescription className="mt-1">{folder.property_type}</CardDescription>
                        )}
                      </div>
                    </div>
                    {folder.status && folder.status !== 'active' && (
                      <Badge variant="secondary" className="ml-2">{folder.status}</Badge>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="space-y-2">
                  {folder.property_address && (
                    <div className="flex items-start text-sm text-muted-foreground">
                      <svg className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span className="truncate">{folder.property_address}</span>
                    </div>
                  )}

                  {folder.submarket && (
                    <div className="flex items-center text-sm text-muted-foreground">
                      <svg className="h-4 w-4 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                      </svg>
                      <span className="truncate">{folder.submarket}</span>
                    </div>
                  )}

                  {folder.total_units && (
                    <div className="flex items-center text-sm text-muted-foreground">
                      <svg className="h-4 w-4 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                      <span>{folder.total_units.toLocaleString()} units</span>
                    </div>
                  )}
                </CardContent>

                <CardFooter className="flex justify-between text-sm text-muted-foreground">
                  <div className="flex items-center">
                    <svg className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span>{folder.document_count} {folder.document_count === 1 ? 'doc' : 'docs'}</span>
                  </div>
                  <span className="text-xs">{formatDate(folder.last_updated)}</span>
                </CardFooter>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Property List (Comparison Mode) */}
      {!isLoading && comparisonMode && properties.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {properties.map((property) => {
            const isSelected = selectedPropertyIds.includes(property.id);
            const isMaxSelected = selectedPropertyIds.length >= 5;
            const isDisabled = !isSelected && isMaxSelected;

            return (
              <Card
                key={property.id}
                className={`transition-all cursor-pointer ${
                  isSelected
                    ? 'border-primary bg-primary/5'
                    : isDisabled
                    ? 'opacity-50 cursor-not-allowed'
                    : 'hover:border-primary/50 hover:shadow-md'
                }`}
                onClick={() => !isDisabled && togglePropertySelection(property.id)}
              >
                <CardHeader>
                  <div className="flex items-start space-x-3">
                    <Checkbox
                      checked={isSelected}
                      disabled={isDisabled}
                      onCheckedChange={() => togglePropertySelection(property.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg truncate">
                        {property.property_name}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {property.document_type}
                        {property.property_type && ` • ${property.property_type}`}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-2">
                  {property.property_address && (
                    <div className="flex items-start text-sm text-muted-foreground">
                      <svg
                        className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                      <span className="truncate">{property.property_address}</span>
                    </div>
                  )}

                  {property.submarket && (
                    <div className="flex items-center text-sm text-muted-foreground">
                      <svg
                        className="h-4 w-4 mr-2 flex-shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                        />
                      </svg>
                      <span className="truncate">{property.submarket}</span>
                    </div>
                  )}

                  {property.total_units && (
                    <div className="flex items-center text-sm text-muted-foreground">
                      <svg
                        className="h-4 w-4 mr-2 flex-shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                        />
                      </svg>
                      <span>{property.total_units.toLocaleString()} units</span>
                    </div>
                  )}
                </CardContent>

                {isSelected && (
                  <CardFooter className="border-t border-primary/20">
                    <span className="text-sm font-medium text-primary">✓ Selected</span>
                  </CardFooter>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Folder Modal */}
      <CreateFolderModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={handleFolderCreated}
      />
    </div>
  );
};
