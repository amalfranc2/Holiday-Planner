
import React from 'react';
import { UserRole, Branch, User } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  role: UserRole;
  currentUser: User;
  currentBranchId?: string;
  onBranchChange: (branchId: string) => void;
  onLogout: () => void;
  hideHeader?: boolean;
  isShrunk?: boolean;
  branches: Branch[];
  currentView: 'Calendar' | 'Settings' | 'Reports';
  onViewChange: (view: 'Calendar' | 'Settings' | 'Reports') => void;
  viewType: 'Dashboard' | 'Yearly';
  onViewTypeChange: (type: 'Dashboard' | 'Yearly') => void;
}

const Layout: React.FC<LayoutProps> = ({ 
  children, role, currentUser, currentBranchId, onBranchChange, onLogout, hideHeader, isShrunk, branches, currentView, onViewChange, viewType, onViewTypeChange 
}) => {
  if (hideHeader) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <div className="bg-primary-700 h-1.5 w-full"></div>
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
          <div className="mb-6 flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-lg border border-gray-100">
                <div className="w-6 h-6 bg-primary-600 text-white rounded-full flex items-center justify-center text-[10px] font-bold">
                  {currentUser.name[0]}
                </div>
                <span className="text-xs font-bold text-gray-700">{currentUser.name}</span>
              </div>
              <button 
                onClick={() => {
                  onViewChange('Calendar');
                  onViewTypeChange('Dashboard');
                }}
                className={`p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-all ${currentView === 'Calendar' && viewType === 'Dashboard' ? 'text-primary-600 bg-primary-50' : ''}`}
                title="Dashboard"
              >
                <i className="fa-solid fa-chart-simple"></i>
              </button>
              <button 
                onClick={() => {
                  onViewChange('Calendar');
                  onViewTypeChange('Yearly');
                }}
                className={`p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-all ${currentView === 'Calendar' && viewType === 'Yearly' ? 'text-primary-600 bg-primary-50' : ''}`}
                title="Planner"
              >
                <i className="fa-solid fa-calendar-days"></i>
              </button>
              <button 
                onClick={() => onViewChange('Reports')}
                className={`p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-all ${currentView === 'Reports' ? 'text-primary-600 bg-primary-50' : ''}`}
                title="Reports"
              >
                <i className="fa-solid fa-file-invoice"></i>
              </button>
              <button 
                onClick={() => onViewChange('Settings')}
                className={`p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-all ${currentView === 'Settings' ? 'text-primary-600 bg-primary-50' : ''}`}
                title="Settings"
              >
                <i className="fa-solid fa-gear"></i>
              </button>
              <button 
                onClick={onLogout}
                className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-all"
                title="Logout"
              >
                <i className="fa-solid fa-right-from-bracket"></i>
              </button>
            </div>
            {(role === 'HeadOffice' || role === 'Manager') && (
              <select value={currentBranchId} onChange={(e) => onBranchChange(e.target.value)} className="bg-gray-100 border-none rounded-md text-xs font-bold px-3 py-1.5">
                <option value="all">All Branches</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            )}
          </div>
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className={`bg-primary-700 text-white shadow-lg sticky top-0 z-50 transition-all duration-500 print:hidden ${isShrunk ? 'py-1' : 'py-4'}`}>
        <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex ${isShrunk ? 'flex-row' : 'flex-col md:flex-row'} justify-between items-center gap-2 transition-all duration-500 ${isShrunk ? 'scale-95 opacity-90' : 'scale-100 opacity-100'}`}>
          <div className="flex items-center space-x-2 cursor-pointer shrink-0" onClick={() => {
            onViewChange('Calendar');
            onViewTypeChange(currentUser.defaultView || 'Dashboard');
          }}>
            <i className={`fa-solid fa-calendar-days transition-all ${isShrunk ? 'text-base' : 'text-2xl'}`}></i>
            <h1 className={`font-bold tracking-tight transition-all ${isShrunk ? 'text-[10px] hidden sm:block' : 'text-xl'}`}>Glenn Anthony</h1>
          </div>
          
          <div className={`flex items-center ${isShrunk ? 'gap-1 sm:gap-2' : 'gap-2 sm:gap-4'} transition-all`}>
            <div className={`flex bg-primary-800 p-0.5 rounded-xl border border-primary-600/30 transition-all ${isShrunk ? 'scale-90' : 'scale-100'}`}>
              <button 
                onClick={() => {
                  onViewChange('Calendar');
                  onViewTypeChange('Dashboard');
                }}
                className={`px-2 sm:px-3 py-1 sm:py-1.5 flex items-center gap-2 rounded-lg transition-all text-[10px] sm:text-xs font-bold ${currentView === 'Calendar' && viewType === 'Dashboard' ? 'bg-white text-primary-700 shadow-sm' : 'text-primary-100 hover:bg-primary-600'}`}
              >
                <i className="fa-solid fa-chart-simple text-[10px]"></i>
                {!isShrunk && <span className="hidden sm:inline">Dashboard</span>}
              </button>
              <button 
                onClick={() => {
                  onViewChange('Calendar');
                  onViewTypeChange('Yearly');
                }}
                className={`px-2 sm:px-3 py-1 sm:py-1.5 flex items-center gap-2 rounded-lg transition-all text-[10px] sm:text-xs font-bold ${currentView === 'Calendar' && viewType === 'Yearly' ? 'bg-white text-primary-700 shadow-sm' : 'text-primary-100 hover:bg-primary-600'}`}
              >
                <i className="fa-solid fa-calendar-days text-[10px]"></i>
                {!isShrunk && <span className="hidden sm:inline">Planner</span>}
              </button>
              <button 
                onClick={() => onViewChange('Reports')}
                className={`px-2 sm:px-3 py-1 sm:py-1.5 flex items-center gap-2 rounded-lg transition-all text-[10px] sm:text-xs font-bold ${currentView === 'Reports' ? 'bg-white text-primary-700 shadow-sm' : 'text-primary-100 hover:bg-primary-600'}`}
              >
                <i className="fa-solid fa-file-invoice text-[10px]"></i>
                {!isShrunk && <span className="hidden sm:inline">Reports</span>}
              </button>
              <button 
                onClick={() => onViewChange('Settings')}
                className={`px-2 sm:px-3 py-1 sm:py-1.5 flex items-center gap-2 rounded-lg transition-all text-[10px] sm:text-xs font-bold ${currentView === 'Settings' ? 'bg-white text-primary-700 shadow-sm' : 'text-primary-100 hover:bg-primary-600'}`}
              >
                <i className="fa-solid fa-gear text-[10px]"></i>
                {!isShrunk && <span className="hidden sm:inline">Settings</span>}
              </button>
            </div>

            {(role === 'HeadOffice' || role === 'Manager') && (
              <select 
                value={currentBranchId}
                onChange={(e) => onBranchChange(e.target.value)}
                className={`bg-primary-800 border-none rounded-md font-bold focus:ring-1 focus:ring-white transition-all cursor-pointer ${isShrunk ? 'text-[9px] px-1.5 py-0.5 max-w-[60px] sm:max-w-[100px]' : 'text-xs sm:text-sm px-3 py-1.5'}`}
              >
                <option value="all">{isShrunk ? 'All' : 'All Branches'}</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            )}

            <div className={`flex items-center ${isShrunk ? 'gap-1' : 'gap-3 pl-2 sm:pl-4 border-l border-primary-600/50'}`}>
              {!isShrunk && (
                <div className="hidden sm:flex flex-col items-end">
                  <span className="text-xs font-bold leading-none">{currentUser.name}</span>
                  <span className="text-[10px] opacity-60 uppercase tracking-widest font-bold mt-1">{currentUser.role}</span>
                </div>
              )}
              <button 
                onClick={onLogout}
                className={`flex items-center justify-center rounded-lg sm:rounded-xl bg-primary-800 text-primary-100 hover:bg-red-500 hover:text-white transition-all shadow-sm ${isShrunk ? 'w-7 h-7' : 'w-8 h-8 sm:w-9 sm:h-9'}`}
                title="Logout"
              >
                <i className={`fa-solid fa-right-from-bracket ${isShrunk ? 'text-[10px]' : 'text-xs sm:text-base'}`}></i>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 print:p-0">
        {children}
      </main>

      <footer className="bg-white border-t border-gray-200 py-6 text-center text-gray-400 text-xs print:hidden">
        <p>&copy; 2026 Glenn Anthony Systems. Microsoft 365 Optimized.</p>
      </footer>
    </div>
  );
};

export default Layout;
