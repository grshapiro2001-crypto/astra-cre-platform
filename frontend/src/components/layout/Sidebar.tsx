import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  FolderOpen,
  Upload,
  Database,
  BarChart3,
  Settings,
  Sun,
  Moon,
  ChevronsLeft,
  ChevronsRight,
  Users,
  Shield,
} from 'lucide-react';
import TalismanCompass3D from '@/components/TalismanCompass3D';

const ADMIN_EMAILS = ['griffinshapiro11182001@gmail.com', 'grshap2001@gmail.com'];

import { useUIStore } from '@/store/uiStore';
import { useAuthStore } from '@/store/authSlice';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { propertyService } from '@/services/propertyService';
import organizationService from '@/services/organizationService';
import type { Organization } from '@/services/organizationService';

const navItems = [
  { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { name: 'Library', path: '/library', icon: FolderOpen },
  { name: 'Upload', path: '/upload', icon: Upload },
  { name: 'Data Bank', path: '/data-bank', icon: Database },
  { name: 'Comparisons', path: '/compare', icon: BarChart3 },
  { name: 'Organization', path: '/organization', icon: Users },
  { name: 'Settings', path: '/settings', icon: Settings },
];

export const Sidebar = () => {
  const { theme, toggleTheme, sidebarCollapsed, toggleSidebar } = useUIStore();
  const user = useAuthStore((s) => s.user);
  const [dealCount, setDealCount] = useState<number | null>(null);
  const [userOrg, setUserOrg] = useState<Organization | null>(null);

  useEffect(() => {
    propertyService.listProperties({}).then((res) => {
      setDealCount(res.total);
    }).catch(() => {});
    organizationService.getMyOrg().then(setUserOrg).catch(() => {});
  }, []);

  const initials = user?.full_name
    ? user.full_name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : user?.email?.slice(0, 2).toUpperCase() ?? 'U';

  return (
    <aside
      className={cn(
        'fixed top-0 left-0 z-40 h-screen flex flex-col',
        'bg-[#0c0c0f]',
        'border-r border-white/[0.04] transition-all duration-300',
        'hidden lg:flex',
        sidebarCollapsed ? 'w-[72px]' : 'w-64'
      )}
    >
      {/* Logo */}
      <div
        className={cn(
          'flex items-center h-16 border-b border-white/5',
          sidebarCollapsed ? 'justify-center px-2' : 'px-5'
        )}
      >
        <div className="flex items-center gap-2.5">
          <TalismanCompass3D size={36} spin={true} speed={1.0} />
          {!sidebarCollapsed && (
            <h1 className="text-lg font-bold font-display tracking-tight">
              <span className="text-white">Talisman</span>
              <span className="text-zinc-500 ml-1 font-normal text-xs">IO</span>
            </h1>
          )}
        </div>
      </div>

      {/* Nav Items */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div
          className={cn(
            'flex items-center gap-2 mb-3',
            sidebarCollapsed ? 'justify-center px-0' : 'px-3'
          )}
        >
          <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          {!sidebarCollapsed && (
            <span className="font-sans text-[10px] font-normal uppercase tracking-[0.14em] text-muted-foreground">
              Navigation
            </span>
          )}
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-xl text-sm font-medium transition-all duration-200',
                  sidebarCollapsed
                    ? 'justify-center px-0 py-2.5 mx-auto w-11 h-11'
                    : 'px-3 py-2.5',
                  isActive
                    ? 'bg-white/10 text-white shadow-sm border border-white/10'
                    : 'text-zinc-500 hover:bg-white/5 hover:text-zinc-200'
                )
              }
              title={sidebarCollapsed ? item.name : undefined}
            >
              <Icon className="w-5 h-5 shrink-0" strokeWidth={1.5} />
              {!sidebarCollapsed && item.name}
            </NavLink>
          );
        })}

        {/* Admin-only: Command Center */}
        {user && ADMIN_EMAILS.includes(user.email) && (
          <>
            {!sidebarCollapsed && (
              <div className="flex items-center gap-2 px-3 mt-4 mb-1">
                <div className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
                <span className="text-zinc-600 text-[10px] font-medium uppercase tracking-widest">
                  Admin
                </span>
              </div>
            )}
            {sidebarCollapsed && <div className="my-2 border-t border-white/5" />}
            <NavLink
              to="/command-center"
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-xl text-sm font-medium transition-all duration-200',
                  sidebarCollapsed
                    ? 'justify-center px-0 py-2.5 mx-auto w-11 h-11'
                    : 'px-3 py-2.5',
                  isActive
                    ? 'bg-white/10 text-white shadow-sm border border-white/10'
                    : 'text-zinc-500 hover:bg-white/5 hover:text-zinc-200'
                )
              }
              title={sidebarCollapsed ? 'Command Center' : undefined}
            >
              <Shield className="w-5 h-5 shrink-0" strokeWidth={1.5} />
              {!sidebarCollapsed && 'Command Center'}
            </NavLink>
          </>
        )}
      </nav>

      {/* Org Pill */}
      {userOrg && !sidebarCollapsed && (
        <div className="px-4 mx-3 mb-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-primary/10 rounded-full">
            <Users className="h-3 w-3 text-primary shrink-0" />
            <span className="text-xs text-primary font-medium truncate">{userOrg.name}</span>
          </div>
        </div>
      )}

      {/* Pipeline Stats */}
      {!sidebarCollapsed && (
        <div className="px-4 py-3 mx-3 mb-3 rounded-xl bg-white/5 border border-white/5">
          <div className="font-sans text-[10px] font-normal uppercase tracking-[0.14em] text-muted-foreground mb-2">
            Pipeline
          </div>
          <div className="flex justify-between items-baseline">
            <div className="text-right">
              <span className="text-white text-lg font-bold font-mono">{dealCount ?? '\u2014'}</span>
              <p className="text-zinc-600 text-[10px] mt-0.5">Active Deals</p>
            </div>
          </div>
        </div>
      )}

      {/* Theme Toggle */}
      <div
        className={cn(
          'px-3 pb-2',
          sidebarCollapsed ? 'flex justify-center' : ''
        )}
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleTheme}
          className={cn(
            'text-zinc-500 hover:text-zinc-200 hover:bg-white/5',
            sidebarCollapsed ? 'w-11 h-11 p-0' : 'w-full justify-start gap-3 px-3'
          )}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4 shrink-0" />
          ) : (
            <Moon className="w-4 h-4 shrink-0" />
          )}
          {!sidebarCollapsed && (
            <span className="text-sm">
              {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
            </span>
          )}
        </Button>
      </div>

      {/* User Section */}
      <div
        className={cn(
          'px-3 pb-2 border-t border-white/5 pt-3',
          sidebarCollapsed ? 'flex justify-center' : ''
        )}
      >
        <div
          className={cn(
            'flex items-center gap-3 rounded-xl',
            sidebarCollapsed ? 'justify-center' : 'px-3 py-2'
          )}
        >
          <div className="w-8 h-8 rounded-full bg-white/10 border border-white/10 flex items-center justify-center shrink-0">
            <span className="text-white text-xs font-bold">{initials}</span>
          </div>
          {!sidebarCollapsed && (
            <div className="overflow-hidden">
              <p className="text-white text-sm font-medium truncate">
                {user?.full_name || 'User'}
              </p>
              <p className="text-zinc-600 text-[11px] truncate">
                {user?.email || ''}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Collapse Toggle */}
      <div
        className={cn(
          'px-3 pb-3',
          sidebarCollapsed ? 'flex justify-center' : ''
        )}
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleSidebar}
          className={cn(
            'text-zinc-500 hover:text-zinc-200 hover:bg-white/5',
            sidebarCollapsed ? 'w-11 h-11 p-0' : 'w-full justify-start gap-3 px-3'
          )}
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {sidebarCollapsed ? (
            <ChevronsRight className="w-4 h-4 shrink-0" />
          ) : (
            <ChevronsLeft className="w-4 h-4 shrink-0" />
          )}
          {!sidebarCollapsed && <span className="text-sm">Collapse</span>}
        </Button>
      </div>
    </aside>
  );
};

/** Mobile sidebar overlay */
export const MobileSidebar = () => {
  const { mobileSidebarOpen, setMobileSidebarOpen, theme, toggleTheme } =
    useUIStore();
  const user = useAuthStore((s) => s.user);

  const initials = user?.full_name
    ? user.full_name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : user?.email?.slice(0, 2).toUpperCase() ?? 'U';

  if (!mobileSidebarOpen) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => setMobileSidebarOpen(false)}
      />

      {/* Sidebar */}
      <aside className="absolute top-0 left-0 h-full w-64 flex flex-col bg-[#0c0c0f] border-r border-white/[0.04] shadow-2xl">
        {/* Logo */}
        <div className="flex items-center h-16 px-5 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <TalismanCompass3D size={36} spin={true} speed={1.0} />
            <h1 className="text-lg font-bold font-display tracking-tight">
              <span className="text-white">Talisman</span>
              <span className="text-zinc-500 ml-1 font-normal text-xs">IO</span>
            </h1>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <div className="flex items-center gap-2 px-3 mb-3">
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            <span className="font-sans text-[10px] font-normal uppercase tracking-[0.14em] text-muted-foreground">
              Navigation
            </span>
          </div>

          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setMobileSidebarOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                    isActive
                      ? 'bg-white/10 text-white shadow-sm border border-white/10'
                      : 'text-zinc-500 hover:bg-white/5 hover:text-zinc-200'
                  )
                }
              >
                <Icon className="w-5 h-5 shrink-0" strokeWidth={1.5} />
                {item.name}
              </NavLink>
            );
          })}

          {/* Admin-only: Command Center */}
          {user && ADMIN_EMAILS.includes(user.email) && (
            <>
              <div className="flex items-center gap-2 px-3 mt-4 mb-1">
                <div className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
                <span className="text-zinc-600 text-[10px] font-medium uppercase tracking-widest">
                  Admin
                </span>
              </div>
              <NavLink
                to="/command-center"
                onClick={() => setMobileSidebarOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                    isActive
                      ? 'bg-white/10 text-white shadow-sm border border-white/10'
                      : 'text-zinc-500 hover:bg-white/5 hover:text-zinc-200'
                  )
                }
              >
                <Shield className="w-5 h-5 shrink-0" strokeWidth={1.5} />
                Command Center
              </NavLink>
            </>
          )}
        </nav>

        {/* Theme Toggle */}
        <div className="px-3 pb-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleTheme}
            className="w-full justify-start gap-3 px-3 text-zinc-500 hover:text-zinc-200 hover:bg-white/5"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 shrink-0" />
            ) : (
              <Moon className="w-4 h-4 shrink-0" />
            )}
            <span className="text-sm">
              {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
            </span>
          </Button>
        </div>

        {/* User */}
        <div className="px-3 pb-4 border-t border-white/5 pt-3">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-white/10 border border-white/10 flex items-center justify-center shrink-0">
              <span className="text-white text-xs font-bold">{initials}</span>
            </div>
            <div className="overflow-hidden">
              <p className="text-white text-sm font-medium truncate">
                {user?.full_name || 'User'}
              </p>
              <p className="text-zinc-600 text-[11px] truncate">
                {user?.email || ''}
              </p>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
};
