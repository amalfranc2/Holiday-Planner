
import React, { useState } from 'react';
import { Branch, Staff, UserRole, StaffCategory, User, SystemConfig } from '../types';
import { CATEGORIES, THEMES } from '../constants';
import ConfirmationModal from './ConfirmationModal';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface SettingsViewProps {
  role: UserRole;
  currentUser: User;
  currentBranchId: string;
  branches: Branch[];
  staff: Staff[];
  users: User[];
  systemConfig: SystemConfig;
  onUpdateBranches: (branches: Branch[]) => void;
  onDeleteBranch: (id: string) => void;
  onUpdateStaff: (staff: Staff[]) => void;
  onDeleteStaff: (id: string) => void;
  onUpdateUsers: (users: User[]) => void;
  onDeleteUser: (id: string) => void;
  onUpdateConfig: (config: SystemConfig) => void;
}

const SettingsView: React.FC<SettingsViewProps> = ({
  role,
  currentUser,
  currentBranchId,
  branches,
  staff,
  users,
  systemConfig,
  onUpdateBranches,
  onDeleteBranch,
  onUpdateStaff,
  onDeleteStaff,
  onUpdateUsers,
  onDeleteUser,
  onUpdateConfig,
}) => {
  const thresholds = systemConfig.heatmapThresholds || { low: 10, medium: 20, high: 30, critical: 45 };
  const stripeStyle = { 
    backgroundImage: 'linear-gradient(45deg, rgba(0,0,0,0.1) 25%, transparent 25%, transparent 50%, rgba(0,0,0,0.1) 50%, rgba(0,0,0,0.1) 75%, transparent 75%, transparent)', 
    backgroundSize: '4px 4px' 
  };
  const stripeStyleWhite = { 
    backgroundImage: 'linear-gradient(45deg, rgba(255,255,255,0.2) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.2) 50%, rgba(255,255,255,0.2) 75%, transparent 75%, transparent)', 
    backgroundSize: '4px 4px' 
  };

  const [editingBranch, setEditingBranch] = useState<Partial<Branch> | null>(null);
  const [editingStaff, setEditingStaff] = useState<Partial<Staff> | null>(null);
  const [editingUser, setEditingUser] = useState<Partial<User> | null>(null);
  const [activeTab, setActiveTab] = useState<'Branches' | 'Staff' | 'Users' | 'Profile' | 'System' | 'Config'>(role === 'S-ADMIN' || role === 'ADMIN' ? 'Branches' : 'Staff');
  
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMessage, setPasswordMessage] = useState({ text: '', type: '' });
  const [emailStatus, setEmailStatus] = useState<{ configured: boolean, details: any } | null>(null);
  const [testEmail, setTestEmail] = useState('');
  const [testMessage, setTestMessage] = useState({ text: '', type: '' });
  const [isTesting, setIsTesting] = useState(false);

  const [smtpConfig, setSmtpConfig] = useState({
    host: '',
    port: 465,
    secure: true,
    username: '',
    password: '',
    from_email: '',
    app_url: ''
  });
  const [showSmtpPassword, setShowSmtpPassword] = useState(false);
  const [showSmtpHost, setShowSmtpHost] = useState(false);
  const [showSmtpUser, setShowSmtpUser] = useState(false);
  const [showSmtpFrom, setShowSmtpFrom] = useState(false);
  const [showSmtpAppUrl, setShowSmtpAppUrl] = useState(false);
  const [showSmtpPort, setShowSmtpPort] = useState(false);
  const [smtpSaveMessage, setSmtpSaveMessage] = useState({ text: '', type: '' });
  const [driveSaveMessage, setDriveSaveMessage] = useState({ text: '', type: '' });
  const [driveStatus, setDriveStatus] = useState<{ configured: boolean, folderIdSet: boolean, verified: boolean, error: string | null, serviceAccountEmail?: string } | null>(null);
  const [driveConfig, setDriveConfig] = useState({
    client_email: '',
    private_key: '',
    folder_id: ''
  });
  const [showDriveKey, setShowDriveKey] = useState(false);
  const [showDriveEmail, setShowDriveEmail] = useState(false);
  const [showDriveFolder, setShowDriveFolder] = useState(false);
  const [showProfileEmail, setShowProfileEmail] = useState(false);
  const [branchStaffPasswords, setBranchStaffPasswords] = useState<{ branchName: string, username: string, password: string }[]>([]);
  const [loadingPasswords, setLoadingPasswords] = useState(false);
  const [isBranchStaffAccessExpanded, setIsBranchStaffAccessExpanded] = useState(false);
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

  const fetchBranchStaffPasswords = async () => {
    setLoadingPasswords(true);
    try {
      const res = await fetch('/api/branch-staff-passwords', {
        headers: { 'x-user-role': role, 'x-user-branch-id': currentBranchId }
      });
      if (res.ok) {
        const data = await res.json();
        setBranchStaffPasswords(data);
      }
    } catch (err) {
      console.error('Failed to fetch branch staff passwords');
    } finally {
      setLoadingPasswords(false);
    }
  };

  React.useEffect(() => {
    if (activeTab === 'Profile' && (role === 'Manager' || role === 'S-ADMIN' || role === 'ADMIN')) {
      fetchBranchStaffPasswords();
    }
  }, [activeTab, role]);
  const isSAdmin = role === 'S-ADMIN';
  const isAdmin = role === 'ADMIN' || role === 'S-ADMIN';

  const fetchDriveStatus = async () => {
    try {
      const res = await fetch('/api/drive-status', {
        headers: { 'x-user-role': role }
      });
      const data = await res.json();
      setDriveStatus(data);
    } catch (err) {
      console.error('Failed to fetch drive status');
    }
  };

  const fetchDriveConfig = async () => {
    try {
      const res = await fetch('/api/drive-config', {
        headers: { 'x-user-role': role }
      });
      const data = await res.json();
      if (data.client_email || data.folder_id) setDriveConfig(data);
    } catch (err) {
      console.error('Failed to fetch Drive config');
    }
  };

  const handleSaveDrive = async (e: React.FormEvent) => {
    e.preventDefault();
    setDriveSaveMessage({ text: 'Saving...', type: 'info' });
    try {
      const res = await fetch('/api/drive-config', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-role': role
        },
        body: JSON.stringify(driveConfig)
      });
      if (res.ok) {
        setDriveSaveMessage({ text: 'Drive settings saved successfully!', type: 'success' });
        fetchDriveStatus();
        setTimeout(() => setDriveSaveMessage({ text: '', type: '' }), 3000);
      } else {
        throw new Error('Failed to save');
      }
    } catch (err: any) {
      setDriveSaveMessage({ text: `Error: ${err.message}`, type: 'error' });
    }
  };

  const fetchSmtpConfig = async () => {
    try {
      const res = await fetch('/api/smtp-config', {
        headers: { 'x-user-role': role }
      });
      const data = await res.json();
      if (data.host) setSmtpConfig(data);
    } catch (err) {
      console.error('Failed to fetch SMTP config');
    }
  };

  const handleSaveSmtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setSmtpSaveMessage({ text: 'Saving...', type: 'info' });
    try {
      const res = await fetch('/api/smtp-config', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-role': role
        },
        body: JSON.stringify(smtpConfig)
      });
      if (res.ok) {
        setSmtpSaveMessage({ text: 'Configuration saved successfully!', type: 'success' });
        fetchEmailStatus();
        setTimeout(() => setSmtpSaveMessage({ text: '', type: '' }), 3000);
      } else {
        setSmtpSaveMessage({ text: 'Failed to save configuration', type: 'error' });
      }
    } catch (err) {
      setSmtpSaveMessage({ text: 'Error saving configuration', type: 'error' });
    }
  };

  const fetchEmailStatus = async () => {
    try {
      const res = await fetch('/api/email-status', {
        headers: { 'x-user-role': role }
      });
      const data = await res.json();
      setEmailStatus(data);
    } catch (err) {
      console.error('Failed to fetch email status');
    }
  };

  const handleTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testEmail) return;
    setIsTesting(true);
    setTestMessage({ text: 'Sending test email...', type: 'info' });
    try {
      const res = await fetch('/api/test-email', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-role': role
        },
        body: JSON.stringify({ email: testEmail })
      });
      const data = await res.json();
      if (data.success) {
        setTestMessage({ text: 'Test email sent successfully! Check your inbox.', type: 'success' });
      } else {
        setTestMessage({ text: `Failed: ${data.error}`, type: 'error' });
      }
    } catch (err: any) {
      setTestMessage({ text: `Error: ${err.message}`, type: 'error' });
    } finally {
      setIsTesting(false);
    }
  };

  React.useEffect(() => {
    fetchEmailStatus();
    if (isSAdmin) {
      fetchSmtpConfig();
      fetchDriveConfig();
      fetchDriveStatus();
    }
  }, [isSAdmin]);

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordMessage({ text: 'Passwords do not match', type: 'error' });
      return;
    }
    if (newPassword.length < 4) {
      setPasswordMessage({ text: 'Password must be at least 4 characters', type: 'error' });
      return;
    }
    
    const updatedUsers = users.map(u => u.id === currentUser.id ? { ...u, password: newPassword } : u);
    onUpdateUsers(updatedUsers);
    setNewPassword('');
    setConfirmPassword('');
    setPasswordMessage({ text: 'Password updated successfully', type: 'success' });
    setTimeout(() => setPasswordMessage({ text: '', type: '' }), 3000);
  };

  // User Handlers (Admin Only)
  const handleSaveUser = () => {
    if (!editingUser?.username || !editingUser?.password || !editingUser?.name || !editingUser?.role) return;
    if ((editingUser.role === 'Manager' || editingUser.role === 'Staff') && !editingUser.branchId) return;

    if (editingUser.id) {
      onUpdateUsers(users.map(u => u.id === editingUser.id ? { ...u, ...editingUser } as User : u));
    } else {
      const newUser: User = {
        ...editingUser as User,
        id: `user-${Date.now()}`,
        receiveNotifications: editingUser.receiveNotifications ?? false,
      };
      onUpdateUsers([...users, newUser]);
    }
    setEditingUser(null);
  };

  const handleDeleteUser = (id: string) => {
    if (id === currentUser.id) {
      setConfirmModal({
        show: true,
        title: 'Action Not Allowed',
        message: 'You cannot delete your own account.',
        onConfirm: () => setConfirmModal(prev => ({ ...prev, show: false })),
        type: 'warning'
      });
      return;
    }
    const targetUser = users.find(u => u.id === id);
    if (!targetUser) return;

    const canDelete = isSAdmin || (role === 'ADMIN' && (targetUser.role === 'Manager' || targetUser.role === 'Staff'));
    
    if (!canDelete) {
      setConfirmModal({
        show: true,
        title: 'Permission Denied',
        message: 'You do not have permission to delete this user.',
        onConfirm: () => setConfirmModal(prev => ({ ...prev, show: false })),
        type: 'warning'
      });
      return;
    }

    setConfirmModal({
      show: true,
      title: 'Delete User',
      message: 'Are you sure you want to delete this user? This action cannot be undone.',
      onConfirm: () => {
        onDeleteUser(id);
        setConfirmModal(prev => ({ ...prev, show: false }));
      },
      type: 'danger'
    });
  };

  // Branch Handlers (Admin Only)
  const handleSaveBranch = () => {
    if (!editingBranch?.name) return;
    
    if (editingBranch.id) {
      onUpdateBranches(branches.map(b => b.id === editingBranch.id ? editingBranch as Branch : b));
    } else {
      const newBranch: Branch = {
        id: `br-${Date.now()}`,
        name: editingBranch.name,
        location: editingBranch.location || '',
        showDashboardToStaff: editingBranch.showDashboardToStaff ?? true,
      };
      onUpdateBranches([...branches, newBranch]);
    }
    setEditingBranch(null);
  };

  const handleDeleteBranch = (id: string) => {
    setConfirmModal({
      show: true,
      title: 'Delete Branch',
      message: 'Are you sure? This will also remove all staff associated with this branch.',
      onConfirm: () => {
        onDeleteBranch(id);
        setConfirmModal(prev => ({ ...prev, show: false }));
      },
      type: 'danger'
    });
  };

  // Staff Handlers
  const handleSaveStaff = () => {
    if (!editingStaff?.name || !editingStaff?.branchId || !editingStaff?.category) return;

    if (editingStaff.id) {
      onUpdateStaff(staff.map(s => s.id === editingStaff.id ? { ...s, ...editingStaff } as Staff : s));
    } else {
      const newStaff: Staff = {
        id: `staff-${Date.now()}`,
        name: editingStaff.name!,
        category: editingStaff.category as StaffCategory,
        branchId: editingStaff.branchId!,
        totalAllowance: editingStaff.totalAllowance || systemConfig.defaultAllowance,
        email: editingStaff.email,
      };
      onUpdateStaff([...staff, newStaff]);
    }
    setEditingStaff(null);
  };

  const handleDeleteStaff = (id: string) => {
    setConfirmModal({
      show: true,
      title: 'Delete Staff',
      message: 'Delete this staff member? This will also remove all their holiday requests.',
      onConfirm: () => {
        onDeleteStaff(id);
        setConfirmModal(prev => ({ ...prev, show: false }));
      },
      type: 'danger'
    });
  };

  const filteredStaff = isAdmin 
    ? staff 
    : staff.filter(s => s.branchId === currentBranchId);

  const currentBranchName = branches.find(b => b.id === currentBranchId)?.name || 'Unknown Branch';

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">System Settings</h2>
          <div className="flex bg-gray-100 rounded-lg p-1">
            {isAdmin && (
              <>
                <button 
                  onClick={() => setActiveTab('Branches')}
                  className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'Branches' ? 'bg-white shadow-sm text-primary-600' : 'text-gray-500'}`}
                >
                  Branches
                </button>
                <button 
                  onClick={() => setActiveTab('Users')}
                  className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'Users' ? 'bg-white shadow-sm text-primary-600' : 'text-gray-500'}`}
                >
                  Users
                </button>
                {isSAdmin && (
                  <>
                    <button 
                      onClick={() => setActiveTab('System')}
                      className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'System' ? 'bg-white shadow-sm text-primary-600' : 'text-gray-500'}`}
                    >
                      System
                    </button>
                    <button 
                      onClick={() => setActiveTab('Config')}
                      className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'Config' ? 'bg-white shadow-sm text-primary-600' : 'text-gray-500'}`}
                    >
                      Config
                    </button>
                  </>
                )}
              </>
            )}
            <button 
              onClick={() => setActiveTab('Staff')}
              className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'Staff' ? 'bg-white shadow-sm text-primary-600' : 'text-gray-500'}`}
            >
              Staff
            </button>
            <button 
              onClick={() => setActiveTab('Profile')}
              className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'Profile' ? 'bg-white shadow-sm text-primary-600' : 'text-gray-500'}`}
            >
              Profile
            </button>
          </div>
        </div>

        {activeTab === 'System' && isSAdmin && (
          <div className="max-w-2xl mx-auto space-y-8 py-4">
            <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100 space-y-6">
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <i className="fa-solid fa-sliders text-primary-600"></i>
                Advanced Feature Configuration
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Default Annual Allowance (Days)</label>
                  <div className="flex items-center gap-4">
                    <input 
                      type="number" 
                      value={systemConfig.defaultAllowance}
                      onChange={e => onUpdateConfig({...systemConfig, defaultAllowance: parseInt(e.target.value) || 0})}
                      className="w-32 px-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none"
                    />
                    <p className="text-xs text-gray-500 italic">This value is used as the default when creating new staff members.</p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-3">Prime Time Months (Rotation Check)</label>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                    {Array.from({ length: 12 }).map((_, i) => {
                      const monthName = new Date(2024, i, 1).toLocaleString('default', { month: 'short' });
                      const isSelected = systemConfig.primeTimeMonths.includes(i);
                      return (
                        <button
                          key={i}
                          onClick={() => {
                            const newMonths = isSelected 
                              ? systemConfig.primeTimeMonths.filter(m => m !== i)
                              : [...systemConfig.primeTimeMonths, i];
                            onUpdateConfig({...systemConfig, primeTimeMonths: newMonths});
                          }}
                          className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border ${
                            isSelected 
                              ? 'bg-primary-600 border-primary-600 text-white shadow-md' 
                              : 'bg-white border-gray-200 text-gray-500 hover:border-primary-300'
                          }`}
                        >
                          {monthName}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-3 text-[11px] text-gray-500">
                    <i className="fa-solid fa-circle-info mr-1"></i>
                    Staff who had an approved holiday in these months last year will be flagged with a "Rotation Warning" badge in the request modal.
                  </p>
                </div>

                <div className="pt-6 border-t border-gray-100">
                  <label className="block text-sm font-bold text-gray-700 mb-3">Heatmap Risk Thresholds (%)</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Low (Emerald)</label>
                      <input 
                        type="number" 
                        value={systemConfig.heatmapThresholds?.low || 10}
                        onChange={e => onUpdateConfig({...systemConfig, heatmapThresholds: {...(systemConfig.heatmapThresholds || {low: 10, medium: 20, high: 30, critical: 45}), low: parseInt(e.target.value) || 0}})}
                        className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Medium (Amber)</label>
                      <input 
                        type="number" 
                        value={systemConfig.heatmapThresholds?.medium || 20}
                        onChange={e => onUpdateConfig({...systemConfig, heatmapThresholds: {...(systemConfig.heatmapThresholds || {low: 10, medium: 20, high: 30, critical: 45}), medium: parseInt(e.target.value) || 0}})}
                        className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">High (Orange)</label>
                      <input 
                        type="number" 
                        value={systemConfig.heatmapThresholds?.high || 30}
                        onChange={e => onUpdateConfig({...systemConfig, heatmapThresholds: {...(systemConfig.heatmapThresholds || {low: 10, medium: 20, high: 30, critical: 45}), high: parseInt(e.target.value) || 0}})}
                        className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Critical (Rose)</label>
                      <input 
                        type="number" 
                        value={systemConfig.heatmapThresholds?.critical || 45}
                        onChange={e => onUpdateConfig({...systemConfig, heatmapThresholds: {...(systemConfig.heatmapThresholds || {low: 10, medium: 20, high: 30, critical: 45}), critical: parseInt(e.target.value) || 0}})}
                        className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none"
                      />
                    </div>
                  </div>
                  <p className="mt-3 text-[11px] text-gray-500 italic">
                    <i className="fa-solid fa-circle-info mr-1"></i>
                    Configure the percentage of staff off that triggers different risk levels on the heatmap.
                  </p>
                </div>

                <div className="pt-6 border-t border-gray-100">
                  <div className="space-y-4">
                    <div>
                      <h5 className="text-sm font-bold text-gray-700 mb-2">Risk Heatmap (Striped) - <span className="text-xs font-normal text-gray-500 italic">Used for pending requests or mixed availability</span></h5>
                      <div className="flex items-center flex-wrap gap-x-4 gap-y-2 text-[14px]">
                        <div className="flex items-center gap-1.5">
                          <div className="w-[14px] h-[14px] rounded-[1px] bg-emerald-100 border-[0.5px] border-emerald-200"></div>
                          <span className="text-gray-600">Less than {thresholds.low}%: Emerald (Light Green)</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-[14px] h-[14px] rounded-[1px] bg-amber-100 border-[0.5px] border-amber-200 relative overflow-hidden">
                            <div className="absolute inset-0" style={stripeStyle}></div>
                          </div>
                          <span className="text-gray-600">{thresholds.low}% to {thresholds.medium}%: Amber (Yellow/Orange)</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-[14px] h-[14px] rounded-[1px] bg-orange-200 border-[0.5px] border-orange-300 relative overflow-hidden">
                            <div className="absolute inset-0" style={stripeStyle}></div>
                          </div>
                          <span className="text-gray-600">{thresholds.medium + 1}% to {thresholds.high}%: Orange</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-[14px] h-[14px] rounded-[1px] bg-rose-200 border-[0.5px] border-rose-300 relative overflow-hidden">
                            <div className="absolute inset-0" style={stripeStyle}></div>
                          </div>
                          <span className="text-gray-600">{thresholds.high + 1}% to {thresholds.critical}%: Rose (Light Red/Pink)</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-[14px] h-[14px] rounded-[1px] bg-red-600 border-[0.5px] border-red-700 relative overflow-hidden">
                            <div className="absolute inset-0" style={stripeStyleWhite}></div>
                          </div>
                          <span className="text-gray-600">Over {thresholds.critical}%: Solid Red (with white stripes)</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h5 className="text-sm font-bold text-gray-700 mb-2">Approved Heatmap (Solid) - <span className="text-xs font-normal text-gray-500 italic">Used for confirmed/approved holidays</span></h5>
                      <div className="flex items-center flex-wrap gap-x-4 gap-y-2 text-[14px]">
                        <div className="flex items-center gap-1.5">
                          <div className="w-[14px] h-[14px] rounded-[1px] bg-emerald-100 border-[0.5px] border-emerald-200"></div>
                          <span className="text-gray-600">Less than {thresholds.low}%: Emerald (Light Green)</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-[14px] h-[14px] rounded-[1px] bg-rose-100 border-[0.5px] border-rose-200"></div>
                          <span className="text-gray-600">{thresholds.low}% to {thresholds.medium}%: Light Rose</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-[14px] h-[14px] rounded-[1px] bg-rose-300 border-[0.5px] border-rose-400"></div>
                          <span className="text-gray-600">{thresholds.medium + 1}% to {thresholds.high}%: Medium Rose</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-[14px] h-[14px] rounded-[1px] bg-rose-500 border-[0.5px] border-rose-600"></div>
                          <span className="text-gray-600">{thresholds.high + 1}% to {thresholds.critical}%: Deep Rose</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-[14px] h-[14px] rounded-[1px] bg-rose-900 border-[0.5px] border-rose-950"></div>
                          <span className="text-gray-600">Over {thresholds.critical}%: Dark Rose (Maroon/Near Black)</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-100 p-6 rounded-2xl">
              <h4 className="font-bold text-amber-800 mb-2 flex items-center gap-2">
                <i className="fa-solid fa-triangle-exclamation"></i>
                Manager Permissions
              </h4>
              <p className="text-sm text-amber-700 leading-relaxed">
                Branch Managers can adjust individual staff allowances in the "Staff" tab to accommodate part-time contracts. 
                However, only Head Office can define the global "Prime Time" months used for the rotation intelligence.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'Profile' && (
          <div className="max-w-md mx-auto space-y-6 py-4">
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl font-bold">
                {currentUser.name[0]}
              </div>
              <h3 className="text-xl font-bold text-gray-800">{currentUser.name}</h3>
              <p className="text-sm text-gray-500 capitalize">{currentUser.role} Account</p>
            </div>

            <div className="space-y-4 bg-gray-50 p-6 rounded-2xl border border-gray-100 mb-6">
              <p className="text-[10px] text-gray-500 mb-4">Choose which view you see first when logging in.</p>
              <div className="flex bg-white p-1 rounded-xl border border-gray-200">
                <button
                  onClick={() => {
                    const updatedUsers = users.map(u => u.id === currentUser.id ? { ...u, defaultView: 'Dashboard' } : u);
                    onUpdateUsers(updatedUsers);
                  }}
                  className={`flex-1 py-2 px-4 rounded-lg text-xs font-bold transition-all ${
                    (currentUser.defaultView || 'Dashboard') === 'Dashboard'
                      ? 'bg-primary-600 text-white shadow-sm'
                      : 'text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  Dashboard
                </button>
                <button
                  onClick={() => {
                    const updatedUsers = users.map(u => u.id === currentUser.id ? { ...u, defaultView: 'Yearly' } : u);
                    onUpdateUsers(updatedUsers);
                  }}
                  className={`flex-1 py-2 px-4 rounded-lg text-xs font-bold transition-all ${
                    (currentUser.defaultView || 'Dashboard') === 'Yearly'
                      ? 'bg-primary-600 text-white shadow-sm'
                      : 'text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  Planner
                </button>
              </div>
            </div>

            <div className="space-y-4 bg-gray-50 p-6 rounded-2xl border border-gray-100 mb-6">
              <h4 className="font-bold text-gray-700 mb-2">Bubble Menu Style</h4>
              <p className="text-[10px] text-gray-500 mb-4">Choose how the quick action menu appears.</p>
              
              <div className="flex items-center justify-between py-2 mb-4 border-b border-gray-200 pb-4">
                <div>
                  <p className="text-sm font-bold text-gray-700">Show Quick Action Menu</p>
                  <p className="text-[10px] text-gray-500">Enable the floating bubble menu in the bottom right.</p>
                </div>
                <button 
                  onClick={() => {
                    const updatedUsers = users.map(u => u.id === currentUser.id ? { ...u, showBubble: u.showBubble === false ? true : false } : u);
                    onUpdateUsers(updatedUsers);
                  }}
                  className={`w-12 h-6 rounded-full transition-all relative ${currentUser.showBubble !== false ? 'bg-primary-600' : 'bg-gray-300'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${currentUser.showBubble !== false ? 'left-7' : 'left-1'}`}></div>
                </button>
              </div>

              <div className={`flex bg-white p-1 rounded-xl border border-gray-200 transition-opacity ${currentUser.showBubble === false ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                <button
                  onClick={() => {
                    const updatedUsers = users.map(u => u.id === currentUser.id ? { ...u, bubbleStyle: 'classic' } : u);
                    onUpdateUsers(updatedUsers);
                  }}
                  className={`flex-1 py-2 px-4 rounded-lg text-xs font-bold transition-all ${
                    (currentUser.bubbleStyle || 'arc') === 'classic'
                      ? 'bg-primary-600 text-white shadow-sm'
                      : 'text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  Classic
                </button>
                <button
                  onClick={() => {
                    const updatedUsers = users.map(u => u.id === currentUser.id ? { ...u, bubbleStyle: 'arc' } : u);
                    onUpdateUsers(updatedUsers);
                  }}
                  className={`flex-1 py-2 px-4 rounded-lg text-xs font-bold transition-all ${
                    (currentUser.bubbleStyle || 'arc') === 'arc'
                      ? 'bg-primary-600 text-white shadow-sm'
                      : 'text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  Arc
                </button>
              </div>

              <div className="flex items-center justify-between py-2 mt-4 border-t border-gray-200 pt-4">
                <div>
                  <p className="text-sm font-bold text-gray-700">Smooth Scrolling</p>
                  <p className="text-[10px] text-gray-500">Enable smooth animation when scrolling to the current month.</p>
                </div>
                <button 
                  onClick={() => {
                    const updatedUsers = users.map(u => u.id === currentUser.id ? { ...u, smoothScroll: currentUser.smoothScroll === false ? true : false } : u);
                    onUpdateUsers(updatedUsers);
                  }}
                  className={`w-12 h-6 rounded-full transition-all relative ${currentUser.smoothScroll !== false ? 'bg-primary-600' : 'bg-gray-300'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${currentUser.smoothScroll !== false ? 'left-7' : 'left-1'}`}></div>
                </button>
              </div>

              <div className="flex items-center justify-between py-2 mt-4 border-t border-gray-200 pt-4">
                <div>
                  <p className="text-sm font-bold text-gray-700">Dashboard Info Tiles</p>
                  <p className="text-[10px] text-gray-500">Enable the summary tiles at the top of the dashboard.</p>
                </div>
                <button 
                  onClick={() => {
                    const updatedUsers = users.map(u => u.id === currentUser.id ? { ...u, showDashboardInfoTiles: currentUser.showDashboardInfoTiles === false ? true : false } : u);
                    onUpdateUsers(updatedUsers);
                  }}
                  className={`w-12 h-6 rounded-full transition-all relative ${currentUser.showDashboardInfoTiles !== false ? 'bg-primary-600' : 'bg-gray-300'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${currentUser.showDashboardInfoTiles !== false ? 'left-7' : 'left-1'}`}></div>
                </button>
              </div>
            </div>

            <div className="space-y-4 bg-gray-50 p-6 rounded-2xl border border-gray-100 mb-6">
              <h4 className="font-bold text-gray-700 mb-2">Dashboard Chart Visibility</h4>
              <p className="text-[10px] text-gray-500 mb-4">Choose which charts are visible on your dashboard.</p>
              
              {[
                { id: 'availabilitySummary', label: 'Availability Summary', desc: 'Monthly availability cards for each branch.' },
                { id: 'pendingRequests', label: 'Pending Requests', desc: 'List of requests awaiting approval.' },
                { id: 'approvedRequests', label: 'Approved Requests', desc: 'List of confirmed holiday requests.' },
                { id: 'categoryDistribution', label: 'Category Distribution', desc: 'Donut chart showing requests by staff category.' },
                { id: 'branchVolume', label: 'Branch Volume', desc: 'Bar chart showing request volume per branch.' },
                { id: 'riskHeatmap', label: 'Risk Heatmap', desc: 'Heatmap showing staff absence risk by month.' }
              ].map((chart, idx) => (
                <div key={chart.id} className={`flex items-center justify-between py-2 ${idx !== 0 ? 'border-t border-gray-200 pt-4' : ''}`}>
                  <div>
                    <p className="text-sm font-bold text-gray-700">{chart.label}</p>
                    <p className="text-[10px] text-gray-500">{chart.desc}</p>
                  </div>
                  <button 
                    onClick={() => {
                      const currentPrefs = currentUser.chartPreferences || {};
                      const updatedUsers = users.map(u => u.id === currentUser.id ? { 
                        ...u, 
                        chartPreferences: { 
                          ...currentPrefs, 
                          [chart.id]: currentPrefs[chart.id as keyof typeof currentPrefs] === false ? true : false 
                        } 
                      } : u);
                      onUpdateUsers(updatedUsers);
                    }}
                    className={`w-12 h-6 rounded-full transition-all relative ${ (currentUser.chartPreferences?.[chart.id as keyof typeof currentUser.chartPreferences] !== false) ? 'bg-primary-600' : 'bg-gray-300'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${ (currentUser.chartPreferences?.[chart.id as keyof typeof currentUser.chartPreferences] !== false) ? 'left-7' : 'left-1'}`}></div>
                  </button>
                </div>
              ))}
            </div>

            <div className="space-y-4 bg-gray-50 p-6 rounded-2xl border border-gray-100 mb-6">
              <h4 className="font-bold text-gray-700 mb-2">Theme Customization</h4>
              <p className="text-[10px] text-gray-500 mb-4">Select your preferred application color theme.</p>
              <div className="grid grid-cols-5 gap-3 mb-6">
                {Object.keys(THEMES).map((themeName) => (
                  <button
                    key={themeName}
                    onClick={() => {
                      const updatedUsers = users.map(u => u.id === currentUser.id ? { ...u, themeColor: themeName } : u);
                      onUpdateUsers(updatedUsers);
                    }}
                    className={`group relative flex flex-col items-center gap-2 p-2 rounded-xl transition-all border-2 ${
                      (currentUser.themeColor || 'indigo') === themeName 
                        ? 'border-primary-600 bg-white shadow-md' 
                        : 'border-transparent hover:bg-white hover:shadow-sm'
                    }`}
                  >
                    <div 
                      className="w-8 h-8 rounded-full shadow-inner"
                      style={{ backgroundColor: THEMES[themeName as keyof typeof THEMES][600] }}
                    ></div>
                    <span className={`text-[10px] font-bold capitalize ${
                      (currentUser.themeColor || 'indigo') === themeName ? 'text-primary-600' : 'text-gray-500'
                    }`}>
                      {themeName}
                    </span>
                    {(currentUser.themeColor || 'indigo') === themeName && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary-600 text-white rounded-full flex items-center justify-center text-[8px]">
                        <i className="fa-solid fa-check"></i>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4 bg-gray-50 p-6 rounded-2xl border border-gray-100 mb-6">
              <h4 className="font-bold text-gray-700 mb-2">Notification Preferences</h4>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Email Address</label>
                <div className="relative">
                  <input 
                    type={showProfileEmail ? "text" : "password"} 
                    value={currentUser.email || ''}
                    onChange={e => {
                      const updatedUsers = users.map(u => u.id === currentUser.id ? { ...u, email: e.target.value } : u);
                      onUpdateUsers(updatedUsers);
                    }}
                    className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none"
                    placeholder="your@email.com"
                  />
                  <button 
                    type="button"
                    onClick={() => setShowProfileEmail(!showProfileEmail)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-primary-600"
                  >
                    <i className={`fa-solid ${showProfileEmail ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-bold text-gray-700">Receive Email Notifications</p>
                  <p className="text-[10px] text-gray-500">Get alerted when new holiday requests are created.</p>
                </div>
                <button 
                  onClick={() => {
                    const updatedUsers = users.map(u => u.id === currentUser.id ? { ...u, receiveNotifications: !u.receiveNotifications } : u);
                    onUpdateUsers(updatedUsers);
                  }}
                  className={`w-12 h-6 rounded-full transition-all relative ${currentUser.receiveNotifications ? 'bg-primary-600' : 'bg-gray-300'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${currentUser.receiveNotifications ? 'left-7' : 'left-1'}`}></div>
                </button>
              </div>
            </div>

            {isAdmin && (
              <form onSubmit={handlePasswordChange} className="space-y-4 bg-gray-50 p-6 rounded-2xl border border-gray-100">
                <h4 className="font-bold text-gray-700 mb-2">Change Password</h4>
                {passwordMessage.text && (
                  <div className={`p-3 rounded-xl text-xs font-bold ${passwordMessage.type === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                    {passwordMessage.text}
                  </div>
                )}
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">New Password</label>
                  <input 
                    type="password" 
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none"
                    placeholder="Min 4 characters"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Confirm Password</label>
                  <input 
                    type="password" 
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none"
                  />
                </div>
                <button type="submit" className="w-full py-2 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 transition-all">
                  Update Password
                </button>
              </form>
            )}
            
            {!isAdmin && (
              <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl text-amber-800 text-sm">
                <i className="fa-solid fa-circle-info mr-2"></i>
                Password changes must be requested through the Head Office administrator.
              </div>
            )}

            {(role === 'Manager' || isAdmin) && (
              <div className="space-y-4 bg-gray-50 p-6 rounded-2xl border border-gray-100 mb-6">
                <button 
                  onClick={() => setIsBranchStaffAccessExpanded(!isBranchStaffAccessExpanded)}
                  className="w-full flex justify-between items-center group"
                >
                  <h4 className="font-bold text-gray-700 flex items-center gap-2">
                    <i className="fa-solid fa-users-gear text-primary-600"></i>
                    Branch Staff Access
                  </h4>
                  <i className={`fa-solid fa-chevron-down transition-transform duration-300 text-gray-400 group-hover:text-primary-600 ${isBranchStaffAccessExpanded ? 'rotate-180' : ''}`}></i>
                </button>
                
                {isBranchStaffAccessExpanded && (
                  <div className="pt-4 border-t border-gray-200 animate-in slide-in-from-top-2 duration-300">
                    <p className="text-[10px] text-gray-500 mb-4">
                      These are the shared credentials for staff members to access the planner for their branch. 
                      Passwords rotate automatically on the 1st of every month.
                    </p>
                    
                    {loadingPasswords ? (
                      <div className="flex justify-center py-4">
                        <div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
                      </div>
                    ) : branchStaffPasswords.length > 0 ? (
                      <div className="space-y-3">
                        {branchStaffPasswords.map((bp, idx) => (
                          <div key={idx} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-[10px] font-bold text-primary-600 uppercase tracking-wider">{bp.branchName}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-[9px] font-bold text-gray-400 uppercase mb-1">Username</label>
                                <div className="bg-gray-50 px-3 py-2 rounded-lg text-xs font-mono text-gray-700 border border-gray-100 select-all">
                                  {bp.username}
                                </div>
                              </div>
                              <div>
                                <label className="block text-[9px] font-bold text-gray-400 uppercase mb-1">Password</label>
                                <div className="bg-gray-50 px-3 py-2 rounded-lg text-xs font-mono text-gray-700 border border-gray-100 select-all">
                                  {bp.password}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 italic text-center py-4">No branch staff users found.</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'Users' && isAdmin && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-700">User Accounts</h3>
              <button 
                onClick={() => setEditingUser({ name: '', username: '', password: '', role: 'Manager' })}
                className="px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-bold hover:bg-primary-700 transition-all"
              >
                <i className="fa-solid fa-plus mr-2"></i> Create User
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Name</th>
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Username</th>
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Role</th>
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Branch</th>
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-widest text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {users
                    .filter(u => isSAdmin || u.role !== 'S-ADMIN')
                    .map(u => (
                    <tr key={u.id} className="hover:bg-gray-50 transition-colors group">
                      <td className="p-4 text-sm font-medium text-gray-800">{u.name}</td>
                      <td className="p-4 text-sm text-gray-600">{u.username}</td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase ${
                          u.role === 'S-ADMIN' ? 'bg-purple-100 text-purple-700' :
                          u.role === 'ADMIN' ? 'bg-primary-100 text-primary-700' : 
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="p-4 text-sm text-gray-600">
                        {(u.role === 'Manager' || u.role === 'Staff') ? (branches.find(b => b.id === u.branchId)?.name || 'None') : 'N/A'}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => setEditingUser(u)} className="p-2 text-gray-400 hover:text-primary-600"><i className="fa-solid fa-pen"></i></button>
                          {(isSAdmin && u.id !== currentUser.id) || (role === 'ADMIN' && (u.role === 'Manager' || u.role === 'Staff')) ? (
                            <button onClick={() => handleDeleteUser(u.id)} className="p-2 text-gray-400 hover:text-red-600"><i className="fa-solid fa-trash"></i></button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'Branches' && isAdmin && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-700">All Branches</h3>
              <button 
                onClick={() => setEditingBranch({ name: '', location: '' })}
                className="px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-bold hover:bg-primary-700 transition-all"
              >
                <i className="fa-solid fa-plus mr-2"></i> Add Branch
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {branches.map(branch => (
                <div key={branch.id} className="p-4 border border-gray-100 rounded-xl hover:border-primary-200 transition-all group">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-gray-800">{branch.name}</h4>
                      <p className="text-xs text-gray-500">{branch.location}</p>
                    </div>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => setEditingBranch(branch)} className="p-2 text-gray-400 hover:text-primary-600"><i className="fa-solid fa-pen"></i></button>
                      <button onClick={() => handleDeleteBranch(branch.id)} className="p-2 text-gray-400 hover:text-red-600"><i className="fa-solid fa-trash"></i></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'Config' && isAdmin && (
          <div className="max-w-2xl mx-auto space-y-8 py-4">
            <form onSubmit={handleSaveSmtp} className="bg-gray-50 p-6 rounded-2xl border border-gray-100 space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                  <i className="fa-solid fa-envelope text-primary-600"></i>
                  Email Engine Configuration
                </h3>
                <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded-xl text-xs font-bold hover:bg-primary-700 transition-all">
                  Save Settings
                </button>
              </div>

              {smtpSaveMessage.text && (
                <div className={`p-3 rounded-xl text-xs font-bold ${smtpSaveMessage.type === 'success' ? 'bg-emerald-50 text-emerald-600' : smtpSaveMessage.type === 'info' ? 'bg-primary-50 text-primary-600' : 'bg-red-50 text-red-600'}`}>
                  {smtpSaveMessage.text}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">SMTP Host</label>
                  <div className="relative">
                    <input 
                      type={showSmtpHost ? "text" : "password"} 
                      value={smtpConfig.host}
                      onChange={e => setSmtpConfig({...smtpConfig, host: e.target.value})}
                      className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none"
                      placeholder="smtp.hostinger.com"
                    />
                    <button 
                      type="button"
                      onClick={() => setShowSmtpHost(!showSmtpHost)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-primary-600"
                    >
                      <i className={`fa-solid ${showSmtpHost ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">SMTP Port</label>
                  <div className="relative">
                    <input 
                      type={showSmtpPort ? "text" : "password"} 
                      value={smtpConfig.port}
                      onChange={e => setSmtpConfig({...smtpConfig, port: parseInt(e.target.value) || 0})}
                      className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none"
                    />
                    <button 
                      type="button"
                      onClick={() => setShowSmtpPort(!showSmtpPort)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-primary-600"
                    >
                      <i className={`fa-solid ${showSmtpPort ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">SMTP Username</label>
                  <div className="relative">
                    <input 
                      type={showSmtpUser ? "text" : "password"} 
                      value={smtpConfig.username}
                      onChange={e => setSmtpConfig({...smtpConfig, username: e.target.value})}
                      className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none"
                      placeholder="notifications@yourdomain.com"
                    />
                    <button 
                      type="button"
                      onClick={() => setShowSmtpUser(!showSmtpUser)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-primary-600"
                    >
                      <i className={`fa-solid ${showSmtpUser ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">SMTP Password</label>
                  <div className="relative">
                    <input 
                      type={showSmtpPassword ? "text" : "password"}
                      value={smtpConfig.password}
                      onChange={e => setSmtpConfig({...smtpConfig, password: e.target.value})}
                      className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none"
                    />
                    <button 
                      type="button"
                      onClick={() => setShowSmtpPassword(!showSmtpPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-primary-600"
                    >
                      <i className={`fa-solid ${showSmtpPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">From Email</label>
                  <div className="relative">
                    <input 
                      type={showSmtpFrom ? "text" : "password"} 
                      value={smtpConfig.from_email}
                      onChange={e => setSmtpConfig({...smtpConfig, from_email: e.target.value})}
                      className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none"
                      placeholder="Holiday Planner <notifications@yourdomain.com>"
                    />
                    <button 
                      type="button"
                      onClick={() => setShowSmtpFrom(!showSmtpFrom)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-primary-600"
                    >
                      <i className={`fa-solid ${showSmtpFrom ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">App URL (for email links)</label>
                  <div className="relative">
                    <input 
                      type={showSmtpAppUrl ? "text" : "password"} 
                      value={smtpConfig.app_url}
                      onChange={e => setSmtpConfig({...smtpConfig, app_url: e.target.value})}
                      className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none"
                      placeholder="https://your-app.run.app"
                    />
                    <button 
                      type="button"
                      onClick={() => setShowSmtpAppUrl(!showSmtpAppUrl)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-primary-600"
                    >
                      <i className={`fa-solid ${showSmtpAppUrl ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-4 pt-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={smtpConfig.secure}
                      onChange={e => setSmtpConfig({...smtpConfig, secure: e.target.checked})}
                      className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm font-bold text-gray-700">Use SSL/TLS (Secure)</span>
                  </label>
                </div>
              </div>
            </form>

            <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100 space-y-4">
              <h4 className="font-bold text-gray-700 mb-2 flex items-center justify-between">
                Email Diagnostics
                <button onClick={fetchEmailStatus} className="text-[10px] text-primary-600 hover:underline">Refresh</button>
              </h4>
              
              {emailStatus ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${emailStatus.configured ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                    <span className="text-xs font-bold text-gray-600">
                      Status: {emailStatus.configured ? 'Engine Configured' : 'Engine Not Configured'}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div className={`p-2 rounded-lg text-[10px] font-bold border ${emailStatus.details.host ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-red-50 border-red-100 text-red-700'}`}>
                      SMTP Host: {emailStatus.details.host ? 'SET' : 'MISSING'}
                    </div>
                    <div className={`p-2 rounded-lg text-[10px] font-bold border ${emailStatus.details.user ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-red-50 border-red-100 text-red-700'}`}>
                      SMTP User: {emailStatus.details.user ? 'SET' : 'MISSING'}
                    </div>
                    <div className={`p-2 rounded-lg text-[10px] font-bold border ${emailStatus.details.pass ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-red-50 border-red-100 text-red-700'}`}>
                      SMTP Pass: {emailStatus.details.pass ? 'SET' : 'MISSING'}
                    </div>
                    <div className={`p-2 rounded-lg text-[10px] font-bold border ${emailStatus.details.appUrl ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-red-50 border-red-100 text-red-700'}`}>
                      App URL: {emailStatus.details.appUrl ? 'SET' : 'MISSING'}
                    </div>
                  </div>

                  {emailStatus.configured && (
                    <form onSubmit={handleTestEmail} className="pt-2 border-t border-gray-200">
                      <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Send Test Email</label>
                      <div className="flex gap-2">
                        <input 
                          type="email" 
                          value={testEmail}
                          onChange={e => setTestEmail(e.target.value)}
                          placeholder="test@email.com"
                          className="flex-1 px-3 py-1.5 text-xs bg-white border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-primary-500"
                        />
                        <button 
                          disabled={isTesting}
                          className="px-3 py-1.5 bg-primary-600 text-white text-xs font-bold rounded-lg hover:bg-primary-700 disabled:opacity-50"
                        >
                          {isTesting ? '...' : 'Test'}
                        </button>
                      </div>
                      {testMessage.text && (
                        <p className={`mt-1 text-[10px] font-bold ${testMessage.type === 'success' ? 'text-emerald-600' : testMessage.type === 'info' ? 'text-primary-600' : 'text-red-600'}`}>
                          {testMessage.text}
                        </p>
                      )}
                    </form>
                  )}
                </div>
              ) : (
                <p className="text-xs text-gray-500 italic">Loading diagnostics...</p>
              )}
            </div>

            <form onSubmit={handleSaveDrive} className="bg-gray-50 p-6 rounded-2xl border border-gray-100 space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                  <i className="fa-brands fa-google-drive text-primary-600"></i>
                  Google Drive Configuration
                </h3>
                <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded-xl text-xs font-bold hover:bg-primary-700 transition-all">
                  Save Drive Settings
                </button>
              </div>

              {driveSaveMessage.text && (
                <div className={`p-3 rounded-xl text-xs font-bold ${driveSaveMessage.type === 'success' ? 'bg-emerald-50 text-emerald-600' : driveSaveMessage.type === 'info' ? 'bg-primary-50 text-primary-600' : 'bg-red-50 text-red-600'}`}>
                  {driveSaveMessage.text}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Service Account Email</label>
                  <div className="relative">
                    <input 
                      type={showDriveEmail ? "text" : "password"} 
                      value={driveConfig.client_email}
                      onChange={e => setDriveConfig({...driveConfig, client_email: e.target.value})}
                      className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none"
                      placeholder="your-service-account@project.iam.gserviceaccount.com"
                    />
                    <button 
                      type="button"
                      onClick={() => setShowDriveEmail(!showDriveEmail)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-primary-600"
                    >
                      <i className={`fa-solid ${showDriveEmail ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Private Key</label>
                  <div className="relative">
                    <textarea 
                      value={driveConfig.private_key}
                      onChange={e => setDriveConfig({...driveConfig, private_key: e.target.value})}
                      className={`w-full px-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none h-24 text-[10px] font-mono ${!showDriveKey ? 'blur-sm select-none' : ''}`}
                      placeholder="-----BEGIN PRIVATE KEY-----\n..."
                    />
                    <button 
                      type="button"
                      onClick={() => setShowDriveKey(!showDriveKey)}
                      className="absolute right-3 top-3 text-gray-400 hover:text-primary-600 z-10"
                    >
                      <i className={`fa-solid ${showDriveKey ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Google Drive Folder ID (or URL)</label>
                  <div className="relative">
                    <input 
                      type={showDriveFolder ? "text" : "password"} 
                      value={driveConfig.folder_id}
                      onChange={e => setDriveConfig({...driveConfig, folder_id: e.target.value})}
                      className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none"
                      placeholder="1a2b3c4d5e6f7g8h9i0j..."
                    />
                    <button 
                      type="button"
                      onClick={() => setShowDriveFolder(!showDriveFolder)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-primary-600"
                    >
                      <i className={`fa-solid ${showDriveFolder ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1">You can paste the full folder URL or just the ID.</p>
                </div>
              </div>

              {driveStatus && (
                <div className="pt-4 border-t border-gray-200">
                  <div className="flex justify-between items-center mb-3">
                    <p className="text-xs font-bold text-gray-700">Connection Status</p>
                    <button type="button" onClick={fetchDriveStatus} className="text-[10px] text-primary-600 hover:underline">Check Again</button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className={`p-3 rounded-lg border flex items-center gap-2 ${driveStatus.configured ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
                      <div className={`w-2 h-2 rounded-full ${driveStatus.configured ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                      <span className="text-[10px] font-bold text-gray-700">Credentials: {driveStatus.configured ? 'OK' : 'Missing'}</span>
                    </div>
                    <div className={`p-3 rounded-lg border flex items-center gap-2 ${driveStatus.folderIdSet ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-100'}`}>
                      <div className={`w-2 h-2 rounded-full ${driveStatus.folderIdSet ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>
                      <span className="text-[10px] font-bold text-gray-700">Folder ID: {driveStatus.folderIdSet ? 'OK' : 'Missing'}</span>
                    </div>
                  </div>

                  {driveStatus.configured && driveStatus.folderIdSet && (
                    <div className={`mt-3 p-3 rounded-lg border flex items-start gap-2 ${driveStatus.verified ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
                      <i className={`fa-solid ${driveStatus.verified ? 'fa-circle-check text-emerald-500' : 'fa-circle-xmark text-red-500'} mt-0.5`}></i>
                      <div>
                        <p className={`text-[10px] font-bold ${driveStatus.verified ? 'text-emerald-800' : 'text-red-800'}`}>
                          {driveStatus.verified ? 'Google Drive is active' : 'Connection Error'}
                        </p>
                        <p className={`text-[9px] ${driveStatus.verified ? 'text-emerald-700' : 'text-red-700'}`}>
                          {driveStatus.verified 
                            ? 'Attachments will be uploaded to your shared folder.' 
                            : (driveStatus.error || 'Failed to verify access. Ensure the folder is shared with the service account.')}
                        </p>
                      </div>
                    </div>
                  )}

                  {!driveStatus.verified && driveConfig.client_email && (
                    <div className="mt-4 p-4 bg-white rounded-xl border border-gray-200 space-y-2">
                      <p className="text-[10px] font-bold text-gray-800">Final Step Required:</p>
                      <p className="text-[10px] text-gray-600">Share your Google Drive folder with this email as an <strong>Editor</strong>:</p>
                      <div className="p-2 bg-primary-50 rounded border border-primary-100">
                        <code className="text-[10px] text-primary-700 break-all select-all">{driveConfig.client_email}</code>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-6 pt-6 border-t border-gray-200 space-y-4">
                <h4 className="text-sm font-bold text-gray-800">How to get Google Drive Configuration:</h4>
                <div className="grid grid-cols-1 gap-4 text-[11px] text-gray-600 leading-relaxed">
                  <div className="bg-white p-3 rounded-xl border border-gray-100">
                    <p className="font-bold text-gray-700 mb-1">1. Service Account & Private Key</p>
                    <p>Go to <a href="https://console.cloud.google.com/" target="_blank" className="text-primary-600 hover:underline">Google Cloud Console</a>, create a project, enable "Google Drive API", then go to "IAM & Admin" &gt; "Service Accounts". Create a Service Account, then under the "Keys" tab, click "Add Key" &gt; "Create new key" (JSON). The email and private key are inside that file.</p>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-gray-100">
                    <p className="font-bold text-gray-700 mb-1">2. Folder ID</p>
                    <p>Open your Google Drive folder in a browser. The ID is the long string of characters at the end of the URL (after <code>/folders/</code>). Example: <code>1a2b3c...</code></p>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-gray-100">
                    <p className="font-bold text-gray-700 mb-1">3. Sharing Access</p>
                    <p>Crucially, you must click "Share" on your Drive folder and add the <strong>Service Account Email</strong> as an <strong>Editor</strong>. Without this, the application cannot upload files.</p>
                  </div>
                </div>
              </div>
            </form>
          </div>
        )}
        {activeTab === 'Staff' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-700">
                {isAdmin ? 'All Staff Members' : `Staff for ${currentBranchName}`}
              </h3>
              <button 
                onClick={() => setEditingStaff({ name: '', branchId: currentBranchId, category: 'Kitchen' })}
                className="px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-bold hover:bg-primary-700 transition-all"
              >
                <i className="fa-solid fa-plus mr-2"></i> Add Staff
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Name</th>
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Category</th>
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Allowance</th>
                    {isAdmin && <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Branch</th>}
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-widest text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredStaff.map(s => (
                    <tr key={s.id} className="hover:bg-gray-50 transition-colors group">
                      <td className="p-4 text-sm font-medium text-gray-800">{s.name}</td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase ${
                          s.category === 'Kitchen' ? 'bg-orange-100 text-orange-700' :
                          s.category === 'Counter' ? 'bg-blue-100 text-blue-700' :
                          'bg-purple-100 text-purple-700'
                        }`}>
                          {s.category}
                        </span>
                      </td>
                      <td className="p-4 text-sm text-gray-600 font-bold">{s.totalAllowance} Days</td>
                      {isAdmin && (
                        <td className="p-4 text-sm text-gray-600">
                          {branches.find(b => b.id === s.branchId)?.name || 'Unknown'}
                        </td>
                      )}
                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => setEditingStaff(s)} className="p-2 text-gray-400 hover:text-primary-600"><i className="fa-solid fa-pen"></i></button>
                          <button onClick={() => handleDeleteStaff(s.id)} className="p-2 text-gray-400 hover:text-red-600"><i className="fa-solid fa-trash"></i></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
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

      {/* Branch Edit Modal */}
      {editingBranch && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-xl font-bold text-gray-800">{editingBranch.id ? 'Edit Branch' : 'Add New Branch'}</h3>
              <button onClick={() => setEditingBranch(null)} className="text-gray-400 hover:text-gray-600"><i className="fa-solid fa-xmark"></i></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Branch Name</label>
                <input 
                  type="text" 
                  value={editingBranch.name} 
                  onChange={e => setEditingBranch({...editingBranch, name: e.target.value})}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                  placeholder="e.g. London Central"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Location</label>
                <input 
                  type="text" 
                  value={editingBranch.location} 
                  onChange={e => setEditingBranch({...editingBranch, location: e.target.value})}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                  placeholder="e.g. Oxford Street"
                />
              </div>
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                <div className="flex-1">
                  <p className="text-xs font-bold text-gray-700">Show Dashboard to Staff</p>
                  <p className="text-[10px] text-gray-500">Allow staff to see summary tiles and request lists.</p>
                </div>
                <button 
                  type="button"
                  onClick={() => setEditingBranch({...editingBranch, showDashboardToStaff: !(editingBranch.showDashboardToStaff ?? true)})}
                  className={cn(
                    "w-10 h-5 rounded-full relative transition-colors duration-200",
                    (editingBranch.showDashboardToStaff ?? true) ? "bg-primary-600" : "bg-gray-300"
                  )}
                >
                  <div className={cn(
                    "absolute top-1 w-3 h-3 bg-white rounded-full transition-transform duration-200",
                    (editingBranch.showDashboardToStaff ?? true) ? "left-6" : "left-1"
                  )}></div>
                </button>
              </div>
            </div>
            <div className="p-6 bg-gray-50 flex gap-3">
              <button onClick={() => setEditingBranch(null)} className="flex-1 px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-xl font-bold hover:bg-gray-100 transition-all">Cancel</button>
              <button onClick={handleSaveBranch} className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 transition-all">Save Branch</button>
            </div>
          </div>
        </div>
      )}

      {/* User Edit Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center shrink-0">
              <h3 className="text-xl font-bold text-gray-800">{editingUser.id ? 'Edit User' : 'Create New User'}</h3>
              <button onClick={() => setEditingUser(null)} className="text-gray-400 hover:text-gray-600"><i className="fa-solid fa-xmark"></i></button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Full Name</label>
                <input 
                  type="text" 
                  value={editingUser.name} 
                  onChange={e => setEditingUser({...editingUser, name: e.target.value})}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                  placeholder="e.g. Alice Smith"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Username</label>
                <input 
                  type="text" 
                  value={editingUser.username} 
                  onChange={e => setEditingUser({...editingUser, username: e.target.value})}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                  placeholder="e.g. asmith"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Password</label>
                <input 
                  type="password" 
                  value={editingUser.password} 
                  onChange={e => setEditingUser({...editingUser, password: e.target.value})}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                  placeholder="Enter password"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Email Address (Optional)</label>
                <input 
                  type="email" 
                  value={editingUser.email || ''} 
                  onChange={e => setEditingUser({...editingUser, email: e.target.value})}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                  placeholder="e.g. user@example.com"
                />
              </div>
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-bold text-gray-700">Receive Notifications</p>
                  <p className="text-[10px] text-gray-500">Enable email alerts for this user.</p>
                </div>
                <button 
                  onClick={() => setEditingUser({...editingUser, receiveNotifications: !editingUser.receiveNotifications})}
                  className={`w-12 h-6 rounded-full transition-all relative ${editingUser.receiveNotifications ? 'bg-primary-600' : 'bg-gray-300'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${editingUser.receiveNotifications ? 'left-7' : 'left-1'}`}></div>
                </button>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Role</label>
                <select 
                  value={editingUser.role} 
                  onChange={e => setEditingUser({...editingUser, role: e.target.value as UserRole})}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                >
                  {isSAdmin && <option value="S-ADMIN">Super Admin (S-ADMIN)</option>}
                  <option value="ADMIN">Admin (ADMIN)</option>
                  <option value="Manager">Branch Manager</option>
                  <option value="Staff">Staff</option>
                </select>
              </div>
              {(editingUser.role === 'Manager' || editingUser.role === 'Staff') && (
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Assigned Branch</label>
                  <select 
                    value={editingUser.branchId} 
                    onChange={e => setEditingUser({...editingUser, branchId: e.target.value})}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                  >
                    <option value="">Select Branch</option>
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div className="p-6 bg-gray-50 flex gap-3 shrink-0">
              <button onClick={() => setEditingUser(null)} className="flex-1 px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-xl font-bold hover:bg-gray-100 transition-all">Cancel</button>
              <button onClick={handleSaveUser} className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 transition-all">Save User</button>
            </div>
          </div>
        </div>
      )}

      {/* Staff Edit Modal */}
      {editingStaff && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center shrink-0">
              <h3 className="text-xl font-bold text-gray-800">{editingStaff.id ? 'Edit Staff Member' : 'Add New Staff'}</h3>
              <button onClick={() => setEditingStaff(null)} className="text-gray-400 hover:text-gray-600"><i className="fa-solid fa-xmark"></i></button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Full Name</label>
                <input 
                  type="text" 
                  value={editingStaff.name} 
                  onChange={e => setEditingStaff({...editingStaff, name: e.target.value})}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                  placeholder="e.g. John Doe"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Category</label>
                <select 
                  value={editingStaff.category} 
                  onChange={e => setEditingStaff({...editingStaff, category: e.target.value as StaffCategory})}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                >
                  {CATEGORIES.filter(cat => cat !== 'Manager' || isAdmin).map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Annual Allowance (Days)</label>
                <input 
                  type="number" 
                  value={editingStaff.totalAllowance === undefined ? systemConfig.defaultAllowance : editingStaff.totalAllowance} 
                  onChange={e => setEditingStaff({...editingStaff, totalAllowance: parseInt(e.target.value) || 0})}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Email Address (Optional)</label>
                <input 
                  type="email" 
                  value={editingStaff.email || ''} 
                  onChange={e => setEditingStaff({...editingStaff, email: e.target.value})}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                  placeholder="e.g. staff@example.com"
                />
                <p className="text-[10px] text-gray-500 mt-1">Used for approval notifications.</p>
              </div>
              {isAdmin && (
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Branch</label>
                  <select 
                    value={editingStaff.branchId} 
                    onChange={e => setEditingStaff({...editingStaff, branchId: e.target.value})}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                  >
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div className="p-6 bg-gray-50 flex gap-3 shrink-0">
              <button onClick={() => setEditingStaff(null)} className="flex-1 px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-xl font-bold hover:bg-gray-100 transition-all">Cancel</button>
              <button onClick={handleSaveStaff} className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 transition-all">Save Staff</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsView;
