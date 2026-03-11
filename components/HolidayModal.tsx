
import React, { useState, useEffect } from 'react';
import { Staff, HolidayRequest, StaffCategory, UserRole, SystemConfig, User, Branch } from '../types';
import { CATEGORIES } from '../constants';

interface HolidayModalProps {
  isOpen: boolean;
  onClose: () => void;
  staff: Staff[];
  requests: HolidayRequest[];
  systemConfig: SystemConfig;
  branches: Branch[];
  selectedBranchId: string;
  currentUser: User;
  role: UserRole;
  onSave: (request: Partial<HolidayRequest>) => void;
  onDelete: (id: string) => void;
  editingRequest?: HolidayRequest;
  initialDate?: Date;
}

const HolidayModal: React.FC<HolidayModalProps> = ({ 
  isOpen, onClose, staff, requests, systemConfig, branches, selectedBranchId, currentUser, role, onSave, onDelete, editingRequest, initialDate 
}) => {
  const [formData, setFormData] = useState({
    staffId: '',
    startDate: '',
    endDate: '',
    notes: '',
    status: 'Pending' as 'Pending' | 'Approved' | 'Rejected' | 'Withdrawn',
    duration: 1
  });

  const calculateDays = (start: string, end: string) => {
    if (!start || !end) return 0;
    const s = new Date(start);
    const e = new Date(end);
    const diffTime = e.getTime() - s.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays > 0 ? diffDays : 0;
  };

  const addDays = (date: string, days: number) => {
    const d = new Date(date);
    d.setDate(d.getDate() + (days - 1));
    return d.toISOString().split('T')[0];
  };

  useEffect(() => {
    if (editingRequest) {
      setFormData({
        staffId: editingRequest.staffId,
        startDate: editingRequest.startDate,
        endDate: editingRequest.endDate,
        notes: editingRequest.notes || '',
        status: editingRequest.status,
        duration: calculateDays(editingRequest.startDate, editingRequest.endDate)
      });
    } else {
      const defaultDate = (initialDate || new Date()).toISOString().split('T')[0];
      setFormData({
        staffId: '',
        startDate: defaultDate,
        endDate: defaultDate,
        notes: '',
        status: 'Pending',
        duration: 1
      });
    }
  }, [editingRequest, initialDate, isOpen]);

  if (!isOpen) return null;

  const branchStaff = staff.filter(s => s.branchId === selectedBranchId);
  const selectedStaff = staff.find(s => s.id === formData.staffId);

  const calculateUsedDays = (staffId: string) => {
    return requests
      .filter(r => r.staffId === staffId && r.status === 'Approved' && r.id !== editingRequest?.id)
      .reduce((acc, r) => acc + calculateDays(r.startDate, r.endDate), 0);
  };

  const currentRequestDays = calculateDays(formData.startDate, formData.endDate);
  const usedDaysExcludingCurrent = formData.staffId ? calculateUsedDays(formData.staffId) : 0;
  
  // If the current request is approved, it should be counted in "used"
  const totalUsedIfApproved = usedDaysExcludingCurrent + (formData.status === 'Approved' ? currentRequestDays : 0);
  const remainingDays = selectedStaff ? selectedStaff.totalAllowance - totalUsedIfApproved : 0;
  
  const calculatePendingDays = (staffId: string) => {
    return requests
      .filter(r => r.staffId === staffId && r.status === 'Pending' && r.id !== editingRequest?.id)
      .reduce((acc, r) => acc + calculateDays(r.startDate, r.endDate), 0);
  };
  const pendingDays = formData.staffId ? calculatePendingDays(formData.staffId) : 0;
  const staffBranch = selectedStaff ? branches.find(b => b.id === selectedStaff.branchId) : null;

  const checkRotation = (staffId: string) => {
    const lastYear = new Date().getFullYear() - 1;
    const primeMonths = systemConfig.primeTimeMonths;
    return requests.some(r => {
      const start = new Date(r.startDate);
      return r.staffId === staffId && 
             r.status === 'Approved' && 
             start.getFullYear() === lastYear && 
             primeMonths.includes(start.getMonth());
    });
  };

  const hadPrimeTimeLastYear = formData.staffId ? checkRotation(formData.staffId) : false;

  const handleStartDateChange = (val: string) => {
    setFormData(prev => {
      const newEndDate = addDays(val, prev.duration);
      return { ...prev, startDate: val, endDate: newEndDate };
    });
  };

  const handleEndDateChange = (val: string) => {
    setFormData(prev => {
      const newDuration = calculateDays(prev.startDate, val);
      return { ...prev, endDate: val, duration: newDuration };
    });
  };

  const handleDurationChange = (val: number) => {
    setFormData(prev => {
      const newEndDate = addDays(prev.startDate, val);
      return { ...prev, duration: val, endDate: newEndDate };
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.staffId || !formData.startDate || !formData.endDate) return;
    onSave({
      staffId: formData.staffId,
      startDate: formData.startDate,
      endDate: formData.endDate,
      notes: formData.notes,
      status: formData.status,
      branchId: selectedBranchId,
      id: editingRequest?.id
    });
    onClose();
  };

  const isHO = role === 'HeadOffice';
  const isOwnBranch = editingRequest ? (editingRequest.branchId === currentUser.branchId) : (selectedBranchId === currentUser.branchId);
  const isReadOnly = !isHO && editingRequest && !isOwnBranch;

  const handleWithdraw = () => {
    if (!editingRequest) return;
    onSave({
      ...editingRequest,
      status: 'Withdrawn'
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900">
            {editingRequest ? 'Edit Holiday Request' : 'New Holiday Request'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <i className="fa-solid fa-xmark text-xl"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Staff Member</label>
            <select
              disabled={isReadOnly || !!editingRequest}
              value={formData.staffId}
              onChange={(e) => setFormData(prev => ({ ...prev, staffId: e.target.value }))}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 transition-all"
              required
            >
              <option value="">Select Staff</option>
              {branchStaff.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.category})</option>
              ))}
            </select>
            {selectedStaff && (
              <div className="mt-2 space-y-2">
                <div className="flex flex-wrap gap-2">
                  <div className={`text-[10px] font-bold px-2 py-1 rounded-full ${remainingDays < 0 ? 'bg-red-100 text-red-700' : 'bg-indigo-100 text-indigo-700'}`}>
                    Allowance: {totalUsedIfApproved}/{selectedStaff.totalAllowance} used ({remainingDays} left)
                  </div>
                  <div className="text-[10px] font-bold px-2 py-1 rounded-full bg-amber-100 text-amber-700">
                    Pending: {pendingDays} Days
                  </div>
                  <div className="text-[10px] font-bold px-2 py-1 rounded-full bg-gray-100 text-gray-600">
                    Branch: {staffBranch?.name || 'Unknown'}
                  </div>
                </div>
                {hadPrimeTimeLastYear && (
                  <div className="text-[10px] font-bold px-2 py-1 rounded-full bg-amber-100 text-amber-700 inline-block">
                    <i className="fa-solid fa-clock-rotate-left mr-1"></i> Had Prime Time Holiday Last Year
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Start Date</label>
              <input
                type="date"
                readOnly={isReadOnly}
                value={formData.startDate}
                onChange={(e) => handleStartDateChange(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 transition-all"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Duration (Days)</label>
              <input
                type="number"
                min="1"
                readOnly={isReadOnly}
                value={formData.duration}
                onChange={(e) => handleDurationChange(parseInt(e.target.value) || 1)}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 transition-all"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">End Date</label>
            <div className="flex items-center gap-3">
              <input
                type="date"
                readOnly={isReadOnly}
                value={formData.endDate}
                onChange={(e) => handleEndDateChange(e.target.value)}
                className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 transition-all"
                required
              />
              <div className="bg-indigo-50 text-indigo-700 px-3 py-2.5 rounded-lg text-xs font-bold whitespace-nowrap">
                Total: {formData.duration} {formData.duration === 1 ? 'Day' : 'Days'}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Status</label>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  disabled={!isHO}
                  checked={formData.status === 'Pending'}
                  onChange={() => setFormData(prev => ({ ...prev, status: 'Pending' }))}
                  className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm font-medium text-gray-700">Pending</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  disabled={!isHO}
                  checked={formData.status === 'Approved'}
                  onChange={() => setFormData(prev => ({ ...prev, status: 'Approved' }))}
                  className="w-4 h-4 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-sm font-medium text-gray-700">Approved</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  disabled={!isHO}
                  checked={formData.status === 'Rejected'}
                  onChange={() => setFormData(prev => ({ ...prev, status: 'Rejected' }))}
                  className="w-4 h-4 text-red-600 focus:ring-red-500"
                />
                <span className="text-sm font-medium text-gray-700">Rejected</span>
              </label>
              {formData.status === 'Withdrawn' && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    disabled
                    checked
                    className="w-4 h-4 text-gray-400"
                  />
                  <span className="text-sm font-medium text-gray-400 italic">Withdrawn</span>
                </label>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Notes</label>
            <textarea
              readOnly={isReadOnly}
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Any additional info..."
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 transition-all h-24 resize-none"
            />
          </div>

          {selectedStaff && (
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Application History</h4>
              <div className="space-y-2 max-h-32 overflow-y-auto pr-2">
                {requests
                  .filter(r => r.staffId === formData.staffId && r.id !== editingRequest?.id)
                  .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
                  .map(r => (
                    <div key={r.id} className="text-[10px] flex justify-between items-center p-2 bg-white rounded-lg border border-gray-100">
                      <span className="font-medium">{r.startDate} to {r.endDate}</span>
                      <span className={`px-1.5 py-0.5 rounded-full font-bold uppercase ${
                        r.status === 'Approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {r.status}
                      </span>
                    </div>
                  ))}
                {requests.filter(r => r.staffId === formData.staffId && r.id !== editingRequest?.id).length === 0 && (
                  <div className="text-[10px] text-gray-400 italic text-center py-2">No previous applications</div>
                )}
              </div>
            </div>
          )}

          {editingRequest && (
            <div className="text-[10px] text-gray-400 font-medium italic">
              Requested on: {new Date(editingRequest.createdAt).toLocaleString()}
            </div>
          )}

          <div className="pt-4 flex flex-col gap-3">
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              {!isReadOnly && (
                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors shadow-md"
                >
                  {editingRequest ? 'Update' : 'Save'}
                </button>
              )}
            </div>
            
            {editingRequest && !isReadOnly && formData.status !== 'Withdrawn' && (
              <button
                type="button"
                onClick={handleWithdraw}
                className="w-full px-4 py-2.5 bg-gray-100 text-gray-600 rounded-lg font-semibold hover:bg-gray-200 hover:text-gray-800 transition-all flex items-center justify-center gap-2"
              >
                <i className="fa-solid fa-rotate-left"></i>
                Withdraw Request
              </button>
            )}

            {isHO && editingRequest && (
              <button
                type="button"
                onClick={() => { onDelete(editingRequest.id); onClose(); }}
                className="w-full px-4 py-2.5 text-red-600 font-semibold hover:bg-red-50 rounded-lg transition-all"
              >
                Delete Permanently
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default HolidayModal;
