import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authSlice';
import { Button } from '@/components/ui/button';

export const Header = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <h1 className="text-xl font-bold text-gray-900">CRE Platform</h1>
          </div>

          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-700">
              {user?.full_name || user?.email}
            </span>
            <Button
              variant="outline"
              onClick={handleLogout}
            >
              Logout
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};
