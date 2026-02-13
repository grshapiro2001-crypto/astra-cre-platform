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
      const onboardingComplete = localStorage.getItem('astra_onboarding_complete');
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

          {/* Protected routes */}
          <Route element={<ProtectedRoute />}>
            <Route element={<MainLayout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/library" element={<Library />} />
              <Route path="/folders/:folderId" element={<FolderDetail />} />
              <Route path="/library/:id" element={<PropertyDetail />} />
              <Route path="/upload" element={<Upload />} />
              <Route path="/data-bank" element={<DataBankPage />} />
              <Route path="/compare" element={<ComparisonPage />} />
              <Route path="/settings" element={<Settings />} />
            </Route>
          </Route>

          {/* Redirect root to dashboard */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          {/* Catch all - redirect to dashboard */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </ErrorBoundary>
    </BrowserRouter>
  );
}

export default App;
