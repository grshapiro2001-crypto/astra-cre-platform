import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar, MobileSidebar } from './Sidebar';
import { useUIStore } from '@/store/uiStore';
import { cn } from '@/lib/utils';

export const MainLayout = () => {
  const { sidebarCollapsed, setMobileSidebarOpen, theme } = useUIStore();
  const location = useLocation();

  // Apply theme on mount
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [location.pathname, setMobileSidebarOpen]);

  return (
    <div className="min-h-screen bg-background relative overflow-x-hidden">
      {/* Ambient background orbs (dark mode only) */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden dark:block hidden" aria-hidden="true">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-violet-500/[0.03] blur-3xl animate-float" />
        <div className="absolute top-1/3 -left-20 w-72 h-72 rounded-full bg-emerald-500/[0.03] blur-3xl animate-float-slow" />
        <div className="absolute bottom-20 right-1/4 w-80 h-80 rounded-full bg-purple-500/[0.02] blur-3xl animate-float" />
      </div>

      {/* Desktop Sidebar */}
      <Sidebar />

      {/* Mobile Sidebar */}
      <MobileSidebar />

      {/* Main Content Area */}
      <div
        className={cn(
          'flex flex-col min-h-screen transition-all duration-300',
          // Desktop: shift content for sidebar
          sidebarCollapsed ? 'lg:ml-[72px]' : 'lg:ml-64'
        )}
      >
        <Header />
        <main className="flex-1 p-4 lg:p-6 relative">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
