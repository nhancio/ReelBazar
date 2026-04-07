import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const navItems = [
  { path: '/', icon: 'home', label: 'Home' },
  { path: '/create', icon: 'plus', label: 'Create' },
  { path: '/profile', icon: 'user', label: 'Profile' },
];

function NavIcon({ name, active, avatarUrl, theme }: { name: string; active: boolean; avatarUrl?: string | null; theme: 'dark' | 'light' }) {
  const color = theme === 'light'
    ? (active ? 'text-black' : 'text-black/60')
    : (active ? 'text-white' : 'text-white/60');
  switch (name) {
    case 'home':
      return (
        <svg className={`h-7 w-7 transition-colors ${color}`} fill={active ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 0 : 2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      );
    case 'plus':
      return (
        <svg className={`h-7 w-7 transition-colors ${color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      );
    case 'user':
      return (
        <div className={`h-7 w-7 rounded-full overflow-hidden border-2 transition-colors ${active ? 'border-white' : 'border-transparent'}`}>
          {avatarUrl ? (
            <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
          ) : (
            <svg className={`h-full w-full p-1 ${theme === 'light' ? 'bg-black/10 text-black' : 'bg-white/20 text-white'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          )}
        </div>
      );
    default:
      return null;
  }
}

export default function Layout() {
  const location = useLocation();
  const { user } = useAuth();
  const { theme } = useTheme();

  return (
    <div className={`rb-aurora min-h-[100dvh] h-[100dvh] flex flex-col overflow-hidden ${theme === 'light' ? 'bg-[#f6f7fb] text-black' : 'bg-black text-white'}`}>
      <main className="flex-1 w-full relative overflow-y-auto">
        <Outlet />
      </main>

      <nav className={`w-full z-50 shrink-0 border-t ${theme === 'light' ? 'bg-white border-black/10' : 'bg-black border-white/10'}`}>
        <div className="mx-auto flex h-[60px] w-full max-w-md items-center justify-around px-2 pb-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || (item.path === '/profile' && location.pathname.startsWith('/profile'));

            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={`flex flex-col items-center justify-center pt-3 pb-1 w-16 transition-transform active:scale-90 relative rounded-2xl ${
                  isActive ? 'bg-white/10' : ''
                }`}
              >
                <NavIcon name={item.icon} active={isActive} avatarUrl={user?.avatarUrl} theme={theme} />
                {isActive && (
                  <div className={`absolute bottom-0 w-6 h-0.5 rounded-full ${theme === 'light' ? 'bg-black' : 'bg-white'}`} />
                )}
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
