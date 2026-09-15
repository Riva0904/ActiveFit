/**
 * One-shot backfill: give every existing gym a GymSubscription row derived from
 * its current denormalized columns.
 *
 * Why: subscriptions became the authority for entitlements, but no gym has a row
 * yet (nothing ever wrote the table). EntitlementsService falls back to the Gym
 * columns so nothing breaks without this — the backfill just makes the data
 * consistent so history, expiry and the admin views all work.
 *
 * Safe to re-run: gyms that already have a subscription row are skipped.
 *
 *   npx ts-node scripts/backfill-gym-subscriptions.ts [--dry]
 */
import { PrismaClient, SaaSStatus } from '@prisma/client';

const prisma = new PrismaClient();
const DRY = process.argv.includes('--dry');

async function main() {
  const settings = await prisma.platformSettings.findUnique({ where: { id: 'singleton' } });
  const trialDays = settings?.trialDays ?? 14;

  const plans = await prisma.saaSSubscriptionPlan.findMany();
  if (plans.length === 0) {
    console.error('No SaaS plans found. Run POST /saas-plans/init first.');
    process.exit(1);
  }
  const planByTier = new Map(plans.map((p) => [p.plan, p]));

  const gyms = await prisma.gym.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, saasPlan: true, saasStatus: true, saasExpiresAt: true, createdAt: true },
  });

  let created = 0;
  let skipped = 0;

  for (const gym of gyms) {
    const existing = await prisma.gymSubscription.count({ where: { gymId: gym.id } });
    if (existing > 0) {
      skipped++;
      continue;
    }

    const plan = planByTier.get(gym.saasPlan);
    if (!plan) {
      console.warn(`  ! ${gym.name}: no plan row for tier ${gym.saasPlan}, skipping`);
      skipped++;
      continue;
    }

    // Keep whatever expiry the gym already had; otherwise give a trial window
    // from today so nobody is retroactively expired by the backfill itself.
    const endDate = gym.saasExpiresAt ?? new Date(Date.now() + trialDays * 86_400_000);
    const startDate = gym.createdAt < endDate ? gym.createdAt : new Date();
    const status: SaaSStatus = gym.saasStatus === 'CANCELLED' ? SaaSStatus.CANCELLED : gym.saasStatus;

    console.log(
      `  ${DRY ? '[dry] ' : ''}${gym.name}: ${gym.saasPlan} ${status} until ${endDate.toISOString().slice(0, 10)}`,
    );

    if (!DRY) {
      await prisma.gymSubscription.create({
        data: {
          gymId: gym.id,
          planId: plan.id,
          status,
          billingPeriod: 'MONTHLY',
          startDate,
          endDate,
          amount: 0,
          source: 'MIGRATION',
          activatedAt: status === SaaSStatus.ACTIVE ? startDate : null,
        },
      });
    }
    created++;
  }

  console.log(`\n${DRY ? 'Would create' : 'Created'} ${created} subscription row(s); ${skipped} gym(s) skipped.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
