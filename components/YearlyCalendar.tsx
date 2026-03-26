
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { HolidayRequest, Staff, Branch, UserRole, StaffCategory, SystemConfig, User } from '../types';
import { CATEGORIES } from '../constants';

interface YearlyCalendarProps {
  role: UserRole;
  currentUser: User;
  currentBranchId: string;
  requests: HolidayRequest[];
  branches: Branch[];
  staff: Staff[];
  systemConfig: SystemConfig;
  onAddRequest: (req: Partial<HolidayRequest>) => void;
  onUpdateRequest: (req: Partial<HolidayRequest>) => void;
  onDeleteRequest: (id: string) => void;
  onDayClick: (date: Date) => void;
  onRequestClick: (e: React.MouseEvent, req: HolidayRequest) => void;
  selectedCategories: StaffCategory[];
  selectedYear: number;
  isShrunk?: boolean;
  viewMode: 'Calendar' | 'StaffGrid';
  onViewModeChange: (mode: 'Calendar' | 'StaffGrid') => void;
}

const YearlyCalendar: React.FC<YearlyCalendarProps> = ({
  role,
  currentUser,
  currentBranchId,
  requests,
  branches,
  staff,
  systemConfig,
  onAddRequest,
  onUpdateRequest,
  onDeleteRequest,
  onDayClick,
  onRequestClick,
  selectedCategories,
  selectedYear,
  isShrunk,
  viewMode,
  onViewModeChange
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [activeMonth, setActiveMonth] = useState(new Date().getMonth());
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const [isSmallScreen, setIsSmallScreen] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024);
      setIsSmallScreen(window.innerWidth < 768);
    };
    
    const handleScroll = () => {
      if (viewMode !== 'Calendar') return;
      
      // The threshold is where the month title "hits" the sticky area
      // Days are at 64/96. Bubble is above them.
      const threshold = isShrunk ? 100 : 140; 
      
      let currentActive = activeMonth;
      const monthElements = Array.from({ length: 12 }).map((_, i) => document.getElementById(`month-${i}`));
      
      for (let i = 0; i < 12; i++) {
        const element = monthElements[i];
        if (element) {
          const rect = element.getBoundingClientRect();
          // Find the last month that has crossed the threshold
          if (rect.top <= threshold + 20) {
            currentActive = i;
          }
        }
      }
      
      setActiveMonth(currentActive);
    };

    const root = document.getElementById('root');
    
    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleScroll);
    if (root) root.addEventListener('scroll', handleScroll);
    
    // Initial check
    handleScroll();

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll);
      if (root) root.removeEventListener('scroll', handleScroll);
    };
  }, [viewMode, isShrunk, activeMonth]);

  useEffect(() => {
    // Initial scroll to current month
    const currentMonthIndex = new Date().getMonth();
    
    // Exemption for January: stay at the top as per previous behavior
    if (currentMonthIndex === 0) return;

    const timer = setTimeout(() => {
      const element = document.getElementById(`month-${currentMonthIndex}`);
      const root = document.getElementById('root');
      
      if (element) {
        // Use a 1px offset as requested to show the month title clearly
        const offset = 1;
        
        // Get position relative to the scroll container
        const elementTop = element.offsetTop;
        const scrollTarget = elementTop - offset;

        if (root) {
          root.scrollTo({
            top: scrollTarget,
            behavior: currentUser.smoothScroll !== false ? 'smooth' : 'auto'
          });
        } else {
          window.scrollTo({
            top: scrollTarget,
            behavior: currentUser.smoothScroll !== false ? 'smooth' : 'auto'
          });
        }
      }
    }, 300); // Slightly longer delay to ensure layout is stable

    return () => clearTimeout(timer);
  }, []);

  const currentYear = selectedYear;
  
  // Generate all days for the year
  const yearDays = useMemo(() => {
    const days = [];
    const start = new Date(currentYear, 0, 1);
    const end = new Date(currentYear, 11, 31);
    const curr = new Date(start);
    while (curr <= end) {
      days.push(new Date(curr));
      curr.setDate(curr.getDate() + 1);
    }
    return days;
  }, [currentYear]);

  // Group days by month for the heatmap and calendar view
  const months = useMemo(() => {
    const m = [];
    for (let i = 0; i < 12; i++) {
      const firstDay = new Date(currentYear, i, 1);
      const lastDay = new Date(currentYear, i + 1, 0);
      m.push({
        index: i,
        name: firstDay.toLocaleString('default', { month: 'short' }),
        fullName: firstDay.toLocaleString('default', { month: 'long' }),
        days: lastDay.getDate(),
        firstDayOfWeek: (firstDay.getDay() + 6) % 7
      });
    }
    return m;
  }, [currentYear]);

  // Calculate density for each day
  const dailyDensity = useMemo(() => {
    const density: Record<string, { approved: number, pending: number }> = {};
    yearDays.forEach(day => {
      const dStr = day.toISOString().split('T')[0];
      const dayReqs = requests.filter(r => {
        const branchMatch = currentBranchId === 'all' || r.branchId === currentBranchId;
        const sMember = staff.find(s => s.id === r.staffId);
        const categoryMatch = sMember && selectedCategories.includes(sMember.category);
        return dStr >= r.startDate && dStr <= r.endDate && branchMatch && categoryMatch;
      });
      
      density[dStr] = {
        approved: dayReqs.filter(r => r.status === 'Approved').length,
        pending: dayReqs.filter(r => r.status === 'Pending').length
      };
    });
    return density;
  }, [yearDays, requests, currentBranchId, staff, selectedCategories]);

  const scrollToMonth = (monthIndex: number) => {
    const element = document.getElementById(`month-${monthIndex}`);
    if (element && scrollContainerRef.current) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const filteredStaff = useMemo(() => {
    return staff.filter(s => {
      const branchMatch = currentBranchId === 'all' || s.branchId === currentBranchId;
      const categoryMatch = selectedCategories.includes(s.category);
      return branchMatch && categoryMatch;
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [staff, currentBranchId, selectedCategories]);

  const renderMonthHeatmap = (monthIndex: number, type: 'approved' | 'risk') => {
    const m = months[monthIndex];
    const totalStaffCount = filteredStaff.length;
    
    // Create exactly 33 slots (11x3 grid)
    const slots = Array.from({ length: 33 }).map((_, i) => {
      if (i >= m.days) return null;
      const date = new Date(currentYear, monthIndex, i + 1);
      const dStr = date.toISOString().split('T')[0];
      return dailyDensity[dStr] || { approved: 0, pending: 0 };
    });

    const thresholds = systemConfig.heatmapThresholds || { low: 10, medium: 20, high: 30, critical: 45 };

    const getRiskColorClass = (percentage: number) => {
      if (percentage < thresholds.low) return 'bg-emerald-100 border-emerald-200';
      if (percentage <= thresholds.medium) return 'bg-amber-100 border-amber-200';
      if (percentage <= thresholds.high) return 'bg-orange-200 border-orange-300';
      if (percentage <= thresholds.critical) return 'bg-rose-200 border-rose-300';
      return 'bg-red-600 border-red-700';
    };

    const getApprovedColorClass = (percentage: number) => {
      if (percentage < thresholds.low) return 'bg-emerald-100 border-emerald-200';
      if (percentage <= thresholds.medium) return 'bg-rose-100 border-rose-200';
      if (percentage <= thresholds.high) return 'bg-rose-300 border-rose-400';
      if (percentage <= thresholds.critical) return 'bg-rose-500 border-rose-600';
      return 'bg-rose-900 border-rose-950';
    };

    const stripeStyle = { 
      backgroundImage: 'linear-gradient(45deg, rgba(0,0,0,0.1) 25%, transparent 25%, transparent 50%, rgba(0,0,0,0.1) 50%, rgba(0,0,0,0.1) 75%, transparent 75%, transparent)', 
      backgroundSize: isSmallScreen ? '2px 2px' : '4px 4px' 
    };
    const stripeStyleWhite = { 
      backgroundImage: 'linear-gradient(45deg, rgba(255,255,255,0.2) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.2) 50%, rgba(255,255,255,0.2) 75%, transparent 75%, transparent)', 
      backgroundSize: isSmallScreen ? '2px 2px' : '4px 4px' 
    };

    const squareSize = isSmallScreen ? 'w-1.5 h-1.5' : 'w-[14px] h-[14px]';
    const fontSize = 'text-[7px]';

    return (
      <div className={`grid grid-cols-11 gap-[1px] p-1 bg-gray-100/50 rounded-sm ${!isSmallScreen ? 'max-w-[170px]' : ''}`}>
        {slots.map((d, i) => {
          if (d === null) return <div key={i} className={`${squareSize} bg-transparent`} />;
          
          if (type === 'approved') {
            const count = d.approved;
            if (count === 0) return <div key={i} className={`${squareSize} bg-gray-200/50 rounded-[1px]`} />;
            const percentage = totalStaffCount > 0 ? (count / totalStaffCount) * 100 : 0;
            const colorClass = getApprovedColorClass(percentage);
            return (
              <div 
                key={i} 
                className={`${squareSize} rounded-[1px] border-[0.5px] flex items-center justify-center font-black ${colorClass} ${!isSmallScreen ? fontSize : ''}`}
                title={`Day ${i+1}: ${count} Approved (${percentage.toFixed(1)}%)`}
              >
                {!isSmallScreen && count}
              </div>
            );
          } else {
            // Risk side: Only show if there is at least one pending request
            const count = d.approved + d.pending;
            if (d.pending === 0) return <div key={i} className={`${squareSize} bg-gray-200/50 rounded-[1px]`} />;
            
            const percentage = totalStaffCount > 0 ? (count / totalStaffCount) * 100 : 0;
            const colorClass = getRiskColorClass(percentage);
            const isDark = percentage > 45;

            return (
              <div 
                key={i} 
                className={`${squareSize} rounded-[1px] border-[0.5px] relative overflow-hidden flex items-center justify-center font-black ${colorClass} ${!isSmallScreen ? fontSize : ''}`}
                title={`Day ${i+1}: ${count} Total Risk (${percentage.toFixed(1)}%)`}
              >
                <div className="absolute inset-0" style={isDark ? stripeStyleWhite : stripeStyle}></div>
                {!isSmallScreen && <span className="relative z-10">{count}</span>}
              </div>
            );
          }
        })}
      </div>
    );
  };

  const renderCalendarView = () => {
    const monthsPerRow = 1;
    const monthGroups = [];
    for (let i = 0; i < 12; i += monthsPerRow) {
      monthGroups.push(months.slice(i, i + monthsPerRow));
    }

    return (
      <div 
        ref={scrollContainerRef}
        className="p-4 space-y-8 scroll-smooth"
      >
        {/* Floating Month Bubble - Positioned ABOVE sticky days */}
        <div className={`sticky z-50 flex justify-center pointer-events-none transition-all duration-500 ${isShrunk ? 'top-[28px]' : 'top-[56px]'}`}>
          <div className="bg-white/40 backdrop-blur-md text-gray-900 px-6 py-1 rounded-full shadow-lg border border-white/50 text-sm font-bold flex items-center gap-2 ring-1 ring-black/5">
            <span className="w-2 h-2 rounded-full bg-primary-500 shadow-[0_0_8px_rgba(var(--primary-500),0.5)]"></span>
            {months[activeMonth].fullName} {currentYear}
          </div>
        </div>

        {/* Global Sticky Day-of-Week Header */}
        <div 
          className={`sticky z-30 bg-white/95 backdrop-blur-sm border-b border-gray-100 grid grid-cols-7 shadow-sm transition-all duration-500 ${isShrunk ? 'top-16' : 'top-24'}`}
        >
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
            <div key={day} className="py-2 text-center text-[10px] xl:text-[11px] font-bold text-gray-400 uppercase tracking-widest">
              {day}
            </div>
          ))}
        </div>

        {monthGroups.map((group, gIdx) => (
          <div key={gIdx} className="flex flex-col lg:flex-row gap-6">
            {group.map(m => (
              <div id={`month-${m.index}`} key={m.index} className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden min-w-[300px]">
                <div 
                  className="p-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between"
                >
                  <div className="flex flex-col items-start gap-1">
                    <span className="text-[7px] font-black text-gray-400 uppercase tracking-tighter">Approved</span>
                    {renderMonthHeatmap(m.index, 'approved')}
                  </div>
                  <div className="font-bold text-gray-800 text-sm">
                    {m.fullName} {currentYear}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-[7px] font-black text-gray-400 uppercase tracking-tighter flex items-center gap-1">
                      Risk <i className="fa-solid fa-fire-flame-curved text-[6px] text-primary-500"></i>
                    </span>
                    {renderMonthHeatmap(m.index, 'risk')}
                  </div>
                </div>
                <div className="grid grid-cols-7">
                  {Array.from({ length: 42 }).map((_, i) => {
                    const dayNum = i - m.firstDayOfWeek + 1;
                    const isCurrentMonth = dayNum > 0 && dayNum <= m.days;
                    const date = new Date(currentYear, m.index, dayNum);
                    const dStr = isCurrentMonth ? date.toISOString().split('T')[0] : '';
                    
                    const dateRequests = isCurrentMonth ? requests.filter(r => {
                      const branchMatch = currentBranchId === 'all' || r.branchId === currentBranchId;
                      const sMember = staff.find(s => s.id === r.staffId);
                      const categoryMatch = sMember && selectedCategories.includes(sMember.category);
                      return dStr >= r.startDate && dStr <= r.endDate && branchMatch && categoryMatch;
                    }).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) : [];

                    return (
                      <div 
                        key={i}
                        onClick={() => isCurrentMonth && onDayClick(date)}
                        className={`min-h-[100px] xl:min-h-[115px] p-1.5 xl:p-2 border-r border-b border-gray-100 transition-colors ${isCurrentMonth ? 'bg-white cursor-pointer hover:bg-gray-50' : 'bg-gray-50/50'}`}
                      >
                        {isCurrentMonth && (
                          <div className="flex justify-between items-center mb-1">
                            <span className={`text-[10px] xl:text-[11px] font-bold ${new Date().toDateString() === date.toDateString() ? 'bg-primary-600 text-white w-5 h-5 xl:w-6 xl:h-6 flex items-center justify-center rounded-full' : 'text-gray-400'}`}>
                              {dayNum}
                            </span>
                          </div>
                        )}
                        <div className="space-y-1">
                          {dateRequests.map(r => {
                            const sMember = staff.find(s => s.id === r.staffId);
                            const branch = branches.find(b => b.id === r.branchId);
                            return (
                              <div 
                                key={r.id}
                                onClick={(e) => onRequestClick(e, r)}
                                className={`text-[9px] xl:text-[10px] p-1 xl:p-1.5 rounded border transition-all truncate group relative flex items-center gap-1 ${
                                  r.isUrgent ? 'ring-2 ring-red-500 ring-offset-1 z-10' : ''
                                } ${
                                  r.status === 'Approved' 
                                    ? 'bg-emerald-100 border-emerald-200 text-emerald-800' 
                                    : r.status === 'Rejected'
                                    ? 'bg-red-100 border-red-200 text-red-800'
                                    : r.status === 'Withdrawn'
                                    ? 'bg-gray-100 border-gray-200 text-gray-500 line-through'
                                    : 'bg-amber-100 border-amber-200 text-amber-800 opacity-80'
                                } hover:scale-105 hover:shadow-sm`}
                              >
                                {r.isUrgent && (
                                  <i className="fa-solid fa-circle-exclamation text-red-600 animate-pulse shrink-0"></i>
                                )}
                                {r.isStaffRequest && (
                                  <i className="fa-solid fa-user-tag text-purple-600 shrink-0" title="Staff Request"></i>
                                )}
                                <div className="truncate">
                                  <span className="font-bold">[{sMember?.category[0]}]</span> {sMember?.name}
                                  {currentBranchId === 'all' && !isMobile && <div className="text-[7px] xl:text-[8px] opacity-70">{branch?.name}</div>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  };

  const renderStaffGridView = () => {
    return (
      <div className="flex-1 flex flex-col overflow-hidden bg-white">
        <div className="flex-1 overflow-auto relative">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 z-20 bg-white">
              <tr>
                <th className="sticky left-0 z-30 bg-gray-50 p-4 text-xs font-bold text-gray-500 uppercase border-b border-r min-w-[150px]">Staff Member</th>
                {months.map(m => (
                  <th 
                    key={m.index} 
                    id={`month-grid-${m.index}`}
                    colSpan={m.days} 
                    className="p-2 text-center text-[10px] font-bold text-gray-600 border-b border-r bg-gray-100/50 uppercase tracking-wider"
                  >
                    {m.fullName}
                  </th>
                ))}
              </tr>
              <tr>
                <th className="sticky left-0 z-30 bg-white border-b border-r"></th>
                {months.map(m => (
                  Array.from({ length: m.days }).map((_, d) => (
                    <th key={`${m.index}-${d}`} className="p-1 text-center text-[8px] font-bold text-gray-400 border-b border-r min-w-[25px]">
                      {d + 1}
                    </th>
                  ))
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Heatmap Row: Operational Risk Analysis */}
              <tr className="bg-gray-50/80 sticky top-[72px] z-20 shadow-sm border-b-2 border-gray-200">
                <td className="sticky left-0 z-30 bg-gray-100 p-3 text-[10px] font-black text-gray-600 border-r uppercase tracking-tighter flex items-center gap-2">
                  <i className="fa-solid fa-fire-flame-curved text-primary-600"></i>
                  Risk Heatmap (%)
                </td>
                {months.map(m => (
                  Array.from({ length: m.days }).map((_, d) => {
                    const date = new Date(currentYear, m.index, d + 1);
                    const dStr = date.toISOString().split('T')[0];
                    
                    // Count how many of the currently filtered staff are off
                    const staffOffCount = filteredStaff.filter(s => 
                      requests.some(r => r.staffId === s.id && dStr >= r.startDate && dStr <= r.endDate && r.status !== 'Rejected' && r.status !== 'Withdrawn')
                    ).length;

                    const totalStaffCount = filteredStaff.length;
                    const percentage = totalStaffCount > 0 ? (staffOffCount / totalStaffCount) * 100 : 0;

                    let bgColor = 'bg-white';
                    let textColor = 'text-gray-300';
                    
                    const thresholds = systemConfig.heatmapThresholds || { low: 10, medium: 20, high: 30, critical: 45 };
                    
                    if (staffOffCount > 0) {
                      if (percentage < thresholds.low) {
                        bgColor = 'bg-emerald-100';
                        textColor = 'text-emerald-700';
                      } else if (percentage <= thresholds.medium) {
                        bgColor = 'bg-amber-100';
                        textColor = 'text-amber-700';
                      } else if (percentage <= thresholds.high) {
                        bgColor = 'bg-orange-200';
                        textColor = 'text-orange-800';
                      } else if (percentage <= thresholds.critical) {
                        bgColor = 'bg-rose-200';
                        textColor = 'text-rose-800';
                      } else {
                        bgColor = 'bg-red-600';
                        textColor = 'text-white';
                      }
                    }

                    const isToday = date.toDateString() === new Date().toDateString();

                    return (
                      <td 
                        key={`${m.index}-${d}`} 
                        className={`border-r p-0 h-10 text-center transition-all relative ${bgColor} ${isToday ? 'ring-1 ring-primary-500 ring-inset' : ''}`}
                        title={`${staffOffCount} staff off (${percentage.toFixed(1)}%)`}
                      >
                        <span className={`text-[10px] font-black ${textColor}`}>
                          {staffOffCount > 0 ? staffOffCount : '-'}
                        </span>
                        {percentage > thresholds.critical && (
                          <div className="absolute top-0 right-0 w-1.5 h-1.5 bg-white rounded-full m-0.5 animate-pulse"></div>
                        )}
                      </td>
                    );
                  })
                ))}
              </tr>

              {filteredStaff.map(s => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="sticky left-0 z-10 bg-white p-3 text-xs font-bold text-gray-700 border-b border-r shadow-sm">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${s.category === 'Kitchen' ? 'bg-orange-400' : s.category === 'Counter' ? 'bg-blue-400' : 'bg-purple-400'}`}></span>
                      {s.name}
                    </div>
                  </td>
                  {months.map(m => (
                    Array.from({ length: m.days }).map((_, d) => {
                      const date = new Date(currentYear, m.index, d + 1);
                      const dStr = date.toISOString().split('T')[0];
                      const req = requests.find(r => r.staffId === s.id && dStr >= r.startDate && dStr <= r.endDate);
                      
                      let bgColor = '';
                      if (req) {
                        if (req.status === 'Approved') bgColor = 'bg-emerald-400';
                        else if (req.status === 'Pending') bgColor = 'bg-amber-400';
                        else if (req.status === 'Rejected') bgColor = 'bg-red-400';
                      }

                      const isToday = date.toDateString() === new Date().toDateString();

                      return (
                        <td 
                          key={`${m.index}-${d}`} 
                          onClick={() => onDayClick(date)}
                          className={`border-b border-r p-0 h-8 cursor-pointer transition-colors ${isToday ? 'bg-primary-50/30' : ''} hover:bg-gray-100`}
                        >
                          {req && (
                            <div 
                              onClick={(e) => onRequestClick(e, req)}
                              className={`w-full h-full ${bgColor} opacity-80 hover:opacity-100 transition-opacity relative flex items-center justify-center`}
                              title={`${s.name}: ${req.status}${req.isUrgent ? ' (URGENT)' : ''}`}
                            >
                              {req.isUrgent && (
                                <div className="w-1.5 h-1.5 bg-white rounded-full shadow-sm animate-pulse" />
                              )}
                            </div>
                          )}
                        </td>
                      );
                    })
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col bg-white rounded-2xl shadow-sm border border-gray-100 overflow-visible">
      <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-bold text-gray-800">
            {viewMode === 'Calendar' ? 'Yearly Planner' : 'Staff Availability Grid'}
          </h3>
          <div className="flex bg-gray-200 p-1 rounded-lg">
            <button 
              onClick={() => onViewModeChange('Calendar')}
              className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${viewMode === 'Calendar' ? 'bg-white shadow-sm text-primary-600' : 'text-gray-500'}`}
            >
              Calendar
            </button>
            <button 
              onClick={() => onViewModeChange('StaffGrid')}
              className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${viewMode === 'StaffGrid' ? 'bg-white shadow-sm text-primary-600' : 'text-gray-500'}`}
            >
              Staff Grid
            </button>
          </div>
        </div>
        <div className="text-xs text-gray-500 font-medium">
          {currentYear} Planner • {currentBranchId === 'all' ? 'All Branches' : branches.find(b => b.id === currentBranchId)?.name}
        </div>
      </div>

      <div className="relative">
        {viewMode === 'Calendar' ? renderCalendarView() : renderStaffGridView()}
      </div>
    </div>
  );
};

export default YearlyCalendar;
