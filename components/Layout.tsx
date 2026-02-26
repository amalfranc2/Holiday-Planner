
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
  branches: Branch[];
  currentView: 'Calendar' | 'Settings';
  onViewChange: (view: 'Calendar' | 'Settings') => void;
}

const Layout: React.FC<LayoutProps> = ({ 
  children, role, currentUser, currentBranchId, onBranchChange, onLogout, hideHeader, branches, currentView, onViewChange 
}) => {
  if (hideHeader) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <div className="bg-indigo-700 h-1.5 w-full"></div>
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
          <div className="mb-6 flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-lg border border-gray-100">
                <div className="w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center text-[10px] font-bold">
                  {currentUser.name[0]}
                </div>
                <span className="text-xs font-bold text-gray-700">{currentUser.name}</span>
              </div>
              <button 
                onClick={() => onViewChange(currentView === 'Calendar' ? 'Settings' : 'Calendar')}
                className={`p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-all ${currentView === 'Settings' ? 'text-indigo-600 bg-indigo-50' : ''}`}
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
            {role === 'Manager' && (
              <div className="text-xs font-bold text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-lg">
                {branches.find(b => b.id === currentBranchId)?.name}
              </div>
            )}
            {role === 'HeadOffice' && (
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
      <header className="bg-indigo-700 text-white shadow-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
          <div className="flex items-center space-x-2">
            <i className="fa-solid fa-calendar-days text-2xl"></i>
            <h1 className="text-xl font-bold tracking-tight">Glenn Anthony</h1>
          </div>
          
          <div className="flex flex-wrap justify-center items-center gap-4">
            <div className="flex items-center gap-3 px-4 py-2 bg-indigo-800 rounded-xl border border-indigo-600/30">
              <div className="w-8 h-8 bg-white text-indigo-700 rounded-full flex items-center justify-center font-bold shadow-sm">
                {currentUser.name[0]}
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold leading-none">{currentUser.name}</span>
                <span className="text-[10px] opacity-60 uppercase tracking-widest font-bold mt-1">{currentUser.role}</span>
              </div>
            </div>

            <button 
              onClick={() => onViewChange(currentView === 'Calendar' ? 'Settings' : 'Calendar')}
              className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all ${currentView === 'Settings' ? 'bg-white text-indigo-700 shadow-inner' : 'bg-indigo-800 text-indigo-100 hover:bg-indigo-600'}`}
              title="Settings"
            >
              <i className="fa-solid fa-gear"></i>
            </button>

            <button 
              onClick={onLogout}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-indigo-800 text-indigo-100 hover:bg-red-500 hover:text-white transition-all"
              title="Logout"
            >
              <i className="fa-solid fa-right-from-bracket"></i>
            </button>

            {role === 'HeadOffice' && (
              <select 
                value={currentBranchId}
                onChange={(e) => onBranchChange(e.target.value)}
                className="bg-indigo-800 border-none rounded-md text-sm font-medium px-3 py-1.5 focus:ring-2 focus:ring-white transition-all cursor-pointer"
              >
                <option value="all">All Branches</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            )}
            
            {role === 'Manager' && (
              <div className="bg-indigo-800 px-4 py-1.5 rounded-md text-sm font-bold border border-indigo-600/50">
                {branches.find(b => b.id === currentBranchId)?.name}
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      <footer className="bg-white border-t border-gray-200 py-6 text-center text-gray-400 text-xs">
        <p>&copy; 2026 Glenn Anthony Systems. Microsoft 365 Optimized.</p>
      </footer>
    </div>
  );
};

export default Layout;
