import { Link } from 'react-router-dom';
import { TalismanLogo } from '@/components/ui/TalismanLogo';

const EFFECTIVE_DATE = 'March 16, 2026';
const ENTITY_NAME = 'Talisman IO';
const CONTACT_EMAIL = 'griffin@talisman.io';
const WEBSITE_URL = 'https://talisman.io';

export function PrivacyPolicy() {
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
        <div className="mb-8 rounded-xl border border-amber-500/30 bg-amber-500/10 px-5 py-3 text-sm text-amber-300">
          <strong>Draft</strong> — Last updated {EFFECTIVE_DATE}. This document has not been reviewed by legal counsel and should be reviewed by a licensed attorney before publication.
        </div>

        <h1 className="font-display text-4xl font-bold text-foreground mb-2">Privacy Policy</h1>
        <p className="text-muted-foreground text-sm mb-10">Effective date: {EFFECTIVE_DATE}</p>

        <div className="prose-custom space-y-10 text-muted-foreground leading-relaxed">

          {/* ── SECTION 1 ── */}
          <section>
            <h2 className="font-display text-xl font-semibold text-foreground mb-3">1. Introduction</h2>
            <p className="text-sm italic text-muted-foreground/70 mb-2">
              Plain English: This policy explains what data we collect, how we use it, and what rights you have.
            </p>
            <p>
              {ENTITY_NAME} ("{ENTITY_NAME}," "we," "us," or "our") operates the commercial real estate analytics platform at{' '}
              <a href={WEBSITE_URL} className="text-primary hover:underline">{WEBSITE_URL}</a> (the "Service").
              This Privacy Policy describes how we collect, use, disclose, and protect personal information when you use our Service.
              By accessing or using {ENTITY_NAME}, you acknowledge that you have read and understand this Privacy Policy.
            </p>
            <p className="mt-2">
              If you are a resident of a jurisdiction with specific privacy rights (including California, the European Economic Area,
              the United Kingdom, or any of the US states listed in Section 10), additional disclosures and rights apply to you as
              described in those sections.
            </p>
          </section>

          {/* ── SECTION 2 ── */}
          <section>
            <h2 className="font-display text-xl font-semibold text-foreground mb-3">2. Information We Collect</h2>
            <p className="text-sm italic text-muted-foreground/70 mb-2">
              Plain English: We collect your account info, the documents you upload, and basic usage data.
            </p>

            <h3 className="text-foreground font-medium mt-4 mb-2">2.1 Information You Provide</h3>
            <p>
              <strong className="text-foreground">Account information:</strong> Name, email address, company name, and professional role — provided when you register.
            </p>
            <p className="mt-2">
              <strong className="text-foreground">Uploaded documents:</strong> Commercial real estate documents you submit for analysis, including offering memorandums (OMs),
              rent rolls, trailing 12-month financials (T-12s), broker opinions of value (BOVs), and related property data.
            </p>
            <p className="mt-2">
              <strong className="text-foreground">Communications:</strong> Emails, support requests, feedback, and any other content you send to us.
            </p>
            <p className="mt-2">
              <strong className="text-foreground">Payment information:</strong> If you subscribe to a paid plan, payment details are collected and processed directly by Stripe, Inc.
              We do not store your full credit card number on our servers.
            </p>

            <h3 className="text-foreground font-medium mt-4 mb-2">2.2 Information Collected Automatically</h3>
            <p>
              <strong className="text-foreground">Usage data:</strong> Browser type, operating system, device identifiers, pages visited, features used, timestamps, and interaction patterns.
            </p>
            <p className="mt-2">
              <strong className="text-foreground">Log data:</strong> IP address, referral URLs, and diagnostic information collected by our hosting infrastructure.
            </p>
            <p className="mt-2">
              <strong className="text-foreground">Cookies:</strong> Essential session cookies for authentication. We do not currently use third-party analytics or advertising cookies.
              See our <Link to="/cookies" className="text-primary hover:underline">Cookie Policy</Link> for details.
            </p>
          </section>

          {/* ── SECTION 3 ── */}
          <section>
            <h2 className="font-display text-xl font-semibold text-foreground mb-3">3. How We Use Your Information</h2>
            <p className="text-sm italic text-muted-foreground/70 mb-2">
              Plain English: We use your data to run the platform, improve it, and communicate with you.
            </p>
            <p>We use the information we collect for the following purposes:</p>
            <ul className="list-disc list-inside space-y-1 mt-2 ml-2">
              <li><strong className="text-foreground">Provide and operate the Service:</strong> Process your documents, generate deal scores, and deliver analysis results.</li>
              <li><strong className="text-foreground">AI-powered document extraction:</strong> Send uploaded documents to our AI sub-processor (Anthropic) to extract financial data and property metrics (see Section 4).</li>
              <li><strong className="text-foreground">Account management:</strong> Create and manage your account, authenticate sessions, and process payments.</li>
              <li><strong className="text-foreground">Communications:</strong> Send transactional emails (account confirmations, password resets, waitlist updates) and, with your consent, product announcements.</li>
              <li><strong className="text-foreground">Improvement and analytics:</strong> Understand usage patterns, diagnose technical issues, and improve the platform.</li>
              <li><strong className="text-foreground">Legal compliance:</strong> Comply with applicable laws, respond to legal process, and enforce our Terms of Service.</li>
            </ul>
          </section>

          {/* ── SECTION 4 ── */}
          <section>
            <h2 className="font-display text-xl font-semibold text-foreground mb-3">4. AI Document Processing &amp; Anthropic</h2>
            <p className="text-sm italic text-muted-foreground/70 mb-2">
              Plain English: Your documents are sent to Anthropic's Claude API for extraction. Anthropic currently retains API inputs for up to 7 days for safety, then deletes them. They do not train on your data.
            </p>
            <p>
              When you upload a document, its text content is sent to the <strong className="text-foreground">Anthropic Claude API</strong> for
              AI-powered extraction and analysis. This is how we extract financial metrics, unit mixes, and property data from your documents.
            </p>
            <p className="mt-2">
              <strong className="text-foreground">Anthropic's data handling:</strong> As of their current commercial API terms,
              Anthropic retains API inputs and outputs for up to <strong className="text-foreground">7 days</strong> solely for trust
              and safety purposes (abuse monitoring and policy enforcement), after which they are automatically deleted.
              Anthropic <strong className="text-foreground">does not use commercial API data to train their models</strong>.
              These terms are subject to change by Anthropic; we will update this section when materially different terms apply.
              For the most current details, see{' '}
              <a href="https://www.anthropic.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Anthropic's Privacy Policy</a>{' '}
              and their{' '}
              <a href="https://www.anthropic.com/policies/usage-policy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Usage Policy</a>.
            </p>
            <p className="mt-2">
              Extracted data (financial figures, property details, deal scores) is stored in our database. The raw document
              text may be cached on our servers for re-analysis without re-uploading, and is deleted when you delete the
              associated property from the platform.
            </p>
          </section>

          {/* ── SECTION 5 ── */}
          <section>
            <h2 className="font-display text-xl font-semibold text-foreground mb-3">5. Third-Party Service Providers (Sub-Processors)</h2>
            <p className="text-sm italic text-muted-foreground/70 mb-2">
              Plain English: We use a short list of trusted services to run the platform. Here is each one and what it does.
            </p>
            <p>We share personal information with the following categories of service providers, each of which processes data only as necessary to provide its service to us:</p>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border/40 text-left">
                    <th className="py-2 pr-4 text-foreground font-medium">Provider</th>
                    <th className="py-2 pr-4 text-foreground font-medium">Purpose</th>
                    <th className="py-2 text-foreground font-medium">Data Shared</th>
                  </tr>
                </thead>
                <tbody className="text-muted-foreground">
                  <tr className="border-b border-border/20">
                    <td className="py-2 pr-4">Anthropic</td>
                    <td className="py-2 pr-4">AI document extraction &amp; analysis</td>
                    <td className="py-2">Document text content</td>
                  </tr>
                  <tr className="border-b border-border/20">
                    <td className="py-2 pr-4">Vercel</td>
                    <td className="py-2 pr-4">Frontend hosting &amp; CDN</td>
                    <td className="py-2">IP address, browser metadata</td>
                  </tr>
                  <tr className="border-b border-border/20">
                    <td className="py-2 pr-4">Render</td>
                    <td className="py-2 pr-4">Backend hosting &amp; database</td>
                    <td className="py-2">All account and property data</td>
                  </tr>
                  <tr className="border-b border-border/20">
                    <td className="py-2 pr-4">Stripe</td>
                    <td className="py-2 pr-4">Payment processing</td>
                    <td className="py-2">Name, email, payment details</td>
                  </tr>
                  <tr className="border-b border-border/20">
                    <td className="py-2 pr-4">Resend</td>
                    <td className="py-2 pr-4">Transactional email delivery</td>
                    <td className="py-2">Email address, message content</td>
                  </tr>
                  <tr className="border-b border-border/20">
                    <td className="py-2 pr-4">Google Maps Platform</td>
                    <td className="py-2 pr-4">Property mapping &amp; geocoding</td>
                    <td className="py-2">Property addresses</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="mt-4">
              We do not sell, rent, or trade your personal information to third parties for their own marketing purposes.
              Enterprise customers may request a Data Processing Agreement (DPA) by contacting us at{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary hover:underline">{CONTACT_EMAIL}</a>.
            </p>
          </section>

          {/* ── SECTION 6 ── */}
          <section>
            <h2 className="font-display text-xl font-semibold text-foreground mb-3">6. Lawful Basis for Processing (EEA/UK)</h2>
            <p className="text-sm italic text-muted-foreground/70 mb-2">
              Plain English: If you're in the EU or UK, here's the legal justification for each type of data processing we do.
            </p>
            <p>If you are located in the European Economic Area or the United Kingdom, we rely on the following legal bases under the GDPR:</p>
            <ul className="list-disc list-inside space-y-1 mt-2 ml-2">
              <li><strong className="text-foreground">Performance of a contract:</strong> Processing your account data, documents, and payments to provide the Service you subscribed to.</li>
              <li><strong className="text-foreground">Legitimate interests:</strong> Usage analytics to improve the platform, fraud prevention, and security monitoring — balanced against your rights and freedoms.</li>
              <li><strong className="text-foreground">Consent:</strong> Marketing communications and optional analytics (you may withdraw consent at any time).</li>
              <li><strong className="text-foreground">Legal obligation:</strong> Retaining certain records where required by law (tax records, fraud investigations).</li>
            </ul>
          </section>

          {/* ── SECTION 7 ── */}
          <section>
            <h2 className="font-display text-xl font-semibold text-foreground mb-3">7. Data Retention</h2>
            <p className="text-sm italic text-muted-foreground/70 mb-2">
              Plain English: We keep your data while your account is active, and delete it within 30 days of account deletion. Here's a breakdown by data type.
            </p>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border/40 text-left">
                    <th className="py-2 pr-4 text-foreground font-medium">Data Category</th>
                    <th className="py-2 pr-4 text-foreground font-medium">Retention Period</th>
                    <th className="py-2 text-foreground font-medium">Criteria / Notes</th>
                  </tr>
                </thead>
                <tbody className="text-muted-foreground">
                  <tr className="border-b border-border/20">
                    <td className="py-2 pr-4">Account identifiers (name, email, company)</td>
                    <td className="py-2 pr-4">Duration of account + 30 days</td>
                    <td className="py-2">Deleted within 30 days of account closure</td>
                  </tr>
                  <tr className="border-b border-border/20">
                    <td className="py-2 pr-4">Uploaded documents &amp; extracted data</td>
                    <td className="py-2 pr-4">Until user-initiated deletion or account closure + 30 days</td>
                    <td className="py-2">Users may delete individual properties at any time</td>
                  </tr>
                  <tr className="border-b border-border/20">
                    <td className="py-2 pr-4">Payment / commercial information</td>
                    <td className="py-2 pr-4">Duration of account + up to 7 years</td>
                    <td className="py-2">Retained as required for tax and financial recordkeeping</td>
                  </tr>
                  <tr className="border-b border-border/20">
                    <td className="py-2 pr-4">Usage data &amp; internet activity logs</td>
                    <td className="py-2 pr-4">90 days (rolling)</td>
                    <td className="py-2">Automatically purged after 90 days</td>
                  </tr>
                  <tr className="border-b border-border/20">
                    <td className="py-2 pr-4">IP-derived geolocation</td>
                    <td className="py-2 pr-4">90 days (rolling)</td>
                    <td className="py-2">Stored as part of usage/log data</td>
                  </tr>
                  <tr className="border-b border-border/20">
                    <td className="py-2 pr-4">AI sub-processor (Anthropic API)</td>
                    <td className="py-2 pr-4">Up to 7 days</td>
                    <td className="py-2">Retained by Anthropic for trust &amp; safety; then auto-deleted</td>
                  </tr>
                  <tr className="border-b border-border/20">
                    <td className="py-2 pr-4">Inferences (deal scores, usage patterns)</td>
                    <td className="py-2 pr-4">Duration of account + 30 days</td>
                    <td className="py-2">Tied to account lifecycle</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="mt-4">
              <strong className="text-foreground">Account deletion:</strong> When you delete your account, all personal data,
              uploaded documents, and extracted analytics are purged from our active systems within <strong className="text-foreground">30 calendar days</strong>.
              Backup copies in encrypted backups may persist for up to an additional 30 days before automatic rotation.
            </p>
            <p className="mt-2">
              <strong className="text-foreground">Legal holds:</strong> We may retain data longer than stated above if required by law,
              regulation, or legal proceedings.
            </p>
          </section>

          {/* ── SECTION 8 ── */}
          <section>
            <h2 className="font-display text-xl font-semibold text-foreground mb-3">8. Data Security</h2>
            <p className="text-sm italic text-muted-foreground/70 mb-2">
              Plain English: We use encryption and trusted infrastructure to protect your data. If there's a breach, we'll tell you.
            </p>
            <p>
              We implement industry-standard technical and organizational measures to protect your personal information, including:
            </p>
            <ul className="list-disc list-inside space-y-1 mt-2 ml-2">
              <li>HTTPS/TLS encryption for all data in transit.</li>
              <li>Encryption at rest for database storage provided by our hosting infrastructure.</li>
              <li>Bcrypt password hashing — we never store plaintext passwords.</li>
              <li>JWT-based session authentication with configurable token expiration.</li>
              <li>Per-user data isolation — users can only access their own properties and documents.</li>
            </ul>
            <p className="mt-2">
              Our infrastructure providers (Vercel, Render) maintain SOC 2 Type II compliance. For more details,
              see our <Link to="/security" className="text-primary hover:underline">Security page</Link>.
            </p>

            <h3 className="text-foreground font-medium mt-4 mb-2">8.1 Breach Notification</h3>
            <p>
              In the event of a personal data breach that is likely to result in a risk to your rights and freedoms, we will:
            </p>
            <ul className="list-disc list-inside space-y-1 mt-2 ml-2">
              <li>Notify affected users by email without unreasonable delay, and no later than required by applicable law.</li>
              <li>Notify the relevant supervisory authority within <strong className="text-foreground">72 hours</strong> of becoming aware of the breach, as required by GDPR Article 33.</li>
              <li>Comply with all applicable US state breach notification laws, which generally require notification within 30–60 days depending on the jurisdiction.</li>
              <li>Provide details about the nature of the breach, the data affected, and the steps we are taking to address it.</li>
            </ul>

            <p className="mt-4">
              No system is 100% secure. If you become aware of a security vulnerability, please report it
              to <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary hover:underline">{CONTACT_EMAIL}</a>.
            </p>
          </section>

          {/* ── SECTION 9 ── */}
          <section>
            <h2 className="font-display text-xl font-semibold text-foreground mb-3">9. Cookies</h2>
            <p>
              We use essential cookies solely to maintain your authentication session. We do not currently deploy third-party analytics,
              advertising, or tracking cookies. For a complete description, see our{' '}
              <Link to="/cookies" className="text-primary hover:underline">Cookie Policy</Link>.
            </p>
          </section>

          {/* ── SECTION 10 ── */}
          <section>
            <h2 className="font-display text-xl font-semibold text-foreground mb-3">10. Your Privacy Rights</h2>
            <p className="text-sm italic text-muted-foreground/70 mb-2">
              Plain English: Depending on where you live, you have specific legal rights over your data. Here's what they are.
            </p>

            <h3 className="text-foreground font-medium mt-4 mb-2">10.1 Rights for All Users</h3>
            <p>Regardless of where you are located, you may:</p>
            <ul className="list-disc list-inside space-y-1 mt-2 ml-2">
              <li>Access the personal data we hold about you.</li>
              <li>Request correction of inaccurate data.</li>
              <li>Request deletion of your account and associated data.</li>
              <li>Export your uploaded documents.</li>
              <li>Opt out of marketing communications at any time.</li>
            </ul>

            <h3 className="text-foreground font-medium mt-4 mb-2">10.2 California Residents (CCPA/CPRA)</h3>
            <p>
              If you are a California resident, the California Consumer Privacy Act (as amended by the California Privacy Rights Act)
              provides you with additional rights. Below are the categories of personal information we collect, mapped to the CCPA's defined categories:
            </p>

            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border/40 text-left">
                    <th className="py-2 pr-3 text-foreground font-medium">CCPA Category</th>
                    <th className="py-2 pr-3 text-foreground font-medium">Examples</th>
                    <th className="py-2 pr-3 text-foreground font-medium">Collected</th>
                    <th className="py-2 pr-3 text-foreground font-medium">Sold/Shared</th>
                    <th className="py-2 text-foreground font-medium">Retention</th>
                  </tr>
                </thead>
                <tbody className="text-muted-foreground">
                  <tr className="border-b border-border/20">
                    <td className="py-2 pr-3">A. Identifiers</td>
                    <td className="py-2 pr-3">Name, email, IP address</td>
                    <td className="py-2 pr-3">Yes</td>
                    <td className="py-2 pr-3">No</td>
                    <td className="py-2">Account + 30 days</td>
                  </tr>
                  <tr className="border-b border-border/20">
                    <td className="py-2 pr-3">B. Personal information (Cal. Civ. Code § 1798.80)</td>
                    <td className="py-2 pr-3">Name, company name</td>
                    <td className="py-2 pr-3">Yes</td>
                    <td className="py-2 pr-3">No</td>
                    <td className="py-2">Account + 30 days</td>
                  </tr>
                  <tr className="border-b border-border/20">
                    <td className="py-2 pr-3">D. Commercial information</td>
                    <td className="py-2 pr-3">Subscription tier, payment history</td>
                    <td className="py-2 pr-3">Yes</td>
                    <td className="py-2 pr-3">No</td>
                    <td className="py-2">Account + up to 7 years</td>
                  </tr>
                  <tr className="border-b border-border/20">
                    <td className="py-2 pr-3">F. Internet / electronic network activity</td>
                    <td className="py-2 pr-3">Browser type, pages visited, features used</td>
                    <td className="py-2 pr-3">Yes</td>
                    <td className="py-2 pr-3">No</td>
                    <td className="py-2">90 days rolling</td>
                  </tr>
                  <tr className="border-b border-border/20">
                    <td className="py-2 pr-3">G. Geolocation data</td>
                    <td className="py-2 pr-3">IP-derived approximate location</td>
                    <td className="py-2 pr-3">Yes</td>
                    <td className="py-2 pr-3">No</td>
                    <td className="py-2">90 days rolling</td>
                  </tr>
                  <tr className="border-b border-border/20">
                    <td className="py-2 pr-3">K. Inferences</td>
                    <td className="py-2 pr-3">Deal scoring preferences, usage patterns</td>
                    <td className="py-2 pr-3">Yes</td>
                    <td className="py-2 pr-3">No</td>
                    <td className="py-2">Account + 30 days</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="mt-4">
              We do not collect Categories C (protected classifications), E (biometric), H (sensory),
              I (professional/employment beyond self-reported role), or J (education) data.
              We do not collect sensitive personal information as defined by the CPRA, including neural data.
            </p>

            <p className="mt-3"><strong className="text-foreground">Your CCPA/CPRA rights include:</strong></p>
            <ul className="list-disc list-inside space-y-1 mt-2 ml-2">
              <li><strong className="text-foreground">Right to know:</strong> Request disclosure of the categories and specific pieces of personal information we have collected about you.</li>
              <li><strong className="text-foreground">Right to delete:</strong> Request deletion of your personal information, subject to certain legal exceptions.</li>
              <li><strong className="text-foreground">Right to correct:</strong> Request correction of inaccurate personal information.</li>
              <li><strong className="text-foreground">Right to opt out of sale/sharing:</strong> We do not sell or share (as defined by the CCPA) your personal information. No opt-out is necessary, but we honor Global Privacy Control (GPC) signals as a valid opt-out request.</li>
              <li><strong className="text-foreground">Right to limit use of sensitive personal information:</strong> We do not collect sensitive personal information as defined by the CPRA.</li>
              <li><strong className="text-foreground">Right to non-discrimination:</strong> We will not discriminate against you for exercising your privacy rights.</li>
            </ul>

            <p className="mt-3">
              <strong className="text-foreground">Response timeline:</strong> We will acknowledge receipt of your request within 10 business
              days and provide a substantive response within <strong className="text-foreground">45 calendar days</strong> (extendable by an
              additional 45 days with notice if reasonably necessary).
            </p>

            <p className="mt-2">
              <strong className="text-foreground">Verification:</strong> We will verify your identity before fulfilling a request by matching
              the email address associated with your account.
            </p>

            <h3 className="text-foreground font-medium mt-6 mb-2">10.3 US State Privacy Laws</h3>
            <p>
              In addition to California, residents of the following states have privacy rights under their respective comprehensive
              privacy laws: Virginia (VCDPA), Colorado (CPA), Connecticut (CTDPA), Utah (UCPA), Iowa (ICDPA), Indiana (INCDPA),
              Tennessee (TIPA), Texas (TDPSA), Florida (FDBR), Maryland (MODPA), Minnesota (MCDPA), Montana (MCDPA), Oregon (OCPA),
              Delaware (DPDPA), New Hampshire (NHDPA), New Jersey (NJDPA), Kentucky (KCDPA), Nebraska (NDPA), and Rhode Island (RIDPA).
            </p>
            <p className="mt-2">
              These laws generally grant you the right to access, correct, delete, and obtain a copy of your personal data, as well as
              the right to opt out of targeted advertising, profiling, and the sale of personal data. We do not engage in the sale of
              personal data, targeted advertising based on personal data, or profiling in furtherance of decisions that produce legal
              or similarly significant effects.
            </p>
            <p className="mt-2">
              To exercise any of these rights, contact us at{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary hover:underline">{CONTACT_EMAIL}</a>.
              If we deny your request, you may appeal by emailing us with the subject line "Privacy Rights Appeal."
              We will respond to appeals within the timeframe required by your state's applicable law.
            </p>

            <h3 className="text-foreground font-medium mt-6 mb-2">10.4 European Economic Area &amp; United Kingdom (GDPR / UK GDPR)</h3>
            <p>If you are located in the EEA or UK, in addition to the rights listed in Section 10.1, you have the right to:</p>
            <ul className="list-disc list-inside space-y-1 mt-2 ml-2">
              <li><strong className="text-foreground">Data portability:</strong> Receive your personal data in a structured, commonly used, machine-readable format.</li>
              <li><strong className="text-foreground">Restriction of processing:</strong> Request that we limit processing of your data in certain circumstances.</li>
              <li><strong className="text-foreground">Object to processing:</strong> Object to processing based on legitimate interests.</li>
              <li><strong className="text-foreground">Withdraw consent:</strong> Where processing is based on consent, withdraw that consent at any time.</li>
              <li><strong className="text-foreground">Lodge a complaint:</strong> File a complaint with your local supervisory authority (e.g., the ICO in the UK, CNIL in France, or your national Data Protection Authority).</li>
            </ul>
            <p className="mt-3">
              <strong className="text-foreground">Response timeline:</strong> We will respond to GDPR data subject requests within{' '}
              <strong className="text-foreground">30 days</strong> (extendable by 60 days for complex requests, with notice).
            </p>
          </section>

          {/* ── SECTION 11 ── */}
          <section>
            <h2 className="font-display text-xl font-semibold text-foreground mb-3">11. Do Not Sell &amp; Global Privacy Control</h2>
            <p>
              <strong className="text-foreground">We do not sell your personal information</strong>, as "sell" is defined under the CCPA and
              other US state privacy laws. We do not share personal information for cross-context behavioral advertising.
            </p>
            <p className="mt-2">
              We recognize and honor <strong className="text-foreground">Global Privacy Control (GPC)</strong> signals sent by your browser.
              If we detect a GPC signal, we treat it as a valid opt-out request under all applicable US state privacy laws.
            </p>
          </section>

          {/* ── SECTION 12 ── */}
          <section>
            <h2 className="font-display text-xl font-semibold text-foreground mb-3">12. International Data Transfers</h2>
            <p className="text-sm italic text-muted-foreground/70 mb-2">
              Plain English: Our servers are in the United States. If you're outside the US, your data is transferred here.
            </p>
            <p>
              {ENTITY_NAME} is based in the United States, and our servers and service providers are located in the US.
              If you access the Service from outside the United States, your personal information will be transferred to,
              stored, and processed in the US. We rely on Standard Contractual Clauses (SCCs) or other appropriate transfer
              mechanisms recognized under the GDPR and UK GDPR to safeguard international data transfers where required.
            </p>
          </section>

          {/* ── SECTION 13 ── */}
          <section>
            <h2 className="font-display text-xl font-semibold text-foreground mb-3">13. Children's Privacy</h2>
            <p>
              {ENTITY_NAME} is designed for business professionals and is not directed at children under the age of 16.
              We do not knowingly collect personal information from children under 16. We do not knowingly sell or share the personal
              information of consumers under 16 years of age. If a consumer under 16 were to use the Service, we would require
              affirmative opt-in consent before any sale or sharing of their personal information, as required by the CCPA.
            </p>
            <p className="mt-2">
              If you believe a child has provided us with personal information, please contact us at{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary hover:underline">{CONTACT_EMAIL}</a>{' '}
              and we will promptly investigate and delete the data.
            </p>
          </section>

          {/* ── SECTION 14 ── */}
          <section>
            <h2 className="font-display text-xl font-semibold text-foreground mb-3">14. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. If we make material changes, we will notify registered users
              by email at least <strong className="text-foreground">30 days</strong> before the changes take effect. The "Effective date"
              at the top of this page indicates when it was last revised. Continued use of the Service after the effective date of a
              revised Privacy Policy constitutes acceptance of the updated terms.
            </p>
          </section>

          {/* ── SECTION 15 ── */}
          <section>
            <h2 className="font-display text-xl font-semibold text-foreground mb-3">15. How to Exercise Your Rights</h2>
            <p>
              To exercise any of the privacy rights described in this policy — including access, correction, deletion, data portability,
              or opt-out — please contact us using one of the following methods:
            </p>
            <ul className="list-disc list-inside space-y-1 mt-2 ml-2">
              <li>
                <strong className="text-foreground">Email:</strong>{' '}
                <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary hover:underline">{CONTACT_EMAIL}</a>{' '}
                with the subject line "Privacy Request"
              </li>
              <li>
                <strong className="text-foreground">In-app:</strong> Delete properties and documents directly from your dashboard.
                Delete your account from your account settings.
              </li>
            </ul>
            <p className="mt-3">
              <strong className="text-foreground">Authorized agents:</strong> California residents may designate an authorized agent to
              submit privacy requests on their behalf. Authorized agents must provide signed, written authorization from the consumer
              and we may verify the consumer's identity directly. We may deny a request from an agent who cannot provide proof of authorization.
            </p>
            <p className="mt-2">
              We will not require you to create an account solely to submit a privacy request. We will verify your identity
              before processing requests to protect your data from unauthorized access.
            </p>
          </section>

          {/* ── CONTACT ── */}
          <section>
            <h2 className="font-display text-xl font-semibold text-foreground mb-3">Contact</h2>
            <p>
              Questions or concerns about this Privacy Policy? Email us at{' '}
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

export default PrivacyPolicy;
