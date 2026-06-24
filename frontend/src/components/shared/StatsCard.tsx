'use client';

import { cn, formatCurrency } from '@/lib/utils';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

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

// Solid accent (not a gradient fill) — icon chip + left border color. Key names kept
// stable since other pages already pass gradient="blue"/"purple"/etc.
const gradientConfig: Record<string, { accent: string }> = {
  blue:   { accent: '#00D9FF' },
  green:  { accent: '#10b981' },
  orange: { accent: '#FF4D00' },
  purple: { accent: '#8b5cf6' },
  rose:   { accent: '#FF0033' },
  teal:   { accent: '#14b8a6' },
  indigo: { accent: '#6366f1' },
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
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      style={{ '--accent': config.accent } as React.CSSProperties}
      className={cn('stats-card group', className)}
    >
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-4">
          <div className="stats-card-icon-chip w-11 h-11 rounded-md flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-105">
            <Icon className="w-5 h-5" />
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

        <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>

        {/* Animated counter value */}
        <p className="stat-number text-3xl font-black text-foreground mt-1 tabular-nums">
          {displayValue}
        </p>

        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
            {subtitle}
          </p>
        )}
      </div>
    </motion.div>
  );
}

export default StatsCard;
