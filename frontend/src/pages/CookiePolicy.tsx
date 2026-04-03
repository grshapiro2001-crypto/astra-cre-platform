import { Link } from 'react-router-dom';
import { TalismanLogo } from '@/components/ui/TalismanLogo';

const EFFECTIVE_DATE = 'March 16, 2026';
const ENTITY_NAME = 'Talisman IO';
const CONTACT_EMAIL = 'griffin@talisman.io';

export function CookiePolicy() {
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

        <h1 className="font-display text-4xl font-bold text-foreground mb-2">Cookie Policy</h1>
        <p className="text-muted-foreground text-sm mb-10">Effective date: {EFFECTIVE_DATE}</p>

        <div className="prose-custom space-y-8 text-muted-foreground leading-relaxed">

          {/* ── What Are Cookies ── */}
          <section>
            <h2 className="font-display text-xl font-semibold text-foreground mb-3">What Are Cookies &amp; Similar Technologies?</h2>
            <p>
              Cookies are small text files placed on your device by websites you visit. They are widely used to make websites work
              efficiently and provide reporting information. This policy also covers similar technologies such as{' '}
              <strong className="text-foreground">local storage</strong> (localStorage/sessionStorage) and{' '}
              <strong className="text-foreground">web beacons</strong>, which serve similar purposes and are subject to the same
              legal requirements under the GDPR, ePrivacy Directive, CCPA, and other applicable privacy laws.
            </p>
          </section>

          {/* ── Legal Basis ── */}
          <section>
            <h2 className="font-display text-xl font-semibold text-foreground mb-3">Legal Basis</h2>
            <p>
              Under the EU ePrivacy Directive (2002/58/EC) and the GDPR, cookies that are{' '}
              <strong className="text-foreground">strictly necessary</strong> for delivering a service you have explicitly requested
              are exempt from the consent requirement. All cookies and similar technologies listed below fall into this "strictly
              necessary" category. They are required for the platform to function (authentication, security) and cannot be disabled
              without breaking core functionality.
            </p>
            <p className="mt-2">
              We do not currently use any cookies or similar technologies that require your consent (such as analytics, advertising,
              or tracking cookies). If we introduce non-essential cookies in the future, we will obtain your prior, affirmative
              consent through a clear opt-in mechanism before placing them, and update this policy accordingly.
            </p>
          </section>

          {/* ── Essential Cookies ── */}
          <section>
            <h2 className="font-display text-xl font-semibold text-foreground mb-3">Strictly Necessary Cookies</h2>
            <p>
              We use the following essential cookies to maintain your authentication session. These are required for the platform
              to function and are exempt from consent requirements under applicable law.
            </p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border/40 text-left">
                    <th className="py-2 pr-3 text-foreground font-medium">Cookie Name</th>
                    <th className="py-2 pr-3 text-foreground font-medium">Purpose</th>
                    <th className="py-2 pr-3 text-foreground font-medium">Duration</th>
                    <th className="py-2 pr-3 text-foreground font-medium">Type</th>
                    <th className="py-2 text-foreground font-medium">Flags</th>
                  </tr>
                </thead>
                <tbody className="text-muted-foreground">
                  <tr className="border-b border-border/20">
                    <td className="py-2 pr-3 font-mono text-xs">talisman_session</td>
                    <td className="py-2 pr-3">Authentication session identifier</td>
                    <td className="py-2 pr-3">Session (cleared on browser close)</td>
                    <td className="py-2 pr-3">First-party</td>
                    <td className="py-2">HttpOnly, Secure, SameSite=Lax</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-3 font-mono text-xs">talisman_auth_token</td>
                    <td className="py-2 pr-3">JWT authentication token for persistent login</td>
                    <td className="py-2 pr-3">7 days</td>
                    <td className="py-2 pr-3">First-party</td>
                    <td className="py-2">HttpOnly, Secure, SameSite=Lax</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* ── Similar Technologies ── */}
          <section>
            <h2 className="font-display text-xl font-semibold text-foreground mb-3">Local Storage &amp; Similar Technologies</h2>
            <p>
              We may use browser localStorage or sessionStorage for strictly necessary purposes such as storing UI preferences
              (theme settings, sidebar state) that are essential to your use of the platform. This data remains on your device
              and is not transmitted to our servers.
            </p>
            <p className="mt-2">
              We do not use web beacons, tracking pixels, or fingerprinting techniques.
            </p>
          </section>

          {/* ── Analytics ── */}
          <section>
            <h2 className="font-display text-xl font-semibold text-foreground mb-3">Analytics &amp; Advertising Cookies</h2>
            <p>
              We <strong className="text-foreground">do not currently use</strong> any analytics, advertising, or tracking cookies
              or similar technologies. We do not use third-party tracking scripts (Google Analytics, Meta Pixel, etc.).
            </p>
            <p className="mt-2">
              If we introduce analytics in the future, we will: (a) update this Cookie Policy before deployment;
              (b) obtain opt-in consent from users in jurisdictions that require it (EEA, UK, and other applicable regions)
              through a clear cookie consent banner with equal-prominence "Accept" and "Reject" options;
              (c) provide a mechanism to withdraw consent at any time; and (d) ensure any analytics provider meets our
              data processing standards.
            </p>
          </section>

          {/* ── Do Not Track / GPC ── */}
          <section>
            <h2 className="font-display text-xl font-semibold text-foreground mb-3">Do Not Track &amp; Global Privacy Control</h2>
            <p>
              We honor <strong className="text-foreground">Global Privacy Control (GPC)</strong> signals sent by your browser.
              If we detect a GPC signal, we treat it as a valid opt-out request under all applicable US state privacy laws,
              including the CCPA/CPRA.
            </p>
            <p className="mt-2">
              Because we do not use tracking or advertising cookies, there are no non-essential cookies to disable in response
              to GPC or "Do Not Track" browser signals. If we introduce non-essential cookies in the future, GPC signals will
              automatically opt you out.
            </p>
          </section>

          {/* ── Managing ── */}
          <section>
            <h2 className="font-display text-xl font-semibold text-foreground mb-3">Managing Cookies</h2>
            <p>
              You can manage cookies through your browser settings. Most browsers allow you to view, block, or delete cookies.
              Note that blocking the essential cookies listed above may prevent you from logging in to the platform.
            </p>
            <p className="mt-2">
              For instructions on managing cookies in your browser, visit your browser's help documentation:
            </p>
            <ul className="list-disc list-inside space-y-1 mt-2 ml-2">
              <li><a href="https://support.google.com/chrome/answer/95647" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Google Chrome</a></li>
              <li><a href="https://support.mozilla.org/en-US/kb/clear-cookies-and-site-data-firefox" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Mozilla Firefox</a></li>
              <li><a href="https://support.apple.com/en-us/105082" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Safari</a></li>
              <li><a href="https://support.microsoft.com/en-us/microsoft-edge/delete-cookies-in-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Microsoft Edge</a></li>
            </ul>
          </section>

          {/* ── Changes ── */}
          <section>
            <h2 className="font-display text-xl font-semibold text-foreground mb-3">Changes to This Policy</h2>
            <p>
              We may update this Cookie Policy from time to time, particularly if we introduce new cookies or similar technologies.
              If we make material changes (such as adding non-essential cookies), we will notify registered users by email and
              update the effective date at the top of this page. For non-essential cookies, we will obtain your consent before
              they are placed on your device.
            </p>
          </section>

          {/* ── Relationship ── */}
          <section>
            <h2 className="font-display text-xl font-semibold text-foreground mb-3">Relationship to Privacy Policy</h2>
            <p>
              This Cookie Policy is part of and supplements our{' '}
              <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>. For information about how we
              collect, use, and protect your personal information beyond cookies, including your privacy rights and how to
              exercise them, please see our Privacy Policy.
            </p>
          </section>

          {/* ── Contact ── */}
          <section>
            <h2 className="font-display text-xl font-semibold text-foreground mb-3">Contact</h2>
            <p>
              Questions about our cookie practices? Email us at{' '}
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

export default CookiePolicy;
