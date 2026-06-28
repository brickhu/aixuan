import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const navItems = [
  { to: '/chat', label: '对话', icon: '💬' },
  { to: '/history', label: '历史', icon: '📋' },
  { to: '/profile', label: '我的', icon: '👤' },
];

export function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="flex h-screen flex-col">
      {/* 顶部导航 */}
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
          <NavLink to="/chat" className="text-lg font-bold text-indigo-600">
            aiXuan
          </NavLink>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">
              {user?.nickname || user?.email}
            </span>
            <button
              onClick={logout}
              className="rounded-lg px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            >
              退出
            </button>
          </div>
        </div>
      </header>

      {/* 主内容 */}
      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-4xl h-full">
          <Outlet />
        </div>
      </main>

      {/* 底部 Tab 导航 */}
      <nav className="border-t border-gray-200 bg-white">
        <div className="mx-auto flex max-w-4xl justify-around">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center py-2 text-xs ${
                  isActive
                    ? 'text-indigo-600'
                    : 'text-gray-400 hover:text-gray-600'
                }`
              }
            >
              <span className="text-xl">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}