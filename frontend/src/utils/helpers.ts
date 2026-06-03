import { format, formatDistanceToNow, isValid } from 'date-fns';

export const formatDate = (date: string | Date, fmt = 'dd MMM yyyy') => {
  if (!date) return '—';
  const d = new Date(date);
  return isValid(d) ? format(d, fmt) : '—';
};

export const formatDateTime = (date: string | Date) => formatDate(date, 'dd MMM yyyy, hh:mm a');

export const timeAgo = (date: string | Date) => {
  const d = new Date(date);
  return isValid(d) ? formatDistanceToNow(d, { addSuffix: true }) : '—';
};

export const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

export const getDaysUntil = (date: string | Date) => {
  const diff = new Date(date).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

export const getRoleBadgeColor = (role: string) => {
  const colors: Record<string, string> = {
    SUPER_ADMIN: 'bg-purple-100 text-purple-800',
    GYM_ADMIN: 'bg-blue-100 text-blue-800',
    STAFF: 'bg-green-100 text-green-800',
    TRAINER: 'bg-orange-100 text-orange-800',
    MEMBER: 'bg-gray-100 text-gray-800',
  };
  return colors[role] || 'bg-gray-100 text-gray-800';
};

export const getStatusBadgeColor = (status: string) => {
  const colors: Record<string, string> = {
    ACTIVE: 'bg-green-100 text-green-800',
    EXPIRED: 'bg-red-100 text-red-800',
    PENDING: 'bg-yellow-100 text-yellow-800',
    CANCELLED: 'bg-gray-100 text-gray-800',
    SUSPENDED: 'bg-red-100 text-red-800',
    COMPLETED: 'bg-green-100 text-green-800',
    FAILED: 'bg-red-100 text-red-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
};

export const cn = (...classes: (string | undefined | false)[]) => classes.filter(Boolean).join(' ');

export const getDashboardPath = (role: string) => {
  const paths: Record<string, string> = {
    SUPER_ADMIN: '/super-admin',
    GYM_ADMIN: '/admin',
    STAFF: '/staff',
    TRAINER: '/trainer',
    MEMBER: '/member',
  };
  return paths[role] || '/login';
};
