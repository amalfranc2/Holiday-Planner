
import React, { useState, useMemo, useEffect } from 'react';
import { HolidayRequest, Staff, Branch, UserRole, StaffCategory, SystemConfig, User } from '../types';
import { BRANCHES, MOCK_STAFF, CATEGORIES } from '../constants';
import HolidayModal from './HolidayModal';
import YearlyCalendar from './YearlyCalendar';

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
}

const MainView: React.FC<MainViewProps> = ({ 
  role, currentUser, currentBranchId, requests, branches, staff, systemConfig, onAddRequest, onUpdateRequest, onDeleteRequest, isShrunk 
}) => {
  const [viewType, setViewType] = useState<'Dashboard' | 'Yearly' | 'CrossBranch'>('Dashboard');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<HolidayRequest | undefined>(undefined);
  const [activeDate, setActiveDate] = useState<Date | undefined>(undefined);
  const [selectedCategories, setSelectedCategories] = useState<StaffCategory[]>(['Kitchen', 'Counter', 'Manager']);
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

  const isHO = role === 'HeadOffice';
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
    const approvedDays = branchRequests
      .filter(r => r.status === 'Approved' && new Date(r.startDate).getFullYear() === currentYear)
      .reduce((acc, r) => acc + calculateDays(r.startDate, r.endDate), 0);
    
    const pendingDays = branchRequests
      .filter(r => r.status === 'Pending' && new Date(r.startDate).getFullYear() === currentYear)
      .reduce((acc, r) => acc + calculateDays(r.startDate, r.endDate), 0);

    return {
      total: totalAllowance,
      used: approvedDays,
      pending: pendingDays,
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
                        <span className="font-bold">[{sMember?.category[0]}]</span> {sMember?.name}
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
            <div className="flex bg-gray-100 rounded-lg p-0.5">
              <button 
                onClick={() => setViewType('Dashboard')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${viewType === 'Dashboard' ? 'bg-white shadow-sm text-primary-600' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Dashboard
              </button>
              <button 
                onClick={() => setViewType('Yearly')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${viewType === 'Yearly' ? 'bg-white shadow-sm text-primary-600' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Planner
              </button>
              {isHO && (
                <button 
                  onClick={() => setViewType('CrossBranch')}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${viewType === 'CrossBranch' ? 'bg-white shadow-sm text-primary-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Heatmap
                </button>
              )}
            </div>

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

      {/* Persistent Expandable Floating Capsule */}
      {viewType !== 'Dashboard' && (
        <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end gap-2">
          {/* Expanded Capsule Content */}
          <div className={`
            bg-white/95 backdrop-blur-md shadow-2xl border border-primary-100 rounded-2xl 
            flex flex-col items-center gap-3 p-3 transition-all duration-500 origin-bottom-right
            ${isCapsuleExpanded ? 'scale-100 opacity-100 translate-y-0' : 'scale-0 opacity-0 translate-y-10 pointer-events-none'}
          `}>
            {/* Year Selector */}
            <div className="flex items-center gap-2 bg-gray-50 px-2 py-1.5 rounded-xl border border-gray-100">
              <button 
                onClick={() => navigateYear(-1)} 
                className="w-7 h-7 flex items-center justify-center hover:bg-white hover:shadow-sm rounded-lg transition-all cursor-pointer text-gray-600"
              >
                <i className="fa-solid fa-chevron-left text-[10px]"></i>
              </button>
              <span className="text-xs font-black text-primary-600 min-w-[35px] text-center">{selectedYear}</span>
              <button 
                onClick={() => navigateYear(1)} 
                className="w-7 h-7 flex items-center justify-center hover:bg-white hover:shadow-sm rounded-lg transition-all cursor-pointer text-gray-600"
              >
                <i className="fa-solid fa-chevron-right text-[10px]"></i>
              </button>
            </div>

            <div className="w-full h-px bg-gray-100"></div>

            {/* KCM Toggles */}
            <div className="flex items-center gap-2">
              {(['Kitchen', 'Counter', 'Manager'] as StaffCategory[]).map(cat => (
                <button
                  key={cat}
                  onClick={() => toggleCategory(cat)}
                  className={`
                    w-8 h-8 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center justify-center
                    ${selectedCategories.includes(cat) 
                      ? 'bg-primary-600 text-white shadow-sm' 
                      : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}
                  `}
                  title={cat}
                >
                  {cat[0]}
                </button>
              ))}
            </div>

            <div className="w-full h-px bg-gray-100"></div>

            {/* Back to Top */}
            <button 
              onClick={() => { 
                const scrollTargets = [window, document.documentElement, document.body, document.querySelector('main'), document.querySelector('#root')];
                scrollTargets.forEach(target => {
                  if (target && 'scrollTo' in target) (target as any).scrollTo({ top: 0, left: 0, behavior: 'auto' });
                  if (target && 'scrollTop' in target) (target as any).scrollTop = 0;
                });
                setIsCapsuleExpanded(false);
              }}
              className="w-full px-3 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-widest hover:text-primary-600 hover:bg-primary-50 rounded-xl transition-all cursor-pointer text-center"
            >
              <i className="fa-solid fa-arrow-up mr-1"></i>
              Top
            </button>
          </div>

          {/* Small Bubble (Toggle) - Reduced size to ~75% (10.5/14) */}
          <button 
            onClick={() => setIsCapsuleExpanded(!isCapsuleExpanded)}
            className={`
              w-10 h-10 rounded-full shadow-2xl flex items-center justify-center text-lg transition-all duration-300 active:scale-90 cursor-pointer
              ${isCapsuleExpanded ? 'bg-gray-800 text-white rotate-45' : 'bg-primary-600 text-white rotate-0'}
            `}
          >
            <i className={`fa-solid ${isCapsuleExpanded ? 'fa-xmark' : 'fa-calendar-days'}`}></i>
            {!isCapsuleExpanded && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center animate-bounce">
                !
              </span>
            )}
          </button>
        </div>
      )}

      {viewType === 'Dashboard' ? (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
          {/* Dashboard Stats Summary - Visible to Head Office always, and to Managers only for their own branch */}
          {(currentUser.role === 'HeadOffice' || (currentBranchId !== 'all' && currentBranchId === currentUser.branchId)) && (
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
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center text-xl">
                  <i className="fa-solid fa-umbrella-beach"></i>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Used</p>
                  <p className="text-xl font-black text-emerald-600">{dashboardStats.used}<span className="text-xs font-bold ml-1 text-emerald-400">Days</span></p>
                </div>
              </div>
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center text-xl">
                  <i className="fa-solid fa-clock"></i>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Pending</p>
                  <p className="text-xl font-black text-amber-600">{dashboardStats.pending}<span className="text-xs font-bold ml-1 text-amber-400">Days</span></p>
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

          <div className="flex justify-end">
            <div className="flex bg-gray-100 p-1 rounded-xl">
              <button
                onClick={() => setDashboardFilter('year')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${
                  dashboardFilter === 'year' ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                Current Year
              </button>
              <button
                onClick={() => setDashboardFilter('upcoming')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${
                  dashboardFilter === 'upcoming' ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                Next 3 Months
              </button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                  <i className="fa-solid fa-clock text-amber-500"></i>
                  Pending Requests
                </h3>
              </div>
              <div className="space-y-3">
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
                          onClick={(e) => handleRequestClick(e, r)}
                          className="p-3 bg-gray-50 rounded-xl border border-gray-100 hover:border-primary-200 cursor-pointer transition-all flex justify-between items-center group"
                        >
                          <div>
                            <div className="font-bold text-gray-800 flex items-center gap-2">
                              {sMember?.name}
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

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <i className="fa-solid fa-circle-check text-emerald-500"></i>
                Approved Requests
              </h3>
              <div className="space-y-3">
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
                          onClick={(e) => handleRequestClick(e, r)}
                          className="p-3 bg-gray-50 rounded-xl border border-gray-100 hover:border-primary-200 cursor-pointer transition-all flex justify-between items-center group"
                        >
                          <div>
                            <div className="font-bold text-gray-800 flex items-center gap-2">
                              {sMember?.name}
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
          </div>
        </div>
      ) : viewType === 'Yearly' ? (
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
        />
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex justify-between items-center">
            <h3 className="text-lg font-bold text-gray-800">Overlap Intelligence Map</h3>
            <div className="text-xs text-gray-500">Visualizing total staff off per category across all {branches.length} branches</div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  <th className="p-4 text-xs font-bold text-gray-500 uppercase border-b border-gray-100 sticky left-0 bg-gray-50 z-20">Category</th>
                  {(() => {
                    const days = daysInMonth(currentDate.getMonth(), currentDate.getFullYear());
                    return (
                      <th 
                        colSpan={days} 
                        className="p-2 text-center text-[10px] font-bold text-gray-600 border-b border-gray-100 border-r bg-gray-100/50 uppercase tracking-wider"
                      >
                        {getMonthName(currentDate)} {getYear(currentDate)}
                      </th>
                    );
                  })()}
                </tr>
                <tr className="bg-white">
                  <th className="p-4 border-b border-gray-100 sticky left-0 bg-white z-20"></th>
                  {(() => {
                    const days = daysInMonth(currentDate.getMonth(), currentDate.getFullYear());
                    return Array.from({ length: days }).map((_, dIdx) => (
                      <th key={dIdx} className="p-2 text-center text-[10px] font-bold text-gray-400 border-b border-gray-100 min-w-[35px] border-r">
                        {dIdx + 1}
                      </th>
                    ));
                  })()}
                </tr>
              </thead>
              <tbody>
                {CATEGORIES.map(cat => (
                  <tr key={cat} className="hover:bg-gray-50 transition-colors">
                    <td className="p-4 text-sm font-bold text-gray-700 border-b border-gray-100 sticky left-0 bg-white z-10 shadow-sm">{cat}</td>
                    {(() => {
                      const days = daysInMonth(currentDate.getMonth(), currentDate.getFullYear());
                      return Array.from({ length: days }).map((_, dayIdx) => {
                        const day = dayIdx + 1;
                        const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
                        const dateReqs = getRequestsForDate(date);
                        const count = dateReqs.filter(r => {
                          const s = staff.find(st => st.id === r.staffId);
                          return s?.category === cat;
                        }).length;
                        
                        // Calculate heat intensity
                        let bgColor = 'bg-white';
                        let textColor = 'text-gray-400';
                        if (count > 0) {
                          bgColor = 'bg-red-50';
                          textColor = 'text-red-600';
                        }
                        if (count > 1) {
                          bgColor = 'bg-red-100';
                          textColor = 'text-red-700';
                        }
                        if (count > 2) {
                          bgColor = 'bg-red-200';
                          textColor = 'text-red-800';
                        }
                        if (count > 3) {
                          bgColor = 'bg-red-400 animate-pulse';
                          textColor = 'text-white';
                        }

                        const isToday = date.toDateString() === new Date().toDateString();

                        return (
                          <td 
                            key={day} 
                            onClick={() => setActiveDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), day))}
                            className={`p-2 text-center text-xs font-bold border-b border-gray-100 border-r cursor-pointer transition-colors ${bgColor} ${textColor} ${activeDate?.toDateString() === date.toDateString() ? 'ring-2 ring-primary-500 ring-inset' : ''} ${isToday ? 'bg-primary-50/30' : ''}`}
                          >
                            {count > 0 ? count : '-'}
                          </td>
                        );
                      });
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <HolidayModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        staff={staff}
        requests={requests}
        systemConfig={systemConfig}
        branches={branches}
        selectedBranchId={selectedRequest ? selectedRequest.branchId : (currentBranchId === 'all' ? (currentUser.branchId || branches[0]?.id) : currentBranchId)}
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
