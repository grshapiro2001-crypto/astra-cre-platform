import { useAuthStore } from '@/store/authSlice';

export const Dashboard = () => {
  const user = useAuthStore((state) => state.user);

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Dashboard</h1>
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">
          Welcome, {user?.full_name || user?.email}!
        </h2>
        <p className="text-gray-600">
          This is your CRE Platform dashboard. You can upload Offering Memorandums,
          manage your property library, and compare properties.
        </p>
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-primary-50 p-4 rounded-lg">
            <h3 className="font-semibold text-primary-900 mb-2">Upload Properties</h3>
            <p className="text-sm text-primary-700">
              Upload and analyze OMs and BOVs
            </p>
          </div>
          <div className="bg-primary-50 p-4 rounded-lg">
            <h3 className="font-semibold text-primary-900 mb-2">Library</h3>
            <p className="text-sm text-primary-700">
              Organize your properties with folders
            </p>
          </div>
          <div className="bg-primary-50 p-4 rounded-lg">
            <h3 className="font-semibold text-primary-900 mb-2">Comparison</h3>
            <p className="text-sm text-primary-700">
              Compare properties side-by-side
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
