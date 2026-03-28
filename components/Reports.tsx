import React, { useState, useMemo, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Branch, Staff, HolidayRequest, StaffCategory, User } from '../types';
import { format, startOfMonth, addMonths, isWithinInterval, parseISO, endOfMonth, differenceInDays } from 'date-fns';
import { CATEGORIES, THEMES } from '../constants';

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
  const [selectedBranchId, setSelectedBranchId] = useState<string>('all');
  const [selectedCategories, setSelectedCategories] = useState<StaffCategory[]>(['Kitchen', 'Counter', 'Manager']);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  
  // No longer forcing selectedBranchId to managerBranchId for managers globally
  // but we will use it in the filtering logic
  
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
    return staff
      .filter(s => {
        const categoryMatch = selectedCategories.includes(s.category);
        
        // Managers can only see staff from their own branch in Staff History mode
        let branchMatch = selectedBranchId === 'all' || s.branchId === selectedBranchId;
        if (isManager && managerBranchId) {
          branchMatch = s.branchId === managerBranchId;
        }
        
        return categoryMatch && branchMatch;
      })
      .map(s => {
        const staffHistory = requests.filter(r => r.staffId === s.id);
        const branch = branches.find(b => b.id === s.branchId);
        
        const approvedDays = staffHistory
          .filter(r => r.status === 'Approved' && parseISO(r.startDate).getFullYear() === selectedYear)
          .reduce((acc, r) => acc + calculateDays(r.startDate, r.endDate), 0);
          
        const pendingDays = staffHistory
          .filter(r => r.status === 'Pending' && parseISO(r.startDate).getFullYear() === selectedYear)
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
  }, [staff, requests, branches, selectedBranchId, selectedCategories, selectedYear]);

  const toggleCategory = (cat: StaffCategory) => {
    setSelectedCategories(prev => 
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const handleDownload = () => {
    const theme = THEMES[currentUser.themeColor || 'indigo'];
    const primary600 = theme['600'];
    // Convert hex to RGB array for jsPDF
    const hexToRgb = (hex: string) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return [r, g, b];
    };
    const headerColor = hexToRgb(primary600) as [number, number, number];

    const doc = new jsPDF();
    const title = reportType === 'branch' ? 'Branch-wise Holiday Report' : 'Staff Holiday History Report';
    const dateStr = format(new Date(), 'PPP');
    
    doc.setFontSize(20);
    doc.text(title, 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Generated on: ${dateStr}`, 14, 30);
    
    if (reportType === 'branch') {
      doc.text(`Period: ${format(parseISO(startDate), 'PP')} - ${format(parseISO(endDate), 'PP')}`, 14, 38);
      
      let currentY = 48;
      
      branchReports.forEach((branch, index) => {
        // Check if we need a new page for the header (if less than 40mm left)
        if (currentY > 250) {
          doc.addPage();
          currentY = 20;
        }
        
        doc.setFontSize(14);
        doc.setTextColor(0);
        doc.text(`${branch.name} (${branch.location})`, 14, currentY);
        doc.setFontSize(10);
        doc.text(`Pending: ${branch.pendingCount} | Approved: ${branch.approvedCount} | Total: ${branch.requests.length}`, 14, currentY + 7);
        
          const tableData = branch.requests.map(req => {
            const s = staff.find(st => st.id === req.staffId);
            return [
              `${s?.name || 'Unknown'}${req.isUrgent ? ' (URGENT)' : ''}`,
              s?.category || '-',
              format(parseISO(req.startDate), 'PP'),
              format(parseISO(req.endDate), 'PP'),
              calculateDays(req.startDate, req.endDate),
              req.status
            ];
          });
        
        autoTable(doc, {
          startY: currentY + 12,
          head: [['Staff Name', 'Category', 'Start Date', 'End Date', 'Days', 'Status']],
          body: tableData,
          theme: 'striped',
          headStyles: { fillColor: headerColor }
        });
        
        currentY = (doc as any).lastAutoTable.finalY + 20;
      });
    } else {
      doc.text(`Year: ${selectedYear}`, 14, 38);
      
      let currentY = 48;
      
      staffReports.forEach((s, index) => {
        // Check if we need a new page for the header (if less than 40mm left)
        if (currentY > 250) {
          doc.addPage();
          currentY = 20;
        }
        
        doc.setFontSize(14);
        doc.setTextColor(0);
        doc.text(`${s.name} (${s.category} • ${s.branchName})`, 14, currentY);
        doc.setFontSize(10);
        doc.text(`Allowance: ${s.totalAllowance}d | Used: ${s.approvedDays}d | Pending: ${s.pendingDays}d | Balance: ${s.balance}d`, 14, currentY + 7);
        
        const tableData = s.history.map(req => [
          `${format(parseISO(req.startDate), 'MMM d')} - ${format(parseISO(req.endDate), 'MMM d, yyyy')}${req.isUrgent ? ' (URGENT)' : ''}`,
          calculateDays(req.startDate, req.endDate),
          req.status,
          req.notes || '-',
          format(parseISO(req.createdAt), 'PP')
        ]);
        
        autoTable(doc, {
          startY: currentY + 12,
          head: [['Period', 'Days', 'Status', 'Notes', 'Created']],
          body: tableData,
          theme: 'striped',
          headStyles: { fillColor: headerColor }
        });
        
        currentY = (doc as any).lastAutoTable.finalY + 20;
      });
    }
    
    doc.save(`holiday-report-${reportType}-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Controls - Hidden during print */}
      <div className="mb-8 bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-gray-100 print:hidden overflow-hidden">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <i className="fa-solid fa-file-invoice text-primary-600"></i>
              Holiday Reports
            </h2>
            <button
              onClick={handleDownload}
              className="w-full sm:w-auto px-6 py-3 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 transition-all flex items-center justify-center gap-2 shadow-md"
            >
              <i className="fa-solid fa-download"></i>
              Download Report
            </button>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap gap-6 w-full overflow-hidden">
            <div className="flex flex-col min-w-0">
              <label className="text-[10px] uppercase font-bold text-gray-400 mb-1">Report Mode</label>
              <div className="flex bg-gray-100 p-1 rounded-xl overflow-x-auto no-scrollbar whitespace-nowrap">
                  <button
                    onClick={() => setReportType('branch')}
                    className={`px-5 py-3 rounded-lg text-sm font-bold transition-all ${
                      reportType === 'branch' ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Branch-wise
                  </button>
                  <button
                    onClick={() => setReportType('staff')}
                    className={`px-5 py-3 rounded-lg text-sm font-bold transition-all ${
                      reportType === 'staff' ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Staff History
                  </button>
                </div>
              </div>

              <div className="flex flex-col">
                <label className="text-[10px] uppercase font-bold text-gray-400 mb-1">Branch Filter</label>
                <select 
                  value={isManager && reportType === 'staff' ? (managerBranchId || 'all') : selectedBranchId}
                  onChange={(e) => setSelectedBranchId(e.target.value)}
                  disabled={isManager && reportType === 'staff'}
                  className={`px-4 py-3 border border-gray-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-primary-500 outline-none bg-white ${
                    isManager && reportType === 'staff' ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  <option value="all">All Branches</option>
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col min-w-0">
                <label className="text-[10px] uppercase font-bold text-gray-400 mb-1">Categories</label>
                <div className="flex bg-gray-100 p-1 rounded-xl overflow-x-auto no-scrollbar whitespace-nowrap">
                  {CATEGORIES.map(cat => (
                    <button
                      key={cat}
                      onClick={() => toggleCategory(cat)}
                      className={`px-4 py-2.5 rounded-lg text-xs font-bold uppercase transition-all ${
                        selectedCategories.includes(cat) 
                          ? 'bg-white shadow-sm text-primary-600' 
                          : 'text-gray-400 hover:text-gray-600'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {reportType === 'branch' ? (
                <div className="flex items-center gap-3">
                  <div className="flex flex-col">
                    <label className="text-[10px] uppercase font-bold text-gray-400 mb-1">From</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-primary-500 outline-none"
                    />
                  </div>
                  <div className="flex flex-col">
                    <label className="text-[10px] uppercase font-bold text-gray-400 mb-1">To</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-primary-500 outline-none"
                    />
                  </div>
                </div>
              ) : (
                <div className="flex flex-col min-w-0">
                  <label className="text-[10px] uppercase font-bold text-gray-400 mb-1">Year Filter</label>
                  <div className="flex bg-gray-100 p-1 rounded-xl overflow-x-auto no-scrollbar whitespace-nowrap">
                    {[2024, 2025, 2026, 2027].map(year => (
                      <button
                        key={year}
                        onClick={() => setSelectedYear(year)}
                        className={`px-5 py-2.5 rounded-lg text-xs font-bold transition-all ${
                          selectedYear === year ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'
                        }`}
                      >
                        {year}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
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
            <div className="bg-primary-50 p-4 rounded-xl flex gap-8 border border-primary-100 mb-8 print:hidden">
              <div>
                <p className="text-[10px] uppercase font-bold text-primary-400">Total Requests</p>
                <p className="text-xl font-bold text-primary-700">{filteredRequests.length}</p>
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
                  <h3 className="text-lg font-bold text-gray-800 border-b-2 border-primary-100 pb-2 mb-4 flex items-center justify-between">
                    <span>{branch.name} <span className="text-gray-400 font-normal text-sm">({branch.location})</span></span>
                    <div className="flex gap-4">
                      <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded-lg">
                        {branch.pendingCount} Pending
                      </span>
                      <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">
                        {branch.approvedCount} Approved
                      </span>
                      <span className="text-xs font-medium text-primary-600 bg-primary-50 px-2 py-1 rounded-lg">
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
                        <th className="pb-2 font-bold text-center">Doc</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {branch.requests.map(req => {
                        const s = staff.find(st => st.id === req.staffId);
                        const duration = calculateDays(req.startDate, req.endDate);
                        return (
                          <tr key={req.id} className="hover:bg-gray-50 transition-colors">
                            <td className="py-3 font-medium text-gray-700">
                              <div className="flex items-center gap-2">
                                {s?.name || 'Unknown'}
                                {req.isUrgent && (
                                  <span className="text-[8px] bg-red-600 text-white px-1 py-0.5 rounded font-black animate-pulse">URGENT</span>
                                )}
                              </div>
                            </td>
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
                            <td className="py-3 text-center">
                              {req.attachmentUrl ? (
                                <a 
                                  href={req.attachmentUrl} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-primary-600 hover:text-primary-700 transition-colors"
                                  title="View Attachment"
                                >
                                  <i className="fa-solid fa-paperclip"></i>
                                </a>
                              ) : (
                                <span className="text-gray-300">-</span>
                              )}
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
            <div className="bg-primary-50 p-4 rounded-xl flex gap-8 border border-primary-100 mb-8 print:hidden">
              <div>
                <p className="text-[10px] uppercase font-bold text-primary-400">Total Staff</p>
                <p className="text-xl font-bold text-primary-700">{staffReports.length}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-emerald-400">Total Used</p>
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
                <div className="flex items-end justify-between border-b-2 border-primary-100 pb-2 mb-4">
                  <div className="flex items-center gap-6">
                    <div>
                      <h3 className="text-lg font-bold text-gray-800">{s.name}</h3>
                      <p className="text-xs text-gray-500">{s.category} • {s.branchName}</p>
                    </div>
                    <div className="flex gap-2">
                      <div className="bg-primary-50 px-3 py-1 rounded-lg">
                        <p className="text-[8px] uppercase font-bold text-primary-400 leading-none mb-1">Allowance</p>
                        <p className="text-xs font-bold text-primary-700">{s.totalAllowance}d</p>
                      </div>
                      <div className="bg-emerald-50 px-3 py-1 rounded-lg">
                        <p className="text-[8px] uppercase font-bold text-emerald-400 leading-none mb-1">Used</p>
                        <p className="text-xs font-bold text-emerald-700">{s.approvedDays}d</p>
                      </div>
                      <div className="bg-primary-50 px-3 py-1 rounded-lg">
                        <p className="text-[8px] uppercase font-bold text-primary-400 leading-none mb-1">Pending</p>
                        <p className="text-xs font-bold text-primary-700">{s.pendingDays}d</p>
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
                      <th className="pb-2 font-bold text-center">Doc</th>
                      <th className="pb-2 font-bold text-right">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {s.history.map(req => {
                      const duration = calculateDays(req.startDate, req.endDate);
                      return (
                        <tr key={req.id} className="hover:bg-gray-50 transition-colors">
                          <td className="py-3 text-gray-700">
                            <div className="flex items-center gap-2">
                              {format(parseISO(req.startDate), 'MMM d')} - {format(parseISO(req.endDate), 'MMM d, yyyy')}
                              {req.isUrgent && (
                                <span className="text-[8px] bg-red-600 text-white px-1 py-0.5 rounded font-black animate-pulse">URGENT</span>
                              )}
                            </div>
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
                          <td className="py-3 text-center">
                            {req.attachmentUrl ? (
                              <a 
                                href={req.attachmentUrl} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-primary-600 hover:text-primary-700 transition-colors"
                                title="View Attachment"
                              >
                                <i className="fa-solid fa-paperclip"></i>
                              </a>
                            ) : (
                              <span className="text-gray-300">-</span>
                            )}
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
