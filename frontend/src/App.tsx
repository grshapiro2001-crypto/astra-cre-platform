import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { useAuthStore } from './store/authSlice';
import { LoginForm } from './components/auth/LoginForm';
import { RegisterForm } from './components/auth/RegisterForm';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { MainLayout } from './components/layout/MainLayout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Dashboard } from './pages/Dashboard';
import { Library } from './pages/Library';
import { FolderDetail } from './pages/FolderDetail';
import { PropertyDetail } from './pages/PropertyDetail';
import { Upload } from './pages/Upload';
import { ComparisonPage } from './pages/ComparisonPage';
import { Settings } from './pages/Settings';
import { DataBankPage } from './pages/DataBankPage';
import { OnboardingWizard } from './components/onboarding/OnboardingWizard';
import Landing from './pages/Landing';
import { OrganizationSettings } from './pages/OrganizationSettings';
import { Welcome } from './pages/Welcome';
import { CommandCenter } from './pages/CommandCenter';
import { PendingApproval } from './pages/PendingApproval';
import { TermsOfService } from './pages/TermsOfService';
import { PrivacyPolicy } from './pages/PrivacyPolicy';
import { CookiePolicy } from './pages/CookiePolicy';
import { SecurityPage } from './pages/Security';
import { About } from './pages/About';
import { Pricing } from './pages/Pricing';

function App() {
  const checkAuth = useAuthStore((state) => state.checkAuth);
  const setUser = useAuthStore((state) => state.setUser);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Listen for 401 session-expired events from the Axios interceptor.
  // This replaces the old window.location.href = '/login' approach which
  // caused blank pages by destroying the React tree mid-operation.
  // Now: interceptor dispatches event → we clear auth state → ProtectedRoute
  // redirects to /login via React Router (soft SPA navigation, no blank page).
  useEffect(() => {
    const handleSessionExpired = () => {
      setUser(null);
    };
    window.addEventListener('auth:session-expired', handleSessionExpired);
    return () => window.removeEventListener('auth:session-expired', handleSessionExpired);
  }, [setUser]);

  // Check if user needs onboarding
  useEffect(() => {
    if (isAuthenticated) {
      const onboardingComplete = localStorage.getItem('talisman_onboarding_complete');
      if (!onboardingComplete) {
        setShowOnboarding(true);
      }
    }
  }, [isAuthenticated]);

  return (
    <BrowserRouter>
      {/* Onboarding Wizard */}
      {isAuthenticated && (
        <OnboardingWizard
          isOpen={showOnboarding}
          onClose={() => setShowOnboarding(false)}
        />
      )}

      <ErrorBoundary>
        {/* Toaster MUST be inside ErrorBoundary — if a toast description is
            accidentally an object (e.g. Pydantic error array), rendering it
            would crash React. Inside the boundary, the crash is recoverable. */}
        <Toaster position="top-right" />
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginForm />} />
          <Route path="/register" element={<RegisterForm />} />

          {/* Pending approval screen — accessible to authenticated but pending users */}
          <Route path="/pending" element={<PendingApproval />} />

          {/* Protected routes — requires active account */}
          <Route element={<ProtectedRoute />}>
            <Route path="/welcome" element={<Welcome />} />
            <Route element={<MainLayout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/library" element={<Library />} />
              <Route path="/folders/:folderId" element={<FolderDetail />} />
              <Route path="/library/:id" element={<PropertyDetail />} />
              <Route path="/upload" element={<Upload />} />
              <Route path="/data-bank" element={<DataBankPage />} />
              <Route path="/compare" element={<ComparisonPage />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/organization" element={<ErrorBoundary><OrganizationSettings /></ErrorBoundary>} />
              <Route path="/command-center" element={<CommandCenter />} />
            </Route>
          </Route>

          {/* Public landing page */}
          <Route path="/" element={<Landing />} />

          {/* Public pages — legal, about, pricing */}
          <Route path="/terms" element={<TermsOfService />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/cookies" element={<CookiePolicy />} />
          <Route path="/security" element={<SecurityPage />} />
          <Route path="/about" element={<About />} />
          <Route path="/pricing" element={<Pricing />} />

          {/* Catch all - redirect to dashboard */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </ErrorBoundary>
    </BrowserRouter>
  );
}

export default App;
