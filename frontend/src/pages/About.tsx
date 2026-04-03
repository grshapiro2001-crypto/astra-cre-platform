import { Link } from 'react-router-dom';
import { TalismanLogo } from '@/components/ui/TalismanLogo';

export function About() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="fixed top-0 inset-x-0 z-50 h-16 flex items-center px-6 border-b border-border/30 bg-background/70 backdrop-blur-xl">
        <div className="flex items-center justify-between w-full max-w-7xl mx-auto">
          <Link to="/" className="flex items-center gap-2">
            <TalismanLogo size={24} />
            <span className="font-display text-xl font-bold tracking-tight text-foreground">Talisman</span>
          </Link>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 pt-28 pb-20">
        <h1 className="font-display text-4xl font-bold text-foreground mb-6">About Talisman IO</h1>

        <div className="space-y-6 text-muted-foreground leading-relaxed">
          <p className="text-lg">
            Talisman IO is an AI-native deal intelligence platform built for multifamily commercial real estate investment teams. We help acquisitions analysts, brokers, and portfolio managers move from document to decision in minutes instead of hours.
          </p>

          <p>
            The platform was built by <strong className="text-foreground">Griffin Shapiro</strong> at Walker &amp; Dunlop Investment Sales (WDIS) in Atlanta, born from firsthand experience with the inefficiencies of traditional CRE underwriting. Offering memorandums arrive as 80-page PDFs. Rent rolls come in every format imaginable. T-12 financials need to be manually re-keyed into Excel models. Talisman automates all of this.
          </p>

          <p>
            Upload a deal document — an OM, rent roll, T-12, or BOV — and Talisman's AI extraction pipeline (powered by Anthropic Claude) parses every line item, cross-references market comps, and populates a full underwriting model. Our proprietary deal scoring algorithm rates each opportunity on a 0-100 scale with transparent factor breakdowns so your team can triage faster and focus on the deals that matter.
          </p>

          <div className="rounded-2xl border border-border/60 bg-card/40 backdrop-blur-sm p-8 mt-8">
            <h2 className="font-display text-2xl font-bold text-foreground mb-4">What we believe</h2>
            <div className="space-y-4">
              <p><strong className="text-primary">The best tools feel like teammates, not software.</strong> Talisman is designed to think the way an analyst thinks — starting with the source documents, building up to a model, and flagging what matters.</p>
              <p><strong className="text-primary">Data should move at the speed of deals.</strong> In multifamily, timing is everything. If your underwriting takes longer than the broker's offer deadline, you've already lost.</p>
              <p><strong className="text-primary">AI should augment judgment, not replace it.</strong> Every score comes with a full factor breakdown. Every extraction is auditable. The human makes the call — the AI does the heavy lifting.</p>
            </div>
          </div>

          <div className="mt-8">
            <h2 className="font-display text-2xl font-bold text-foreground mb-3">Get in touch</h2>
            <p>Interested in Talisman for your team? Email <a href="mailto:griffin@talisman.io" className="text-primary hover:underline">griffin@talisman.io</a> or connect on <a href="https://www.linkedin.com/in/griffinshapiro/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">LinkedIn</a>.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default About;
