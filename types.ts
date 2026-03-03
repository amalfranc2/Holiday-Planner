
export type StaffCategory = 'Kitchen' | 'Counter' | 'Driver';

export interface Branch {
  id: string;
  name: string;
  location: string;
}

export interface Staff {
  id: string;
  name: string;
  category: StaffCategory;
  branchId: string;
  totalAllowance: number; // Annual holiday allowance in days
}

export interface HolidayRequest {
  id: string;
  staffId: string;
  branchId: string;
  startDate: string; // ISO string
  endDate: string; // ISO string
  status: 'Pending' | 'Approved';
  notes?: string;
  createdAt: string; // Timestamp for priority logic
}

export interface SystemConfig {
  primeTimeMonths: number[]; // 0-11
  defaultAllowance: number;
}

export type UserRole = 'Manager' | 'HeadOffice';

export interface User {
  id: string;
  username: string;
  password: string; // In a real app, this would be hashed
  role: UserRole;
  branchId?: string; // For Managers
  name: string;
}

export interface UserContextType {
  role: UserRole;
  branchId?: string; // Only for Managers
}
