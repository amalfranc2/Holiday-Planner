
import React, { useState, useEffect } from 'react';
import { Staff, HolidayRequest, StaffCategory, UserRole, SystemConfig, User, Branch } from '../types';
import { CATEGORIES } from '../constants';
import ConfirmationModal from './ConfirmationModal';

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
    duration: 1,
    attachmentUrl: '',
    attachmentId: '',
    isUrgent: false
  });
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    show: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    type: 'danger' | 'warning' | 'info';
  }>({
    show: false,
    title: '',
    message: '',
    onConfirm: () => {},
    type: 'info'
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
        duration: calculateDays(editingRequest.startDate, editingRequest.endDate),
        attachmentUrl: editingRequest.attachmentUrl || '',
        attachmentId: editingRequest.attachmentId || '',
        isUrgent: editingRequest.isUrgent || false
      });
    } else {
      const defaultDate = (initialDate || new Date()).toISOString().split('T')[0];
      setFormData({
        staffId: '',
        startDate: defaultDate,
        endDate: defaultDate,
        notes: '',
        status: 'Pending',
        duration: 1,
        attachmentUrl: '',
        attachmentId: '',
        isUrgent: false
      });
    }
  }, [editingRequest, initialDate, isOpen]);

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  if (!isOpen) return null;

  const isHO = role === 'S-ADMIN' || role === 'ADMIN';
  const isManager = role === 'Manager';
  const isStaff = role === 'Staff';
  
  // Logic: Managers can only create requests for their own branch.
  // Staff can create for any branch they are searching in.
  const effectiveBranchId = ((isManager || isStaff) && !editingRequest && selectedBranchId === 'all')
    ? (isManager ? currentUser.branchId : '') // Staff must select a staff member first, which will determine branch
    : (selectedBranchId === 'all' ? '' : selectedBranchId);

  const branchStaff = (isStaff || isHO) && (effectiveBranchId === 'all' || !effectiveBranchId)
    ? staff 
    : staff.filter(s => s.branchId === effectiveBranchId);
  const selectedStaff = staff.find(s => s.id === formData.staffId);
  const effectiveBranch = branches.find(b => b.id === effectiveBranchId);

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

  const deleteFileFromDrive = async (fileId: string) => {
    try {
      const res = await fetch('/api/delete-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId })
      });
      if (!res.ok) {
        console.error("Failed to delete file in Drive");
      }
    } catch (err) {
      console.error("Error deleting file in Drive:", err);
    }
  };

  const handleFileUpload = async (file: File) => {
    const oldAttachmentId = formData.attachmentId;
    setIsUploading(true);
    const uploadData = new FormData();
    uploadData.append('file', file);
    if (selectedStaff) {
      uploadData.append('staffName', selectedStaff.name);
    }

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: uploadData
      });
      
      if (!res.ok) {
        const errorText = await res.text();
        let errorMessage = "Upload failed";
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error || errorMessage;
        } catch (e) {
          errorMessage = `Server error (${res.status}): ${errorText.substring(0, 100)}...`;
        }
        
        if (errorMessage.includes('invalid_grant')) {
          errorMessage = "Google Drive connection has expired. Please ask an administrator to re-authorize Google Drive in Settings > Config.";
        }
        
        throw new Error(errorMessage);
      }

      const data = await res.json();
      if (data.webViewLink) {
        // Clean up old file if it exists
        if (oldAttachmentId) {
          deleteFileFromDrive(oldAttachmentId);
        }

        setFormData(prev => ({ 
          ...prev, 
          attachmentUrl: data.webViewLink,
          attachmentId: data.id
        }));
      }
    } catch (err: any) {
      console.error("Upload failed:", err);
      setConfirmModal({
        show: true,
        title: 'Upload Failed',
        message: `Upload failed:\n${err.message}`,
        onConfirm: () => setConfirmModal(prev => ({ ...prev, show: false })),
        type: 'danger'
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveAttachment = async () => {
    if (formData.attachmentId) {
      setIsDeleting(true);
      await deleteFileFromDrive(formData.attachmentId);
      setIsDeleting(false);
    }
    setFormData(prev => ({ ...prev, attachmentUrl: '', attachmentId: '' }));
  };

  const startCamera = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      setStream(s);
      setShowCamera(true);
    } catch (err) {
      console.error("Camera access failed:", err);
      setConfirmModal({
        show: true,
        title: 'Camera Error',
        message: 'Could not access camera.',
        onConfirm: () => setConfirmModal(prev => ({ ...prev, show: false })),
        type: 'danger'
      });
    }
  };

  const capturePhoto = () => {
    const video = document.querySelector('video');
    const canvas = document.createElement('canvas');
    if (video) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d')?.drawImage(video, 0, 0);
      canvas.toBlob(async (blob) => {
        if (blob) {
          const file = new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' });
          await handleFileUpload(file);
          stopCamera();
        }
      }, 'image/jpeg');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setShowCamera(false);
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
      branchId: selectedStaff?.branchId || effectiveBranchId,
      id: editingRequest?.id,
      attachmentUrl: formData.attachmentUrl,
      attachmentId: formData.attachmentId,
      isUrgent: formData.isUrgent,
      isStaffRequest: editingRequest ? editingRequest.isStaffRequest : isStaff
    });
    onClose();
  };

  const handleConvertToMyRequest = () => {
    if (!editingRequest || !isManager) return;
    
    // Find the manager's staff record
    const managerStaff = staff.find(s => s.name === currentUser.name && s.branchId === currentUser.branchId);
    if (!managerStaff) {
      setConfirmModal({
        show: true,
        title: 'Staff Record Not Found',
        message: 'Could not find your staff record to convert this request.',
        onConfirm: () => setConfirmModal(prev => ({ ...prev, show: false })),
        type: 'warning'
      });
      return;
    }

    onSave({
      ...editingRequest,
      staffId: managerStaff.id,
      status: editingRequest.isStaffRequest ? 'Approved' : editingRequest.status,
      isStaffRequest: false,
      notes: `(Taken over from ${selectedStaff?.name}) ${formData.notes}`
    });
    onClose();
  };

  const isOwnBranch = editingRequest ? (editingRequest.branchId === currentUser.branchId) : (effectiveBranchId === currentUser.branchId);
  const canChangeStatus = isHO || isManager;
  const isReadOnly = editingRequest 
    ? !isHO && (isStaff ? !editingRequest.isStaffRequest : !isOwnBranch)
    : false;

  const handleWithdraw = () => {
    if (!editingRequest) return;
    onSave({
      ...editingRequest,
      status: 'Withdrawn'
    });
    onClose();
  };

  const handleDeleteRequest = async () => {
    if (!editingRequest) return;
    
    setConfirmModal({
      show: true,
      title: 'Delete Request',
      message: 'Are you sure you want to delete this holiday request?',
      onConfirm: async () => {
        if (formData.attachmentId) {
          setIsDeleting(true);
          await deleteFileFromDrive(formData.attachmentId);
          setIsDeleting(false);
        }
        
        onDelete(editingRequest.id);
        onClose();
        setConfirmModal(prev => ({ ...prev, show: false }));
      },
      type: 'danger'
    });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {editingRequest ? 'Edit Holiday Request' : 'New Holiday Request'}
            </h2>
            <div className="flex flex-wrap gap-2 mt-1">
              {!editingRequest && (
                <p className="text-[10px] font-bold text-primary-600 uppercase tracking-wider">
                  For Branch: {effectiveBranch?.name || (effectiveBranchId === '' ? 'All Branches' : 'Unknown')}
                </p>
              )}
              {editingRequest?.isStaffRequest && (
                <span className="text-[10px] font-bold bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full uppercase tracking-wider">
                  <i className="fa-solid fa-user-tag mr-1"></i> Staff Request
                </span>
              )}
            </div>
          </div>
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
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-primary-500 transition-all"
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
                  <div className={`text-[10px] font-bold px-2 py-1 rounded-full ${remainingDays < 0 ? 'bg-red-100 text-red-700' : 'bg-primary-100 text-primary-700'}`}>
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
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-primary-500 transition-all"
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
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-primary-500 transition-all"
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
                className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-primary-500 transition-all"
                required
              />
              <div className="bg-primary-50 text-primary-700 px-3 py-2.5 rounded-lg text-xs font-bold whitespace-nowrap">
                Total: {formData.duration} {formData.duration === 1 ? 'Day' : 'Days'}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Status</label>
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    disabled={!canChangeStatus}
                    checked={formData.status === 'Pending'}
                    onChange={() => setFormData(prev => ({ ...prev, status: 'Pending' }))}
                    className="w-4 h-4 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Pending</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    disabled={!canChangeStatus}
                    checked={formData.status === 'Approved'}
                    onChange={() => setFormData(prev => ({ ...prev, status: 'Approved' }))}
                    className="w-4 h-4 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Approved</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    disabled={!canChangeStatus}
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
              
              <div className="h-6 w-px bg-gray-200 hidden sm:block"></div>

              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  disabled={isReadOnly}
                  checked={formData.isUrgent}
                  onChange={(e) => setFormData(prev => ({ ...prev, isUrgent: e.target.checked }))}
                  className="w-4 h-4 text-red-600 rounded focus:ring-red-500"
                />
                <span className={`text-sm font-bold uppercase tracking-wider ${formData.isUrgent ? 'text-red-600' : 'text-gray-400 group-hover:text-gray-600'}`}>
                  Urgent Request
                </span>
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
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-primary-500 transition-all h-24 resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Application Attachment</label>
            <div className="space-y-3">
              {formData.attachmentUrl ? (
                <div className="flex items-center justify-between p-3 bg-primary-50 rounded-xl border border-primary-100">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <i className={`fa-solid ${isDeleting ? 'fa-spinner fa-spin' : 'fa-file-image'} text-primary-600`}></i>
                    <span className="text-xs font-medium text-primary-700 truncate">Application Attached</span>
                  </div>
                  <div className="flex gap-2">
                    <a 
                      href={formData.attachmentUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-[10px] font-bold text-primary-600 hover:underline"
                    >
                      View
                    </a>
                    {!isReadOnly && (
                      <button 
                        type="button"
                        disabled={isDeleting}
                        onClick={handleRemoveAttachment}
                        className="text-[10px] font-bold text-red-600 hover:underline disabled:opacity-50"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <label className={`flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-200 rounded-xl hover:border-primary-400 hover:bg-primary-50 transition-all cursor-pointer ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}>
                    <input 
                      type="file" 
                      accept="image/*,application/pdf" 
                      className="hidden" 
                      onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                    />
                    <i className={`fa-solid ${isUploading ? 'fa-spinner fa-spin' : 'fa-cloud-arrow-up'} text-gray-400 mb-1`}></i>
                    <span className="text-[10px] font-bold text-gray-500 uppercase">Upload File</span>
                  </label>
                  <button
                    type="button"
                    onClick={startCamera}
                    disabled={isUploading}
                    className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-200 rounded-xl hover:border-primary-400 hover:bg-primary-50 transition-all"
                  >
                    <i className="fa-solid fa-camera text-gray-400 mb-1"></i>
                    <span className="text-[10px] font-bold text-gray-500 uppercase">Take Photo</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {showCamera && (
            <div className="fixed inset-0 z-[110] bg-black flex flex-col items-center justify-center p-4">
              <div className="relative w-full max-w-md aspect-[3/4] bg-gray-900 rounded-2xl overflow-hidden shadow-2xl">
                <video 
                  autoPlay 
                  playsInline 
                  ref={(el) => { if (el && stream) el.srcObject = stream; }}
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-8">
                  <button 
                    type="button"
                    onClick={stopCamera}
                    className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md text-white flex items-center justify-center hover:bg-white/30 transition-all"
                  >
                    <i className="fa-solid fa-xmark text-xl"></i>
                  </button>
                  <button 
                    type="button"
                    onClick={capturePhoto}
                    className="w-16 h-16 rounded-full bg-white flex items-center justify-center shadow-xl active:scale-90 transition-all"
                  >
                    <div className="w-12 h-12 rounded-full border-4 border-gray-200"></div>
                  </button>
                </div>
              </div>
              <p className="mt-4 text-white/60 text-xs font-medium">Align the application form within the frame</p>
            </div>
          )}

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
                  className="flex-1 px-4 py-2.5 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 transition-colors shadow-md"
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

            {isManager && editingRequest && selectedStaff && selectedStaff.name !== currentUser.name && (
              <button
                type="button"
                onClick={handleConvertToMyRequest}
                className={`w-full px-4 py-2.5 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 ${editingRequest.isStaffRequest ? 'bg-purple-50 text-purple-700 hover:bg-purple-100' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}
              >
                <i className={`fa-solid ${editingRequest.isStaffRequest ? 'fa-user-check' : 'fa-user-plus'}`}></i>
                {editingRequest.isStaffRequest ? 'Take Ownership & Approve' : 'Convert to My Request'}
              </button>
            )}

            {(isHO || (isManager && isOwnBranch)) && editingRequest && (
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteRequest}
                className="w-full px-4 py-2.5 text-red-600 font-semibold hover:bg-red-50 rounded-lg transition-all disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            )}
          </div>
        </form>
      </div>
      {/* Confirmation Modal */}
      <ConfirmationModal
        show={confirmModal.show}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(prev => ({ ...prev, show: false }))}
        type={confirmModal.type}
      />
    </div>
  );
};

export default HolidayModal;
