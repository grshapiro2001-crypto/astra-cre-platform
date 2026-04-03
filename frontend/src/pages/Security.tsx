import { Link } from 'react-router-dom';
import { TalismanLogo } from '@/components/ui/TalismanLogo';

const EFFECTIVE_DATE = 'March 16, 2026';
const ENTITY_NAME = 'Talisman IO';
const CONTACT_EMAIL = 'griffin@talisman.io';

export function SecurityPage() {
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

        <h1 className="font-display text-4xl font-bold text-foreground mb-2">Security</h1>
        <p className="text-muted-foreground text-sm mb-10">How {ENTITY_NAME} protects your data.</p>

        <div className="prose-custom space-y-8 text-muted-foreground leading-relaxed">

          {/* ── Encryption ── */}
          <section>
            <h2 className="font-display text-xl font-semibold text-foreground mb-3">Encryption</h2>
            <p>
              <strong className="text-foreground">In transit:</strong> All data transmitted between your browser and our servers is
              encrypted using TLS 1.2+ (HTTPS). This includes document uploads, API calls, authentication tokens, and all user
              interactions with the platform.
            </p>
            <p className="mt-2">
              <strong className="text-foreground">At rest:</strong> Data stored in our PostgreSQL database is encrypted at rest using
              AES-256 encryption provided by our hosting infrastructure (Render). Encrypted backups are maintained with automatic
              rotation.
            </p>
          </section>

          {/* ── Data Isolation ── */}
          <section>
            <h2 className="font-display text-xl font-semibold text-foreground mb-3">Data Isolation</h2>
            <p>
              Each organization on Talisman has a logically isolated workspace. Data is partitioned by organization, and users can
              only access properties and documents within their own team. Role-based access controls ensure appropriate permissions
              within each organization.
            </p>
          </section>

          {/* ── AI Processing ── */}
          <section>
            <h2 className="font-display text-xl font-semibold text-foreground mb-3">AI Processing</h2>
            <p>
              Documents are processed via the <strong className="text-foreground">Anthropic Claude API</strong> for extraction and
              analysis. We send only the document text content necessary for extraction — no account credentials or personally
              identifiable user information (name, email) are included in AI processing requests.
            </p>
            <p className="mt-2">
              Anthropic currently retains API inputs and outputs for up to <strong className="text-foreground">7 days</strong> solely
              for trust and safety purposes (abuse monitoring and policy enforcement), after which they are automatically deleted.
              Anthropic <strong className="text-foreground">does not use commercial API data to train their models</strong>.
              For full details, see{' '}
              <a href="https://www.anthropic.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                Anthropic's Privacy Policy
              </a>.
            </p>
          </section>

          {/* ── Infrastructure ── */}
          <section>
            <h2 className="font-display text-xl font-semibold text-foreground mb-3">Infrastructure</h2>
            <p>Our infrastructure runs on trusted cloud providers with strong security postures:</p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border/40 text-left">
                    <th className="py-2 pr-4 text-foreground font-medium">Provider</th>
                    <th className="py-2 pr-4 text-foreground font-medium">Role</th>
                    <th className="py-2 text-foreground font-medium">Compliance</th>
                  </tr>
                </thead>
                <tbody className="text-muted-foreground">
                  <tr className="border-b border-border/20">
                    <td className="py-2 pr-4">Vercel</td>
                    <td className="py-2 pr-4">Frontend hosting &amp; CDN</td>
                    <td className="py-2">SOC 2 Type II</td>
                  </tr>
                  <tr className="border-b border-border/20">
                    <td className="py-2 pr-4">Render</td>
                    <td className="py-2 pr-4">Backend hosting &amp; PostgreSQL database</td>
                    <td className="py-2">SOC 2 Type II</td>
                  </tr>
                  <tr className="border-b border-border/20">
                    <td className="py-2 pr-4">Anthropic</td>
                    <td className="py-2 pr-4">AI document processing</td>
                    <td className="py-2">SOC 2 Type II</td>
                  </tr>
                  <tr className="border-b border-border/20">
                    <td className="py-2 pr-4">Stripe</td>
                    <td className="py-2 pr-4">Payment processing</td>
                    <td className="py-2">PCI DSS Level 1</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* ── Authentication ── */}
          <section>
            <h2 className="font-display text-xl font-semibold text-foreground mb-3">Authentication &amp; Access Control</h2>
            <p>
              User authentication uses industry-standard JWT tokens with secure httpOnly cookies. Passwords are hashed using bcrypt
              with appropriate salt rounds — we never store plaintext passwords. Session tokens expire after 7 days of inactivity.
            </p>
            <p className="mt-2">
              <strong className="text-foreground">Access controls:</strong> Production infrastructure access is restricted to
              authorized personnel on a need-to-know basis. Administrative actions are logged. Database access requires
              authenticated credentials and is not exposed to the public internet.
            </p>
          </section>

          {/* ── Data Backup ── */}
          <section>
            <h2 className="font-display text-xl font-semibold text-foreground mb-3">Data Backup &amp; Recovery</h2>
            <p>
              Database backups are performed automatically on a daily schedule by our hosting provider. Backups are encrypted and
              retained for up to 30 days with automatic rotation. In the event of data loss, we can restore from the most recent
              backup point.
            </p>
          </section>

          {/* ── Breach Notification ── */}
          <section>
            <h2 className="font-display text-xl font-semibold text-foreground mb-3">Breach Notification</h2>
            <p>
              In the event of a personal data breach that is likely to result in a risk to your rights and freedoms, we will
              notify affected users by email without unreasonable delay and notify the relevant supervisory authority within
              72 hours as required by GDPR Article 33. We will comply with all applicable US state breach notification laws.
              For full details, see our{' '}
              <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>.
            </p>
          </section>

          {/* ── Responsible Disclosure ── */}
          <section>
            <h2 className="font-display text-xl font-semibold text-foreground mb-3">Responsible Disclosure</h2>
            <p>
              If you discover a security vulnerability in Talisman, we ask that you disclose it responsibly by emailing{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary hover:underline">{CONTACT_EMAIL}</a> with details.
              We commit to:
            </p>
            <ul className="list-disc list-inside space-y-1 mt-2 ml-2">
              <li>Acknowledging receipt within <strong className="text-foreground">48 hours</strong>.</li>
              <li>Providing an initial assessment within <strong className="text-foreground">5 business days</strong>.</li>
              <li>Working to address confirmed vulnerabilities promptly, with target resolution within 90 days.</li>
              <li>Keeping you informed of our progress.</li>
            </ul>
            <p className="mt-2">
              We ask that you do not publicly disclose the vulnerability until we have had a reasonable opportunity to address it.
              We will not take legal action against security researchers who report vulnerabilities in good faith.
            </p>
          </section>

          {/* ── Questions ── */}
          <section>
            <h2 className="font-display text-xl font-semibold text-foreground mb-3">Questions</h2>
            <p>
              Have questions about our security practices? Email us at{' '}
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

export default SecurityPage;
