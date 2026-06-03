'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { useAuthStore } from '@/store/authStore';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!user) router.replace('/login');
  }, [user, router]);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background mesh-bg">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="lg:pl-[var(--sidebar-width)] flex flex-col min-h-screen">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 p-4 md:p-6 lg:p-7 max-w-screen-2xl w-full mx-auto">
          <ErrorBoundary>
            {/* key forces re-mount → triggers animate-page-in on every navigation */}
            <div key={pathname} className="animate-page-in">
              {children}
            </div>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
