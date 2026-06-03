'use client';

import { useState } from 'react';
import { Lock, Crown } from 'lucide-react';
import { UpgradeModal } from './UpgradeModal';

interface FeatureGateProps {
  locked: boolean;
  featureName?: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function FeatureGate({ locked, featureName, children, fallback }: FeatureGateProps) {
  const [showModal, setShowModal] = useState(false);

  if (!locked) return <>{children}</>;

  if (fallback) {
    return (
      <>
        <div onClick={() => setShowModal(true)} className="cursor-pointer">
          {fallback}
        </div>
        <UpgradeModal open={showModal} onClose={() => setShowModal(false)} featureName={featureName} />
      </>
    );
  }

  return (
    <>
      <div
        onClick={() => setShowModal(true)}
        className="relative rounded-2xl border-2 border-dashed border-border/60 bg-muted/30 p-8 flex flex-col items-center justify-center gap-3 cursor-pointer group hover:border-primary/40 hover:bg-primary/5 transition-all"
      >
        <div className="w-14 h-14 bg-gradient-to-br from-purple-100 to-orange-100 dark:from-purple-900/30 dark:to-orange-900/30 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
          <Lock className="w-7 h-7 text-purple-500" />
        </div>
        <div className="text-center">
          <p className="font-bold text-foreground">{featureName ?? 'Premium Feature'}</p>
          <p className="text-sm text-muted-foreground mt-1">Upgrade to Pro to unlock this feature</p>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-bold text-white bg-gradient-to-r from-purple-500 to-orange-500 px-4 py-2 rounded-xl">
          <Crown className="w-3.5 h-3.5" /> Upgrade to unlock
        </div>
      </div>
      <UpgradeModal open={showModal} onClose={() => setShowModal(false)} featureName={featureName} />
    </>
  );
}

// Inline lock badge for nav items / cards
export function PremiumBadge({ onClick }: { onClick?: () => void }) {
  return (
    <span
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClick?.(); }}
      className="ml-auto flex items-center gap-0.5 text-[9px] font-bold bg-gradient-to-r from-purple-500 to-orange-500 text-white px-1.5 py-0.5 rounded-full cursor-pointer"
    >
      <Crown className="w-2.5 h-2.5" /> PRO
    </span>
  );
}
