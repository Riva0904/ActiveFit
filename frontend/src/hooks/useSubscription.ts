'use client';

import { useEffect, useState } from 'react';
import { gymSubscriptionsApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

export type PlanTier = 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';

export interface SubscriptionInfo {
  plan: PlanTier;
  status: string;
  expiresAt?: string;
  daysLeft?: number | null;
  maxMembers: number;
  maxTrainers: number;
  isFreePlan: boolean;
  isPro: boolean;
  isEnterprise: boolean;
  isExpired: boolean;
  inGrace: boolean;
  isActive: boolean;
  memberCount: number;
  trainerCount: number;
  features: string[];
}

/** Fallback only — the server is authoritative; this keeps the UI sane if the call fails. */
const FREE_LIMITS = { members: 50, trainers: 1 };

// Module-level cache — survives re-renders, cleared on gymId change
let _cache: { gymId: string; info: SubscriptionInfo } | null = null;

/** Clear after anything that can change the plan (subscribing, admin grant). */
export function clearSubscriptionCache() {
  _cache = null;
}

/**
 * Plan, limits and feature list, straight from the entitlements endpoint —
 * previously this guessed limits client-side with hardcoded numbers that did
 * not match the real tiers.
 */
export function useSubscription() {
  const { user } = useAuthStore();
  const [info, setInfo] = useState<SubscriptionInfo | null>(
    _cache && _cache.gymId === user?.gymId ? _cache.info : null,
  );
  const [loading, setLoading] = useState(!info);

  useEffect(() => {
    if (!user?.gymId) { setLoading(false); return; }
    if (_cache?.gymId === user.gymId) { setInfo(_cache.info); setLoading(false); return; }

    setLoading(true);
    gymSubscriptionsApi.me().then((me: any) => {
      const plan: PlanTier = me?.plan ?? 'STARTER';
      const result: SubscriptionInfo = {
        plan,
        status: me?.status ?? 'TRIAL',
        expiresAt: me?.expiresAt,
        daysLeft: me?.daysLeft ?? null,
        maxMembers: me?.limits?.maxMembers ?? FREE_LIMITS.members,
        maxTrainers: me?.limits?.maxTrainers ?? FREE_LIMITS.trainers,
        isFreePlan: plan === 'STARTER',
        isPro: plan === 'PROFESSIONAL',
        isEnterprise: plan === 'ENTERPRISE',
        isExpired: me?.status === 'EXPIRED' && !me?.inGrace,
        inGrace: !!me?.inGrace,
        isActive: me?.isActive ?? true,
        memberCount: me?.usage?.members ?? 0,
        trainerCount: me?.usage?.trainers ?? 0,
        features: me?.features ?? [],
      };
      _cache = { gymId: user.gymId!, info: result };
      setInfo(result);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [user?.gymId]);

  return { info, loading, freeLimits: FREE_LIMITS };
}
