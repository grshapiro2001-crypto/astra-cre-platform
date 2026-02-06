/**
 * Settings Page - Placeholder
 *
 * Sections planned:
 * - Profile & account
 * - Theme & appearance (currently handled via sidebar toggle)
 * - Pipeline templates (default stages)
 * - Notification preferences
 * - API keys / integrations
 */
import { Settings as SettingsIcon, User, Palette, Bell, Key } from 'lucide-react';
import { cn } from '@/lib/utils';

const SECTIONS = [
  {
    icon: User,
    title: 'Profile & Account',
    description: 'Manage your name, email, and password',
  },
  {
    icon: Palette,
    title: 'Appearance',
    description: 'Theme, fonts, and display preferences',
  },
  {
    icon: Bell,
    title: 'Notifications',
    description: 'Email alerts and in-app notifications',
  },
  {
    icon: Key,
    title: 'API & Integrations',
    description: 'Manage API keys and third-party connections',
  },
];

export const Settings = () => {
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

      {/* Section Cards */}
      <div className="grid gap-4">
        {SECTIONS.map((section) => {
          const Icon = section.icon;
          return (
            <div
              key={section.title}
              className={cn(
                'flex items-center gap-4 p-5 rounded-2xl border border-border bg-card',
                'hover:border-primary/30 hover:shadow-md hover:shadow-primary/5 transition-all cursor-pointer'
              )}
            >
              <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-primary/10 shrink-0">
                <Icon className="w-5 h-5 text-primary" />
              </div>
              <div className="min-w-0">
                <h3 className="font-display font-semibold text-foreground">
                  {section.title}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {section.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Coming Soon Notice */}
      <div className="flex items-center gap-3 p-4 rounded-2xl border border-dashed border-border bg-muted/50">
        <SettingsIcon className="w-5 h-5 text-muted-foreground shrink-0" />
        <p className="text-sm text-muted-foreground">
          Settings panels are coming soon. Theme toggle is available in the sidebar.
        </p>
      </div>
    </div>
  );
};
