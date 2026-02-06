import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * ASTRA CRE - LIBRARY PAGE V3
 * "Your Deal Pipeline Command Center"
 * 
 * DESIGN SYSTEM:
 * - Purple-forward palette matching Comparison V3
 * - Syne (display) + Instrument Sans (body) + JetBrains Mono (data)
 * - Progressive disclosure: Quick scan → Deep dive
 * - Deal Scores integrated from comparison templates
 * 
 * FEATURES:
 * - Deal folders / organization
 * - Quick filters by status, submarket, score
 * - Grid + List view toggle
 * - Batch select for comparison
 * - Search with instant results
 * - Pipeline stats overview
 */

const AstraLibraryV3 = () => {
  // === STATE ===
  const [darkMode, setDarkMode] = useState(true);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [selectedDeals, setSelectedDeals] = useState([]);
  const [hoveredDeal, setHoveredDeal] = useState(null);
  const [sortBy, setSortBy] = useState('dateAdded'); // 'dateAdded' | 'score' | 'price' | 'name'
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [animationPhase, setAnimationPhase] = useState(0);

  // Animation sequence
  useEffect(() => {
    const timers = [
      setTimeout(() => setAnimationPhase(1), 100),
      setTimeout(() => setAnimationPhase(2), 300),
      setTimeout(() => setAnimationPhase(3), 500),
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
      bgSidebar: '#FAF8FF',
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
      bgSidebar: '#14101C',
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

  // === DEAL DATA ===
  const deals = [
    {
      id: 1,
      name: "The Overlook",
      subtitle: "at Gwinnett Stadium",
      address: "1600 Overlook Park Lane",
      city: "Lawrenceville, GA",
      submarket: "Gwinnett County",
      type: "Multifamily",
      units: 410,
      sqft: 411640,
      vintage: 2009,
      totalPrice: 90800000,
      pricePerUnit: 221500,
      capRate: 4.75,
      occupancy: 93.8,
      status: "active",
      score: 76,
      docs: 3,
      dateAdded: "2024-01-19",
      thumbnail: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&h=600&fit=crop&q=80",
      tags: ["Value-Add", "Scale"],
    },
    {
      id: 2,
      name: "Beacon Station",
      subtitle: "",
      address: "2100 Gordon Highway",
      city: "Augusta, GA",
      submarket: "Central Savannah",
      type: "Multifamily",
      units: 221,
      sqft: 220116,
      vintage: 2019,
      totalPrice: 53600000,
      pricePerUnit: 242500,
      capRate: 5.15,
      occupancy: 96.1,
      status: "active",
      score: 82,
      docs: 2,
      dateAdded: "2024-01-19",
      thumbnail: "https://images.unsplash.com/photo-1460317442991-0ec209397118?w=800&h=600&fit=crop&q=80",
      tags: ["Core-Plus", "Strong NOI"],
    },
    {
      id: 3,
      name: "Creekview Vista",
      subtitle: "",
      address: "500 New Franklin Road",
      city: "LaGrange, GA",
      submarket: "West Georgia",
      type: "Multifamily",
      units: 279,
      sqft: 275094,
      vintage: 2024,
      totalPrice: 55100000,
      pricePerUnit: 197500,
      capRate: null,
      occupancy: 78.5,
      status: "new",
      score: 68,
      docs: 1,
      dateAdded: "2024-01-19",
      thumbnail: "https://images.unsplash.com/photo-1574362848149-11496d93a7c7?w=800&h=600&fit=crop&q=80",
      tags: ["Lease-Up", "New Construction"],
    },
    {
      id: 4,
      name: "Carmel Vista",
      subtitle: "",
      address: "1200 Highway 20",
      city: "McDonough, GA",
      submarket: "Henry County",
      type: "Multifamily",
      units: 228,
      sqft: 225036,
      vintage: 2021,
      totalPrice: 45700000,
      pricePerUnit: 200400,
      capRate: 4.12,
      occupancy: 94.2,
      status: "under-review",
      score: 71,
      docs: 1,
      dateAdded: "2024-01-18",
      thumbnail: "https://images.unsplash.com/photo-1567496898669-ee935f5f647a?w=800&h=600&fit=crop&q=80",
      tags: ["Value-Add"],
    },
    {
      id: 5,
      name: "Palms at Riverside",
      subtitle: "",
      address: "3500 Riverside Drive",
      city: "Macon, GA",
      submarket: "Central Georgia",
      type: "Multifamily",
      units: 312,
      sqft: 298000,
      vintage: 2015,
      totalPrice: 52000000,
      pricePerUnit: 166667,
      capRate: 5.45,
      occupancy: 92.1,
      status: "passed",
      score: 64,
      docs: 2,
      dateAdded: "2024-01-15",
      thumbnail: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&h=600&fit=crop&q=80",
      tags: ["Core"],
    },
    {
      id: 6,
      name: "The Edison",
      subtitle: "at Tech Square",
      address: "800 Spring Street NW",
      city: "Atlanta, GA",
      submarket: "Midtown",
      type: "Multifamily",
      units: 185,
      sqft: 195000,
      vintage: 2022,
      totalPrice: 72500000,
      pricePerUnit: 391892,
      capRate: 4.25,
      occupancy: 95.8,
      status: "active",
      score: 79,
      docs: 4,
      dateAdded: "2024-01-20",
      thumbnail: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&h=600&fit=crop&q=80",
      tags: ["Core-Plus", "Urban"],
    },
  ];

  // === STATUS CONFIG ===
  const statusConfig = {
    'new': { 
      label: 'NEW', 
      color: t.blue,
      ghost: t.blueGhost,
    },
    'active': { 
      label: 'ACTIVE', 
      color: t.success,
      ghost: t.successGhost,
    },
    'under-review': { 
      label: 'REVIEW', 
      color: t.warning,
      ghost: t.warningGhost,
    },
    'passed': { 
      label: 'PASSED', 
      color: t.textMuted,
      ghost: t.bgAlt,
    }
  };

  // === COMPUTED VALUES ===
  const filteredDeals = deals.filter(deal => {
    // Status filter
    if (selectedFilter !== 'all' && deal.status !== selectedFilter) return false;
    
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        deal.name.toLowerCase().includes(query) ||
        deal.city.toLowerCase().includes(query) ||
        deal.submarket.toLowerCase().includes(query) ||
        deal.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }
    
    return true;
  }).sort((a, b) => {
    switch (sortBy) {
      case 'score': return b.score - a.score;
      case 'price': return b.totalPrice - a.totalPrice;
      case 'name': return a.name.localeCompare(b.name);
      default: return new Date(b.dateAdded) - new Date(a.dateAdded);
    }
  });

  const pipelineStats = {
    totalDeals: deals.length,
    totalValue: deals.reduce((sum, d) => sum + d.totalPrice, 0),
    totalUnits: deals.reduce((sum, d) => sum + d.units, 0),
    avgScore: Math.round(deals.reduce((sum, d) => sum + d.score, 0) / deals.length),
    activeDeals: deals.filter(d => d.status === 'active').length,
  };

  // === HELPERS ===
  const formatPrice = (num) => {
    if (!num) return '—';
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

  const toggleDealSelection = (dealId) => {
    setSelectedDeals(prev => 
      prev.includes(dealId) 
        ? prev.filter(id => id !== dealId)
        : [...prev, dealId]
    );
  };

  // === ANIMATION VARIANTS ===
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.06, delayChildren: 0.1 }
    }
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 30, scale: 0.96 },
    visible: { 
      opacity: 1, 
      y: 0, 
      scale: 1,
      transition: { type: "spring", stiffness: 100, damping: 15 }
    }
  };

  return (
    <div 
      className="min-h-screen flex transition-colors duration-500"
      style={{ backgroundColor: t.bg }}
    >
      {/* Fonts & Global Styles */}
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
        ::-webkit-scrollbar-thumb:hover { 
          background: ${darkMode ? 'rgba(167, 139, 250, 0.5)' : 'rgba(124, 58, 237, 0.4)'}; 
        }
      `}</style>

      {/* === AMBIENT BACKGROUND === */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {darkMode && (
          <>
            <motion.div 
              className="absolute top-[-15%] right-[5%] w-[600px] h-[600px] rounded-full"
              style={{ 
                background: 'radial-gradient(circle, rgba(124, 58, 237, 0.12) 0%, transparent 60%)',
                filter: 'blur(80px)'
              }}
              animate={{ scale: [1, 1.1, 1], opacity: [0.5, 0.7, 0.5] }}
              transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div 
              className="absolute bottom-[-20%] left-[20%] w-[500px] h-[500px] rounded-full"
              style={{ 
                background: 'radial-gradient(circle, rgba(52, 211, 153, 0.08) 0%, transparent 60%)',
                filter: 'blur(100px)'
              }}
              animate={{ scale: [1, 1.05, 1], opacity: [0.3, 0.5, 0.3] }}
              transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 3 }}
            />
          </>
        )}
      </div>

      {/* === SIDEBAR === */}
      <motion.aside 
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="w-72 h-screen sticky top-0 flex flex-col z-40"
        style={{ 
          backgroundColor: darkMode ? 'rgba(20, 16, 28, 0.95)' : 'rgba(250, 248, 255, 0.95)',
          backdropFilter: 'blur(20px)',
          borderRight: `1px solid ${t.border}`
        }}
      >
        {/* Logo */}
        <div className="p-6 pb-4">
          <div className="flex items-center gap-3">
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
              <span className="font-display text-2xl font-bold tracking-tight" style={{ color: t.text }}>
                Astra
              </span>
              <span className="font-display text-sm font-medium ml-1" style={{ color: t.primary }}>
                CRE
              </span>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-2">
          <div className="space-y-1">
            {[
              { icon: GridIcon, label: 'Dashboard', active: false, href: '#' },
              { icon: FolderIcon, label: 'Deal Library', active: true, href: '#' },
              { icon: UploadIcon, label: 'Upload', active: false, href: '#' },
              { icon: CompareIcon, label: 'Comparisons', active: false, badge: selectedDeals.length > 0 ? selectedDeals.length : null, href: '#' },
              { icon: SparkleIcon, label: 'AI Insights', active: false, badge: 'Beta', href: '#' },
            ].map((item, i) => (
              <motion.a
                key={item.label}
                href={item.href}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group"
                style={{ 
                  backgroundColor: item.active ? t.primaryGhost : 'transparent',
                  color: item.active ? t.primary : t.textSecondary,
                  border: item.active ? `1px solid ${t.borderHover}` : '1px solid transparent'
                }}
              >
                <item.icon className={`w-5 h-5 transition-transform group-hover:scale-110 ${item.active ? '' : 'opacity-70'}`} />
                <span className="font-medium text-[15px]">{item.label}</span>
                {item.badge && (
                  <span 
                    className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider"
                    style={{ 
                      backgroundColor: typeof item.badge === 'number' ? t.primary : t.primaryGhost,
                      color: typeof item.badge === 'number' ? '#fff' : t.primary
                    }}
                  >
                    {item.badge}
                  </span>
                )}
              </motion.a>
            ))}
          </div>

          {/* Divider */}
          <div className="my-4 mx-4 border-t" style={{ borderColor: t.border }} />

          {/* Quick Filters */}
          <div className="px-4 mb-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] mb-3" style={{ color: t.textMuted }}>
              Quick Filters
            </p>
            <div className="space-y-1">
              {[
                { id: 'all', label: 'All Deals', count: deals.length },
                { id: 'active', label: 'Active', count: deals.filter(d => d.status === 'active').length, color: t.success },
                { id: 'new', label: 'New', count: deals.filter(d => d.status === 'new').length, color: t.blue },
                { id: 'under-review', label: 'In Review', count: deals.filter(d => d.status === 'under-review').length, color: t.warning },
                { id: 'passed', label: 'Passed', count: deals.filter(d => d.status === 'passed').length, color: t.textMuted },
              ].map((filter) => (
                <button
                  key={filter.id}
                  onClick={() => setSelectedFilter(filter.id)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all"
                  style={{ 
                    backgroundColor: selectedFilter === filter.id ? t.primaryGhost : 'transparent',
                    color: selectedFilter === filter.id ? t.primary : t.textSecondary,
                  }}
                >
                  <div className="flex items-center gap-2">
                    {filter.color && (
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: filter.color }} />
                    )}
                    <span>{filter.label}</span>
                  </div>
                  <span className="font-mono text-xs" style={{ color: t.textMuted }}>{filter.count}</span>
                </button>
              ))}
            </div>
          </div>
        </nav>

        {/* Pipeline Stats */}
        <div className="p-4">
          <div 
            className="rounded-2xl p-5"
            style={{ backgroundColor: t.primaryGhost, border: `1px solid ${t.border}` }}
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] mb-4" style={{ color: t.textMuted }}>
              Pipeline Overview
            </p>
            <div className="space-y-4">
              <div className="flex justify-between items-end">
                <div>
                  <p className="font-mono text-2xl font-semibold" style={{ color: t.primary }}>
                    {formatPrice(pipelineStats.totalValue)}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: t.textMuted }}>Total Value</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-lg font-semibold" style={{ color: t.text }}>
                    {pipelineStats.totalUnits.toLocaleString()}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: t.textMuted }}>Units</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div 
                  className="flex-1 p-3 rounded-xl text-center"
                  style={{ backgroundColor: t.bgCard }}
                >
                  <p className="font-mono text-lg font-bold" style={{ color: t.success }}>
                    {pipelineStats.activeDeals}
                  </p>
                  <p className="text-[10px] uppercase tracking-wider" style={{ color: t.textMuted }}>Active</p>
                </div>
                <div 
                  className="flex-1 p-3 rounded-xl text-center"
                  style={{ backgroundColor: t.bgCard }}
                >
                  <p className="font-mono text-lg font-bold" style={{ color: t.primary }}>
                    {pipelineStats.avgScore}
                  </p>
                  <p className="text-[10px] uppercase tracking-wider" style={{ color: t.textMuted }}>Avg Score</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Theme Toggle */}
        <div className="p-4 pt-0">
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl transition-all duration-300"
            style={{ backgroundColor: t.bgCard, border: `1px solid ${t.border}`, color: t.textSecondary }}
          >
            {darkMode ? <SunIcon className="w-4 h-4" /> : <MoonIcon className="w-4 h-4" />}
            <span className="text-sm font-medium">{darkMode ? 'Light Mode' : 'Dark Mode'}</span>
          </button>
        </div>
      </motion.aside>

      {/* === MAIN CONTENT === */}
      <main className="flex-1 min-h-screen relative">
        {/* Header */}
        <header 
          className="sticky top-0 z-30 transition-colors duration-300"
          style={{ 
            backgroundColor: darkMode ? 'rgba(15, 11, 21, 0.85)' : 'rgba(254, 252, 255, 0.85)',
            backdropFilter: 'blur(20px)',
            borderBottom: `1px solid ${t.border}`
          }}
        >
          <div className="px-8 py-5">
            <div className="flex items-start justify-between">
              {/* Title */}
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: animationPhase >= 1 ? 1 : 0, y: animationPhase >= 1 ? 0 : -10 }}
              >
                <h1 className="font-display text-3xl font-bold tracking-tight" style={{ color: t.text }}>
                  Deal Library
                </h1>
                <p className="mt-1 text-sm" style={{ color: t.textSecondary }}>
                  <span className="font-mono" style={{ color: t.primary }}>{filteredDeals.length}</span> deals · 
                  <span className="font-mono ml-1">{formatPrice(filteredDeals.reduce((sum, d) => sum + d.totalPrice, 0))}</span> pipeline
                </p>
              </motion.div>

              {/* Actions */}
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: animationPhase >= 1 ? 1 : 0, y: animationPhase >= 1 ? 0 : -10 }}
                className="flex items-center gap-3"
              >
                {/* Search */}
                <motion.div 
                  className="relative"
                  animate={{ width: searchFocused ? 300 : 220 }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                >
                  <input
                    type="text"
                    placeholder="Search deals..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => setSearchFocused(true)}
                    onBlur={() => setSearchFocused(false)}
                    className="w-full py-3 pl-11 pr-4 rounded-xl text-sm transition-all duration-300 outline-none"
                    style={{ 
                      backgroundColor: t.bgCard,
                      border: `1px solid ${searchFocused ? t.borderHover : t.border}`,
                      color: t.text
                    }}
                  />
                  <SearchIcon 
                    className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 transition-colors"
                    style={{ color: searchFocused ? t.primary : t.textMuted }}
                  />
                </motion.div>

                {/* Compare Button */}
                <AnimatePresence>
                  {selectedDeals.length >= 2 && (
                    <motion.button
                      initial={{ opacity: 0, scale: 0.9, width: 0 }}
                      animate={{ opacity: 1, scale: 1, width: 'auto' }}
                      exit={{ opacity: 0, scale: 0.9, width: 0 }}
                      className="px-5 py-3 rounded-xl text-sm font-semibold flex items-center gap-2 text-white overflow-hidden"
                      style={{ 
                        background: `linear-gradient(135deg, ${t.success} 0%, #059669 100%)`,
                        boxShadow: `0 4px 12px ${t.success}40`
                      }}
                    >
                      <CompareIcon className="w-4 h-4" />
                      Compare ({selectedDeals.length})
                    </motion.button>
                  )}
                </AnimatePresence>

                {/* New Deal Button */}
                <button 
                  className="px-5 py-3 rounded-xl text-sm font-semibold flex items-center gap-2 text-white transition-all"
                  style={{ 
                    background: `linear-gradient(135deg, ${t.primary} 0%, ${t.primaryDark} 100%)`,
                    boxShadow: `0 4px 12px ${t.primary}30`
                  }}
                >
                  <PlusIcon className="w-4 h-4" />
                  New Deal
                </button>

                {/* User */}
                <div 
                  className="w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold cursor-pointer transition-all hover:scale-105"
                  style={{ backgroundColor: t.bgCard, border: `1px solid ${t.border}`, color: t.textSecondary }}
                >
                  GS
                </div>
              </motion.div>
            </div>

            {/* Toolbar */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: animationPhase >= 2 ? 1 : 0 }}
              className="flex items-center justify-between mt-5"
            >
              {/* Left: View toggles */}
              <div className="flex items-center gap-4">
                {/* View Mode */}
                <div 
                  className="flex items-center rounded-lg p-1"
                  style={{ backgroundColor: t.bgAlt }}
                >
                  <button 
                    onClick={() => setViewMode('grid')}
                    className="p-2 rounded-md transition-all"
                    style={{ 
                      backgroundColor: viewMode === 'grid' ? t.primaryGhost : 'transparent',
                      color: viewMode === 'grid' ? t.primary : t.textMuted
                    }}
                  >
                    <GridViewIcon className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => setViewMode('list')}
                    className="p-2 rounded-md transition-all"
                    style={{ 
                      backgroundColor: viewMode === 'list' ? t.primaryGhost : 'transparent',
                      color: viewMode === 'list' ? t.primary : t.textMuted
                    }}
                  >
                    <ListViewIcon className="w-4 h-4" />
                  </button>
                </div>

                {/* Sort */}
                <div className="relative">
                  <button
                    onClick={() => setShowSortMenu(!showSortMenu)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all"
                    style={{ backgroundColor: t.bgAlt, color: t.textSecondary }}
                  >
                    <SortIcon className="w-4 h-4" />
                    Sort: {sortBy === 'dateAdded' ? 'Recent' : sortBy === 'score' ? 'Score' : sortBy === 'price' ? 'Price' : 'Name'}
                    <ChevronDownIcon className="w-4 h-4" />
                  </button>
                  
                  <AnimatePresence>
                    {showSortMenu && (
                      <motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 5 }}
                        className="absolute top-full left-0 mt-2 w-40 rounded-xl overflow-hidden z-50"
                        style={{ backgroundColor: t.bgCard, border: `1px solid ${t.border}`, boxShadow: '0 10px 40px rgba(0,0,0,0.2)' }}
                      >
                        {[
                          { id: 'dateAdded', label: 'Most Recent' },
                          { id: 'score', label: 'Highest Score' },
                          { id: 'price', label: 'Highest Price' },
                          { id: 'name', label: 'Name (A-Z)' },
                        ].map(option => (
                          <button
                            key={option.id}
                            onClick={() => { setSortBy(option.id); setShowSortMenu(false); }}
                            className="w-full px-4 py-2.5 text-left text-sm transition-colors"
                            style={{ 
                              backgroundColor: sortBy === option.id ? t.primaryGhost : 'transparent',
                              color: sortBy === option.id ? t.primary : t.text
                            }}
                          >
                            {option.label}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Right: Select all / Clear */}
              {selectedDeals.length > 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-2"
                >
                  <span className="text-sm" style={{ color: t.textMuted }}>
                    {selectedDeals.length} selected
                  </span>
                  <button
                    onClick={() => setSelectedDeals([])}
                    className="text-sm font-medium"
                    style={{ color: t.primary }}
                  >
                    Clear
                  </button>
                </motion.div>
              )}
            </motion.div>
          </div>
        </header>

        {/* Content */}
        <div className="p-8">
          {/* Grid View */}
          {viewMode === 'grid' && (
            <motion.div 
              className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5"
              variants={containerVariants}
              initial="hidden"
              animate={animationPhase >= 3 ? "visible" : "hidden"}
            >
              {filteredDeals.map((deal) => {
                const isSelected = selectedDeals.includes(deal.id);
                const isHovered = hoveredDeal === deal.id;
                const status = statusConfig[deal.status];
                
                return (
                  <motion.div
                    key={deal.id}
                    variants={cardVariants}
                    onHoverStart={() => setHoveredDeal(deal.id)}
                    onHoverEnd={() => setHoveredDeal(null)}
                    className="relative group"
                  >
                    {/* Glow */}
                    <motion.div 
                      className="absolute -inset-2 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                      style={{ 
                        background: `radial-gradient(ellipse at center, ${t.primary}20, transparent 70%)`,
                        filter: 'blur(20px)'
                      }}
                    />

                    {/* Card */}
                    <div 
                      className="relative rounded-2xl overflow-hidden transition-all duration-300 cursor-pointer"
                      style={{ 
                        backgroundColor: t.bgCard,
                        border: isSelected 
                          ? `2px solid ${t.primary}` 
                          : `1px solid ${isHovered ? t.borderHover : t.border}`,
                        boxShadow: isHovered ? `0 20px 40px ${t.primary}10` : 'none',
                        transform: isHovered ? 'translateY(-4px)' : 'translateY(0)'
                      }}
                      onClick={() => toggleDealSelection(deal.id)}
                    >
                      {/* Checkbox */}
                      <div 
                        className="absolute top-3 left-3 z-10 w-6 h-6 rounded-lg flex items-center justify-center transition-all"
                        style={{ 
                          backgroundColor: isSelected ? t.primary : (darkMode ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.9)'),
                          backdropFilter: 'blur(8px)',
                          border: isSelected ? 'none' : `1px solid ${t.border}`
                        }}
                      >
                        {isSelected && <CheckIcon className="w-4 h-4 text-white" />}
                      </div>

                      {/* Status Badge */}
                      <div className="absolute top-3 right-3 z-10">
                        <span 
                          className="px-2.5 py-1 rounded-lg text-[10px] font-bold tracking-wider"
                          style={{ backgroundColor: status.ghost, color: status.color }}
                        >
                          {status.label}
                        </span>
                      </div>

                      {/* Image */}
                      <div className="relative h-40 overflow-hidden">
                        <motion.img 
                          src={deal.thumbnail}
                          alt={deal.name}
                          className="w-full h-full object-cover"
                          animate={{ scale: isHovered ? 1.08 : 1 }}
                          transition={{ duration: 0.5 }}
                        />
                        <div 
                          className="absolute inset-0"
                          style={{ 
                            background: `linear-gradient(to top, ${t.bgCard} 0%, ${t.bgCard}60 30%, transparent 60%)`
                          }}
                        />

                        {/* Deal Score */}
                        <div className="absolute bottom-3 right-3">
                          <div 
                            className="w-12 h-12 rounded-xl flex items-center justify-center"
                            style={{ 
                              backgroundColor: darkMode ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.95)',
                              backdropFilter: 'blur(8px)'
                            }}
                          >
                            <span 
                              className="font-mono text-lg font-bold"
                              style={{ color: getScoreColor(deal.score) }}
                            >
                              {deal.score}
                            </span>
                          </div>
                        </div>

                        {/* Type Badge */}
                        <div className="absolute bottom-3 left-3">
                          <span 
                            className="text-[10px] font-bold tracking-[0.15em]"
                            style={{ color: t.primary }}
                          >
                            {deal.type.toUpperCase()}
                          </span>
                        </div>
                      </div>

                      {/* Content */}
                      <div className="p-4 pt-2">
                        {/* Title */}
                        <h3 
                          className="font-display text-lg font-bold tracking-tight"
                          style={{ color: isHovered ? t.primary : t.text }}
                        >
                          {deal.name}
                          {deal.subtitle && (
                            <span className="font-normal text-base ml-1" style={{ color: t.textSecondary }}>
                              {deal.subtitle}
                            </span>
                          )}
                        </h3>

                        {/* Location */}
                        <p className="text-sm mt-1 flex items-center gap-1.5" style={{ color: t.textSecondary }}>
                          <LocationIcon className="w-3.5 h-3.5" style={{ color: t.textMuted }} />
                          {deal.submarket} · {deal.city}
                        </p>

                        {/* Tags */}
                        {deal.tags.length > 0 && (
                          <div className="flex gap-1.5 mt-3">
                            {deal.tags.slice(0, 2).map(tag => (
                              <span 
                                key={tag}
                                className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                                style={{ backgroundColor: t.bgAlt, color: t.textMuted }}
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Key Metrics */}
                        <div 
                          className="grid grid-cols-4 gap-3 mt-4 pt-4"
                          style={{ borderTop: `1px solid ${t.border}` }}
                        >
                          <div>
                            <p className="text-[10px] uppercase tracking-wider" style={{ color: t.textMuted }}>Units</p>
                            <p className="font-mono text-sm font-semibold mt-0.5" style={{ color: t.text }}>
                              {deal.units}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-wider" style={{ color: t.textMuted }}>Cap</p>
                            <p className="font-mono text-sm font-semibold mt-0.5" style={{ color: t.success }}>
                              {deal.capRate ? `${deal.capRate}%` : '—'}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-wider" style={{ color: t.textMuted }}>$/Unit</p>
                            <p className="font-mono text-sm font-semibold mt-0.5" style={{ color: t.text }}>
                              {formatPrice(deal.pricePerUnit)}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-wider" style={{ color: t.textMuted }}>Occ</p>
                            <p className="font-mono text-sm font-semibold mt-0.5" style={{ color: t.text }}>
                              {deal.occupancy}%
                            </p>
                          </div>
                        </div>

                        {/* Price & Actions */}
                        <div 
                          className="flex items-end justify-between mt-4 pt-4"
                          style={{ borderTop: `1px solid ${t.border}` }}
                        >
                          <div>
                            <p className="text-[10px] uppercase tracking-wider" style={{ color: t.textMuted }}>Asking</p>
                            <p className="font-display text-xl font-bold" style={{ color: t.text }}>
                              {formatPrice(deal.totalPrice)}
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-xs" style={{ color: t.textMuted }}>
                              {deal.docs} doc{deal.docs !== 1 ? 's' : ''}
                            </span>
                            <span className="text-xs" style={{ color: t.textMuted }}>·</span>
                            <span className="text-xs" style={{ color: t.textMuted }}>
                              {new Date(deal.dateAdded).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </span>
                          </div>
                        </div>

                        {/* Hover Action */}
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ 
                            opacity: isHovered ? 1 : 0,
                            height: isHovered ? 'auto' : 0
                          }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <button 
                            onClick={(e) => { e.stopPropagation(); }}
                            className="w-full mt-4 py-2.5 rounded-xl text-sm font-semibold transition-all text-white"
                            style={{ 
                              background: `linear-gradient(135deg, ${t.primary} 0%, ${t.primaryDark} 100%)`,
                            }}
                          >
                            View Analysis →
                          </button>
                        </motion.div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}

              {/* Add New Deal Card */}
              <motion.div variants={cardVariants}>
                <div 
                  className="h-full min-h-[420px] rounded-2xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all duration-300 group"
                  style={{ borderColor: t.border }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = t.borderHover;
                    e.currentTarget.style.backgroundColor = t.primaryGhost;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = t.border;
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <div 
                    className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110"
                    style={{ backgroundColor: t.bgAlt, border: `1px solid ${t.border}` }}
                  >
                    <PlusIcon className="w-8 h-8" style={{ color: t.textMuted }} />
                  </div>
                  <p className="font-display text-lg font-semibold" style={{ color: t.text }}>Add New Deal</p>
                  <p className="text-sm mt-1" style={{ color: t.textMuted }}>Upload an OM or create manually</p>
                </div>
              </motion.div>
            </motion.div>
          )}

          {/* List View */}
          {viewMode === 'list' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: animationPhase >= 3 ? 1 : 0 }}
              className="rounded-2xl overflow-hidden"
              style={{ backgroundColor: t.bgCard, border: `1px solid ${t.border}` }}
            >
              {/* Table Header */}
              <div 
                className="grid items-center px-4 py-3 text-xs font-semibold uppercase tracking-wider"
                style={{ 
                  gridTemplateColumns: '40px 2fr 1fr 100px 100px 100px 100px 80px 120px',
                  backgroundColor: t.bgAlt,
                  color: t.textMuted,
                  borderBottom: `1px solid ${t.border}`
                }}
              >
                <div></div>
                <div>Property</div>
                <div>Location</div>
                <div className="text-right">Units</div>
                <div className="text-right">Cap Rate</div>
                <div className="text-right">$/Unit</div>
                <div className="text-right">Price</div>
                <div className="text-center">Score</div>
                <div className="text-center">Status</div>
              </div>

              {/* Table Body */}
              {filteredDeals.map((deal, index) => {
                const isSelected = selectedDeals.includes(deal.id);
                const isHovered = hoveredDeal === deal.id;
                const status = statusConfig[deal.status];
                
                return (
                  <motion.div
                    key={deal.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className="grid items-center px-4 py-4 cursor-pointer transition-colors"
                    style={{ 
                      gridTemplateColumns: '40px 2fr 1fr 100px 100px 100px 100px 80px 120px',
                      backgroundColor: isHovered ? t.bgHover : (index % 2 === 0 ? 'transparent' : t.bgAlt + '40'),
                      borderBottom: `1px solid ${t.border}`
                    }}
                    onMouseEnter={() => setHoveredDeal(deal.id)}
                    onMouseLeave={() => setHoveredDeal(null)}
                    onClick={() => toggleDealSelection(deal.id)}
                  >
                    {/* Checkbox */}
                    <div>
                      <div 
                        className="w-5 h-5 rounded-md flex items-center justify-center transition-all"
                        style={{ 
                          backgroundColor: isSelected ? t.primary : 'transparent',
                          border: `1px solid ${isSelected ? t.primary : t.border}`
                        }}
                      >
                        {isSelected && <CheckIcon className="w-3 h-3 text-white" />}
                      </div>
                    </div>

                    {/* Property */}
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0">
                        <img src={deal.thumbnail} alt={deal.name} className="w-full h-full object-cover" />
                      </div>
                      <div>
                        <p className="font-semibold" style={{ color: isHovered ? t.primary : t.text }}>
                          {deal.name}
                        </p>
                        <p className="text-xs" style={{ color: t.textMuted }}>{deal.type}</p>
                      </div>
                    </div>

                    {/* Location */}
                    <div>
                      <p className="text-sm" style={{ color: t.text }}>{deal.city}</p>
                      <p className="text-xs" style={{ color: t.textMuted }}>{deal.submarket}</p>
                    </div>

                    {/* Units */}
                    <div className="text-right font-mono" style={{ color: t.text }}>
                      {deal.units}
                    </div>

                    {/* Cap Rate */}
                    <div className="text-right font-mono" style={{ color: deal.capRate ? t.success : t.textMuted }}>
                      {deal.capRate ? `${deal.capRate}%` : '—'}
                    </div>

                    {/* $/Unit */}
                    <div className="text-right font-mono" style={{ color: t.text }}>
                      {formatPrice(deal.pricePerUnit)}
                    </div>

                    {/* Price */}
                    <div className="text-right font-mono font-semibold" style={{ color: t.text }}>
                      {formatPrice(deal.totalPrice)}
                    </div>

                    {/* Score */}
                    <div className="flex justify-center">
                      <span 
                        className="font-mono font-bold px-2 py-1 rounded-lg text-sm"
                        style={{ 
                          backgroundColor: getScoreColor(deal.score) + '20',
                          color: getScoreColor(deal.score)
                        }}
                      >
                        {deal.score}
                      </span>
                    </div>

                    {/* Status */}
                    <div className="flex justify-center">
                      <span 
                        className="px-2.5 py-1 rounded-lg text-[10px] font-bold tracking-wider"
                        style={{ backgroundColor: status.ghost, color: status.color }}
                      >
                        {status.label}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          )}

          {/* Empty State */}
          {filteredDeals.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-20"
            >
              <div 
                className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{ backgroundColor: t.bgAlt }}
              >
                <SearchIcon className="w-10 h-10" style={{ color: t.textMuted }} />
              </div>
              <p className="text-lg font-semibold" style={{ color: t.text }}>No deals found</p>
              <p className="text-sm mt-1" style={{ color: t.textMuted }}>
                Try adjusting your search or filters
              </p>
            </motion.div>
          )}
        </div>
      </main>

      {/* Click outside to close sort menu */}
      {showSortMenu && (
        <div 
          className="fixed inset-0 z-40"
          onClick={() => setShowSortMenu(false)}
        />
      )}
    </div>
  );
};

// === ICON COMPONENTS ===
const TrendingIcon = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
  </svg>
);

const GridIcon = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
  </svg>
);

const FolderIcon = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
  </svg>
);

const UploadIcon = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
  </svg>
);

const CompareIcon = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);

const SparkleIcon = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
  </svg>
);

const SearchIcon = ({ className, style }) => (
  <svg className={className} style={style} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const PlusIcon = ({ className, style }) => (
  <svg className={className} style={style} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
  </svg>
);

const GridViewIcon = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
  </svg>
);

const ListViewIcon = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
  </svg>
);

const SortIcon = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
  </svg>
);

const ChevronDownIcon = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
  </svg>
);

const LocationIcon = ({ className, style }) => (
  <svg className={className} style={style} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const CheckIcon = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
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

export default AstraLibraryV3;
