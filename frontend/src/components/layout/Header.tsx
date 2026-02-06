import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Menu,
  Bell,
  ChevronRight,
  LogOut,
  Settings,
  User,
  ChevronDown,
} from 'lucide-react';
import { useAuthStore } from '@/store/authSlice';
import { useUIStore } from '@/store/uiStore';
import { cn } from '@/lib/utils';

interface RouteConfig {
  title: string;
  description: string;
}

const routeMap: Record<string, RouteConfig> = {
  '/dashboard': { title: 'Dashboard', description: 'Pipeline overview & analytics' },
  '/library': { title: 'Deal Library', description: 'Manage your deals and documents' },
  '/upload': { title: 'Upload', description: 'Upload and analyze documents' },
  '/compare': { title: 'Comparisons', description: 'Side-by-side property analysis' },
  '/settings': { title: 'Settings', description: 'Account & preferences' },
};

function getRouteConfig(pathname: string): RouteConfig {
  // Direct match
  if (routeMap[pathname]) return routeMap[pathname];

  // Folder detail
  if (pathname.startsWith('/folders/')) {
    return { title: 'Folder Detail', description: 'Properties in this deal folder' };
  }

  // Property detail
  if (pathname.startsWith('/library/')) {
    return { title: 'Property Detail', description: 'Detailed property analysis' };
  }

  return { title: 'Astra CRE', description: '' };
}

function getBreadcrumbs(pathname: string): Array<{ label: string; path?: string }> {
  const crumbs: Array<{ label: string; path?: string }> = [];

  if (pathname.startsWith('/folders/')) {
    crumbs.push({ label: 'Library', path: '/library' });
    crumbs.push({ label: 'Folder' });
  } else if (pathname.startsWith('/library/') && pathname !== '/library') {
    crumbs.push({ label: 'Library', path: '/library' });
    crumbs.push({ label: 'Property' });
  }

  return crumbs;
}

export const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const { toggleMobileSidebar } = useUIStore();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const config = getRouteConfig(location.pathname);
  const breadcrumbs = getBreadcrumbs(location.pathname);

  const handleLogout = async () => {
    setDropdownOpen(false);
    await logout();
    navigate('/login');
  };

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [dropdownOpen]);

  const initials = user?.full_name
    ? user.full_name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : user?.email?.slice(0, 2).toUpperCase() ?? 'U';

  return (
    <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="flex items-center justify-between h-16 px-4 lg:px-6">
        {/* Left: Mobile menu + Title */}
        <div className="flex items-center gap-3">
          {/* Mobile hamburger */}
          <button
            onClick={toggleMobileSidebar}
            className="lg:hidden p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div>
            {/* Breadcrumbs */}
            {breadcrumbs.length > 0 && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground mb-0.5">
                {breadcrumbs.map((crumb, i) => (
                  <span key={i} className="flex items-center gap-1">
                    {crumb.path ? (
                      <button
                        onClick={() => navigate(crumb.path!)}
                        className="hover:text-foreground transition-colors"
                      >
                        {crumb.label}
                      </button>
                    ) : (
                      <span>{crumb.label}</span>
                    )}
                    {i < breadcrumbs.length - 1 && (
                      <ChevronRight className="w-3 h-3" />
                    )}
                  </span>
                ))}
              </div>
            )}

            {/* Page title */}
            <h2 className="text-lg font-semibold font-display text-foreground leading-tight">
              {config.title}
            </h2>
            {config.description && breadcrumbs.length === 0 && (
              <p className="text-xs text-muted-foreground hidden sm:block">
                {config.description}
              </p>
            )}
          </div>
        </div>

        {/* Right: Notification + User */}
        <div className="flex items-center gap-2">
          {/* Notification bell */}
          <button className="relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <Bell className="w-5 h-5" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-primary" />
          </button>

          {/* User dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className={cn(
                'flex items-center gap-2 p-1.5 pr-3 rounded-xl transition-colors',
                'hover:bg-muted',
                dropdownOpen && 'bg-muted'
              )}
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shrink-0">
                <span className="text-white text-xs font-bold">{initials}</span>
              </div>
              <span className="text-sm font-medium text-foreground hidden sm:block">
                {user?.full_name || user?.email || 'User'}
              </span>
              <ChevronDown
                className={cn(
                  'w-4 h-4 text-muted-foreground transition-transform hidden sm:block',
                  dropdownOpen && 'rotate-180'
                )}
              />
            </button>

            {/* Dropdown menu */}
            {dropdownOpen && (
              <div className="absolute right-0 top-full mt-1 w-56 rounded-xl border border-border bg-card shadow-lg py-1 animate-scale-in origin-top-right">
                <div className="px-3 py-2 border-b border-border">
                  <p className="text-sm font-medium text-foreground">
                    {user?.full_name || 'User'}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {user?.email}
                  </p>
                </div>

                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    navigate('/settings');
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors"
                >
                  <Settings className="w-4 h-4" />
                  Settings
                </button>

                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    navigate('/dashboard');
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors"
                >
                  <User className="w-4 h-4" />
                  Profile
                </button>

                <div className="border-t border-border my-1" />

                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-muted transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Log out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
