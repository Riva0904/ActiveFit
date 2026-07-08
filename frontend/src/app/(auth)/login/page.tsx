'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Dumbbell, ArrowRight, Phone, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { cn } from '@/lib/utils';
import { Button } from '@/components/shared/Button';

const schema = z.object({
  email:    z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});
type FormData = z.infer<typeof schema>;

const platformStats = [
  { value: '50K+',  label: 'Active Members'  },
  { value: '500+',  label: 'Gyms Managed'    },
  { value: '₹2Cr+', label: 'Revenue Tracked' },
  { value: '99.9%', label: 'Uptime SLA'      },
];

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setAuth } = useAuthStore();
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const res: any = await authApi.login({ email: data.email!, password: data.password! });
      setAuth(res.user);
      toast.success(`Welcome back, ${res.user.firstName}`);
      const redirect = searchParams.get('redirect');
      if (redirect && redirect.startsWith('/')) {
        router.push(redirect);
      } else {
        switch (res.user.role) {
          case 'SUPER_ADMIN': router.push('/super-admin'); break;
          case 'GYM_ADMIN':   router.push('/admin');       break;
          case 'STAFF':       router.push('/staff');       break;
          case 'TRAINER':     router.push('/trainer');     break;
          default:            router.push('/user');
        }
      }
    } catch (err: any) {
      const d = err?.response?.data;
      if (d?.code === 'EMAIL_NOT_VERIFIED' || d?.message?.code === 'EMAIL_NOT_VERIFIED') {
        toast('Verify your email — OTP resent.');
        router.push(`/verify-email?email=${encodeURIComponent(data.email!)}`);
      } else {
        toast.error(d?.message ?? 'Login failed. Check your credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  const inputCls = cn(
    'w-full h-[50px] rounded-md border-2 border-border bg-card px-3.5 text-[15px]',
    'text-foreground outline-none transition-all placeholder:text-muted-foreground/60',
    'focus:border-primary focus:ring-4 focus:ring-primary/10',
  );

  return (
    <div className="min-h-screen flex">

      {/* ── Left hero panel ──────────────────────────────────────────────────── */}
      <div className="hidden lg:flex w-[52%] flex-col justify-between p-12 relative overflow-hidden bg-[#0A0A0B]">
        {/* Angular accent slab — sharp-cornered, not a blurred orb */}
        <div className="absolute -top-24 -right-24 w-[420px] h-[420px] angular-accent opacity-90" />
        <div className="diagonal-cut absolute inset-0 bg-gradient-to-br from-[#FF4D00]/15 via-transparent to-transparent" />
        <div className="lane-lines" />

        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="relative z-10 flex items-center gap-2"
        >
          <div className="w-11 h-11 bg-white/[0.12] rounded-md flex items-center justify-center border border-white/20">
            <Dumbbell className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="text-white font-black text-[22px] tracking-tight">ActiveBoost</div>
            <div className="text-white/50 text-xs uppercase tracking-wide">Gym Management Platform</div>
          </div>
        </motion.div>

        {/* Hero copy */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="relative z-10"
        >
          <div className="flex items-center gap-2 mb-6">
            <div className="w-2 h-2 bg-[#FF4D00] live-dot" />
            <span className="text-white/70 text-sm font-bold uppercase tracking-wide">Trusted by 500+ fitness businesses</span>
          </div>
          <h1 className="text-white text-[56px] font-black leading-[1.02] tracking-tighter mb-5 uppercase">
            Run your gym<br />
            <span className="text-white/50">like a</span>{' '}
            <span className="text-gradient-brand">pro</span>
          </h1>
          <p className="text-white/60 text-lg leading-relaxed mb-9 max-w-[400px]">
            All-in-one platform for members, trainers, payments, and analytics.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {platformStats.map(({ value, label }) => (
              <div key={label} className="rounded-md p-5 bg-white/[0.04] border border-white/10">
                <div className="text-white font-black text-[26px] tracking-tighter">{value}</div>
                <div className="text-white/50 text-xs mt-0.5 uppercase tracking-wide">{label}</div>
              </div>
            ))}
          </div>
        </motion.div>

        <div className="relative z-10 text-white/30 text-xs uppercase tracking-wide">
          © 2026 ActiveBoost · Privacy · Terms
        </div>
      </div>

      {/* ── Right login panel ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center px-6 py-10 bg-secondary/30 relative">
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_60%_50%_at_70%_10%,rgba(255,77,0,0.06)_0%,transparent_60%)]" />

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-[420px] relative z-10"
        >

          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-10 h-10 rounded-md gradient-brand flex items-center justify-center">
              <Dumbbell className="w-5 h-5 text-white" />
            </div>
            <span className="font-black text-xl tracking-tight">ActiveBoost</span>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h2 className="font-black text-[32px] tracking-tighter uppercase">Welcome back</h2>
            <p className="text-muted-foreground mt-1.5 text-base">Sign in to your dashboard</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} noValidate method="post" action="#">
            <div className="mb-5">
              <label className="block font-bold text-sm mb-1.5 uppercase tracking-wide">Email address</label>
              <input {...register('email')} type="email" placeholder="you@example.com" className={inputCls} />
              {errors.email && (
                <p className="text-destructive text-xs mt-1.5 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" /> {errors.email.message}</p>
              )}
            </div>

            <div className="mb-7">
              <div className="flex justify-between items-center mb-1.5">
                <label className="font-bold text-sm uppercase tracking-wide">Password</label>
                <Link href="/forgot-password" className="text-[13px] text-primary font-bold hover:underline">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  {...register('password')}
                  type={showPass ? 'text' : 'password'}
                  placeholder="••••••••"
                  className={cn(inputCls, 'pr-12')}
                />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                  {showPass ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-destructive text-xs mt-1.5 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" /> {errors.password.message}</p>
              )}
            </div>

            <Button type="submit" loading={loading} fullWidth size="lg">
              {!loading && <>Sign in <ArrowRight className="w-[18px] h-[18px]" /></>}
              {loading && 'Signing in…'}
            </Button>
          </form>

          <div className="flex items-center gap-3 mt-6">
            <div className="flex-1 h-px bg-border" />
            <span className="text-muted-foreground text-xs uppercase tracking-wide whitespace-nowrap">or</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <Link href="/phone-login"
            className="mt-3 flex items-center justify-center gap-2 w-full h-12 rounded-md border-2 border-border bg-card font-bold text-[15px] uppercase tracking-wide hover:border-primary transition-colors no-underline">
            <Phone className="w-4 h-4" /> Sign in with Phone
          </Link>

          <p className="text-center text-[13px] text-muted-foreground mt-5 leading-relaxed">
            Access is by invitation only.<br />Contact your gym admin to get an account.
          </p>

          <div className="flex items-center gap-3 mt-5">
            <div className="flex-1 h-px bg-border" />
            <span className="text-muted-foreground text-xs uppercase tracking-wide whitespace-nowrap">Own a gym?</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <Link href="/register"
            className="mt-3 flex items-center justify-center gap-2 w-full h-12 rounded-md border-2 border-primary bg-transparent text-primary font-black text-[15px] uppercase tracking-wide hover:bg-primary/5 transition-colors no-underline">
            <Dumbbell className="w-4 h-4" /> Register your gym
          </Link>

        </motion.div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
