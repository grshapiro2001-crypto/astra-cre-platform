import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * ASTRA CRE - PROPERTY DETAIL PAGE V1
 * "Where Raw Data Becomes Investment Intelligence"
 * 
 * DESIGN PRINCIPLES:
 * 1. Single scrollable page - no hidden information
 * 2. Source attribution - know where every number came from
 * 3. Manual override - user always has control
 * 4. Back-of-napkin AI - instant analysis with T12 + pricing
 * 5. Economic Occupancy as operational health signal
 * 
 * SECTIONS:
 * - Header (actions, stage, score)
 * - Property Snapshot (hero metrics)
 * - Pricing Analysis (sensitivity slider, BOV dual pricing)
 * - Operating Financials (T3/T12/Y1 toggle, $/Total toggle)
 * - Unit Mix Summary
 * - Special Considerations (conditional)
 * - AI Insights
 * - Documents
 * - Notes & Activity
 * - Data Sources
 */

const AstraPropertyDetail = () => {
  // === STATE ===
  const [darkMode, setDarkMode] = useState(true);
  const [financialPeriod, setFinancialPeriod] = useState('t12'); // 't3' | 't12' | 'y1'
  const [financialView, setFinancialView] = useState('total'); // 'total' | 'perUnit'
  const [pricingScenario, setPricingScenario] = useState('market'); // 'premium' | 'market' (for BOV)
  const [pricingGuidance, setPricingGuidance] = useState(48500000);
  const [capRateSlider, setCapRateSlider] = useState(4.56);
  const [showSourcesPanel, setShowSourcesPanel] = useState(false);
  const [editingField, setEditingField] = useState(null);
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [showStageDropdown, setShowStageDropdown] = useState(false);
  const [currentStage, setCurrentStage] = useState('dueDiligence');
  const [newNote, setNewNote] = useState('');
  const [animationPhase, setAnimationPhase] = useState(0);

  // Animation sequence
  useEffect(() => {
    const timers = [
      setTimeout(() => setAnimationPhase(1), 100),
      setTimeout(() => setAnimationPhase(2), 250),
      setTimeout(() => setAnimationPhase(3), 400),
      setTimeout(() => setAnimationPhase(4), 550),
      setTimeout(() => setAnimationPhase(5), 700),
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
      blue: '#3B82F6',
      blueGhost: 'rgba(59, 130, 246, 0.1)',
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
      blue: '#60A5FA',
      blueGhost: 'rgba(96, 165, 250, 0.15)',
    }
  };
  const t = darkMode ? theme.dark : theme.light;

  // === PROPERTY DATA ===
  const property = {
    id: 1,
    name: "The Tower on Piedmont",
    address: "3242 Peachtree Rd NE",
    city: "Atlanta",
    state: "GA",
    zip: "30305",
    submarket: "Buckhead",
    propertyType: "Multifamily",
    units: 155,
    totalSF: 189945,
    vintage: 2009,
    documentType: 'bov', // 'om' | 'bov'
    stage: 'dueDiligence',
    score: 78,
    uploadedAt: '2026-01-18T01:58:00Z',
    lastAnalyzed: '2026-01-17T20:58:00Z',
    analysisCount: 1,
    thumbnail: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&h=600&fit=crop',
    
    // Rent data
    marketRent: 3371,
    inPlaceRent: 2928,
    lossToLease: 443, // calculated: marketRent - inPlaceRent
    lossToLeasePercent: 13.1,
    
    // Special considerations
    hasRetail: false,
    hasAffordability: false,
    hasTaxAbatement: true,
    taxAbatementExpiry: '2029-12-31',
    hasRenovation: true,
    renovationBudget: 2500000,
    renovationUnitsComplete: 45,
    hasDebtAssumption: false,
    
    // Unit mix
    unitMix: [
      { type: 'Studio', units: 15, avgSF: 550, avgRent: 2150, percentTotal: 9.7 },
      { type: '1BR/1BA', units: 65, avgSF: 785, avgRent: 2750, percentTotal: 41.9 },
      { type: '2BR/2BA', units: 55, avgSF: 1150, avgRent: 3450, percentTotal: 35.5 },
      { type: '3BR/2BA', units: 20, avgSF: 1450, avgRent: 4200, percentTotal: 12.9 },
    ],
    
    // Financials by period
    financials: {
      t3: {
        gpr: 5296628,
        lossToLease: 0, // Often not broken out in T3
        vacancy: 271265,
        concessions: 166814,
        badDebt: 95305,
        nonRevenue: 104391,
        otherIncome: 185000,
        egi: 4843853,
        totalOpex: 2641349,
        managementFee: 145316,
        reserves: 46500,
        noi: 2211910,
      },
      t12: {
        gpr: 5450000,
        lossToLease: 715350,
        vacancy: 245250,
        concessions: 142500,
        badDebt: 82000,
        nonRevenue: 98500,
        otherIncome: 198000,
        egi: 5029400,
        totalOpex: 2580000,
        managementFee: 150882,
        reserves: 46500,
        noi: 2398518,
      },
      y1: {
        gpr: 5582461,
        lossToLease: 0,
        vacancy: 289511,
        concessions: 0,
        badDebt: 28951,
        nonRevenue: 56995,
        otherIncome: 210000,
        egi: 5417004,
        totalOpex: 2500261,
        managementFee: 162510,
        reserves: 46500,
        noi: 3196979,
      }
    },
    
    // BOV Pricing (if documentType === 'bov')
    bovPricing: {
      premium: {
        price: 52000000,
        t12Cap: 4.61,
        y1Cap: 6.15,
        pricePerUnit: 335484,
        pricePerSF: 274,
        cashOnCash: 7.2,
        leveredIRR: 13.8,
        unleveredIRR: 9.2,
        equityMultiple: 1.72,
      },
      market: {
        price: 48500000,
        t12Cap: 4.94,
        y1Cap: 6.59,
        pricePerUnit: 312903,
        pricePerSF: 255,
        cashOnCash: 8.9,
        leveredIRR: 16.2,
        unleveredIRR: 10.8,
        equityMultiple: 1.89,
      }
    },
    
    // Documents
    documents: [
      { id: 1, name: 'Tower_on_Piedmont_BOV.pdf', type: 'bov', pages: 42, uploadedAt: '2026-01-18T01:58:00Z', dataPoints: 47 },
      { id: 2, name: 'T12_Operating_Statement.xlsx', type: 't12', uploadedAt: '2026-01-18T01:58:00Z', dataPoints: 23 },
      { id: 3, name: 'Rent_Roll_Jan2026.xlsx', type: 'rentroll', uploadedAt: '2026-01-18T01:58:00Z', dataPoints: 155 },
    ],
    
    // Notes
    notes: [
      { id: 1, text: 'Strong location in Buckhead. Tax abatement expires 2029 - factor into hold period analysis.', author: 'Griffin S.', timestamp: '2026-01-18T10:30:00Z' },
      { id: 2, text: 'Renovation program 29% complete. Verify rent premiums on renovated units.', author: 'Griffin S.', timestamp: '2026-01-17T15:45:00Z' },
    ],
    
    // Activity log
    activity: [
      { type: 'upload', description: 'BOV document uploaded', timestamp: '2026-01-18T01:58:00Z' },
      { type: 'analysis', description: 'AI analysis completed - 47 data points extracted', timestamp: '2026-01-17T20:58:00Z' },
      { type: 'stage', description: 'Stage changed to Due Diligence', timestamp: '2026-01-17T21:15:00Z' },
    ],
    
    // Data sources (field -> source mapping)
    dataSources: {
      units: { source: 'BOV', page: 3, confidence: 'high' },
      totalSF: { source: 'BOV', page: 3, confidence: 'high' },
      vintage: { source: 'BOV', page: 3, confidence: 'high' },
      marketRent: { source: 'BOV', page: 15, confidence: 'high' },
      inPlaceRent: { source: 'Rent Roll', sheet: 'Summary', confidence: 'high' },
      't3.gpr': { source: 'BOV', page: 22, confidence: 'high' },
      't3.noi': { source: 'BOV', page: 22, confidence: 'high' },
      't12.noi': { source: 'T12 Excel', sheet: 'Annual', confidence: 'high' },
      'y1.noi': { source: 'BOV', page: 28, confidence: 'medium' },
      'bovPricing.premium.price': { source: 'BOV', page: 38, confidence: 'high' },
      'bovPricing.market.price': { source: 'BOV', page: 38, confidence: 'high' },
    }
  };

  // === COMPUTED VALUES ===
  const currentFinancials = property.financials[financialPeriod];
  
  const economicOccupancy = useMemo(() => {
    const deductions = currentFinancials.vacancy + currentFinancials.concessions + 
                       currentFinancials.badDebt + currentFinancials.nonRevenue;
    const ecoOcc = currentFinancials.gpr - deductions;
    const percent = (ecoOcc / currentFinancials.gpr) * 100;
    return { amount: ecoOcc, percent };
  }, [currentFinancials]);

  const opexPercent = useMemo(() => {
    return ((currentFinancials.totalOpex / currentFinancials.gpr) * 100).toFixed(1);
  }, [currentFinancials]);

  // Price derived from cap rate slider
  const derivedPrice = useMemo(() => {
    return Math.round(currentFinancials.noi / (capRateSlider / 100));
  }, [currentFinancials.noi, capRateSlider]);

  // Metrics based on pricing guidance
  const pricingMetrics = useMemo(() => {
    const price = pricingGuidance;
    return {
      goingInCap: ((property.financials.t12.noi / price) * 100).toFixed(2),
      y1Cap: ((property.financials.y1.noi / price) * 100).toFixed(2),
      pricePerUnit: Math.round(price / property.units),
      pricePerSF: Math.round(price / property.totalSF),
    };
  }, [pricingGuidance, property]);

  // === STAGES ===
  const stages = [
    { id: 'sourced', label: 'Sourced', color: '#60A5FA' },
    { id: 'screening', label: 'Screening', color: '#A78BFA' },
    { id: 'dueDiligence', label: 'Due Diligence', color: '#FBBF24' },
    { id: 'closing', label: 'Closing', color: '#34D399' },
    { id: 'closed', label: 'Closed', color: '#10B981' },
  ];

  // === HELPERS ===
  const formatCurrency = (num, abbreviated = false) => {
    if (num === null || num === undefined) return '—';
    if (abbreviated) {
      if (Math.abs(num) >= 1000000) return `$${(num / 1000000).toFixed(1)}M`;
      if (Math.abs(num) >= 1000) return `$${(num / 1000).toFixed(0)}K`;
    }
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(num);
  };

  const formatPerUnit = (num) => {
    return formatCurrency(Math.round(num / property.units));
  };

  const getScoreColor = (score) => {
    if (score >= 80) return t.success;
    if (score >= 70) return t.primary;
    if (score >= 60) return t.warning;
    return t.danger;
  };

  const getEcoOccColor = (percent) => {
    if (percent >= 90) return t.success;
    if (percent >= 85) return t.warning;
    return t.danger;
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', { 
      month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' 
    });
  };

  const addNote = () => {
    if (!newNote.trim()) return;
    // In real app, this would save to backend
    console.log('Adding note:', newNote);
    setNewNote('');
  };

  // === RENDER HELPERS ===
  const FinancialRow = ({ label, value, isDeduction = false, isTotal = false, isHighlight = false, percent = null }) => {
    const displayValue = financialView === 'perUnit' ? formatPerUnit(value) : formatCurrency(value);
    const sign = isDeduction && value > 0 ? '-' : '';
    
    return (
      <div 
        className={`flex items-center justify-between py-3 ${isTotal ? 'border-t-2' : 'border-b'}`}
        style={{ 
          borderColor: isTotal ? t.primary : t.border,
          backgroundColor: isHighlight ? t.primaryGhost : 'transparent'
        }}
      >
        <span 
          className={`${isTotal || isHighlight ? 'font-semibold' : ''}`}
          style={{ color: isTotal || isHighlight ? t.text : t.textSecondary, paddingLeft: isDeduction ? 16 : 0 }}
        >
          {label}
        </span>
        <div className="flex items-center gap-3">
          {percent !== null && (
            <span className="text-sm font-mono" style={{ color: t.textMuted }}>
              {percent.toFixed(1)}%
            </span>
          )}
          <span 
            className={`font-mono ${isTotal || isHighlight ? 'font-bold text-lg' : ''}`}
            style={{ color: isDeduction ? t.danger : (isHighlight ? getEcoOccColor(economicOccupancy.percent) : t.text) }}
          >
            {sign}{displayValue}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div 
      className="min-h-screen transition-colors duration-500"
      style={{ backgroundColor: t.bg }}
    >
      {/* Fonts & Styles */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=Instrument+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&family=JetBrains+Mono:wght@400;500;600&display=swap');
        
        .font-display { font-family: 'Syne', sans-serif; }
        .font-mono { font-family: 'JetBrains Mono', monospace; }
        * { font-family: 'Instrument Sans', sans-serif; }
        
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { 
          background: ${darkMode ? 'rgba(167, 139, 250, 0.3)' : 'rgba(124, 58, 237, 0.2)'}; 
          border-radius: 3px; 
        }

        input[type="range"] {
          -webkit-appearance: none;
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
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: ${t.primary};
          margin-top: -7px;
          box-shadow: 0 2px 8px ${t.primary}60;
        }
      `}</style>

      {/* Ambient Background */}
      {darkMode && (
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <motion.div 
            className="absolute top-[-10%] right-[15%] w-[500px] h-[500px] rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(124, 58, 237, 0.08) 0%, transparent 60%)', filter: 'blur(80px)' }}
            animate={{ scale: [1, 1.1, 1], opacity: [0.4, 0.6, 0.4] }}
            transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
      )}

      {/* === STICKY HEADER === */}
      <header 
        className="sticky top-0 z-50 transition-colors duration-300"
        style={{ 
          backgroundColor: darkMode ? 'rgba(15, 11, 21, 0.92)' : 'rgba(254, 252, 255, 0.92)',
          backdropFilter: 'blur(20px)',
          borderBottom: `1px solid ${t.border}`
        }}
      >
        <div className="max-w-6xl mx-auto px-6 py-4">
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
                <div className="flex items-center gap-3">
                  <h1 className="font-display text-xl font-bold" style={{ color: t.text }}>
                    {property.name}
                  </h1>
                  <span 
                    className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider"
                    style={{ 
                      backgroundColor: property.documentType === 'bov' ? t.blueGhost : t.successGhost,
                      color: property.documentType === 'bov' ? t.blue : t.success
                    }}
                  >
                    {property.documentType}
                  </span>
                  
                  {/* Stage Dropdown */}
                  <div className="relative">
                    <button
                      onClick={() => setShowStageDropdown(!showStageDropdown)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                      style={{ 
                        backgroundColor: stages.find(s => s.id === currentStage)?.color + '20',
                        color: stages.find(s => s.id === currentStage)?.color
                      }}
                    >
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: stages.find(s => s.id === currentStage)?.color }} />
                      {stages.find(s => s.id === currentStage)?.label}
                      <ChevronDownIcon className="w-3 h-3" />
                    </button>
                    
                    <AnimatePresence>
                      {showStageDropdown && (
                        <motion.div
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 5 }}
                          className="absolute top-full left-0 mt-2 w-44 rounded-xl overflow-hidden z-50"
                          style={{ backgroundColor: t.bgCard, border: `1px solid ${t.border}`, boxShadow: '0 10px 40px rgba(0,0,0,0.2)' }}
                        >
                          {stages.map(stage => (
                            <button
                              key={stage.id}
                              onClick={() => { setCurrentStage(stage.id); setShowStageDropdown(false); }}
                              className="w-full flex items-center gap-2 px-4 py-2.5 text-left text-sm transition-colors"
                              style={{ 
                                backgroundColor: currentStage === stage.id ? t.primaryGhost : 'transparent',
                                color: t.text
                              }}
                            >
                              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: stage.color }} />
                              {stage.label}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
                <p className="text-sm mt-0.5" style={{ color: t.textMuted }}>
                  Last analyzed: {formatDate(property.lastAnalyzed)}
                </p>
              </div>
            </div>

            {/* Right: Score + Actions */}
            <div className="flex items-center gap-3">
              {/* Deal Score */}
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ backgroundColor: t.bgCard, border: `1px solid ${t.border}` }}>
                <span className="text-xs font-medium" style={{ color: t.textMuted }}>Deal Score</span>
                <span className="font-mono text-lg font-bold" style={{ color: getScoreColor(property.score) }}>
                  {property.score}
                </span>
              </div>

              {/* AI Insights */}
              <button
                onClick={() => setShowAIPanel(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all text-white"
                style={{ 
                  background: `linear-gradient(135deg, ${t.primary} 0%, ${t.primaryDark} 100%)`,
                  boxShadow: `0 4px 12px ${t.primary}30`
                }}
              >
                <SparkleIcon className="w-4 h-4" />
                AI Analysis
              </button>

              {/* Re-analyze */}
              <button
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
                style={{ backgroundColor: t.successGhost, color: t.success, border: `1px solid ${t.success}30` }}
              >
                <RefreshIcon className="w-4 h-4" />
                Re-analyze
              </button>

              {/* More Actions */}
              <button
                className="p-2.5 rounded-xl transition-all"
                style={{ backgroundColor: t.bgCard, border: `1px solid ${t.border}`, color: t.textMuted }}
              >
                <MoreIcon className="w-5 h-5" />
              </button>

              {/* Theme Toggle */}
              <button
                onClick={() => setDarkMode(!darkMode)}
                className="p-2.5 rounded-xl transition-all"
                style={{ backgroundColor: t.bgCard, border: `1px solid ${t.border}`, color: t.textMuted }}
              >
                {darkMode ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Click outside to close dropdowns */}
      {showStageDropdown && <div className="fixed inset-0 z-40" onClick={() => setShowStageDropdown(false)} />}

      {/* === MAIN CONTENT === */}
      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">

        {/* === PROPERTY SNAPSHOT === */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: animationPhase >= 1 ? 1 : 0, y: animationPhase >= 1 ? 0 : 20 }}
        >
          <div 
            className="rounded-2xl overflow-hidden"
            style={{ backgroundColor: t.bgCard, border: `1px solid ${t.border}` }}
          >
            <div className="grid grid-cols-12 gap-0">
              {/* Property Image */}
              <div className="col-span-4 relative">
                <img 
                  src={property.thumbnail} 
                  alt={property.name}
                  className="w-full h-full object-cover min-h-[280px]"
                />
                <div 
                  className="absolute inset-0"
                  style={{ background: `linear-gradient(to right, transparent 60%, ${t.bgCard} 100%)` }}
                />
              </div>

              {/* Property Info */}
              <div className="col-span-8 p-6">
                <div className="grid grid-cols-3 gap-6">
                  {/* Column 1: Address */}
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: t.textMuted }}>
                      Property Address
                    </h3>
                    <p className="font-semibold" style={{ color: t.text }}>
                      {property.address}
                    </p>
                    <p style={{ color: t.textSecondary }}>
                      {property.city}, {property.state} {property.zip}
                    </p>
                    <div className="mt-3 flex items-center gap-2">
                      <span 
                        className="px-2 py-1 rounded-lg text-xs font-medium"
                        style={{ backgroundColor: t.primaryGhost, color: t.primary }}
                      >
                        {property.submarket}
                      </span>
                      <span 
                        className="px-2 py-1 rounded-lg text-xs font-medium"
                        style={{ backgroundColor: t.bgAlt, color: t.textSecondary }}
                      >
                        {property.propertyType}
                      </span>
                    </div>
                  </div>

                  {/* Column 2: Property Stats */}
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: t.textMuted }}>
                      Property Details
                    </h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span style={{ color: t.textSecondary }}>Units</span>
                        <span className="font-mono font-semibold" style={{ color: t.text }}>{property.units}</span>
                      </div>
                      <div className="flex justify-between">
                        <span style={{ color: t.textSecondary }}>Total SF</span>
                        <span className="font-mono font-semibold" style={{ color: t.text }}>{property.totalSF.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span style={{ color: t.textSecondary }}>Year Built</span>
                        <span className="font-mono font-semibold" style={{ color: t.text }}>{property.vintage}</span>
                      </div>
                      <div className="flex justify-between">
                        <span style={{ color: t.textSecondary }}>Avg Unit SF</span>
                        <span className="font-mono font-semibold" style={{ color: t.text }}>{Math.round(property.totalSF / property.units)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Column 3: Rent Metrics */}
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: t.textMuted }}>
                      Rent Analysis
                    </h3>
                    <div className="space-y-3">
                      <div 
                        className="p-3 rounded-xl"
                        style={{ backgroundColor: t.primaryGhost }}
                      >
                        <p className="text-xs" style={{ color: t.primary }}>Market Rent</p>
                        <p className="font-mono text-xl font-bold" style={{ color: t.text }}>
                          ${property.marketRent.toLocaleString()}<span className="text-sm font-normal">/unit</span>
                        </p>
                      </div>
                      <div 
                        className="p-3 rounded-xl"
                        style={{ backgroundColor: t.bgAlt }}
                      >
                        <p className="text-xs" style={{ color: t.textMuted }}>In-Place Rent</p>
                        <p className="font-mono text-xl font-bold" style={{ color: t.text }}>
                          ${property.inPlaceRent.toLocaleString()}<span className="text-sm font-normal">/unit</span>
                        </p>
                      </div>
                      <div className="flex items-center justify-between px-1">
                        <span className="text-sm" style={{ color: t.textMuted }}>Loss to Lease</span>
                        <span className="font-mono font-semibold" style={{ color: t.warning }}>
                          {property.lossToLeasePercent}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Economic Occupancy Hero */}
                <div 
                  className="mt-6 p-4 rounded-xl flex items-center justify-between"
                  style={{ 
                    backgroundColor: getEcoOccColor(economicOccupancy.percent) + '15',
                    border: `1px solid ${getEcoOccColor(economicOccupancy.percent)}30`
                  }}
                >
                  <div>
                    <p className="text-sm font-medium" style={{ color: t.textSecondary }}>
                      Economic Occupancy ({financialPeriod.toUpperCase()})
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: t.textMuted }}>
                      GPR minus Vacancy, Concessions, Bad Debt, Non-Revenue
                    </p>
                  </div>
                  <div className="text-right">
                    <p 
                      className="font-mono text-3xl font-bold"
                      style={{ color: getEcoOccColor(economicOccupancy.percent) }}
                    >
                      {economicOccupancy.percent.toFixed(1)}%
                    </p>
                    <p className="font-mono text-sm" style={{ color: t.textMuted }}>
                      {formatCurrency(economicOccupancy.amount, true)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        {/* === PRICING ANALYSIS === */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: animationPhase >= 2 ? 1 : 0, y: animationPhase >= 2 ? 0 : 20 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-bold" style={{ color: t.text }}>Pricing Analysis</h2>
            {property.documentType === 'bov' && (
              <div 
                className="flex items-center rounded-xl p-1"
                style={{ backgroundColor: t.bgAlt }}
              >
                <button
                  onClick={() => setPricingScenario('premium')}
                  className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                  style={{ 
                    backgroundColor: pricingScenario === 'premium' ? t.primaryGhost : 'transparent',
                    color: pricingScenario === 'premium' ? t.primary : t.textSecondary
                  }}
                >
                  Premium Price
                </button>
                <button
                  onClick={() => setPricingScenario('market')}
                  className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                  style={{ 
                    backgroundColor: pricingScenario === 'market' ? t.primaryGhost : 'transparent',
                    color: pricingScenario === 'market' ? t.primary : t.textSecondary
                  }}
                >
                  Market Price
                </button>
              </div>
            )}
          </div>

          <div 
            className="rounded-2xl p-6"
            style={{ backgroundColor: t.bgCard, border: `1px solid ${t.border}` }}
          >
            {property.documentType === 'bov' ? (
              /* BOV: Show scenario pricing */
              <div className="grid grid-cols-2 gap-8">
                {/* Selected Scenario Details */}
                <div>
                  <div className="flex items-baseline gap-2 mb-6">
                    <span className="font-mono text-4xl font-bold" style={{ color: t.text }}>
                      {formatCurrency(property.bovPricing[pricingScenario].price, true)}
                    </span>
                    <span className="text-sm" style={{ color: t.textMuted }}>
                      {pricingScenario === 'premium' ? 'Premium' : 'Market'} Price
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { label: 'T12 Cap Rate', value: `${property.bovPricing[pricingScenario].t12Cap}%`, highlight: true },
                      { label: 'Y1 Cap Rate', value: `${property.bovPricing[pricingScenario].y1Cap}%` },
                      { label: '$/Unit', value: formatCurrency(property.bovPricing[pricingScenario].pricePerUnit, true) },
                      { label: '$/SF', value: `$${property.bovPricing[pricingScenario].pricePerSF}` },
                      { label: 'Cash-on-Cash', value: `${property.bovPricing[pricingScenario].cashOnCash}%` },
                      { label: 'Levered IRR', value: `${property.bovPricing[pricingScenario].leveredIRR}%`, highlight: true },
                      { label: 'Unlevered IRR', value: `${property.bovPricing[pricingScenario].unleveredIRR}%` },
                      { label: 'Equity Multiple', value: `${property.bovPricing[pricingScenario].equityMultiple}x` },
                    ].map(metric => (
                      <div 
                        key={metric.label}
                        className="p-3 rounded-xl"
                        style={{ backgroundColor: metric.highlight ? t.primaryGhost : t.bgAlt }}
                      >
                        <p className="text-xs" style={{ color: t.textMuted }}>{metric.label}</p>
                        <p className="font-mono text-lg font-semibold" style={{ color: metric.highlight ? t.primary : t.text }}>
                          {metric.value}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Sensitivity Slider */}
                <div 
                  className="p-5 rounded-xl"
                  style={{ backgroundColor: t.bgAlt }}
                >
                  <h4 className="font-semibold mb-4" style={{ color: t.text }}>
                    Cap Rate Sensitivity
                  </h4>
                  
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm" style={{ color: t.textMuted }}>Adjust Cap Rate</span>
                      <span className="font-mono text-lg font-bold" style={{ color: t.primary }}>
                        {capRateSlider.toFixed(2)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="3.5"
                      max="7"
                      step="0.05"
                      value={capRateSlider}
                      onChange={(e) => setCapRateSlider(parseFloat(e.target.value))}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs mt-1" style={{ color: t.textMuted }}>
                      <span>3.50%</span>
                      <span>7.00%</span>
                    </div>
                  </div>

                  <div 
                    className="p-4 rounded-xl"
                    style={{ backgroundColor: t.bgCard, border: `1px solid ${t.border}` }}
                  >
                    <p className="text-xs mb-1" style={{ color: t.textMuted }}>Implied Price at {capRateSlider.toFixed(2)}% Cap</p>
                    <p className="font-mono text-2xl font-bold" style={{ color: t.text }}>
                      {formatCurrency(derivedPrice, true)}
                    </p>
                    <p className="text-sm mt-2" style={{ color: t.textSecondary }}>
                      {derivedPrice > property.bovPricing[pricingScenario].price ? (
                        <span style={{ color: t.success }}>
                          +{formatCurrency(derivedPrice - property.bovPricing[pricingScenario].price, true)} above {pricingScenario}
                        </span>
                      ) : (
                        <span style={{ color: t.danger }}>
                          {formatCurrency(derivedPrice - property.bovPricing[pricingScenario].price, true)} below {pricingScenario}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              /* OM: Manual pricing guidance */
              <div className="grid grid-cols-2 gap-8">
                <div>
                  <label className="text-sm font-medium mb-2 block" style={{ color: t.textSecondary }}>
                    Pricing Guidance (User Input)
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg" style={{ color: t.textMuted }}>$</span>
                    <input
                      type="text"
                      value={pricingGuidance.toLocaleString()}
                      onChange={(e) => setPricingGuidance(parseInt(e.target.value.replace(/,/g, '')) || 0)}
                      className="w-full pl-8 pr-4 py-4 rounded-xl text-2xl font-mono font-bold outline-none"
                      style={{ backgroundColor: t.bgAlt, border: `1px solid ${t.border}`, color: t.text }}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-6">
                    {[
                      { label: 'Going-In Cap (T12)', value: `${pricingMetrics.goingInCap}%`, highlight: true },
                      { label: 'Y1 Cap Rate', value: `${pricingMetrics.y1Cap}%`, highlight: true },
                      { label: '$/Unit', value: formatCurrency(pricingMetrics.pricePerUnit, true) },
                      { label: '$/SF', value: `$${pricingMetrics.pricePerSF}` },
                    ].map(metric => (
                      <div 
                        key={metric.label}
                        className="p-3 rounded-xl"
                        style={{ backgroundColor: metric.highlight ? t.primaryGhost : t.bgAlt }}
                      >
                        <p className="text-xs" style={{ color: t.textMuted }}>{metric.label}</p>
                        <p className="font-mono text-lg font-semibold" style={{ color: metric.highlight ? t.primary : t.text }}>
                          {metric.value}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Sensitivity Slider for OM */}
                <div 
                  className="p-5 rounded-xl"
                  style={{ backgroundColor: t.bgAlt }}
                >
                  <h4 className="font-semibold mb-4" style={{ color: t.text }}>
                    What Cap Rate Gets Me There?
                  </h4>
                  
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm" style={{ color: t.textMuted }}>Target Cap Rate</span>
                      <span className="font-mono text-lg font-bold" style={{ color: t.primary }}>
                        {capRateSlider.toFixed(2)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="3.5"
                      max="7"
                      step="0.05"
                      value={capRateSlider}
                      onChange={(e) => setCapRateSlider(parseFloat(e.target.value))}
                      className="w-full"
                    />
                  </div>

                  <div 
                    className="p-4 rounded-xl"
                    style={{ backgroundColor: t.bgCard, border: `1px solid ${t.border}` }}
                  >
                    <p className="text-xs mb-1" style={{ color: t.textMuted }}>Max Price at {capRateSlider.toFixed(2)}% Cap</p>
                    <p className="font-mono text-2xl font-bold" style={{ color: t.text }}>
                      {formatCurrency(derivedPrice, true)}
                    </p>
                    <p className="text-sm mt-2" style={{ color: derivedPrice >= pricingGuidance ? t.success : t.danger }}>
                      {derivedPrice >= pricingGuidance 
                        ? `✓ Within guidance (+${formatCurrency(derivedPrice - pricingGuidance, true)})`
                        : `✗ Below guidance (${formatCurrency(derivedPrice - pricingGuidance, true)})`
                      }
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </motion.section>

        {/* === OPERATING FINANCIALS === */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: animationPhase >= 3 ? 1 : 0, y: animationPhase >= 3 ? 0 : 20 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-bold" style={{ color: t.text }}>Operating Financials</h2>
            <div className="flex items-center gap-3">
              {/* Period Toggle */}
              <div 
                className="flex items-center rounded-xl p-1"
                style={{ backgroundColor: t.bgAlt }}
              >
                {['t3', 't12', 'y1'].map(period => (
                  <button
                    key={period}
                    onClick={() => setFinancialPeriod(period)}
                    className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                    style={{ 
                      backgroundColor: financialPeriod === period ? t.primaryGhost : 'transparent',
                      color: financialPeriod === period ? t.primary : t.textSecondary
                    }}
                  >
                    {period === 't3' ? 'T3' : period === 't12' ? 'T12' : 'Y1 Pro Forma'}
                  </button>
                ))}
              </div>

              {/* View Toggle */}
              <div 
                className="flex items-center rounded-xl p-1"
                style={{ backgroundColor: t.bgAlt }}
              >
                <button
                  onClick={() => setFinancialView('total')}
                  className="px-3 py-2 rounded-lg text-sm font-medium transition-all"
                  style={{ 
                    backgroundColor: financialView === 'total' ? t.primaryGhost : 'transparent',
                    color: financialView === 'total' ? t.primary : t.textSecondary
                  }}
                >
                  Total $
                </button>
                <button
                  onClick={() => setFinancialView('perUnit')}
                  className="px-3 py-2 rounded-lg text-sm font-medium transition-all"
                  style={{ 
                    backgroundColor: financialView === 'perUnit' ? t.primaryGhost : 'transparent',
                    color: financialView === 'perUnit' ? t.primary : t.textSecondary
                  }}
                >
                  $/Unit
                </button>
              </div>
            </div>
          </div>

          <div 
            className="rounded-2xl p-6"
            style={{ backgroundColor: t.bgCard, border: `1px solid ${t.border}` }}
          >
            <div className="grid grid-cols-2 gap-8">
              {/* Revenue */}
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: t.textMuted }}>
                  Revenue
                </h3>
                <FinancialRow label="Gross Potential Rent (GPR)" value={currentFinancials.gpr} />
                {currentFinancials.lossToLease > 0 && (
                  <FinancialRow label="Loss to Lease" value={currentFinancials.lossToLease} isDeduction />
                )}
                <FinancialRow label="Vacancy" value={currentFinancials.vacancy} isDeduction />
                <FinancialRow label="Concessions" value={currentFinancials.concessions} isDeduction />
                <FinancialRow label="Bad Debt" value={currentFinancials.badDebt} isDeduction />
                <FinancialRow label="Non-Revenue Units" value={currentFinancials.nonRevenue} isDeduction />
                <FinancialRow 
                  label="Economic Occupancy" 
                  value={economicOccupancy.amount} 
                  percent={economicOccupancy.percent}
                  isHighlight 
                />
                <FinancialRow label="Other Income" value={currentFinancials.otherIncome} />
                <FinancialRow label="Effective Gross Income (EGI)" value={currentFinancials.egi} isTotal />
              </div>

              {/* Expenses & NOI */}
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: t.textMuted }}>
                  Expenses & NOI
                </h3>
                <FinancialRow 
                  label="Total Operating Expenses" 
                  value={currentFinancials.totalOpex} 
                  isDeduction
                  percent={parseFloat(opexPercent)}
                />
                <FinancialRow label="Management Fee" value={currentFinancials.managementFee} isDeduction />
                <FinancialRow label="Replacement Reserves" value={currentFinancials.reserves} isDeduction />
                
                <div className="mt-6 pt-4" style={{ borderTop: `2px solid ${t.primary}` }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold" style={{ color: t.text }}>Net Operating Income (NOI)</p>
                      <p className="text-xs mt-0.5" style={{ color: t.textMuted }}>
                        {financialPeriod === 't3' ? 'Trailing 3 Month (Annualized)' : 
                         financialPeriod === 't12' ? 'Trailing 12 Month' : 'Year 1 Pro Forma'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-3xl font-bold" style={{ color: t.success }}>
                        {financialView === 'perUnit' 
                          ? formatPerUnit(currentFinancials.noi)
                          : formatCurrency(currentFinancials.noi)
                        }
                      </p>
                      {financialView === 'total' && (
                        <p className="font-mono text-sm" style={{ color: t.textMuted }}>
                          {formatPerUnit(currentFinancials.noi)}/unit
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* OpEx % Callout */}
                <div 
                  className="mt-6 p-4 rounded-xl flex items-center justify-between"
                  style={{ backgroundColor: t.bgAlt }}
                >
                  <span style={{ color: t.textSecondary }}>OpEx Ratio (% of GPR)</span>
                  <span className="font-mono text-xl font-bold" style={{ color: t.text }}>
                    {opexPercent}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        {/* === UNIT MIX SUMMARY === */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: animationPhase >= 4 ? 1 : 0, y: animationPhase >= 4 ? 0 : 20 }}
        >
          <h2 className="font-display text-lg font-bold mb-4" style={{ color: t.text }}>Unit Mix Summary</h2>
          
          <div 
            className="rounded-2xl overflow-hidden"
            style={{ backgroundColor: t.bgCard, border: `1px solid ${t.border}` }}
          >
            <div 
              className="grid grid-cols-5 gap-4 px-6 py-3 text-xs font-semibold uppercase tracking-wider"
              style={{ backgroundColor: t.bgAlt, color: t.textMuted }}
            >
              <div>Unit Type</div>
              <div className="text-right">Units</div>
              <div className="text-right">Avg SF</div>
              <div className="text-right">Avg Rent</div>
              <div className="text-right">% of Total</div>
            </div>
            
            {property.unitMix.map((unit, index) => (
              <div 
                key={unit.type}
                className="grid grid-cols-5 gap-4 px-6 py-4"
                style={{ 
                  backgroundColor: index % 2 === 0 ? 'transparent' : t.bgAlt + '40',
                  borderBottom: index < property.unitMix.length - 1 ? `1px solid ${t.border}` : 'none'
                }}
              >
                <div className="font-medium" style={{ color: t.text }}>{unit.type}</div>
                <div className="text-right font-mono" style={{ color: t.text }}>{unit.units}</div>
                <div className="text-right font-mono" style={{ color: t.textSecondary }}>{unit.avgSF.toLocaleString()}</div>
                <div className="text-right font-mono" style={{ color: t.success }}>${unit.avgRent.toLocaleString()}</div>
                <div className="text-right font-mono" style={{ color: t.textSecondary }}>{unit.percentTotal}%</div>
              </div>
            ))}

            {/* Totals */}
            <div 
              className="grid grid-cols-5 gap-4 px-6 py-4 font-semibold"
              style={{ backgroundColor: t.primaryGhost }}
            >
              <div style={{ color: t.primary }}>Total</div>
              <div className="text-right font-mono" style={{ color: t.primary }}>{property.units}</div>
              <div className="text-right font-mono" style={{ color: t.textSecondary }}>
                {Math.round(property.totalSF / property.units).toLocaleString()}
              </div>
              <div className="text-right font-mono" style={{ color: t.success }}>
                ${property.inPlaceRent.toLocaleString()}
              </div>
              <div className="text-right font-mono" style={{ color: t.primary }}>100%</div>
            </div>
          </div>
        </motion.section>

        {/* === SPECIAL CONSIDERATIONS === */}
        {(property.hasTaxAbatement || property.hasRenovation || property.hasRetail || property.hasAffordability || property.hasDebtAssumption) && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: animationPhase >= 4 ? 1 : 0, y: animationPhase >= 4 ? 0 : 20 }}
          >
            <h2 className="font-display text-lg font-bold mb-4" style={{ color: t.text }}>Special Considerations</h2>
            
            <div className="grid grid-cols-2 gap-4">
              {property.hasTaxAbatement && (
                <div 
                  className="rounded-xl p-5"
                  style={{ backgroundColor: t.bgCard, border: `1px solid ${t.border}` }}
                >
                  <div className="flex items-start gap-3">
                    <div 
                      className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: t.warningGhost }}
                    >
                      <TaxIcon className="w-5 h-5" style={{ color: t.warning }} />
                    </div>
                    <div>
                      <h4 className="font-semibold" style={{ color: t.text }}>Tax Abatement</h4>
                      <p className="text-sm mt-1" style={{ color: t.textSecondary }}>
                        Expires: {new Date(property.taxAbatementExpiry).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                      </p>
                      <p className="text-xs mt-2 px-2 py-1 rounded-lg inline-block" style={{ backgroundColor: t.warningGhost, color: t.warning }}>
                        Factor into hold period analysis
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {property.hasRenovation && (
                <div 
                  className="rounded-xl p-5"
                  style={{ backgroundColor: t.bgCard, border: `1px solid ${t.border}` }}
                >
                  <div className="flex items-start gap-3">
                    <div 
                      className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: t.primaryGhost }}
                    >
                      <RenovationIcon className="w-5 h-5" style={{ color: t.primary }} />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold" style={{ color: t.text }}>Renovation Program</h4>
                      <p className="text-sm mt-1" style={{ color: t.textSecondary }}>
                        Budget: {formatCurrency(property.renovationBudget, true)} · {property.renovationUnitsComplete}/{property.units} units complete
                      </p>
                      <div className="mt-2 h-2 rounded-full overflow-hidden" style={{ backgroundColor: t.bgAlt }}>
                        <div 
                          className="h-full rounded-full"
                          style={{ 
                            width: `${(property.renovationUnitsComplete / property.units) * 100}%`,
                            backgroundColor: t.primary
                          }}
                        />
                      </div>
                      <p className="text-xs mt-1" style={{ color: t.textMuted }}>
                        {Math.round((property.renovationUnitsComplete / property.units) * 100)}% complete
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.section>
        )}

        {/* === DOCUMENTS === */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: animationPhase >= 5 ? 1 : 0, y: animationPhase >= 5 ? 0 : 20 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-bold" style={{ color: t.text }}>Documents</h2>
            <span className="text-sm" style={{ color: t.textMuted }}>{property.documents.length} files</span>
          </div>
          
          <div className="grid grid-cols-3 gap-4">
            {property.documents.map(doc => (
              <div 
                key={doc.id}
                className="rounded-xl p-4 transition-all hover:scale-[1.02] cursor-pointer group"
                style={{ backgroundColor: t.bgCard, border: `1px solid ${t.border}` }}
              >
                <div className="flex items-start gap-3">
                  <div 
                    className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: doc.type === 'bov' || doc.type === 'om' ? t.blueGhost : t.successGhost }}
                  >
                    {doc.name.endsWith('.pdf') ? (
                      <PDFIcon className="w-6 h-6" style={{ color: t.blue }} />
                    ) : (
                      <ExcelIcon className="w-6 h-6" style={{ color: t.success }} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate group-hover:text-primary transition-colors" style={{ color: t.text }}>
                      {doc.name}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span 
                        className="px-2 py-0.5 rounded text-[10px] font-bold uppercase"
                        style={{ 
                          backgroundColor: doc.type === 'bov' ? t.blueGhost : doc.type === 'om' ? t.primaryGhost : t.successGhost,
                          color: doc.type === 'bov' ? t.blue : doc.type === 'om' ? t.primary : t.success
                        }}
                      >
                        {doc.type}
                      </span>
                      {doc.pages && (
                        <span className="text-xs" style={{ color: t.textMuted }}>{doc.pages} pages</span>
                      )}
                    </div>
                    <p className="text-xs mt-2" style={{ color: t.textMuted }}>
                      {doc.dataPoints} data points extracted
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 mt-4 pt-3" style={{ borderTop: `1px solid ${t.border}` }}>
                  <button 
                    className="flex-1 py-2 rounded-lg text-xs font-medium transition-colors"
                    style={{ backgroundColor: t.bgAlt, color: t.textSecondary }}
                  >
                    View
                  </button>
                  <button 
                    className="flex-1 py-2 rounded-lg text-xs font-medium transition-colors"
                    style={{ backgroundColor: t.primaryGhost, color: t.primary }}
                  >
                    Re-analyze
                  </button>
                </div>
              </div>
            ))}
          </div>
        </motion.section>

        {/* === NOTES & ACTIVITY === */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: animationPhase >= 5 ? 1 : 0, y: animationPhase >= 5 ? 0 : 20 }}
        >
          <h2 className="font-display text-lg font-bold mb-4" style={{ color: t.text }}>Notes & Activity</h2>
          
          <div className="grid grid-cols-2 gap-6">
            {/* Notes */}
            <div 
              className="rounded-2xl p-5"
              style={{ backgroundColor: t.bgCard, border: `1px solid ${t.border}` }}
            >
              <h3 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: t.textMuted }}>Notes</h3>
              
              {/* Add Note */}
              <div className="mb-4">
                <textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Add a note..."
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none"
                  style={{ backgroundColor: t.bgAlt, border: `1px solid ${t.border}`, color: t.text }}
                />
                <div className="flex justify-end mt-2">
                  <button
                    onClick={addNote}
                    disabled={!newNote.trim()}
                    className="px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
                    style={{ backgroundColor: t.primary, color: '#fff' }}
                  >
                    Add Note
                  </button>
                </div>
              </div>

              {/* Existing Notes */}
              <div className="space-y-3">
                {property.notes.map(note => (
                  <div 
                    key={note.id}
                    className="p-4 rounded-xl"
                    style={{ backgroundColor: t.bgAlt }}
                  >
                    <p className="text-sm" style={{ color: t.text }}>{note.text}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs font-medium" style={{ color: t.primary }}>{note.author}</span>
                      <span className="text-xs" style={{ color: t.textMuted }}>
                        {formatDate(note.timestamp)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Activity */}
            <div 
              className="rounded-2xl p-5"
              style={{ backgroundColor: t.bgCard, border: `1px solid ${t.border}` }}
            >
              <h3 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: t.textMuted }}>Activity</h3>
              
              <div className="space-y-4">
                {property.activity.map((item, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <div 
                      className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                      style={{ 
                        backgroundColor: item.type === 'upload' ? t.blueGhost : 
                                        item.type === 'analysis' ? t.successGhost : t.warningGhost 
                      }}
                    >
                      {item.type === 'upload' ? <UploadIcon className="w-4 h-4" style={{ color: t.blue }} /> :
                       item.type === 'analysis' ? <SparkleIcon className="w-4 h-4" style={{ color: t.success }} /> :
                       <StageIcon className="w-4 h-4" style={{ color: t.warning }} />}
                    </div>
                    <div>
                      <p className="text-sm" style={{ color: t.text }}>{item.description}</p>
                      <p className="text-xs mt-0.5" style={{ color: t.textMuted }}>
                        {formatDate(item.timestamp)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.section>

        {/* === DATA SOURCES === */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: animationPhase >= 5 ? 1 : 0, y: animationPhase >= 5 ? 0 : 20 }}
        >
          <button
            onClick={() => setShowSourcesPanel(!showSourcesPanel)}
            className="flex items-center gap-2 text-sm font-medium transition-colors"
            style={{ color: t.primary }}
          >
            <DatabaseIcon className="w-4 h-4" />
            {showSourcesPanel ? 'Hide' : 'View'} Data Sources
            <ChevronDownIcon className={`w-4 h-4 transition-transform ${showSourcesPanel ? 'rotate-180' : ''}`} />
          </button>
          
          <AnimatePresence>
            {showSourcesPanel && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4 rounded-2xl overflow-hidden"
                style={{ backgroundColor: t.bgCard, border: `1px solid ${t.border}` }}
              >
                <div className="p-5">
                  <p className="text-sm mb-4" style={{ color: t.textSecondary }}>
                    All extracted fields with their sources. Click any field to override manually.
                  </p>
                  
                  <div className="grid grid-cols-2 gap-4">
                    {Object.entries(property.dataSources).map(([field, source]) => (
                      <div 
                        key={field}
                        className="flex items-center justify-between p-3 rounded-xl cursor-pointer transition-colors hover:bg-opacity-50"
                        style={{ backgroundColor: t.bgAlt }}
                      >
                        <div>
                          <p className="text-sm font-medium" style={{ color: t.text }}>{field}</p>
                          <p className="text-xs" style={{ color: t.textMuted }}>
                            {source.source} {source.page ? `p.${source.page}` : ''} {source.sheet ? `(${source.sheet})` : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span 
                            className={`w-2 h-2 rounded-full`}
                            style={{ backgroundColor: source.confidence === 'high' ? t.success : t.warning }}
                          />
                          <EditIcon className="w-4 h-4" style={{ color: t.textMuted }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.section>

      </main>

      {/* === AI ANALYSIS PANEL === */}
      <AnimatePresence>
        {showAIPanel && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-end"
            style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
            onClick={() => setShowAIPanel(false)}
          >
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25 }}
              className="h-full w-full max-w-lg overflow-y-auto"
              style={{ backgroundColor: t.bgCard, borderLeft: `1px solid ${t.border}` }}
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="sticky top-0 px-6 py-4 flex items-center justify-between" style={{ backgroundColor: t.bgCard, borderBottom: `1px solid ${t.border}` }}>
                <div className="flex items-center gap-3">
                  <div 
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: `linear-gradient(135deg, ${t.primary} 0%, ${t.primaryDark} 100%)` }}
                  >
                    <SparkleIcon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-display font-bold" style={{ color: t.text }}>AI Analysis</h3>
                    <p className="text-xs" style={{ color: t.textMuted }}>{property.name}</p>
                  </div>
                </div>
                <button onClick={() => setShowAIPanel(false)} className="p-2 rounded-lg" style={{ color: t.textMuted }}>
                  <XIcon className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 space-y-6">
                {/* Summary */}
                <div className="p-4 rounded-xl" style={{ backgroundColor: t.primaryGhost, border: `1px solid ${t.primary}30` }}>
                  <h4 className="font-semibold mb-2" style={{ color: t.primary }}>Back-of-Napkin Summary</h4>
                  <p className="text-sm leading-relaxed" style={{ color: t.text }}>
                    This {property.units}-unit {property.vintage} vintage asset in <strong>{property.submarket}</strong> shows 
                    in-place rents at <strong>${property.inPlaceRent}/unit</strong> with <strong>{property.lossToLeasePercent}% loss-to-lease</strong> upside 
                    to market. T12 NOI of <strong>{formatCurrency(property.financials.t12.noi, true)}</strong> implies a 
                    <strong> {((property.financials.t12.noi / property.bovPricing.market.price) * 100).toFixed(2)}% going-in cap</strong> at 
                    market pricing. Economic occupancy at <strong>{economicOccupancy.percent.toFixed(1)}%</strong> indicates 
                    {economicOccupancy.percent >= 90 ? ' healthy operations' : economicOccupancy.percent >= 85 ? ' room for operational improvement' : ' operational challenges to address'}.
                  </p>
                </div>

                {/* Key Insights */}
                <div>
                  <h4 className="font-semibold mb-3" style={{ color: t.text }}>Key Insights</h4>
                  <div className="space-y-2">
                    {[
                      { icon: '📈', text: `Loss-to-lease of ${property.lossToLeasePercent}% suggests ${formatCurrency(property.units * property.lossToLease * 12, true)} annual upside if rents pushed to market.` },
                      { icon: '🏗️', text: `Renovation program ${Math.round((property.renovationUnitsComplete / property.units) * 100)}% complete - verify rent premiums on renovated units vs classic.` },
                      { icon: '⚠️', text: `Tax abatement expires ${new Date(property.taxAbatementExpiry).getFullYear()} - model increased tax basis in hold period analysis.` },
                      { icon: '💰', text: `At market price of ${formatCurrency(property.bovPricing.market.price, true)}, levered IRR projects to ${property.bovPricing.market.leveredIRR}% with ${property.bovPricing.market.equityMultiple}x equity multiple.` },
                    ].map((insight, i) => (
                      <div key={i} className="flex gap-3 p-3 rounded-xl" style={{ backgroundColor: t.bgAlt }}>
                        <span className="text-lg">{insight.icon}</span>
                        <p className="text-sm" style={{ color: t.textSecondary }}>{insight.text}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recommendation */}
                <div className="p-4 rounded-xl" style={{ backgroundColor: t.successGhost, border: `1px solid ${t.success}30` }}>
                  <h4 className="font-semibold mb-2" style={{ color: t.success }}>Recommendation</h4>
                  <p className="text-sm" style={{ color: t.text }}>
                    Proceed with due diligence. Focus verification on: (1) renovated unit rent premiums, 
                    (2) concession burn-off timeline, and (3) post-abatement tax projections. 
                    Strong Buckhead location supports basis at market price level.
                  </p>
                </div>

                {/* Ask Follow-up */}
                <div>
                  <h4 className="font-semibold mb-3" style={{ color: t.text }}>Ask a Follow-up</h4>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="E.g., What's the rent growth assumption in the Y1 proforma?"
                      className="w-full px-4 py-3 pr-12 rounded-xl text-sm outline-none"
                      style={{ backgroundColor: t.bgAlt, border: `1px solid ${t.border}`, color: t.text }}
                    />
                    <button
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg"
                      style={{ backgroundColor: t.primary, color: '#fff' }}
                    >
                      <ArrowRightIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
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

const ArrowRightIcon = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
  </svg>
);

const ChevronDownIcon = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
  </svg>
);

const SparkleIcon = ({ className, style }) => (
  <svg className={className} style={style} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
  </svg>
);

const RefreshIcon = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

const MoreIcon = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
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

const XIcon = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const TaxIcon = ({ className, style }) => (
  <svg className={className} style={style} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
  </svg>
);

const RenovationIcon = ({ className, style }) => (
  <svg className={className} style={style} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
  </svg>
);

const PDFIcon = ({ className, style }) => (
  <svg className={className} style={style} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
  </svg>
);

const ExcelIcon = ({ className, style }) => (
  <svg className={className} style={style} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
  </svg>
);

const UploadIcon = ({ className, style }) => (
  <svg className={className} style={style} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
  </svg>
);

const StageIcon = ({ className, style }) => (
  <svg className={className} style={style} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
  </svg>
);

const DatabaseIcon = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
  </svg>
);

const EditIcon = ({ className, style }) => (
  <svg className={className} style={style} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);

export default AstraPropertyDetail;
