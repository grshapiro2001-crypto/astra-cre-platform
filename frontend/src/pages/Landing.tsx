import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { WebGLMeshGradient } from '@/components/WebGLMeshGradient';

/* ─── Scroll Reveal Hook ─── */
function useScrollReveal() {
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('in');
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: '-20px' }
    );
    document.querySelectorAll('[data-r]').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

/* ─── Property Card Data ─── */
interface PropCard {
  img: string;
  fallback: string;
  stage: string;
  stageBg: string;
  score: number;
  scoreBg: string;
  name: string;
  location: string;
  cap: string;
  irr: string;
  price: string;
}

const COL_0: PropCard[] = [
  { img: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=600&h=450&q=85', fallback: 'https://picsum.photos/seed/mf1/600/450', stage: 'Underwriting', stageBg: 'bg-accent/90', score: 88, scoreBg: 'bg-accent', name: 'One Uptown Tower', location: 'Dallas, TX \u00a0\u00b7\u00a0 390 units \u00a0\u00b7\u00a0 Highrise', cap: '4.6%', irr: '15.2%', price: '$112M' },
  { img: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=600&h=450&q=85', fallback: 'https://picsum.photos/seed/mf2/600/450', stage: 'Screening', stageBg: 'bg-zinc-400/90', score: 70, scoreBg: 'bg-zinc-400', name: 'Amber Pines at Fosters Mill', location: 'Jacksonville, FL \u00a0\u00b7\u00a0 184 units \u00a0\u00b7\u00a0 Garden', cap: '5.7%', irr: '11.4%', price: '$28.9M' },
  { img: 'https://images.unsplash.com/photo-1574362848149-11496d93a7c7?auto=format&fit=crop&w=600&h=450&q=85', fallback: 'https://picsum.photos/seed/mf3/600/450', stage: 'LOI', stageBg: 'bg-zinc-500/90', score: 77, scoreBg: 'bg-accent', name: 'Broadstone Memorial', location: 'Houston, TX \u00a0\u00b7\u00a0 290 units \u00a0\u00b7\u00a0 Mid-Rise', cap: '5.2%', irr: '13.1%', price: '$55.7M' },
  { img: 'https://images.unsplash.com/photo-1560185007-cde436f6a4d0?auto=format&fit=crop&w=600&h=450&q=85', fallback: 'https://picsum.photos/seed/mf4/600/450', stage: 'Due Diligence', stageBg: 'bg-zinc-300/90', score: 85, scoreBg: 'bg-accent', name: 'Elev8 at Nocatee', location: 'Ponte Vedra, FL \u00a0\u00b7\u00a0 156 units \u00a0\u00b7\u00a0 BFR', cap: '5.3%', irr: '14.2%', price: '$26.3M' },
];

const COL_1: PropCard[] = [
  { img: 'https://images.unsplash.com/photo-1460317442991-0ec209397118?auto=format&fit=crop&w=600&h=450&q=85', fallback: 'https://picsum.photos/seed/mf5/600/450', stage: 'Closed', stageBg: 'bg-zinc-600/90', score: 91, scoreBg: 'bg-white/20', name: 'The Bravern', location: 'Bellevue, WA \u00a0\u00b7\u00a0 324 units \u00a0\u00b7\u00a0 Highrise', cap: '4.9%', irr: '15.7%', price: '$74.6M' },
  { img: 'https://images.unsplash.com/photo-1567496898669-ee935f5f647a?auto=format&fit=crop&w=600&h=450&q=85', fallback: 'https://picsum.photos/seed/mf6/600/450', stage: 'Underwriting', stageBg: 'bg-accent/90', score: 83, scoreBg: 'bg-accent', name: 'Alexan on 8th', location: 'Atlanta, GA \u00a0\u00b7\u00a0 218 units \u00a0\u00b7\u00a0 Podium', cap: '5.25%', irr: '14.8%', price: '$35.9M' },
  { img: 'https://images.unsplash.com/photo-1580041065738-e72023775cdc?auto=format&fit=crop&w=600&h=450&q=85', fallback: 'https://picsum.photos/seed/mf7/600/450', stage: 'LOI', stageBg: 'bg-zinc-500/90', score: 76, scoreBg: 'bg-accent', name: 'Retreat at Peachtree City', location: 'Peachtree City, GA \u00a0\u00b7\u00a0 278 units \u00a0\u00b7\u00a0 Garden', cap: '5.4%', irr: '12.8%', price: '$52.3M' },
  { img: 'https://images.unsplash.com/photo-1487958449943-2429e8be8625?auto=format&fit=crop&w=600&h=450&q=85', fallback: 'https://picsum.photos/seed/mf8/600/450', stage: 'Screening', stageBg: 'bg-zinc-400/90', score: 73, scoreBg: 'bg-zinc-400', name: 'Skyhouse Midtown', location: 'Atlanta, GA \u00a0\u00b7\u00a0 312 units \u00a0\u00b7\u00a0 Highrise', cap: '4.8%', irr: '12.9%', price: '$62.1M' },
];

const COL_2: PropCard[] = [
  { img: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=600&h=450&q=85', fallback: 'https://picsum.photos/seed/mf9/600/450', stage: 'Due Diligence', stageBg: 'bg-zinc-300/90', score: 88, scoreBg: 'bg-accent', name: 'Domain at Assembly Row', location: 'Somerville, MA \u00a0\u00b7\u00a0 185 units \u00a0\u00b7\u00a0 Mid-Rise', cap: '5.5%', irr: '14.4%', price: '$41.2M' },
  { img: 'https://images.unsplash.com/photo-1570129477492-45c003edd2be?auto=format&fit=crop&w=600&h=450&q=85', fallback: 'https://picsum.photos/seed/mf10/600/450', stage: 'Underwriting', stageBg: 'bg-accent/90', score: 77, scoreBg: 'bg-accent', name: 'Camden Cypress Creek', location: 'Fort Lauderdale, FL \u00a0\u00b7\u00a0 148 units \u00a0\u00b7\u00a0 Garden', cap: '5.0%', irr: '12.6%', price: '$38.9M' },
  { img: 'https://images.unsplash.com/photo-1551361415-69c87624334f?auto=format&fit=crop&w=600&h=450&q=85', fallback: 'https://picsum.photos/seed/mf11/600/450', stage: 'Screening', stageBg: 'bg-zinc-400/90', score: 72, scoreBg: 'bg-zinc-400', name: 'Novel Perimeter', location: 'Dunwoody, GA \u00a0\u00b7\u00a0 190 units \u00a0\u00b7\u00a0 Wrap', cap: '5.6%', irr: '11.9%', price: '$39.7M' },
  { img: 'https://images.unsplash.com/photo-1448630360428-65456659e636?auto=format&fit=crop&w=600&h=450&q=85', fallback: 'https://picsum.photos/seed/mf12/600/450', stage: 'Closed', stageBg: 'bg-zinc-600/90', score: 79, scoreBg: 'bg-white/20', name: 'Hanover Buckhead Village', location: 'Atlanta, GA \u00a0\u00b7\u00a0 224 units \u00a0\u00b7\u00a0 Highrise', cap: '4.7%', irr: '13.5%', price: '$68.4M' },
];

function PropertyCard({ card }: { card: PropCard }) {
  return (
    <div className="prop-card">
      <img src={card.img} alt={card.name} loading="lazy" onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = card.fallback; }} />
      <div className="prop-overlay">
        <div className="flex items-center justify-between mb-1.5">
          <span className={`px-2 py-0.5 rounded ${card.stageBg} text-[7px] uppercase tracking-widest text-white font-semibold`}>{card.stage}</span>
          <span className={`w-7 h-7 rounded-full ${card.scoreBg} flex items-center justify-center text-[10px] font-bold text-white`}>{card.score}</span>
        </div>
        <p className="text-[11px] font-semibold text-white leading-tight">{card.name}</p>
        <p className="font-mono text-[9px] text-zinc-400 mt-0.5">{card.location}</p>
        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-white/[0.05] font-mono text-[9px]">
          <span className="text-zinc-500">Cap <span className="text-white/75">{card.cap}</span></span>
          <span className="w-px h-2.5 bg-white/10" />
          <span className="text-zinc-500">IRR <span className="text-white/75">{card.irr}</span></span>
          <span className="ml-auto text-zinc-600">{card.price}</span>
        </div>
      </div>
    </div>
  );
}

const TICKER_ITEMS = [
  'AI Deal Scoring', 'Rent Roll Extraction', 'T-12 Parsing', '3D Stacking Models',
  'DCF & Proforma', 'Pipeline Kanban', 'LP Reporting', 'Screening Automation',
  'Comp Analysis', 'Submarket Intel',
];

function TickerStrip() {
  return (
    <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-zinc-800 flex items-center gap-12 px-4">
      {TICKER_ITEMS.map((item) => (
        <span key={item} className="flex items-center gap-12">
          <span>{item}</span>
          <span className="text-accent/15">{'\u2022'}</span>
        </span>
      ))}
    </span>
  );
}

function CheckIcon() {
  return <svg className="w-3 h-3 text-accent" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" d="M4.5 12.75l6 6 9-13.5" /></svg>;
}

function ArrowIcon({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12h15m0 0l-6.75-6.75M19.5 12l-6.75 6.75" /></svg>;
}

function SecurityFeature({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-lg bg-accent/5 border border-accent/8 flex items-center justify-center shrink-0">{icon}</div>
      <div><p className="text-[11px] text-ivory font-medium">{title}</p><p className="text-[10px] text-zinc-600">{desc}</p></div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   Landing Page
   ═══════════════════════════════════════════════ */

export default function Landing() {
  const [mobileOpen, setMobileOpen] = useState(false);
  useScrollReveal();

  return (
    <div className="grain overflow-x-hidden" style={{ background: '#060608', color: '#8a8a92', fontVariantNumeric: 'tabular-nums' }}>

      {/* ── NAV ── */}
      <nav className="fixed top-4 left-1/2 -translate-x-1/2 z-50 transition-all duration-500">
        <div className="dopp">
          <div className="dopp-inner flex items-center gap-6 px-5 py-2.5 backdrop-blur-2xl">
            <a href="#" className="flex items-center gap-2 shrink-0">
              <div className="w-7 h-7 rounded-lg bg-accent/10 border border-accent/15 flex items-center justify-center">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round">
                  <path d="M12 2v6M12 16v6M2 12h6M16 12h6M5.6 5.6l3.5 3.5M14.9 14.9l3.5 3.5M18.4 5.6l-3.5 3.5M9.1 14.9l-3.5 3.5" />
                  <circle cx="12" cy="12" r="2" fill="#ffffff" stroke="none" />
                </svg>
              </div>
              <span className="text-sm font-bold text-ivory tracking-tight">talisman</span>
            </a>
            <div className="hidden md:flex items-center gap-5">
              <a href="#product" className="text-[13px] text-zinc-500 hover:text-ivory transition-colors duration-300">Product</a>
              <a href="#platform" className="text-[13px] text-zinc-500 hover:text-ivory transition-colors duration-300">Platform</a>
              <a href="#trust" className="text-[13px] text-zinc-500 hover:text-ivory transition-colors duration-300">Security</a>
            </div>
            <Link to="/login" className="hidden sm:block text-[13px] text-zinc-500 hover:text-ivory transition-colors duration-300">Sign in</Link>
            <a href="#cta" className="hidden sm:flex items-center gap-1 bg-accent/10 rounded-full pl-4 pr-1.5 py-1.5 text-[13px] text-accent font-medium border border-accent/12 hover:bg-accent/15 transition-all duration-300 shrink-0">
              Get early access
              <span className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center ml-0.5"><ArrowIcon className="w-3 h-3 text-accent" /></span>
            </a>
            <button className="md:hidden text-zinc-500" aria-label="Menu" onClick={() => setMobileOpen(!mobileOpen)}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-bg/95 backdrop-blur-2xl flex flex-col items-center justify-center gap-8">
          <a href="#product" className="text-xl text-zinc-300 hover:text-accent transition-colors" onClick={() => setMobileOpen(false)}>Product</a>
          <a href="#platform" className="text-xl text-zinc-300 hover:text-accent transition-colors" onClick={() => setMobileOpen(false)}>Platform</a>
          <a href="#trust" className="text-xl text-zinc-300 hover:text-accent transition-colors" onClick={() => setMobileOpen(false)}>Security</a>
          <Link to="/login" className="text-xl text-zinc-300 hover:text-accent transition-colors" onClick={() => setMobileOpen(false)}>Sign in</Link>
          <a href="#cta" className="mt-4 text-accent border border-accent/15 px-8 py-3 rounded-full" onClick={() => setMobileOpen(false)}>Get early access</a>
          <button onClick={() => setMobileOpen(false)} className="absolute top-6 right-6 text-zinc-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" d="M6 6l12 12M6 18L18 6" /></svg>
          </button>
        </div>
      )}

      {/* ── HERO ── */}
      <section className="hero-section relative min-h-[100dvh] flex items-center">
        <WebGLMeshGradient />
        <div className="hero-fade" />
        <div className="hero-horizon" />
        <div className="w-full max-w-[900px] mx-auto px-6 lg:px-16 pt-36 pb-24 text-center relative z-10">
          <div className="inline-flex items-center gap-3 mb-10" style={{ animation: 'enter-up 0.5s ease-out 0.2s both' }}>
            <span className="w-2 h-2 rounded-full bg-accent" style={{ animation: 'breathe 2.5s ease-in-out infinite' }} />
            <span className="font-mono text-[11px] tracking-wide text-accent">Public beta -- accepting early access</span>
          </div>
          <h1 style={{ animation: 'headline-reveal 1s cubic-bezier(0.22,1,0.36,1) 0.1s both' }}>
            <span className="block text-[3rem] md:text-[4rem] lg:text-[5rem] xl:text-[5.75rem] font-extrabold leading-[0.95] tracking-tighter text-white">Underwrite multifamily</span>
            <span className="block text-[3rem] md:text-[4rem] lg:text-[5rem] xl:text-[5.75rem] font-extrabold leading-[0.95] tracking-tighter mt-2" style={{ background: 'linear-gradient(135deg, #d4d4d8 0%, #e4e4e7 50%, #f4f4f5 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>at the speed of AI.</span>
          </h1>
          <div className="mx-auto h-[2px] bg-gradient-to-r from-transparent via-accent/50 to-transparent mt-8 mb-8" style={{ width: 120, animation: 'line-draw 0.8s cubic-bezier(0.22,1,0.36,1) 0.7s both', overflow: 'hidden' }} />
          <p className="text-lg lg:text-[19px] leading-relaxed max-w-[540px] mx-auto" style={{ color: 'rgba(200,205,215,0.70)', animation: 'enter-up 0.8s cubic-bezier(0.22,1,0.36,1) 0.5s both' }}>
            Drop an offering memorandum. Talisman extracts 50+ fields, scores the deal across three intelligence layers, and builds your full proforma -- in seconds.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-10" style={{ animation: 'enter-up 0.8s cubic-bezier(0.22,1,0.36,1) 0.65s both' }}>
            <a href="#cta" className="mag inline-flex items-center gap-2.5 bg-accent text-bg font-bold px-8 py-4 rounded-full text-[15px]">
              Request demo
              <span className="w-7 h-7 rounded-full bg-white/15 flex items-center justify-center"><ArrowIcon /></span>
            </a>
            <a href="#product" className="inline-flex items-center gap-2 text-white/50 text-sm hover:text-accent/80 transition-colors duration-300 py-4">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /><path strokeLinecap="round" d="M15.91 11.672a.375.375 0 0 1 0 .656l-5.603 3.113a.375.375 0 0 1-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112Z" /></svg>
              See it in action
            </a>
          </div>
        </div>
      </section>

      {/* ── HERO TRANSITION ── */}
      <div className="hero-transition">
        <div className="absolute inset-0 opacity-30" style={{ background: 'repeating-linear-gradient(90deg, transparent, transparent 120px, rgba(255,255,255,0.008) 120px, rgba(255,255,255,0.008) 121px)' }} />
      </div>

      {/* ── TICKER ── */}
      <div className="py-3 border-t border-b border-white/[0.025] overflow-hidden relative">
        <div className="flex whitespace-nowrap will-change-transform" style={{ animation: 'ticker 45s linear infinite' }}>
          <TickerStrip /><TickerStrip />
        </div>
        <div className="pointer-events-none absolute inset-y-0 left-0 w-28 bg-gradient-to-r from-bg to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-28 bg-gradient-to-l from-bg to-transparent" />
      </div>

      {/* ── 3D PROPERTY MARQUEE ── */}
      <section className="pt-24 pb-4 lg:pt-32 overflow-hidden">
        <div className="text-center mb-12 px-6" data-r="">
          <span className="font-mono text-[10px] tracking-[0.3em] text-accent/40 uppercase">Deal Pipeline</span>
          <h2 className="text-3xl lg:text-[2.65rem] font-extrabold text-ivory leading-[1.08] tracking-tight mt-4">Manage your pipeline.</h2>
          <p className="text-zinc-500 mt-4 max-w-lg mx-auto leading-relaxed text-[14px]">Track every deal from first look to close. AI scores update as new documents come in, keeping your team aligned on what to pursue next.</p>
        </div>
        <div className="marquee-3d-wrapper">
          <div className="pointer-events-none absolute inset-y-0 left-0 w-36 z-10" style={{ background: 'linear-gradient(to right,#060608,transparent)' }} />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-36 z-10" style={{ background: 'linear-gradient(to left,#060608,transparent)' }} />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-32 z-10" style={{ background: 'linear-gradient(to bottom,#060608,transparent)' }} />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 z-10" style={{ background: 'linear-gradient(to top,#060608,transparent)' }} />
          <div className="marquee-3d-inner">
            <div className="marquee-3d-stage">
              <div className="marquee-3d-grid">
                <div className="marquee-3d-col col-float-a">{COL_0.map((c) => <PropertyCard key={c.name} card={c} />)}</div>
                <div className="marquee-3d-col col-float-b">{COL_1.map((c) => <PropertyCard key={c.name} card={c} />)}</div>
                <div className="marquee-3d-col col-float-a" style={{ animationDelay: '-3s' }}>{COL_2.map((c) => <PropertyCard key={c.name} card={c} />)}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── EXTRACTION / PRODUCT ── */}
      <section id="product" className="py-28 lg:py-40 px-6 lg:px-16 xl:px-20 max-w-[1440px] mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.3fr] gap-14 lg:gap-20 items-center">
          <div data-r="l">
            <span className="font-mono text-[10px] tracking-[0.3em] text-accent/40 uppercase">01 -- Document Intelligence</span>
            <h2 className="text-3xl lg:text-[2.65rem] font-extrabold text-ivory leading-[1.08] tracking-tight mt-4">From PDF to proforma.<br />No spreadsheet required.</h2>
            <p className="text-zinc-400 mt-5 leading-relaxed max-w-[440px]">Upload any offering memorandum, rent roll, or T-12. Talisman&apos;s AI parses every line -- GSR, vacancy, OpEx, unit mix, BOV pricing tiers -- and builds your underwriting model automatically.</p>
            <div className="mt-8 grid grid-cols-3 gap-5">
              <div><p className="font-mono text-2xl text-accent font-bold">50+</p><p className="font-mono text-[9px] text-zinc-600 uppercase tracking-widest mt-1">Fields</p></div>
              <div><p className="font-mono text-2xl text-ivory font-bold">28</p><p className="font-mono text-[9px] text-zinc-600 uppercase tracking-widest mt-1">Doc types</p></div>
              <div><p className="font-mono text-2xl text-ivory font-bold">1.8s</p><p className="font-mono text-[9px] text-zinc-600 uppercase tracking-widest mt-1">Avg. parse</p></div>
            </div>
          </div>
          <div data-r="r" style={{ transitionDelay: '0.1s' }}>
            <div className="dopp"><div className="dopp-inner">
              <div className="px-5 py-3 border-b border-white/[0.025] flex items-center justify-between">
                <span className="font-mono text-[10px] text-zinc-600">Upload &amp; Extract</span>
                <div className="flex gap-1.5"><span className="w-2 h-2 rounded-full bg-zinc-600" /><span className="w-2 h-2 rounded-full bg-zinc-500" /><span className="w-2 h-2 rounded-full bg-zinc-400" /></div>
              </div>
              <div className="p-5">
                <div className="flex items-center gap-3 pb-4 mb-4 border-b border-white/[0.025]">
                  <div className="w-10 h-12 rounded-lg bg-accent/5 border border-accent/10 flex items-center justify-center"><span className="font-mono text-[8px] text-accent/50">OM</span></div>
                  <div className="flex-1"><p className="font-mono text-[11px] text-ivory">1160-hammond-dr-om.pdf</p><p className="font-mono text-[9px] text-zinc-700">4.2 MB -- Offering Memorandum</p></div>
                  <span className="font-mono text-[8px] text-accent uppercase tracking-widest">Done</span>
                </div>
                <div className="space-y-2.5">
                  {[
                    { text: 'Rent roll -- 218 units parsed', time: '0.4s', delay: '0.5s' },
                    { text: 'T-12 financials -- 36 line items', time: '0.6s', delay: '0.9s' },
                    { text: 'BOV pricing -- 3 scenarios', time: '0.3s', delay: '1.3s' },
                  ].map((item) => (
                    <div key={item.text} className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full bg-accent/10 border border-accent/15 flex items-center justify-center" style={{ animation: `check-pop 0.3s ease-out ${item.delay} both` }}><CheckIcon /></div>
                      <span className="font-mono text-[10px] text-zinc-500 flex-1">{item.text}</span>
                      <span className="font-mono text-[9px] text-zinc-700">{item.time}</span>
                    </div>
                  ))}
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-accent/10 border border-accent/15 flex items-center justify-center" style={{ animation: 'check-pop 0.3s ease-out 1.7s both' }}><CheckIcon /></div>
                    <span className="font-mono text-[10px] text-zinc-500 flex-1">Score: <span className="text-accent font-medium">83.4</span> -- Strong Buy</span>
                    <span className="font-mono text-[9px] text-zinc-700">1.8s</span>
                  </div>
                </div>
                <div className="mt-5 pt-4 border-t border-white/[0.025] grid grid-cols-2 gap-x-6 gap-y-2 font-mono text-[10px]">
                  <div className="flex justify-between"><span className="text-zinc-600">Property</span><span className="text-ivory">1160 Hammond Dr NE</span></div>
                  <div className="flex justify-between"><span className="text-zinc-600">Submarket</span><span className="text-ivory">Sandy Springs, GA</span></div>
                  <div className="flex justify-between"><span className="text-zinc-600">Units</span><span className="text-accent font-medium">218</span></div>
                  <div className="flex justify-between"><span className="text-zinc-600">T-12 NOI</span><span className="text-accent font-medium">$1,884,320</span></div>
                  <div className="flex justify-between"><span className="text-zinc-600">Cap Rate</span><span className="text-accent font-medium">5.25%</span></div>
                  <div className="flex justify-between"><span className="text-zinc-600">Occupancy</span><span className="text-ivory">93.2%</span></div>
                </div>
              </div>
            </div></div>
          </div>
        </div>
      </section>

      {/* ── PLATFORM BENTO ── */}
      <section id="platform" className="py-28 lg:py-40 px-6 lg:px-16 xl:px-20 max-w-[1440px] mx-auto">
        <div data-r="">
          <span className="font-mono text-[10px] tracking-[0.3em] text-accent/40 uppercase">02 -- The Platform</span>
          <h2 className="text-3xl lg:text-[2.65rem] font-extrabold text-ivory leading-[1.08] tracking-tight mt-4">Seven modules. One intelligence layer.</h2>
          <p className="text-zinc-400 mt-4 max-w-xl leading-relaxed">Every tool your deal team needs, connected by a single AI engine.</p>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-14">
          {/* Property Detail (2x2) */}
          <div className="col-span-2 row-span-2" data-r="s" style={{ transitionDelay: '0.05s' }}>
            <div className="shim dopp h-full"><div className="dopp-inner p-6 h-full flex flex-col justify-between min-h-[320px]">
              <div>
                <div className="flex gap-1.5 mb-4">
                  <span className="font-mono text-[8px] text-accent px-2 py-1 rounded-md bg-accent/8 border border-accent/10">Overview</span>
                  <span className="font-mono text-[8px] text-zinc-700 px-2 py-1">Financials</span>
                  <span className="font-mono text-[8px] text-zinc-700 px-2 py-1">Stacking</span>
                  <span className="font-mono text-[8px] text-zinc-700 px-2 py-1">UW</span>
                  <span className="font-mono text-[8px] text-zinc-700 px-2 py-1">Comps</span>
                </div>
                <div className="flex items-start gap-4">
                  <div className="relative w-14 h-14 shrink-0">
                    <svg viewBox="0 0 56 56" className="w-14 h-14 -rotate-90"><circle cx="28" cy="28" r="22" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="3.5" /><circle cx="28" cy="28" r="22" fill="none" stroke="#ffffff" strokeWidth="3.5" strokeLinecap="round" strokeDasharray="138.2" strokeDashoffset="22.9" /></svg>
                    <span className="absolute inset-0 flex items-center justify-center font-mono text-[14px] font-bold text-accent">83</span>
                  </div>
                  <div>
                    <p className="text-[13px] text-ivory font-medium">1160 Hammond Dr NE</p>
                    <p className="font-mono text-[9px] text-zinc-600 mt-0.5">Sandy Springs -- 218 Units -- 1998</p>
                    <span className="inline-block mt-1.5 px-1.5 py-0.5 rounded text-[7px] font-mono bg-accent/10 text-accent border border-accent/10">STRONG PASS</span>
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-white/[0.025]">
                <p className="font-mono text-[7px] text-accent/35 uppercase tracking-widest mb-2">AI Thesis</p>
                <p className="text-[11px] text-zinc-500 leading-relaxed">Value-add repositioning opportunity. Below-market rents with 12% upside. Only 340 units under construction in 3-mile radius.</p>
              </div>
              <div className="grid grid-cols-4 gap-3 mt-3">
                <div><p className="font-mono text-[8px] text-zinc-600">NOI</p><p className="font-mono text-[11px] text-ivory font-medium">$1.88M</p></div>
                <div><p className="font-mono text-[8px] text-zinc-600">Cap</p><p className="font-mono text-[11px] text-accent font-medium">5.25%</p></div>
                <div><p className="font-mono text-[8px] text-zinc-600">IRR</p><p className="font-mono text-[11px] text-ivory font-medium">14.8%</p></div>
                <div><p className="font-mono text-[8px] text-zinc-600">Occ.</p><p className="font-mono text-[11px] text-ivory font-medium">93.2%</p></div>
              </div>
            </div></div>
            <p className="font-mono text-[9px] text-zinc-700 mt-3 tracking-wide uppercase">Property Intelligence -- 7 Tabs</p>
          </div>
          {/* Underwriting */}
          <div className="col-span-2" data-r="s" style={{ transitionDelay: '0.1s' }}>
            <div className="shim glass rounded-xl p-5 min-h-[155px]">
              <p className="font-mono text-[8px] text-accent/35 uppercase tracking-widest mb-3">Underwriting</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-3 rounded-lg bg-white/[0.015] border border-white/[0.025]"><p className="font-mono text-lg text-accent font-bold">14.8%</p><p className="font-mono text-[8px] text-zinc-600 mt-0.5">Levered IRR</p></div>
                <div className="text-center p-3 rounded-lg bg-white/[0.015] border border-white/[0.025]"><p className="font-mono text-lg text-ivory font-bold">2.14x</p><p className="font-mono text-[8px] text-zinc-600 mt-0.5">Equity Multiple</p></div>
                <div className="text-center p-3 rounded-lg bg-white/[0.015] border border-white/[0.025]"><p className="font-mono text-lg text-ivory font-bold">7.2%</p><p className="font-mono text-[8px] text-zinc-600 mt-0.5">Cash-on-Cash</p></div>
              </div>
            </div>
            <p className="font-mono text-[9px] text-zinc-700 mt-3 tracking-wide uppercase">DCF + Sensitivity</p>
          </div>
          {/* 3D Stacking */}
          <div className="col-span-1" data-r="s" style={{ transitionDelay: '0.15s' }}>
            <div className="shim glass rounded-xl p-4 min-h-[155px] flex flex-col justify-between">
              <div className="flex items-end justify-center gap-[3px] h-[70px]">
                <div className="w-[18%] rounded-t-sm bg-gradient-to-t from-accent/15 to-accent/45" style={{ height: '100%' }} />
                <div className="w-[15%] rounded-t-sm bg-gradient-to-t from-accent/10 to-accent/35" style={{ height: '80%' }} />
                <div className="w-[18%] rounded-t-sm bg-gradient-to-t from-accent/12 to-accent/42" style={{ height: '92%' }} />
                <div className="w-[15%] rounded-t-sm bg-gradient-to-t from-accent/8 to-accent/30" style={{ height: '72%' }} />
                <div className="w-[12%] rounded-t-sm bg-gradient-to-t from-accent/10 to-accent/38" style={{ height: '64%' }} />
              </div>
              <p className="font-mono text-[9px] text-zinc-600 mt-2">218 units -- Exploded view</p>
            </div>
            <p className="font-mono text-[9px] text-zinc-700 mt-3 tracking-wide uppercase">3D Stacking</p>
          </div>
          {/* Comps */}
          <div className="col-span-1" data-r="s" style={{ transitionDelay: '0.2s' }}>
            <div className="shim glass rounded-xl p-4 min-h-[155px] flex flex-col justify-between">
              <div className="space-y-1.5 font-mono text-[9px]">
                <div className="flex justify-between"><span className="text-zinc-600">Comp 1</span><span className="text-ivory">$1,485</span><span className="text-accent text-[8px]">+3.2%</span></div>
                <div className="flex justify-between"><span className="text-zinc-600">Comp 2</span><span className="text-ivory">$1,520</span><span className="text-accent text-[8px]">+5.6%</span></div>
                <div className="flex justify-between"><span className="text-zinc-600">Comp 3</span><span className="text-ivory">$1,410</span><span className="text-zinc-400 text-[8px]">-1.8%</span></div>
                <div className="flex justify-between pt-1.5 border-t border-white/[0.025]"><span className="text-zinc-600">Subject</span><span className="text-accent font-medium">$1,340</span><span className="text-[8px] text-zinc-700">avg</span></div>
              </div>
            </div>
            <p className="font-mono text-[9px] text-zinc-700 mt-3 tracking-wide uppercase">Rent Comps</p>
          </div>
          {/* Data Bank */}
          <div className="col-span-2 lg:col-span-4" data-r="s" style={{ transitionDelay: '0.25s' }}>
            <div className="shim glass rounded-xl p-5 flex flex-col sm:flex-row items-start sm:items-center gap-5">
              <div className="flex-1"><p className="font-mono text-[8px] text-accent/35 uppercase tracking-widest mb-1">Data Bank</p><p className="text-[13px] text-ivory">Centralized sales comps, supply pipeline, and market research -- cross-referenced across every deal.</p></div>
              <div className="flex items-center gap-5 shrink-0 font-mono text-[10px]">
                <div className="text-center"><p className="text-accent font-semibold text-base">847</p><p className="text-zinc-700 text-[8px]">Sales comps</p></div>
                <div className="w-px h-7 bg-white/[0.03]" />
                <div className="text-center"><p className="text-ivory font-semibold text-base">47</p><p className="text-zinc-700 text-[8px]">MSAs</p></div>
                <div className="w-px h-7 bg-white/[0.03]" />
                <div className="text-center"><p className="text-ivory font-semibold text-base">1,240</p><p className="text-zinc-700 text-[8px]">Pipeline units</p></div>
              </div>
            </div>
            <p className="font-mono text-[9px] text-zinc-700 mt-3 tracking-wide uppercase">Comps + Pipeline + Research</p>
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <section className="py-24 lg:py-32 px-6 lg:px-16 xl:px-20 max-w-[1440px] mx-auto border-t border-white/[0.025]">
        <div data-r="" className="grid grid-cols-2 lg:grid-cols-[2.5fr_1fr_1fr_1.5fr] gap-8 lg:gap-0 items-end">
          <div className="col-span-2 lg:col-span-1 lg:pr-12">
            <p className="font-mono text-[9px] text-accent/25 uppercase tracking-widest mb-2">Traction</p>
            <p className="font-mono text-6xl lg:text-8xl font-bold text-accent leading-none tracking-tighter">4,247</p>
            <p className="text-sm text-zinc-600 uppercase tracking-widest mt-3">Deals Analyzed</p>
          </div>
          <div className="lg:border-l lg:border-white/[0.03] lg:pl-10"><p className="font-mono text-4xl lg:text-5xl font-bold text-ivory leading-none tracking-tight">97.3<span className="text-zinc-700">%</span></p><p className="text-sm text-zinc-600 uppercase tracking-widest mt-3">Extraction Accuracy</p></div>
          <div className="lg:border-l lg:border-white/[0.03] lg:pl-10"><p className="font-mono text-4xl lg:text-5xl font-bold text-ivory leading-none tracking-tight">&lt;8<span className="text-zinc-700">s</span></p><p className="text-sm text-zinc-600 uppercase tracking-widest mt-3">Avg. Score Time</p></div>
          <div className="lg:border-l lg:border-white/[0.03] lg:pl-10"><p className="font-mono text-4xl lg:text-5xl font-bold text-ivory leading-none tracking-tight">50<span className="text-zinc-700">+</span></p><p className="text-sm text-zinc-600 uppercase tracking-widest mt-3">Fields Per Document</p></div>
        </div>
      </section>

      {/* ── TRUST ── */}
      <section id="trust" className="py-28 lg:py-40 px-6 lg:px-16 xl:px-20 bg-surface/50">
        <div className="max-w-[1440px] mx-auto grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-16 lg:gap-24">
          <div data-r="l">
            <span className="font-mono text-[10px] tracking-[0.3em] text-accent/40 uppercase">03 -- Enterprise Security</span>
            <h2 className="text-3xl lg:text-[2.65rem] font-extrabold text-ivory leading-[1.08] tracking-tight mt-4">Built for firms where compliance<br />is non-negotiable.</h2>
            <p className="text-zinc-400 mt-5 max-w-md leading-relaxed">Enterprise infrastructure with the security posture your LPs require.</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-5 mt-10">
              <SecurityFeature icon={<svg className="w-3.5 h-3.5 text-accent" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" /></svg>} title="SOC 2 Type II" desc="Annual audit" />
              <SecurityFeature icon={<svg className="w-3.5 h-3.5 text-accent" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" /></svg>} title="AES-256" desc="At rest & in transit" />
              <SecurityFeature icon={<svg className="w-3.5 h-3.5 text-accent" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128H5.228A2.25 2.25 0 0 1 3 16.878V15c0-2.318 1.942-4.274 4.345-4.295a6.024 6.024 0 0 0 1.905.306 6.023 6.023 0 0 0 1.905-.306C13.058 10.726 15 12.682 15 15v1.128ZM12 4.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" /></svg>} title="RBAC" desc="Granular permissions" />
              <SecurityFeature icon={<svg className="w-3.5 h-3.5 text-accent" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg>} title="Audit Trail" desc="Every action logged" />
              <SecurityFeature icon={<svg className="w-3.5 h-3.5 text-accent" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" /></svg>} title="99.9% SLA" desc="Uptime guaranteed" />
              <SecurityFeature icon={<svg className="w-3.5 h-3.5 text-accent" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3" /></svg>} title="Data Residency" desc="US / EU selectable" />
            </div>
          </div>
          <div data-r="r" className="flex flex-col justify-center" style={{ transitionDelay: '0.15s' }}>
            <div className="border-l-2 border-accent/8 pl-8 py-2">
              <span className="text-4xl text-accent/8 leading-none">&ldquo;</span>
              <p className="text-[17px] text-zinc-300 leading-relaxed mt-3" style={{ fontStyle: 'italic' }}>We used to spend 6 hours per deal on initial underwriting. With Talisman, our analysts get a scored model with comps in under 10 minutes. It changed how we allocate attention.</p>
              <div className="mt-8"><div className="w-8 h-px bg-accent/15 mb-4" /><p className="text-sm text-ivory font-medium">Marcus Chen</p><p className="font-mono text-[10px] text-zinc-600 mt-0.5">MD, Acquisitions -- Greystone Capital Partners</p></div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section id="cta" className="py-32 lg:py-44 px-6 lg:px-16 xl:px-20 relative overflow-hidden">
        <div className="absolute inset-0 -z-10" style={{ background: 'radial-gradient(ellipse 40% 50% at 50% 50%, rgba(255,255,255,0.025) 0%, transparent 70%)' }} />
        <div data-r="" className="max-w-2xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 mb-7">
            <span className="w-1.5 h-1.5 rounded-full bg-accent" style={{ animation: 'breathe 2s ease-in-out infinite' }} />
            <span className="font-mono text-[10px] tracking-[0.25em] text-accent/50 uppercase">Early access</span>
          </div>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-ivory leading-[1.08] tracking-tight">See Talisman score<br />your next deal.</h2>
          <p className="text-zinc-400 mt-5 text-lg leading-relaxed max-w-md mx-auto">15-minute walkthrough. Bring your own OM -- we&apos;ll extract, score, and model it live.</p>
          <form className="mt-10 flex flex-col sm:flex-row gap-3 max-w-lg mx-auto" onSubmit={(e) => e.preventDefault()}>
            <input type="email" placeholder="you@yourfirm.com" className="flex-1 bg-surface-raised/80 border border-white/[0.035] rounded-full px-6 py-3.5 text-ivory text-sm placeholder:text-zinc-700 focus:border-accent/25 focus:ring-1 focus:ring-accent/8 outline-none transition-all duration-300" />
            <button type="submit" className="mag flex items-center gap-2 justify-center bg-accent text-bg font-bold px-7 py-3.5 rounded-full text-sm">
              Request demo
              <span className="w-5 h-5 rounded-full bg-white/15 flex items-center justify-center"><svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12h15m0 0l-6.75-6.75M19.5 12l-6.75 6.75" /></svg></span>
            </button>
          </form>
          <p className="font-mono text-[10px] text-zinc-700 mt-5">No commitment. No credit card.</p>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-white/[0.02] py-16 px-6 lg:px-16 xl:px-20">
        <div className="max-w-[1440px] mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-10 mb-12">
            <div className="col-span-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-accent/8 border border-accent/10 flex items-center justify-center">
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round"><path d="M12 2v5M12 17v5M2 12h5M17 12h5" /><circle cx="12" cy="12" r="1.5" fill="#ffffff" stroke="none" /></svg>
                </div>
                <span className="text-sm font-bold text-ivory/50 tracking-tight">talisman</span>
              </div>
              <p className="text-[13px] text-zinc-700 mt-3 max-w-xs leading-relaxed">AI-native deal intelligence for multifamily investment teams.</p>
            </div>
            <div>
              <p className="font-mono text-[9px] uppercase tracking-widest text-zinc-800 mb-4">Product</p>
              <ul className="space-y-2.5">
                <li><a href="#product" className="text-[13px] text-zinc-600 hover:text-zinc-400 transition-colors">Extraction</a></li>
                <li><a href="#product" className="text-[13px] text-zinc-600 hover:text-zinc-400 transition-colors">Scoring</a></li>
                <li><a href="#platform" className="text-[13px] text-zinc-600 hover:text-zinc-400 transition-colors">Pipeline</a></li>
                <li><a href="#platform" className="text-[13px] text-zinc-600 hover:text-zinc-400 transition-colors">Data Bank</a></li>
              </ul>
            </div>
            <div>
              <p className="font-mono text-[9px] uppercase tracking-widest text-zinc-800 mb-4">Company</p>
              <ul className="space-y-2.5">
                <li><Link to="/about" className="text-[13px] text-zinc-600 hover:text-zinc-400 transition-colors">About</Link></li>
                <li><Link to="/pricing" className="text-[13px] text-zinc-600 hover:text-zinc-400 transition-colors">Pricing</Link></li>
                <li><a href="#cta" className="text-[13px] text-zinc-600 hover:text-zinc-400 transition-colors">Contact</a></li>
              </ul>
            </div>
            <div>
              <p className="font-mono text-[9px] uppercase tracking-widest text-zinc-800 mb-4">Legal</p>
              <ul className="space-y-2.5">
                <li><Link to="/privacy" className="text-[13px] text-zinc-600 hover:text-zinc-400 transition-colors">Privacy</Link></li>
                <li><Link to="/terms" className="text-[13px] text-zinc-600 hover:text-zinc-400 transition-colors">Terms</Link></li>
                <li><Link to="/security" className="text-[13px] text-zinc-600 hover:text-zinc-400 transition-colors">Security</Link></li>
              </ul>
            </div>
          </div>
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 pt-8 border-t border-white/[0.015]">
            <p className="font-mono text-[10px] text-zinc-800">&copy; 2026 Talisman IO Inc.</p>
            <p className="font-mono text-[10px] text-zinc-800">Powered by Anthropic Claude</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
