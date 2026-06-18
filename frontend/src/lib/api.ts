import axios, { AxiosRequestConfig } from 'axios';
import toast from 'react-hot-toast';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

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
      toast.error(Array.isArray(message) ? message[0] : message);
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
  update: (id: string, data: any) => api.patch(`/gyms/${id}`, data),
  updateStatus: (id: string, status: string) => api.patch(`/gyms/${id}/status`, { status }),
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
};

// Supplements
export const supplementsApi = {
  getAll: (params?: any) => api.get('/supplements', { params }),
  getOne: (id: string) => api.get(`/supplements/${id}`),
  create: (data: any) => api.post('/supplements', data),
  update: (id: string, data: any) => api.patch(`/supplements/${id}`, data),
  delete: (id: string) => api.delete(`/supplements/${id}`),
  updateStock: (id: string, quantity: number) => api.patch(`/supplements/${id}/stock`, { quantity }),
  createOrder: (items: any[]) => api.post('/supplements/order', { items }),
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
  buyPackage: (id: string) => api.post(`/workout-plans/packages/${id}/buy`),
};

// Diet Plans
export const dietPlansApi = {
  getMyPlans: () => api.get('/diet-plans/my'),
  generateAi: (data: any) => api.post('/diet-plans/ai-generate', data),
  getPackages: () => api.get('/diet-plans/packages'),
  createPackage: (data: any) => api.post('/diet-plans/packages', data),
  updatePackage: (id: string, data: any) => api.patch(`/diet-plans/packages/${id}`, data),
  buyPackage: (id: string) => api.post(`/diet-plans/packages/${id}/buy`),
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
  // Non-admin GYM chat
  getMyConversation: () => api.get('/chat/my-conversation'),
  getMyMessages: (skip = 0) => api.get('/chat/my-messages', { params: { skip } }),
  markMyRead: () => api.patch('/chat/my-conversation/read'),
  // GymAdmin GYM chat
  getAllConversations: () => api.get('/chat/conversations'),
  getConversationMessages: (userId: string, skip = 0) => api.get(`/chat/conversations/${userId}/messages`, { params: { skip } }),
  markConversationRead: (userId: string) => api.patch(`/chat/conversations/${userId}/read`),
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
