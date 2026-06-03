'use client';

import { useEffect, useState } from 'react';
import { gymsApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

export type PlanTier = 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';

export interface SubscriptionInfo {
  plan: PlanTier;
  status: string;
  expiresAt?: string;
  maxMembers: number;
  isFreePlan: boolean;
  isPro: boolean;
  isEnterprise: boolean;
  isExpired: boolean;
  memberCount: number;
  trainerCount: number;
}

const FREE_LIMITS = { members: 50, trainers: 1 };

// Module-level cache — survives re-renders, cleared on gymId change
let _cache: { gymId: string; info: SubscriptionInfo } | null = null;

export function useSubscription() {
  const { user } = useAuthStore();
  const [info, setInfo] = useState<SubscriptionInfo | null>(
    _cache?.gymId === user?.gymId ? _cache.info : null,
  );
  const [loading, setLoading] = useState(!info);

  useEffect(() => {
    if (!user?.gymId) { setLoading(false); return; }
    // Return immediately if we already have fresh data for this gym
    if (_cache?.gymId === user.gymId) { setInfo(_cache.info); setLoading(false); return; }

    setLoading(true);
    gymsApi.getOne(user.gymId).then((gym: any) => {
      const plan: PlanTier = gym.saasPlan ?? 'STARTER';
      const result: SubscriptionInfo = {
        plan,
        status: gym.saasStatus,
        expiresAt: gym.saasExpiresAt,
        maxMembers: gym.maxMembers ?? 50,
        isFreePlan: plan === 'STARTER',
        isPro: plan === 'PROFESSIONAL',
        isEnterprise: plan === 'ENTERPRISE',
        isExpired: gym.saasStatus === 'EXPIRED',
        memberCount: gym._count?.members ?? 0,
        trainerCount: gym._count?.trainers ?? 0,
      };
      _cache = { gymId: user.gymId!, info: result };
      setInfo(result);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [user?.gymId]);

  return { info, loading, freeLimits: FREE_LIMITS };
}
