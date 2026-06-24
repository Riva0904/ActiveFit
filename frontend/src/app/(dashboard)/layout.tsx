'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Script from 'next/script';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { useAuthStore, useAuthHydrated } from '@/store/authStore';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { PageTransition } from '@/components/shared/PageTransition';
import { authApi } from '@/lib/api';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, setAuth } = useAuthStore();
  const hydrated = useAuthHydrated();
  const router = useRouter();

  // Wait for Zustand to finish hydrating from localStorage before deciding the user is
  // logged out — otherwise a hard reload / deep link reads `user` as null on the first
  // render and bounces a logged-in session through /login before hydration restores it.
  // Even post-hydration this can still race on a hard navigation; the httpOnly cookie is
  // independently valid, so fall back to an API profile check before giving up.
  useEffect(() => {
    if (!hydrated || user) return;
    authApi.profile()
      .then((profile: any) => setAuth(profile))
      .catch(() => router.replace('/login'));
  }, [hydrated, user]);

  if (!hydrated || !user) return null;

  return (
    <div className="min-h-screen bg-background mesh-bg">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" />
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="lg:pl-[var(--sidebar-width)] flex flex-col min-h-screen">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 p-4 md:p-6 lg:p-7 max-w-screen-2xl w-full mx-auto">
          <ErrorBoundary>
            <PageTransition>{children}</PageTransition>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
