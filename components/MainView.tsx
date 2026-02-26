
import React, { useState } from 'react';
import { HolidayRequest, Staff, Branch, UserRole, StaffCategory, SystemConfig } from '../types';
import { BRANCHES, MOCK_STAFF, CATEGORIES } from '../constants';
import HolidayModal from './HolidayModal';

interface MainViewProps {
  role: UserRole;
  currentBranchId?: string;
  requests: HolidayRequest[];
  branches: Branch[];
  staff: Staff[];
  systemConfig: SystemConfig;
  onAddRequest: (req: Partial<HolidayRequest>) => void;
  onUpdateRequest: (req: Partial<HolidayRequest>) => void;
  onDeleteRequest: (id: string) => void;
}

const MainView: React.FC<MainViewProps> = ({ 
  role, currentBranchId, requests, branches, staff, systemConfig, onAddRequest, onUpdateRequest, onDeleteRequest 
}) => {
  const [viewType, setViewType] = useState<'Standard' | 'CrossBranch'>('Standard');
  const [monthsToDisplay, setMonthsToDisplay] = useState<1 | 3>(1);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<HolidayRequest | undefined>(undefined);
  const [activeDate, setActiveDate] = useState<Date | undefined>(undefined);
  const [selectedCategories, setSelectedCategories] = useState<StaffCategory[]>(['Kitchen', 'Counter', 'Driver']);

  const daysInMonth = (month: number, year: number) => new Date(year, month + 1, 0).getDate();
  
  const getStartOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();

  const getMonthName = (date: Date) => date.toLocaleString('default', { month: 'long' });
  const getYear = (date: Date) => date.getFullYear();

  const navigateMonth = (direction: number) => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + (direction * monthsToDisplay), 1));
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

  const toggleCategory = (cat: StaffCategory) => {
    setSelectedCategories(prev => 
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const isHO = role === 'HeadOffice';
  const displayBranchId = (isHO && currentBranchId !== 'all') ? currentBranchId : (currentBranchId || branches[0]?.id);

  const handleDayClick = (date: Date) => {
    setActiveDate(date);
    if (role === 'Manager') {
      setSelectedRequest(undefined);
      setIsModalOpen(true);
    }
  };

  const handleRequestClick = (e: React.MouseEvent, req: HolidayRequest) => {
    e.stopPropagation();
    setSelectedRequest(req);
    setIsModalOpen(true);
  };

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
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="py-2 text-center text-[10px] font-bold text-gray-400 uppercase tracking-widest">
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
                className={`min-h-[100px] p-1.5 border-r border-b border-gray-100 transition-colors ${isCurrentMonth ? 'bg-white cursor-pointer hover:bg-gray-50' : 'bg-gray-50/50'}`}
              >
                {isCurrentMonth && (
                  <div className="flex justify-between items-center mb-1">
                    <span className={`text-[10px] font-bold ${new Date().toDateString() === date.toDateString() ? 'bg-indigo-600 text-white w-5 h-5 flex items-center justify-center rounded-full' : 'text-gray-400'}`}>
                      {dayNum}
                    </span>
                  </div>
                )}
                <div className="space-y-1">
                  {dateRequests.map(r => {
                    const sMember = staff.find(s => s.id === r.staffId);
                    const isOwnBranch = r.branchId === currentBranchId;
                    const branch = branches.find(b => b.id === r.branchId);
                    return (
                      <div 
                        key={r.id}
                        onClick={(e) => handleRequestClick(e, r)}
                        className={`text-[9px] p-1 rounded border transition-all truncate group relative ${
                          r.status === 'Approved' 
                            ? 'bg-emerald-100 border-emerald-200 text-emerald-800' 
                            : 'bg-red-50 border-red-100 text-red-700 opacity-80'
                        } ${isHO || isOwnBranch ? 'hover:scale-105 hover:shadow-sm' : 'opacity-40 cursor-not-allowed'}`}
                      >
                        <span className="font-bold">[{sMember?.category[0]}]</span> {sMember?.name}
                        {!isOwnBranch && <div className="text-[7px] opacity-70">{branch?.name}</div>}
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
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center bg-gray-100 rounded-lg p-1">
            <button onClick={() => navigateMonth(-1)} className="p-2 hover:bg-white rounded-md transition-all">
              <i className="fa-solid fa-chevron-left text-gray-600"></i>
            </button>
            <h2 className="px-4 font-bold text-gray-800 min-w-[150px] text-center">
              {monthsToDisplay === 1 ? `${getMonthName(currentDate)} ${getYear(currentDate)}` : 'Quarterly View'}
            </h2>
            <button onClick={() => navigateMonth(1)} className="p-2 hover:bg-white rounded-md transition-all">
              <i className="fa-solid fa-chevron-right text-gray-600"></i>
            </button>
          </div>

          <div className="flex bg-gray-100 rounded-lg p-1">
            <button 
              onClick={() => setMonthsToDisplay(1)}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${monthsToDisplay === 1 ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500'}`}
            >
              1 Month
            </button>
            <button 
              onClick={() => setMonthsToDisplay(3)}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${monthsToDisplay === 3 ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500'}`}
            >
              3 Months
            </button>
          </div>
          {isHO && (
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button 
                onClick={() => setViewType('Standard')}
                className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all ${viewType === 'Standard' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500'}`}
              >
                Calendar
              </button>
              <button 
                onClick={() => setViewType('CrossBranch')}
                className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all ${viewType === 'CrossBranch' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500'}`}
              >
                Cross-Branch Heatmap
              </button>
            </div>
          )}
          <div className="flex bg-gray-100 rounded-lg p-1">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => toggleCategory(cat)}
                className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all ${
                  selectedCategories.includes(cat) 
                    ? 'bg-white shadow-sm text-indigo-600' 
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="flex gap-4 text-xs font-semibold">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-200 border border-red-300"></span>
              <span className="text-gray-600">Pending</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-400 border border-emerald-500"></span>
              <span className="text-gray-600">Approved</span>
            </div>
          </div>
          {role === 'Manager' && (
            <button 
              onClick={() => { setSelectedRequest(undefined); setIsModalOpen(true); }}
              className="flex-1 md:flex-none px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-md active:scale-95"
            >
              <i className="fa-solid fa-plus mr-2"></i> Request Holiday
            </button>
          )}
        </div>
      </div>

      {viewType === 'Standard' ? (
        <div className={`flex flex-col ${monthsToDisplay === 3 ? 'xl:flex-row' : ''} gap-6`}>
          {Array.from({ length: monthsToDisplay }).map((_, i) => {
            const date = new Date(currentDate.getFullYear(), currentDate.getMonth() + i, 1);
            return renderMonth(date);
          })}
        </div>
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
                  <th className="p-4 text-xs font-bold text-gray-500 uppercase border-b border-gray-100 sticky left-0 bg-gray-50 z-10">Category</th>
                  {Array.from({ length: daysInMonth(currentDate.getMonth(), currentDate.getFullYear()) }).map((_, i) => (
                    <th key={i} className="p-2 text-center text-[10px] font-bold text-gray-400 border-b border-gray-100 min-w-[40px]">
                      {i + 1}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {CATEGORIES.map(cat => (
                  <tr key={cat} className="hover:bg-gray-50 transition-colors">
                    <td className="p-4 text-sm font-bold text-gray-700 border-b border-gray-100 sticky left-0 bg-white z-10 shadow-sm">{cat}</td>
                    {Array.from({ length: daysInMonth(currentDate.getMonth(), currentDate.getFullYear()) }).map((_, dayIdx) => {
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

                      return (
                        <td 
                          key={day} 
                          onClick={() => setActiveDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), day))}
                          className={`p-2 text-center text-xs font-bold border-b border-gray-100 border-r cursor-pointer transition-colors ${bgColor} ${textColor} ${activeDate?.getDate() === day ? 'ring-2 ring-indigo-500 ring-inset' : ''}`}
                        >
                          {count > 0 ? count : '-'}
                        </td>
                      );
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
        selectedBranchId={selectedRequest ? selectedRequest.branchId : displayBranchId}
        userBranchId={currentBranchId}
        role={role}
        onSave={selectedRequest ? onUpdateRequest : onAddRequest}
        editingRequest={selectedRequest}
        initialDate={activeDate}
      />
    </div>
  );
};

export default MainView;
