import React, { useState, useMemo, useEffect } from 'react';
import { Branch, Staff, HolidayRequest, StaffCategory, User } from '../types';
import { format, startOfMonth, addMonths, isWithinInterval, parseISO, endOfMonth, differenceInDays } from 'date-fns';
import { CATEGORIES } from '../constants';

interface ReportsProps {
  branches: Branch[];
  staff: Staff[];
  requests: HolidayRequest[];
  currentUser: User;
}

const Reports: React.FC<ReportsProps> = ({ branches, staff, requests, currentUser }) => {
  const isManager = currentUser.role === 'Manager';
  const managerBranchId = currentUser.branchId;

  const [reportType, setReportType] = useState<'branch' | 'staff'>('branch');
  const [selectedBranchId, setSelectedBranchId] = useState<string>(isManager ? (managerBranchId || 'all') : 'all');
  const [selectedCategories, setSelectedCategories] = useState<StaffCategory[]>(['Kitchen', 'Counter', 'Driver']);
  
  // Update selectedBranchId if currentUser changes (though unlikely during a session)
  useEffect(() => {
    if (isManager && managerBranchId) {
      setSelectedBranchId(managerBranchId);
    }
  }, [isManager, managerBranchId]);
  
  // Default date range: start of current month to end of next month (2 months total)
  const defaultStart = startOfMonth(new Date());
  const defaultEnd = endOfMonth(addMonths(defaultStart, 1));
  
  const [startDate, setStartDate] = useState(format(defaultStart, 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(defaultEnd, 'yyyy-MM-dd'));

  const calculateDays = (start: string, end: string) => {
    const s = parseISO(start);
    const e = parseISO(end);
    return differenceInDays(e, s) + 1;
  };

  const filteredRequests = useMemo(() => {
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    
    return requests.filter(req => {
      const reqStart = parseISO(req.startDate);
      const reqEnd = parseISO(req.endDate);
      
      const sMember = staff.find(s => s.id === req.staffId);
      const categoryMatch = sMember && selectedCategories.includes(sMember.category);
      const branchMatch = selectedBranchId === 'all' || req.branchId === selectedBranchId;

      if (!categoryMatch || !branchMatch) return false;

      // Check if the request overlaps with the selected interval
      return (
        isWithinInterval(reqStart, { start, end }) ||
        isWithinInterval(reqEnd, { start, end }) ||
        (reqStart < start && reqEnd > end)
      );
    });
  }, [requests, startDate, endDate, selectedBranchId, selectedCategories, staff]);

  const branchReports = useMemo(() => {
    const relevantBranches = selectedBranchId === 'all' 
      ? branches 
      : branches.filter(b => b.id === selectedBranchId);

    return relevantBranches.map(branch => {
      const branchRequests = filteredRequests.filter(r => r.branchId === branch.id);
      const pendingCount = branchRequests.filter(r => r.status === 'Pending').length;
      const approvedCount = branchRequests.filter(r => r.status === 'Approved').length;
      
      return {
        ...branch,
        requests: branchRequests,
        pendingCount,
        approvedCount
      };
    }).filter(b => b.requests.length > 0);
  }, [branches, filteredRequests, selectedBranchId]);

  const staffReports = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return staff
      .filter(s => {
        const categoryMatch = selectedCategories.includes(s.category);
        const branchMatch = selectedBranchId === 'all' || s.branchId === selectedBranchId;
        return categoryMatch && branchMatch;
      })
      .map(s => {
        const staffHistory = requests.filter(r => r.staffId === s.id);
        const branch = branches.find(b => b.id === s.branchId);
        
        const approvedDays = staffHistory
          .filter(r => r.status === 'Approved' && new Date(r.startDate).getFullYear() === currentYear)
          .reduce((acc, r) => acc + calculateDays(r.startDate, r.endDate), 0);
          
        const pendingDays = staffHistory
          .filter(r => r.status === 'Pending' && new Date(r.startDate).getFullYear() === currentYear)
          .reduce((acc, r) => acc + calculateDays(r.startDate, r.endDate), 0);

        const balance = s.totalAllowance - approvedDays;

        return {
          ...s,
          branchName: branch?.name || 'Unknown',
          approvedDays,
          pendingDays,
          balance,
          history: staffHistory.sort((a, b) => b.startDate.localeCompare(a.startDate))
        };
      })
      .filter(s => s.history.length > 0);
  }, [staff, requests, branches, selectedBranchId, selectedCategories]);

  const toggleCategory = (cat: StaffCategory) => {
    setSelectedCategories(prev => 
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Controls - Hidden during print */}
      <div className="mb-8 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 print:hidden">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="flex-1 space-y-4">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <i className="fa-solid fa-file-invoice text-indigo-600"></i>
              Holiday Reports
            </h2>
            
            <div className="flex flex-wrap gap-6">
              <div className="flex flex-col">
                <label className="text-[10px] uppercase font-bold text-gray-400 mb-1">Report Mode</label>
                <div className="flex bg-gray-100 p-1 rounded-xl">
                  <button
                    onClick={() => setReportType('branch')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      reportType === 'branch' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Branch-wise
                  </button>
                  <button
                    onClick={() => setReportType('staff')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      reportType === 'staff' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Staff History
                  </button>
                </div>
              </div>

              <div className="flex flex-col">
                <label className="text-[10px] uppercase font-bold text-gray-400 mb-1">Branch Filter</label>
                <select 
                  value={selectedBranchId}
                  onChange={(e) => setSelectedBranchId(e.target.value)}
                  disabled={isManager}
                  className={`px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white ${isManager ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {!isManager && <option value="all">All Branches</option>}
                  {branches
                    .filter(b => !isManager || b.id === managerBranchId)
                    .map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                </select>
              </div>

              <div className="flex flex-col">
                <label className="text-[10px] uppercase font-bold text-gray-400 mb-1">Categories</label>
                <div className="flex bg-gray-100 p-1 rounded-xl">
                  {CATEGORIES.map(cat => (
                    <button
                      key={cat}
                      onClick={() => toggleCategory(cat)}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${
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

              {reportType === 'branch' && (
                <div className="flex items-center gap-3">
                  <div className="flex flex-col">
                    <label className="text-[10px] uppercase font-bold text-gray-400 mb-1">From</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <div className="flex flex-col">
                    <label className="text-[10px] uppercase font-bold text-gray-400 mb-1">To</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <button
            onClick={handlePrint}
            className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-md"
          >
            <i className="fa-solid fa-print"></i>
            Print Report
          </button>
        </div>
      </div>

      {/* Report Content */}
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 print:shadow-none print:border-none print:p-0">
        <div className="hidden print:block mb-8 border-b pb-4">
          <h1 className="text-2xl font-bold text-gray-900">Holiday Planner Report</h1>
          <p className="text-gray-500 text-sm">Generated on {format(new Date(), 'PPP')}</p>
          {reportType === 'branch' && (
            <p className="text-gray-500 text-sm">Period: {format(parseISO(startDate), 'PP')} - {format(parseISO(endDate), 'PP')}</p>
          )}
        </div>

        {reportType === 'branch' ? (
          <div className="space-y-12">
            <div className="bg-indigo-50 p-4 rounded-xl flex gap-8 border border-indigo-100 mb-8 print:hidden">
              <div>
                <p className="text-[10px] uppercase font-bold text-indigo-400">Total Requests</p>
                <p className="text-xl font-bold text-indigo-700">{filteredRequests.length}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-emerald-400">Approved Days</p>
                <p className="text-xl font-bold text-emerald-700">
                  {filteredRequests.filter(r => r.status === 'Approved').reduce((acc, r) => acc + calculateDays(r.startDate, r.endDate), 0)}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-amber-400">Pending Days</p>
                <p className="text-xl font-bold text-amber-700">
                  {filteredRequests.filter(r => r.status === 'Pending').reduce((acc, r) => acc + calculateDays(r.startDate, r.endDate), 0)}
                </p>
              </div>
            </div>
            {branchReports.length === 0 ? (
              <div className="text-center py-12 text-gray-400 italic">No requests found for this period.</div>
            ) : (
              branchReports.map(branch => (
                <div key={branch.id} className="break-inside-avoid">
                  <h3 className="text-lg font-bold text-gray-800 border-b-2 border-indigo-100 pb-2 mb-4 flex items-center justify-between">
                    <span>{branch.name} <span className="text-gray-400 font-normal text-sm">({branch.location})</span></span>
                    <div className="flex gap-4">
                      <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded-lg">
                        {branch.pendingCount} Pending
                      </span>
                      <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">
                        {branch.approvedCount} Approved
                      </span>
                      <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg">
                        {branch.requests.length} Total
                      </span>
                    </div>
                  </h3>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-400 uppercase text-[10px] tracking-wider border-b">
                        <th className="pb-2 font-bold">Staff Name</th>
                        <th className="pb-2 font-bold">Category</th>
                        <th className="pb-2 font-bold">Start Date</th>
                        <th className="pb-2 font-bold">End Date</th>
                        <th className="pb-2 font-bold text-center">Days</th>
                        <th className="pb-2 font-bold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {branch.requests.map(req => {
                        const s = staff.find(st => st.id === req.staffId);
                        const duration = calculateDays(req.startDate, req.endDate);
                        return (
                          <tr key={req.id} className="hover:bg-gray-50 transition-colors">
                            <td className="py-3 font-medium text-gray-700">{s?.name || 'Unknown'}</td>
                            <td className="py-3 text-gray-500">{s?.category || '-'}</td>
                            <td className="py-3 text-gray-600">{format(parseISO(req.startDate), 'PP')}</td>
                            <td className="py-3 text-gray-600">{format(parseISO(req.endDate), 'PP')}</td>
                            <td className="py-3 text-center">
                              <span className="text-[10px] font-bold bg-gray-100 px-2 py-0.5 rounded-full text-gray-600">
                                {duration}d
                              </span>
                            </td>
                            <td className="py-3">
                              <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                                req.status === 'Approved' ? 'bg-green-100 text-green-700' :
                                req.status === 'Rejected' ? 'bg-red-100 text-red-700' :
                                req.status === 'Withdrawn' ? 'bg-gray-100 text-gray-500' :
                                'bg-amber-100 text-amber-700'
                              }`}>
                                {req.status}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="space-y-12">
            <div className="bg-indigo-50 p-4 rounded-xl flex gap-8 border border-indigo-100 mb-8 print:hidden">
              <div>
                <p className="text-[10px] uppercase font-bold text-indigo-400">Total Staff</p>
                <p className="text-xl font-bold text-indigo-700">{staffReports.length}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-emerald-400">Total Approved</p>
                <p className="text-xl font-bold text-emerald-700">
                  {staffReports.reduce((acc, s) => acc + s.approvedDays, 0)}d
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-amber-400">Total Pending</p>
                <p className="text-xl font-bold text-amber-700">
                  {staffReports.reduce((acc, s) => acc + s.pendingDays, 0)}d
                </p>
              </div>
            </div>
            {staffReports.map(s => (
              <div key={s.id} className="break-inside-avoid">
                <div className="flex items-end justify-between border-b-2 border-indigo-100 pb-2 mb-4">
                  <div className="flex items-center gap-6">
                    <div>
                      <h3 className="text-lg font-bold text-gray-800">{s.name}</h3>
                      <p className="text-xs text-gray-500">{s.category} • {s.branchName}</p>
                    </div>
                    <div className="flex gap-2">
                      <div className="bg-indigo-50 px-3 py-1 rounded-lg">
                        <p className="text-[8px] uppercase font-bold text-indigo-400 leading-none mb-1">Allowance</p>
                        <p className="text-xs font-bold text-indigo-700">{s.totalAllowance}d</p>
                      </div>
                      <div className="bg-emerald-50 px-3 py-1 rounded-lg">
                        <p className="text-[8px] uppercase font-bold text-emerald-400 leading-none mb-1">Approved</p>
                        <p className="text-xs font-bold text-emerald-700">{s.approvedDays}d</p>
                      </div>
                      <div className="bg-amber-50 px-3 py-1 rounded-lg">
                        <p className="text-[8px] uppercase font-bold text-amber-400 leading-none mb-1">Pending</p>
                        <p className="text-xs font-bold text-amber-700">{s.pendingDays}d</p>
                      </div>
                      <div className={`${s.balance < 0 ? 'bg-red-50' : 'bg-emerald-50'} px-3 py-1 rounded-lg`}>
                        <p className={`text-[8px] uppercase font-bold ${s.balance < 0 ? 'text-red-400' : 'text-emerald-400'} leading-none mb-1`}>
                          {s.balance < 0 ? 'Over Limit' : 'Balance'}
                        </p>
                        <p className={`text-xs font-bold ${s.balance < 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                          {Math.abs(s.balance)}d
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-400 uppercase text-[10px] tracking-wider border-b">
                      <th className="pb-2 font-bold">Period</th>
                      <th className="pb-2 font-bold text-center">Days</th>
                      <th className="pb-2 font-bold">Status</th>
                      <th className="pb-2 font-bold">Notes</th>
                      <th className="pb-2 font-bold text-right">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {s.history.map(req => {
                      const duration = calculateDays(req.startDate, req.endDate);
                      return (
                        <tr key={req.id} className="hover:bg-gray-50 transition-colors">
                          <td className="py-3 text-gray-700">
                            {format(parseISO(req.startDate), 'MMM d')} - {format(parseISO(req.endDate), 'MMM d, yyyy')}
                          </td>
                          <td className="py-3 text-center">
                            <span className="text-[10px] font-bold bg-gray-100 px-2 py-0.5 rounded-full text-gray-600">
                              {duration}d
                            </span>
                          </td>
                          <td className="py-3">
                            <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                              req.status === 'Approved' ? 'bg-emerald-100 text-emerald-700' :
                              req.status === 'Rejected' ? 'bg-red-100 text-red-700' :
                              req.status === 'Withdrawn' ? 'bg-gray-100 text-gray-500 line-through' :
                              'bg-amber-100 text-amber-700'
                            }`}>
                              {req.status}
                            </span>
                          </td>
                          <td className="py-3 text-gray-500 max-w-xs truncate italic">
                            {req.notes || '-'}
                          </td>
                          <td className="py-3 text-gray-400 text-xs text-right">
                            {format(parseISO(req.createdAt), 'PP')}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        @media print {
          body { background: white !important; }
          .print\\:hidden { display: none !important; }
          .print\\:shadow-none { box-shadow: none !important; }
          .print\\:border-none { border: none !important; }
          .print\\:p-0 { padding: 0 !important; }
          .break-inside-avoid { break-inside: avoid; }
        }
      `}</style>
    </div>
  );
};

export default Reports;
