
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
      // Only fetch if data is not loaded and we have a user (either in state or localStorage)
      const savedSession = localStorage.getItem('holiday_session');
      if (dataLoaded || (!currentUser && !savedSession)) {
        setLoading(false); // Ensure loading is false if no user is found
        return;
      }

      setLoading(true);
      try {
        const fetchJson = async (url: string) => {
          const sessionUser = currentUser || (savedSession ? JSON.parse(savedSession) : null);
          const headers: HeadersInit = {};
          if (sessionUser?.role) {
            headers['x-user-role'] = sessionUser.role;
          }
          if (sessionUser?.branchId) {
            headers['x-user-branch-id'] = sessionUser.branchId;
          }

          // Add a 10-second timeout to the fetch call
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000);

          try {
            const r = await fetch(url, { 
              headers,
              signal: controller.signal
            });
            clearTimeout(timeoutId);
            
            const contentType = r.headers.get("content-type");
            
            if (!r.ok || !contentType || !contentType.includes("application/json")) {
              const text = await r.text();
              let errorMsg = `Server Error (${r.status})`;
              
              try {
                const data = JSON.parse(text);
                errorMsg = data.error || errorMsg;
              } catch (e) {
                if (text.includes("POSTGRES_URL")) {
                  errorMsg = "Database connection failed: POSTGRES_URL is missing in environment variables.";
                } else if (text.startsWith("<!DOCTYPE") || text.startsWith("<html")) {
                  errorMsg = `Backend returned an HTML page instead of JSON. Status: ${r.status}`;
                } else {
                  errorMsg = text.slice(0, 100) || errorMsg;
                }
              }
              throw new Error(errorMsg);
            }
            return await r.json();
          } catch (err: any) {
            clearTimeout(timeoutId);
            if (err.name === 'AbortError') {
              throw new Error("Request timed out. The server might be struggling to connect to the database.");
            }
            throw err;
          }
        };

        const [resHealth, resBranches, resStaff, resRequests, resUsers, resConfig] = await Promise.all([
          fetchJson('/api/health'),
          fetchJson('/api/branches'),
          fetchJson('/api/staff'),
          fetchJson('/api/requests'),
          fetchJson('/api/users'),
          fetchJson('/api/config')
        ]);

        // Check health for explicit DB error
        if (resHealth && !resHealth.dbConnected && resHealth.dbError) {
          setDbError(`Database Connection Failed: ${resHealth.dbError}`);
          return;
        }

        // If all core fetches returned null, the DB is likely not connected
        if (resBranches === null && resStaff === null && resRequests === null) {
          setDbError("Could not connect to the database. Please check your POSTGRES_URL in the .env file.");
          return; // Stop here if we can't connect
        }

        if (Array.isArray(resBranches)) setBranches(resBranches);
        if (Array.isArray(resStaff)) setStaff(resStaff);
        if (Array.isArray(resRequests)) setRequests(resRequests);
        if (Array.isArray(resUsers)) setUsers(resUsers);
        if (resConfig && !resConfig.error) setSystemConfig(resConfig);

        if (savedSession && !currentUser) {
          const sessionUser = JSON.parse(savedSession);
          setCurrentUser(sessionUser);
          setViewType(sessionUser.defaultView || 'Dashboard');
          if (sessionUser.role === 'S-ADMIN' || sessionUser.role === 'ADMIN') {
            setCurrentBranchId('all');
          } else if (sessionUser.role === 'Manager' && sessionUser.branchId) {
            setCurrentBranchId(sessionUser.branchId);
          } else if (sessionUser.role === 'Staff') {
            setCurrentBranchId('all');
          }
        }
        
        // Success! Unlock syncing
        setDataLoaded(true);
        setDbError(null);
      } catch (error: any) {
        console.error("Failed to fetch data from API", error);
        setDbError(error.message || "An unexpected error occurred while connecting to the database.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [dataLoaded, currentUser]);

  const syncData = async (endpoint: string, data: any, method: 'POST' | 'DELETE' = 'POST') => {
    if (!dataLoaded || !currentUser) return;
    try {
      const url = method === 'DELETE' ? `${endpoint}/${data}` : endpoint;
      const body = method === 'DELETE' ? undefined : JSON.stringify(data);
      
      const res = await fetch(url, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          'x-user-role': currentUser.role,
          'x-user-id': currentUser.id,
          'x-user-branch-id': currentUser.branchId || ''
        },
        body
      });
      if (!res.ok) throw new Error(`Failed to sync to ${url}`);
    } catch (error) {
      console.error(`Failed to sync data to ${endpoint}`, error);
    }
  };

  const handleAddRequest = async (data: Partial<HolidayRequest>) => {
    const newReq: HolidayRequest = {
      ...data,
      id: `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      status: data.status || 'Pending',
      createdAt: new Date().toISOString()
    } as HolidayRequest;
    setRequests(prev => [...prev, newReq]);
    await syncData('/api/requests', [newReq]);
  };

  const handleUpdateRequest = async (data: Partial<HolidayRequest>) => {
    setRequests(prev => prev.map(r => r.id === data.id ? { ...r, ...data } : r));
    const updatedReq = requests.find(r => r.id === data.id);
    if (updatedReq) {
      await syncData('/api/requests', [{ ...updatedReq, ...data }]);
    }
  };

  const handleDeleteRequest = async (id: string) => {
    setRequests(prev => prev.filter(r => r.id !== id));
    await syncData('/api/requests', id, 'DELETE');
  };

  const handleUpdateUsers = async (updatedUsers: User[]) => {
    setUsers(updatedUsers);
    await syncData('/api/users', updatedUsers);
    
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
    await syncData('/api/users', id, 'DELETE');
  };

  const handleUpdateBranches = async (updatedBranches: Branch[]) => {
    setBranches(updatedBranches);
    await syncData('/api/branches', updatedBranches);
  };

  const handleDeleteBranch = async (id: string) => {
    setBranches(prev => prev.filter(b => b.id !== id));
    setStaff(prev => prev.filter(s => s.branchId !== id));
    await syncData('/api/branches', id, 'DELETE');
  };

  const handleUpdateStaff = async (updatedStaff: Staff[]) => {
    setStaff(updatedStaff);
    await syncData('/api/staff', updatedStaff);
  };

  const handleDeleteStaff = async (id: string) => {
    setStaff(prev => prev.filter(s => s.id !== id));
    await syncData('/api/staff', id, 'DELETE');
  };

  const handleUpdateConfig = async (config: SystemConfig) => {
    setSystemConfig(config);
    await syncData('/api/config', config);
  };

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    setViewType(user.defaultView || 'Dashboard');
    localStorage.setItem('holiday_session', JSON.stringify(user));
    if (user.role === 'S-ADMIN' || user.role === 'ADMIN') {
      setCurrentBranchId('all');
    } else if ((user.role === 'Manager' || user.role === 'Staff') && user.branchId) {
      setCurrentBranchId(user.branchId);
    } else {
      setCurrentBranchId('all');
    }
    setDataLoaded(false); // Trigger re-fetch with new role headers
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('holiday_session');
    setCurrentView('Calendar');
    setDataLoaded(false); // Trigger re-fetch of full users list for next login
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
            <p className="font-bold text-gray-700 mb-1">How to fix this on Vercel:</p>
            <ul className="list-disc ml-4 space-y-1">
              <li>Open your <strong>Vercel Dashboard</strong>.</li>
              <li>Go to your project <strong>Settings</strong> &gt; <strong>Environment Variables</strong>.</li>
              <li>Add <strong>POSTGRES_URL</strong> with your database connection string.</li>
              <li><strong>Redeploy</strong> your application for the changes to take effect.</li>
              <li>Ensure the value has no quotes or extra spaces.</li>
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
    return <LoginView onLogin={handleLogin} />;
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
  );
};

export default App;
