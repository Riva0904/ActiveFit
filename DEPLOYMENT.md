# ActiveBoost — Deployment Guide

## Quick Start (Docker Compose)

```bash
# 1. Clone and configure
cp .env.example .env
# Edit .env with your secrets

# 2. Start all services
docker-compose up -d

# 3. Run database migrations
docker-compose exec backend npx prisma migrate deploy

# 4. Seed demo data
docker-compose exec backend npm run prisma:seed

# 5. Access the app
# Frontend: http://localhost:3000
# API:      http://localhost:3001/api/v1
# Swagger:  http://localhost:3001/api/docs
```

---

## Manual Setup (Development)

### 1. Backend

```bash
cd backend

# Install
npm install

# Configure
cp .env.example .env
# Set DATABASE_URL, JWT_SECRET, SMTP credentials, Razorpay keys

# Database setup
npx prisma generate
npx prisma migrate dev --name init
npm run prisma:seed

# Start
npm run start:dev      # Development
npm run start:prod     # Production (after npm run build)
```

### 2. Frontend

```bash
cd frontend

# Install
npm install

# Configure
cp .env.example .env.local
# Set NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1

# Start
npm run dev    # Development
npm run build && npm start  # Production
```

---

## Running Tests

### Unit Tests

```bash
cd backend
npm run test           # Run all unit tests (21 suites, 360+ tests, no DB needed)
```

### E2E Tests

```bash
cd backend

# Requires a running PostgreSQL with the seed applied (npm run prisma:seed).
# NODE_ENV must be a value the config schema accepts (jest defaults it to "test").
NODE_ENV=development DATABASE_URL="postgresql://..." npm run test:e2e
```

### Mobile

```bash
cd mobile
npm run typecheck      # tsc --noEmit
npm test               # node --test on the pure helpers (src/**/*.test.mjs)
npx expo-doctor        # after any dependency change
```

Native modules (`react-native-maps`, `expo-location`, `expo-dev-client`) mean **a new EAS build is
required** after pulling — JS-only updates cannot ship them.

```bash
eas build -p android --profile development   # dev client → npx expo start --dev-client
eas build -p android --profile preview       # installable APK
eas build -p android --profile production    # Play Store app-bundle
```

**Google Maps (Android only; iOS uses Apple Maps).** The run tracker's map needs a Maps SDK
for Android key, read from `GOOGLE_MAPS_ANDROID_API_KEY` in `app.config.ts`:

```bash
# locally
echo "GOOGLE_MAPS_ANDROID_API_KEY=AIza..." >> mobile/.env
# EAS builds (preview + production)
eas env:create --scope project --name GOOGLE_MAPS_ANDROID_API_KEY --value AIza... --visibility secret --environment preview
eas env:create --scope project --name GOOGLE_MAPS_ANDROID_API_KEY --value AIza... --visibility secret --environment production
```

Restrict the key in Google Cloud to package `com.activeboost.mobile` + the SHA-1 from
`eas credentials -p android`. Without the key the app runs but map tiles render blank.
Location tracking is foreground-only (no background location permission).

---

## Email Configuration (Resend)

Transactional email goes through the Resend HTTP API — set `RESEND_API_KEY` and
`EMAIL_FROM_ADDRESS` in `.env`. Never commit real keys to docs or source.

OTP emails sent for:
- **Email Verification** — on registration
- **Password Reset** — on forgot password
- **Login 2FA** — on suspicious login (future)

---

## Auth Flow

```
Register ──► OTP sent to email ──► Verify OTP ──► JWT issued
                                       │
                                  (wrong OTP)
                                       │
                                  Max 5 attempts ──► OTP locked
                                       │
                                  Resend (60s cooldown)

Forgot Password ──► OTP sent ──► Verify OTP + new password ──► Success
```

---

## API Reference

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/api/v1/auth/register` | POST | ❌ | Register + send OTP |
| `/api/v1/auth/verify-email` | POST | ❌ | Verify OTP → JWT |
| `/api/v1/auth/login` | POST | ❌ | Login (requires verified email) |
| `/api/v1/auth/resend-otp` | POST | ❌ | Resend OTP (rate limited) |
| `/api/v1/auth/forgot-password` | POST | ❌ | Send reset OTP |
| `/api/v1/auth/reset-password` | POST | ❌ | Reset with OTP |
| `/api/v1/auth/profile` | GET | ✅ | Get own profile |
| `/api/v1/auth/change-password` | PATCH | ✅ | Change password |
| `/api/v1/health` | GET | ❌ | System health check |
| `/api/v1/health/ping` | GET | ❌ | Ping |

---

## Production Checklist

- [ ] Set strong `JWT_SECRET` (min 32 chars)
- [ ] Set `NODE_ENV=production`
- [ ] Configure `CORS_ORIGIN` to your domain
- [ ] Set up SSL certificate (Nginx config included)
- [ ] Configure Razorpay live keys
- [ ] Run `prisma migrate deploy` (not `dev`) in production
- [ ] Set up PM2 (`pm2 start ecosystem.config.js --env production`)
- [ ] Configure log rotation
- [ ] Set up DB backups

---

## PM2 Production

```bash
# Install PM2 globally
npm install -g pm2

# Build both apps first
cd backend && npm run build && cd ..
cd frontend && npm run build && cd ..

# Start with PM2
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup

# Monitor
pm2 status
pm2 logs activeboost-api
pm2 monit
```
