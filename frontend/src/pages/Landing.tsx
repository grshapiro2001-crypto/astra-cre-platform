import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useInView, useMotionValue, useSpring } from 'framer-motion';
import { cn } from '@/lib/utils';

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────
interface DealCardData {
  id: number;
  name: string;
  address: string;
  submarket: string;
  units: number;
  dealValue: number;
  dealScore: number;
  capRate: string;
  irr: string;
  type: string;
}

interface FeatureTab {
  id: string;
  label: string;
  icon: string;
  headline: string;
  body: string;
  stats: { label: string; value: string }[];
}

// ─────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────
const TECH_STRIP_ITEMS = [
  'AI Deal Scoring', 'Rent Roll Analysis', 'T-12 Underwriting', 'Market Comps',
  'CoStar Integration', 'Yardi Sync', 'One-Click OM', 'DSCR Calculator',
  'Submarket Heatmaps', 'Portfolio Analytics', 'Document Extraction', 'Cap Rate Tracker',
];

const DEMO_DEALS: DealCardData[] = [
  {
    id: 1, name: 'Parkview Terrace', address: '1420 NW 23rd Ave, Portland OR',
    submarket: 'Pearl District', units: 124, dealValue: 18_500_000,
    dealScore: 82, capRate: '5.4%', irr: '14.2%', type: 'Multifamily',
  },
  {
    id: 2, name: 'Riverside Commons', address: '340 River Rd, Austin TX',
    submarket: 'East Austin', units: 96, dealValue: 14_200_000,
    dealScore: 76, capRate: '4.9%', irr: '12.8%', type: 'Multifamily',
  },
  {
    id: 3, name: 'Vantage Lofts', address: '810 Colfax St, Denver CO',
    submarket: 'Five Points', units: 72, dealValue: 11_800_000,
    dealScore: 91, capRate: '6.1%', irr: '16.4%', type: 'Multifamily',
  },
];

const FEATURE_TABS: FeatureTab[] = [
  {
    id: 'ai-scoring',
    label: 'AI Deal Scoring',
    icon: '⚡',
    headline: 'Know if a deal is worth your time in seconds.',
    body: 'ASTRA's proprietary scoring model ingests rent rolls, T-12s, market data, and submarket comps to produce an 0–100 deal score with full factor breakdown. No more spreadsheet roulette.',
    stats: [
      { label: 'Avg. underwriting time', value: '4 min' },
      { label: 'Deals scored to date', value: '12,400+' },
      { label: 'Accuracy vs. broker OM', value: '94%' },
    ],
  },
  {
    id: 'document-ai',
    label: 'Document AI',
    icon: '📄',
    headline: 'Upload a OM. Get a model.',
    body: 'Drop any PDF — offering memorandum, rent roll, or T-12 — and ASTRA's extraction pipeline parses every line item, cross-references market data, and populates your underwriting model automatically.',
    stats: [
      { label: 'Document types supported', value: '28+' },
      { label: 'Extraction accuracy', value: '97.3%' },
      { label: 'Time saved per deal', value: '3.5 hrs' },
    ],
  },
  {
    id: 'market-intel',
    label: 'Market Intel',
    icon: '🗺️',
    headline: 'Submarket data that moves with the market.',
    body: 'Live CoStar & Yardi feeds, refreshed daily. Vacancy trends, effective rent growth, new supply pipeline, cap rate compression — all visualized at the submarket level for 150+ MSAs.',
    stats: [
      { label: 'MSAs covered', value: '150+' },
      { label: 'Data refresh frequency', value: 'Daily' },
      { label: 'Data sources integrated', value: '8' },
    ],
  },
  {
    id: 'portfolio',
    label: 'Portfolio Analytics',
    icon: '📊',
    headline: 'Your entire book. One dashboard.',
    body: 'Track NOI, DSCR, occupancy, and value-add upside across every asset in your portfolio. Flag covenant breaches before they happen and generate LP-ready reports with one click.',
    stats: [
      { label: 'Assets tracked', value: 'Unlimited' },
      { label: 'Report formats', value: '6' },
      { label: 'Alert types', value: '14' },
    ],
  },
];

const FOOTER_LINKS = {
  Product: ['Deal Scoring', 'Document AI', 'Market Intel', 'Portfolio', 'Integrations', 'API'],
  Company: ['About', 'Blog', 'Careers', 'Press', 'Contact'],
  Legal: ['Privacy', 'Terms', 'Security', 'Cookie Policy'],
};

// ─────────────────────────────────────────────────────────────────
// Aurora Canvas  (WebGL-free, pure Canvas 2D)
// ─────────────────────────────────────────────────────────────────
function AuroraCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number>(0);
  const t = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const orbs = Array.from({ length: 5 }, (_, i) => ({
      x: Math.random(),
      y: Math.random(),
      r: 0.25 + Math.random() * 0.2,
      dx: (Math.random() - 0.5) * 0.00015,
      dy: (Math.random() - 0.5) * 0.00015,
      hue: 240 + i * 30,
    }));

    const draw = () => {
      t.current += 1;
      const w = canvas.width;
      const h = canvas.height;

      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = 'hsl(263,30%,5%)';
      ctx.fillRect(0, 0, w, h);

      orbs.forEach((o) => {
        o.x += o.dx + Math.sin(t.current * 0.003 + o.hue) * 0.0002;
        o.y += o.dy + Math.cos(t.current * 0.002 + o.hue) * 0.0002;
        if (o.x < -0.3) o.x = 1.3;
        if (o.x > 1.3) o.x = -0.3;
        if (o.y < -0.3) o.y = 1.3;
        if (o.y > 1.3) o.y = -0.3;

        const gx = o.x * w;
        const gy = o.y * h;
        const gr = o.r * Math.max(w, h);
        const grad = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
        grad.addColorStop(0, `hsla(${o.hue},80%,65%,0.18)`);
        grad.addColorStop(0.5, `hsla(${o.hue},70%,55%,0.08)`);
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
      });

      // Noise grain overlay
      const id = ctx.createImageData(w, h);
      const d = id.data;
      for (let i = 0; i < d.length; i += 4) {
        const v = Math.random() * 12;
        d[i] = d[i + 1] = d[i + 2] = v;
        d[i + 3] = 14;
      }
      ctx.putImageData(id, 0, 0);

      frameRef.current = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(frameRef.current);
      ro.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ mixBlendMode: 'screen' }}
      aria-hidden
    />
  );
}

// ─────────────────────────────────────────────────────────────────
// TechStrip — infinite horizontal ticker
// ─────────────────────────────────────────────────────────────────
function TechStrip() {
  const items = [...TECH_STRIP_ITEMS, ...TECH_STRIP_ITEMS];
  return (
    <div className="relative overflow-hidden border-y border-border/40 bg-background/60 backdrop-blur-sm py-3">
      <motion.div
        className="flex gap-10 whitespace-nowrap"
        animate={{ x: ['0%', '-50%'] }}
        transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
      >
        {items.map((item, i) => (
          <span key={i} className="flex items-center gap-2 text-xs font-mono text-muted-foreground uppercase tracking-widest shrink-0">
            <span className="w-1 h-1 rounded-full bg-primary/60 inline-block" />
            {item}
          </span>
        ))}
      </motion.div>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-background to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-background to-transparent" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Score Ring — animated SVG ring
// ─────────────────────────────────────────────────────────────────
function ScoreRing({ score, size = 56 }: { score: number; size?: number }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const pct = score / 100;
  const color = score >= 75 ? '#22c55e' : score >= 65 ? '#eab308' : '#ef4444';

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={4} className="text-muted/30" />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={color} strokeWidth={4}
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ * (1 - pct) }}
          transition={{ duration: 1.2, delay: 0.3, ease: 'easeOut' }}
        />
      </svg>
      <span className="absolute text-[11px] font-mono font-bold" style={{ color }}>{score}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// DemoCard — landing page deal card (standalone, no API deps)
// ─────────────────────────────────────────────────────────────────
function DemoCard({ deal, delay = 0 }: { deal: DealCardData; delay?: number }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  const fmt = (v: number) => v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(1)}M` : `$${(v / 1_000).toFixed(0)}K`;

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 32 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur-sm overflow-hidden hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10 transition-all duration-300 group"
    >
      {/* Faux street-view header */}
      <div className="h-24 bg-gradient-to-br from-muted/40 to-muted/80 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-card/60 to-transparent" />
        <div className="absolute bottom-2 left-3 flex items-center gap-1.5">
          <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-primary/20 text-primary border border-primary/30">
            {deal.type.toUpperCase()}
          </span>
        </div>
        {/* Animated shimmer */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent"
          animate={{ x: ['-100%', '200%'] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'linear', delay }}
        />
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="min-w-0 flex-1">
            <p className="font-display font-semibold text-sm text-foreground truncate">{deal.name}</p>
            <p className="text-xs text-muted-foreground truncate mt-0.5">{deal.submarket}</p>
          </div>
          <ScoreRing score={deal.dealScore} size={48} />
        </div>

        <div className="grid grid-cols-2 gap-2 mt-3">
          {[
            { label: 'Units', value: deal.units.toString() },
            { label: 'Value', value: fmt(deal.dealValue) },
            { label: 'Cap Rate', value: deal.capRate },
            { label: 'Projected IRR', value: deal.irr },
          ].map(({ label, value }) => (
            <div key={label} className="bg-muted/40 rounded-lg px-2.5 py-1.5">
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</p>
              <p className="text-xs font-mono font-semibold text-foreground mt-0.5">{value}</p>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Feature Tabs
// ─────────────────────────────────────────────────────────────────
function FeatureTabs() {
  const [active, setActive] = useState(FEATURE_TABS[0].id);
  const current = FEATURE_TABS.find((t) => t.id === active)!;
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });

  return (
    <motion.section
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className="py-24 px-4 max-w-6xl mx-auto"
    >
      <div className="text-center mb-14">
        <span className="text-xs font-mono uppercase tracking-widest text-primary px-3 py-1 rounded-full border border-primary/30 bg-primary/10">
          Platform Features
        </span>
        <h2 className="font-display text-4xl md:text-5xl font-bold mt-5 mb-4 text-foreground">
          Everything your deal team needs.
        </h2>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          One platform. AI-native from day one. Built for the speed of modern CRE.
        </p>
      </div>

      {/* Tab buttons */}
      <div className="flex flex-wrap justify-center gap-2 mb-10">
        {FEATURE_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActive(tab.id)}
            className={cn(
              'relative px-4 py-2 rounded-full text-sm font-medium transition-all duration-200',
              active === tab.id
                ? 'text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
            )}
          >
            {active === tab.id && (
              <motion.span
                layoutId="tab-pill"
                className="absolute inset-0 rounded-full bg-primary"
                transition={{ type: 'spring', stiffness: 350, damping: 30 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5">
              <span>{tab.icon}</span>
              {tab.label}
            </span>
          </button>
        ))}
      </div>

      {/* Tab panel */}
      <AnimatePresence mode="wait">
        <motion.div
          key={active}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="rounded-3xl border border-border/60 bg-card/60 backdrop-blur-sm p-8 md:p-12 grid md:grid-cols-2 gap-10 items-center"
        >
          <div>
            <h3 className="font-display text-2xl md:text-3xl font-bold text-foreground mb-4">
              {current.headline}
            </h3>
            <p className="text-muted-foreground leading-relaxed">{current.body}</p>

            <div className="mt-8 grid grid-cols-3 gap-4">
              {current.stats.map((stat) => (
                <div key={stat.label} className="text-center">
                  <p className="font-display text-2xl font-bold text-primary">{stat.value}</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-tight">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Right side: decorative terminal card */}
          <div className="rounded-2xl bg-muted/30 border border-border/50 p-5 font-mono text-xs leading-loose">
            <div className="flex gap-1.5 mb-4">
              {['#ef4444', '#eab308', '#22c55e'].map((c) => (
                <span key={c} className="w-3 h-3 rounded-full" style={{ background: c }} />
              ))}
            </div>
            <p className="text-muted-foreground">
              <span className="text-green-400">$</span> astra analyze ./deal-docs/parkview-om.pdf
            </p>
            <p className="text-muted-foreground mt-1">
              <span className="text-primary/70">→</span> Extracting rent roll... <span className="text-green-400">✓</span>
            </p>
            <p className="text-muted-foreground">
              <span className="text-primary/70">→</span> Fetching Pearl District comps... <span className="text-green-400">✓</span>
            </p>
            <p className="text-muted-foreground">
              <span className="text-primary/70">→</span> Running AI scoring model...
            </p>
            <motion.p
              className="text-foreground font-bold mt-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.4 }}
              key={active}
            >
              Deal Score: <span className="text-green-400">82 / 100</span> — Strong Buy
            </motion.p>
          </div>
        </motion.div>
      </AnimatePresence>
    </motion.section>
  );
}

// ─────────────────────────────────────────────────────────────────
// Footer
// ─────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer className="border-t border-border/40 bg-background/80 backdrop-blur-sm mt-24">
      <div className="max-w-6xl mx-auto px-4 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <span className="font-display text-xl font-bold text-foreground tracking-tight">ASTRA</span>
            <p className="text-sm text-muted-foreground mt-3 leading-relaxed max-w-xs">
              The all-in-one multifamily investment platform. AI-native underwriting for the modern CRE firm.
            </p>
            <div className="flex gap-3 mt-5">
              {['𝕏', 'in', '⬡'].map((icon, i) => (
                <a
                  key={i}
                  href="#"
                  className="w-8 h-8 rounded-lg border border-border/60 flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors text-xs"
                >
                  {icon}
                </a>
              ))}
            </div>
          </div>

          {/* Link groups */}
          {Object.entries(FOOTER_LINKS).map(([group, links]) => (
            <div key={group}>
              <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-4">{group}</p>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link}>
                    <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex flex-col md:flex-row justify-between items-center gap-4 pt-8 border-t border-border/40 text-xs text-muted-foreground">
          <p>© 2026 ASTRA Technologies, Inc. All rights reserved.</p>
          <p className="font-mono">v2.4.1 · Built on Vercel · Powered by OpenAI</p>
        </div>
      </div>
    </footer>
  );
}

// ─────────────────────────────────────────────────────────────────
// Stat Counter — animates number on scroll
// ─────────────────────────────────────────────────────────────────
function StatCounter({ value, label, prefix = '', suffix = '' }: {
  value: number; label: string; prefix?: string; suffix?: string;
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const mv = useMotionValue(0);
  const spring = useSpring(mv, { stiffness: 100, damping: 30 });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (inView) mv.set(value);
  }, [inView, mv, value]);

  useEffect(() => spring.on('change', (v) => setDisplay(Math.round(v))), [spring]);

  return (
    <div ref={ref} className="text-center">
      <p className="font-display text-4xl md:text-5xl font-bold text-foreground">
        {prefix}{display.toLocaleString()}{suffix}
      </p>
      <p className="text-sm text-muted-foreground mt-2">{label}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Landing — main export
// ─────────────────────────────────────────────────────────────────
export function Landing() {

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">

      {/* ── Nav ──────────────────────────────────────────────── */}
      <nav className="fixed top-0 inset-x-0 z-50 h-16 flex items-center px-6 border-b border-border/30 bg-background/70 backdrop-blur-xl">
        <div className="flex items-center justify-between w-full max-w-7xl mx-auto">
          <span className="font-display text-xl font-bold tracking-tight text-foreground">ASTRA</span>

          <div className="hidden md:flex items-center gap-7 text-sm text-muted-foreground">
            {['Product', 'Market Intel', 'Pricing', 'Docs', 'Blog'].map((item) => (
              <a key={item} href="#" className="hover:text-foreground transition-colors">{item}</a>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <a href="/login" className="hidden md:block text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5">
              Sign in
            </a>
            <a
              href="/register"
              className="text-sm font-medium bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors"
            >
              Get started
            </a>
          </div>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center text-center pt-16 overflow-hidden">
        {/* Aurora background */}
        <div className="absolute inset-0 bg-[hsl(263,30%,5%)]">
          <AuroraCanvas />
        </div>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background" />

        <div className="relative z-10 max-w-5xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            <span className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-primary px-3 py-1.5 rounded-full border border-primary/40 bg-primary/10 mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              Now in Public Beta — 1,200+ Deals Scored This Week
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="font-display text-5xl md:text-7xl lg:text-8xl font-bold text-white leading-[1.05] tracking-tight"
          >
            Underwrite faster.
            <br />
            <span className="bg-gradient-to-r from-violet-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              Close smarter.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="mt-7 text-xl md:text-2xl text-white/60 max-w-3xl mx-auto leading-relaxed"
          >
            ASTRA is the AI-native multifamily investment platform. Upload a deal in 30 seconds,
            get a full underwriting model with comps, score, and risk flags — instantly.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <a
              href="/register"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground px-8 py-4 rounded-xl text-base font-semibold hover:bg-primary/90 transition-all hover:scale-105 shadow-lg shadow-primary/25"
            >
              Start free trial
              <span aria-hidden>→</span>
            </a>
            <a
              href="#demo"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 border border-white/20 text-white/80 px-8 py-4 rounded-xl text-base font-medium hover:border-white/40 hover:text-white transition-all backdrop-blur-sm"
            >
              Watch demo
              <span aria-hidden>▶</span>
            </a>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="mt-5 text-xs text-white/30 font-mono"
          >
            No credit card required · 14-day free trial · Cancel anytime
          </motion.p>
        </div>

        {/* Scroll cue */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.6 }}
          className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 text-white/30"
        >
          <motion.div
            animate={{ y: [0, 6, 0] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
            className="w-5 h-8 rounded-full border border-white/20 flex items-start justify-center pt-1.5"
          >
            <div className="w-0.5 h-1.5 rounded-full bg-white/40" />
          </motion.div>
          <span className="text-[10px] font-mono uppercase tracking-widest">Scroll</span>
        </motion.div>
      </section>

      {/* ── Tech Strip ──────────────────────────────────────── */}
      <TechStrip />

      {/* ── Stats Bar ───────────────────────────────────────── */}
      <section className="py-20 px-4 max-w-5xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 divide-x divide-border/40">
          <StatCounter value={12400} label="Deals analyzed" suffix="+" />
          <StatCounter value={4} label="Avg. underwriting time (min)" />
          <StatCounter value={150} label="MSAs covered" suffix="+" />
          <StatCounter value={97} label="Extraction accuracy" suffix="%" />
        </div>
      </section>

      {/* ── Deal Card Grid ───────────────────────────────────── */}
      <section id="demo" className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <span className="text-xs font-mono uppercase tracking-widest text-primary px-3 py-1 rounded-full border border-primary/30 bg-primary/10">
              Live Demo
            </span>
            <h2 className="font-display text-4xl md:text-5xl font-bold mt-5 mb-4 text-foreground">
              See ASTRA score a deal.
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Real properties, real submarket data, real AI scores. This is what hits your dashboard on day one.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {DEMO_DEALS.map((deal, i) => (
              <DemoCard key={deal.id} deal={deal} delay={i * 0.12} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Feature Tabs ────────────────────────────────────── */}
      <FeatureTabs />

      {/* ── CTA Band ────────────────────────────────────────── */}
      <section className="relative py-28 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background to-background" />
        <div className="relative z-10 max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <h2 className="font-display text-4xl md:text-5xl font-bold text-foreground mb-5">
              Ready to underwrite at the speed of AI?
            </h2>
            <p className="text-muted-foreground text-lg mb-10">
              Join 400+ investment firms already using ASTRA. Free trial, no credit card required.
            </p>
            <a
              href="/register"
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-10 py-4 rounded-xl text-lg font-semibold hover:bg-primary/90 transition-all hover:scale-105 shadow-xl shadow-primary/25"
            >
              Start your free trial
              <span aria-hidden>→</span>
            </a>
          </motion.div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────── */}
      <Footer />
    </div>
  );
}

export default Landing;
