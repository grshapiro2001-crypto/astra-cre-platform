import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';

/**
 * ASTRA CRE - DASHBOARD V1
 * "Your Configurable Deal Command Center"
 * 
 * CORE FEATURES:
 * 1. Tag-pill filtering - Filter entire dashboard by deal tags
 * 2. Kanban pipeline - Customizable stages with preset templates
 * 3. Metrics library - User picks which 6-8 metrics to display
 * 4. Widget show/hide + reorder
 * 5. AI Summary panel - Button-triggered analysis modal
 * 6. Charts: Status donut, Geographic bars, Deal Score dot plot
 * 
 * DESIGN: Purple palette matching Library V3 and Comparison V3
 */

const AstraDashboard = () => {
  // === STATE ===
  const [darkMode, setDarkMode] = useState(true);
  const [selectedTags, setSelectedTags] = useState([]);
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [aiQuery, setAiQuery] = useState('');
  const [aiResponse, setAiResponse] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [showMetricsEditor, setShowMetricsEditor] = useState(false);
  const [showStageEditor, setShowStageEditor] = useState(false);
  const [animationPhase, setAnimationPhase] = useState(0);
  const [draggedDeal, setDraggedDeal] = useState(null);

  // Widget visibility and order
  const [widgets, setWidgets] = useState([
    { id: 'metrics', label: 'Key Metrics', visible: true },
    { id: 'kanban', label: 'Pipeline Board', visible: true },
    { id: 'charts', label: 'Analytics', visible: true },
  ]);

  // Selected metrics (user customizable)
  const [selectedMetrics, setSelectedMetrics] = useState([
    'totalValue', 'totalUnits', 'activeDeals', 'avgScore', 
    'avgCapRate', 'avgPricePerUnit', 'avgDealSize', 'dealCount'
  ]);

  // Kanban stages (customizable)
  const [pipelineTemplate, setPipelineTemplate] = useState('acquisitions');
  const [stages, setStages] = useState([
    { id: 'sourced', label: 'Sourced', color: '#60A5FA' },
    { id: 'screening', label: 'Screening', color: '#A78BFA' },
    { id: 'dueDiligence', label: 'Due Diligence', color: '#FBBF24' },
    { id: 'closing', label: 'Closing', color: '#34D399' },
    { id: 'closed', label: 'Closed', color: '#10B981' },
  ]);

  // Animation
  useEffect(() => {
    const timers = [
      setTimeout(() => setAnimationPhase(1), 100),
      setTimeout(() => setAnimationPhase(2), 300),
      setTimeout(() => setAnimationPhase(3), 600),
      setTimeout(() => setAnimationPhase(4), 900),
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

  // === SAMPLE DATA ===
  const allTags = ['Georgia', 'Texas', 'Florida', 'Value-Add', 'Core-Plus', 'Core', 'Lease-Up', 'Sunbelt', '200+ Units', 'Under $50M'];

  const deals = [
    {
      id: 1,
      name: "The Overlook",
      city: "Lawrenceville, GA",
      submarket: "Gwinnett County",
      state: "Georgia",
      units: 410,
      totalPrice: 90800000,
      pricePerUnit: 221500,
      capRateT12: 4.75,
      capRateY1: 5.15,
      score: 76,
      stage: 'dueDiligence',
      tags: ['Georgia', 'Value-Add', 'Sunbelt', '200+ Units'],
      thumbnail: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=400&h=300&fit=crop",
    },
    {
      id: 2,
      name: "Beacon Station",
      city: "Augusta, GA",
      submarket: "Central Savannah",
      state: "Georgia",
      units: 221,
      totalPrice: 53600000,
      pricePerUnit: 242500,
      capRateT12: 5.15,
      capRateY1: 5.42,
      score: 82,
      stage: 'closing',
      tags: ['Georgia', 'Core-Plus', 'Sunbelt', '200+ Units'],
      thumbnail: "https://images.unsplash.com/photo-1460317442991-0ec209397118?w=400&h=300&fit=crop",
    },
    {
      id: 3,
      name: "Creekview Vista",
      city: "LaGrange, GA",
      submarket: "West Georgia",
      state: "Georgia",
      units: 279,
      totalPrice: 55100000,
      pricePerUnit: 197500,
      capRateT12: null,
      capRateY1: 5.42,
      score: 68,
      stage: 'screening',
      tags: ['Georgia', 'Lease-Up', 'Sunbelt', '200+ Units'],
      thumbnail: "https://images.unsplash.com/photo-1574362848149-11496d93a7c7?w=400&h=300&fit=crop",
    },
    {
      id: 4,
      name: "Carmel Vista",
      city: "McDonough, GA",
      submarket: "Henry County",
      state: "Georgia",
      units: 228,
      totalPrice: 45700000,
      pricePerUnit: 200400,
      capRateT12: 4.12,
      capRateY1: 4.85,
      score: 71,
      stage: 'screening',
      tags: ['Georgia', 'Value-Add', 'Sunbelt', 'Under $50M'],
      thumbnail: "https://images.unsplash.com/photo-1567496898669-ee935f5f647a?w=400&h=300&fit=crop",
    },
    {
      id: 5,
      name: "The Edison",
      city: "Atlanta, GA",
      submarket: "Midtown",
      state: "Georgia",
      units: 185,
      totalPrice: 72500000,
      pricePerUnit: 391892,
      capRateT12: 4.25,
      capRateY1: 4.65,
      score: 79,
      stage: 'sourced',
      tags: ['Georgia', 'Core-Plus', 'Sunbelt'],
      thumbnail: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=400&h=300&fit=crop",
    },
    {
      id: 6,
      name: "Palms at Riverside",
      city: "Macon, GA",
      submarket: "Central Georgia",
      state: "Georgia",
      units: 312,
      totalPrice: 52000000,
      pricePerUnit: 166667,
      capRateT12: 5.45,
      capRateY1: 5.85,
      score: 64,
      stage: 'closed',
      tags: ['Georgia', 'Core', 'Sunbelt', '200+ Units'],
      thumbnail: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=400&h=300&fit=crop",
    },
    {
      id: 7,
      name: "Lone Star Commons",
      city: "Austin, TX",
      submarket: "North Austin",
      state: "Texas",
      units: 340,
      totalPrice: 78000000,
      pricePerUnit: 229412,
      capRateT12: 4.95,
      capRateY1: 5.35,
      score: 77,
      stage: 'dueDiligence',
      tags: ['Texas', 'Value-Add', 'Sunbelt', '200+ Units'],
      thumbnail: "https://images.unsplash.com/photo-1460317442991-0ec209397118?w=400&h=300&fit=crop",
    },
    {
      id: 8,
      name: "Riverside Flats",
      city: "San Antonio, TX",
      submarket: "Downtown",
      state: "Texas",
      units: 198,
      totalPrice: 41500000,
      pricePerUnit: 209596,
      capRateT12: 5.25,
      capRateY1: 5.65,
      score: 73,
      stage: 'sourced',
      tags: ['Texas', 'Core-Plus', 'Sunbelt', 'Under $50M'],
      thumbnail: "https://images.unsplash.com/photo-1574362848149-11496d93a7c7?w=400&h=300&fit=crop",
    },
  ];

  // === FILTERED DATA ===
  const filteredDeals = useMemo(() => {
    if (selectedTags.length === 0) return deals;
    return deals.filter(deal => 
      selectedTags.every(tag => deal.tags.includes(tag))
    );
  }, [deals, selectedTags]);

  // === METRICS CALCULATION ===
  const metrics = useMemo(() => {
    const activeDeals = filteredDeals.filter(d => d.stage !== 'closed');
    const dealsWithCap = filteredDeals.filter(d => d.capRateT12 !== null);
    
    return {
      totalValue: filteredDeals.reduce((sum, d) => sum + d.totalPrice, 0),
      totalUnits: filteredDeals.reduce((sum, d) => sum + d.units, 0),
      dealCount: filteredDeals.length,
      activeDeals: activeDeals.length,
      avgScore: filteredDeals.length > 0 
        ? Math.round(filteredDeals.reduce((sum, d) => sum + d.score, 0) / filteredDeals.length)
        : 0,
      avgCapRate: dealsWithCap.length > 0
        ? (dealsWithCap.reduce((sum, d) => sum + d.capRateT12, 0) / dealsWithCap.length).toFixed(2)
        : null,
      avgCapRateY1: filteredDeals.filter(d => d.capRateY1).length > 0
        ? (filteredDeals.filter(d => d.capRateY1).reduce((sum, d) => sum + d.capRateY1, 0) / filteredDeals.filter(d => d.capRateY1).length).toFixed(2)
        : null,
      avgPricePerUnit: filteredDeals.length > 0
        ? Math.round(filteredDeals.reduce((sum, d) => sum + d.pricePerUnit, 0) / filteredDeals.length)
        : 0,
      avgDealSize: filteredDeals.length > 0
        ? filteredDeals.reduce((sum, d) => sum + d.totalPrice, 0) / filteredDeals.length
        : 0,
      closedDeals: filteredDeals.filter(d => d.stage === 'closed').length,
      highestScore: filteredDeals.length > 0 ? Math.max(...filteredDeals.map(d => d.score)) : 0,
      lowestScore: filteredDeals.length > 0 ? Math.min(...filteredDeals.map(d => d.score)) : 0,
    };
  }, [filteredDeals]);

  // === METRICS LIBRARY ===
  const metricsLibrary = {
    totalValue: { label: 'Total Pipeline Value', format: (v) => formatPrice(v), icon: DollarIcon },
    totalUnits: { label: 'Total Units', format: (v) => v.toLocaleString(), icon: BuildingIcon },
    dealCount: { label: 'Total Deals', format: (v) => v, icon: FolderIcon },
    activeDeals: { label: 'Active Deals', format: (v) => v, icon: ZapIcon },
    avgScore: { label: 'Avg Deal Score', format: (v) => v, icon: TrophyIcon, color: true },
    avgCapRate: { label: 'Avg Cap (T12)', format: (v) => v ? `${v}%` : '—', icon: PercentIcon },
    avgCapRateY1: { label: 'Avg Cap (Y1)', format: (v) => v ? `${v}%` : '—', icon: PercentIcon },
    avgPricePerUnit: { label: 'Avg $/Unit', format: (v) => formatPrice(v), icon: TagIcon },
    avgDealSize: { label: 'Avg Deal Size', format: (v) => formatPrice(v), icon: ScaleIcon },
    closedDeals: { label: 'Closed Deals', format: (v) => v, icon: CheckCircleIcon },
    highestScore: { label: 'Highest Score', format: (v) => v, icon: ArrowUpIcon },
    lowestScore: { label: 'Lowest Score', format: (v) => v, icon: ArrowDownIcon },
  };

  // === STAGE TEMPLATES ===
  const stageTemplates = {
    acquisitions: {
      label: 'Acquisitions Pipeline',
      stages: [
        { id: 'sourced', label: 'Sourced', color: '#60A5FA' },
        { id: 'screening', label: 'Screening', color: '#A78BFA' },
        { id: 'dueDiligence', label: 'Due Diligence', color: '#FBBF24' },
        { id: 'closing', label: 'Closing', color: '#34D399' },
        { id: 'closed', label: 'Closed', color: '#10B981' },
      ]
    },
    dispositions: {
      label: 'Disposition Tracker',
      stages: [
        { id: 'prep', label: 'Prep', color: '#60A5FA' },
        { id: 'listed', label: 'Listed', color: '#A78BFA' },
        { id: 'offers', label: 'Offers', color: '#FBBF24' },
        { id: 'underContract', label: 'Under Contract', color: '#34D399' },
        { id: 'sold', label: 'Sold', color: '#10B981' },
      ]
    },
    broker: {
      label: 'Broker Pipeline',
      stages: [
        { id: 'lead', label: 'Lead', color: '#60A5FA' },
        { id: 'pitch', label: 'Pitch', color: '#A78BFA' },
        { id: 'listing', label: 'Listing', color: '#FBBF24' },
        { id: 'marketing', label: 'Marketing', color: '#F97316' },
        { id: 'offers', label: 'Offers', color: '#34D399' },
        { id: 'closed', label: 'Closed', color: '#10B981' },
      ]
    }
  };

  // === HELPERS ===
  const formatPrice = (num) => {
    if (!num) return '—';
    if (num >= 1000000000) return `$${(num / 1000000000).toFixed(2)}B`;
    if (num >= 1000000) return `$${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `$${(num / 1000).toFixed(0)}K`;
    return `$${num}`;
  };

  const getScoreColor = (score) => {
    if (score >= 80) return t.success;
    if (score >= 70) return t.primary;
    if (score >= 60) return t.warning;
    return t.danger;
  };

  const toggleTag = (tag) => {
    setSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const applyTemplate = (templateId) => {
    setPipelineTemplate(templateId);
    setStages(stageTemplates[templateId].stages);
    setShowStageEditor(false);
  };

  // Move deal between stages
  const moveDeal = (dealId, newStage) => {
    // In real app, this would update state/API
    console.log(`Moving deal ${dealId} to ${newStage}`);
    setDraggedDeal(null);
  };

  // === AI SUMMARY ===
  const generateAISummary = useCallback(async (query) => {
    setAiLoading(true);
    
    // Simulate AI response
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const tagContext = selectedTags.length > 0 
      ? `for ${selectedTags.join(' + ')} deals` 
      : 'across your entire pipeline';
    
    const response = {
      summary: `Your pipeline ${tagContext} contains ${filteredDeals.length} deals totaling ${formatPrice(metrics.totalValue)} across ${metrics.totalUnits.toLocaleString()} units.`,
      insights: [
        `Average deal score is ${metrics.avgScore}/100, indicating ${metrics.avgScore >= 75 ? 'strong' : metrics.avgScore >= 65 ? 'moderate' : 'mixed'} overall quality.`,
        metrics.avgCapRate ? `T12 cap rates average ${metrics.avgCapRate}%, ${parseFloat(metrics.avgCapRate) >= 5 ? 'above' : 'below'} the typical 5% threshold for value-add.` : 'Several deals are in lease-up with no stabilized cap rate yet.',
        `${filteredDeals.filter(d => d.stage === 'dueDiligence' || d.stage === 'closing').length} deals are in active pursuit (Due Diligence or Closing).`,
      ],
      topDeal: filteredDeals.reduce((best, deal) => deal.score > (best?.score || 0) ? deal : best, null),
      recommendation: query.toLowerCase().includes('value-add') 
        ? 'Focus on The Overlook and Carmel Vista for value-add opportunities with renovation upside.'
        : query.toLowerCase().includes('core')
        ? 'Beacon Station offers the strongest stabilized returns in your Core-Plus segment.'
        : 'Consider moving Creekview Vista forward - lease-up risk is offset by strong submarket fundamentals.',
    };
    
    setAiResponse(response);
    setAiLoading(false);
  }, [filteredDeals, metrics, selectedTags]);

  // === CHART DATA ===
  const statusChartData = useMemo(() => {
    return stages.map(stage => ({
      ...stage,
      count: filteredDeals.filter(d => d.stage === stage.id).length,
      value: filteredDeals.filter(d => d.stage === stage.id).reduce((sum, d) => sum + d.totalPrice, 0),
    }));
  }, [filteredDeals, stages]);

  const geoChartData = useMemo(() => {
    const byState = {};
    filteredDeals.forEach(deal => {
      if (!byState[deal.state]) byState[deal.state] = { count: 0, value: 0 };
      byState[deal.state].count++;
      byState[deal.state].value += deal.totalPrice;
    });
    return Object.entries(byState)
      .map(([state, data]) => ({ state, ...data }))
      .sort((a, b) => b.value - a.value);
  }, [filteredDeals]);

  return (
    <div 
      className="min-h-screen transition-colors duration-500"
      style={{ backgroundColor: t.bg }}
    >
      {/* Fonts & Styles */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=Instrument+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&family=JetBrains+Mono:wght@400;500;600&display=swap');
        
        .font-display { font-family: 'Syne', sans-serif; }
        .font-body { font-family: 'Instrument Sans', sans-serif; }
        .font-mono { font-family: 'JetBrains Mono', monospace; }
        
        * { font-family: 'Instrument Sans', sans-serif; }
        
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { 
          background: ${darkMode ? 'rgba(167, 139, 250, 0.3)' : 'rgba(124, 58, 237, 0.2)'}; 
          border-radius: 3px; 
        }
      `}</style>

      {/* Ambient Background */}
      {darkMode && (
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <motion.div 
            className="absolute top-[-10%] right-[10%] w-[600px] h-[600px] rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(124, 58, 237, 0.1) 0%, transparent 60%)', filter: 'blur(80px)' }}
            animate={{ scale: [1, 1.1, 1], opacity: [0.5, 0.7, 0.5] }}
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div 
            className="absolute bottom-[-15%] left-[5%] w-[500px] h-[500px] rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(52, 211, 153, 0.08) 0%, transparent 60%)', filter: 'blur(100px)' }}
            animate={{ scale: [1, 1.05, 1], opacity: [0.3, 0.5, 0.3] }}
            transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 3 }}
          />
        </div>
      )}

      {/* === HEADER === */}
      <header 
        className="sticky top-0 z-50 transition-colors duration-300"
        style={{ 
          backgroundColor: darkMode ? 'rgba(15, 11, 21, 0.9)' : 'rgba(254, 252, 255, 0.9)',
          backdropFilter: 'blur(20px)',
          borderBottom: `1px solid ${t.border}`
        }}
      >
        <div className="max-w-[1800px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo + Title */}
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-4"
            >
              <div 
                className="w-11 h-11 rounded-xl flex items-center justify-center"
                style={{ 
                  background: `linear-gradient(135deg, ${t.primary} 0%, ${t.primaryDark} 100%)`,
                  boxShadow: `0 8px 24px ${t.primary}40`
                }}
              >
                <TrendingIcon className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="font-display text-2xl font-bold" style={{ color: t.text }}>
                  Dashboard
                </h1>
                <p className="text-sm" style={{ color: t.textSecondary }}>
                  {selectedTags.length > 0 
                    ? `Filtered: ${selectedTags.join(' + ')}`
                    : 'All Deals'
                  }
                </p>
              </div>
            </motion.div>

            {/* Actions */}
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-3"
            >
              {/* AI Summary Button */}
              <button
                onClick={() => setShowAIPanel(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
                style={{ 
                  background: `linear-gradient(135deg, ${t.primary} 0%, ${t.primaryDark} 100%)`,
                  color: '#fff',
                  boxShadow: `0 4px 12px ${t.primary}30`
                }}
              >
                <SparkleIcon className="w-4 h-4" />
                AI Summary
              </button>

              {/* New Deal */}
              <button
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
                style={{ backgroundColor: t.bgCard, border: `1px solid ${t.border}`, color: t.textSecondary }}
              >
                <PlusIcon className="w-4 h-4" />
                New Deal
              </button>

              {/* Settings */}
              <button
                onClick={() => setShowMetricsEditor(true)}
                className="p-2.5 rounded-xl transition-all"
                style={{ backgroundColor: t.bgCard, border: `1px solid ${t.border}`, color: t.textMuted }}
              >
                <SettingsIcon className="w-5 h-5" />
              </button>

              {/* Theme */}
              <button
                onClick={() => setDarkMode(!darkMode)}
                className="p-2.5 rounded-xl transition-all"
                style={{ backgroundColor: t.bgCard, border: `1px solid ${t.border}`, color: t.textMuted }}
              >
                {darkMode ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
              </button>

              {/* User */}
              <div 
                className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold"
                style={{ backgroundColor: t.bgCard, border: `1px solid ${t.border}`, color: t.textSecondary }}
              >
                GS
              </div>
            </motion.div>
          </div>

          {/* Tag Pills Filter */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: animationPhase >= 1 ? 1 : 0, y: animationPhase >= 1 ? 0 : 10 }}
            className="flex items-center gap-2 mt-4 overflow-x-auto pb-2"
          >
            <span className="text-xs font-medium shrink-0" style={{ color: t.textMuted }}>Filter:</span>
            {allTags.map(tag => (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0"
                style={{ 
                  backgroundColor: selectedTags.includes(tag) ? t.primaryGhost : t.bgAlt,
                  color: selectedTags.includes(tag) ? t.primary : t.textSecondary,
                  border: `1px solid ${selectedTags.includes(tag) ? t.primary : 'transparent'}`
                }}
              >
                {tag}
              </button>
            ))}
            {selectedTags.length > 0 && (
              <button
                onClick={() => setSelectedTags([])}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0"
                style={{ color: t.danger }}
              >
                Clear All
              </button>
            )}
          </motion.div>
        </div>
      </header>

      {/* === MAIN CONTENT === */}
      <main className="max-w-[1800px] mx-auto px-6 py-6 space-y-6">
        
        {/* === METRICS GRID === */}
        {widgets.find(w => w.id === 'metrics')?.visible && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: animationPhase >= 2 ? 1 : 0, y: animationPhase >= 2 ? 0 : 20 }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg font-bold" style={{ color: t.text }}>Key Metrics</h2>
              <button 
                onClick={() => setShowMetricsEditor(true)}
                className="text-xs font-medium flex items-center gap-1"
                style={{ color: t.primary }}
              >
                <EditIcon className="w-3.5 h-3.5" />
                Customize
              </button>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
              {selectedMetrics.map((metricId, index) => {
                const metricDef = metricsLibrary[metricId];
                if (!metricDef) return null;
                const value = metrics[metricId];
                const IconComponent = metricDef.icon;
                
                return (
                  <motion.div
                    key={metricId}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="rounded-xl p-4 transition-all hover:scale-[1.02]"
                    style={{ backgroundColor: t.bgCard, border: `1px solid ${t.border}` }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <IconComponent className="w-4 h-4" style={{ color: t.primary }} />
                      <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: t.textMuted }}>
                        {metricDef.label}
                      </span>
                    </div>
                    <p 
                      className="font-mono text-2xl font-bold"
                      style={{ color: metricDef.color ? getScoreColor(value) : t.text }}
                    >
                      {metricDef.format(value)}
                    </p>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* === KANBAN PIPELINE === */}
        {widgets.find(w => w.id === 'kanban')?.visible && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: animationPhase >= 3 ? 1 : 0, y: animationPhase >= 3 ? 0 : 20 }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg font-bold" style={{ color: t.text }}>Pipeline Board</h2>
              <button 
                onClick={() => setShowStageEditor(true)}
                className="text-xs font-medium flex items-center gap-1"
                style={{ color: t.primary }}
              >
                <EditIcon className="w-3.5 h-3.5" />
                Edit Stages
              </button>
            </div>

            <div 
              className="flex gap-4 overflow-x-auto pb-4"
              style={{ minHeight: 400 }}
            >
              {stages.map((stage, stageIndex) => {
                const stageDeals = filteredDeals.filter(d => d.stage === stage.id);
                const stageValue = stageDeals.reduce((sum, d) => sum + d.totalPrice, 0);
                
                return (
                  <motion.div
                    key={stage.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: stageIndex * 0.1 }}
                    className="flex-shrink-0 w-72 rounded-xl overflow-hidden"
                    style={{ backgroundColor: t.bgCard, border: `1px solid ${t.border}` }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => draggedDeal && moveDeal(draggedDeal, stage.id)}
                  >
                    {/* Stage Header */}
                    <div 
                      className="px-4 py-3 flex items-center justify-between"
                      style={{ borderBottom: `2px solid ${stage.color}` }}
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stage.color }} />
                        <span className="font-semibold text-sm" style={{ color: t.text }}>{stage.label}</span>
                        <span 
                          className="text-xs px-1.5 py-0.5 rounded-full font-mono"
                          style={{ backgroundColor: t.bgAlt, color: t.textMuted }}
                        >
                          {stageDeals.length}
                        </span>
                      </div>
                      <span className="text-xs font-mono" style={{ color: t.textMuted }}>
                        {formatPrice(stageValue)}
                      </span>
                    </div>

                    {/* Stage Cards */}
                    <div className="p-3 space-y-3 min-h-[300px]">
                      {stageDeals.map((deal) => (
                        <motion.div
                          key={deal.id}
                          layoutId={`deal-${deal.id}`}
                          draggable
                          onDragStart={() => setDraggedDeal(deal.id)}
                          onDragEnd={() => setDraggedDeal(null)}
                          className="rounded-xl p-3 cursor-grab active:cursor-grabbing transition-all hover:scale-[1.02]"
                          style={{ 
                            backgroundColor: t.bgAlt, 
                            border: `1px solid ${t.border}`,
                            opacity: draggedDeal === deal.id ? 0.5 : 1
                          }}
                          whileHover={{ boxShadow: `0 4px 12px ${t.primary}15` }}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <p className="font-semibold text-sm" style={{ color: t.text }}>{deal.name}</p>
                              <p className="text-xs" style={{ color: t.textMuted }}>{deal.city}</p>
                            </div>
                            <div 
                              className="text-xs font-mono font-bold px-2 py-1 rounded-lg"
                              style={{ backgroundColor: getScoreColor(deal.score) + '20', color: getScoreColor(deal.score) }}
                            >
                              {deal.score}
                            </div>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span style={{ color: t.textMuted }}>{deal.units} units</span>
                            <span className="font-mono font-semibold" style={{ color: t.text }}>{formatPrice(deal.totalPrice)}</span>
                          </div>
                        </motion.div>
                      ))}
                      
                      {stageDeals.length === 0 && (
                        <div 
                          className="h-32 rounded-xl border-2 border-dashed flex items-center justify-center"
                          style={{ borderColor: t.border }}
                        >
                          <span className="text-xs" style={{ color: t.textMuted }}>Drop deals here</span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* === CHARTS ROW === */}
        {widgets.find(w => w.id === 'charts')?.visible && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: animationPhase >= 4 ? 1 : 0, y: animationPhase >= 4 ? 0 : 20 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-6"
          >
            {/* Status Donut */}
            <div 
              className="rounded-xl p-6"
              style={{ backgroundColor: t.bgCard, border: `1px solid ${t.border}` }}
            >
              <h3 className="font-display text-base font-bold mb-4" style={{ color: t.text }}>Pipeline by Status</h3>
              
              <div className="flex items-center justify-center">
                <div className="relative w-40 h-40">
                  <svg viewBox="0 0 100 100" className="transform -rotate-90">
                    {(() => {
                      let offset = 0;
                      const total = statusChartData.reduce((sum, s) => sum + s.count, 0) || 1;
                      
                      return statusChartData.map((stage, i) => {
                        const percentage = (stage.count / total) * 100;
                        const circumference = Math.PI * 36;
                        const strokeDasharray = `${(percentage / 100) * circumference} ${circumference}`;
                        const strokeDashoffset = -offset * (circumference / 100);
                        offset += percentage;
                        
                        return (
                          <circle
                            key={stage.id}
                            cx="50"
                            cy="50"
                            r="36"
                            fill="none"
                            stroke={stage.color}
                            strokeWidth="8"
                            strokeDasharray={strokeDasharray}
                            strokeDashoffset={strokeDashoffset}
                            className="transition-all duration-500"
                          />
                        );
                      });
                    })()}
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="font-mono text-2xl font-bold" style={{ color: t.text }}>{filteredDeals.length}</span>
                    <span className="text-xs" style={{ color: t.textMuted }}>Deals</span>
                  </div>
                </div>
              </div>
              
              {/* Legend */}
              <div className="mt-4 space-y-2">
                {statusChartData.map(stage => (
                  <div key={stage.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stage.color }} />
                      <span className="text-xs" style={{ color: t.textSecondary }}>{stage.label}</span>
                    </div>
                    <span className="font-mono text-xs" style={{ color: t.text }}>{stage.count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Geographic Bar Chart */}
            <div 
              className="rounded-xl p-6"
              style={{ backgroundColor: t.bgCard, border: `1px solid ${t.border}` }}
            >
              <h3 className="font-display text-base font-bold mb-4" style={{ color: t.text }}>By Geography</h3>
              
              <div className="space-y-3">
                {geoChartData.map((geo, index) => {
                  const maxValue = Math.max(...geoChartData.map(g => g.value));
                  const barWidth = (geo.value / maxValue) * 100;
                  
                  return (
                    <div key={geo.state}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium" style={{ color: t.text }}>{geo.state}</span>
                        <span className="text-xs font-mono" style={{ color: t.textMuted }}>{geo.count} deals</span>
                      </div>
                      <div className="h-6 rounded-lg overflow-hidden" style={{ backgroundColor: t.bgAlt }}>
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${barWidth}%` }}
                          transition={{ duration: 0.8, delay: index * 0.1 }}
                          className="h-full rounded-lg flex items-center justify-end px-2"
                          style={{ backgroundColor: t.primary }}
                        >
                          <span className="text-xs font-mono text-white font-semibold">
                            {formatPrice(geo.value)}
                          </span>
                        </motion.div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Deal Score Dot Plot */}
            <div 
              className="rounded-xl p-6"
              style={{ backgroundColor: t.bgCard, border: `1px solid ${t.border}` }}
            >
              <h3 className="font-display text-base font-bold mb-4" style={{ color: t.text }}>Deal Score Distribution</h3>
              
              <div className="relative h-48 mt-6">
                {/* Y-axis labels */}
                <div className="absolute left-0 top-0 bottom-8 w-8 flex flex-col justify-between text-xs" style={{ color: t.textMuted }}>
                  <span>100</span>
                  <span>75</span>
                  <span>50</span>
                </div>
                
                {/* Chart area */}
                <div className="ml-10 h-full relative" style={{ borderLeft: `1px solid ${t.border}`, borderBottom: `1px solid ${t.border}` }}>
                  {/* Grid lines */}
                  {[75, 50].map(line => (
                    <div 
                      key={line}
                      className="absolute w-full border-t border-dashed"
                      style={{ 
                        borderColor: t.border,
                        top: `${100 - line}%`
                      }}
                    />
                  ))}
                  
                  {/* Dots */}
                  {filteredDeals.map((deal, index) => {
                    const x = (index / (filteredDeals.length - 1 || 1)) * 90 + 5;
                    const y = 100 - deal.score;
                    
                    return (
                      <motion.div
                        key={deal.id}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: index * 0.05 }}
                        className="absolute w-4 h-4 rounded-full cursor-pointer transition-transform hover:scale-150 group"
                        style={{ 
                          left: `${x}%`,
                          top: `${y}%`,
                          backgroundColor: getScoreColor(deal.score),
                          transform: 'translate(-50%, -50%)',
                          boxShadow: `0 2px 8px ${getScoreColor(deal.score)}40`
                        }}
                      >
                        {/* Tooltip */}
                        <div 
                          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 rounded-lg text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                          style={{ backgroundColor: t.bgCard, border: `1px solid ${t.border}`, color: t.text }}
                        >
                          {deal.name}: {deal.score}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
              
              {/* Summary */}
              <div className="flex items-center justify-between mt-4 pt-4" style={{ borderTop: `1px solid ${t.border}` }}>
                <div className="text-center">
                  <p className="text-xs" style={{ color: t.textMuted }}>Low</p>
                  <p className="font-mono font-bold" style={{ color: t.danger }}>{metrics.lowestScore}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs" style={{ color: t.textMuted }}>Average</p>
                  <p className="font-mono font-bold" style={{ color: t.primary }}>{metrics.avgScore}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs" style={{ color: t.textMuted }}>High</p>
                  <p className="font-mono font-bold" style={{ color: t.success }}>{metrics.highestScore}</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </main>

      {/* === AI SUMMARY MODAL === */}
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
                    <h3 className="font-display font-bold" style={{ color: t.text }}>AI Pipeline Analyst</h3>
                    <p className="text-xs" style={{ color: t.textMuted }}>
                      {selectedTags.length > 0 ? selectedTags.join(' + ') : 'All Deals'}
                    </p>
                  </div>
                </div>
                <button onClick={() => setShowAIPanel(false)} className="p-2 rounded-lg" style={{ color: t.textMuted }}>
                  <XIcon className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6">
                {/* Quick Prompts */}
                <div className="mb-6">
                  <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: t.textMuted }}>Quick Prompts</p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      'Summarize my pipeline',
                      'Best value-add opportunities',
                      'Highest risk deals',
                      'Compare Georgia vs Texas',
                    ].map(prompt => (
                      <button
                        key={prompt}
                        onClick={() => { setAiQuery(prompt); generateAISummary(prompt); }}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                        style={{ backgroundColor: t.bgAlt, color: t.textSecondary, border: `1px solid ${t.border}` }}
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Input */}
                <div className="mb-6">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Ask about your pipeline..."
                      value={aiQuery}
                      onChange={(e) => setAiQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && aiQuery && generateAISummary(aiQuery)}
                      className="w-full px-4 py-3 pr-12 rounded-xl text-sm outline-none"
                      style={{ backgroundColor: t.bgAlt, border: `1px solid ${t.border}`, color: t.text }}
                    />
                    <button
                      onClick={() => aiQuery && generateAISummary(aiQuery)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg"
                      style={{ backgroundColor: t.primary, color: '#fff' }}
                    >
                      <ArrowRightIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Loading */}
                {aiLoading && (
                  <div className="flex items-center justify-center py-12">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      className="w-8 h-8 border-2 rounded-full"
                      style={{ borderColor: t.border, borderTopColor: t.primary }}
                    />
                  </div>
                )}

                {/* Response */}
                {aiResponse && !aiLoading && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4"
                  >
                    {/* Summary */}
                    <div className="p-4 rounded-xl" style={{ backgroundColor: t.primaryGhost, border: `1px solid ${t.primary}30` }}>
                      <p className="text-sm leading-relaxed" style={{ color: t.text }}>{aiResponse.summary}</p>
                    </div>

                    {/* Insights */}
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: t.textMuted }}>Key Insights</p>
                      <div className="space-y-2">
                        {aiResponse.insights.map((insight, i) => (
                          <div key={i} className="flex gap-2 text-sm" style={{ color: t.textSecondary }}>
                            <span style={{ color: t.primary }}>•</span>
                            <span>{insight}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Top Deal */}
                    {aiResponse.topDeal && (
                      <div className="p-4 rounded-xl" style={{ backgroundColor: t.bgAlt }}>
                        <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: t.textMuted }}>Top Opportunity</p>
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-12 h-12 rounded-lg bg-cover bg-center"
                            style={{ backgroundImage: `url(${aiResponse.topDeal.thumbnail})` }}
                          />
                          <div>
                            <p className="font-semibold" style={{ color: t.text }}>{aiResponse.topDeal.name}</p>
                            <p className="text-xs" style={{ color: t.textMuted }}>{aiResponse.topDeal.city}</p>
                          </div>
                          <div className="ml-auto text-right">
                            <p className="font-mono font-bold" style={{ color: getScoreColor(aiResponse.topDeal.score) }}>{aiResponse.topDeal.score}</p>
                            <p className="text-xs" style={{ color: t.textMuted }}>Score</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Recommendation */}
                    <div className="p-4 rounded-xl" style={{ backgroundColor: t.successGhost, border: `1px solid ${t.success}30` }}>
                      <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: t.success }}>Recommendation</p>
                      <p className="text-sm" style={{ color: t.text }}>{aiResponse.recommendation}</p>
                    </div>
                  </motion.div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* === METRICS EDITOR MODAL === */}
      <AnimatePresence>
        {showMetricsEditor && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
            onClick={() => setShowMetricsEditor(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="w-full max-w-lg rounded-2xl overflow-hidden"
              style={{ backgroundColor: t.bgCard, border: `1px solid ${t.border}` }}
              onClick={e => e.stopPropagation()}
            >
              <div className="px-6 py-4" style={{ borderBottom: `1px solid ${t.border}` }}>
                <h3 className="font-display text-lg font-bold" style={{ color: t.text }}>Customize Metrics</h3>
                <p className="text-sm mt-1" style={{ color: t.textMuted }}>Select which metrics to display on your dashboard</p>
              </div>
              
              <div className="p-6 max-h-96 overflow-y-auto">
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(metricsLibrary).map(([id, metric]) => (
                    <button
                      key={id}
                      onClick={() => {
                        setSelectedMetrics(prev => 
                          prev.includes(id)
                            ? prev.filter(m => m !== id)
                            : [...prev, id]
                        );
                      }}
                      className="flex items-center gap-3 p-3 rounded-xl text-left transition-all"
                      style={{ 
                        backgroundColor: selectedMetrics.includes(id) ? t.primaryGhost : t.bgAlt,
                        border: `1px solid ${selectedMetrics.includes(id) ? t.primary : t.border}`
                      }}
                    >
                      <div 
                        className="w-5 h-5 rounded-md flex items-center justify-center"
                        style={{ 
                          backgroundColor: selectedMetrics.includes(id) ? t.primary : 'transparent',
                          border: `1px solid ${selectedMetrics.includes(id) ? t.primary : t.border}`
                        }}
                      >
                        {selectedMetrics.includes(id) && <CheckIcon className="w-3 h-3 text-white" />}
                      </div>
                      <span className="text-sm" style={{ color: selectedMetrics.includes(id) ? t.primary : t.textSecondary }}>
                        {metric.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="px-6 py-4 flex justify-end gap-3" style={{ borderTop: `1px solid ${t.border}` }}>
                <button
                  onClick={() => setShowMetricsEditor(false)}
                  className="px-4 py-2 rounded-xl text-sm font-medium"
                  style={{ backgroundColor: t.bgAlt, color: t.textSecondary }}
                >
                  Done
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* === STAGE EDITOR MODAL === */}
      <AnimatePresence>
        {showStageEditor && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
            onClick={() => setShowStageEditor(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="w-full max-w-md rounded-2xl overflow-hidden"
              style={{ backgroundColor: t.bgCard, border: `1px solid ${t.border}` }}
              onClick={e => e.stopPropagation()}
            >
              <div className="px-6 py-4" style={{ borderBottom: `1px solid ${t.border}` }}>
                <h3 className="font-display text-lg font-bold" style={{ color: t.text }}>Pipeline Stages</h3>
                <p className="text-sm mt-1" style={{ color: t.textMuted }}>Choose a template or customize your stages</p>
              </div>
              
              <div className="p-6">
                <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: t.textMuted }}>Templates</p>
                <div className="space-y-2">
                  {Object.entries(stageTemplates).map(([id, template]) => (
                    <button
                      key={id}
                      onClick={() => applyTemplate(id)}
                      className="w-full p-4 rounded-xl text-left transition-all"
                      style={{ 
                        backgroundColor: pipelineTemplate === id ? t.primaryGhost : t.bgAlt,
                        border: `1px solid ${pipelineTemplate === id ? t.primary : t.border}`
                      }}
                    >
                      <p className="font-semibold" style={{ color: pipelineTemplate === id ? t.primary : t.text }}>
                        {template.label}
                      </p>
                      <div className="flex gap-1 mt-2">
                        {template.stages.map(stage => (
                          <div 
                            key={stage.id}
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: stage.color }}
                          />
                        ))}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="px-6 py-4 flex justify-end gap-3" style={{ borderTop: `1px solid ${t.border}` }}>
                <button
                  onClick={() => setShowStageEditor(false)}
                  className="px-4 py-2 rounded-xl text-sm font-medium"
                  style={{ backgroundColor: t.bgAlt, color: t.textSecondary }}
                >
                  Done
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
const TrendingIcon = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
  </svg>
);

const SparkleIcon = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
  </svg>
);

const PlusIcon = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
  </svg>
);

const SettingsIcon = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
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

const EditIcon = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);

const DollarIcon = ({ className, style }) => (
  <svg className={className} style={style} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const BuildingIcon = ({ className, style }) => (
  <svg className={className} style={style} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
  </svg>
);

const FolderIcon = ({ className, style }) => (
  <svg className={className} style={style} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
  </svg>
);

const ZapIcon = ({ className, style }) => (
  <svg className={className} style={style} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
);

const TrophyIcon = ({ className, style }) => (
  <svg className={className} style={style} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
  </svg>
);

const PercentIcon = ({ className, style }) => (
  <svg className={className} style={style} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
  </svg>
);

const TagIcon = ({ className, style }) => (
  <svg className={className} style={style} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
  </svg>
);

const ScaleIcon = ({ className, style }) => (
  <svg className={className} style={style} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
  </svg>
);

const CheckCircleIcon = ({ className, style }) => (
  <svg className={className} style={style} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const ArrowUpIcon = ({ className, style }) => (
  <svg className={className} style={style} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
  </svg>
);

const ArrowDownIcon = ({ className, style }) => (
  <svg className={className} style={style} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
  </svg>
);

const ArrowRightIcon = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
  </svg>
);

const XIcon = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const CheckIcon = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);

export default AstraDashboard;
