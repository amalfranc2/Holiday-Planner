import React, { useState, useMemo } from 'react';
import { Branch, Staff, HolidayRequest } from '../types';
import { format, startOfMonth, addMonths, isWithinInterval, parseISO, endOfMonth } from 'date-fns';

interface ReportsProps {
  branches: Branch[];
  staff: Staff[];
  requests: HolidayRequest[];
}

const Reports: React.FC<ReportsProps> = ({ branches, staff, requests }) => {
  const [reportType, setReportType] = useState<'branch' | 'staff'>('branch');
  
  // Default date range: start of current month to end of next month (2 months total)
  const defaultStart = startOfMonth(new Date());
  const defaultEnd = endOfMonth(addMonths(defaultStart, 1));
  
  const [startDate, setStartDate] = useState(format(defaultStart, 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(defaultEnd, 'yyyy-MM-dd'));

  const filteredRequests = useMemo(() => {
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    
    return requests.filter(req => {
      const reqStart = parseISO(req.startDate);
      const reqEnd = parseISO(req.endDate);
      
      // Check if the request overlaps with the selected interval
      return (
        isWithinInterval(reqStart, { start, end }) ||
        isWithinInterval(reqEnd, { start, end }) ||
        (reqStart < start && reqEnd > end)
      );
    });
  }, [requests, startDate, endDate]);

  const branchReports = useMemo(() => {
    return branches.map(branch => {
      const branchRequests = filteredRequests.filter(r => r.branchId === branch.id);
      return {
        ...branch,
        requests: branchRequests
      };
    }).filter(b => b.requests.length > 0);
  }, [branches, filteredRequests]);

  const staffReports = useMemo(() => {
    return staff.map(s => {
      const staffHistory = requests.filter(r => r.staffId === s.id);
      const branch = branches.find(b => b.id === s.branchId);
      return {
        ...s,
        branchName: branch?.name || 'Unknown',
        history: staffHistory.sort((a, b) => b.startDate.localeCompare(a.startDate))
      };
    }).filter(s => s.history.length > 0);
  }, [staff, requests, branches]);

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
            
            <div className="flex flex-wrap gap-4">
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
            {branchReports.length === 0 ? (
              <div className="text-center py-12 text-gray-400 italic">No requests found for this period.</div>
            ) : (
              branchReports.map(branch => (
                <div key={branch.id} className="break-inside-avoid">
                  <h3 className="text-lg font-bold text-gray-800 border-b-2 border-indigo-100 pb-2 mb-4 flex items-center justify-between">
                    <span>{branch.name} <span className="text-gray-400 font-normal text-sm">({branch.location})</span></span>
                    <span className="text-sm font-medium text-indigo-600">{branch.requests.length} Requests</span>
                  </h3>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-400 uppercase text-[10px] tracking-wider border-b">
                        <th className="pb-2 font-bold">Staff Name</th>
                        <th className="pb-2 font-bold">Category</th>
                        <th className="pb-2 font-bold">Start Date</th>
                        <th className="pb-2 font-bold">End Date</th>
                        <th className="pb-2 font-bold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {branch.requests.map(req => {
                        const s = staff.find(st => st.id === req.staffId);
                        return (
                          <tr key={req.id} className="hover:bg-gray-50 transition-colors">
                            <td className="py-3 font-medium text-gray-700">{s?.name || 'Unknown'}</td>
                            <td className="py-3 text-gray-500">{s?.category || '-'}</td>
                            <td className="py-3 text-gray-600">{format(parseISO(req.startDate), 'PP')}</td>
                            <td className="py-3 text-gray-600">{format(parseISO(req.endDate), 'PP')}</td>
                            <td className="py-3">
                              <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                                req.status === 'Approved' ? 'bg-green-100 text-green-700' :
                                req.status === 'Rejected' ? 'bg-red-100 text-red-700' :
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
            {staffReports.map(s => (
              <div key={s.id} className="break-inside-avoid">
                <div className="flex items-end justify-between border-b-2 border-indigo-100 pb-2 mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-800">{s.name}</h3>
                    <p className="text-xs text-gray-500">{s.category} • {s.branchName}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase font-bold text-gray-400">Allowance</p>
                    <p className="text-sm font-bold text-indigo-600">{s.totalAllowance} Days</p>
                  </div>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-400 uppercase text-[10px] tracking-wider border-b">
                      <th className="pb-2 font-bold">Period</th>
                      <th className="pb-2 font-bold">Status</th>
                      <th className="pb-2 font-bold">Notes</th>
                      <th className="pb-2 font-bold text-right">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {s.history.map(req => (
                      <tr key={req.id} className="hover:bg-gray-50 transition-colors">
                        <td className="py-3 text-gray-700">
                          {format(parseISO(req.startDate), 'MMM d')} - {format(parseISO(req.endDate), 'MMM d, yyyy')}
                        </td>
                        <td className="py-3">
                          <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                            req.status === 'Approved' ? 'bg-green-100 text-green-700' :
                            req.status === 'Rejected' ? 'bg-red-100 text-red-700' :
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
                    ))}
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
