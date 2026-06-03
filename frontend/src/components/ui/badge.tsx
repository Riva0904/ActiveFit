import React from 'react';
import { cn } from '../../utils/helpers';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'secondary' | 'success' | 'warning' | 'danger' | 'info' | 'outline';
}

export function Badge({ variant = 'default', className, ...props }: BadgeProps) {
  const variants = {
    default:   'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    secondary: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
    success:   'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    warning:   'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    danger:    'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    info:      'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    outline:   'border border-current bg-transparent',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}

export default Badge;
