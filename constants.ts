
import { Branch, Staff } from './types';

// --- EDIT BRANCHES HERE ---
export const BRANCHES: Branch[] = [
  { id: 'br-1', name: 'London Central', location: 'Oxford Street' },
  { id: 'br-2', name: 'Manchester North', location: 'Victoria Station' },
  { id: 'br-3', name: 'Birmingham East', location: 'Bullring' },
  { id: 'br-4', name: 'Glasgow West', location: 'Byres Road' },
  { id: 'br-5', name: 'Bristol South', location: 'Temple Meads' },
];

export const CATEGORIES: ('Kitchen' | 'Counter' | 'Manager')[] = ['Kitchen', 'Counter', 'Manager'];

export const THEMES = {
  indigo: {
    50: '#eef2ff', 100: '#e0e7ff', 200: '#c7d2fe', 300: '#a5b4fc', 400: '#818cf8',
    500: '#6366f1', 600: '#4f46e5', 700: '#4338ca', 800: '#3730a3', 900: '#312e81', 950: '#1e1b4b'
  },
  emerald: {
    50: '#ecfdf5', 100: '#d1fae5', 200: '#a7f3d0', 300: '#6ee7b7', 400: '#34d399',
    500: '#10b981', 600: '#059669', 700: '#047857', 800: '#065f46', 900: '#064e3b', 950: '#022c22'
  },
  rose: {
    50: '#fff1f2', 100: '#ffe4e6', 200: '#fecdd3', 300: '#fda4af', 400: '#fb7185',
    500: '#f43f5e', 600: '#e11d48', 700: '#be123c', 800: '#9f1239', 900: '#881337', 950: '#4c0519'
  },
  amber: {
    50: '#fffbeb', 100: '#fef3c7', 200: '#fde68a', 300: '#fcd34d', 400: '#fbbf24',
    500: '#f59e0b', 600: '#d97706', 700: '#b45309', 800: '#92400e', 900: '#78350f', 950: '#451a03'
  },
  slate: {
    50: '#f8fafc', 100: '#f1f5f9', 200: '#e2e8f0', 300: '#cbd5e1', 400: '#94a3b8',
    500: '#64748b', 600: '#475569', 700: '#334155', 800: '#1e293b', 900: '#0f172a', 950: '#020617'
  }
};

// --- EDIT STAFF NAMES HERE ---
const STAFF_NAMES = [
  "James Smith", "Maria Garcia", "Robert Johnson", "Patricia Williams", "Michael Brown",
  "Linda Jones", "Elizabeth Miller", "David Davis", "Barbara Rodriguez", "William Martinez",
  "Richard Hernandez", "Joseph Lopez", "Thomas Gonzalez", "Charles Wilson", "Christopher Anderson",
  "Daniel Taylor", "Matthew Thomas", "Anthony Moore", "Mark Martin", "Donald Jackson"
];

export const DEFAULT_HEATMAP_THRESHOLDS = {
  low: 10,
  medium: 20,
  high: 30,
  critical: 45
};

// This generates mock staff for the branches defined above
export const MOCK_STAFF: Staff[] = BRANCHES.flatMap((branch, bIdx) => 
  CATEGORIES.flatMap((cat, catIdx) => 
    Array.from({ length: 2 }, (_, i) => ({
      id: `staff-${branch.id}-${cat}-${i}`,
      name: STAFF_NAMES[(bIdx * 6 + catIdx * 2 + i) % STAFF_NAMES.length],
      category: cat,
      branchId: branch.id,
      totalAllowance: 28
    }))
  )
);
