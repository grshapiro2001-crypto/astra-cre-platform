/**
 * DealScoreSettings — Scoring configuration panel for the Settings page
 *
 * Sections:
 * 1. Strategy Presets (4 cards: Value-Add, Cash Flow, Core, Opportunistic)
 * 2. Layer Weight Sliders (3 sliders summing to 100)
 * 3. Metric Weight Sliders for Layer 1 (3 sliders summing to 100)
 * 4. Save / Reset buttons with success toast
 * 5. Live Preview card showing sample score
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Target,
  TrendingUp,
  DollarSign,
  Shield,
  Zap,
  Save,
  RotateCcw,
  Building2,
  BarChart3,
  GitCompare,
  Activity,
  PieChart,
  Truck,
  Check,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import {
  scoringService,
  type ScoringWeights,
  type ScoringPresets,
} from '@/services/scoringService';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_LAYER_WEIGHTS = { layer1: 30, layer2: 20, layer3: 50 };
const DEFAULT_METRIC_WEIGHTS = { economic_occupancy: 35, opex_ratio: 30, supply_pipeline: 35 };

interface PresetConfig {
  key: string;
  name: string;
  description: string;
  icon: typeof Target;
  color: string;
}

const PRESET_CARDS: PresetConfig[] = [
  {
    key: 'value_add',
    name: 'Value-Add',
    description: 'Maximize upside through renovations & repositioning',
    icon: TrendingUp,
    color: 'text-purple-400',
  },
  {
    key: 'cash_flow',
    name: 'Cash Flow',
    description: 'Prioritize stable, income-producing properties',
    icon: DollarSign,
    color: 'text-emerald-400',
  },
  {
    key: 'core',
    name: 'Core',
    description: 'Low-risk, stabilized assets in prime locations',
    icon: Shield,
    color: 'text-blue-400',
  },
  {
    key: 'opportunistic',
    name: 'Opportunistic',
    description: 'High-risk, high-return distressed & development deals',
    icon: Zap,
    color: 'text-amber-400',
  },
];

interface LayerConfig {
  key: 'layer1' | 'layer2' | 'layer3';
  name: string;
  icon: typeof Building2;
  description: string;
}

const LAYER_CONFIGS: LayerConfig[] = [
  {
    key: 'layer1',
    name: 'Property Fundamentals',
    icon: Building2,
    description: 'Occupancy, expenses & physical condition',
  },
  {
    key: 'layer2',
    name: 'Market Intelligence',
    icon: BarChart3,
    description: 'Submarket trends, rent growth & demand',
  },
  {
    key: 'layer3',
    name: 'Deal Comp Analysis',
    icon: GitCompare,
    description: 'Comparable sales, cap rates & pricing',
  },
];

interface MetricConfig {
  key: 'economic_occupancy' | 'opex_ratio' | 'supply_pipeline';
  name: string;
  icon: typeof Activity;
}

const METRIC_CONFIGS: MetricConfig[] = [
  { key: 'economic_occupancy', name: 'Economic Occupancy', icon: Activity },
  { key: 'opex_ratio', name: 'OpEx Ratio', icon: PieChart },
  { key: 'supply_pipeline', name: 'Supply Pipeline Pressure', icon: Truck },
];

// ---------------------------------------------------------------------------
// Redistribution helper: when one slider moves, redistribute across others
// ---------------------------------------------------------------------------

function redistributeWeights<K extends string>(
  weights: Record<K, number>,
  changedKey: K,
  newValue: number,
  keys: K[],
): Record<K, number> {
  const result = { ...weights };
  const oldValue = weights[changedKey];
  const delta = newValue - oldValue;

  if (delta === 0) return result;

  result[changedKey] = newValue;

  const otherKeys = keys.filter((k) => k !== changedKey);
  const otherSum = otherKeys.reduce((sum, k) => sum + weights[k], 0);

  if (otherSum === 0) {
    // If other sliders are 0, split equally
    const share = Math.round(-delta / otherKeys.length);
    otherKeys.forEach((k, i) => {
      result[k] = i === otherKeys.length - 1
        ? 100 - newValue - otherKeys.slice(0, -1).reduce((s, ok) => s + result[ok], 0)
        : Math.max(0, share);
    });
  } else {
    // Redistribute proportionally
    let remaining = 100 - newValue;
    otherKeys.forEach((k, i) => {
      if (i === otherKeys.length - 1) {
        result[k] = Math.max(0, remaining);
      } else {
        const proportion = weights[k] / otherSum;
        const adjusted = Math.max(0, Math.round(remaining * proportion));
        result[k] = adjusted;
        remaining -= adjusted;
      }
    });
  }

  return result;
}

// ---------------------------------------------------------------------------
// Sample score computation for the live preview
// ---------------------------------------------------------------------------

function computeSampleScore(
  layerWeights: { layer1: number; layer2: number; layer3: number },
  metricWeights: { economic_occupancy: number; opex_ratio: number; supply_pipeline: number },
): number {
  // Sample raw scores for a hypothetical property
  const sampleLayerScores = { layer1: 72, layer2: 65, layer3: 81 };

  // Weighted total using layer weights
  const total =
    (sampleLayerScores.layer1 * layerWeights.layer1 +
      sampleLayerScores.layer2 * layerWeights.layer2 +
      sampleLayerScores.layer3 * layerWeights.layer3) /
    100;

  // Slight influence from metric weights to make preview responsive
  const metricBias =
    (metricWeights.economic_occupancy * 0.02 -
      metricWeights.opex_ratio * 0.01 +
      metricWeights.supply_pipeline * 0.01);

  return Math.min(100, Math.max(0, Math.round(total + metricBias)));
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SuccessToast({ message, visible }: { message: string; visible: boolean }) {
  return (
    <div
      className={cn(
        'fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl bg-card border border-primary/30 px-5 py-3 shadow-lg shadow-primary/10 transition-all duration-300',
        visible
          ? 'translate-y-0 opacity-100'
          : 'translate-y-4 opacity-0 pointer-events-none'
      )}
    >
      <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
        <Check className="w-3.5 h-3.5 text-primary" />
      </div>
      <span className="text-sm font-medium text-foreground">{message}</span>
    </div>
  );
}

function PresetCard({
  preset,
  isActive,
  onClick,
  loading,
}: {
  preset: PresetConfig;
  isActive: boolean;
  onClick: () => void;
  loading: boolean;
}) {
  const Icon = preset.icon;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className={cn(
        'relative flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-all duration-200 cursor-pointer',
        isActive
          ? 'border-primary bg-primary/5 shadow-md shadow-primary/10 ring-1 ring-primary/30'
          : 'border-border bg-card hover:border-primary/30 hover:bg-primary/[0.02]'
      )}
    >
      {isActive && (
        <div className="absolute top-2.5 right-2.5">
          <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
            <Check className="w-3 h-3 text-primary-foreground" />
          </div>
        </div>
      )}
      <div
        className={cn(
          'w-9 h-9 rounded-lg flex items-center justify-center',
          isActive ? 'bg-primary/15' : 'bg-muted'
        )}
      >
        <Icon className={cn('w-4.5 h-4.5', isActive ? 'text-primary' : preset.color)} />
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground">{preset.name}</p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
          {preset.description}
        </p>
      </div>
    </button>
  );
}

function WeightSlider({
  label,
  icon: Icon,
  description,
  value,
  onChange,
}: {
  label: string;
  icon: typeof Building2;
  description?: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">{label}</p>
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
          </div>
        </div>
        <span className="font-mono text-lg font-bold text-primary tabular-nums min-w-[3ch] text-right">
          {value}%
        </span>
      </div>
      <Slider
        value={[value]}
        min={0}
        max={100}
        step={1}
        onValueChange={([v]) => onChange(v)}
      />
    </div>
  );
}

function LivePreview({
  score,
  layerWeights,
}: {
  score: number;
  layerWeights: { layer1: number; layer2: number; layer3: number };
}) {
  const circumference = 2 * Math.PI * 36;
  const dashOffset = circumference - (circumference * score) / 100;

  function getColor(s: number) {
    if (s >= 70) return { text: 'text-green-400', stroke: '#4ade80' };
    if (s >= 40) return { text: 'text-yellow-400', stroke: '#facc15' };
    return { text: 'text-red-400', stroke: '#f87171' };
  }

  const color = getColor(score);

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Target className="w-4 h-4 text-primary" />
        <h4 className="text-sm font-semibold text-foreground">Live Preview</h4>
        <Badge className="bg-primary/10 text-primary border-primary/20 text-2xs ml-auto">
          Sample Property
        </Badge>
      </div>

      <div className="flex items-center gap-5">
        {/* Score ring */}
        <div className="relative shrink-0">
          <svg width={88} height={88} className="transform -rotate-90">
            <circle
              cx={44}
              cy={44}
              r={36}
              fill="none"
              stroke="hsl(var(--border))"
              strokeWidth={4}
            />
            <circle
              cx={44}
              cy={44}
              r={36}
              fill="none"
              stroke={color.stroke}
              strokeWidth={4}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              className="transition-[stroke-dashoffset] duration-500 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={cn('font-mono text-xl font-bold', color.text)}>
              {score}
            </span>
          </div>
        </div>

        {/* Breakdown */}
        <div className="flex-1 space-y-2">
          {LAYER_CONFIGS.map((layer) => {
            const sampleScores = { layer1: 72, layer2: 65, layer3: 81 };
            const raw = sampleScores[layer.key];
            const weight = layerWeights[layer.key];
            const contribution = Math.round((raw * weight) / 100);

            return (
              <div key={layer.key} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{layer.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground font-mono">{weight}%</span>
                  <span className="text-foreground font-mono font-medium">+{contribution}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function DealScoreSettings() {
  // State
  const [layerWeights, setLayerWeights] = useState(DEFAULT_LAYER_WEIGHTS);
  const [metricWeights, setMetricWeights] = useState(DEFAULT_METRIC_WEIGHTS);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [isCustom, setIsCustom] = useState(false);
  const [presets, setPresets] = useState<ScoringPresets | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [applyingPreset, setApplyingPreset] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; visible: boolean }>({
    message: '',
    visible: false,
  });
  const [hasChanges, setHasChanges] = useState(false);
  const savedWeightsRef = useRef<ScoringWeights | null>(null);

  // Show toast helper
  const showToast = useCallback((message: string) => {
    setToast({ message, visible: true });
    setTimeout(() => setToast((t) => ({ ...t, visible: false })), 3000);
  }, []);

  // Check if current weights match any preset
  const checkPresetMatch = useCallback(
    (
      layers: typeof layerWeights,
      metrics: typeof metricWeights,
      presetData: ScoringPresets | null,
    ): string | null => {
      if (!presetData) return null;

      for (const [name, values] of Object.entries(presetData)) {
        if (
          values.layer1_weight === layers.layer1 / 100 &&
          values.layer2_weight === layers.layer2 / 100 &&
          values.layer3_weight === layers.layer3 / 100 &&
          values.economic_occupancy_weight === metrics.economic_occupancy / 100 &&
          values.opex_ratio_weight === metrics.opex_ratio / 100 &&
          values.supply_pipeline_weight === metrics.supply_pipeline / 100
        ) {
          return name;
        }
      }
      return null;
    },
    [],
  );

  // Check if weights differ from saved
  const checkHasChanges = useCallback(
    (layers: typeof layerWeights, metrics: typeof metricWeights) => {
      const saved = savedWeightsRef.current;
      if (!saved) return false;
      return (
        Math.round(saved.layer1_weight * 100) !== layers.layer1 ||
        Math.round(saved.layer2_weight * 100) !== layers.layer2 ||
        Math.round(saved.layer3_weight * 100) !== layers.layer3 ||
        Math.round(saved.economic_occupancy_weight * 100) !== metrics.economic_occupancy ||
        Math.round(saved.opex_ratio_weight * 100) !== metrics.opex_ratio ||
        Math.round(saved.supply_pipeline_weight * 100) !== metrics.supply_pipeline
      );
    },
    [],
  );

  // Load weights and presets on mount
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [weights, presetsData] = await Promise.all([
          scoringService.getWeights(),
          scoringService.getPresets(),
        ]);

        if (cancelled) return;

        savedWeightsRef.current = weights;
        setPresets(presetsData);

        const layers = {
          layer1: Math.round(weights.layer1_weight * 100),
          layer2: Math.round(weights.layer2_weight * 100),
          layer3: Math.round(weights.layer3_weight * 100),
        };
        const metrics = {
          economic_occupancy: Math.round(weights.economic_occupancy_weight * 100),
          opex_ratio: Math.round(weights.opex_ratio_weight * 100),
          supply_pipeline: Math.round(weights.supply_pipeline_weight * 100),
        };

        setLayerWeights(layers);
        setMetricWeights(metrics);

        if (weights.preset_name) {
          setActivePreset(weights.preset_name);
          setIsCustom(false);
        } else {
          const matched = checkPresetMatch(layers, metrics, presetsData);
          setActivePreset(matched);
          setIsCustom(!matched);
        }
      } catch {
        // If API is unavailable, use defaults
        setLayerWeights(DEFAULT_LAYER_WEIGHTS);
        setMetricWeights(DEFAULT_METRIC_WEIGHTS);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [checkPresetMatch]);

  // Handle layer weight change
  const handleLayerChange = (key: 'layer1' | 'layer2' | 'layer3', value: number) => {
    const keys: ('layer1' | 'layer2' | 'layer3')[] = ['layer1', 'layer2', 'layer3'];
    const newWeights = redistributeWeights(layerWeights, key, value, keys);
    setLayerWeights(newWeights);

    const matched = checkPresetMatch(newWeights, metricWeights, presets);
    setActivePreset(matched);
    setIsCustom(!matched);
    setHasChanges(checkHasChanges(newWeights, metricWeights));
  };

  // Handle metric weight change
  const handleMetricChange = (
    key: 'economic_occupancy' | 'opex_ratio' | 'supply_pipeline',
    value: number,
  ) => {
    const keys: ('economic_occupancy' | 'opex_ratio' | 'supply_pipeline')[] = [
      'economic_occupancy',
      'opex_ratio',
      'supply_pipeline',
    ];
    const newWeights = redistributeWeights(metricWeights, key, value, keys);
    setMetricWeights(newWeights);

    const matched = checkPresetMatch(layerWeights, newWeights, presets);
    setActivePreset(matched);
    setIsCustom(!matched);
    setHasChanges(checkHasChanges(layerWeights, newWeights));
  };

  // Apply a preset
  const handleApplyPreset = async (presetKey: string) => {
    if (applyingPreset) return;

    setApplyingPreset(presetKey);
    try {
      const weights = await scoringService.applyPreset(presetKey);
      savedWeightsRef.current = weights;

      const layers = {
        layer1: Math.round(weights.layer1_weight * 100),
        layer2: Math.round(weights.layer2_weight * 100),
        layer3: Math.round(weights.layer3_weight * 100),
      };
      const metrics = {
        economic_occupancy: Math.round(weights.economic_occupancy_weight * 100),
        opex_ratio: Math.round(weights.opex_ratio_weight * 100),
        supply_pipeline: Math.round(weights.supply_pipeline_weight * 100),
      };

      setLayerWeights(layers);
      setMetricWeights(metrics);
      setActivePreset(presetKey);
      setIsCustom(false);
      setHasChanges(false);

      const presetName = PRESET_CARDS.find((p) => p.key === presetKey)?.name ?? presetKey;
      showToast(`${presetName} preset applied`);
    } catch {
      showToast('Failed to apply preset');
    } finally {
      setApplyingPreset(null);
    }
  };

  // Save weights
  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: Partial<ScoringWeights> = {
        layer1_weight: layerWeights.layer1 / 100,
        layer2_weight: layerWeights.layer2 / 100,
        layer3_weight: layerWeights.layer3 / 100,
        economic_occupancy_weight: metricWeights.economic_occupancy / 100,
        opex_ratio_weight: metricWeights.opex_ratio / 100,
        supply_pipeline_weight: metricWeights.supply_pipeline / 100,
      };

      const updated = await scoringService.updateWeights(payload);
      savedWeightsRef.current = updated;
      setHasChanges(false);

      if (updated.preset_name) {
        setActivePreset(updated.preset_name);
        setIsCustom(false);
      }

      showToast('Scoring weights saved successfully');
    } catch {
      showToast('Failed to save weights');
    } finally {
      setSaving(false);
    }
  };

  // Reset to defaults
  const handleReset = () => {
    setLayerWeights(DEFAULT_LAYER_WEIGHTS);
    setMetricWeights(DEFAULT_METRIC_WEIGHTS);
    setActivePreset(null);
    setIsCustom(true);
    setHasChanges(checkHasChanges(DEFAULT_LAYER_WEIGHTS, DEFAULT_METRIC_WEIGHTS));
  };

  // Compute live preview score (debounced via state dependency)
  const previewScore = computeSampleScore(layerWeights, metricWeights);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-48 bg-muted rounded-lg" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-muted rounded-xl" />
          ))}
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-muted rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-display text-lg font-semibold text-foreground">
              Deal Score Configuration
            </h3>
            {isCustom && (
              <Badge className="bg-primary/10 text-primary border-primary/20 text-2xs">
                Custom
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Adjust how deals are scored to match your investment strategy
          </p>
        </div>
      </div>

      {/* 1. Strategy Presets */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Target className="w-4 h-4 text-primary" />
          Strategy Presets
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {PRESET_CARDS.map((preset) => (
            <PresetCard
              key={preset.key}
              preset={preset}
              isActive={activePreset === preset.key}
              onClick={() => handleApplyPreset(preset.key)}
              loading={applyingPreset === preset.key}
            />
          ))}
        </div>
      </div>

      {/* 2. Layer Weights */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" />
            Layer Weights
          </h4>
          <span className="text-xs text-muted-foreground font-mono">
            Total: <span className="text-foreground font-semibold">{layerWeights.layer1 + layerWeights.layer2 + layerWeights.layer3}%</span>
          </span>
        </div>

        <div className="rounded-xl border border-border bg-card/50 p-5 space-y-5">
          {LAYER_CONFIGS.map((layer) => (
            <WeightSlider
              key={layer.key}
              label={layer.name}
              icon={layer.icon}
              description={layer.description}
              value={layerWeights[layer.key]}
              onChange={(v) => handleLayerChange(layer.key, v)}
            />
          ))}
        </div>
      </div>

      {/* 3. Metric Weights (Layer 1: Property Fundamentals) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary" />
            Property Fundamentals — Metric Weights
          </h4>
          <span className="text-xs text-muted-foreground font-mono">
            Total: <span className="text-foreground font-semibold">{metricWeights.economic_occupancy + metricWeights.opex_ratio + metricWeights.supply_pipeline}%</span>
          </span>
        </div>

        <div className="rounded-xl border border-border bg-card/50 p-5 space-y-5">
          {METRIC_CONFIGS.map((metric) => (
            <WeightSlider
              key={metric.key}
              label={metric.name}
              icon={metric.icon}
              value={metricWeights[metric.key]}
              onChange={(v) => handleMetricChange(metric.key, v)}
            />
          ))}
        </div>
      </div>

      {/* 4. Live Preview */}
      <LivePreview score={previewScore} layerWeights={layerWeights} />

      {/* 5. Save / Reset */}
      <div className="flex items-center gap-3">
        <Button
          onClick={handleSave}
          disabled={saving || !hasChanges}
          className="gap-2"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          Save Weights
        </Button>
        <Button
          variant="outline"
          onClick={handleReset}
          className="gap-2"
        >
          <RotateCcw className="w-4 h-4" />
          Reset to Default
        </Button>
      </div>

      {/* Toast notification */}
      <SuccessToast message={toast.message} visible={toast.visible} />
    </div>
  );
}
