import { SaaSPlan } from '@prisma/client';

/**
 * What each tier unlocks.
 *
 * Deliberately NOT read from `SaaSSubscriptionPlan.features` — that column is
 * marketing copy ("Everything in Starter", "Priority Support") and is shown to
 * buyers. Enforcement needs a typed, exhaustive, compile-checked map.
 */
export type FeatureKey =
  | 'EXPENSES'
  | 'PREMIUM_PACKAGES'
  | 'PROMO_CODES'
  | 'ADVANCED_REPORTS'
  | 'MULTI_BRANCH'
  | 'PAYROLL';

export type LimitKey = 'members' | 'trainers' | 'staff' | 'branches';

/**
 * Enquiries is intentionally absent: it is lead capture, the very thing that
 * makes a starter gym want to upgrade, and it already ships free.
 */
export const FEATURES_BY_PLAN: Record<SaaSPlan, ReadonlyArray<FeatureKey>> = {
  STARTER: [],
  PROFESSIONAL: ['EXPENSES', 'PREMIUM_PACKAGES', 'PROMO_CODES', 'ADVANCED_REPORTS', 'MULTI_BRANCH', 'PAYROLL'],
  ENTERPRISE: ['EXPENSES', 'PREMIUM_PACKAGES', 'PROMO_CODES', 'ADVANCED_REPORTS', 'MULTI_BRANCH', 'PAYROLL'],
};

export const FEATURE_LABELS: Record<FeatureKey, string> = {
  EXPENSES: 'Expense tracking',
  PREMIUM_PACKAGES: 'Premium diet & workout packages',
  PROMO_CODES: 'Promo codes',
  ADVANCED_REPORTS: 'Advanced reports',
  MULTI_BRANCH: 'Multiple branches',
  PAYROLL: 'Staff & trainer payroll',
};

export function featuresFor(plan: SaaSPlan): ReadonlySet<FeatureKey> {
  return new Set(FEATURES_BY_PLAN[plan] ?? []);
}
