export type UserRole = 'SUPER_ADMIN' | 'GYM_ADMIN' | 'STAFF' | 'TRAINER' | 'MEMBER';

/** The gym a user belongs to, as returned by login and /auth/profile. */
export interface GymSummary {
  id: string;
  name: string;
  logo?: string | null;
  address?: string | null;
}

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  gymId?: string | null;
  /** Absent for a super admin, who belongs to no gym. */
  gym?: GymSummary | null;
  avatar?: string | null;
  phone?: string | null;
  qrCode?: string | null;
  memberCode?: string | null;
  /**
   * Which kind of STAFF this is. The backend keeps a single `Role.STAFF`, so
   * this is what decides between the front desk and the cleaning shell. Null for
   * every other role.
   */
  staffType?: 'FRONT_DESK' | 'CLEANING' | null;
  /** Present when the account has the matching profile row; handy for assignments. */
  staffId?: string | null;
  trainerId?: string | null;
}

export interface Tokens {
  accessToken: string;
  refreshToken: string;
}

export interface MemberSubscription {
  id: string;
  status: string;
  startDate: string;
  endDate: string;
  plan: {
    name: string;
    type: string;
    durationMonths: number;
  };
}

export interface MobileHomeData {
  user: AuthUser & { gym?: { id: string; name: string; logo?: string } };
  membership: MemberSubscription | null;
  memberCode: string | null;
  qrToken: string | null;
  activeWorkout: { id: string; name: string; goal?: string; difficulty?: string } | null;
  activeDiet: { id: string; name: string } | null;
  isCheckedInToday: boolean;
  checkedInAt: string | null;
  /** Sessions per week the member is aiming for, and how many days they made. */
  weeklyGoal: number;
  visitsThisWeek: number;
}

export interface TrainerHomeData {
  assignedMembersCount: number;
  sessionsToday: number;
  nextSession: {
    id: string;
    memberName: string;
    scheduledAt: string;
    durationMinutes: number;
  } | null;
  isCheckedInToday: boolean;
  checkedInAt: string | null;
  unreadNotifications: number;
}

export interface RoutePoint {
  lat: number;
  lng: number;
  /** Unix epoch seconds */
  ts: number;
}

export interface ActivityRun {
  id: string;
  startedAt: string;
  endedAt: string;
  distanceMeters: number;
  durationSec: number;
  calories: number | null;
  avgPaceSecPerKm: number | null;
  createdAt: string;
  /** Present only on /activities/runs/:id and /activities/runs/latest */
  route?: RoutePoint[];
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  content: string;
  senderId: string;
  senderName: string;
  attachmentUrl?: string;
  attachmentType?: string;
  reactions: { emoji: string; userId: string }[];
  isDeleted: boolean;
  createdAt: string;
}
