/**
 * ComparisonPage - Property comparison view
 * Phase 3B + Investment Criteria Filtering
 */
import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { comparisonService, type ComparisonResponse } from '../services/comparisonService';
import { ComparisonTable } from '../components/comparison/ComparisonTable';
import { InvestmentCriteriaPanel } from '../components/comparison/InvestmentCriteriaPanel';
import { exportComparisonToCSV } from '../utils/csvExport';
import { Button } from '@/components/ui/button';
import {
  Criterion,
  PropertyRanking,
  rankProperties,
} from '../utils/criteriaEvaluation';

export const ComparisonPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [data, setData] = useState<ComparisonResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Investment Criteria State
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [rankings, setRankings] = useState<Map<number, PropertyRanking>>(new Map());

  useEffect(() => {
    const fetchComparison = async () => {
      const idsParam = searchParams.get('ids');
      if (!idsParam) {
        setError('No properties selected');
        setIsLoading(false);
        return;
      }

      const propertyIds = idsParam.split(',').map(Number).filter(n => !isNaN(n));

      if (propertyIds.length < 2) {
        setError('Please select at least 2 properties');
        setIsLoading(false);
        return;
      }

      if (propertyIds.length > 5) {
        setError('Cannot compare more than 5 properties');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const result = await comparisonService.compareProperties(propertyIds);
        setData(result);
      } catch (err: any) {
        setError(err.response?.data?.detail || 'Failed to load comparison data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchComparison();
  }, [searchParams]);

  // Re-rank whenever criteria or data changes
  useEffect(() => {
    if (!data?.properties) {
      setRankings(new Map());
      return;
    }

    const newRankings = rankProperties(data.properties, criteria);
    setRankings(newRankings);
  }, [data, criteria]);

  const handleExportCSV = () => {
    if (data) {
      exportComparisonToCSV(data);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <svg className="animate-spin h-8 w-8 mx-auto text-emerald-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <p className="mt-2 text-sm text-emerald-600">Loading comparison...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-red-900 mb-2">Error</h2>
          <p className="text-sm text-red-800">{error}</p>
          <Button
            onClick={() => navigate('/library')}
            className="mt-4"
          >
            Back to Library
          </Button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-emerald-900">
            Property Comparison ({data.properties.length} properties)
          </h1>
        </div>

        <div className="flex space-x-3">
          <Button
            variant="outline"
            onClick={handleExportCSV}
          >
            📥 Export to CSV
          </Button>
          <Button
            onClick={() => navigate('/library')}
          >
            Back to Library
          </Button>
        </div>
      </div>

      {/* Investment Criteria Panel */}
      <InvestmentCriteriaPanel
        criteria={criteria}
        onCriteriaChange={setCriteria}
      />

      {/* Comparison Table */}
      <ComparisonTable data={data} criteria={criteria} rankings={rankings} />
    </div>
  );
};
