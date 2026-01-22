import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { propertyService } from '../services/propertyService';
import { PricingAnalysis } from '../components/property/PricingAnalysis';
import { BOVPricingTiers } from '../components/property/BOVPricingTiers';
import type { PropertyDetail as PropertyDetailType, FinancialPeriodData } from '../types/property';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

export const PropertyDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [property, setProperty] = useState<PropertyDetailType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Re-analyze state
  const [showReanalyzeDialog, setShowReanalyzeDialog] = useState(false);
  const [isReanalyzing, setIsReanalyzing] = useState(false);

  // Delete state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch property (NO LLM - just reads from database)
  useEffect(() => {
    const fetchProperty = async () => {
      if (!id) return;

      setIsLoading(true);
      setError(null);

      try {
        const data = await propertyService.getProperty(parseInt(id));
        setProperty(data);
      } catch (err: any) {
        const errorMessage = err.response?.data?.detail || 'Failed to load property. Please try again.';
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProperty();
  }, [id]);

  // Handle re-analyze (EXPLICIT LLM CALL - user explicitly requests)
  const handleReanalyze = async () => {
    if (!id) return;

    setIsReanalyzing(true);

    try {
      const updatedProperty = await propertyService.reanalyzeProperty(parseInt(id));
      setProperty(updatedProperty);
      setShowReanalyzeDialog(false);
      alert('Property re-analyzed successfully!');
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || 'Re-analysis failed. Please try again.';
      alert(`Re-analysis failed: ${errorMessage}`);
    } finally {
      setIsReanalyzing(false);
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (!id) return;

    setIsDeleting(true);

    try {
      await propertyService.deleteProperty(parseInt(id));
      navigate('/library');
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || 'Delete failed. Please try again.';
      alert(`Delete failed: ${errorMessage}`);
      setIsDeleting(false);
    }
  };

  const formatCurrency = (value?: number | null): string => {
    if (value == null) return 'N/A';
    return `$${Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const formatNumber = (value?: number | null): string => {
    if (value == null) return 'N/A';
    return value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  };

  const formatYear = (value?: number | null): string => {
    if (value == null) return 'N/A';
    return value.toString();
  };

  const formatPercentage = (value?: number | null): string => {
    if (value == null) return 'N/A';
    return `${value.toFixed(2)}%`;
  };

  const formatDate = (dateString?: string | null): string => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header Skeleton */}
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-64" />
          <div className="flex space-x-3">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-24" />
          </div>
        </div>

        {/* Metadata Banner Skeleton */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
            </div>
          </CardContent>
        </Card>

        {/* Tabs Skeleton */}
        <Card>
          <CardHeader>
            <div className="flex space-x-4">
              <Skeleton className="h-10 w-24" />
              <Skeleton className="h-10 w-24" />
              <Skeleton className="h-10 w-24" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Skeleton className="h-6 w-48 mb-4" />
              <div className="grid grid-cols-3 gap-4">
                {[...Array(6)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !property) {
    return (
      <div className="max-w-5xl mx-auto space-y-4">
        <Alert variant="destructive">
          <AlertDescription>
            <div className="space-y-2">
              <p className="font-semibold">Error Loading Property</p>
              <p>{error || 'Property not found'}</p>
            </div>
          </AlertDescription>
        </Alert>
        <Button
          onClick={() => navigate('/library')}
        >
          Back to Library
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header with Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">{property.deal_name}</h1>
          <div className="flex items-center gap-2">
            <Badge>{property.document_type}</Badge>
            {property.document_subtype && (
              <Badge variant="secondary">{property.document_subtype}</Badge>
            )}
          </div>
        </div>
        <div className="flex space-x-3">
          <Button
            variant="outline"
            onClick={() => navigate('/library')}
          >
            ← Back to Library
          </Button>
          <Button
            onClick={() => setShowReanalyzeDialog(true)}
          >
            🔄 Re-analyze
          </Button>
          <Button
            variant="destructive"
            onClick={() => setShowDeleteDialog(true)}
          >
            🗑️ Delete
          </Button>
        </div>
      </div>

      {/* Metadata Banner */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-muted-foreground">Uploaded:</span>{' '}
              <span>{formatDate(property.upload_date?.toString())}</span>
            </div>
            <div>
              <span className="font-medium text-muted-foreground">Analysis Count:</span>{' '}
              <span>{property.analysis_count}</span>
            </div>
            <div className="col-span-2">
              <span className="font-medium text-muted-foreground">Last Analyzed:</span>{' '}
              <span>{formatDate(property.last_analyzed_at?.toString())}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs for Content Sections */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="financials">Financials</TabsTrigger>
          {property.bov_pricing_tiers && property.bov_pricing_tiers.length > 0 && (
            <TabsTrigger value="bov-pricing">BOV Pricing</TabsTrigger>
          )}
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Property Information */}
          <Card>
            <CardHeader>
              <CardTitle>Property Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="border-b pb-2">
                  <label className="text-sm font-medium text-muted-foreground">Property Address</label>
                  <p className="text-lg">{property.property_address || <span className="italic text-muted-foreground">Not available</span>}</p>
                </div>
                <div className="border-b pb-2">
                  <label className="text-sm font-medium text-muted-foreground">Property Type</label>
                  <p className="text-lg">{property.property_type || <span className="italic text-muted-foreground">Not available</span>}</p>
                </div>
                <div className="border-b pb-2">
                  <label className="text-sm font-medium text-muted-foreground">Submarket</label>
                  <p className="text-lg">{property.submarket || <span className="italic text-muted-foreground">Not available</span>}</p>
                </div>
                <div className="border-b pb-2">
                  <label className="text-sm font-medium text-muted-foreground">Year Built</label>
                  <p className="text-lg">{formatYear(property.year_built)}</p>
                </div>
                <div className="border-b pb-2">
                  <label className="text-sm font-medium text-muted-foreground">Total Units</label>
                  <p className="text-lg">{formatNumber(property.total_units)}</p>
                </div>
                <div className="border-b pb-2">
                  <label className="text-sm font-medium text-muted-foreground">Total SF</label>
                  <p className="text-lg">{formatNumber(property.total_residential_sf)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Average Rents */}
          {(property.average_market_rent || property.average_inplace_rent) && (
            <Card>
              <CardHeader>
                <CardTitle>Average Rents</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  {property.average_market_rent && (
                    <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                      <div className="text-sm font-medium text-purple-800">Market Rent</div>
                      <div className="text-2xl font-bold text-purple-900 mt-1">
                        {formatCurrency(property.average_market_rent)}/unit/month
                      </div>
                    </div>
                  )}
                  {property.average_inplace_rent && (
                    <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                      <div className="text-sm font-medium text-green-800">In-Place Rent</div>
                      <div className="text-2xl font-bold text-green-900 mt-1">
                        {formatCurrency(property.average_inplace_rent)}/unit/month
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Financials Tab */}
        <TabsContent value="financials" className="space-y-6">
          {/* Financials */}
          {[
            { key: 't12', data: property.t12_financials, label: 'T12' },
            { key: 't3', data: property.t3_financials, label: 'T3' },
            { key: 'y1', data: property.y1_financials, label: 'Y1' },
          ].map(
            ({ key, data }) =>
              data && (
                <Card key={key}>
                  <CardHeader>
                    <CardTitle>
                      Financials - {data.period_label || key.toUpperCase()}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="border-b pb-2">
                        <label className="text-sm font-medium text-muted-foreground">GSR</label>
                        <p className="text-lg font-medium">{formatCurrency(data.gsr)}</p>
                      </div>
                      <div className="border-b pb-2">
                        <label className="text-sm font-medium text-muted-foreground">Vacancy</label>
                        <p className="text-lg font-medium text-red-600">{formatCurrency(data.vacancy)}</p>
                      </div>
                      <div className="border-b pb-2">
                        <label className="text-sm font-medium text-muted-foreground">Concessions</label>
                        <p className="text-lg font-medium text-red-600">{formatCurrency(data.concessions)}</p>
                      </div>
                      <div className="border-b pb-2">
                        <label className="text-sm font-medium text-muted-foreground">Bad Debt</label>
                        <p className="text-lg font-medium text-red-600">{formatCurrency(data.bad_debt)}</p>
                      </div>
                      <div className="border-b pb-2">
                        <label className="text-sm font-medium text-muted-foreground">Non-Revenue Units</label>
                        <p className="text-lg font-medium text-red-600">{formatCurrency(data.non_revenue_units)}</p>
                      </div>
                      <div className="border-b pb-2">
                        <label className="text-sm font-medium text-muted-foreground">Total OpEx</label>
                        <p className="text-lg font-medium">{formatCurrency(data.total_opex)}</p>
                      </div>
                      <div className="border-b pb-2">
                        <label className="text-sm font-medium text-muted-foreground">NOI</label>
                        <p className="text-lg font-bold">{formatCurrency(data.noi)}</p>
                      </div>
                      {data.opex_ratio && (
                        <div className="border-b pb-2">
                          <label className="text-sm font-medium text-muted-foreground">OpEx Ratio</label>
                          <p className="text-lg font-medium">{formatPercentage(data.opex_ratio)}</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
          )}

          {/* Pricing Analysis Calculator */}
          <PricingAnalysis
            financials_by_period={{
              t12: property.t12_financials,
              t3: property.t3_financials,
              y1: property.y1_financials,
            }}
          />
        </TabsContent>

        {/* BOV Pricing Tab */}
        {property.bov_pricing_tiers && property.bov_pricing_tiers.length > 0 && (
          <TabsContent value="bov-pricing">
            <BOVPricingTiers tiers={property.bov_pricing_tiers} />
          </TabsContent>
        )}
      </Tabs>

      {/* Re-analyze Confirmation Dialog */}
      <Dialog open={showReanalyzeDialog} onOpenChange={setShowReanalyzeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Re-analyze Property?</DialogTitle>
            <DialogDescription>
              This will re-run the Claude API analysis on the original PDF file. This action will use AI credits and may take a few moments.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowReanalyzeDialog(false)}
              disabled={isReanalyzing}
            >
              Cancel
            </Button>
            <Button
              onClick={handleReanalyze}
              disabled={isReanalyzing}
            >
              {isReanalyzing ? 'Re-analyzing...' : 'Re-analyze'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>⚠️ Delete Property?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this property from your library. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete Forever'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
