'use client';

import { cn, formatCurrency } from '@/lib/utils';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  gradient?: string;
  isCurrency?: boolean;
  color?: 'orange' | 'blue' | 'green' | 'purple' | 'red';
  trend?: { value: number; label?: string };
  className?: string;
}

const gradientConfig: Record<string, { cls: string; orb: string; hoverBorder: string }> = {
  blue:   { cls: 'gradient-blue shadow-blue',     orb: '#3b82f6', hoverBorder: 'hover:border-blue-200 dark:hover:border-blue-800/50' },
  green:  { cls: 'gradient-green shadow-green',   orb: '#10b981', hoverBorder: 'hover:border-green-200 dark:hover:border-green-800/50' },
  orange: { cls: 'gradient-brand shadow-brand',   orb: '#f97316', hoverBorder: 'hover:border-orange-200 dark:hover:border-orange-800/50' },
  purple: { cls: 'gradient-purple shadow-purple', orb: '#8b5cf6', hoverBorder: 'hover:border-purple-200 dark:hover:border-purple-800/50' },
  rose:   { cls: 'gradient-rose shadow-rose',     orb: '#f43f5e', hoverBorder: 'hover:border-rose-200 dark:hover:border-rose-800/50' },
  teal:   { cls: 'gradient-teal shadow-teal',     orb: '#14b8a6', hoverBorder: 'hover:border-teal-200 dark:hover:border-teal-800/50' },
  indigo: { cls: 'gradient-indigo shadow-violet', orb: '#6366f1', hoverBorder: 'hover:border-indigo-200 dark:hover:border-indigo-800/50' },
};

function useCountUp(target: number, enabled: boolean, duration = 1100) {
  const [count, setCount] = useState(0);
  const rafRef = useRef<number>();

  useEffect(() => {
    if (!enabled) { setCount(target); return; }
    if (target <= 0) { setCount(0); return; }
    let startTime: number | null = null;

    const animate = (ts: number) => {
      if (!startTime) startTime = ts;
      const progress = Math.min((ts - startTime) / duration, 1);
      // easeOutQuart for a satisfying deceleration
      const eased = 1 - Math.pow(1 - progress, 4);
      setCount(Math.round(target * eased));
      if (progress < 1) rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [target, enabled, duration]);

  return count;
}

export function StatsCard({
  title, value, subtitle, icon: Icon,
  gradient = 'orange', isCurrency, trend, className,
}: StatsCardProps) {
  const config = gradientConfig[gradient] ?? gradientConfig.orange;
  const isUp = (trend?.value ?? 0) >= 0;

  const numericValue = typeof value === 'number' ? value : parseFloat(String(value));
  const isAnimatable = !isNaN(numericValue) && isFinite(numericValue) && numericValue >= 0;
  const count = useCountUp(isAnimatable ? numericValue : 0, isAnimatable);
  const displayValue = isAnimatable
    ? (isCurrency ? formatCurrency(count) : String(count))
    : String(value);

  return (
    <div className={cn('stats-card group', config.hoverBorder, className)}>
      {/* Beam sweep element (CSS handles the animation via .card-beam::after) */}
      <div className="card-beam" />

      {/* Decorative background orb — grows on hover */}
      <div
        className="absolute -top-12 -right-12 w-40 h-40 rounded-full pointer-events-none transition-all duration-700 ease-out opacity-[0.065] group-hover:opacity-[0.16] group-hover:scale-110"
        style={{ background: config.orb }}
      />

      {/* Second smaller orb at bottom-left for depth */}
      <div
        className="absolute -bottom-8 -left-8 w-24 h-24 rounded-full pointer-events-none opacity-[0.04] group-hover:opacity-[0.09] transition-all duration-700"
        style={{ background: config.orb }}
      />

      <div className="relative z-10">
        <div className="flex items-start justify-between mb-4">
          <div className={cn('stats-card-icon transition-all duration-300', config.cls)}>
            <Icon className="w-5 h-5 text-white" />
          </div>
          {trend && (
            <span className={cn('trend-badge', isUp ? 'trend-up' : 'trend-down')}>
              {isUp
                ? <TrendingUp className="w-3 h-3" />
                : <TrendingDown className="w-3 h-3" />}
              {isUp ? '+' : ''}{trend.value}%
            </span>
          )}
        </div>

        <p className="text-sm font-medium text-muted-foreground">{title}</p>

        {/* Animated counter value */}
        <p className="stat-number text-3xl text-foreground mt-1 animate-number-pop tabular-nums">
          {displayValue}
        </p>

        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}

export default StatsCard;
