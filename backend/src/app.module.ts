import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { EventEmitterModule } from '@nestjs/event-emitter';
import * as Joi from 'joi';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { GymScopeGuard } from './common/guards/gym-scope.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { PrismaModule } from './prisma/prisma.module';
import { EmailModule } from './email/email.module';
import { OtpModule } from './otp/otp.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { GymsModule } from './gyms/gyms.module';
import { MembershipsModule } from './memberships/memberships.module';
import { AttendanceModule } from './attendance/attendance.module';
import { TrainersModule } from './trainers/trainers.module';
import { PtSessionsModule } from './pt-sessions/pt-sessions.module';
import { PaymentsModule } from './payments/payments.module';
import { SupplementsModule } from './supplements/supplements.module';
import { SalaryPayoutsModule } from './salary-payouts/salary-payouts.module';
import { WorkoutPlansModule } from './workout-plans/workout-plans.module';
import { DietPlansModule } from './diet-plans/diet-plans.module';
import { NotificationsModule } from './notifications/notifications.module';
import { InvoicesModule } from './invoices/invoices.module';
import { ProgressLogsModule } from './progress-logs/progress-logs.module';
import { HealthModule } from './health/health.module';
import { ExpensesModule } from './expenses/expenses.module';
import { StaffsModule } from './staffs/staffs.module';
import { LeaveModule } from './leave/leave.module';
import { ChatModule } from './chat/chat.module';
import { RenewalRemindersModule } from './renewal-reminders/renewal-reminders.module';
import { EnquiriesModule } from './enquiries/enquiries.module';
import { ReferralsModule } from './referrals/referrals.module';
import { PromoCodesModule } from './promo-codes/promo-codes.module';
import { SaasPlansModule } from './saas-plans/saas-plans.module';
import { PlatformSettingsModule } from './platform-settings/platform-settings.module';
import { EntitlementsModule } from './entitlements/entitlements.module';
import { GymSubscriptionsModule } from './gym-subscriptions/gym-subscriptions.module';
import { CommonModule } from './common/common.module';
import { isPrimaryInstance } from './common/utils/cluster';
import { AnalyticsModule } from './analytics/analytics.module';
import { GamificationModule } from './gamification/gamification.module';
import { MobileModule } from './mobile/mobile.module';
import { ActivitiesModule } from './activities/activities.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validationSchema: Joi.object({
        NODE_ENV: Joi.string().valid('development', 'staging', 'production').default('development'),
        PORT: Joi.number().default(3001),
        DATABASE_URL: Joi.string().required(),
        JWT_SECRET: Joi.string().min(32).required(),
        JWT_EXPIRES_IN: Joi.string().default('7d'),
        CORS_ORIGIN: Joi.string().default('http://localhost:3000'),
        RESEND_API_KEY: Joi.string().required(),
        EMAIL_FROM_ADDRESS: Joi.string().default('onboarding@resend.dev'),
      }),
      validationOptions: { allowUnknown: true, abortEarly: false },
    }),
    ThrottlerModule.forRoot({
      throttlers: [
        { name: 'short', ttl: 1000, limit: 20 },   // max 20 req/sec per IP (dashboards fire several parallel GETs on mount)
        { name: 'medium', ttl: 60000, limit: 300 }, // max 300 req/min per IP (general API)
      ],
      // e2e suites hammer login/forgot-password faster than a human could; the limiter
      // itself is covered by unit tests. Never set this in a deployed environment.
      skipIf: () => process.env.DISABLE_THROTTLE === 'true',
    }),
    // Cron jobs are registered only on the primary worker — under PM2 cluster mode
    // every other worker skips ScheduleModule so @Cron methods stay inert there.
    // (They remain callable directly, e.g. renewal-reminders "send now".)
    ...(isPrimaryInstance() ? [ScheduleModule.forRoot()] : []),
    EventEmitterModule.forRoot({ wildcard: false, delimiter: '.', maxListeners: 20 }),
    PrismaModule,
    EmailModule,
    OtpModule,
    AuthModule,
    UsersModule,
    GymsModule,
    MembershipsModule,
    AttendanceModule,
    TrainersModule,
    PtSessionsModule,
    PaymentsModule,
    SupplementsModule,
    SalaryPayoutsModule,
    WorkoutPlansModule,
    DietPlansModule,
    NotificationsModule,
    InvoicesModule,
    ProgressLogsModule,
    HealthModule,
    ExpensesModule,
    StaffsModule,
    LeaveModule,
    ChatModule,
    RenewalRemindersModule,
    EnquiriesModule,
    ReferralsModule,
    PromoCodesModule,
    SaasPlansModule,
    PlatformSettingsModule,
    EntitlementsModule,
    GymSubscriptionsModule,
    CommonModule,
    AnalyticsModule,
    GamificationModule,
    MobileModule,
    ActivitiesModule,
  ],
  // Order matters: global guards execute in registration order, and all of them run
  // before any controller-level @UseGuards(). JwtAuthGuard must therefore be global
  // and precede GymScopeGuard, otherwise req.user is still undefined when the scope
  // guard runs and it degrades to a no-op.
  //
  // RolesGuard is global too, and must follow JwtAuthGuard for the same reason (it
  // reads user.role). It returns true whenever a handler carries no @Roles metadata,
  // so making it global is a no-op for existing routes — but it permanently removes
  // the "@Roles present, @UseGuards(RolesGuard) forgotten" failure mode, where the
  // decorator silently does nothing and the route is open to every logged-in user.
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: GymScopeGuard },
  ],
})
export class AppModule {}
