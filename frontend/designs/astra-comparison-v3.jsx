import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * ASTRA CRE - COMPARISON VIEW V3
 * "The Deal Decision Accelerator"
 * 
 * DESIGN PHILOSOPHY:
 * - Quick scan (5 seconds) → Deep analysis (5 minutes)
 * - Deal Scores make decisions objective and defensible
 * - Sensitivity analysis turns static data into interactive models
 * - Works for Broker, Acquisitions, and Asset Management equally
 * 
 * PALETTE: Purple-forward with semantic colors
 * - Primary: Deep Purple (#7C3AED)
 * - Success/Best: Emerald (#10B981)
 * - Warning: Amber (#F59E0B)
 * - Danger/Worst: Rose (#F43F5E)
 * 
 * TYPOGRAPHY:
 * - Display: Syne (bold, architectural)
 * - Body: Instrument Sans (clean, modern)
 * - Data: JetBrains Mono (precision, credibility)
 */

const AstraComparisonV3 = () => {
  // === STATE ===
  const [darkMode, setDarkMode] = useState(true);
  const [viewMode, setViewMode] = useState('quick'); // 'quick' | 'deep'
  const [hoveredProperty, setHoveredProperty] = useState(null);
  const [selectedPreset, setSelectedPreset] = useState('value-add');
  const [showPresetEditor, setShowPresetEditor] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [sensitivityMetric, setSensitivityMetric] = useState('capRate');
  const [sensitivityValue, setSensitivityValue] = useState(5.15);
  const [animationPhase, setAnimationPhase] = useState(0);

  // Animation sequence
  useEffect(() => {
    const timers = [
      setTimeout(() => setAnimationPhase(1), 100),
      setTimeout(() => setAnimationPhase(2), 400),
      setTimeout(() => setAnimationPhase(3), 800),
      setTimeout(() => setAnimationPhase(4), 1200),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  // === THEME ===
  const theme = {
    light: {
      bg: '#FEFCFF',
      bgAlt: '#F8F5FF',
      bgCard: '#FFFFFF',
      bgHover: '#F3EEFF',
      text: '#1A1523',
      textSecondary: '#57546B',
      textMuted: '#8E8BA0',
      primary: '#7C3AED',
      primaryLight: '#A78BFA',
      primaryDark: '#5B21B6',
      primaryGhost: 'rgba(124, 58, 237, 0.08)',
      border: 'rgba(124, 58, 237, 0.12)',
      borderHover: 'rgba(124, 58, 237, 0.3)',
      success: '#10B981',
      successGhost: 'rgba(16, 185, 129, 0.1)',
      warning: '#F59E0B',
      warningGhost: 'rgba(245, 158, 11, 0.1)',
      danger: '#F43F5E',
      dangerGhost: 'rgba(244, 63, 94, 0.1)',
    },
    dark: {
      bg: '#0F0B15',
      bgAlt: '#1A1523',
      bgCard: '#1E1828',
      bgHover: '#2A2438',
      text: '#F5F3FF',
      textSecondary: '#B8B5C7',
      textMuted: '#6B6880',
      primary: '#A78BFA',
      primaryLight: '#C4B5FD',
      primaryDark: '#7C3AED',
      primaryGhost: 'rgba(167, 139, 250, 0.12)',
      border: 'rgba(167, 139, 250, 0.15)',
      borderHover: 'rgba(167, 139, 250, 0.4)',
      success: '#34D399',
      successGhost: 'rgba(52, 211, 153, 0.15)',
      warning: '#FBBF24',
      warningGhost: 'rgba(251, 191, 36, 0.15)',
      danger: '#FB7185',
      dangerGhost: 'rgba(251, 113, 133, 0.15)',
    }
  };
  const t = darkMode ? theme.dark : theme.light;

  // === PROPERTY DATA ===
  const properties = [
    {
      id: 1,
      name: "Carmel Vista",
      city: "McDonough, GA",
      submarket: "Henry County",
      thumbnail: "https://images.unsplash.com/photo-1567496898669-ee935f5f647a?w=400&h=300&fit=crop",
      units: 228,
      totalSF: 225036,
      vintage: 2021,
      totalPrice: 45700000,
      pricePerUnit: 200400,
      pricePerSF: 203,
      goingInCap: 4.12,
      stabilizedCap: 5.24,
      occupancy: 94.2,
      noi: 1882840,
      noiT12: 1850000,
      debtYield: 8.2,
      dscr: 1.45,
      irr: 14.8,
      cashOnCash: 7.2,
      equityMultiple: 1.82,
    },
    {
      id: 2,
      name: "Beacon Station",
      city: "Augusta, GA",
      submarket: "Central Savannah",
      thumbnail: "https://images.unsplash.com/photo-1460317442991-0ec209397118?w=400&h=300&fit=crop",
      units: 221,
      totalSF: 220116,
      vintage: 2019,
      totalPrice: 53600000,
      pricePerUnit: 242500,
      pricePerSF: 243,
      goingInCap: 5.15,
      stabilizedCap: 5.42,
      occupancy: 96.1,
      noi: 2760400,
      noiT12: 2680000,
      debtYield: 9.1,
      dscr: 1.62,
      irr: 16.2,
      cashOnCash: 8.4,
      equityMultiple: 1.95,
    },
    {
      id: 3,
      name: "Creekview Vista",
      city: "LaGrange, GA",
      submarket: "West Georgia",
      thumbnail: "https://images.unsplash.com/photo-1574362848149-11496d93a7c7?w=400&h=300&fit=crop",
      units: 279,
      totalSF: 275094,
      vintage: 2024,
      totalPrice: 55100000,
      pricePerUnit: 197500,
      pricePerSF: 200,
      goingInCap: null, // Lease-up
      stabilizedCap: 5.42,
      occupancy: 78.5, // Lease-up
      noi: null,
      noiT12: null,
      debtYield: 8.8,
      dscr: 1.51,
      irr: 18.5,
      cashOnCash: 4.2, // Lower due to lease-up
      equityMultiple: 2.15,
    },
    {
      id: 4,
      name: "The Overlook",
      city: "Lawrenceville, GA",
      submarket: "Gwinnett County",
      thumbnail: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=400&h=300&fit=crop",
      units: 410,
      totalSF: 411640,
      vintage: 2009,
      totalPrice: 90800000,
      pricePerUnit: 221500,
      pricePerSF: 221,
      goingInCap: 4.75,
      stabilizedCap: 5.82,
      occupancy: 93.8,
      noi: 4313000,
      noiT12: 4180000,
      debtYield: 7.9,
      dscr: 1.38,
      irr: 13.5,
      cashOnCash: 6.8,
      equityMultiple: 1.72,
    },
  ];

  // === METRIC PRESETS ===
  const [metricPresets, setMetricPresets] = useState({
    'value-add': {
      name: 'Value-Add Screen',
      metrics: ['goingInCap', 'pricePerUnit', 'dscr', 'vintage', 'irr'],
      scoring: {
        goingInCap: { weight: 25, target: 5.0, direction: 'higher' },
        pricePerUnit: { weight: 25, target: 200000, direction: 'lower' },
        dscr: { weight: 20, target: 1.25, direction: 'higher' },
        vintage: { weight: 15, target: 2015, direction: 'higher' },
        irr: { weight: 15, target: 15, direction: 'higher' },
      }
    },
    'core-plus': {
      name: 'Core-Plus Analysis',
      metrics: ['occupancy', 'stabilizedCap', 'dscr', 'cashOnCash', 'vintage'],
      scoring: {
        occupancy: { weight: 25, target: 95, direction: 'higher' },
        stabilizedCap: { weight: 25, target: 5.5, direction: 'higher' },
        dscr: { weight: 20, target: 1.4, direction: 'higher' },
        cashOnCash: { weight: 20, target: 8, direction: 'higher' },
        vintage: { weight: 10, target: 2010, direction: 'higher' },
      }
    },
    'broker-comp': {
      name: 'Broker Comp Set',
      metrics: ['totalPrice', 'pricePerUnit', 'pricePerSF', 'goingInCap', 'units'],
      scoring: {
        totalPrice: { weight: 20, target: 50000000, direction: 'neutral' },
        pricePerUnit: { weight: 25, target: 220000, direction: 'neutral' },
        pricePerSF: { weight: 20, target: 220, direction: 'neutral' },
        goingInCap: { weight: 25, target: 5.0, direction: 'higher' },
        units: { weight: 10, target: 250, direction: 'neutral' },
      }
    }
  });

  const currentPreset = metricPresets[selectedPreset];

  // === METRIC DEFINITIONS ===
  const metricDefs = {
    // Property Info (Static)
    name: { label: 'Property', format: v => v, category: 'info' },
    city: { label: 'Location', format: v => v, category: 'info' },
    units: { label: 'Units', format: v => v?.toLocaleString() || '—', category: 'info' },
    vintage: { label: 'Year Built', format: v => v?.toString() || '—', category: 'info' },
    
    // Pricing
    totalPrice: { label: 'Total Price', format: v => v ? `$${(v/1000000).toFixed(1)}M` : '—', category: 'pricing' },
    pricePerUnit: { label: '$/Unit', format: v => v ? `$${(v/1000).toFixed(0)}K` : '—', category: 'pricing' },
    pricePerSF: { label: '$/SF', format: v => v ? `$${v}` : '—', category: 'pricing' },
    
    // Returns
    goingInCap: { label: 'Going-In Cap', format: v => v ? `${v.toFixed(2)}%` : '—', category: 'returns', unit: '%' },
    stabilizedCap: { label: 'Stabilized Cap', format: v => v ? `${v.toFixed(2)}%` : '—', category: 'returns', unit: '%' },
    irr: { label: 'IRR', format: v => v ? `${v.toFixed(1)}%` : '—', category: 'returns', unit: '%' },
    cashOnCash: { label: 'Cash-on-Cash', format: v => v ? `${v.toFixed(1)}%` : '—', category: 'returns', unit: '%' },
    equityMultiple: { label: 'Equity Multiple', format: v => v ? `${v.toFixed(2)}x` : '—', category: 'returns' },
    
    // Debt
    dscr: { label: 'DSCR', format: v => v ? `${v.toFixed(2)}x` : '—', category: 'debt' },
    debtYield: { label: 'Debt Yield', format: v => v ? `${v.toFixed(1)}%` : '—', category: 'debt', unit: '%' },
    
    // Operations
    occupancy: { label: 'Occupancy', format: v => v ? `${v.toFixed(1)}%` : '—', category: 'operations', unit: '%' },
    noi: { label: 'NOI (Pro Forma)', format: v => v ? `$${(v/1000000).toFixed(2)}M` : '—', category: 'operations' },
  };

  // === DEAL SCORE CALCULATION ===
  const calculateDealScore = useCallback((property, preset) => {
    if (!preset?.scoring) return null;
    
    let totalScore = 0;
    let totalWeight = 0;
    const breakdown = {};

    Object.entries(preset.scoring).forEach(([metric, config]) => {
      const value = property[metric];
      if (value === null || value === undefined) {
        breakdown[metric] = { score: 0, weight: config.weight, value: null };
        return;
      }

      let score = 0;
      const { target, direction, weight } = config;

      if (direction === 'higher') {
        // Score based on how much above/below target
        const ratio = value / target;
        score = Math.min(100, Math.max(0, ratio * 80 + 20));
        if (value >= target) score = Math.min(100, 80 + (ratio - 1) * 40);
      } else if (direction === 'lower') {
        const ratio = target / value;
        score = Math.min(100, Math.max(0, ratio * 80 + 20));
        if (value <= target) score = Math.min(100, 80 + (ratio - 1) * 40);
      } else {
        // Neutral - just show relative position
        score = 70; // Baseline
      }

      breakdown[metric] = { score: Math.round(score), weight, value };
      totalScore += score * weight;
      totalWeight += weight;
    });

    return {
      total: totalWeight > 0 ? Math.round(totalScore / totalWeight) : 0,
      breakdown
    };
  }, []);

  // Calculate scores for all properties
  const dealScores = useMemo(() => {
    return properties.map(p => ({
      ...p,
      score: calculateDealScore(p, currentPreset)
    })).sort((a, b) => (b.score?.total || 0) - (a.score?.total || 0));
  }, [properties, currentPreset, calculateDealScore]);

  // === SENSITIVITY CALCULATIONS ===
  const calculateSensitivity = useCallback((property, capRate) => {
    if (!property.noi) return null;
    
    const newPrice = property.noi / (capRate / 100);
    const priceChange = newPrice - property.totalPrice;
    const priceChangePct = (priceChange / property.totalPrice) * 100;
    
    // Simplified IRR adjustment (rough approximation)
    const baseIrr = property.irr || 14;
    const capDiff = capRate - (property.goingInCap || 5);
    const newIrr = baseIrr + (capDiff * 1.5);
    
    // Simplified DSCR adjustment
    const baseDscr = property.dscr || 1.4;
    const newDscr = baseDscr * (property.totalPrice / newPrice);
    
    return {
      originalPrice: property.totalPrice,
      newPrice,
      priceChange,
      priceChangePct,
      originalIrr: property.irr,
      newIrr,
      originalDscr: property.dscr,
      newDscr,
    };
  }, []);

  // === RENDER HELPERS ===
  const getScoreColor = (score) => {
    if (score >= 80) return t.success;
    if (score >= 60) return t.primary;
    if (score >= 40) return t.warning;
    return t.danger;
  };

  const getScoreGhost = (score) => {
    if (score >= 80) return t.successGhost;
    if (score >= 60) return t.primaryGhost;
    if (score >= 40) return t.warningGhost;
    return t.dangerGhost;
  };

  const getRankBadge = (rank) => {
    if (rank === 1) return { icon: '👑', label: '1ST', color: '#FFD700' };
    if (rank === 2) return { icon: '🥈', label: '2ND', color: '#C0C0C0' };
    if (rank === 3) return { icon: '🥉', label: '3RD', color: '#CD7F32' };
    return { icon: '', label: `#${rank}`, color: t.textMuted };
  };

  // Format large currency
  const formatPrice = (num) => {
    if (!num) return '—';
    if (num >= 1000000) return `$${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `$${(num / 1000).toFixed(0)}K`;
    return `$${num}`;
  };

  return (
    <div 
      className="min-h-screen transition-colors duration-500"
      style={{ backgroundColor: t.bg }}
    >
      {/* Fonts & Global Styles */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=Instrument+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&family=JetBrains+Mono:wght@400;500;600&display=swap');
        
        .font-display { font-family: 'Syne', sans-serif; }
        .font-body { font-family: 'Instrument Sans', sans-serif; }
        .font-mono { font-family: 'JetBrains Mono', monospace; }
        
        * { font-family: 'Instrument Sans', sans-serif; }
        
        /* Custom scrollbar */
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { 
          background: ${darkMode ? 'rgba(167, 139, 250, 0.3)' : 'rgba(124, 58, 237, 0.2)'}; 
          border-radius: 3px; 
        }
        ::-webkit-scrollbar-thumb:hover { 
          background: ${darkMode ? 'rgba(167, 139, 250, 0.5)' : 'rgba(124, 58, 237, 0.4)'}; 
        }

        /* Range slider styling */
        input[type="range"] {
          -webkit-appearance: none;
          appearance: none;
          background: transparent;
          cursor: pointer;
        }
        input[type="range"]::-webkit-slider-track {
          height: 6px;
          border-radius: 3px;
          background: ${t.border};
        }
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: ${t.primary};
          margin-top: -7px;
          box-shadow: 0 2px 8px rgba(124, 58, 237, 0.4);
          transition: transform 0.15s ease;
        }
        input[type="range"]::-webkit-slider-thumb:hover {
          transform: scale(1.15);
        }
      `}</style>

      {/* === AMBIENT BACKGROUND === */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {darkMode ? (
          <>
            <motion.div 
              className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] rounded-full"
              style={{ 
                background: 'radial-gradient(circle, rgba(124, 58, 237, 0.15) 0%, transparent 60%)',
                filter: 'blur(100px)'
              }}
              animate={{ 
                scale: [1, 1.1, 1],
                opacity: [0.5, 0.7, 0.5]
              }}
              transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div 
              className="absolute bottom-[-30%] left-[-10%] w-[700px] h-[700px] rounded-full"
              style={{ 
                background: 'radial-gradient(circle, rgba(52, 211, 153, 0.1) 0%, transparent 60%)',
                filter: 'blur(120px)'
              }}
              animate={{ 
                scale: [1, 1.05, 1],
                opacity: [0.3, 0.5, 0.3]
              }}
              transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 3 }}
            />
          </>
        ) : (
          <>
            <div 
              className="absolute top-0 right-0 w-[50%] h-[50%]"
              style={{ 
                background: 'radial-gradient(ellipse at top right, rgba(124, 58, 237, 0.06) 0%, transparent 50%)'
              }}
            />
          </>
        )}
      </div>

      {/* === HEADER === */}
      <header 
        className="sticky top-0 z-50 transition-colors duration-300"
        style={{ 
          backgroundColor: darkMode ? 'rgba(15, 11, 21, 0.85)' : 'rgba(254, 252, 255, 0.85)',
          backdropFilter: 'blur(20px)',
          borderBottom: `1px solid ${t.border}`
        }}
      >
        <div className="max-w-[1800px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Left: Back + Title */}
            <div className="flex items-center gap-4">
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="p-2.5 rounded-xl transition-colors"
                style={{ backgroundColor: t.bgCard, border: `1px solid ${t.border}` }}
              >
                <ArrowLeftIcon className="w-5 h-5" style={{ color: t.textSecondary }} />
              </motion.button>
              
              <div>
                <motion.h1 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="font-display text-2xl font-bold"
                  style={{ color: t.text }}
                >
                  Deal Comparison
                </motion.h1>
                <motion.p 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.1 }}
                  className="text-sm mt-0.5"
                  style={{ color: t.textSecondary }}
                >
                  <span className="font-mono" style={{ color: t.primary }}>{properties.length}</span> properties · 
                  <span className="font-mono ml-1">{formatPrice(properties.reduce((sum, p) => sum + p.totalPrice, 0))}</span> total
                </motion.p>
              </div>
            </div>

            {/* Center: View Toggle */}
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="flex items-center rounded-xl p-1.5"
              style={{ backgroundColor: t.bgAlt, border: `1px solid ${t.border}` }}
            >
              {[
                { id: 'quick', label: 'Quick Analysis', icon: ZapIcon },
                { id: 'deep', label: 'Deep Dive', icon: LayersIcon },
              ].map((mode) => (
                <button
                  key={mode.id}
                  onClick={() => setViewMode(mode.id)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all"
                  style={{ 
                    backgroundColor: viewMode === mode.id ? t.primary : 'transparent',
                    color: viewMode === mode.id ? '#FFFFFF' : t.textSecondary,
                    boxShadow: viewMode === mode.id ? '0 4px 12px rgba(124, 58, 237, 0.3)' : 'none'
                  }}
                >
                  <mode.icon className="w-4 h-4" />
                  {mode.label}
                </button>
              ))}
            </motion.div>

            {/* Right: Actions */}
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="flex items-center gap-3"
            >
              <button 
                onClick={() => setShowSaveModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
                style={{ backgroundColor: t.bgCard, border: `1px solid ${t.border}`, color: t.textSecondary }}
              >
                <BookmarkIcon className="w-4 h-4" />
                Save
              </button>
              
              <button 
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
                style={{ backgroundColor: t.bgCard, border: `1px solid ${t.border}`, color: t.textSecondary }}
              >
                <DownloadIcon className="w-4 h-4" />
                Export
              </button>
              
              <button
                onClick={() => setDarkMode(!darkMode)}
                className="p-2.5 rounded-xl transition-all"
                style={{ backgroundColor: t.bgCard, border: `1px solid ${t.border}`, color: t.textSecondary }}
              >
                {darkMode ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
              </button>
            </motion.div>
          </div>
        </div>
      </header>

      {/* === MAIN CONTENT === */}
      <main className="max-w-[1800px] mx-auto px-6 py-6 relative">
        
        {/* === PRESET SELECTOR === */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: animationPhase >= 1 ? 1 : 0, y: animationPhase >= 1 ? 0 : 20 }}
          className="mb-6"
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: t.textMuted }}>
              Scoring Template
            </h2>
            <button 
              onClick={() => setShowPresetEditor(true)}
              className="text-xs font-medium flex items-center gap-1 transition-colors"
              style={{ color: t.primary }}
            >
              <PlusIcon className="w-3.5 h-3.5" />
              New Template
            </button>
          </div>
          
          <div className="flex items-center gap-2">
            {Object.entries(metricPresets).map(([key, preset]) => (
              <button
                key={key}
                onClick={() => setSelectedPreset(key)}
                className="px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
                style={{ 
                  backgroundColor: selectedPreset === key ? t.primaryGhost : t.bgCard,
                  border: `1px solid ${selectedPreset === key ? t.primary : t.border}`,
                  color: selectedPreset === key ? t.primary : t.textSecondary,
                }}
              >
                {preset.name}
              </button>
            ))}
          </div>
        </motion.div>

        {/* === QUICK ANALYSIS VIEW === */}
        <AnimatePresence mode="wait">
          {viewMode === 'quick' && (
            <motion.div
              key="quick"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              {/* Deal Score Cards */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: animationPhase >= 2 ? 1 : 0, y: animationPhase >= 2 ? 0 : 20 }}
                className="grid gap-4 mb-8"
                style={{ gridTemplateColumns: `repeat(${properties.length}, 1fr)` }}
              >
                {dealScores.map((property, index) => {
                  const rank = index + 1;
                  const badge = getRankBadge(rank);
                  const isHovered = hoveredProperty === property.id;
                  
                  return (
                    <motion.div
                      key={property.id}
                      initial={{ opacity: 0, y: 30 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.08 }}
                      onHoverStart={() => setHoveredProperty(property.id)}
                      onHoverEnd={() => setHoveredProperty(null)}
                      className="relative group cursor-pointer"
                    >
                      {/* Glow */}
                      <motion.div 
                        className="absolute -inset-2 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                        style={{ 
                          background: `radial-gradient(ellipse at center, ${getScoreColor(property.score?.total || 0)}30, transparent 70%)`,
                          filter: 'blur(20px)'
                        }}
                      />
                      
                      <div 
                        className="relative rounded-2xl overflow-hidden transition-all duration-300"
                        style={{ 
                          backgroundColor: t.bgCard,
                          border: `1px solid ${isHovered ? t.borderHover : t.border}`,
                          boxShadow: isHovered ? `0 20px 40px ${t.primary}15` : 'none',
                          transform: isHovered ? 'translateY(-4px)' : 'translateY(0)'
                        }}
                      >
                        {/* Rank Badge */}
                        <div 
                          className="absolute top-3 left-3 z-10 px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1"
                          style={{ 
                            backgroundColor: darkMode ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.9)',
                            backdropFilter: 'blur(8px)',
                            color: badge.color
                          }}
                        >
                          {badge.icon && <span>{badge.icon}</span>}
                          {badge.label}
                        </div>

                        {/* Image */}
                        <div className="relative h-36 overflow-hidden">
                          <motion.img 
                            src={property.thumbnail}
                            alt={property.name}
                            className="w-full h-full object-cover"
                            animate={{ scale: isHovered ? 1.08 : 1 }}
                            transition={{ duration: 0.5 }}
                          />
                          <div 
                            className="absolute inset-0"
                            style={{ 
                              background: `linear-gradient(to top, ${t.bgCard} 0%, ${t.bgCard}80 30%, transparent 60%)`
                            }}
                          />
                        </div>

                        {/* Content */}
                        <div className="p-4 pt-0">
                          {/* Deal Score - Hero Element */}
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <h3 className="font-display text-lg font-bold" style={{ color: t.text }}>
                                {property.name}
                              </h3>
                              <p className="text-xs mt-0.5" style={{ color: t.textMuted }}>
                                {property.city}
                              </p>
                            </div>
                            
                            {/* Score Circle */}
                            <div className="relative">
                              <svg width="56" height="56" className="transform -rotate-90">
                                <circle
                                  cx="28"
                                  cy="28"
                                  r="24"
                                  fill="none"
                                  stroke={t.border}
                                  strokeWidth="4"
                                />
                                <motion.circle
                                  cx="28"
                                  cy="28"
                                  r="24"
                                  fill="none"
                                  stroke={getScoreColor(property.score?.total || 0)}
                                  strokeWidth="4"
                                  strokeLinecap="round"
                                  strokeDasharray={150.8}
                                  initial={{ strokeDashoffset: 150.8 }}
                                  animate={{ 
                                    strokeDashoffset: 150.8 - (150.8 * (property.score?.total || 0) / 100)
                                  }}
                                  transition={{ duration: 1, delay: index * 0.1, ease: "easeOut" }}
                                />
                              </svg>
                              <div className="absolute inset-0 flex items-center justify-center">
                                <span 
                                  className="font-mono text-lg font-bold"
                                  style={{ color: getScoreColor(property.score?.total || 0) }}
                                >
                                  {property.score?.total || 0}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Static Metrics */}
                          <div 
                            className="grid grid-cols-2 gap-3 py-3 mb-3"
                            style={{ borderTop: `1px solid ${t.border}`, borderBottom: `1px solid ${t.border}` }}
                          >
                            <div>
                              <p className="text-[10px] uppercase tracking-wider" style={{ color: t.textMuted }}>Units</p>
                              <p className="font-mono text-base font-semibold" style={{ color: t.text }}>{property.units}</p>
                            </div>
                            <div>
                              <p className="text-[10px] uppercase tracking-wider" style={{ color: t.textMuted }}>Vintage</p>
                              <p className="font-mono text-base font-semibold" style={{ color: t.text }}>{property.vintage}</p>
                            </div>
                          </div>

                          {/* Score Breakdown Preview */}
                          <div className="space-y-2">
                            {currentPreset.metrics.slice(0, 3).map(metric => {
                              const def = metricDefs[metric];
                              const score = property.score?.breakdown[metric]?.score || 0;
                              
                              return (
                                <div key={metric} className="flex items-center gap-2">
                                  <span className="text-xs w-20 truncate" style={{ color: t.textMuted }}>
                                    {def?.label}
                                  </span>
                                  <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: t.border }}>
                                    <motion.div
                                      className="h-full rounded-full"
                                      style={{ backgroundColor: getScoreColor(score) }}
                                      initial={{ width: 0 }}
                                      animate={{ width: `${score}%` }}
                                      transition={{ duration: 0.8, delay: index * 0.1 + 0.3 }}
                                    />
                                  </div>
                                  <span className="font-mono text-xs w-12 text-right" style={{ color: t.text }}>
                                    {def?.format(property[metric])}
                                  </span>
                                </div>
                              );
                            })}
                          </div>

                          {/* Price */}
                          <div className="mt-4 flex items-end justify-between">
                            <div>
                              <p className="text-[10px] uppercase tracking-wider" style={{ color: t.textMuted }}>Asking</p>
                              <p className="font-display text-xl font-bold" style={{ color: t.text }}>
                                {formatPrice(property.totalPrice)}
                              </p>
                            </div>
                            <button 
                              className="text-xs font-semibold flex items-center gap-1 transition-colors"
                              style={{ color: t.primary }}
                            >
                              Details
                              <ArrowRightIcon className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>

              {/* Two Column Layout: Metrics + Sensitivity */}
              <div className="grid grid-cols-12 gap-6">
                {/* Left: Metric Comparison Bars */}
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: animationPhase >= 3 ? 1 : 0, y: animationPhase >= 3 ? 0 : 20 }}
                  className="col-span-8"
                >
                  <div 
                    className="rounded-2xl p-6"
                    style={{ backgroundColor: t.bgCard, border: `1px solid ${t.border}` }}
                  >
                    <h3 className="font-display text-lg font-bold mb-6" style={{ color: t.text }}>
                      Key Metrics Comparison
                    </h3>

                    {/* Metric Bars */}
                    <div className="space-y-6">
                      {currentPreset.metrics.map((metric, idx) => {
                        const def = metricDefs[metric];
                        const scoring = currentPreset.scoring[metric];
                        const values = properties.map(p => p[metric]).filter(v => v !== null);
                        const maxValue = Math.max(...values);
                        const minValue = Math.min(...values);
                        
                        // Sort by best first
                        const sorted = [...properties]
                          .filter(p => p[metric] !== null)
                          .sort((a, b) => {
                            if (scoring.direction === 'higher') return b[metric] - a[metric];
                            if (scoring.direction === 'lower') return a[metric] - b[metric];
                            return 0;
                          });
                        
                        return (
                          <div key={metric}>
                            {/* Metric Header */}
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold" style={{ color: t.text }}>{def?.label}</span>
                                {scoring.direction !== 'neutral' && (
                                  <span 
                                    className="text-[10px] px-2 py-0.5 rounded-full"
                                    style={{ backgroundColor: t.primaryGhost, color: t.primary }}
                                  >
                                    {scoring.direction === 'higher' ? '↑ Higher is better' : '↓ Lower is better'}
                                  </span>
                                )}
                              </div>
                              <span className="text-xs" style={{ color: t.textMuted }}>
                                Target: {def?.format(scoring.target)}
                              </span>
                            </div>

                            {/* Bars */}
                            <div className="space-y-2">
                              {sorted.map((property, i) => {
                                const value = property[metric];
                                const barWidth = maxValue > minValue 
                                  ? ((value - minValue) / (maxValue - minValue)) * 80 + 20
                                  : 100;
                                const isWinner = i === 0;
                                const isHovered = hoveredProperty === property.id;
                                
                                return (
                                  <motion.div
                                    key={property.id}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ 
                                      opacity: hoveredProperty && !isHovered ? 0.4 : 1,
                                      x: 0 
                                    }}
                                    transition={{ delay: idx * 0.05 + i * 0.02 }}
                                    onHoverStart={() => setHoveredProperty(property.id)}
                                    onHoverEnd={() => setHoveredProperty(null)}
                                    className="flex items-center gap-3 cursor-pointer group"
                                  >
                                    {/* Rank */}
                                    <div 
                                      className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                                      style={{ 
                                        backgroundColor: isWinner ? t.success : t.bgAlt,
                                        color: isWinner ? '#fff' : t.textMuted
                                      }}
                                    >
                                      {isWinner ? '★' : i + 1}
                                    </div>

                                    {/* Name */}
                                    <span 
                                      className="w-28 text-sm truncate shrink-0 transition-colors"
                                      style={{ color: isHovered ? t.primary : t.textSecondary }}
                                    >
                                      {property.name}
                                    </span>

                                    {/* Bar */}
                                    <div 
                                      className="flex-1 h-8 rounded-lg overflow-hidden relative"
                                      style={{ backgroundColor: t.bgAlt }}
                                    >
                                      <motion.div
                                        className="h-full rounded-lg"
                                        style={{ 
                                          backgroundColor: isWinner ? t.success : t.primary,
                                          opacity: isWinner ? 1 : 0.6
                                        }}
                                        initial={{ width: 0 }}
                                        animate={{ width: `${barWidth}%` }}
                                        transition={{ duration: 0.8, delay: idx * 0.1 + i * 0.05 }}
                                      />
                                      
                                      {/* Value Label */}
                                      <span 
                                        className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-sm font-semibold"
                                        style={{ color: t.text }}
                                      >
                                        {def?.format(value)}
                                      </span>
                                    </div>
                                  </motion.div>
                                );
                              })}
                              
                              {/* N/A entries */}
                              {properties.filter(p => p[metric] === null).map((property) => (
                                <div key={property.id} className="flex items-center gap-3 opacity-40">
                                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0"
                                    style={{ backgroundColor: t.bgAlt, color: t.textMuted }}>—</div>
                                  <span className="w-28 text-sm truncate shrink-0" style={{ color: t.textMuted }}>
                                    {property.name}
                                  </span>
                                  <div className="flex-1 h-8 rounded-lg flex items-center justify-center"
                                    style={{ backgroundColor: t.bgAlt }}>
                                    <span className="font-mono text-sm" style={{ color: t.textMuted }}>N/A</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </motion.div>

                {/* Right: Sensitivity Analysis + Leaders */}
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: animationPhase >= 4 ? 1 : 0, y: animationPhase >= 4 ? 0 : 20 }}
                  className="col-span-4 space-y-6"
                >
                  {/* Sensitivity Analysis */}
                  <div 
                    className="rounded-2xl p-6"
                    style={{ backgroundColor: t.bgCard, border: `1px solid ${t.border}` }}
                  >
                    <div className="flex items-center gap-2 mb-4">
                      <SlidersIcon className="w-5 h-5" style={{ color: t.primary }} />
                      <h3 className="font-display text-lg font-bold" style={{ color: t.text }}>
                        What-If Analysis
                      </h3>
                    </div>
                    
                    <p className="text-sm mb-6" style={{ color: t.textSecondary }}>
                      Adjust cap rate to see impact on pricing and returns
                    </p>

                    {/* Cap Rate Slider */}
                    <div className="mb-6">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm" style={{ color: t.textMuted }}>Target Cap Rate</span>
                        <span className="font-mono text-lg font-bold" style={{ color: t.primary }}>
                          {sensitivityValue.toFixed(2)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="4"
                        max="7"
                        step="0.05"
                        value={sensitivityValue}
                        onChange={(e) => setSensitivityValue(parseFloat(e.target.value))}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs mt-1" style={{ color: t.textMuted }}>
                        <span>4.00%</span>
                        <span>7.00%</span>
                      </div>
                    </div>

                    {/* Impact Preview */}
                    <div className="space-y-3">
                      {properties.filter(p => p.noi).slice(0, 2).map(property => {
                        const impact = calculateSensitivity(property, sensitivityValue);
                        if (!impact) return null;
                        
                        return (
                          <div 
                            key={property.id}
                            className="p-3 rounded-xl"
                            style={{ backgroundColor: t.bgAlt }}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-semibold text-sm" style={{ color: t.text }}>
                                {property.name}
                              </span>
                              <span 
                                className="text-xs font-mono font-semibold"
                                style={{ 
                                  color: impact.priceChange < 0 ? t.success : t.danger 
                                }}
                              >
                                {impact.priceChange < 0 ? '↓' : '↑'} {formatPrice(Math.abs(impact.priceChange))}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <span style={{ color: t.textMuted }}>New Price: </span>
                                <span className="font-mono" style={{ color: t.text }}>{formatPrice(impact.newPrice)}</span>
                              </div>
                              <div>
                                <span style={{ color: t.textMuted }}>IRR: </span>
                                <span className="font-mono" style={{ color: t.text }}>{impact.newIrr.toFixed(1)}%</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <button 
                      className="w-full mt-4 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2"
                      style={{ 
                        backgroundColor: t.primaryGhost,
                        color: t.primary,
                        border: `1px solid ${t.primary}40`
                      }}
                    >
                      <ExpandIcon className="w-4 h-4" />
                      Full Sensitivity Table
                    </button>
                  </div>

                  {/* Category Leaders */}
                  <div 
                    className="rounded-2xl p-6"
                    style={{ backgroundColor: t.bgCard, border: `1px solid ${t.border}` }}
                  >
                    <div className="flex items-center gap-2 mb-4">
                      <TrophyIcon className="w-5 h-5" style={{ color: '#FFD700' }} />
                      <h3 className="font-display text-lg font-bold" style={{ color: t.text }}>
                        Category Leaders
                      </h3>
                    </div>

                    <div className="space-y-3">
                      {currentPreset.metrics.slice(0, 4).map(metric => {
                        const def = metricDefs[metric];
                        const scoring = currentPreset.scoring[metric];
                        
                        const winner = [...properties]
                          .filter(p => p[metric] !== null)
                          .sort((a, b) => {
                            if (scoring.direction === 'higher') return b[metric] - a[metric];
                            if (scoring.direction === 'lower') return a[metric] - b[metric];
                            return 0;
                          })[0];
                        
                        if (!winner) return null;
                        
                        return (
                          <div 
                            key={metric}
                            className="flex items-center justify-between p-3 rounded-xl transition-all cursor-pointer"
                            style={{ backgroundColor: t.bgAlt }}
                            onMouseEnter={() => setHoveredProperty(winner.id)}
                            onMouseLeave={() => setHoveredProperty(null)}
                          >
                            <div>
                              <p className="text-[10px] uppercase tracking-wider" style={{ color: t.textMuted }}>
                                Best {def?.label}
                              </p>
                              <p className="font-semibold text-sm mt-0.5" style={{ color: t.text }}>
                                {winner.name}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-mono font-bold" style={{ color: t.success }}>
                                {def?.format(winner[metric])}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* AI Insight Preview */}
                  <div 
                    className="rounded-2xl p-6 relative overflow-hidden"
                    style={{ 
                      background: darkMode 
                        ? 'linear-gradient(135deg, #1E1828 0%, #1A1228 100%)'
                        : 'linear-gradient(135deg, #F8F5FF 0%, #FFF5F8 100%)',
                      border: `1px solid ${t.border}`
                    }}
                  >
                    <div className="absolute top-4 right-4 opacity-10">
                      <SparkleIcon className="w-20 h-20" style={{ color: t.primary }} />
                    </div>
                    
                    <div className="flex items-center gap-2 mb-3">
                      <SparkleIcon className="w-5 h-5" style={{ color: t.primary }} />
                      <span 
                        className="text-xs font-bold uppercase tracking-wider"
                        style={{ color: t.primary }}
                      >
                        AI Insight
                      </span>
                    </div>
                    
                    <p className="text-sm leading-relaxed relative z-10" style={{ color: t.text }}>
                      Based on your <strong>{currentPreset.name}</strong> criteria, 
                      <strong style={{ color: t.success }}> {dealScores[0]?.name}</strong> leads with 
                      a score of <strong>{dealScores[0]?.score?.total}</strong>. 
                      {dealScores[0]?.goingInCap && ` Strong yield at ${dealScores[0].goingInCap}% cap.`}
                    </p>
                    
                    <button 
                      className="mt-4 text-sm font-semibold flex items-center gap-1 transition-all hover:gap-2"
                      style={{ color: t.primary }}
                    >
                      Generate Full Analysis
                      <ArrowRightIcon className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          )}

          {/* === DEEP ANALYSIS VIEW === */}
          {viewMode === 'deep' && (
            <motion.div
              key="deep"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              {/* Full Data Table */}
              <div 
                className="rounded-2xl overflow-hidden"
                style={{ backgroundColor: t.bgCard, border: `1px solid ${t.border}` }}
              >
                {/* Table Header */}
                <div 
                  className="grid items-center p-4"
                  style={{ 
                    gridTemplateColumns: `200px repeat(${properties.length}, 1fr)`,
                    backgroundColor: t.bgAlt,
                    borderBottom: `1px solid ${t.border}`
                  }}
                >
                  <div className="font-display font-bold" style={{ color: t.text }}>Metric</div>
                  {dealScores.map((property, index) => (
                    <div 
                      key={property.id}
                      className="text-center"
                      onMouseEnter={() => setHoveredProperty(property.id)}
                      onMouseLeave={() => setHoveredProperty(null)}
                    >
                      <div className="flex items-center justify-center gap-2 mb-1">
                        {index === 0 && <span>👑</span>}
                        <span className="font-display font-bold" style={{ color: t.text }}>
                          {property.name}
                        </span>
                      </div>
                      <div 
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold"
                        style={{ 
                          backgroundColor: getScoreGhost(property.score?.total || 0),
                          color: getScoreColor(property.score?.total || 0)
                        }}
                      >
                        Score: {property.score?.total || 0}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Table Sections */}
                {[
                  { title: 'PROPERTY INFORMATION', metrics: ['city', 'units', 'vintage'] },
                  { title: 'PRICING', metrics: ['totalPrice', 'pricePerUnit', 'pricePerSF'] },
                  { title: 'CAP RATES & RETURNS', metrics: ['goingInCap', 'stabilizedCap', 'irr', 'cashOnCash', 'equityMultiple'] },
                  { title: 'DEBT METRICS', metrics: ['dscr', 'debtYield'] },
                  { title: 'OPERATIONS', metrics: ['occupancy', 'noi'] },
                ].map((section, sectionIdx) => (
                  <div key={section.title}>
                    {/* Section Header */}
                    <div 
                      className="px-4 py-2"
                      style={{ backgroundColor: t.primaryGhost }}
                    >
                      <span className="text-xs font-bold uppercase tracking-wider" style={{ color: t.primary }}>
                        {section.title}
                      </span>
                    </div>
                    
                    {/* Section Rows */}
                    {section.metrics.map((metric, rowIdx) => {
                      const def = metricDefs[metric];
                      const scoring = currentPreset.scoring[metric];
                      
                      // Find best value
                      const validValues = properties.map(p => ({ id: p.id, value: p[metric] })).filter(v => v.value !== null);
                      let bestId = null;
                      let worstId = null;
                      
                      if (scoring && validValues.length > 0) {
                        if (scoring.direction === 'higher') {
                          bestId = validValues.sort((a, b) => b.value - a.value)[0]?.id;
                          worstId = validValues.sort((a, b) => a.value - b.value)[0]?.id;
                        } else if (scoring.direction === 'lower') {
                          bestId = validValues.sort((a, b) => a.value - b.value)[0]?.id;
                          worstId = validValues.sort((a, b) => b.value - a.value)[0]?.id;
                        }
                      }
                      
                      return (
                        <div 
                          key={metric}
                          className="grid items-center p-4 transition-colors"
                          style={{ 
                            gridTemplateColumns: `200px repeat(${properties.length}, 1fr)`,
                            borderBottom: `1px solid ${t.border}`,
                            backgroundColor: hoveredProperty 
                              ? 'transparent' 
                              : (rowIdx % 2 === 0 ? 'transparent' : t.bgAlt + '40')
                          }}
                        >
                          <div className="text-sm" style={{ color: t.textSecondary }}>
                            {def?.label}
                          </div>
                          
                          {dealScores.map((property) => {
                            const value = property[metric];
                            const isBest = property.id === bestId;
                            const isWorst = property.id === worstId && validValues.length > 2;
                            const isHovered = hoveredProperty === property.id;
                            
                            return (
                              <div 
                                key={property.id}
                                className="text-center"
                                onMouseEnter={() => setHoveredProperty(property.id)}
                                onMouseLeave={() => setHoveredProperty(null)}
                              >
                                <span 
                                  className={`font-mono text-sm inline-flex items-center gap-1 px-2 py-1 rounded-lg transition-all ${isBest ? 'font-bold' : ''}`}
                                  style={{ 
                                    color: isBest ? t.success : isWorst ? t.danger : t.text,
                                    backgroundColor: isHovered ? t.primaryGhost : (isBest ? t.successGhost : isWorst ? t.dangerGhost : 'transparent')
                                  }}
                                >
                                  {isBest && <span>✓</span>}
                                  {def?.format(value)}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* === SAVE MODAL === */}
      <AnimatePresence>
        {showSaveModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
            onClick={() => setShowSaveModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md rounded-2xl p-6"
              style={{ backgroundColor: t.bgCard, border: `1px solid ${t.border}` }}
              onClick={e => e.stopPropagation()}
            >
              <h3 className="font-display text-xl font-bold mb-4" style={{ color: t.text }}>
                Save to Comparison Library
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1.5 block" style={{ color: t.textSecondary }}>
                    Comparison Name
                  </label>
                  <input 
                    type="text"
                    placeholder="e.g., Q1 Southeast Value-Add Pipeline"
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
                    style={{ 
                      backgroundColor: t.bgAlt,
                      border: `1px solid ${t.border}`,
                      color: t.text
                    }}
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium mb-1.5 block" style={{ color: t.textSecondary }}>
                    Tags
                  </label>
                  <input 
                    type="text"
                    placeholder="e.g., Georgia, Value-Add, 2024"
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
                    style={{ 
                      backgroundColor: t.bgAlt,
                      border: `1px solid ${t.border}`,
                      color: t.text
                    }}
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium mb-1.5 block" style={{ color: t.textSecondary }}>
                    Notes
                  </label>
                  <textarea 
                    placeholder="Add notes about this comparison..."
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all resize-none"
                    style={{ 
                      backgroundColor: t.bgAlt,
                      border: `1px solid ${t.border}`,
                      color: t.text
                    }}
                  />
                </div>
              </div>
              
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowSaveModal(false)}
                  className="flex-1 py-3 rounded-xl text-sm font-medium transition-all"
                  style={{ backgroundColor: t.bgAlt, color: t.textSecondary }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => setShowSaveModal(false)}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold transition-all text-white"
                  style={{ 
                    background: `linear-gradient(135deg, ${t.primary} 0%, ${theme.dark.primaryDark} 100%)`,
                    boxShadow: '0 4px 12px rgba(124, 58, 237, 0.3)'
                  }}
                >
                  Save Comparison
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// === ICON COMPONENTS ===
const ArrowLeftIcon = ({ className, style }) => (
  <svg className={className} style={style} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
  </svg>
);

const ArrowRightIcon = ({ className, style }) => (
  <svg className={className} style={style} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
  </svg>
);

const ZapIcon = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
);

const LayersIcon = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
  </svg>
);

const BookmarkIcon = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
  </svg>
);

const DownloadIcon = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
);

const SunIcon = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
);

const MoonIcon = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
  </svg>
);

const PlusIcon = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
  </svg>
);

const SlidersIcon = ({ className, style }) => (
  <svg className={className} style={style} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
  </svg>
);

const ExpandIcon = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
  </svg>
);

const TrophyIcon = ({ className, style }) => (
  <svg className={className} style={style} fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 14c-2.67 0-8-1.34-8-4V6h16v4c0 2.66-5.33 4-8 4zm0 2c2.21 0 4 1.79 4 4H8c0-2.21 1.79-4 4-4zm-8-8V4h4V2H4v2H2v4h2zm16 0V4h-4V2h4v2h2v4h-2z"/>
  </svg>
);

const SparkleIcon = ({ className, style }) => (
  <svg className={className} style={style} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
  </svg>
);

export default AstraComparisonV3;
