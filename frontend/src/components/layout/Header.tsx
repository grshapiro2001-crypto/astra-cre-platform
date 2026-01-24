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
    <header className="bg-white shadow-sm border-b border-emerald-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
              <svg
                className="w-5 h-5 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            </div>
            <h1 className="text-xl font-bold">
              <span className="text-emerald-600">Astra</span>
              <span className="text-gray-400 ml-1 font-normal text-sm">CRE</span>
            </h1>
          </div>

          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-500">
              {user?.full_name || user?.email}
            </span>
            <Button
              onClick={handleLogout}
              className="bg-white text-emerald-700 border border-emerald-300 hover:bg-emerald-50 hover:border-emerald-400 h-9 px-3 text-sm rounded-lg transition-colors"
            >
              Logout
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};
