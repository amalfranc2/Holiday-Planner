
export type StaffCategory = 'Kitchen' | 'Counter' | 'Manager';

export interface Branch {
  id: string;
  name: string;
  location: string;
  showDashboardToStaff?: boolean;
}

export interface Staff {
  id: string;
  name: string;
  category: StaffCategory;
  branchId: string;
  totalAllowance: number; // Annual holiday allowance in days
  email?: string;
}

export interface HolidayRequest {
  id: string;
  staffId: string;
  branchId: string;
  startDate: string; // ISO string
  endDate: string; // ISO string
  status: 'Pending' | 'Approved' | 'Rejected' | 'Withdrawn';
  notes?: string;
  createdAt: string; // Timestamp for priority logic
  attachmentUrl?: string;
  attachmentId?: string;
  isUrgent?: boolean;
  isStaffRequest?: boolean;
}

export interface SystemConfig {
  primeTimeMonths: number[]; // 0-11
  defaultAllowance: number;
  heatmapThresholds: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
}

export type UserRole = 'Manager' | 'ADMIN' | 'S-ADMIN' | 'Staff';

export interface User {
  id: string;
  username: string;
  password: string; // In a real app, this would be hashed
  role: UserRole;
  branchId?: string; // For Managers
  name: string;
  email?: string;
  receiveNotifications?: boolean;
  themeColor?: string;
  defaultView?: 'Dashboard' | 'Yearly';
  bubbleStyle?: 'classic' | 'arc';
  showBubble?: boolean;
  smoothScroll?: boolean;
  showDashboardInfoTiles?: boolean;
  chartPreferences?: {
    availabilitySummary?: boolean;
    pendingRequests?: boolean;
    approvedRequests?: boolean;
    categoryDistribution?: boolean;
    branchVolume?: boolean;
    riskHeatmap?: boolean;
  };
}

export interface UserContextType {
  role: UserRole;
  branchId?: string; // Only for Managers
}

export interface SystemLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'CONFIG_CHANGE' | 'SYSTEM';
  tableName?: string;
  recordId?: string;
  oldData?: any;
  newData?: any;
  details?: string;
}
