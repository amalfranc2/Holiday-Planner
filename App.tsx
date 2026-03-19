
import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import MainView from './components/MainView';
import SettingsView from './components/SettingsView';
import LoginView from './components/LoginView';
import Reports from './components/Reports';
import { UserRole, HolidayRequest, Branch, Staff, User, SystemConfig } from './types';
import { BRANCHES as INITIAL_BRANCHES, MOCK_STAFF as INITIAL_STAFF, THEMES, DEFAULT_HEATMAP_THRESHOLDS } from './constants';

const INITIAL_CONFIG: SystemConfig = {
  primeTimeMonths: [6, 7, 11], // July, August, December
  defaultAllowance: 28,
  heatmapThresholds: DEFAULT_HEATMAP_THRESHOLDS
};

const INITIAL_ADMIN: User = {
  id: 'admin-1',
  username: 'admin',
  password: 'password123',
  role: 'HeadOffice',
  name: 'Head Office Admin',
  defaultView: 'Dashboard',
  bubbleStyle: 'arc'
};

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<'Calendar' | 'Settings' | 'Reports'>('Calendar');
  const [viewType, setViewType] = useState<'Dashboard' | 'Yearly'>('Dashboard');
  const [loading, setLoading] = useState(true);
  const [dataLoaded, setDataLoaded] = useState(false); // Safety lock
  const [dbError, setDbError] = useState<string | null>(null);
  
  // Data State
  const [branches, setBranches] = useState<Branch[]>(INITIAL_BRANCHES);
  const [staff, setStaff] = useState<Staff[]>(INITIAL_STAFF);
  const [requests, setRequests] = useState<HolidayRequest[]>([]);
  const [users, setUsers] = useState<User[]>([INITIAL_ADMIN]);
  const [systemConfig, setSystemConfig] = useState<SystemConfig>(INITIAL_CONFIG);
  
  const [currentBranchId, setCurrentBranchId] = useState<string>(INITIAL_BRANCHES[0].id);
  const [isShrunk, setIsShrunk] = useState(false);

  // Apply Theme
  useEffect(() => {
    if (currentUser?.themeColor) {
      const theme = THEMES[currentUser.themeColor as keyof typeof THEMES] || THEMES.indigo;
      Object.entries(theme).forEach(([key, value]) => {
        document.documentElement.style.setProperty(`--primary-${key}`, value);
      });
    } else {
      // Reset to default indigo if no theme is set
      Object.entries(THEMES.indigo).forEach(([key, value]) => {
        document.documentElement.style.setProperty(`--primary-${key}`, value);
      });
    }
  }, [currentUser?.themeColor]);

  // Scroll listener for shrinking header
  useEffect(() => {
    const root = document.getElementById('root');
    const handleScroll = () => {
      const isLandscape = window.innerWidth > window.innerHeight && window.innerHeight < 500;
      const scrollY = root ? root.scrollTop : window.scrollY;
      
      setIsShrunk(prev => {
        if (isLandscape) return true;
        // Hysteresis: shrink at 60, expand at 30 to prevent flickering
        if (prev) return scrollY > 30;
        return scrollY > 60;
      });
    };
    
    if (root) {
      root.addEventListener('scroll', handleScroll);
    } else {
      window.addEventListener('scroll', handleScroll);
    }
    
    window.addEventListener('resize', handleScroll);
    handleScroll();
    
    return () => {
      if (root) {
        root.removeEventListener('scroll', handleScroll);
      } else {
        window.removeEventListener('scroll', handleScroll);
      }
      window.removeEventListener('resize', handleScroll);
    };
  }, []);

  // API Persistence
  useEffect(() => {
    const fetchData = async () => {
      try {
        const fetchJson = async (url: string) => {
          const r = await fetch(url);
          const data = await r.json();
          if (!r.ok) {
            if (r.status === 500) throw new Error(data.error || "Database connection failed (Server Error 500)");
            return null;
          }
          return data;
        };

        const [resBranches, resStaff, resRequests, resUsers, resConfig] = await Promise.all([
          fetchJson('/api/branches'),
          fetchJson('/api/staff'),
          fetchJson('/api/requests'),
          fetchJson('/api/users'),
          fetchJson('/api/config')
        ]);

        // If all core fetches returned null, the DB is likely not connected
        if (resBranches === null && resStaff === null && resRequests === null) {
          setDbError("Could not connect to the database. Please check your POSTGRES_URL in the .env file.");
          return; // Stop here if we can't connect
        }

        if (Array.isArray(resBranches) && resBranches.length > 0) setBranches(resBranches);
        if (Array.isArray(resStaff) && resStaff.length > 0) setStaff(resStaff);
        if (Array.isArray(resRequests)) setRequests(resRequests);
        if (Array.isArray(resUsers) && resUsers.length > 0) setUsers(resUsers);
        if (resConfig && !resConfig.error) setSystemConfig(resConfig);

        const savedSession = localStorage.getItem('holiday_session');
        if (savedSession) {
          const sessionUser = JSON.parse(savedSession);
          setCurrentUser(sessionUser);
          setViewType(sessionUser.defaultView || 'Dashboard');
          if (sessionUser.role === 'HeadOffice') {
            setCurrentBranchId('all');
          } else if (sessionUser.role === 'Manager' && sessionUser.branchId) {
            setCurrentBranchId(sessionUser.branchId);
          }
        }
        
        // Success! Unlock syncing
        setDataLoaded(true);
      } catch (error: any) {
        console.error("Failed to fetch data from API", error);
        setDbError(error.message || "An unexpected error occurred while connecting to the database.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const syncData = async (endpoint: string, data: any) => {
    if (!dataLoaded) return; // Safety lock: don't sync if we haven't loaded yet
    try {
      await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
    } catch (error) {
      console.error(`Failed to sync data to ${endpoint}`, error);
    }
  };

  useEffect(() => {
    if (!loading) syncData('/api/requests', requests);
  }, [requests, loading]);

  useEffect(() => {
    if (!loading) syncData('/api/branches', branches);
  }, [branches, loading]);

  useEffect(() => {
    if (!loading) syncData('/api/staff', staff);
  }, [staff, loading]);

  useEffect(() => {
    if (!loading) syncData('/api/users', users);
  }, [users, loading]);

  useEffect(() => {
    if (!loading) syncData('/api/config', systemConfig);
  }, [systemConfig, loading]);

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    setViewType(user.defaultView || 'Dashboard');
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
      id: `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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

  const handleUpdateUsers = (updatedUsers: User[]) => {
    setUsers(updatedUsers);
    if (currentUser) {
      const updatedMe = updatedUsers.find(u => u.id === currentUser.id);
      if (updatedMe) {
        setCurrentUser(updatedMe);
        localStorage.setItem('holiday_session', JSON.stringify(updatedMe));
      }
    }
  };

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-500 font-bold animate-pulse">Connecting to Vercel Database...</p>
        </div>
      </div>
    );
  }

  if (dbError) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-red-50 p-6">
        <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-xl border border-red-100 text-center">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6 text-2xl">
            <i className="fa-solid fa-database"></i>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Database Connection Error</h2>
          <p className="text-gray-600 mb-6 leading-relaxed">
            {dbError}
          </p>
          <div className="bg-gray-50 p-4 rounded-xl text-left text-xs font-mono text-gray-500 mb-6 border border-gray-100">
            <p className="font-bold text-gray-700 mb-1">Troubleshooting:</p>
            <ul className="list-disc ml-4 space-y-1">
              <li>Check if your <code className="bg-gray-200 px-1 rounded">.env</code> file exists in the root folder.</li>
              <li>Ensure it contains <code className="bg-gray-200 px-1 rounded">POSTGRES_URL=...</code></li>
              <li>Verify there are no spaces around the <code className="bg-gray-200 px-1 rounded">=</code> sign.</li>
              <li>Restart your server after editing the file.</li>
            </ul>
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="w-full py-3 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 transition-all shadow-md"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

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
          onUpdateBranches={setBranches}
          onUpdateStaff={setStaff}
          onUpdateUsers={handleUpdateUsers}
          onUpdateConfig={setSystemConfig}
        />
      )}
    </Layout>
  );
};

export default App;
