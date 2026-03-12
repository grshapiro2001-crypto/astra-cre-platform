import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/store/authSlice';

export const ProtectedRoute = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Pending users get redirected to the approval waiting screen
  if (user?.account_status === 'pending') {
    return <Navigate to="/pending" replace />;
  }

  // Suspended users get logged out
  if (user?.account_status === 'suspended') {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};
