'use client';

import { useState, useEffect } from 'react';
import { Bell, Menu, Moon, Sun, Search, X, ChevronDown, Settings, LogOut, UserCog } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useAuthStore } from '@/store/authStore';
import { notificationsApi, authApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { EditProfileModal } from '@/components/shared/EditProfileModal';

interface HeaderProps { onMenuClick: () => void; }

export function Header({ onMenuClick }: HeaderProps) {
  const { theme, setTheme } = useTheme();
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    notificationsApi.getUnreadCount()
      .then((res: any) => setUnreadCount(typeof res?.data === 'number' ? res.data : (res ?? 0)))
      .catch(() => {});
  }, []);

  const initials = `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase();
  const rolePath = user?.role === 'SUPER_ADMIN' ? '/super-admin'
    : user?.role === 'GYM_ADMIN' ? '/admin'
    : user?.role === 'STAFF' ? '/staff'
    : user?.role === 'TRAINER' ? '/trainer'
    : '/user';

  const handleLogout = async () => {
    try { await authApi.logout(); } catch { /* cookie may already be gone */ }
    logout();
    toast.success('Signed out successfully');
    router.push('/login');
  };

  return (
    <>
      {showEditProfile && <EditProfileModal onClose={() => setShowEditProfile(false)} />}
    <header className={cn(
      'h-[var(--header-height)] sticky top-0 z-30 flex items-center gap-3 px-4 md:px-6',
      'bg-card/80 backdrop-blur-xl border-b border-border/60',
    )}>
      {/* Mobile menu */}
      <button
        onClick={onMenuClick}
        aria-label="Open menu"
        className="lg:hidden p-2 hover:bg-muted rounded-md text-muted-foreground transition-colors"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Search */}
      <div className={cn('flex-1 max-w-md', showSearch ? 'flex' : 'hidden md:flex')}>
        <div className="relative w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            placeholder="Search members, gyms, reports…"
            className="w-full h-10 pl-10 pr-4 text-sm bg-muted/60 border border-border/40 rounded-md outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15 focus:bg-card transition-all duration-200 placeholder:text-muted-foreground/60"
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground/50 font-mono bg-muted px-1.5 py-0.5 rounded hidden md:block">⌘K</kbd>
        </div>
      </div>

      {/* Mobile search toggle */}
      <button
        className="md:hidden p-2 hover:bg-muted rounded-md text-muted-foreground"
        onClick={() => setShowSearch(!showSearch)}
        aria-label={showSearch ? 'Close search' : 'Open search'}
      >
        {showSearch ? <X className="w-5 h-5" /> : <Search className="w-5 h-5" />}
      </button>

      <div className="ml-auto flex items-center gap-2">
        {/* Theme toggle */}
        {mounted && (
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            className="group w-9 h-9 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
          >
            {theme === 'dark'
              ? <Sun className="w-4 h-4 transition-transform duration-300 group-hover:rotate-90 group-hover:text-amber-400" />
              : <Moon className="w-4 h-4 transition-transform duration-300 group-hover:-rotate-12 group-hover:text-indigo-400" />}
          </button>
        )}

        {/* Notifications */}
        <Link
          href={`${rolePath}/notifications`}
          aria-label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : 'Notifications'}
          className={cn(
            'relative w-9 h-9 flex items-center justify-center rounded-md hover:bg-muted transition-all group',
            unreadCount > 0 ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Bell className={cn('w-4 h-4 transition-transform', unreadCount > 0 && 'bell-active')} />
          {unreadCount > 0 && (
            <>
              <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-primary animate-ping opacity-70" />
              <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-primary border-2 border-card" />
            </>
          )}
        </Link>

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            aria-label="User menu"
            aria-expanded={showUserMenu}
            className="flex items-center gap-2.5 px-2 py-1.5 hover:bg-muted rounded-md transition-all group"
          >
            <div className="w-8 h-8 rounded-md overflow-hidden shadow-sm shrink-0 ring-2 ring-transparent group-hover:ring-primary/30 transition-all duration-200">
              {user?.avatar
                ? <img src={user.avatar} alt="avatar" className="w-full h-full object-cover" />
                : <div className="w-full h-full gradient-brand flex items-center justify-center text-white text-xs font-bold">{initials}</div>}
            </div>
            <div className="hidden md:block text-left">
              <p className="text-sm font-semibold leading-tight">{user?.firstName} {user?.lastName}</p>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-bold leading-tight">
                {user?.role?.toLowerCase().replace('_', ' ')}
              </p>
            </div>
            <ChevronDown className={cn('w-3.5 h-3.5 text-muted-foreground transition-transform hidden md:block', showUserMenu && 'rotate-180')} />
          </button>

          {/* Dropdown */}
          {showUserMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
              <div className="absolute right-0 top-full mt-2 w-52 bg-card border border-border rounded-md shadow-lifted z-50 overflow-hidden animate-scale-in">
                <div className="px-4 py-3 border-b border-border/50">
                  <p className="font-semibold text-sm">{user?.firstName} {user?.lastName}</p>
                  <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                </div>
                <div className="p-1.5">
                  <button onClick={() => { setShowUserMenu(false); setShowEditProfile(true); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm hover:bg-muted transition-colors text-left">
                    <UserCog className="w-4 h-4 text-muted-foreground" /> Edit Profile
                  </button>
                  <Link href={`${rolePath}/profile`} onClick={() => setShowUserMenu(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm hover:bg-muted transition-colors">
                    <Settings className="w-4 h-4 text-muted-foreground" /> Settings
                  </Link>
                  <button onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-destructive hover:bg-destructive/8 transition-colors">
                    <LogOut className="w-4 h-4" /> Sign Out
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
    </>
  );
}
