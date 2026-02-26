
import React, { useState } from 'react';
import { Branch, Staff, UserRole, StaffCategory, User, SystemConfig } from '../types';
import { CATEGORIES } from '../constants';

interface SettingsViewProps {
  role: UserRole;
  currentUser: User;
  currentBranchId: string;
  branches: Branch[];
  staff: Staff[];
  users: User[];
  systemConfig: SystemConfig;
  onUpdateBranches: (branches: Branch[]) => void;
  onUpdateStaff: (staff: Staff[]) => void;
  onUpdateUsers: (users: User[]) => void;
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
  onUpdateStaff,
  onUpdateUsers,
  onUpdateConfig,
}) => {
  const [editingBranch, setEditingBranch] = useState<Partial<Branch> | null>(null);
  const [editingStaff, setEditingStaff] = useState<Partial<Staff> | null>(null);
  const [editingUser, setEditingUser] = useState<Partial<User> | null>(null);
  const [activeTab, setActiveTab] = useState<'Branches' | 'Staff' | 'Users' | 'Profile' | 'System'>(role === 'HeadOffice' ? 'Branches' : 'Staff');
  
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMessage, setPasswordMessage] = useState({ text: '', type: '' });

  const isAdmin = role === 'HeadOffice';

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
    if (editingUser.role === 'Manager' && !editingUser.branchId) return;

    if (editingUser.id) {
      onUpdateUsers(users.map(u => u.id === editingUser.id ? editingUser as User : u));
    } else {
      const newUser: User = {
        ...editingUser as User,
        id: `user-${Date.now()}`,
      };
      onUpdateUsers([...users, newUser]);
    }
    setEditingUser(null);
  };

  const handleDeleteUser = (id: string) => {
    if (id === currentUser.id) {
      alert("You cannot delete your own account.");
      return;
    }
    if (window.confirm('Are you sure you want to delete this user?')) {
      onUpdateUsers(users.filter(u => u.id !== id));
    }
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
      };
      onUpdateBranches([...branches, newBranch]);
    }
    setEditingBranch(null);
  };

  const handleDeleteBranch = (id: string) => {
    if (window.confirm('Are you sure? This will also remove all staff associated with this branch.')) {
      onUpdateBranches(branches.filter(b => b.id !== id));
      onUpdateStaff(staff.filter(s => s.branchId !== id));
    }
  };

  // Staff Handlers
  const handleSaveStaff = () => {
    if (!editingStaff?.name || !editingStaff?.branchId || !editingStaff?.category) return;

    if (editingStaff.id) {
      onUpdateStaff(staff.map(s => s.id === editingStaff.id ? editingStaff as Staff : s));
    } else {
      const newStaff: Staff = {
        id: `staff-${Date.now()}`,
        name: editingStaff.name,
        category: editingStaff.category as StaffCategory,
        branchId: editingStaff.branchId,
        totalAllowance: editingStaff.totalAllowance || systemConfig.defaultAllowance,
      };
      onUpdateStaff([...staff, newStaff]);
    }
    setEditingStaff(null);
  };

  const handleDeleteStaff = (id: string) => {
    if (window.confirm('Delete this staff member?')) {
      onUpdateStaff(staff.filter(s => s.id !== id));
    }
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
                  className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'Branches' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500'}`}
                >
                  Branches
                </button>
                <button 
                  onClick={() => setActiveTab('Users')}
                  className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'Users' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500'}`}
                >
                  Users
                </button>
                <button 
                  onClick={() => setActiveTab('System')}
                  className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'System' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500'}`}
                >
                  System
                </button>
              </>
            )}
            <button 
              onClick={() => setActiveTab('Staff')}
              className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'Staff' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500'}`}
            >
              Staff
            </button>
            <button 
              onClick={() => setActiveTab('Profile')}
              className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'Profile' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500'}`}
            >
              Profile
            </button>
          </div>
        </div>

        {activeTab === 'System' && isAdmin && (
          <div className="max-w-2xl mx-auto space-y-8 py-4">
            <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100 space-y-6">
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <i className="fa-solid fa-sliders text-indigo-600"></i>
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
                      className="w-32 px-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
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
                              ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' 
                              : 'bg-white border-gray-200 text-gray-500 hover:border-indigo-300'
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
              <div className="w-20 h-20 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl font-bold">
                {currentUser.name[0]}
              </div>
              <h3 className="text-xl font-bold text-gray-800">{currentUser.name}</h3>
              <p className="text-sm text-gray-500 capitalize">{currentUser.role} Account</p>
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
                    className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="Min 4 characters"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Confirm Password</label>
                  <input 
                    type="password" 
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <button type="submit" className="w-full py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all">
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
          </div>
        )}

        {activeTab === 'Users' && isAdmin && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-700">User Accounts</h3>
              <button 
                onClick={() => setEditingUser({ name: '', username: '', password: '', role: 'Manager' })}
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all"
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
                  {users.map(u => (
                    <tr key={u.id} className="hover:bg-gray-50 transition-colors group">
                      <td className="p-4 text-sm font-medium text-gray-800">{u.name}</td>
                      <td className="p-4 text-sm text-gray-600">{u.username}</td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase ${
                          u.role === 'HeadOffice' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-700'
                        }`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="p-4 text-sm text-gray-600">
                        {u.role === 'Manager' ? (branches.find(b => b.id === u.branchId)?.name || 'None') : 'N/A'}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => setEditingUser(u)} className="p-2 text-gray-400 hover:text-indigo-600"><i className="fa-solid fa-pen"></i></button>
                          <button onClick={() => handleDeleteUser(u.id)} className="p-2 text-gray-400 hover:text-red-600"><i className="fa-solid fa-trash"></i></button>
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
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all"
              >
                <i className="fa-solid fa-plus mr-2"></i> Add Branch
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {branches.map(branch => (
                <div key={branch.id} className="p-4 border border-gray-100 rounded-xl hover:border-indigo-200 transition-all group">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-gray-800">{branch.name}</h4>
                      <p className="text-xs text-gray-500">{branch.location}</p>
                    </div>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => setEditingBranch(branch)} className="p-2 text-gray-400 hover:text-indigo-600"><i className="fa-solid fa-pen"></i></button>
                      <button onClick={() => handleDeleteBranch(branch.id)} className="p-2 text-gray-400 hover:text-red-600"><i className="fa-solid fa-trash"></i></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
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
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all"
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
                          <button onClick={() => setEditingStaff(s)} className="p-2 text-gray-400 hover:text-indigo-600"><i className="fa-solid fa-pen"></i></button>
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
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  placeholder="e.g. London Central"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Location</label>
                <input 
                  type="text" 
                  value={editingBranch.location} 
                  onChange={e => setEditingBranch({...editingBranch, location: e.target.value})}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  placeholder="e.g. Oxford Street"
                />
              </div>
            </div>
            <div className="p-6 bg-gray-50 flex gap-3">
              <button onClick={() => setEditingBranch(null)} className="flex-1 px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-xl font-bold hover:bg-gray-100 transition-all">Cancel</button>
              <button onClick={handleSaveBranch} className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all">Save Branch</button>
            </div>
          </div>
        </div>
      )}

      {/* User Edit Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-xl font-bold text-gray-800">{editingUser.id ? 'Edit User' : 'Create New User'}</h3>
              <button onClick={() => setEditingUser(null)} className="text-gray-400 hover:text-gray-600"><i className="fa-solid fa-xmark"></i></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Full Name</label>
                <input 
                  type="text" 
                  value={editingUser.name} 
                  onChange={e => setEditingUser({...editingUser, name: e.target.value})}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  placeholder="e.g. Alice Smith"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Username</label>
                <input 
                  type="text" 
                  value={editingUser.username} 
                  onChange={e => setEditingUser({...editingUser, username: e.target.value})}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  placeholder="e.g. asmith"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Password</label>
                <input 
                  type="password" 
                  value={editingUser.password} 
                  onChange={e => setEditingUser({...editingUser, password: e.target.value})}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  placeholder="Enter password"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Role</label>
                <select 
                  value={editingUser.role} 
                  onChange={e => setEditingUser({...editingUser, role: e.target.value as UserRole})}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                >
                  <option value="HeadOffice">Head Office (Admin)</option>
                  <option value="Manager">Branch Manager</option>
                </select>
              </div>
              {editingUser.role === 'Manager' && (
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Assigned Branch</label>
                  <select 
                    value={editingUser.branchId} 
                    onChange={e => setEditingUser({...editingUser, branchId: e.target.value})}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  >
                    <option value="">Select Branch</option>
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div className="p-6 bg-gray-50 flex gap-3">
              <button onClick={() => setEditingUser(null)} className="flex-1 px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-xl font-bold hover:bg-gray-100 transition-all">Cancel</button>
              <button onClick={handleSaveUser} className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all">Save User</button>
            </div>
          </div>
        </div>
      )}

      {/* Staff Edit Modal */}
      {editingStaff && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-xl font-bold text-gray-800">{editingStaff.id ? 'Edit Staff Member' : 'Add New Staff'}</h3>
              <button onClick={() => setEditingStaff(null)} className="text-gray-400 hover:text-gray-600"><i className="fa-solid fa-xmark"></i></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Full Name</label>
                <input 
                  type="text" 
                  value={editingStaff.name} 
                  onChange={e => setEditingStaff({...editingStaff, name: e.target.value})}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  placeholder="e.g. John Doe"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Category</label>
                <select 
                  value={editingStaff.category} 
                  onChange={e => setEditingStaff({...editingStaff, category: e.target.value as StaffCategory})}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                >
                  {CATEGORIES.map(cat => (
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
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
              </div>
              {isAdmin && (
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Branch</label>
                  <select 
                    value={editingStaff.branchId} 
                    onChange={e => setEditingStaff({...editingStaff, branchId: e.target.value})}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  >
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div className="p-6 bg-gray-50 flex gap-3">
              <button onClick={() => setEditingStaff(null)} className="flex-1 px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-xl font-bold hover:bg-gray-100 transition-all">Cancel</button>
              <button onClick={handleSaveStaff} className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all">Save Staff</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsView;
