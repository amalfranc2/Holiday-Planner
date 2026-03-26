
import React, { useState, useMemo, useEffect } from 'react';
import { HolidayRequest, Staff, Branch, UserRole, StaffCategory, SystemConfig, User } from '../types';
import { BRANCHES, MOCK_STAFF, CATEGORIES } from '../constants';
import HolidayModal from './HolidayModal';
import YearlyCalendar from './YearlyCalendar';
import DashboardCharts from './DashboardCharts';

interface MainViewProps {
  role: UserRole;
  currentUser: User;
  currentBranchId?: string;
  requests: HolidayRequest[];
  branches: Branch[];
  staff: Staff[];
  systemConfig: SystemConfig;
  onAddRequest: (req: Partial<HolidayRequest>) => void;
  onUpdateRequest: (req: Partial<HolidayRequest>) => void;
  onDeleteRequest: (id: string) => void;
  isShrunk?: boolean;
  viewType: 'Dashboard' | 'Yearly';
}

const MainView: React.FC<MainViewProps> = ({ 
  role, currentUser, currentBranchId, requests, branches, staff, systemConfig, onAddRequest, onUpdateRequest, onDeleteRequest, isShrunk, viewType 
}) => {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<HolidayRequest | undefined>(undefined);
  const [activeDate, setActiveDate] = useState<Date | undefined>(undefined);
  const [selectedCategories, setSelectedCategories] = useState<StaffCategory[]>(['Kitchen', 'Counter', 'Manager']);
  const [viewMode, setViewMode] = useState<'Calendar' | 'StaffGrid'>('Calendar');
  const [dashboardFilter, setDashboardFilter] = useState<'year' | 'upcoming'>('year');

  const daysInMonth = (month: number, year: number) => new Date(year, month + 1, 0).getDate();
  
  const getStartOfMonth = (date: Date) => {
    const day = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    return (day + 6) % 7; // Adjust for Monday start (Mon=0, Sun=6)
  };

  const getMonthName = (date: Date) => date.toLocaleString('default', { month: 'long' });
  const getYear = (date: Date) => date.getFullYear();

  const [isCapsuleExpanded, setIsCapsuleExpanded] = useState(false);

  const toggleCategory = (cat: StaffCategory) => {
    setSelectedCategories(prev => 
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const navigateYear = (direction: number) => {
    setSelectedYear(prev => prev + direction);
  };

  const getRequestsForDate = (date: Date) => {
    const dStr = date.toISOString().split('T')[0];
    return requests.filter(r => {
      const start = r.startDate;
      const end = r.endDate;
      const sMember = staff.find(s => s.id === r.staffId);
      const categoryMatch = sMember && selectedCategories.includes(sMember.category);
      const branchMatch = currentBranchId === 'all' || r.branchId === currentBranchId;
      return dStr >= start && dStr <= end && categoryMatch && branchMatch;
    });
  };

  const isHO = role === 'S-ADMIN' || role === 'ADMIN';
  const displayBranchId = (isHO && currentBranchId !== 'all') ? currentBranchId : (currentBranchId || branches[0]?.id);

  const handleDayClick = (date: Date) => {
    setActiveDate(date);
    setSelectedRequest(undefined);
    setIsModalOpen(true);
  };

  const handleRequestClick = (e: React.MouseEvent, req: HolidayRequest) => {
    e.stopPropagation();
    setSelectedRequest(req);
    setIsModalOpen(true);
  };

  const scrollToPending = () => {
    const element = document.getElementById('pending-requests-section');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const scrollToApproved = () => {
    const element = document.getElementById('approved-requests-section');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const dashboardStats = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const branchStaff = staff.filter(s => currentBranchId === 'all' || s.branchId === currentBranchId);
    const branchRequests = requests.filter(r => currentBranchId === 'all' || r.branchId === currentBranchId);

    const calculateDays = (start: string, end: string) => {
      const s = new Date(start);
      const e = new Date(end);
      return Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    };

    const totalAllowance = branchStaff.reduce((acc, s) => acc + s.totalAllowance, 0);
    const approvedRequests = branchRequests.filter(r => r.status === 'Approved' && new Date(r.startDate).getFullYear() === currentYear);
    const approvedDays = approvedRequests.reduce((acc, r) => acc + calculateDays(r.startDate, r.endDate), 0);
    
    const pendingRequests = branchRequests.filter(r => r.status === 'Pending' && new Date(r.startDate).getFullYear() === currentYear);
    const pendingDays = pendingRequests.reduce((acc, r) => acc + calculateDays(r.startDate, r.endDate), 0);

    return {
      total: totalAllowance,
      used: approvedDays,
      approvedCount: approvedRequests.length,
      pending: pendingDays,
      pendingCount: pendingRequests.length,
      remaining: totalAllowance - approvedDays
    };
  }, [staff, requests, currentBranchId]);

  const renderMonth = (baseDate: Date) => {
    const startOfMonth = getStartOfMonth(baseDate);
    const days = daysInMonth(baseDate.getMonth(), baseDate.getFullYear());
    const monthName = getMonthName(baseDate);
    const year = getYear(baseDate);

    return (
      <div key={baseDate.toISOString()} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex-1 min-w-[300px]">
        <div className="p-4 bg-gray-50 border-b border-gray-100 text-center font-bold text-gray-800">
          {monthName} {year}
        </div>
        <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-100">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
            <div key={day} className="py-2 text-center text-[10px] xl:text-[11px] font-bold text-gray-400 uppercase tracking-widest">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {Array.from({ length: 42 }).map((_, i) => {
            const dayNum = i - startOfMonth + 1;
            const isCurrentMonth = dayNum > 0 && dayNum <= days;
            const date = new Date(baseDate.getFullYear(), baseDate.getMonth(), dayNum);
            const dateRequests = isCurrentMonth ? getRequestsForDate(date).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) : [];
            
            return (
                <div 
                  key={i} 
                  onClick={() => isCurrentMonth && handleDayClick(date)}
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
                    const isOwnBranch = r.branchId === currentUser.branchId;
                    const canEdit = isHO || isOwnBranch;
                    const branch = branches.find(b => b.id === r.branchId);
                    return (
                      <div 
                        key={r.id}
                        onClick={(e) => handleRequestClick(e, r)}
                        className={`text-[9px] xl:text-[10px] p-1 xl:p-1.5 rounded border transition-all truncate group relative ${
                          r.status === 'Approved' 
                            ? 'bg-emerald-100 border-emerald-200 text-emerald-800' 
                            : r.status === 'Rejected'
                            ? 'bg-red-100 border-red-200 text-red-800'
                            : r.status === 'Withdrawn'
                            ? 'bg-gray-100 border-gray-200 text-gray-500 line-through'
                            : 'bg-amber-100 border-amber-200 text-amber-800 opacity-80'
                        } ${canEdit ? 'hover:scale-105 hover:shadow-sm cursor-pointer' : 'cursor-default'}`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="truncate">
                            <span className="font-bold">[{sMember?.category[0]}]</span> {sMember?.name}
                          </span>
                          {r.attachmentUrl && (
                            <i className="fa-solid fa-paperclip text-[8px] opacity-60"></i>
                          )}
                        </div>
                        {currentBranchId === 'all' && <div className="text-[7px] opacity-70">{branch?.name}</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Sub-header that scrolls with the page */}
      <div className="py-2 sm:py-4">
        <div className="flex flex-wrap items-center justify-between gap-2 bg-white p-2 sm:p-3 rounded-xl shadow-sm border border-gray-100">
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {viewType !== 'Dashboard' && (
              <>
                <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
                  <button onClick={() => navigateYear(-1)} className="p-1.5 hover:bg-white rounded-md transition-all text-gray-500">
                    <i className="fa-solid fa-chevron-left text-[10px]"></i>
                  </button>
                  <span className="px-2 font-black text-gray-800 text-xs min-w-[45px] text-center">
                    {selectedYear}
                  </span>
                  <button onClick={() => navigateYear(1)} className="p-1.5 hover:bg-white rounded-md transition-all text-gray-500">
                    <i className="fa-solid fa-chevron-right text-[10px]"></i>
                  </button>
                </div>

                <div className="flex bg-gray-100 rounded-lg p-0.5">
                  {CATEGORIES.map(cat => (
                    <button
                      key={cat}
                      onClick={() => toggleCategory(cat)}
                      className={`px-2 sm:px-3 py-1.5 rounded-md text-[9px] sm:text-[10px] font-black uppercase transition-all ${
                        selectedCategories.includes(cat) 
                          ? 'bg-white shadow-sm text-primary-600' 
                          : 'text-gray-400 hover:text-gray-600'
                      }`}
                    >
                      <span className="hidden sm:inline">{cat}</span>
                      <span className="sm:hidden">{cat[0]}</span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Dashboard Filter Toggle */}
            {viewType === 'Dashboard' && (
              <div className="flex bg-gray-100 rounded-lg p-0.5">
                <button
                  onClick={() => setDashboardFilter('year')}
                  className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase transition-all ${
                    dashboardFilter === 'year' ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  Current Year
                </button>
                <button
                  onClick={() => setDashboardFilter('upcoming')}
                  className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase transition-all ${
                    dashboardFilter === 'upcoming' ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  Next 3 Months
                </button>
              </div>
            )}

            {/* Request Button moved here for mobile row consolidation */}
            <button 
              onClick={() => { setSelectedRequest(undefined); setIsModalOpen(true); }}
              className="ml-auto sm:ml-0 px-3 sm:px-4 py-2 bg-primary-600 text-white rounded-lg text-[10px] sm:text-xs font-black hover:bg-primary-700 transition-all shadow-sm active:scale-95 flex items-center gap-1.5"
            >
              <i className="fa-solid fa-plus"></i>
              <span>Request</span>
            </button>
          </div>
        </div>
      </div>

      {/* Persistent Quick Action Menu */}
      {viewType !== 'Dashboard' && currentUser.showBubble !== false && (
        <div className="fixed bottom-6 right-6 z-[100]">
          {(currentUser.bubbleStyle || 'arc') === 'classic' ? (
            <div className="flex flex-col items-end gap-2">
              {/* Classic View Capsules (Visible when expanded) */}
              <div className={`flex flex-col items-end gap-2 transition-all duration-300 ${isCapsuleExpanded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
                {/* Row 1: Year Navigation Capsule */}
                <div className="flex items-center bg-white rounded-full shadow-lg border border-gray-100 p-1 gap-1 h-10">
                  <button 
                    onClick={() => navigateYear(-1)} 
                    className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-500 transition-colors"
                    title="Previous Year"
                  >
                    <i className="fa-solid fa-chevron-left text-[10px]"></i>
                  </button>
                  <span className="px-2 text-xs font-black text-primary-600 min-w-[40px] text-center">{selectedYear}</span>
                  <button 
                    onClick={() => navigateYear(1)} 
                    className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-500 transition-colors"
                    title="Next Year"
                  >
                    <i className="fa-solid fa-chevron-right text-[10px]"></i>
                  </button>
                </div>

                {/* Row 2: Category Filter Buttons */}
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => toggleCategory('Kitchen')} 
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-black transition-all shadow-lg border border-gray-100 ${selectedCategories.includes('Kitchen') ? 'bg-orange-500 text-white' : 'bg-white text-orange-600 hover:bg-orange-50'}`}
                    title="Kitchen"
                  >
                    K
                  </button>
                  <button 
                    onClick={() => toggleCategory('Counter')} 
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-black transition-all shadow-lg border border-gray-100 ${selectedCategories.includes('Counter') ? 'bg-blue-500 text-white' : 'bg-white text-blue-600 hover:bg-blue-50'}`}
                    title="Counter"
                  >
                    C
                  </button>
                  <button 
                    onClick={() => toggleCategory('Manager')} 
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-black transition-all shadow-lg border border-gray-100 ${selectedCategories.includes('Manager') ? 'bg-purple-500 text-white' : 'bg-white text-purple-600 hover:bg-purple-50'}`}
                    title="Manager"
                  >
                    M
                  </button>
                </div>

                {/* Row 3: View Mode & Top Capsule */}
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setViewMode(viewMode === 'Calendar' ? 'StaffGrid' : 'Calendar')}
                    className="bg-primary-600 text-white h-10 px-4 rounded-full shadow-lg flex items-center gap-2 text-xs font-bold hover:bg-primary-700 transition-colors"
                  >
                    <i className={`fa-solid ${viewMode === 'Calendar' ? 'fa-table-cells' : 'fa-calendar-days'}`}></i>
                    {viewMode === 'Calendar' ? 'Grid' : 'Planner'}
                  </button>
                  <button 
                    onClick={() => {
                      const scrollTargets = [window, document.documentElement, document.body, document.querySelector('main'), document.querySelector('#root')];
                      scrollTargets.forEach(target => {
                        if (target && 'scrollTo' in target) (target as any).scrollTo({ top: 0, left: 0, behavior: 'auto' });
                        if (target && 'scrollTop' in target) (target as any).scrollTop = 0;
                      });
                    }}
                    className="bg-gray-800 text-white w-10 h-10 rounded-full shadow-lg flex items-center justify-center hover:bg-black transition-colors"
                    title="Back to Top"
                  >
                    <i className="fa-solid fa-arrow-up"></i>
                  </button>
                </div>
              </div>

              {/* Toggle Button */}
              <button 
                onClick={() => setIsCapsuleExpanded(!isCapsuleExpanded)}
                className={`
                  w-12 h-12 rounded-full shadow-2xl flex items-center justify-center text-xl transition-all duration-300 cursor-pointer z-[101]
                  ${isCapsuleExpanded ? 'bg-gray-800 text-white rotate-45' : 'bg-primary-600 text-white rotate-0'}
                `}
              >
                <i className={`fa-solid ${isCapsuleExpanded ? 'fa-xmark' : 'fa-hand-pointer'}`}></i>
                {!isCapsuleExpanded && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-4 w-4 bg-primary-500 border-2 border-white"></span>
                  </span>
                )}
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-end gap-2">
              {/* Action Buttons (Arc Style) */}
              <div className={`relative w-12 h-12 transition-all duration-500 ${isCapsuleExpanded ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                {[
                  { 
                    icon: 'fa-chevron-left', 
                    onClick: () => navigateYear(-1), 
                    title: 'Previous Year',
                    angle: 135,
                    color: 'bg-white text-gray-600'
                  },
                  { 
                    icon: 'fa-chevron-right', 
                    onClick: () => navigateYear(1), 
                    title: 'Next Year',
                    angle: 157.5,
                    color: 'bg-white text-gray-600'
                  },
                  { 
                    icon: viewMode === 'Calendar' ? 'fa-table-cells' : 'fa-calendar-days', 
                    onClick: () => setViewMode(viewMode === 'Calendar' ? 'StaffGrid' : 'Calendar'), 
                    title: viewMode === 'Calendar' ? 'Staff Grid' : 'Yearly Planner',
                    angle: 180,
                    color: 'bg-primary-600 text-white'
                  },
                  { 
                    label: 'K', 
                    onClick: () => toggleCategory('Kitchen'), 
                    title: 'Kitchen',
                    angle: 202.5,
                    color: selectedCategories.includes('Kitchen') ? 'bg-orange-500 text-white' : 'bg-white text-orange-600'
                  },
                  { 
                    label: 'C', 
                    onClick: () => toggleCategory('Counter'), 
                    title: 'Counter',
                    angle: 225,
                    color: selectedCategories.includes('Counter') ? 'bg-blue-500 text-white' : 'bg-white text-blue-600'
                  },
                  { 
                    label: 'M', 
                    onClick: () => toggleCategory('Manager'), 
                    title: 'Manager',
                    angle: 247.5,
                    color: selectedCategories.includes('Manager') ? 'bg-purple-500 text-white' : 'bg-white text-purple-600'
                  },
                  { 
                    icon: 'fa-arrow-up', 
                    onClick: () => {
                      const scrollTargets = [window, document.documentElement, document.body, document.querySelector('main'), document.querySelector('#root')];
                      scrollTargets.forEach(target => {
                        if (target && 'scrollTo' in target) (target as any).scrollTo({ top: 0, left: 0, behavior: 'auto' });
                        if (target && 'scrollTop' in target) (target as any).scrollTop = 0;
                      });
                      setIsCapsuleExpanded(false);
                    }, 
                    title: 'Back to Top',
                    angle: 270,
                    color: 'bg-gray-800 text-white'
                  }
                ].map((btn, idx) => {
                  const radius = 90;
                  const angleRad = (btn.angle * Math.PI) / 180;
                  const x = Math.cos(angleRad) * radius;
                  const y = Math.sin(angleRad) * radius;
                  
                  return (
                    <button
                      key={idx}
                      onClick={btn.onClick}
                      title={btn.title}
                      className={`
                        absolute w-10 h-10 rounded-full shadow-lg flex items-center justify-center text-xs font-black transition-all duration-500 border border-gray-100
                        ${btn.color} hover:scale-110 active:scale-95 cursor-pointer
                      `}
                      style={{
                        transform: isCapsuleExpanded 
                          ? `translate(${x}px, ${y}px) scale(1)` 
                          : `translate(0, 0) scale(0)`,
                        opacity: isCapsuleExpanded ? 1 : 0,
                        zIndex: 100 - idx
                      }}
                    >
                      {btn.icon ? <i className={`fa-solid ${btn.icon}`}></i> : btn.label}
                    </button>
                  );
                })}
              </div>

              {/* Small Bubble (Toggle) */}
              <button 
                onClick={() => setIsCapsuleExpanded(!isCapsuleExpanded)}
                className={`
                  w-12 h-12 rounded-full shadow-2xl flex items-center justify-center text-xl transition-all duration-300 active:scale-90 cursor-pointer z-[101]
                  ${isCapsuleExpanded ? 'bg-gray-800 text-white rotate-45' : 'bg-primary-600 text-white rotate-0'}
                `}
              >
                <i className={`fa-solid ${isCapsuleExpanded ? 'fa-xmark' : 'fa-hand-pointer'}`}></i>
                {!isCapsuleExpanded && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-4 w-4 bg-primary-500 border-2 border-white"></span>
                  </span>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {viewType === 'Dashboard' ? (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
          {/* Dashboard Stats Summary - Visible to Admin always, and to Managers/Staff only for their own branch. Also respects user preference and branch manager setting for staff. */}
          {currentUser.showDashboardInfoTiles !== false && (
            currentUser.role === 'ADMIN' || 
            currentUser.role === 'S-ADMIN' || 
            (currentBranchId !== 'all' && currentBranchId === currentUser.branchId && (
              currentUser.role === 'Manager' || 
              (currentUser.role === 'Staff' && branches.find(b => b.id === currentBranchId)?.showDashboardToStaff !== false)
            ))
          ) && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                <div className="w-12 h-12 bg-primary-50 text-primary-600 rounded-xl flex items-center justify-center text-xl">
                  <i className="fa-solid fa-calendar-check"></i>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Allowance</p>
                  <p className="text-xl font-black text-gray-800">{dashboardStats.total}<span className="text-xs font-bold ml-1 text-gray-400">Days</span></p>
                </div>
              </div>
              <div 
                onClick={dashboardStats.approvedCount > 0 ? scrollToApproved : undefined}
                className={`bg-white p-5 rounded-2xl shadow-sm border flex items-center gap-4 transition-all ${
                  dashboardStats.approvedCount > 0 
                    ? "border-emerald-100 cursor-pointer hover:scale-[1.02] hover:shadow-md" 
                    : "border-gray-100"
                }`}
              >
                <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center text-xl relative">
                  <i className="fa-solid fa-umbrella-beach"></i>
                  {dashboardStats.approvedCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center bg-emerald-500 text-white text-[10px] font-black rounded-full border-2 border-white shadow-sm">
                      {dashboardStats.approvedCount}
                    </span>
                  )}
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Used</p>
                  <p className="text-xl font-black text-emerald-600">{dashboardStats.used}<span className="text-xs font-bold ml-1 text-emerald-400">Days</span></p>
                </div>
              </div>
              <div 
                onClick={dashboardStats.pendingCount > 0 ? scrollToPending : undefined}
                className={`bg-white p-5 rounded-2xl shadow-sm border flex items-center gap-4 transition-all ${
                  dashboardStats.pendingCount > 0 
                    ? "border-rose-400 animate-pulse-subtle cursor-pointer hover:scale-[1.02] hover:shadow-md" 
                    : "border-gray-100"
                }`}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl relative ${
                  dashboardStats.pendingCount > 0 ? "bg-rose-50 text-rose-600" : "bg-amber-50 text-amber-600"
                }`}>
                  <i className="fa-solid fa-clock"></i>
                  {dashboardStats.pendingCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center bg-rose-500 text-white text-[10px] font-black rounded-full border-2 border-white shadow-sm">
                      {dashboardStats.pendingCount}
                    </span>
                  )}
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Pending Requests</p>
                  <p className={`text-xl font-black ${dashboardStats.pendingCount > 0 ? "text-rose-600" : "text-amber-600"}`}>
                    {dashboardStats.pending}<span className={`text-xs font-bold ml-1 ${dashboardStats.pendingCount > 0 ? "text-rose-400" : "text-amber-400"}`}>Days</span>
                  </p>
                </div>
              </div>
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                <div className="w-12 h-12 bg-primary-600 text-white rounded-xl flex items-center justify-center text-xl shadow-lg shadow-primary-200">
                  <i className="fa-solid fa-pie-chart"></i>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Remaining Balance</p>
                  <p className="text-xl font-black text-primary-600">{dashboardStats.remaining}<span className="text-xs font-bold ml-1 text-primary-400">Days</span></p>
                </div>
              </div>
            </div>
          )}

          <DashboardCharts 
            requests={requests}
            branches={branches}
            staff={staff}
            systemConfig={systemConfig}
            currentBranchId={currentBranchId || 'all'}
            dashboardFilter={dashboardFilter}
            onRequestClick={handleRequestClick}
            currentUser={currentUser}
          />
        </div>
      ) : (
        <YearlyCalendar 
          role={role}
          currentUser={currentUser}
          currentBranchId={currentBranchId || 'all'}
          requests={requests}
          branches={branches}
          staff={staff}
          systemConfig={systemConfig}
          onAddRequest={onAddRequest}
          onUpdateRequest={onUpdateRequest}
          onDeleteRequest={onDeleteRequest}
          onDayClick={handleDayClick}
          onRequestClick={handleRequestClick}
          selectedCategories={selectedCategories}
          selectedYear={selectedYear}
          isShrunk={isShrunk}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />
      )}

      <HolidayModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        staff={staff}
        requests={requests}
        systemConfig={systemConfig}
        branches={branches}
        selectedBranchId={selectedRequest ? selectedRequest.branchId : currentBranchId}
        currentUser={currentUser}
        role={role}
        onSave={selectedRequest ? onUpdateRequest : onAddRequest}
        onDelete={onDeleteRequest}
        editingRequest={selectedRequest}
        initialDate={activeDate}
      />
    </div>
  );
};

export default MainView;
