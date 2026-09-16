import axios, { AxiosRequestConfig } from 'axios';
import toast from 'react-hot-toast';

export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

// withCredentials ensures the httpOnly auth cookie is sent on every request
const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

let isRefreshing = false;

api.interceptors.response.use(
  (res) => res.data,
  async (err) => {
    const original = err.config;
    const message = err.response?.data?.message ?? 'Something went wrong';

    if (err.response?.status === 401 && !original._retry) {
      original._retry = true;
      if (!isRefreshing) {
        isRefreshing = true;
        try {
          await axios.post(`${API_BASE}/auth/refresh`, {}, { withCredentials: true });
          isRefreshing = false;
          return api(original);
        } catch {
          isRefreshing = false;
          window.location.href = '/login';
          return Promise.reject(err);
        }
      }
    }

    if (err.response?.status !== 401 && err.response?.status !== 404) {
      // Dedupe by status: identical/repeat errors (e.g. a 429 burst from several
      // parallel widget fetches) replace the existing toast instead of stacking unbounded.
      toast.error(Array.isArray(message) ? message[0] : message, { id: `api-error-${err.response?.status}` });
    }
    return Promise.reject(err);
  },
);

// Auth
export const authApi = {
  login: (data: { email: string; password: string }) => api.post('/auth/login', data),
  register: (data: any) => api.post('/auth/register', data),
  registerGym: (data: any) => api.post('/auth/register-gym', data),
  profile: () => api.get('/auth/profile'),
  getSocketToken: () => api.get('/auth/socket-token'),
  logout: () => api.post('/auth/logout', {}),
  refresh: () => axios.post(`${API_BASE}/auth/refresh`, {}, { withCredentials: true }),
  changePassword: (data: any) => api.patch('/auth/change-password', data),
  phoneLogin: (data: { idToken: string; phone: string }) => api.post('/auth/phone-login', data),
  sendOtp: (email: string, name?: string) => api.post('/auth/otp/send', { email, name }),
  checkOtp: (email: string, otp: string) => api.post('/auth/otp/check', { email, otp }),
};

// Users
export const usersApi = {
  create: (data: any) => api.post('/users', data),
  getAll: (params?: any) => api.get('/users', { params }),
  getMe: () => api.get('/users/me'),
  getOne: (id: string) => api.get(`/users/${id}`),
  update: (id: string, data: any) => api.patch(`/users/${id}`, data),
  updateMe: (data: any) => api.patch('/users/me', data),
  getStats: (params?: any) => api.get('/users/stats', { params }),
  getMemberGrowth: (params?: any) => api.get('/users/stats/growth', { params }),
  deactivate: (id: string) => api.patch(`/users/${id}/deactivate`),
  activate: (id: string) => api.patch(`/users/${id}/activate`),
  remove: (id: string) => api.delete(`/users/${id}`),
  getAtRisk: (params?: { days?: number }) => api.get('/users/at-risk', { params }),
  sendWinback: (memberId: string) => api.post(`/users/${memberId}/send-winback`),
};

// Gyms
export const gymsApi = {
  getAll: (params?: any) => api.get('/gyms', { params }),
  getOne: (id: string) => api.get(`/gyms/${id}`),
  getStats: (id: string) => api.get(`/gyms/${id}/stats`),
  create: (data: any) => api.post('/gyms', data),
  // Profile fields only — the backend rejects saasPlan/maxMembers/slug here.
  update: (id: string, data: any) => api.patch(`/gyms/${id}`, data),
  // Super admin: profile + status/maxMembers/slug.
  updateAsAdmin: (id: string, data: any) => api.patch(`/gyms/${id}/admin`, data),
  updateStatus: (id: string, status: string) => api.patch(`/gyms/${id}/status`, { status }),
  // The only sanctioned way to change a gym's tier (super admin, audited).
  setPlan: (id: string, plan: string, extra?: { status?: string; expiresAt?: string; reason?: string }) =>
    api.patch(`/gyms/${id}/subscription-plan`, { plan, ...extra }),
  remove: (id: string) => api.delete(`/gyms/${id}`),
};

// Memberships
export const membershipsApi = {
  getAll: (params?: any) => api.get('/memberships', { params }),
  getOne: (id: string) => api.get(`/memberships/${id}`),
  create: (data: any) => api.post('/memberships', data),
  update: (id: string, data: any) => api.patch(`/memberships/${id}`, data),
  renew: (id: string) => api.patch(`/memberships/${id}/renew`),
  getExpiring: (params?: any) => api.get('/memberships/expiring', { params }),
};

// Membership Plans
export const membershipPlansApi = {
  getAll: () => api.get('/memberships/plans'),
  getOne: (id: string) => api.get(`/memberships/plans/${id}`),
  create: (data: any) => api.post('/memberships/plans', data),
  update: (id: string, data: any) => api.patch(`/memberships/plans/${id}`, data),
  remove: (id: string) => api.delete(`/memberships/plans/${id}`),
};

// Attendance
export const attendanceApi = {
  getAll: (params?: any) => api.get('/attendance', { params }),
  checkIn: () => api.post('/attendance/check-in'),
  qrCheckIn: (qrCode: string) => api.post('/attendance/qr-check-in', { qrCode }),
  checkOut: (id: string) => api.patch(`/attendance/${id}/check-out`),
  getTodayStats: () => api.get('/attendance/stats/today'),
  getWeeklyReport: () => api.get('/attendance/stats/weekly'),
  getMyAttendance: (params?: any) => api.get('/attendance/my', { params }),
  selfCheckIn: () => api.post('/attendance/self-check-in'),
  getMyStatus: () => api.get('/attendance/my-status'),
  adminManualCheckIn: (code: string) => api.post('/attendance/admin-manual-check-in', { code }),
  // Smart QR flow — explicit (non-toggle) member check-in/check-out
  smartCheckIn: () => api.post('/attendance/check-in'),
  smartCheckOut: () => api.post('/attendance/check-out'),
  getStatus: () => api.get('/attendance/status'),
  getHistory: (params?: any) => api.get('/attendance/history', { params }),
  manualCheckIn: (code: string) => api.post('/attendance/manual-check-in', { code }),
  manualCheckOut: (code: string) => api.post('/attendance/manual-check-out', { code }),
  getOccupancy: () => api.get('/attendance/occupancy'),
  getAnalytics: () => api.get('/attendance/analytics'),
  // Attendance Intelligence V2
  getStreak: () => api.get('/attendance/streak'),
  getInactiveMembers: () => api.get('/attendance/inactive-members'),
  getCalendar: (month: number, year: number) => api.get('/attendance/calendar', { params: { month, year } }),
  getOccupancyTrend: () => api.get('/attendance/occupancy-trend'),
  getLeaderboard: () => api.get('/attendance/leaderboard'),
  getMyInsights: () => api.get('/attendance/my-insights'),
  exportUrl: (format: 'csv' | 'excel' | 'pdf', filters?: Record<string, string>) => {
    const params = new URLSearchParams(filters ?? {}).toString();
    return `${API_BASE}/attendance/export/${format}${params ? `?${params}` : ''}`;
  },
};

// Trainers
export const trainersApi = {
  getAll: (params?: any) => api.get('/trainers', { params }),
  getOne: (id: string) => api.get(`/trainers/${id}`),
  create: (data: any) => api.post('/trainers', data),
  update: (id: string, data: any) => api.patch(`/trainers/${id}`, data),
  remove: (id: string) => api.delete(`/trainers/${id}`),
  assignClient: (id: string, clientId: string) => api.post(`/trainers/${id}/assign`, { memberId: clientId }),
  getPerformance: () => api.get('/trainers/performance'),
  getMyDashboard: () => api.get('/trainers/my-dashboard'),
};

// PT Sessions
export const ptSessionsApi = {
  getAll: (params?: any) => api.get('/pt-sessions', { params }),
  getAdminStats: () => api.get('/pt-sessions/admin-stats'),
  getStats: () => api.get('/pt-sessions/stats'),
  getAssignedMembers: () => api.get('/pt-sessions/assigned-members'),
  getAvailableTrainers: () => api.get('/pt-sessions/available-trainers'),
  book: (data: any) => api.post('/pt-sessions/book', data),
  create: (data: any) => api.post('/pt-sessions', data),
  update: (id: string, data: any) => api.patch(`/pt-sessions/${id}`, data),
  complete: (id: string, data: { feedback?: string; rating?: number }) => api.patch(`/pt-sessions/${id}/complete`, data),
  cancel: (id: string) => api.patch(`/pt-sessions/${id}/cancel`),
  delete: (id: string) => api.delete(`/pt-sessions/${id}`),
};

// Payments
export const paymentsApi = {
  getAll: (params?: any) => api.get('/payments', { params }),
  getMyPayments: (params?: any) => api.get('/payments/my', { params }),
  getStats: () => api.get('/payments/stats'),
  getMonthlyStats: () => api.get('/payments/stats/monthly'),
  createOrder: (data: any) => api.post('/payments/create-order', data),
  verify: (data: any) => api.post('/payments/verify', data),
  recordCash: (data: any) => api.post('/payments/cash', data),
  markPaid: (paymentId: string) => api.post(`/payments/${paymentId}/mark-paid`),
  getPendingManualUpi: () => api.get('/payments/manual-upi/pending'),
  confirmManualUpi: (paymentId: string) => api.post(`/payments/${paymentId}/confirm-upi`),
};

// Gym SaaS subscription (gym admin buys a pack; super admin confirms the UPI transfer)
export const gymSubscriptionsApi = {
  plans: () => api.get('/gym-subscriptions/plans'),
  me: () => api.get('/gym-subscriptions/me'),
  history: () => api.get('/gym-subscriptions/history'),
  requests: () => api.get('/gym-subscriptions/requests'),
  request: (planId: string, billingPeriod: 'MONTHLY' | 'YEARLY') =>
    api.post('/gym-subscriptions/request', { planId, billingPeriod }),
  markPaid: (id: string, data: { upiReference?: string; notes?: string }) =>
    api.post(`/gym-subscriptions/requests/${id}/mark-paid`, data),
  cancelRequest: (id: string) => api.post(`/gym-subscriptions/requests/${id}/cancel`),
};

export const adminGymSubscriptionsApi = {
  pending: () => api.get('/admin/gym-subscriptions/pending'),
  requests: (params?: any) => api.get('/admin/gym-subscriptions/requests', { params }),
  list: (params?: any) => api.get('/admin/gym-subscriptions', { params }),
  confirm: (id: string, data?: { bankReference?: string; notes?: string }) =>
    api.post(`/admin/gym-subscriptions/requests/${id}/confirm`, data ?? {}),
  reject: (id: string, reason: string) => api.post(`/admin/gym-subscriptions/requests/${id}/reject`, { reason }),
  grant: (gymId: string, data: { planId: string; billingPeriod: string; months?: number; reason: string }) =>
    api.post(`/admin/gym-subscriptions/gyms/${gymId}/grant`, data),
  cancel: (id: string, data: { reason: string; immediate?: boolean }) =>
    api.post(`/admin/gym-subscriptions/${id}/cancel`, data),
  runExpiry: () => api.post('/admin/gym-subscriptions/run-expiry'),
};

export const platformSettingsApi = {
  get: () => api.get('/platform-settings'),
  update: (data: any) => api.patch('/platform-settings', data),
};

// Salary Payouts (gym admin -> trainer/staff, manual transfer + record only)
export const salaryPayoutsApi = {
  create: (data: { userId: string; amount: number; periodLabel: string; notes?: string }) => api.post('/salary-payouts', data),
  // One run, many people, an amount each.
  createBatch: (data: { periodLabel: string; notes?: string; items: { userId: string; amount: number }[] }) =>
    api.post('/salary-payouts/batch', data),
  markManyPaid: (ids: string[]) => api.patch('/salary-payouts/mark-paid', { ids }),
  getAll: (params?: any) => api.get('/salary-payouts', { params }),
  getMine: () => api.get('/salary-payouts/my'),
  markPaid: (id: string) => api.patch(`/salary-payouts/${id}/mark-paid`),
};

// Supplements
export const supplementsApi = {
  getAll: (params?: any) => api.get('/supplements', { params }),
  getOne: (id: string) => api.get(`/supplements/${id}`),
  create: (data: any) => api.post('/supplements', data),
  update: (id: string, data: any) => api.patch(`/supplements/${id}`, data),
  delete: (id: string) => api.delete(`/supplements/${id}`),
  updateStock: (id: string, quantity: number) => api.patch(`/supplements/${id}/stock`, { quantity }),
  createCheckout: (items: any[], useUpi = false) => api.post('/supplements/checkout', { items, useUpi }),
  getOrders: (params?: any) => api.get('/supplements/orders', { params }),
  updateOrderStatus: (orderId: string, status: string) =>
    api.patch(`/supplements/orders/${orderId}/status`, { status }),
};

// Workout Plans
export const workoutPlansApi = {
  getMyPlans: () => api.get('/workout-plans/my'),
  create: (data: any) => api.post('/workout-plans', data),
  update: (id: string, data: any) => api.patch(`/workout-plans/${id}`, data),
  generateAi: (data: any) => api.post('/workout-plans/ai-generate', data),
  getPackages: () => api.get('/workout-plans/packages'),
  createPackage: (data: any) => api.post('/workout-plans/packages', data),
  updatePackage: (id: string, data: any) => api.patch(`/workout-plans/packages/${id}`, data),
  buyPackage: (id: string, useUpi = false) => api.post(`/workout-plans/packages/${id}/buy`, { useUpi }),
  // Builder + assignment (gym admin / trainer)
  listAll: (params?: any) => api.get('/workout-plans/manage/all', { params }),
  updatePlan: (id: string, data: any) => api.patch(`/workout-plans/manage/${id}`, data),
  remove: (id: string) => api.delete(`/workout-plans/manage/${id}`),
  assign: (id: string, memberIds: string[]) => api.post(`/workout-plans/${id}/assign`, { memberIds }),
  assignments: (id: string) => api.get(`/workout-plans/${id}/assignments`),
  unassign: (assignmentId: string) => api.delete(`/workout-plans/assignments/${assignmentId}`),
};

// Diet Plans
export const dietPlansApi = {
  getMyPlans: () => api.get('/diet-plans/my'),
  generateAi: (data: any) => api.post('/diet-plans/ai-generate', data),
  getPackages: () => api.get('/diet-plans/packages'),
  createPackage: (data: any) => api.post('/diet-plans/packages', data),
  updatePackage: (id: string, data: any) => api.patch(`/diet-plans/packages/${id}`, data),
  buyPackage: (id: string, useUpi = false) => api.post(`/diet-plans/packages/${id}/buy`, { useUpi }),
  // Builder + assignment (gym admin / trainer)
  listAll: (params?: any) => api.get('/diet-plans/manage/all', { params }),
  updatePlan: (id: string, data: any) => api.patch(`/diet-plans/manage/${id}`, data),
  remove: (id: string) => api.delete(`/diet-plans/manage/${id}`),
  assign: (id: string, memberIds: string[]) => api.post(`/diet-plans/${id}/assign`, { memberIds }),
  assignments: (id: string) => api.get(`/diet-plans/${id}/assignments`),
  unassign: (assignmentId: string) => api.delete(`/diet-plans/assignments/${assignmentId}`),
};

// Notifications
export const notificationsApi = {
  getAll: () => api.get('/notifications'),
  getUnreadCount: () => api.get('/notifications/unread-count'),
  markAsRead: (id: string) => api.patch(`/notifications/${id}/read`),
  markAllAsRead: () => api.patch('/notifications/read-all'),
  broadcast: (data: any) => api.post('/notifications/broadcast', data),
};

// Chat — NestJS returns raw arrays/objects (no {success,data} wrapper)
export const chatApi = {
  // Direct messages — private 1:1 threads inside one gym. There is no
  // gym-wide inbox: a thread is only readable by the two people on it.
  getContacts: (search?: string) => api.get('/chat/contacts', { params: search ? { search } : {} }),
  getThreads: () => api.get('/chat/threads'),
  openThread: (peerId: string) => api.get(`/chat/threads/${peerId}`),
  getThreadMessages: (peerId: string, skip = 0) => api.get(`/chat/threads/${peerId}/messages`, { params: { skip } }),
  markThreadRead: (peerId: string) => api.patch(`/chat/threads/${peerId}/read`),
  getUnreadCount: () => api.get('/chat/unread-count'),
  // GymAdmin ↔ SuperAdmin support chat
  getSupportConversation: () => api.get('/chat/support/conversation'),
  getSupportMessages: (skip = 0) => api.get('/chat/support/messages', { params: { skip } }),
  markSupportRead: () => api.patch('/chat/support/read'),
  // SuperAdmin support chat
  getAllSupportConversations: () => api.get('/chat/support/conversations'),
  getAdminSupportMessages: (gymAdminId: string, gymId: string, skip = 0) =>
    api.get(`/chat/support/conversations/${gymAdminId}/messages`, { params: { gymId, skip } }),
  markAdminSupportRead: (gymAdminId: string, gymId: string) =>
    api.patch(`/chat/support/conversations/${gymAdminId}/read`, null, { params: { gymId } }),
  uploadFile: async (file: File) => {
    const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${base}/chat/upload`, {
      method: 'POST',
      credentials: 'include',
      body: form,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw Object.assign(new Error(err.message ?? 'Upload failed'), { response: { data: err } });
    }
    return res.json();
  },
};

// Progress Logs
export const progressApi = {
  getMyLogs: () => api.get('/progress-logs/my'),
  create: (data: any) => api.post('/progress-logs', data),
};

// Expenses
export const expensesApi = {
  getAll: (params?: any) => api.get('/expenses', { params }),
  create: (data: any) => api.post('/expenses', data),
  update: (id: string, data: any) => api.put(`/expenses/${id}`, data),
  remove: (id: string) => api.delete(`/expenses/${id}`),
  getMonthlyTotals: (year?: number) => api.get('/expenses/monthly-totals', { params: { year } }),
  getAuditReport: (month: number, year: number) =>
    api.get('/expenses/audit', { params: { month, year } }),
};

// Staffs
export const staffsApi = {
  getAll: (params?: any) => api.get('/staffs', { params }),
  getOne: (id: string) => api.get(`/staffs/${id}`),
  create: (data: any) => api.post('/staffs', data),
  update: (id: string, data: any) => api.patch(`/staffs/${id}`, data),
  remove: (id: string) => api.delete(`/staffs/${id}`),
  getMyProfile: () => api.get('/staffs/me'),
};

// Leave Requests
export const leavesApi = {
  apply: (data: { leaveType: string; startDate: string; endDate: string; reason: string }) =>
    api.post('/leave-requests', data),
  getMyLeaves: (params?: any) => api.get('/leave-requests/my', { params }),
  getAll: (params?: any) => api.get('/leave-requests', { params }),
  approve: (id: string, adminNote?: string) => api.patch(`/leave-requests/${id}/approve`, { adminNote }),
  reject: (id: string, adminNote?: string) => api.patch(`/leave-requests/${id}/reject`, { adminNote }),
};

// Invoices
export const invoicesApi = {
  getAll: (params?: any) => api.get('/invoices', { params }),
  getOne: (id: string) => api.get(`/invoices/${id}`),
  getMyInvoices: () => api.get('/invoices/my'),
  create: (data: any) => api.post('/invoices', data),
  updateStatus: (id: string, status: string) => api.patch(`/invoices/${id}/status`, { status }),
};

export const enquiriesApi = {
  getAll: (params?: any) => api.get('/enquiries', { params }),
  getKanbanStats: () => api.get('/enquiries/kanban-stats'),
  getOne: (id: string) => api.get(`/enquiries/${id}`),
  create: (data: any) => api.post('/enquiries', data),
  update: (id: string, data: any) => api.patch(`/enquiries/${id}`, data),
  convert: (id: string, data?: { userId?: string }) => api.patch(`/enquiries/${id}/convert`, data ?? {}),
  remove: (id: string) => api.delete(`/enquiries/${id}`),
};

export const referralsApi = {
  getMyInfo: () => api.get('/referrals/my'),
  getAdminChain: (memberId: string) => api.get(`/referrals/admin/${memberId}`),
};

export const promoCodesApi = {
  getAll: () => api.get('/promo-codes'),
  getOne: (id: string) => api.get(`/promo-codes/${id}`),
  create: (data: any) => api.post('/promo-codes', data),
  update: (id: string, data: any) => api.patch(`/promo-codes/${id}`, data),
  remove: (id: string) => api.delete(`/promo-codes/${id}`),
  validate: (code: string, amount?: number) => api.post('/promo-codes/validate', { code, amount }),
};

export const saasPlansApi = {
  getAll: () => api.get('/saas-plans'),
  init: () => api.post('/saas-plans/init'),
  update: (id: string, data: any) => api.patch(`/saas-plans/${id}`, data),
  getRevenue: () => api.get('/saas-plans/revenue'),
};

export const renewalRemindersApi = {
  preview: () => api.get('/renewal-reminders/preview'),
  sendNow: () => api.post('/renewal-reminders/send-now'),
};

export default api;
