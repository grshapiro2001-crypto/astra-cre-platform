import { NavLink } from 'react-router-dom';

export const Sidebar = () => {
  const navItems = [
    { name: 'Dashboard', path: '/dashboard' },
    { name: 'Library', path: '/library' },
    { name: 'Upload', path: '/upload' },
    { name: 'Comparison', path: '/comparison' },
  ];

  return (
    <aside className="w-64 bg-gray-800 min-h-screen">
      <nav className="mt-8 px-4">
        <div className="space-y-2">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `block px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                }`
              }
            >
              {item.name}
            </NavLink>
          ))}
        </div>
      </nav>
    </aside>
  );
};
