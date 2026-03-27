import { Link } from 'react-router-dom';
import TalismanCompass3D from '@/components/TalismanCompass3D';

const EFFECTIVE_DATE = 'March 16, 2026';
const ENTITY_NAME = 'Talisman IO';
const CONTACT_EMAIL = 'griffin@talisman.io';

export function TermsOfService() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 h-16 flex items-center px-6 border-b border-border/30 bg-background/70 backdrop-blur-xl">
        <div className="flex items-center justify-between w-full max-w-7xl mx-auto">
          <Link to="/" className="flex items-center gap-2">
            <TalismanCompass3D size={28} spin={false} />
            <span className="font-display text-xl font-bold tracking-tight text-foreground">Talisman</span>
          </Link>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 pt-28 pb-20">
        {/* Draft banner */}
        <div className="mb-8 rounded-xl border border-amber-500/30 bg-amber-500/10 px-5 py-3 text-sm text-amber-300">
          <strong>Draft</strong> — Last updated {EFFECTIVE_DATE}. This document has not been reviewed by legal counsel and should be reviewed by a licensed attorney before publication.
        </div>

        <h1 className="font-display text-4xl font-bold text-foreground mb-2">Terms of Service</h1>
        <p className="text-muted-foreground text-sm mb-10">Effective date: {EFFECTIVE_DATE}</p>

        <div className="prose-custom space-y-8 text-muted-foreground leading-relaxed">

          {/* ── 1 ── */}
          <section>
            <h2 className="font-display text-xl font-semibold text-foreground mb-3">1. Agreement to Terms</h2>
            <p className="text-sm italic text-muted-foreground/70 mb-2">Plain English: By using Talisman, you agree to these terms.</p>
            <p>
              These Terms of Service ("Terms") govern your access to and use of {ENTITY_NAME} ("Talisman," "we," "us," or "our"),
              an AI-powered multifamily commercial real estate deal analysis platform. By creating an account or using the platform,
              you agree to be bound by these Terms and our{' '}
              <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>, which together constitute
              the entire agreement between you and {ENTITY_NAME} regarding use of the Service.
            </p>
            <p className="mt-2">
              If you do not agree to these Terms, do not use Talisman. You must be at least <strong className="text-foreground">16 years of age</strong> to
              use the Service. By using Talisman, you represent that you are at least 16 years old and have the legal authority to
              enter into these Terms on behalf of yourself or your organization.
            </p>
          </section>

          {/* ── 2 ── */}
          <section>
            <h2 className="font-display text-xl font-semibold text-foreground mb-3">2. Description of Service</h2>
            <p className="text-sm italic text-muted-foreground/70 mb-2">Plain English: Talisman helps you analyze multifamily real estate deals using AI.</p>
            <p>
              Talisman is a SaaS platform that provides AI-powered multifamily commercial real estate analysis, including
              document extraction (offering memorandums, rent rolls, T-12 financials, broker opinions of value), deal scoring,
              underwriting tools, and market intelligence. The platform uses the Anthropic Claude API for AI-powered extraction
              and analysis.
            </p>
          </section>

          {/* ── 3 ── */}
          <section>
            <h2 className="font-display text-xl font-semibold text-foreground mb-3">3. User Obligations</h2>
            <p className="text-sm italic text-muted-foreground/70 mb-2">Plain English: Use the platform honestly, don't try to break it, and keep your credentials secure.</p>
            <p>You agree to:</p>
            <ul className="list-disc list-inside space-y-1 mt-2 ml-2">
              <li>Provide accurate information when creating your account and uploading documents.</li>
              <li>Maintain the confidentiality of your login credentials and notify us promptly of any unauthorized access.</li>
              <li>Use the platform only for lawful commercial real estate analysis purposes.</li>
              <li>Comply with all applicable laws and regulations in your use of the Service.</li>
            </ul>
            <p className="mt-3">You agree not to:</p>
            <ul className="list-disc list-inside space-y-1 mt-2 ml-2">
              <li>Scrape, crawl, or harvest data from the platform by automated means.</li>
              <li>Reverse-engineer, decompile, or disassemble any part of the platform.</li>
              <li>Use the platform to compete directly with Talisman or to build a substantially similar product.</li>
              <li>Share login credentials with unauthorized users beyond your subscription tier.</li>
              <li>Upload documents that contain malware, viruses, or malicious code.</li>
              <li>Attempt to gain unauthorized access to other users' data or any part of our infrastructure.</li>
            </ul>
          </section>

          {/* ── 4 ── */}
          <section>
            <h2 className="font-display text-xl font-semibold text-foreground mb-3">4. Intellectual Property</h2>
            <p className="text-sm italic text-muted-foreground/70 mb-2">Plain English: We own the platform; you own your data.</p>
            <p>
              {ENTITY_NAME} and its licensors retain all rights, title, and interest in the platform, including its design,
              code, AI models, scoring algorithms, and brand. You retain full ownership of all documents you upload (OMs,
              rent rolls, T-12s, BOVs) and any data you input.
            </p>
            <p className="mt-2">
              By uploading documents, you grant {ENTITY_NAME} a limited, non-exclusive, revocable license to process them
              through our AI pipeline solely to deliver the Service to you. This license terminates when you delete the
              associated property or close your account.
            </p>
          </section>

          {/* ── 5 ── */}
          <section>
            <h2 className="font-display text-xl font-semibold text-foreground mb-3">5. Data Handling</h2>
            <p className="text-sm italic text-muted-foreground/70 mb-2">Plain English: Your documents are processed by AI and stored securely. We don't sell your data.</p>
            <p>
              Documents you upload are processed using the <strong className="text-foreground">Anthropic Claude API</strong> for
              AI-powered extraction. Anthropic currently retains API inputs and outputs for up to{' '}
              <strong className="text-foreground">7 days</strong> solely for trust and safety purposes, after which they are
              automatically deleted. Anthropic does not use commercial API data to train their models.
            </p>
            <p className="mt-2">
              Your data is not sold or shared with third parties for marketing purposes. Documents and financial data are stored
              on our platform infrastructure (Render for backend, Vercel for frontend). For full details on data practices,
              including retention periods and your privacy rights, see our{' '}
              <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>.
            </p>
          </section>

          {/* ── 6 ── */}
          <section>
            <h2 className="font-display text-xl font-semibold text-foreground mb-3">6. Subscription &amp; Billing</h2>
            <p className="text-sm italic text-muted-foreground/70 mb-2">Plain English: We offer tiered pricing with a free trial. Subscriptions auto-renew unless you cancel.</p>
            <p>
              Talisman offers tiered subscription plans (Analyst, Team, Firm) with a 14-day free trial. Subscriptions renew
              automatically at the end of each billing period (monthly or annual). You may cancel your subscription at any time;
              cancellation takes effect at the end of the current billing period. No refunds are provided for partial billing periods
              unless required by applicable law.
            </p>
            <p className="mt-2">
              We reserve the right to change pricing with <strong className="text-foreground">30 days' advance notice</strong>.
              Price changes will not apply to the current billing period. Pricing details are available on
              our <Link to="/pricing" className="text-primary hover:underline">Pricing page</Link>.
            </p>
          </section>

          {/* ── 7 ── */}
          <section>
            <h2 className="font-display text-xl font-semibold text-foreground mb-3">7. Disclaimer of Warranties</h2>
            <p className="text-sm italic text-muted-foreground/70 mb-2">Plain English: Talisman is a tool, not investment advice. We provide it "as is."</p>
            <p>
              TALISMAN PROVIDES ANALYSIS TOOLS AND IS NOT A LICENSED BROKER-DEALER, INVESTMENT ADVISOR, OR FIDUCIARY. All deal
              scores, underwriting models, and market data are provided for <strong className="text-foreground">informational
              purposes only</strong> and do not constitute investment advice. You are solely responsible for your own investment decisions.
            </p>
            <p className="mt-2">
              THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
              INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, ACCURACY,
              AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR SECURE, OR THAT
              ANY DEFECTS WILL BE CORRECTED. WE DO NOT GUARANTEE THE ACCURACY, COMPLETENESS, OR RELIABILITY OF ANY AI-GENERATED
              ANALYSIS, DEAL SCORES, OR EXTRACTED DATA.
            </p>
          </section>

          {/* ── 8 ── */}
          <section>
            <h2 className="font-display text-xl font-semibold text-foreground mb-3">8. Limitation of Liability</h2>
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, {ENTITY_NAME} AND ITS OFFICERS, DIRECTORS, EMPLOYEES, AND AGENTS
              SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT
              LIMITED TO LOSS OF PROFITS, DATA, BUSINESS OPPORTUNITIES, OR GOODWILL, ARISING OUT OF OR RELATED TO YOUR USE OF THE SERVICE.
            </p>
            <p className="mt-2">
              OUR TOTAL AGGREGATE LIABILITY FOR ANY CLAIMS ARISING FROM OR RELATED TO THESE TERMS OR THE SERVICE SHALL NOT EXCEED
              THE GREATER OF (A) THE AMOUNT YOU PAID TO {ENTITY_NAME} IN THE <strong className="text-foreground">12 MONTHS</strong> PRECEDING
              THE CLAIM, OR (B) ONE HUNDRED U.S. DOLLARS ($100).
            </p>
          </section>

          {/* ── 9 ── */}
          <section>
            <h2 className="font-display text-xl font-semibold text-foreground mb-3">9. Indemnification</h2>
            <p className="text-sm italic text-muted-foreground/70 mb-2">Plain English: If your misuse of the platform causes us legal trouble, you agree to cover the costs.</p>
            <p>
              You agree to indemnify, defend, and hold harmless {ENTITY_NAME}, its officers, directors, employees, and agents
              from and against any claims, damages, losses, liabilities, costs, and expenses (including reasonable attorneys' fees)
              arising out of or related to: (a) your use of the Service in violation of these Terms; (b) your violation of any
              applicable law or regulation; (c) any content you upload that infringes the intellectual property or privacy rights
              of a third party; or (d) any dispute between you and a third party related to your use of the Service.
            </p>
          </section>

          {/* ── 10 ── */}
          <section>
            <h2 className="font-display text-xl font-semibold text-foreground mb-3">10. Dispute Resolution</h2>
            <p className="text-sm italic text-muted-foreground/70 mb-2">Plain English: Let's try to resolve disagreements informally first. If we can't, Georgia courts apply.</p>
            <p>
              <strong className="text-foreground">Informal resolution:</strong> Before filing any formal proceeding, you agree to
              contact us at{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary hover:underline">{CONTACT_EMAIL}</a>{' '}
              and attempt to resolve the dispute informally for at least 30 days.
            </p>
            <p className="mt-2">
              <strong className="text-foreground">Governing law:</strong> These Terms are governed by and construed in accordance with
              the laws of the State of Georgia, USA, without regard to conflict of law provisions.
            </p>
            <p className="mt-2">
              <strong className="text-foreground">Jurisdiction:</strong> Any disputes not resolved informally will be resolved in the
              state or federal courts located in Fulton County, Georgia. You consent to the personal jurisdiction of these courts.
            </p>
            <p className="mt-2">
              <strong className="text-foreground">Class action waiver:</strong> TO THE EXTENT PERMITTED BY APPLICABLE LAW, YOU AGREE
              THAT ANY DISPUTES WILL BE RESOLVED ON AN INDIVIDUAL BASIS AND NOT AS PART OF A CLASS, CONSOLIDATED, OR REPRESENTATIVE
              ACTION. If this waiver is found unenforceable as to a particular claim, that claim shall be severed and proceed in court
              while remaining claims proceed individually.
            </p>
          </section>

          {/* ── 11 ── */}
          <section>
            <h2 className="font-display text-xl font-semibold text-foreground mb-3">11. Termination</h2>
            <p>
              We may suspend or terminate your account if you violate these Terms, or if required by law. We will provide reasonable
              notice before termination where practicable, unless the violation poses an immediate risk to the platform or other users.
            </p>
            <p className="mt-2">
              You may close your account at any time from your account settings or by contacting us. Upon termination, your right to
              use the platform ceases immediately. You may request deletion of your data per our{' '}
              <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>.
            </p>
            <p className="mt-2">
              Sections 7 (Disclaimer of Warranties), 8 (Limitation of Liability), 9 (Indemnification), 10 (Dispute Resolution),
              and 13 (General Provisions) survive termination of these Terms.
            </p>
          </section>

          {/* ── 12 ── */}
          <section>
            <h2 className="font-display text-xl font-semibold text-foreground mb-3">12. Changes to Terms</h2>
            <p>
              We may update these Terms from time to time. If we make material changes, we will notify registered users by email
              at least <strong className="text-foreground">30 days</strong> before the changes take effect. The "Effective date" at
              the top of this page indicates when it was last revised. Continued use of the platform after the effective date of
              revised Terms constitutes acceptance of the updated Terms. If you do not agree to the updated Terms, you must stop
              using the Service.
            </p>
          </section>

          {/* ── 13 ── */}
          <section>
            <h2 className="font-display text-xl font-semibold text-foreground mb-3">13. General Provisions</h2>

            <p className="mt-2">
              <strong className="text-foreground">Force majeure:</strong> {ENTITY_NAME} shall not be liable for any failure or delay
              in performance resulting from causes beyond our reasonable control, including but not limited to natural disasters,
              acts of government, internet or infrastructure outages, pandemics, or third-party service failures.
            </p>

            <p className="mt-2">
              <strong className="text-foreground">Severability:</strong> If any provision of these Terms is found to be unenforceable
              or invalid by a court of competent jurisdiction, that provision shall be enforced to the maximum extent permissible, and
              the remaining provisions shall remain in full force and effect.
            </p>

            <p className="mt-2">
              <strong className="text-foreground">Entire agreement:</strong> These Terms, together with the{' '}
              <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link> and{' '}
              <Link to="/cookies" className="text-primary hover:underline">Cookie Policy</Link>, constitute the entire agreement
              between you and {ENTITY_NAME} regarding your use of the Service and supersede all prior agreements and understandings.
            </p>

            <p className="mt-2">
              <strong className="text-foreground">Waiver:</strong> Our failure to enforce any right or provision of these Terms will
              not be considered a waiver of that right or provision.
            </p>

            <p className="mt-2">
              <strong className="text-foreground">Assignment:</strong> You may not assign or transfer your rights under these Terms
              without our prior written consent. We may assign our rights and obligations under these Terms without restriction.
            </p>
          </section>

          {/* ── Contact ── */}
          <section>
            <h2 className="font-display text-xl font-semibold text-foreground mb-3">Contact</h2>
            <p>
              Questions about these Terms? Email us at{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary hover:underline">{CONTACT_EMAIL}</a>.
            </p>
            <p className="mt-2 text-sm text-muted-foreground/70">
              {ENTITY_NAME} · Atlanta, GA · United States
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

export default TermsOfService;
