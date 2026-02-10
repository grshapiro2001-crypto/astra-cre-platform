/**
 * Settings Page - Interactive expandable sections
 *
 * Sections:
 * - Profile & account (name / email from auth store)
 * - Appearance (theme toggle from UI store)
 * - Notifications (placeholder toggles)
 * - API & Integrations (placeholder masked key)
 */
import { useState } from 'react';
import {
  User,
  Palette,
  Bell,
  Key,
  ChevronDown,
  Sun,
  Moon,
  Copy,
  RefreshCw,
  Target,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/authSlice';
import { useUIStore } from '@/store/uiStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DealScoreSettings } from '@/components/scoring/DealScoreSettings';

// ============================================================
// Toggle Switch (simple inline component)
// ============================================================
const Toggle = ({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={() => onChange(!checked)}
    className={cn(
      'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
      checked ? 'bg-primary' : 'bg-muted'
    )}
  >
    <span
      className={cn(
        'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform',
        checked ? 'translate-x-5' : 'translate-x-0'
      )}
    />
  </button>
);

// ============================================================
// Section definitions
// ============================================================
type SectionId = 'scoring' | 'profile' | 'appearance' | 'notifications' | 'api';

interface SectionMeta {
  id: SectionId;
  icon: typeof User;
  title: string;
  description: string;
}

const SECTIONS: SectionMeta[] = [
  {
    id: 'scoring',
    icon: Target,
    title: 'Deal Scoring',
    description: 'Configure scoring weights and strategy presets',
  },
  {
    id: 'profile',
    icon: User,
    title: 'Profile & Account',
    description: 'Manage your name, email, and password',
  },
  {
    id: 'appearance',
    icon: Palette,
    title: 'Appearance',
    description: 'Theme, fonts, and display preferences',
  },
  {
    id: 'notifications',
    icon: Bell,
    title: 'Notifications',
    description: 'Email alerts and in-app notifications',
  },
  {
    id: 'api',
    icon: Key,
    title: 'API & Integrations',
    description: 'Manage API keys and third-party connections',
  },
];

// ============================================================
// Section content renderers
// ============================================================

const ProfileSection = () => {
  const user = useAuthStore((s) => s.user);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-muted-foreground text-xs uppercase tracking-wider">
          Full Name
        </Label>
        <Input
          readOnly
          value={user?.full_name || ''}
          placeholder="Not set"
          className="bg-muted/50 border-border"
        />
      </div>
      <div className="space-y-2">
        <Label className="text-muted-foreground text-xs uppercase tracking-wider">
          Email
        </Label>
        <Input
          readOnly
          value={user?.email || ''}
          className="bg-muted/50 border-border"
        />
      </div>
      <Button variant="outline" size="sm" disabled className="mt-2">
        Save Changes
      </Button>
      <p className="text-xs text-muted-foreground">
        Profile editing will be available in a future update.
      </p>
    </div>
  );
};

const AppearanceSection = () => {
  const { theme, toggleTheme } = useUIStore();

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <p className="text-sm font-medium text-foreground">Theme</p>
          <p className="text-xs text-muted-foreground">
            Switch between light and dark mode
          </p>
        </div>
        <button
          onClick={toggleTheme}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-medium transition-colors',
            'hover:bg-muted'
          )}
        >
          {theme === 'dark' ? (
            <>
              <Moon className="w-4 h-4 text-primary" />
              Dark
            </>
          ) : (
            <>
              <Sun className="w-4 h-4 text-amber-500" />
              Light
            </>
          )}
        </button>
      </div>

      <div className="flex items-center justify-between opacity-50">
        <div className="space-y-0.5">
          <p className="text-sm font-medium text-foreground">Font Size</p>
          <p className="text-xs text-muted-foreground">
            Adjust the base font size
          </p>
        </div>
        <span className="text-xs text-muted-foreground italic">Coming soon</span>
      </div>
    </div>
  );
};

const NotificationsSection = () => {
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [dealAlerts, setDealAlerts] = useState(true);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <p className="text-sm font-medium text-foreground">
            Email Notifications
          </p>
          <p className="text-xs text-muted-foreground">
            Receive deal updates and weekly digests
          </p>
        </div>
        <Toggle checked={emailNotifs} onChange={setEmailNotifs} />
      </div>

      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <p className="text-sm font-medium text-foreground">Deal Alerts</p>
          <p className="text-xs text-muted-foreground">
            Get notified when deals change stages
          </p>
        </div>
        <Toggle checked={dealAlerts} onChange={setDealAlerts} />
      </div>

      <p className="text-xs text-muted-foreground pt-2">
        Notification preferences are stored locally for now.
      </p>
    </div>
  );
};

const ApiSection = () => {
  const maskedKey = 'sk-astra-••••••••••••••••••••3f8a';
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-muted-foreground text-xs uppercase tracking-wider">
          API Key
        </Label>
        <div className="flex gap-2">
          <Input
            readOnly
            value={maskedKey}
            className="bg-muted/50 border-border font-mono text-sm"
          />
          <Button
            variant="outline"
            size="icon"
            className="shrink-0"
            onClick={handleCopy}
          >
            <Copy className="w-4 h-4" />
          </Button>
        </div>
        {copied && (
          <p className="text-xs text-primary">Copied to clipboard!</p>
        )}
      </div>

      <Button variant="outline" size="sm" disabled>
        <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
        Regenerate Key
      </Button>
      <p className="text-xs text-muted-foreground">
        API access is not yet available. Keys shown are placeholders.
      </p>
    </div>
  );
};

const ScoringSection = () => <DealScoreSettings />;

const SECTION_CONTENT: Record<SectionId, () => JSX.Element> = {
  scoring: ScoringSection,
  profile: ProfileSection,
  appearance: AppearanceSection,
  notifications: NotificationsSection,
  api: ApiSection,
};

// ============================================================
// Settings Page
// ============================================================

export const Settings = () => {
  const [expanded, setExpanded] = useState<SectionId | null>(null);

  const toggle = (id: SectionId) => {
    setExpanded((prev) => (prev === id ? null : id));
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
          Settings
        </h1>
        <p className="text-sm mt-1 text-muted-foreground">
          Manage your account and application preferences
        </p>
      </div>

      {/* Accordion Sections */}
      <div className="grid gap-3">
        {SECTIONS.map((section) => {
          const Icon = section.icon;
          const isOpen = expanded === section.id;
          const Content = SECTION_CONTENT[section.id];

          return (
            <div
              key={section.id}
              className={cn(
                'rounded-2xl border bg-card overflow-hidden transition-all',
                isOpen
                  ? 'border-primary/30 shadow-md shadow-primary/5'
                  : 'border-border hover:border-primary/20'
              )}
            >
              {/* Section header (clickable) */}
              <button
                onClick={() => toggle(section.id)}
                className="w-full flex items-center gap-4 p-5 text-left cursor-pointer"
              >
                <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-primary/10 shrink-0">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-display font-semibold text-foreground">
                    {section.title}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {section.description}
                  </p>
                </div>
                <ChevronDown
                  className={cn(
                    'w-5 h-5 text-muted-foreground transition-transform shrink-0',
                    isOpen && 'rotate-180'
                  )}
                />
              </button>

              {/* Expandable content */}
              {isOpen && (
                <div className="px-5 pb-5 pt-0 border-t border-border">
                  <div className="pt-4">
                    <Content />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
