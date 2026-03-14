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
  const { sidebarCollapsed, setMobileSidebarOpen, theme } = useUIStore();
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
      {/* Desktop Sidebar */}
      <Sidebar />

      {/* Mobile Sidebar */}
      <MobileSidebar />

      {/* Main Content Area */}
      <div
        className={cn(
          'flex flex-col min-h-screen transition-all duration-300',
          // Desktop: shift content for sidebar
          sidebarCollapsed ? 'lg:ml-[72px]' : 'lg:ml-64',
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

      {/* Feedback Widget — all authenticated users */}
      <FeedbackWidget />
    </div>
  );
};
