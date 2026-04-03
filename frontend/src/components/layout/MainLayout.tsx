import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { Header } from './Header';
import { Sidebar, MobileSidebar } from './Sidebar';
import { PageTransition } from './PageTransition';
import { useUIStore } from '@/store/uiStore';
import { cn } from '@/lib/utils';
import { AssistantToggle } from '@/components/assistant/AssistantToggle';
import { AssistantPanel } from '@/components/assistant/AssistantPanel';
import { FeedbackWidget } from '@/components/feedback/FeedbackWidget';
import { useAssistantStore } from '@/store/assistantStore';

export const MainLayout = () => {
  const { sidebarCollapsed, sidebarHidden, setSidebarHidden, setMobileSidebarOpen, theme } = useUIStore();
  const isAssistantOpen = useAssistantStore((s) => s.isOpen);
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
      {/* Desktop Sidebar — hidden when sidebarHidden */}
      <Sidebar className={cn(
        'transition-all duration-300',
        sidebarHidden ? '-translate-x-full opacity-0 pointer-events-none' : 'translate-x-0 opacity-100'
      )} />

      {/* Sidebar reveal tab — only shows when sidebar is hidden */}
      {sidebarHidden && (
        <button
          onClick={() => setSidebarHidden(false)}
          className="fixed top-1/2 -translate-y-1/2 left-0 z-50 hidden lg:flex items-center justify-center w-5 h-12 rounded-r-lg bg-white/[0.06] border border-l-0 border-white/[0.08] text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.10] transition-all"
          title="Show sidebar"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 18l6-6-6-6" /></svg>
        </button>
      )}

      {/* Mobile Sidebar */}
      <MobileSidebar />

      {/* Main Content Area */}
      <div
        className={cn(
          'flex flex-col min-h-screen transition-all duration-300',
          // Desktop: shift content for sidebar (0 when hidden)
          sidebarHidden ? 'lg:ml-0' : sidebarCollapsed ? 'lg:ml-[72px]' : 'lg:ml-64',
          // Push content left when assistant panel is open
          isAssistantOpen && 'lg:mr-[28rem]'
        )}
      >
        <Header />
        <main className="flex-1 p-4 lg:p-6 relative">
          <AnimatePresence mode="wait">
            <PageTransition key={location.pathname}>
              <Outlet />
            </PageTransition>
          </AnimatePresence>
        </main>
      </div>

      {/* AI Assistant */}
      <AssistantToggle />
      <AssistantPanel />

      {/* Feedback Widget — triggered from Header */}
      <FeedbackWidget />
    </div>
  );
};
