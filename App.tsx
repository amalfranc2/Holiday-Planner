
import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import MainView from './components/MainView';
import SettingsView from './components/SettingsView';
import LoginView from './components/LoginView';
import { UserRole, HolidayRequest, Branch, Staff, User, SystemConfig } from './types';
import { BRANCHES as INITIAL_BRANCHES, MOCK_STAFF as INITIAL_STAFF } from './constants';

const INITIAL_CONFIG: SystemConfig = {
  primeTimeMonths: [6, 7, 11], // July, August, December
  defaultAllowance: 28
};

const INITIAL_ADMIN: User = {
  id: 'admin-1',
  username: 'admin',
  password: 'password123',
  role: 'HeadOffice',
  name: 'Head Office Admin'
};

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<'Calendar' | 'Settings'>('Calendar');
  
  // Data State
  const [branches, setBranches] = useState<Branch[]>(INITIAL_BRANCHES);
  const [staff, setStaff] = useState<Staff[]>(INITIAL_STAFF);
  const [requests, setRequests] = useState<HolidayRequest[]>([]);
  const [users, setUsers] = useState<User[]>([INITIAL_ADMIN]);
  const [systemConfig, setSystemConfig] = useState<SystemConfig>(INITIAL_CONFIG);
  
  const [currentBranchId, setCurrentBranchId] = useState<string>(INITIAL_BRANCHES[0].id);

  // Local storage persistence
  useEffect(() => {
    const savedRequests = localStorage.getItem('holiday_requests');
    const savedBranches = localStorage.getItem('holiday_branches');
    const savedStaff = localStorage.getItem('holiday_staff');
    const savedUsers = localStorage.getItem('holiday_users');
    const savedSession = localStorage.getItem('holiday_session');
    const savedConfig = localStorage.getItem('holiday_config');

    if (savedRequests) setRequests(JSON.parse(savedRequests));
    if (savedBranches) {
      const parsedBranches = JSON.parse(savedBranches);
      setBranches(parsedBranches);
    }
    if (savedStaff) setStaff(JSON.parse(savedStaff));
    if (savedUsers) {
      setUsers(JSON.parse(savedUsers));
    }
    if (savedConfig) setSystemConfig(JSON.parse(savedConfig));
    if (savedSession) {
      const sessionUser = JSON.parse(savedSession);
      setCurrentUser(sessionUser);
      if (sessionUser.role === 'HeadOffice') {
        setCurrentBranchId('all');
      } else if (sessionUser.role === 'Manager' && sessionUser.branchId) {
        setCurrentBranchId(sessionUser.branchId);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('holiday_requests', JSON.stringify(requests));
  }, [requests]);

  useEffect(() => {
    localStorage.setItem('holiday_branches', JSON.stringify(branches));
  }, [branches]);

  useEffect(() => {
    localStorage.setItem('holiday_staff', JSON.stringify(staff));
  }, [staff]);

  useEffect(() => {
    localStorage.setItem('holiday_users', JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    localStorage.setItem('holiday_config', JSON.stringify(systemConfig));
  }, [systemConfig]);

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem('holiday_session', JSON.stringify(user));
    if (user.role === 'HeadOffice') {
      setCurrentBranchId('all');
    } else if (user.role === 'Manager' && user.branchId) {
      setCurrentBranchId(user.branchId);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('holiday_session');
    setCurrentView('Calendar');
  };

  const handleAddRequest = (data: Partial<HolidayRequest>) => {
    const newReq: HolidayRequest = {
      ...data,
      id: `req-${Date.now()}`,
      status: data.status || 'Pending',
      createdAt: new Date().toISOString()
    } as HolidayRequest;
    setRequests(prev => [...prev, newReq]);
  };

  const handleUpdateRequest = (data: Partial<HolidayRequest>) => {
    setRequests(prev => prev.map(r => r.id === data.id ? { ...r, ...data } : r));
  };

  const handleDeleteRequest = (id: string) => {
    setRequests(prev => prev.filter(r => r.id !== id));
  };

  if (!currentUser) {
    return <LoginView onLogin={handleLogin} users={users} />;
  }

  return (
    <Layout 
      role={currentUser.role} 
      currentUser={currentUser}
      currentBranchId={currentBranchId}
      onBranchChange={setCurrentBranchId}
      onLogout={handleLogout}
      branches={branches}
      currentView={currentView}
      onViewChange={setCurrentView}
    >
      {currentView === 'Calendar' ? (
        <MainView 
          role={currentUser.role}
          currentBranchId={currentBranchId}
          requests={requests}
          branches={branches}
          staff={staff}
          systemConfig={systemConfig}
          onAddRequest={handleAddRequest}
          onUpdateRequest={handleUpdateRequest}
          onDeleteRequest={handleDeleteRequest}
        />
      ) : (
        <SettingsView 
          role={currentUser.role}
          currentUser={currentUser}
          currentBranchId={currentBranchId}
          branches={branches}
          staff={staff}
          users={users}
          systemConfig={systemConfig}
          onUpdateBranches={setBranches}
          onUpdateStaff={setStaff}
          onUpdateUsers={setUsers}
          onUpdateConfig={setSystemConfig}
        />
      )}
    </Layout>
  );
};

export default App;
