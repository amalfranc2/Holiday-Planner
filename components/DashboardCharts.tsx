
import React, { useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell, Sector
} from 'recharts';
import { HolidayRequest, Staff, Branch, SystemConfig, StaffCategory, User } from '../types';
import { THEMES, DEFAULT_HEATMAP_THRESHOLDS } from '../constants';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface DashboardChartsProps {
  requests: HolidayRequest[];
  branches: Branch[];
  staff: Staff[];
  systemConfig: SystemConfig;
  currentBranchId: string;
  dashboardFilter: 'year' | 'upcoming';
  onRequestClick: (e: React.MouseEvent, req: HolidayRequest) => void;
  currentUser: User;
}

const DashboardCharts: React.FC<DashboardChartsProps> = ({
  requests,
  branches,
  staff,
  systemConfig,
  currentBranchId,
  dashboardFilter,
  onRequestClick,
  currentUser
}) => {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();
  const [selectedMonthOffset, setSelectedMonthOffset] = React.useState(0);

  const thresholds = systemConfig?.heatmapThresholds || DEFAULT_HEATMAP_THRESHOLDS;
  const prefs = currentUser.chartPreferences || {};

  const targetDate = new Date(currentYear, currentMonth + selectedMonthOffset, 1);
  const targetMonth = targetDate.getMonth();
  const targetYear = targetDate.getFullYear();

  // 1. Data for Branch Status Stacked Bar Chart
  const branchData = useMemo(() => {
    return branches.map(branch => {
      const branchStaff = staff.filter(s => s.branchId === branch.id);
      const branchRequests = requests.filter(r => 
        r.branchId === branch.id && 
        new Date(r.startDate).getFullYear() === targetYear
      );

      // Count unique staff away today (or just total requests for simplicity in this view)
      // Actually, let's show "Total Requests" vs "Branch Capacity"
      const approved = branchRequests.filter(r => r.status === 'Approved').length;
      const pending = branchRequests.filter(r => r.status === 'Pending').length;
      const capacity = branchStaff.length;

      return {
        name: branch.name,
        approved,
        pending,
        capacity: Math.max(0, capacity - approved - pending),
        totalStaff: capacity
      };
    }).filter(b => currentBranchId === 'all' || b.name === branches.find(br => br.id === currentBranchId)?.name);
  }, [branches, staff, requests, targetYear, currentBranchId]);

  // 2. Data for Category Donut Chart (Inner and Outer Rings)
  const categoryData = useMemo(() => {
    const counts: Record<StaffCategory, { approved: number; pending: number }> = {
      'Kitchen': { approved: 0, pending: 0 },
      'Counter': { approved: 0, pending: 0 },
      'Manager': { approved: 0, pending: 0 }
    };

    requests
      .filter(r => 
        (currentBranchId === 'all' || r.branchId === currentBranchId) &&
        new Date(r.startDate).getFullYear() === targetYear
      )
      .forEach(r => {
        const s = staff.find(st => st.id === r.staffId);
        if (s && counts[s.category]) {
          if (r.status === 'Approved') counts[s.category].approved++;
          if (r.status === 'Pending') counts[s.category].pending++;
        }
      });

    const inner = Object.entries(counts).map(([name, val]) => ({
      name,
      value: val.approved + val.pending,
      approved: val.approved,
      pending: val.pending
    })).filter(item => item.value > 0);

    const outer = inner.flatMap(cat => [
      { 
        name: `${cat.name} Approved`, 
        value: cat.approved, 
        parent: cat.name as StaffCategory, 
        status: 'Approved' 
      },
      { 
        name: `${cat.name} Pending`, 
        value: cat.pending, 
        parent: cat.name as StaffCategory, 
        status: 'Pending' 
      }
    ]).filter(item => item.value > 0);

    return { inner, outer };
  }, [requests, staff, currentBranchId, targetYear]);

  // 3. Data for Monthly Tightness Heatmap
  const heatmapData = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => i);
    const displayBranches = currentBranchId === 'all' 
      ? branches 
      : branches.filter(b => b.id === currentBranchId);

    return displayBranches.map(branch => {
      const branchStaff = staff.filter(s => s.branchId === branch.id);
      const totalStaff = branchStaff.length || 1; // Avoid division by zero

      const monthStats = months.map(month => {
        // Count how many staff have at least one approved day in this month
        const staffAway = new Set();
        requests.forEach(r => {
          if (r.branchId === branch.id && r.status === 'Approved') {
            const start = new Date(r.startDate);
            const end = new Date(r.endDate);
            // Check if request overlaps with this month
            if (
              (start.getMonth() <= month && end.getMonth() >= month) &&
              (start.getFullYear() === currentYear || end.getFullYear() === currentYear)
            ) {
              staffAway.add(r.staffId);
            }
          }
        });

        const percentageAway = (staffAway.size / totalStaff) * 100;
        
        let riskLevel: 'low' | 'medium' | 'high' | 'critical' | 'none' = 'none';
        if (percentageAway >= thresholds.critical) riskLevel = 'critical';
        else if (percentageAway >= thresholds.high) riskLevel = 'high';
        else if (percentageAway >= thresholds.medium) riskLevel = 'medium';
        else if (percentageAway >= thresholds.low) riskLevel = 'low';

        return {
          month,
          percentageAway,
          riskLevel,
          count: staffAway.size
        };
      });

      return {
        branchName: branch.name,
        branchId: branch.id,
        months: monthStats
      };
    });
  }, [branches, staff, requests, currentYear, currentBranchId, thresholds]);

  const COLORS = {
    Kitchen: '#f97316', // orange-500
    Counter: '#3b82f6', // blue-500
    Manager: '#a855f7'  // purple-500
  };

  // 4. Data for Summary Tiles (Current/Selected Month)
  const summaryHeatmapData = useMemo(() => {
    const displayBranches = currentBranchId === 'all' 
      ? branches 
      : branches.filter(b => b.id === currentBranchId);

    return displayBranches.map(branch => {
      const branchStaff = staff.filter(s => s.branchId === branch.id);
      const totalStaff = branchStaff.length || 1;

      const staffAway = new Set();
      requests.forEach(r => {
        if (r.branchId === branch.id && r.status === 'Approved') {
          const start = new Date(r.startDate);
          const end = new Date(r.endDate);
          
          if (
            (start.getMonth() <= targetMonth && end.getMonth() >= targetMonth) &&
            (start.getFullYear() === targetYear || end.getFullYear() === targetYear)
          ) {
            staffAway.add(r.staffId);
          }
        }
      });

      const percentageAway = (staffAway.size / totalStaff) * 100;
      
      let riskLevel: 'low' | 'medium' | 'high' | 'critical' | 'none' = 'none';
      if (percentageAway >= thresholds.critical) riskLevel = 'critical';
      else if (percentageAway >= thresholds.high) riskLevel = 'high';
      else if (percentageAway >= thresholds.medium) riskLevel = 'medium';
      else if (percentageAway >= thresholds.low) riskLevel = 'low';

      return {
        branchId: branch.id,
        branchName: branch.name,
        percentageAway,
        riskLevel,
        count: staffAway.size
      };
    });
  }, [branches, requests, staff, currentBranchId, targetMonth, targetYear, thresholds]);

  const RISK_COLORS = {
    none: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    low: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    medium: 'bg-amber-100 text-amber-800 border-amber-200',
    high: 'bg-rose-400 text-rose-950 border-rose-500',
    critical: 'bg-rose-800 text-white border-rose-950'
  };

  return (
    <div className="space-y-8">
      {/* Pending and Approved Requests - Moved here to be prominent for Admin */}
      {(prefs.pendingRequests !== false || prefs.approvedRequests !== false) && (
        currentUser.role !== 'Staff' || 
        branches.find(b => b.id === currentBranchId)?.showDashboardToStaff !== false
      ) && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <div className="w-1 h-4 bg-primary-500 rounded-full"></div>
            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
              {dashboardFilter === 'year' ? 'Current Year' : 'Next 3 Months'} Requests
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {prefs.pendingRequests !== false && (
            <div id="pending-requests-section" className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 scroll-mt-24">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                  <i className="fa-solid fa-clock text-amber-500"></i>
                  Pending Requests
                </h3>
              </div>
              <div className="space-y-3 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                {requests
                  .filter(r => r.status === 'Pending' && (currentBranchId === 'all' || r.branchId === currentBranchId))
                  .filter(r => {
                    const startDate = new Date(r.startDate);
                    const now = new Date();
                    if (dashboardFilter === 'year') {
                      return startDate.getFullYear() === now.getFullYear();
                    } else {
                      const threeMonthsFromNow = new Date();
                      threeMonthsFromNow.setMonth(now.getMonth() + 3);
                      return startDate >= now && startDate <= threeMonthsFromNow;
                    }
                  })
                  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                  .map(r => {
                    const sMember = staff.find(s => s.id === r.staffId);
                    const branch = branches.find(b => b.id === r.branchId);
                    const start = new Date(r.startDate);
                    const end = new Date(r.endDate);
                    const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                    
                    return (
                        <div 
                          key={r.id} 
                          onClick={(e) => onRequestClick(e, r)}
                          className="p-3 bg-gray-50 rounded-xl border border-gray-100 hover:border-primary-200 cursor-pointer transition-all flex justify-between items-center group"
                        >
                          <div>
                            <div className="font-bold text-gray-800 flex items-center gap-2">
                              {sMember?.name}
                              {r.isUrgent && (
                                <span className="text-[9px] bg-red-600 text-white px-1.5 py-0.5 rounded-md font-black animate-pulse flex items-center gap-1">
                                  <i className="fa-solid fa-fire-flame-curved text-[8px]"></i>
                                  URGENT
                                </span>
                              )}
                              {r.isStaffRequest && (
                                <span className="text-[9px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-md font-black flex items-center gap-1">
                                  <i className="fa-solid fa-user-tag text-[8px]"></i>
                                  STAFF
                                </span>
                              )}
                              {r.attachmentUrl && (
                                <i className="fa-solid fa-paperclip text-[10px] text-gray-400" title="Has attachment"></i>
                              )}
                              <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold">
                                {diffDays} {diffDays === 1 ? 'Day' : 'Days'}
                              </span>
                            </div>
                            <div className="text-xs text-gray-500">{r.startDate} to {r.endDate} • {branch?.name}</div>
                          </div>
                          <i className="fa-solid fa-chevron-right text-gray-300 group-hover:text-primary-500 transition-colors"></i>
                        </div>
                    );
                  })}
                {requests
                  .filter(r => r.status === 'Pending' && (currentBranchId === 'all' || r.branchId === currentBranchId))
                  .filter(r => {
                    const startDate = new Date(r.startDate);
                    const now = new Date();
                    if (dashboardFilter === 'year') {
                      return startDate.getFullYear() === now.getFullYear();
                    } else {
                      const threeMonthsFromNow = new Date();
                      threeMonthsFromNow.setMonth(now.getMonth() + 3);
                      return startDate >= now && startDate <= threeMonthsFromNow;
                    }
                  }).length === 0 && (
                  <div className="text-center py-8 text-gray-400 text-sm italic">
                    No pending requests {dashboardFilter === 'upcoming' ? 'in the next 3 months' : 'this year'}
                  </div>
                )}
              </div>
            </div>
          )}

          {prefs.approvedRequests !== false && (
            <div id="approved-requests-section" className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 scroll-mt-24">
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <i className="fa-solid fa-circle-check text-emerald-500"></i>
                Approved Requests
              </h3>
              <div className="space-y-3 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                {requests
                  .filter(r => r.status === 'Approved' && (currentBranchId === 'all' || r.branchId === currentBranchId))
                  .filter(r => {
                    const startDate = new Date(r.startDate);
                    const now = new Date();
                    if (dashboardFilter === 'year') {
                      return startDate.getFullYear() === now.getFullYear();
                    } else {
                      const threeMonthsFromNow = new Date();
                      threeMonthsFromNow.setMonth(now.getMonth() + 3);
                      return startDate >= now && startDate <= threeMonthsFromNow;
                    }
                  })
                  .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
                  .map(r => {
                    const sMember = staff.find(s => s.id === r.staffId);
                    const branch = branches.find(b => b.id === r.branchId);
                    const start = new Date(r.startDate);
                    const end = new Date(r.endDate);
                    const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

                    return (
                        <div 
                          key={r.id} 
                          onClick={(e) => onRequestClick(e, r)}
                          className="p-3 bg-gray-50 rounded-xl border border-gray-100 hover:border-primary-200 cursor-pointer transition-all flex justify-between items-center group"
                        >
                          <div>
                            <div className="font-bold text-gray-800 flex items-center gap-2">
                              {sMember?.name}
                              {r.isUrgent && (
                                <span className="text-[9px] bg-red-600 text-white px-1.5 py-0.5 rounded-md font-black animate-pulse flex items-center gap-1">
                                  <i className="fa-solid fa-fire-flame-curved text-[8px]"></i>
                                  URGENT
                                </span>
                              )}
                              {r.isStaffRequest && (
                                <span className="text-[9px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-md font-black flex items-center gap-1">
                                  <i className="fa-solid fa-user-tag text-[8px]"></i>
                                  STAFF
                                </span>
                              )}
                              {r.attachmentUrl && (
                                <i className="fa-solid fa-paperclip text-[10px] text-gray-400" title="Has attachment"></i>
                              )}
                              <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">
                                {diffDays} {diffDays === 1 ? 'Day' : 'Days'}
                              </span>
                            </div>
                            <div className="text-xs text-gray-500">{r.startDate} to {r.endDate} • {branch?.name}</div>
                          </div>
                          <i className="fa-solid fa-chevron-right text-gray-300 group-hover:text-primary-500 transition-colors"></i>
                        </div>
                    );
                  })}
                {requests
                  .filter(r => r.status === 'Approved' && (currentBranchId === 'all' || r.branchId === currentBranchId))
                  .filter(r => {
                    const startDate = new Date(r.startDate);
                    const now = new Date();
                    if (dashboardFilter === 'year') {
                      return startDate.getFullYear() === now.getFullYear();
                    } else {
                      const threeMonthsFromNow = new Date();
                      threeMonthsFromNow.setMonth(now.getMonth() + 3);
                      return startDate >= now && startDate <= threeMonthsFromNow;
                    }
                  }).length === 0 && (
                  <div className="text-center py-8 text-gray-400 text-sm italic">
                    No approved requests {dashboardFilter === 'upcoming' ? 'in the next 3 months' : 'this year'}
                  </div>
                )}
              </div>
            </div>
          )}
          </div>
        </div>
      )}

      {/* Availability Summary Cards */}
      {prefs.availabilitySummary !== false && (
        currentUser.role !== 'Staff' || 
        branches.find(b => b.id === currentBranchId)?.showDashboardToStaff !== false
      ) && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <div className="w-1 h-4 bg-primary-500 rounded-full"></div>
              <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
                {targetDate.toLocaleString('default', { month: 'long' })} Availability
              </h3>
            </div>
            
            <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
              <button 
                onClick={() => setSelectedMonthOffset(0)}
                className={cn(
                  "px-3 py-1 text-[9px] font-bold uppercase tracking-wider rounded-md transition-all",
                  selectedMonthOffset === 0 ? "bg-white text-primary-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
                )}
              >
                {new Date().toLocaleString('default', { month: 'short' })}
              </button>
              <button 
                onClick={() => setSelectedMonthOffset(1)}
                className={cn(
                  "px-3 py-1 text-[9px] font-bold uppercase tracking-wider rounded-md transition-all",
                  selectedMonthOffset === 1 ? "bg-white text-primary-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
                )}
              >
                {new Date(currentYear, currentMonth + 1).toLocaleString('default', { month: 'short' })}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {summaryHeatmapData.map(branch => {
              const availability = 100 - branch.percentageAway;
              
              return (
                <div key={branch.branchId} className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider truncate mr-2">{branch.branchName}</span>
                    <div className={cn(
                      "w-1.5 h-1.5 rounded-full",
                      branch.riskLevel === 'critical' ? 'bg-rose-800' : 
                      branch.riskLevel === 'high' ? 'bg-rose-400' : 
                      branch.riskLevel === 'medium' ? 'bg-amber-500' : 'bg-emerald-500'
                    )}></div>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-lg font-black text-gray-800">{Math.round(availability)}%</span>
                    <span className="text-[8px] font-bold text-gray-400 uppercase">Avail.</span>
                  </div>
                  <div className="mt-1.5 w-full bg-gray-50 h-1 rounded-full overflow-hidden">
                    <div 
                      className={cn(
                        "h-full transition-all duration-1000",
                        branch.riskLevel === 'critical' ? 'bg-rose-800' : 
                        branch.riskLevel === 'high' ? 'bg-rose-400' : 
                        branch.riskLevel === 'medium' ? 'bg-amber-500' : 'bg-emerald-500'
                      )}
                      style={{ width: `${availability}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Top Row: Donut Chart and Bar Chart */}
      {currentUser.role !== 'Staff' && (prefs.categoryDistribution !== false || prefs.branchVolume !== false) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Category Donut Chart */}
          {prefs.categoryDistribution !== false && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-gray-800 mb-1">Request Categories</h3>
              <p className="text-xs text-gray-400 mb-6">Approved (Solid) vs Pending (Faded)</p>
              
              <div className="h-[280px] w-full relative">
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <PieChart>
                    {/* Inner Ring: Categories */}
                    <Pie
                      data={categoryData.inner}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={70}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {categoryData.inner.map((entry, index) => (
                        <Cell key={`inner-${index}`} fill={COLORS[entry.name as StaffCategory]} />
                      ))}
                    </Pie>
                    {/* Outer Ring: Approved vs Pending */}
                    <Pie
                      data={categoryData.outer}
                      cx="50%"
                      cy="50%"
                      innerRadius={75}
                      outerRadius={90}
                      paddingAngle={1}
                      dataKey="value"
                    >
                      {categoryData.outer.map((entry, index) => (
                        <Cell 
                          key={`outer-${index}`} 
                          fill={entry.status === 'Approved' ? COLORS[entry.parent] : `${COLORS[entry.parent]}44`} 
                        />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-2xl font-black text-gray-800">
                    {categoryData.inner.reduce((a, b) => a + b.value, 0)}
                  </span>
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Total</span>
                </div>
              </div>

              <div className="mt-6 space-y-3">
                {categoryData.inner.map((item) => (
                  <div key={item.name} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[item.name as StaffCategory] }}></div>
                        <span className="text-xs font-bold text-gray-600">{item.name}</span>
                      </div>
                      <span className="text-xs font-black text-gray-800">{item.value}</span>
                    </div>
                    <div className="flex gap-2 pl-4">
                      <div className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                        <span className="text-[9px] font-bold text-gray-400">{item.approved} Appr.</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-400"></div>
                        <span className="text-[9px] font-bold text-gray-400">{item.pending} Pend.</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Branch Status Stacked Bar */}
          {prefs.branchVolume !== false && (
            <div className={cn("bg-white p-6 rounded-2xl shadow-sm border border-gray-100", prefs.categoryDistribution === false ? "lg:col-span-3" : "lg:col-span-2")}>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-bold text-gray-800">Branch Request Volume</h3>
                  <p className="text-xs text-gray-400">Total requests vs branch capacity</p>
                </div>
                <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-wider">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-sm bg-emerald-500"></div>
                    <span>Approved</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-sm bg-amber-400"></div>
                    <span>Pending</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-sm bg-gray-100"></div>
                    <span>Available</span>
                  </div>
                </div>
              </div>
              
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <BarChart
                    data={branchData}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                    <XAxis type="number" hide />
                    <YAxis 
                      dataKey="name" 
                      type="category" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 11, fontWeight: 700, fill: '#64748b' }}
                      width={100}
                    />
                    <Tooltip 
                      cursor={{ fill: '#f8fafc' }}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    />
                    <Bar dataKey="approved" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} barSize={24} />
                    <Bar dataKey="pending" stackId="a" fill="#fbbf24" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="capacity" stackId="a" fill="#f1f5f9" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Bottom Row: Monthly Tightness Heatmap */}
      {currentUser.role !== 'Staff' && prefs.riskHeatmap !== false && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div>
              <h3 className="text-lg font-bold text-gray-800">Monthly Risk Heatmap</h3>
              <p className="text-xs text-gray-400">Staff absence percentage by month</p>
            </div>
            
            {/* Legend */}
            <div className="flex flex-wrap items-center gap-3">
              {[
                { label: 'Safe', color: 'bg-emerald-100', range: `<${thresholds.low}%` },
                { label: 'Low', color: 'bg-emerald-200', range: `${thresholds.low}-${thresholds.medium}%` },
                { label: 'Medium', color: 'bg-amber-100', range: `${thresholds.medium}-${thresholds.high}%` },
                { label: 'High', color: 'bg-rose-400', range: `${thresholds.high}-${thresholds.critical}%` },
                { label: 'Critical', color: 'bg-rose-800', range: `>${thresholds.critical}%` },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-1.5">
                  <div className={cn("w-3 h-3 rounded-sm border", item.color)}></div>
                  <div className="flex flex-col">
                    <span className="text-[9px] font-bold text-gray-500 leading-none">{item.label}</span>
                    <span className="text-[8px] text-gray-400 leading-none">{item.range}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto pb-2">
            <div className="min-w-[800px]">
              {/* Header: Months */}
              <div className="grid grid-cols-[150px_repeat(12,1fr)] gap-2 mb-2">
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-2">Branch</div>
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">
                    {new Date(0, i).toLocaleString('default', { month: 'short' })}
                  </div>
                ))}
              </div>

              {/* Rows: Branches */}
              <div className="space-y-2">
                {heatmapData.map(row => (
                  <div key={row.branchId} className="grid grid-cols-[150px_repeat(12,1fr)] gap-2 items-center">
                    <div className="text-xs font-bold text-gray-700 truncate px-2" title={row.branchName}>
                      {row.branchName}
                    </div>
                    {row.months.map((m, i) => (
                      <div 
                        key={i}
                        className={cn(
                          "h-10 rounded-lg border flex flex-col items-center justify-center transition-all hover:scale-105 cursor-help group relative",
                          RISK_COLORS[m.riskLevel]
                        )}
                      >
                        <span className="text-[10px] font-black">{Math.round(m.percentageAway)}%</span>
                        <span className="text-[8px] opacity-60 font-bold">{m.count} Out</span>
                        
                        {/* Tooltip */}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-[9px] rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-10">
                          {m.count} staff away in {new Date(0, i).toLocaleString('default', { month: 'long' })}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardCharts;
