/**
 * ComparisonPage — Property comparison workspace (V4 Liquid Glass)
 * "The Deal Decision Accelerator"
 *
 * Decomposed orchestrator: all logic lives in useComparison hook
 * and dedicated subcomponents.
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { exportComparisonToCSV } from '@/utils/csvExport';
import { DealScoreModal } from '@/components/scoring/DealScoreModal';
import { ComparisonSkeleton } from '@/components/ui/PageSkeleton';
import { SlowLoadBanner } from '@/components/common/SlowLoadBanner';

// Hook
import { useComparison } from '@/hooks/useComparison';

// Types
import type { ViewMode, DeepViewMode, NormalizationMode, SortConfig } from '@/components/comparison/types';

// Subcomponents
import { ComparisonToolbar } from '@/components/comparison/ComparisonToolbar';
import { PresetSelector } from '@/components/comparison/PresetSelector';
import { PropertyPicker } from '@/components/comparison/PropertyPicker';
import { DealScoreCard } from '@/components/comparison/DealScoreCard';
import { MetricBars } from '@/components/comparison/MetricBars';
import { SensitivityPanel } from '@/components/comparison/SensitivityPanel';
import { CategoryLeaders } from '@/components/comparison/CategoryLeaders';
import { RecommendationPanel } from '@/components/comparison/RecommendationPanel';
import { RadarChart } from '@/components/comparison/RadarChart';
import { ComparisonDataTable } from '@/components/comparison/ComparisonDataTable';
import { SummaryStatsStrip } from '@/components/comparison/SummaryStatsStrip';
import { ScatterPlot } from '@/components/comparison/ScatterPlot';
import { SaveComparisonModal } from '@/components/comparison/SaveComparisonModal';
import { InvestmentCriteriaPanel } from '@/components/comparison/InvestmentCriteriaPanel';

// ============================================================
// ComparisonPage
// ============================================================

export const ComparisonPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Data hook
  const comp = useComparison();

  // Local UI state
  const [viewMode, setViewMode] = useState<ViewMode>('quick');
  const [deepViewMode, setDeepViewMode] = useState<DeepViewMode>('table');
  const [hoveredPropertyId, setHoveredPropertyId] = useState<number | null>(null);
  const [sensitivityCapRate, setSensitivityCapRate] = useState(5.15);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [normalizationMode, setNormalizationMode] = useState<NormalizationMode>('absolute');
  const [subjectId, setSubjectId] = useState<number | null>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  const [animated, setAnimated] = useState(false);

  // Trigger animation after mount
  useEffect(() => {
    const timer = setTimeout(() => setAnimated(true), 150);
    return () => clearTimeout(timer);
  }, []);

  // Initialize subject from URL
  useEffect(() => {
    const subjectParam = searchParams.get('subject');
    if (subjectParam) {
      const id = parseInt(subjectParam, 10);
      if (!isNaN(id)) setSubjectId(id);
    }
  }, [searchParams]);

  // Persist subject to URL
  const handleSetSubject = useCallback((id: number) => {
    const newSubject = subjectId === id ? null : id;
    setSubjectId(newSubject);
    const params = new URLSearchParams(searchParams);
    if (newSubject) {
      params.set('subject', String(newSubject));
    } else {
      params.delete('subject');
    }
    setSearchParams(params, { replace: true });
  }, [subjectId, searchParams, setSearchParams]);

  // Load saved comparison
  const handleLoadComparison = useCallback((ids: number[], savedSubjectId?: number) => {
    const params = new URLSearchParams();
    params.set('ids', ids.join(','));
    if (savedSubjectId) params.set('subject', String(savedSubjectId));
    setSearchParams(params);
  }, [setSearchParams]);

  // CSV export
  const handleExportCSV = () => {
    if (comp.data) exportComparisonToCSV(comp.data);
  };

  // Average score for stats strip
  const avgScore = useMemo(() => {
    const scores = comp.scoredProperties.map(sp => sp.score?.total).filter((s): s is number => s != null);
    return scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
  }, [comp.scoredProperties]);

  // Grid cols class
  const gridColsClass = useMemo(() => {
    const count = comp.properties.length;
    const map: Record<number, string> = {
      2: 'grid-cols-1 sm:grid-cols-2',
      3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
      4: 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-4',
      5: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5',
    };
    return map[count] ?? 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-4';
  }, [comp.properties.length]);

  // ============================================================
  // Render
  // ============================================================
  return (
    <AnimatePresence mode="wait">
      {comp.isLoading ? (
        <motion.div key="skeleton" initial={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
          <ComparisonSkeleton />
          <SlowLoadBanner />
        </motion.div>
      ) : comp.showPicker ? (
        <motion.div key="picker" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
          <PropertyPicker
            allProperties={comp.allProperties}
            pickerLoading={comp.pickerLoading}
            pickerSelected={comp.pickerSelected}
            subjectId={subjectId}
            onToggle={comp.togglePicker}
            onSetSubject={handleSetSubject}
            onStartComparison={comp.startComparison}
          />
        </motion.div>
      ) : comp.error ? (
        <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
          <div className="max-w-4xl mx-auto">
            <div className="border border-white/10 rounded-2xl bg-destructive/10 p-6">
              <h2 className="text-lg font-display font-semibold text-white mb-2">Error</h2>
              <p className="text-sm text-zinc-400">{comp.error}</p>
              <button
                onClick={() => navigate('/library')}
                className="mt-4 px-4 py-2.5 rounded-xl bg-white text-black text-sm font-medium hover:bg-zinc-200 transition-colors"
              >
                Back to Library
              </button>
            </div>
          </div>
        </motion.div>
      ) : !comp.data ? null : (
        <motion.div key="content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
          <div className="min-h-full -m-4 lg:-m-6">
            {/* ===== TOOLBAR ===== */}
            <ComparisonToolbar
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              normalizationMode={normalizationMode}
              onNormalizationChange={setNormalizationMode}
              propertyCount={comp.properties.length}
              totalValue={comp.totalValue}
              onSave={() => setShowSaveModal(true)}
              onExport={handleExportCSV}
              onBack={() => navigate(-1)}
              onLoadComparison={handleLoadComparison}
            />

            {/* ===== MAIN CONTENT ===== */}
            <div className="p-6 lg:p-8 space-y-6">
              {/* Preset Selector */}
              <PresetSelector
                selectedPreset={comp.selectedPreset}
                onPresetChange={comp.setSelectedPreset}
              />

              {/* ===== QUICK ANALYSIS VIEW ===== */}
              {viewMode === 'quick' && (
                <div className={cn('transition-opacity duration-500', animated ? 'opacity-100' : 'opacity-0')}>
                  {/* Deal Score Cards */}
                  <div className={cn('grid gap-4 mb-8', gridColsClass)}>
                    {comp.scoredProperties.map((sp, index) => (
                      <DealScoreCard
                        key={sp.property.id}
                        scoredProperty={sp}
                        index={index}
                        animated={animated}
                        isHovered={hoveredPropertyId === sp.property.id}
                        isSubject={sp.property.id === subjectId}
                        apiScore={comp.apiScores[sp.property.id]}
                        currentPreset={comp.currentPreset}
                        onHover={setHoveredPropertyId}
                        onUnhover={() => setHoveredPropertyId(null)}
                        onScoreClick={comp.setScoreModalPropertyId}
                        onSetSubject={handleSetSubject}
                      />
                    ))}
                  </div>

                  {/* Two Column Layout: Bars + Sidebar */}
                  <div className="grid grid-cols-12 gap-6">
                    <div className="col-span-12 lg:col-span-8">
                      <MetricBars
                        properties={comp.properties}
                        preset={comp.currentPreset}
                        animated={animated}
                        hoveredPropertyId={hoveredPropertyId}
                        onHover={setHoveredPropertyId}
                        onUnhover={() => setHoveredPropertyId(null)}
                      />
                    </div>

                    <div className="col-span-12 lg:col-span-4 space-y-6">
                      <SensitivityPanel
                        properties={comp.properties}
                        sensitivityCapRate={sensitivityCapRate}
                        onCapRateChange={setSensitivityCapRate}
                        calculateSensitivity={comp.calculateSensitivity}
                      />
                      <CategoryLeaders
                        properties={comp.properties}
                        preset={comp.currentPreset}
                        onHover={setHoveredPropertyId}
                        onUnhover={() => setHoveredPropertyId(null)}
                      />
                      <RecommendationPanel
                        scoredProperties={comp.scoredProperties}
                        preset={comp.currentPreset}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ===== DEEP ANALYSIS VIEW ===== */}
              {viewMode === 'deep' && (
                <div className="space-y-6">
                  {/* Summary Stats Strip */}
                  <SummaryStatsStrip
                    properties={comp.properties}
                    subjectId={subjectId}
                    avgScore={avgScore}
                  />

                  {/* Deep View Mode Toggle: Table vs Scatter */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setDeepViewMode('table')}
                      className={cn(
                        'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                        deepViewMode === 'table'
                          ? 'bg-white/10 text-white'
                          : 'text-zinc-500 hover:text-zinc-300'
                      )}
                    >
                      Table
                    </button>
                    <button
                      onClick={() => setDeepViewMode('scatter')}
                      className={cn(
                        'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                        deepViewMode === 'scatter'
                          ? 'bg-white/10 text-white'
                          : 'text-zinc-500 hover:text-zinc-300'
                      )}
                    >
                      Scatter
                    </button>
                  </div>

                  {deepViewMode === 'scatter' ? (
                    <ScatterPlot
                      properties={comp.properties}
                      subjectId={subjectId}
                    />
                  ) : (
                    <>
                      {/* Investment Criteria Panel */}
                      <InvestmentCriteriaPanel
                        criteria={comp.criteria}
                        onCriteriaChange={comp.setCriteria}
                      />

                      {/* Radar Chart */}
                      {comp.currentPreset.metrics.length >= 3 && (
                        <div className="liquid-glass p-6">
                          <h3 className="font-display text-lg font-bold text-white mb-4">
                            Multi-Metric Radar
                          </h3>
                          <div className="flex flex-wrap items-center gap-4 mb-4">
                            {comp.scoredProperties.map((sp, idx) => (
                              <div key={sp.property.id} className="flex items-center gap-2">
                                <div
                                  className="w-3 h-3 rounded-full"
                                  style={{
                                    backgroundColor:
                                      (['#ffffff', '#d4d4d8', '#a1a1aa', '#71717a', '#52525b'])[idx % 5],
                                  }}
                                />
                                <span className="text-sm text-white">{sp.property.property_name}</span>
                                <span className={cn(
                                  'font-display text-xs',
                                  (sp.score?.total ?? 0) >= 80 ? 'text-emerald-500' :
                                  (sp.score?.total ?? 0) >= 60 ? 'text-amber-500' : 'text-rose-500'
                                )}>
                                  ({sp.score?.total ?? 0})
                                </span>
                              </div>
                            ))}
                          </div>
                          <RadarChart
                            properties={comp.properties}
                            metrics={comp.currentPreset.metrics}
                            scoresByProperty={comp.scoresByProperty}
                          />
                        </div>
                      )}

                      {/* Data Table */}
                      <ComparisonDataTable
                        properties={comp.properties}
                        scoredProperties={comp.scoredProperties}
                        bestValues={comp.bestValues!}
                        criteria={comp.criteria}
                        rankings={comp.rankings}
                        apiScores={comp.apiScores}
                        hoveredPropertyId={hoveredPropertyId}
                        subjectId={subjectId}
                        normalizationMode={normalizationMode}
                        sortConfig={sortConfig}
                        onSort={setSortConfig}
                        onHover={setHoveredPropertyId}
                        onUnhover={() => setHoveredPropertyId(null)}
                        onScoreClick={comp.setScoreModalPropertyId}
                        onSetSubject={handleSetSubject}
                      />
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Save Comparison Modal */}
            <SaveComparisonModal
              open={showSaveModal}
              onClose={() => setShowSaveModal(false)}
              properties={comp.properties}
              subjectId={subjectId}
              presetKey={comp.selectedPreset}
            />

            {/* Deal Score Modal */}
            <DealScoreModal
              open={comp.scoreModalPropertyId !== null}
              onClose={() => comp.setScoreModalPropertyId(null)}
              scoreData={comp.scoreModalPropertyId ? comp.apiScores[comp.scoreModalPropertyId] ?? null : null}
              propertyName={
                comp.scoreModalPropertyId
                  ? comp.data?.properties.find((p) => p.id === comp.scoreModalPropertyId)?.property_name
                  : undefined
              }
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
