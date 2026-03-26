
import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import MainView from './components/MainView';
import SettingsView from './components/SettingsView';
import LoginView from './components/LoginView';
import Reports from './components/Reports';
import ErrorBoundary from './components/ErrorBoundary';
import { UserRole, HolidayRequest, Branch, Staff, User, SystemConfig } from './types';
import { THEMES, DEFAULT_HEATMAP_THRESHOLDS } from './constants';

const INITIAL_CONFIG: SystemConfig = {
  primeTimeMonths: [6, 7, 11], // July, August, December
  defaultAllowance: 28,
  heatmapThresholds: DEFAULT_HEATMAP_THRESHOLDS
};

const INITIAL_ADMIN: User = {
  id: 'admin-1',
  username: 'admin',
  password: 'password123',
  role: 'S-ADMIN',
  name: 'Head Office Admin',
  defaultView: 'Dashboard',
  bubbleStyle: 'arc'
};


const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<'Calendar' | 'Settings' | 'Reports'>('Calendar');
  const [viewType, setViewType] = useState<'Dashboard' | 'Yearly'>('Dashboard');
  const [loading, setLoading] = useState(true);
  const [dataLoaded, setDataLoaded] = useState(false);
  
  // Data State
  const [branches, setBranches] = useState<Branch[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [requests, setRequests] = useState<HolidayRequest[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [systemConfig, setSystemConfig] = useState<SystemConfig>(INITIAL_CONFIG);
  
  const [currentBranchId, setCurrentBranchId] = useState<string>('all');
  const [isShrunk, setIsShrunk] = useState(false);

  // Fetch Data from Backend
  const fetchData = async (user: User) => {
    setLoading(true);
    try {
      const headers = {
        'x-user-id': user.id,
        'x-user-role': user.role,
        'x-user-branch-id': user.branchId || ''
      };

      const [branchesRes, staffRes, requestsRes, usersRes, configRes] = await Promise.all([
        fetch('/api/branches', { headers }),
        fetch('/api/staff', { headers }),
        fetch('/api/requests', { headers }),
        fetch('/api/users', { headers }),
        fetch('/api/config', { headers })
      ]);

      if (branchesRes.ok) setBranches(await branchesRes.json());
      if (staffRes.ok) setStaff(await staffRes.json());
      if (requestsRes.ok) setRequests(await requestsRes.json());
      if (usersRes.ok) setUsers(await usersRes.json());
      if (configRes.ok) setSystemConfig(await configRes.json());

    } catch (error) {
      console.error("Failed to fetch data from backend:", error);
    } finally {
      setLoading(false);
      setDataLoaded(true);
    }
  };

  // Persistence
  useEffect(() => {
    const savedSession = localStorage.getItem('holiday_session');
    
    if (savedSession) {
      try {
        const user = JSON.parse(savedSession);
        setCurrentUser(user);
        setViewType(user.defaultView || 'Dashboard');
        if (user.role === 'S-ADMIN' || user.role === 'ADMIN') {
          setCurrentBranchId('all');
        } else if (user.branchId) {
          setCurrentBranchId(user.branchId);
        }
        fetchData(user);
      } catch (e) {
        localStorage.removeItem('holiday_session');
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, []);

  // Apply Theme
  useEffect(() => {
    if (currentUser?.themeColor) {
      const theme = THEMES[currentUser.themeColor as keyof typeof THEMES] || THEMES.indigo;
      Object.entries(theme).forEach(([key, value]) => {
        document.documentElement.style.setProperty(`--primary-${key}`, value);
      });
    } else {
      Object.entries(THEMES.indigo).forEach(([key, value]) => {
        document.documentElement.style.setProperty(`--primary-${key}`, value);
      });
    }
  }, [currentUser?.themeColor]);

  // Scroll reset on view change
  useEffect(() => {
    // We use both window and root to be safe, and use behavior: 'auto' (instant) 
    // for the initial reset to prevent the "locked" feeling, then maybe smooth if needed.
    // Actually, the user liked smooth scrolling, but for tab switching, instant is usually better 
    // to avoid seeing the bottom of the previous page.
    window.scrollTo({ top: 0, behavior: 'auto' });
    const root = document.getElementById('root');
    if (root) root.scrollTo({ top: 0, behavior: 'auto' });
    
    // Small delay to ensure content has rendered and then scroll to top again if needed
    const timer = setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'auto' });
      if (root) root.scrollTo({ top: 0, behavior: 'auto' });
    }, 10);
    
    return () => clearTimeout(timer);
  }, [currentView, viewType]);

  // Scroll listener for shrinking header
  useEffect(() => {
    const root = document.getElementById('root');
    const handleScroll = () => {
      const isLandscape = window.innerWidth > window.innerHeight && window.innerHeight < 500;
      const scrollY = root ? root.scrollTop : window.scrollY;
      setIsShrunk(prev => {
        if (isLandscape) return true;
        if (prev) return scrollY > 30;
        return scrollY > 60;
      });
    };
    if (root) root.addEventListener('scroll', handleScroll);
    else window.addEventListener('scroll', handleScroll);
    window.addEventListener('resize', handleScroll);
    handleScroll();
    return () => {
      if (root) root.removeEventListener('scroll', handleScroll);
      else window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, []);

  // Data Handlers
  const getHeaders = () => ({
    'Content-Type': 'application/json',
    'x-user-id': currentUser?.id || '',
    'x-user-role': currentUser?.role || '',
    'x-user-branch-id': currentUser?.branchId || ''
  });

  const handleAddRequest = async (data: Partial<HolidayRequest>) => {
    const id = `req-${Date.now()}`;
    const newReq: HolidayRequest = {
      ...data,
      id,
      status: data.status || 'Pending',
      createdAt: new Date().toISOString(),
      authorId: currentUser?.id
    } as HolidayRequest;
    
    setRequests(prev => [...prev, newReq]);

    try {
      await fetch('/api/requests', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify([newReq])
      });
    } catch (error) {
      console.error("Failed to save request:", error);
    }
  };

  const handleUpdateRequest = async (data: Partial<HolidayRequest>) => {
    if (!data.id) return;
    const updatedRequests = requests.map(r => r.id === data.id ? { ...r, ...data } : r);
    setRequests(updatedRequests);

    try {
      const updatedReq = updatedRequests.find(r => r.id === data.id);
      if (updatedReq) {
        await fetch('/api/requests', {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify([updatedReq])
        });
      }
    } catch (error) {
      console.error("Failed to update request:", error);
    }
  };

  const handleDeleteRequest = async (id: string) => {
    setRequests(prev => prev.filter(r => r.id !== id));
    try {
      await fetch(`/api/requests/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
    } catch (error) {
      console.error("Failed to delete request:", error);
    }
  };

  const handleUpdateUsers = async (updatedUsers: User[]) => {
    setUsers(updatedUsers);
    
    try {
      await fetch('/api/users', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(updatedUsers)
      });
    } catch (error) {
      console.error("Failed to update users:", error);
    }

    // Update current user if they were updated
    if (currentUser) {
      const updatedMe = updatedUsers.find(u => u.id === currentUser.id);
      if (updatedMe) {
        setCurrentUser(updatedMe);
        localStorage.setItem('holiday_session', JSON.stringify(updatedMe));
      }
    }
  };

  const handleDeleteUser = async (id: string) => {
    setUsers(prev => prev.filter(u => u.id !== id));
    try {
      await fetch(`/api/users/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
    } catch (error) {
      console.error("Failed to delete user:", error);
    }
  };

  const handleUpdateBranches = async (updatedBranches: Branch[]) => {
    setBranches(updatedBranches);
    try {
      await fetch('/api/branches', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(updatedBranches)
      });
    } catch (error) {
      console.error("Failed to update branches:", error);
    }
  };

  const handleDeleteBranch = async (id: string) => {
    setBranches(prev => prev.filter(b => b.id !== id));
    try {
      await fetch(`/api/branches/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
    } catch (error) {
      console.error("Failed to delete branch:", error);
    }
  };

  const handleUpdateStaff = async (updatedStaff: Staff[]) => {
    setStaff(updatedStaff);
    try {
      await fetch('/api/staff', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(updatedStaff)
      });
    } catch (error) {
      console.error("Failed to update staff:", error);
    }
  };

  const handleDeleteStaff = async (id: string) => {
    setStaff(prev => prev.filter(s => s.id !== id));
    try {
      await fetch(`/api/staff/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
    } catch (error) {
      console.error("Failed to delete staff:", error);
    }
  };

  const handleUpdateConfig = async (config: SystemConfig) => {
    setSystemConfig(config);
    try {
      await fetch('/api/config', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(config)
      });
    } catch (error) {
      console.error("Failed to update config:", error);
    }
  };

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem('holiday_session', JSON.stringify(user));
    setViewType(user.defaultView || 'Dashboard');
    if (user.role === 'S-ADMIN' || user.role === 'ADMIN') {
      setCurrentBranchId('all');
    } else if (user.branchId) {
      setCurrentBranchId(user.branchId);
    }
    fetchData(user);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('holiday_session');
  };

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-500 font-bold animate-pulse">Loading Planner...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginView onLogin={handleLogin} />;
  }

  return (
    <ErrorBoundary>
      <Layout 
        role={currentUser.role} 
        currentUser={currentUser}
        currentBranchId={currentBranchId}
        onBranchChange={setCurrentBranchId}
        onLogout={handleLogout}
        branches={branches}
        currentView={currentView}
        onViewChange={setCurrentView}
        viewType={viewType}
        onViewTypeChange={setViewType}
        isShrunk={isShrunk}
      >
        {currentView === 'Calendar' ? (
          <MainView 
            role={currentUser.role}
            currentUser={currentUser}
            currentBranchId={currentBranchId}
            requests={requests}
            branches={branches}
            staff={staff}
            systemConfig={systemConfig}
            onAddRequest={handleAddRequest}
            onUpdateRequest={handleUpdateRequest}
            onDeleteRequest={handleDeleteRequest}
            isShrunk={isShrunk}
            viewType={viewType}
          />
        ) : currentView === 'Reports' ? (
          <Reports 
            branches={branches}
            staff={staff}
            requests={requests}
            currentUser={currentUser}
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
            onUpdateBranches={handleUpdateBranches}
            onDeleteBranch={handleDeleteBranch}
            onUpdateStaff={handleUpdateStaff}
            onDeleteStaff={handleDeleteStaff}
            onUpdateUsers={handleUpdateUsers}
            onDeleteUser={handleDeleteUser}
            onUpdateConfig={handleUpdateConfig}
          />
        )}
      </Layout>
    </ErrorBoundary>
  );
};

export default App;
