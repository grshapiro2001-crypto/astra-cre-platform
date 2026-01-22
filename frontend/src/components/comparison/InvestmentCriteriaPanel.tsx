/**
 * Investment Criteria Panel
 *
 * Collapsible panel for defining and managing investment criteria.
 * Users select metrics and whether higher/lower is better.
 * Properties are ranked and highlighted with gradient colors.
 */
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronUp, X } from 'lucide-react';
import { Criterion, MetricKey, DirectionType, METRIC_CONFIGS } from '@/utils/criteriaEvaluation';

interface InvestmentCriteriaPanelProps {
  criteria: Criterion[];
  onCriteriaChange: (criteria: Criterion[]) => void;
}

export const InvestmentCriteriaPanel = ({
  criteria,
  onCriteriaChange,
}: InvestmentCriteriaPanelProps) => {
  // Collapsible state
  const [isExpanded, setIsExpanded] = useState(true);

  // Form state
  const [selectedMetric, setSelectedMetric] = useState<MetricKey | ''>('');

  // Add criterion with default direction
  const handleAddCriterion = () => {
    if (!selectedMetric) return;

    const config = METRIC_CONFIGS[selectedMetric as MetricKey];
    const newCriterion: Criterion = {
      id: Date.now().toString(),
      metric: selectedMetric as MetricKey,
      label: config.label,
      direction: config.defaultDirection,
    };

    onCriteriaChange([...criteria, newCriterion]);

    // Reset form
    setSelectedMetric('');
  };

  // Toggle direction for a criterion
  const handleToggleDirection = (id: string) => {
    const updated = criteria.map(c =>
      c.id === id
        ? { ...c, direction: (c.direction === 'highest' ? 'lowest' : 'highest') as DirectionType }
        : c
    );
    onCriteriaChange(updated);
  };

  // Remove criterion
  const handleRemoveCriterion = (id: string) => {
    onCriteriaChange(criteria.filter((c) => c.id !== id));
  };

  // Clear all
  const handleClearAll = () => {
    onCriteriaChange([]);
  };

  return (
    <Card className="mb-6">
      <CardHeader className="cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            📊 Highlight Metrics
            {criteria.length > 0 && (
              <Badge variant="secondary">{criteria.length} active</Badge>
            )}
          </CardTitle>
          {isExpanded ? (
            <ChevronUp className="h-5 w-5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-4">
          {/* Active Criteria List */}
          {criteria.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Active Criteria:</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearAll}
                  className="text-destructive hover:text-destructive h-auto py-1"
                >
                  Clear All
                </Button>
              </div>

              <div className="space-y-2">
                {criteria.map((criterion) => (
                  <div
                    key={criterion.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent transition-colors"
                  >
                    <span className="text-sm font-medium">{criterion.label}</span>

                    <div className="flex items-center gap-2">
                      {/* Direction Toggle Button */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleToggleDirection(criterion.id)}
                        className="h-8 px-3"
                      >
                        {criterion.direction === 'highest' ? (
                          <>↑ Highest</>
                        ) : (
                          <>↓ Lowest</>
                        )}
                      </Button>

                      {/* Remove Button */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveCriterion(criterion.id)}
                        className="h-8 w-8 p-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Add Metric Form */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Add Metric:</Label>
            <div className="flex gap-2">
              <Select
                value={selectedMetric}
                onValueChange={(value) => setSelectedMetric(value as MetricKey)}
              >
                <SelectTrigger className="flex-1 bg-background border-border text-foreground">
                  <SelectValue placeholder="Select metric..." />
                </SelectTrigger>
                <SelectContent className="bg-background border-border z-50">
                  {/* Group by category */}
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                    Cap Rates
                  </div>
                  <SelectItem value="going_in_cap">Going-In Cap Rate</SelectItem>
                  <SelectItem value="stabilized_cap">Stabilized Cap Rate</SelectItem>

                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground mt-2">
                    Returns
                  </div>
                  <SelectItem value="levered_irr">Levered IRR</SelectItem>
                  <SelectItem value="unlevered_irr">Unlevered IRR</SelectItem>

                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground mt-2">
                    Pricing
                  </div>
                  <SelectItem value="price_per_unit">Price per Unit</SelectItem>
                  <SelectItem value="price_per_sf">Price per SF</SelectItem>

                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground mt-2">
                    Financials
                  </div>
                  <SelectItem value="noi_growth">NOI Growth</SelectItem>
                </SelectContent>
              </Select>

              <Button onClick={handleAddCriterion} disabled={!selectedMetric}>
                + Add
              </Button>
            </div>
          </div>

          {/* Help Text */}
          <p className="text-xs text-muted-foreground">
            Select metrics to highlight in the comparison. Properties will be ranked and color-coded from best (green) to worst (red).
          </p>
        </CardContent>
      )}
    </Card>
  );
};
