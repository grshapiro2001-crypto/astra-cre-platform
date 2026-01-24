import { useAuthStore } from '@/store/authSlice';

export const Dashboard = () => {
  const user = useAuthStore((state) => state.user);

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Dashboard</h1>
      <div className="bg-white shadow-md rounded-xl border border-emerald-100 p-6">
        <h2 className="text-xl font-semibold text-emerald-900 mb-4">
          Welcome, {user?.full_name || user?.email}!
        </h2>
        <p className="text-gray-600">
          This is your CRE Platform dashboard. You can upload Offering Memorandums,
          manage your property library, and compare properties.
        </p>
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-emerald-50 border border-emerald-200 p-5 rounded-xl hover:shadow-md hover:border-emerald-300 transition-all duration-200">
            <div className="w-10 h-10 rounded-lg bg-emerald-500 flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            </div>
            <h3 className="font-semibold text-emerald-900 mb-1">Upload Properties</h3>
            <p className="text-sm text-emerald-700">
              Upload and analyze OMs and BOVs
            </p>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 p-5 rounded-xl hover:shadow-md hover:border-emerald-300 transition-all duration-200">
            <div className="w-10 h-10 rounded-lg bg-emerald-600 flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <h3 className="font-semibold text-emerald-900 mb-1">Library</h3>
            <p className="text-sm text-emerald-700">
              Organize your properties with folders
            </p>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 p-5 rounded-xl hover:shadow-md hover:border-emerald-300 transition-all duration-200">
            <div className="w-10 h-10 rounded-lg bg-green-600 flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="font-semibold text-emerald-900 mb-1">Comparison</h3>
            <p className="text-sm text-emerald-700">
              Compare properties side-by-side
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
