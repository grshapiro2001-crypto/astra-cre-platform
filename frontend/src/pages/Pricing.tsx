import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import { cn } from '@/lib/utils';
import TalismanCompass3D from '@/components/TalismanCompass3D';

interface PricingTier {
  name: string;
  monthlyPrice: number;
  annualPrice: number;
  description: string;
  users: string;
  cta: string;
  ctaStyle: 'outline' | 'primary' | 'outline';
  highlighted: boolean;
  features: { label: string; included: boolean | string }[];
}

const TIERS: PricingTier[] = [
  {
    name: 'Analyst',
    monthlyPrice: 49,
    annualPrice: 39,
    description: 'For individual analysts and solo operators.',
    users: '1 user',
    cta: 'Start free trial',
    ctaStyle: 'outline',
    highlighted: false,
    features: [
      { label: '25 properties / month', included: true },
      { label: '100 AI questions / month', included: true },
      { label: 'AI Deal Scoring', included: true },
      { label: 'AI Document Extraction', included: true },
      { label: 'Pipeline / Kanban Board', included: true },
      { label: 'BOV Generator', included: false },
      { label: 'Stacking Model', included: false },
      { label: 'Custom Scoring Weights', included: false },
      { label: 'API Access', included: false },
      { label: 'Email support', included: true },
    ],
  },
  {
    name: 'Team',
    monthlyPrice: 149,
    annualPrice: 119,
    description: 'For acquisitions teams that move fast.',
    users: 'Up to 5 users',
    cta: 'Start free trial',
    ctaStyle: 'primary',
    highlighted: true,
    features: [
      { label: '100 properties / month', included: true },
      { label: '500 AI questions / month', included: true },
      { label: 'AI Deal Scoring', included: true },
      { label: 'AI Document Extraction', included: true },
      { label: 'Pipeline / Kanban Board', included: true },
      { label: 'BOV Generator', included: true },
      { label: 'Stacking Model', included: true },
      { label: 'Custom Scoring Weights', included: false },
      { label: 'API Access', included: false },
      { label: 'Priority support', included: true },
    ],
  },
  {
    name: 'Firm',
    monthlyPrice: 399,
    annualPrice: 319,
    description: 'For investment firms with portfolio-scale needs.',
    users: 'Up to 15 users',
    cta: 'Contact sales',
    ctaStyle: 'outline',
    highlighted: false,
    features: [
      { label: 'Unlimited properties', included: true },
      { label: 'Unlimited AI questions', included: true },
      { label: 'AI Deal Scoring', included: true },
      { label: 'AI Document Extraction', included: true },
      { label: 'Pipeline / Kanban Board', included: true },
      { label: 'BOV Generator', included: true },
      { label: 'Stacking Model', included: true },
      { label: 'Custom Scoring Weights', included: true },
      { label: 'API Access', included: true },
      { label: 'Dedicated support', included: true },
    ],
  },
];

const FAQ = [
  {
    q: 'How does the 14-day free trial work?',
    a: 'You get full access to your chosen plan for 14 days. No credit card required. If you don\'t upgrade at the end, your account switches to read-only mode.',
  },
  {
    q: 'Can I change plans later?',
    a: 'Yes. You can upgrade or downgrade at any time. If you upgrade mid-cycle, you\'ll be credited for the remaining time on your current plan.',
  },
  {
    q: 'What counts as a "property"?',
    a: 'Each unique property you upload documents for counts as one property. Re-uploading updated documents for the same property does not count as a new property.',
  },
  {
    q: 'Do you offer annual billing?',
    a: 'Yes — annual billing saves 20% compared to monthly. Toggle the switch at the top of the pricing cards to see annual rates.',
  },
  {
    q: 'Is my data secure?',
    a: 'All data is encrypted in transit via HTTPS. Documents are processed via the Anthropic Claude API and are not retained beyond the processing window. See our Security page for details.',
  },
  {
    q: 'What happens to my data if I cancel?',
    a: 'You can export all documents and data before canceling. After cancellation, data is retained for 30 days in case you change your mind, then permanently deleted.',
  },
];

export function Pricing() {
  const [annual, setAnnual] = useState(false);
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 h-16 flex items-center px-6 border-b border-border/30 bg-background/70 backdrop-blur-xl">
        <div className="flex items-center justify-between w-full max-w-7xl mx-auto">
          <Link to="/" className="flex items-center gap-2">
            <TalismanCompass3D size={28} spin={false} />
            <span className="font-display text-xl font-bold tracking-tight text-foreground">Talisman</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/login" className="hidden md:block text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5">
              Sign in
            </Link>
            <Link
              to="/register"
              className="text-sm font-medium bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors"
            >
              Get started
            </Link>
          </div>
        </div>
      </nav>

      <div className="pt-28 pb-20 px-4 max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <span className="text-xs font-mono uppercase tracking-widest text-primary px-3 py-1 rounded-full border border-primary/30 bg-primary/10">
            Pricing
          </span>
          <h1 className="font-display text-4xl md:text-5xl font-bold text-foreground mt-5 mb-4">
            Simple pricing for every team size.
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Start with a 14-day free trial. No credit card required. Upgrade when you&apos;re ready.
          </p>

          {/* Annual toggle */}
          <div className="flex items-center justify-center gap-3 mt-8">
            <span className={cn('text-sm', !annual ? 'text-foreground font-medium' : 'text-muted-foreground')}>Monthly</span>
            <button
              onClick={() => setAnnual(!annual)}
              className={cn(
                'relative w-12 h-6 rounded-full transition-colors',
                annual ? 'bg-primary' : 'bg-muted/60',
              )}
            >
              <span
                className={cn(
                  'absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform',
                  annual ? 'translate-x-6' : 'translate-x-0.5',
                )}
              />
            </button>
            <span className={cn('text-sm', annual ? 'text-foreground font-medium' : 'text-muted-foreground')}>
              Annual <span className="text-primary text-xs font-mono ml-1">Save 20%</span>
            </span>
          </div>
        </div>

        {/* Pricing Cards */}
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 32 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="grid md:grid-cols-3 gap-6 mb-20"
        >
          {TIERS.map((tier) => (
            <div
              key={tier.name}
              className={cn(
                'rounded-2xl border backdrop-blur-sm p-8 flex flex-col',
                tier.highlighted
                  ? 'border-primary/60 bg-card/80 shadow-xl shadow-primary/10 ring-1 ring-primary/20'
                  : 'border-border/60 bg-card/50',
              )}
            >
              {tier.highlighted && (
                <span className="text-xs font-mono uppercase tracking-widest text-primary mb-4">
                  Most popular
                </span>
              )}
              <h3 className="font-display text-2xl font-bold text-foreground">{tier.name}</h3>
              <p className="text-sm text-muted-foreground mt-1 mb-6">{tier.description}</p>

              <div className="flex items-baseline gap-1 mb-1">
                <span className="font-display text-4xl font-bold text-foreground">
                  ${annual ? tier.annualPrice : tier.monthlyPrice}
                </span>
                <span className="text-muted-foreground text-sm">/mo</span>
              </div>
              <p className="text-xs text-muted-foreground mb-6">
                {tier.users} {annual ? '· billed annually' : '· billed monthly'}
              </p>

              {tier.name === 'Firm' ? (
                <a
                  href="mailto:griffin@talisman.io?subject=Talisman%20Firm%20Plan%20Inquiry"
                  className="w-full inline-flex items-center justify-center gap-2 border border-border/60 text-foreground px-6 py-3 rounded-xl text-sm font-semibold hover:border-primary/50 hover:text-primary transition-all mb-8"
                >
                  Contact sales
                </a>
              ) : (
                <Link
                  to="/register"
                  className={cn(
                    'w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all mb-8',
                    tier.highlighted
                      ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/25'
                      : 'border border-border/60 text-foreground hover:border-primary/50 hover:text-primary',
                  )}
                >
                  Start free trial
                </Link>
              )}

              <div className="flex-1 space-y-3">
                {tier.features.map((feature) => (
                  <div key={feature.label} className="flex items-center gap-3 text-sm">
                    {feature.included ? (
                      <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs flex-shrink-0">
                        &#10003;
                      </span>
                    ) : (
                      <span className="w-5 h-5 rounded-full bg-muted/30 text-muted-foreground/40 flex items-center justify-center text-xs flex-shrink-0">
                        &mdash;
                      </span>
                    )}
                    <span className={feature.included ? 'text-foreground' : 'text-muted-foreground/50'}>
                      {feature.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </motion.div>

        {/* FAQ */}
        <div className="max-w-3xl mx-auto">
          <h2 className="font-display text-3xl font-bold text-foreground text-center mb-10">
            Frequently asked questions
          </h2>
          <div className="space-y-6">
            {FAQ.map((item) => (
              <div key={item.q} className="rounded-xl border border-border/40 bg-card/30 p-6">
                <h3 className="font-semibold text-foreground mb-2">{item.q}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Pricing;
