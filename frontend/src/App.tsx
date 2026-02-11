import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { useAuthStore } from './store/authSlice';
import { LoginForm } from './components/auth/LoginForm';
import { RegisterForm } from './components/auth/RegisterForm';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { MainLayout } from './components/layout/MainLayout';
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
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

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
      <Toaster position="top-right" />

      {/* Onboarding Wizard */}
      {isAuthenticated && (
        <OnboardingWizard
          isOpen={showOnboarding}
          onClose={() => setShowOnboarding(false)}
        />
      )}

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
    </BrowserRouter>
  );
}

export default App;
