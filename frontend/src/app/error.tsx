'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background mesh-bg px-4">
      <div className="text-center max-w-md animate-scale-in">
        <div className="w-20 h-20 bg-rose-100 dark:bg-rose-900/30 rounded-3xl flex items-center justify-center mx-auto mb-6">
          <AlertTriangle className="w-10 h-10 text-rose-500" />
        </div>
        <h1 className="text-2xl font-extrabold mb-2">Something went wrong</h1>
        <p className="text-muted-foreground mb-8 leading-relaxed">
          An unexpected error occurred while loading this page.
          {error.digest && (
            <span className="block text-xs mt-2 font-mono text-muted-foreground/60">
              Error ID: {error.digest}
            </span>
          )}
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="flex items-center gap-2 px-5 py-2.5 gradient-brand text-white font-bold rounded-xl hover:opacity-90 transition-all shadow-brand"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
          <Link
            href="/"
            className="flex items-center gap-2 px-5 py-2.5 bg-card border border-border text-foreground font-semibold rounded-xl hover:bg-muted transition-all"
          >
            <Home className="w-4 h-4" />
            Go Home
          </Link>
        </div>
      </div>
    </div>
  );
}
