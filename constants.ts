
import { Branch, Staff } from './types';

// --- EDIT BRANCHES HERE ---
export const BRANCHES: Branch[] = [
  { id: 'br-1', name: 'London Central', location: 'Oxford Street' },
  { id: 'br-2', name: 'Manchester North', location: 'Victoria Station' },
  { id: 'br-3', name: 'Birmingham East', location: 'Bullring' },
  { id: 'br-4', name: 'Glasgow West', location: 'Byres Road' },
  { id: 'br-5', name: 'Bristol South', location: 'Temple Meads' },
];

export const CATEGORIES: ('Kitchen' | 'Counter' | 'Driver')[] = ['Kitchen', 'Counter', 'Driver'];

// --- EDIT STAFF NAMES HERE ---
const STAFF_NAMES = [
  "James Smith", "Maria Garcia", "Robert Johnson", "Patricia Williams", "Michael Brown",
  "Linda Jones", "Elizabeth Miller", "David Davis", "Barbara Rodriguez", "William Martinez",
  "Richard Hernandez", "Joseph Lopez", "Thomas Gonzalez", "Charles Wilson", "Christopher Anderson",
  "Daniel Taylor", "Matthew Thomas", "Anthony Moore", "Mark Martin", "Donald Jackson"
];

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
