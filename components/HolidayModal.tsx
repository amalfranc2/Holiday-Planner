
import React, { useState, useEffect } from 'react';
import { Staff, HolidayRequest, StaffCategory, UserRole, SystemConfig } from '../types';
import { CATEGORIES } from '../constants';

interface HolidayModalProps {
  isOpen: boolean;
  onClose: () => void;
  staff: Staff[];
  requests: HolidayRequest[];
  systemConfig: SystemConfig;
  selectedBranchId: string;
  userBranchId?: string;
  role: UserRole;
  onSave: (request: Partial<HolidayRequest>) => void;
  editingRequest?: HolidayRequest;
  initialDate?: Date;
}

const HolidayModal: React.FC<HolidayModalProps> = ({ 
  isOpen, onClose, staff, requests, systemConfig, selectedBranchId, userBranchId, role, onSave, editingRequest, initialDate 
}) => {
  const [formData, setFormData] = useState({
    staffId: '',
    startDate: '',
    endDate: '',
    notes: '',
    status: 'Pending' as 'Pending' | 'Approved',
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

  const usedDays = formData.staffId ? calculateUsedDays(formData.staffId) : 0;
  const remainingDays = selectedStaff ? selectedStaff.totalAllowance - usedDays : 0;

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
  const isReadOnly = !isHO && editingRequest && editingRequest.branchId !== userBranchId;

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
              <div className="mt-2 flex flex-wrap gap-2">
                <div className={`text-[10px] font-bold px-2 py-1 rounded-full ${remainingDays < formData.duration ? 'bg-red-100 text-red-700' : 'bg-indigo-100 text-indigo-700'}`}>
                  Allowance: {usedDays}/{selectedStaff.totalAllowance} used ({remainingDays} left)
                </div>
                {hadPrimeTimeLastYear && (
                  <div className="text-[10px] font-bold px-2 py-1 rounded-full bg-amber-100 text-amber-700">
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
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  disabled={!isHO}
                  checked={formData.status === 'Pending'}
                  onChange={() => setFormData(prev => ({ ...prev, status: 'Pending' }))}
                  className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm font-medium text-gray-700">Pending (Pale Red)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  disabled={!isHO}
                  checked={formData.status === 'Approved'}
                  onChange={() => setFormData(prev => ({ ...prev, status: 'Approved' }))}
                  className="w-4 h-4 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-sm font-medium text-gray-700">Approved (Green)</span>
              </label>
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

          {editingRequest && (
            <div className="text-[10px] text-gray-400 font-medium italic">
              Requested on: {new Date(editingRequest.createdAt).toLocaleString()}
            </div>
          )}

          <div className="pt-4 flex gap-3">
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
        </form>
      </div>
    </div>
  );
};

export default HolidayModal;
