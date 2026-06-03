'use client';

import Link from 'next/link';
import { Zap } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 gradient-brand rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-brand animate-float">
          <Zap className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-7xl font-black text-gradient-brand mb-4">404</h1>
        <h2 className="text-2xl font-extrabold mb-2">Page Not Found</h2>
        <p className="text-muted-foreground mb-8">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link
          href="/login"
          className="inline-flex items-center gap-2 px-6 py-3 gradient-brand text-white font-bold rounded-xl hover:opacity-90 transition-all shadow-brand"
        >
          Back to Login
        </Link>
      </div>
    </div>
  );
}
