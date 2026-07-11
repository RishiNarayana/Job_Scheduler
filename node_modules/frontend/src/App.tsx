import React, { useState, useEffect } from 'react';

const API_BASE = 'http://localhost:4000/api/v1';

interface User {
  id: string;
  email: string;
  fullName: string;
}

interface Org {
  _id: string;
  name: string;
  slug: string;
}

interface Project {
  _id: string;
  organizationId: string;
  name: string;
  slug: string;
}

interface Queue {
  _id: string;
  name: string;
  priority: number;
  concurrencyLimit?: number;
  retryPolicyId?: { _id: string; name: string } | string;
  isPaused: boolean;
}

interface RetryPolicy {
  _id: string;
  name: string;
  type: string;
  baseDelayMs: number;
  maxDelayMs: number;
  maxAttempts: number;
}

interface WorkerInfo {
  _id: string;
  name: string;
  status: 'active' | 'offline' | 'stalled';
  concurrencyLimit: number;
  lastHeartbeatAt: string;
  startedAt: string;
}

interface Job {
  _id: string;
  queueId: string | { _id: string; name: string };
  status: string;
  payload: any;
  attemptsMade: number;
  maxAttempts: number;
  scheduledAt: string;
  idempotencyKey?: string;
  lastError?: string;
  createdAt: string;
}

interface JobExecutionLog {
  _id: string;
  level: string;
  message: string;
  timestamp: string;
}

interface JobExecution {
  _id: string;
  attempt: number;
  status: string;
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  error?: string;
  logs: JobExecutionLog[];
}

export default function App() {
  // Auth State
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [user, setUser] = useState<User | null>(null);
  
  // Auth Form State
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // App Workspace State
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjId, setSelectedProjId] = useState<string>('');

  // Navigation Tab
  const [activeTab, setActiveTab] = useState<'dashboard' | 'jobs' | 'scheduled' | 'queues' | 'workers'>('dashboard');

  // Dashboard Stats
  const [stats, setStats] = useState<any>({
    jobStatuses: { queued: 0, scheduled: 0, running: 0, retrying: 0, completed: 0, failed: 0, dead_letter: 0, cancelled: 0 },
    activeWorkers: 0,
    avgDurationMs: 0,
    queueStats: []
  });

  // Data Lists
  const [queues, setQueues] = useState<Queue[]>([]);
  const [policies, setPolicies] = useState<RetryPolicy[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedQueueId, setSelectedQueueId] = useState<string>('all');
  const [selectedJobStatus, setSelectedJobStatus] = useState<string>('all');
  const [cronJobs, setCronJobs] = useState<any[]>([]);
  const [workers, setWorkers] = useState<WorkerInfo[]>([]);

  // Modal Control
  const [modalType, setModalType] = useState<'enqueue' | 'createCron' | 'createQueue' | 'createPolicy' | 'jobDetails' | null>(null);
  const [selectedJobDetails, setSelectedJobDetails] = useState<{ job: Job; executions: JobExecution[] } | null>(null);

  // Form Submissions
  const [newJobPayload, setNewJobPayload] = useState('{\n  "task": "process_images",\n  "images": ["test1.png"]\n}');
  const [newJobDelaySecs, setNewJobDelaySecs] = useState('0');
  const [newJobIdempotencyKey, setNewJobIdempotencyKey] = useState('');
  const [newJobQueueId, setNewJobQueueId] = useState('');
  const [newJobPolicyId, setNewJobPolicyId] = useState('');

  const [newCronName, setNewCronName] = useState('');
  const [newCronExpression, setNewCronExpression] = useState('*/5 * * * *');
  const [newCronPayload, setNewCronPayload] = useState('{\n  "task": "send_email",\n  "to": "alert@example.com"\n}');
  const [newCronQueueId, setNewCronQueueId] = useState('');
  const [newCronPolicyId, setNewCronPolicyId] = useState('');

  const [newQueueName, setNewQueueName] = useState('');
  const [newQueuePriority, setNewQueuePriority] = useState('1');
  const [newQueueConcurrency, setNewQueueConcurrency] = useState('5');
  const [newQueuePolicyId, setNewQueuePolicyId] = useState('');

  const [newPolicyName, setNewPolicyName] = useState('');
  const [newPolicyType, setNewPolicyType] = useState('exponential');
  const [newPolicyBaseDelay, setNewPolicyBaseDelay] = useState('1000');
  const [newPolicyMaxDelay, setNewPolicyMaxDelay] = useState('60000');
  const [newPolicyMaxAttempts, setNewPolicyMaxAttempts] = useState('3');

  // Load user info & workspace data on startup
  useEffect(() => {
    if (token) {
      fetchUser();
      fetchOrgs();
    } else {
      setUser(null);
    }
  }, [token]);

  // Load projects when org changes
  useEffect(() => {
    if (selectedOrgId) {
      fetchProjects(selectedOrgId);
    } else {
      setProjects([]);
      setSelectedProjId('');
    }
  }, [selectedOrgId]);

  // Load dashboard / tab data when project changes
  useEffect(() => {
    if (selectedProjId) {
      fetchTabData();
    }
  }, [selectedProjId, activeTab, selectedQueueId, selectedJobStatus]);

  // Setup periodic polling for real-time stats
  useEffect(() => {
    if (!selectedProjId || !token) return;

    const interval = setInterval(() => {
      fetchStats();
      if (activeTab === 'dashboard' || activeTab === 'jobs') {
        fetchJobs();
      }
      if (activeTab === 'workers' || activeTab === 'dashboard') {
        fetchWorkers();
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [selectedProjId, activeTab, token, selectedQueueId, selectedJobStatus]);

  const headers = () => ({
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : ''
  });

  const fetchUser = async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/me`, { headers: headers() });
      if (res.ok) {
        const data = await res.json();
        setUser(data);
      } else {
        handleLogout();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchOrgs = async () => {
    try {
      const res = await fetch(`${API_BASE}/organizations`, { headers: headers() });
      if (res.ok) {
        const data = await res.json();
        setOrgs(data);
        if (data.length > 0) {
          setSelectedOrgId(data[0]._id);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchProjects = async (orgId: string) => {
    try {
      const res = await fetch(`${API_BASE}/projects?organizationId=${orgId}`, { headers: headers() });
      if (res.ok) {
        const data = await res.json();
        setProjects(data);
        if (data.length > 0) {
          setSelectedProjId(data[0]._id);
        } else {
          setSelectedProjId('');
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchTabData = () => {
    fetchStats();
    fetchQueues();
    fetchPolicies();
    fetchJobs();
    fetchCronJobs();
    fetchWorkers();
  };

  const fetchStats = async () => {
    if (!selectedProjId) return;
    try {
      const res = await fetch(`${API_BASE}/dashboard/stats?projectId=${selectedProjId}`, { headers: headers() });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchQueues = async () => {
    if (!selectedProjId) return;
    try {
      const res = await fetch(`${API_BASE}/queues?projectId=${selectedProjId}`, { headers: headers() });
      if (res.ok) {
        const data = await res.json();
        setQueues(data);
        if (data.length > 0) {
          setNewJobQueueId(data[0]._id);
          setNewCronQueueId(data[0]._id);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchPolicies = async () => {
    if (!selectedProjId) return;
    try {
      const res = await fetch(`${API_BASE}/retry-policies?projectId=${selectedProjId}`, { headers: headers() });
      if (res.ok) {
        const data = await res.json();
        setPolicies(data);
        if (data.length > 0) {
          setNewJobPolicyId(data[0]._id);
          setNewCronPolicyId(data[0]._id);
          setNewQueuePolicyId(data[0]._id);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchJobs = async () => {
    if (queues.length === 0) return;
    
    let targetQueueId = selectedQueueId;
    if (targetQueueId === 'all') {
      if (queues.length === 0) return;
      // Fetch for first queue or loop? Actually, the backend API requires queueId.
      // So if 'all' is selected, we can list jobs for the first queue for demonstration
      targetQueueId = queues[0]._id;
    }

    try {
      let url = `${API_BASE}/jobs?queueId=${targetQueueId}&limit=50`;
      if (selectedJobStatus !== 'all') {
        url += `&status=${selectedJobStatus}`;
      }
      const res = await fetch(url, { headers: headers() });
      if (res.ok) {
        const data = await res.json();
        setJobs(data.jobs);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchCronJobs = async () => {
    if (!selectedProjId) return;
    try {
      const res = await fetch(`${API_BASE}/scheduled-jobs?projectId=${selectedProjId}`, { headers: headers() });
      if (res.ok) {
        const data = await res.json();
        setCronJobs(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchWorkers = async () => {
    try {
      const res = await fetch(`${API_BASE}/workers`, { headers: headers() });
      if (res.ok) {
        const data = await res.json();
        setWorkers(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Auth Operations
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    
    const url = authMode === 'login' ? `${API_BASE}/auth/login` : `${API_BASE}/auth/register`;
    const body = authMode === 'login' 
      ? { email, password } 
      : { email, password, fullName };

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Authentication failed');
        return;
      }

      localStorage.setItem('token', data.token);
      setToken(data.token);
    } catch (err: any) {
      setErrorMsg(err.message || 'Server error');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  // Form Handlers
  const handleEnqueueJob = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const parsedPayload = JSON.parse(newJobPayload);
      const scheduledAt = newJobDelaySecs !== '0' 
        ? new Date(Date.now() + parseInt(newJobDelaySecs) * 1000).toISOString() 
        : undefined;

      const res = await fetch(`${API_BASE}/jobs`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          queueId: newJobQueueId,
          payload: parsedPayload,
          scheduledAt,
          idempotencyKey: newJobIdempotencyKey || undefined,
          retryPolicyId: newJobPolicyId || undefined
        })
      });

      if (res.ok) {
        setModalType(null);
        setNewJobIdempotencyKey('');
        fetchJobs();
        fetchStats();
      } else {
        const data = await res.json();
        alert(`Failed to enqueue job: ${data.error}`);
      }
    } catch (err) {
      alert('Invalid JSON in payload');
    }
  };

  const handleCreateCron = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const parsedPayload = JSON.parse(newCronPayload);
      const res = await fetch(`${API_BASE}/scheduled-jobs`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          projectId: selectedProjId,
          queueId: newCronQueueId,
          name: newCronName,
          cronExpression: newCronExpression,
          payload: parsedPayload,
          retryPolicyId: newCronPolicyId || undefined
        })
      });

      if (res.ok) {
        setModalType(null);
        setNewCronName('');
        fetchCronJobs();
      } else {
        const data = await res.json();
        alert(`Failed to create scheduled job: ${data.error}`);
      }
    } catch (err) {
      alert('Invalid JSON in payload');
    }
  };

  const handleCreateQueue = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch(`${API_BASE}/queues`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        projectId: selectedProjId,
        name: newQueueName,
        priority: parseInt(newQueuePriority),
        concurrencyLimit: newQueueConcurrency ? parseInt(newQueueConcurrency) : undefined,
        retryPolicyId: newQueuePolicyId || undefined
      })
    });

    if (res.ok) {
      setModalType(null);
      setNewQueueName('');
      fetchQueues();
    } else {
      const data = await res.json();
      alert(`Failed to create queue: ${data.error}`);
    }
  };

  const handleCreatePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch(`${API_BASE}/retry-policies`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        projectId: selectedProjId,
        name: newPolicyName,
        type: newPolicyType,
        baseDelayMs: parseInt(newPolicyBaseDelay),
        maxDelayMs: parseInt(newPolicyMaxDelay),
        maxAttempts: parseInt(newPolicyMaxAttempts)
      })
    });

    if (res.ok) {
      setModalType(null);
      setNewPolicyName('');
      fetchPolicies();
    } else {
      const data = await res.json();
      alert(`Failed to create policy: ${data.error}`);
    }
  };

  // Job Actions
  const handleViewJobDetails = async (jobId: string) => {
    try {
      const res = await fetch(`${API_BASE}/jobs/${jobId}`, { headers: headers() });
      if (res.ok) {
        const data = await res.json();
        setSelectedJobDetails(data);
        setModalType('jobDetails');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRetryJob = async (jobId: string) => {
    if (!confirm('Are you sure you want to retry this job?')) return;
    const res = await fetch(`${API_BASE}/jobs/${jobId}/retry`, {
      method: 'POST',
      headers: headers()
    });
    if (res.ok) {
      setModalType(null);
      fetchJobs();
      fetchStats();
    }
  };

  const handleCancelJob = async (jobId: string) => {
    if (!confirm('Are you sure you want to cancel this job?')) return;
    const res = await fetch(`${API_BASE}/jobs/${jobId}/cancel`, {
      method: 'POST',
      headers: headers()
    });
    if (res.ok) {
      setModalType(null);
      fetchJobs();
      fetchStats();
    }
  };

  const handleToggleCron = async (cronId: string) => {
    const res = await fetch(`${API_BASE}/scheduled-jobs/${cronId}/toggle`, {
      method: 'PATCH',
      headers: headers()
    });
    if (res.ok) {
      fetchCronJobs();
    }
  };

  const handleToggleQueuePause = async (queueId: string, currentlyPaused: boolean) => {
    const action = currentlyPaused ? 'resume' : 'pause';
    const res = await fetch(`${API_BASE}/queues/${queueId}/${action}`, {
      method: 'PATCH',
      headers: headers()
    });
    if (res.ok) {
      fetchQueues();
      fetchStats();
    }
  };

  if (!token) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-logo">Job Scheduler</div>
          <h2 className="auth-title">{authMode === 'login' ? 'Sign In' : 'Create Account'}</h2>
          <p className="auth-subtitle">Manage high-throughput background workloads</p>

          {errorMsg && <p style={{ color: 'var(--error)', marginBottom: '15px', fontSize: '0.9rem' }}>{errorMsg}</p>}

          <form onSubmit={handleAuthSubmit}>
            {authMode === 'register' && (
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="John Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input
                type="email"
                className="form-input"
                placeholder="admin@codity.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                type="password"
                className="form-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '10px' }}>
              {authMode === 'login' ? 'Sign In' : 'Sign Up'}
            </button>
          </form>

          <p style={{ marginTop: '20px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            {authMode === 'login' ? "Don't have an account? " : "Already have an account? "}
            <span
              style={{ color: 'var(--primary)', cursor: 'pointer', fontWeight: 600 }}
              onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
            >
              {authMode === 'login' ? 'Create one' : 'Sign in'}
            </span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Header */}
      <header className="header">
        <div className="logo-container">
          <div className="logo">Job Scheduler</div>
        </div>

        <nav className="nav-tabs">
          <button className={`nav-tab ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
            Dashboard
          </button>
          <button className={`nav-tab ${activeTab === 'jobs' ? 'active' : ''}`} onClick={() => setActiveTab('jobs')}>
            Jobs
          </button>
          <button className={`nav-tab ${activeTab === 'scheduled' ? 'active' : ''}`} onClick={() => setActiveTab('scheduled')}>
            Cron Scheduler
          </button>
          <button className={`nav-tab ${activeTab === 'queues' ? 'active' : ''}`} onClick={() => setActiveTab('queues')}>
            Queues & Policies
          </button>
          <button className={`nav-tab ${activeTab === 'workers' ? 'active' : ''}`} onClick={() => setActiveTab('workers')}>
            Workers
          </button>
        </nav>

        <div className="user-profile">
          <span className="user-name">{user?.fullName || user?.email}</span>
          <button className="btn btn-sm btn-logout" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      {/* Main Workspace Area */}
      <main className="main-content">
        {/* Org & Project Selectors */}
        <div className="selectors-row">
          <div>
            <label className="form-label" style={{ marginRight: '8px' }}>Organization:</label>
            <select
              className="select-control"
              value={selectedOrgId}
              onChange={(e) => setSelectedOrgId(e.target.value)}
            >
              {orgs.map((o) => (
                <option key={o._id} value={o._id}>{o.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label" style={{ marginRight: '8px' }}>Project:</label>
            <select
              className="select-control"
              value={selectedProjId}
              onChange={(e) => setSelectedProjId(e.target.value)}
              disabled={projects.length === 0}
            >
              {projects.map((p) => (
                <option key={p._id} value={p._id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>

        {selectedProjId ? (
          <>
            {/* STATS OVERVIEW */}
            <div className="stats-grid">
              <div className="stat-card">
                <span className="stat-label">Active Workers</span>
                <span className="stat-value indigo">{stats.activeWorkers}</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Queued Jobs</span>
                <span className="stat-value warning">{stats.jobStatuses.queued + stats.jobStatuses.retrying}</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Running Jobs</span>
                <span className="stat-value cyan">{stats.jobStatuses.running + stats.jobStatuses.claimed}</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Completed Jobs</span>
                <span className="stat-value success">{stats.jobStatuses.completed}</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Failed / DLQ</span>
                <span className="stat-value error">{stats.jobStatuses.failed + stats.jobStatuses.dead_letter}</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Avg Duration</span>
                <span className="stat-value cyan">{stats.avgDurationMs}ms</span>
              </div>
            </div>

            {/* TAB CONTENTS */}
            {activeTab === 'dashboard' && (
              <div className="dashboard-sections">
                {/* Recent Jobs Table */}
                <div className="section-card">
                  <div className="section-header">
                    <h3 className="section-title">Recent Workloads</h3>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <select 
                        className="select-control" 
                        style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                        value={selectedQueueId}
                        onChange={(e) => setSelectedQueueId(e.target.value)}
                      >
                        <option value="all">First Queue</option>
                        {queues.map(q => <option key={q._id} value={q._id}>{q.name}</option>)}
                      </select>
                      <button className="btn btn-primary btn-sm" onClick={() => setModalType('enqueue')}>
                        + Enqueue Job
                      </button>
                    </div>
                  </div>

                  <div className="table-container">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Job ID</th>
                          <th>Status</th>
                          <th>Task Type</th>
                          <th>Attempts</th>
                          <th>Scheduled At</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {jobs.slice(0, 8).map((job) => (
                          <tr key={job._id}>
                            <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{job._id.slice(-8)}</td>
                            <td>
                              <span className={`badge badge-${job.status}`}>{job.status}</span>
                            </td>
                            <td><code style={{ color: 'var(--secondary)' }}>{job.payload.task || 'unknown'}</code></td>
                            <td>{job.attemptsMade} / {job.maxAttempts}</td>
                            <td>{new Date(job.scheduledAt).toLocaleTimeString()}</td>
                            <td>
                              <button className="btn btn-sm" onClick={() => handleViewJobDetails(job._id)}>
                                Details
                              </button>
                            </td>
                          </tr>
                        ))}
                        {jobs.length === 0 && (
                          <tr>
                            <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                              No jobs found in this queue.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Active Workers Panel */}
                <div className="section-card">
                  <div className="section-header">
                    <h3 className="section-title">Worker Nodes</h3>
                  </div>

                  <div className="workers-list">
                    {workers.map((worker) => (
                      <div className="worker-item" key={worker._id}>
                        <div className="worker-details">
                          <span className="worker-name">
                            <span className={`worker-indicator ${worker.status}`} />
                            {worker.name.split('-').slice(0, 2).join('-')}
                          </span>
                          <span className="worker-meta">
                            Limit: {worker.concurrencyLimit} concurrent jobs
                          </span>
                        </div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {new Date(worker.lastHeartbeatAt).toLocaleTimeString()}
                        </span>
                      </div>
                    ))}
                    {workers.length === 0 && (
                      <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No workers active.</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'jobs' && (
              <div className="section-card">
                <div className="section-header">
                  <h3 className="section-title">Workload Inspector</h3>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <select
                      className="select-control"
                      value={selectedQueueId}
                      onChange={(e) => setSelectedQueueId(e.target.value)}
                    >
                      {queues.map(q => <option key={q._id} value={q._id}>{q.name}</option>)}
                    </select>

                    <select
                      className="select-control"
                      value={selectedJobStatus}
                      onChange={(e) => setSelectedJobStatus(e.target.value)}
                    >
                      <option value="all">All Statuses</option>
                      <option value="queued">Queued</option>
                      <option value="running">Running</option>
                      <option value="completed">Completed</option>
                      <option value="failed">Failed</option>
                      <option value="dead_letter">Dead Letter</option>
                      <option value="cancelled">Cancelled</option>
                    </select>

                    <button className="btn btn-primary" onClick={() => setModalType('enqueue')}>
                      + Enqueue Job
                    </button>
                  </div>
                </div>

                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Job ID</th>
                        <th>Status</th>
                        <th>Task Type</th>
                        <th>Idempotency Key</th>
                        <th>Attempts</th>
                        <th>Scheduled At</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {jobs.map((job) => (
                        <tr key={job._id}>
                          <td style={{ fontFamily: 'monospace' }}>{job._id}</td>
                          <td>
                            <span className={`badge badge-${job.status}`}>{job.status}</span>
                          </td>
                          <td><code>{job.payload.task || 'unknown'}</code></td>
                          <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            {job.idempotencyKey || '-'}
                          </td>
                          <td>{job.attemptsMade} / {job.maxAttempts}</td>
                          <td>{new Date(job.scheduledAt).toLocaleString()}</td>
                          <td>
                            <button className="btn btn-sm" onClick={() => handleViewJobDetails(job._id)}>
                              Inspect
                            </button>
                          </td>
                        </tr>
                      ))}
                      {jobs.length === 0 && (
                        <tr>
                          <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                            No matching jobs found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'scheduled' && (
              <div className="section-card">
                <div className="section-header">
                  <h3 className="section-title">Cron Trigger Rules</h3>
                  <button className="btn btn-primary" onClick={() => setModalType('createCron')}>
                    + New Cron Rule
                  </button>
                </div>

                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Cron Expression</th>
                        <th>Target Queue</th>
                        <th>Task Type</th>
                        <th>Next Run</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cronJobs.map((cron) => (
                        <tr key={cron._id}>
                          <td style={{ fontWeight: 600 }}>{cron.name}</td>
                          <td><code style={{ color: 'var(--secondary)' }}>{cron.cronExpression}</code></td>
                          <td>{cron.queueId?.name || 'Unknown'}</td>
                          <td><code>{cron.payload?.task || 'unknown'}</code></td>
                          <td>{new Date(cron.nextRunAt).toLocaleString()}</td>
                          <td>
                            <button 
                              className={`btn btn-sm ${cron.isActive ? 'btn-secondary' : ''}`}
                              onClick={() => handleToggleCron(cron._id)}
                            >
                              {cron.isActive ? 'Active' : 'Paused'}
                            </button>
                          </td>
                          <td>
                            <button 
                              className="btn btn-sm btn-logout" 
                              onClick={async () => {
                                if (confirm('Delete this cron job?')) {
                                  await fetch(`${API_BASE}/scheduled-jobs/${cron._id}`, { method: 'DELETE', headers: headers() });
                                  fetchCronJobs();
                                }
                              }}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                      {cronJobs.length === 0 && (
                        <tr>
                          <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                            No scheduled cron jobs created yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'queues' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '35px' }}>
                {/* Queues List */}
                <div className="section-card">
                  <div className="section-header">
                    <h3 className="section-title">Active Workload Queues</h3>
                    <button className="btn btn-primary" onClick={() => setModalType('createQueue')}>
                      + Create Queue
                    </button>
                  </div>

                  <div className="table-container">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Queue Name</th>
                          <th>Priority Weight</th>
                          <th>Concurrency Limit</th>
                          <th>Retry Policy</th>
                          <th>Status</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {queues.map((q) => (
                          <tr key={q._id}>
                            <td style={{ fontWeight: 600 }}>{q.name}</td>
                            <td>{q.priority}</td>
                            <td>{q.concurrencyLimit || 'Unlimited'}</td>
                            <td>
                              {typeof q.retryPolicyId === 'object' ? q.retryPolicyId.name : 'None'}
                            </td>
                            <td>
                              <span className={`badge ${q.isPaused ? 'badge-cancelled' : 'badge-completed'}`}>
                                {q.isPaused ? 'PAUSED' : 'ACTIVE'}
                              </span>
                            </td>
                            <td>
                              <button 
                                className="btn btn-sm"
                                onClick={() => handleToggleQueuePause(q._id, q.isPaused)}
                              >
                                {q.isPaused ? 'Resume' : 'Pause'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Policies List */}
                <div className="section-card">
                  <div className="section-header">
                    <h3 className="section-title">Fault Tolerance Policies</h3>
                    <button className="btn btn-primary" onClick={() => setModalType('createPolicy')}>
                      + Create Policy
                    </button>
                  </div>

                  <div className="table-container">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Policy Name</th>
                          <th>Algorithm Type</th>
                          <th>Base Delay</th>
                          <th>Max Delay</th>
                          <th>Max Attempts</th>
                        </tr>
                      </thead>
                      <tbody>
                        {policies.map((p) => (
                          <tr key={p._id}>
                            <td style={{ fontWeight: 600 }}>{p.name}</td>
                            <td style={{ textTransform: 'capitalize' }}>{p.type}</td>
                            <td>{p.baseDelayMs}ms</td>
                            <td>{p.maxDelayMs}ms</td>
                            <td>{p.maxAttempts} attempts</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'workers' && (
              <div className="section-card">
                <div className="section-header">
                  <h3 className="section-title">Registered Worker Clusters</h3>
                </div>

                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Node Name</th>
                        <th>Status</th>
                        <th>Concurrency Limit</th>
                        <th>Started At</th>
                        <th>Last Heartbeat</th>
                      </tr>
                    </thead>
                    <tbody>
                      {workers.map((worker) => (
                        <tr key={worker._id}>
                          <td style={{ fontWeight: 600 }}>{worker.name}</td>
                          <td>
                            <span className={`badge badge-${worker.status === 'active' ? 'completed' : 'cancelled'}`}>
                              {worker.status}
                            </span>
                          </td>
                          <td>{worker.concurrencyLimit} parallel processes</td>
                          <td>{new Date(worker.startedAt).toLocaleString()}</td>
                          <td>{new Date(worker.lastHeartbeatAt).toLocaleTimeString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '100px 0' }}>
            <h2>No projects found.</h2>
            <p style={{ color: 'var(--text-secondary)', marginTop: '10px' }}>
              Create a project using the API or add seed data to get started.
            </p>
          </div>
        )}
      </main>

      {/* ----------------- MODALS ----------------- */}

      {/* 1. Enqueue Job Modal */}
      {modalType === 'enqueue' && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3 className="modal-title">Enqueue Background Job</h3>
              <button className="btn btn-sm" onClick={() => setModalType(null)}>X</button>
            </div>
            <form onSubmit={handleEnqueueJob}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Target Queue</label>
                  <select
                    className="select-control"
                    value={newJobQueueId}
                    onChange={(e) => setNewJobQueueId(e.target.value)}
                  >
                    {queues.map(q => <option key={q._id} value={q._id}>{q.name}</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Idempotency Key (Optional)</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="order_12345"
                    value={newJobIdempotencyKey}
                    onChange={(e) => setNewJobIdempotencyKey(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Delay Execution (Seconds)</label>
                  <input
                    type="number"
                    className="form-input"
                    placeholder="0 (Immediate)"
                    value={newJobDelaySecs}
                    onChange={(e) => setNewJobDelaySecs(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Override Retry Policy (Optional)</label>
                  <select
                    className="select-control"
                    value={newJobPolicyId}
                    onChange={(e) => setNewJobPolicyId(e.target.value)}
                  >
                    <option value="">Use Queue Default</option>
                    {policies.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Payload Parameters (JSON)</label>
                  <textarea
                    className="form-input form-textarea"
                    rows={6}
                    value={newJobPayload}
                    onChange={(e) => setNewJobPayload(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn" onClick={() => setModalType(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Dispatch Job</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Create Cron Modal */}
      {modalType === 'createCron' && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3 className="modal-title">Create Scheduled Cron Job</h3>
              <button className="btn btn-sm" onClick={() => setModalType(null)}>X</button>
            </div>
            <form onSubmit={handleCreateCron}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Trigger Rule Name</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Daily Sync"
                    value={newCronName}
                    onChange={(e) => setNewCronName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Cron Expression</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="0 0 * * *"
                    value={newCronExpression}
                    onChange={(e) => setNewCronExpression(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Target Queue</label>
                  <select
                    className="select-control"
                    value={newCronQueueId}
                    onChange={(e) => setNewCronQueueId(e.target.value)}
                  >
                    {queues.map(q => <option key={q._id} value={q._id}>{q.name}</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Retry Policy (Optional)</label>
                  <select
                    className="select-control"
                    value={newCronPolicyId}
                    onChange={(e) => setNewCronPolicyId(e.target.value)}
                  >
                    <option value="">Use Queue Default</option>
                    {policies.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Task Payload (JSON)</label>
                  <textarea
                    className="form-input form-textarea"
                    rows={6}
                    value={newCronPayload}
                    onChange={(e) => setNewCronPayload(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn" onClick={() => setModalType(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Schedule Rule</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Create Queue Modal */}
      {modalType === 'createQueue' && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3 className="modal-title">Create Workload Queue</h3>
              <button className="btn btn-sm" onClick={() => setModalType(null)}>X</button>
            </div>
            <form onSubmit={handleCreateQueue}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Queue Name</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="email-notifications"
                    value={newQueueName}
                    onChange={(e) => setNewQueueName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Priority Weight (Higher runs first)</label>
                  <input
                    type="number"
                    className="form-input"
                    placeholder="1"
                    value={newQueuePriority}
                    onChange={(e) => setNewQueuePriority(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Concurrency Limit (Optional)</label>
                  <input
                    type="number"
                    className="form-input"
                    placeholder="Unlimited"
                    value={newQueueConcurrency}
                    onChange={(e) => setNewQueueConcurrency(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Default Retry Policy</label>
                  <select
                    className="select-control"
                    value={newQueuePolicyId}
                    onChange={(e) => setNewQueuePolicyId(e.target.value)}
                  >
                    <option value="">None (No Retries)</option>
                    {policies.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn" onClick={() => setModalType(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Queue</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Create Policy Modal */}
      {modalType === 'createPolicy' && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3 className="modal-title">Create Fault Tolerance Policy</h3>
              <button className="btn btn-sm" onClick={() => setModalType(null)}>X</button>
            </div>
            <form onSubmit={handleCreatePolicy}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Policy Name</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Exponential Backoff"
                    value={newPolicyName}
                    onChange={(e) => setNewPolicyName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Delay Growth Type</label>
                  <select
                    className="select-control"
                    value={newPolicyType}
                    onChange={(e) => setNewPolicyType(e.target.value)}
                  >
                    <option value="fixed">Fixed Delay</option>
                    <option value="linear">Linear Delay</option>
                    <option value="exponential">Exponential Backoff</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Base Delay (Milliseconds)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={newPolicyBaseDelay}
                    onChange={(e) => setNewPolicyBaseDelay(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Max Delay Limit (Milliseconds)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={newPolicyMaxDelay}
                    onChange={(e) => setNewPolicyMaxDelay(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Max Allowed Attempt Retries</label>
                  <input
                    type="number"
                    className="form-input"
                    value={newPolicyMaxAttempts}
                    onChange={(e) => setNewPolicyMaxAttempts(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn" onClick={() => setModalType(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Policy</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Job Details & Logs Inspector Modal */}
      {modalType === 'jobDetails' && selectedJobDetails && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '800px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Job Execution Inspector</h3>
              <button className="btn btn-sm" onClick={() => setModalType(null)}>X</button>
            </div>
            <div className="modal-body">
              <div className="detail-grid">
                <div className="detail-item">
                  <div className="detail-label">Job ID</div>
                  <div className="detail-value" style={{ fontFamily: 'monospace' }}>{selectedJobDetails.job._id}</div>
                </div>
                <div className="detail-item">
                  <div className="detail-label">Status</div>
                  <div className="detail-value">
                    <span className={`badge badge-${selectedJobDetails.job.status}`}>
                      {selectedJobDetails.job.status}
                    </span>
                  </div>
                </div>
                <div className="detail-item">
                  <div className="detail-label">Attempts Made</div>
                  <div className="detail-value">
                    {selectedJobDetails.job.attemptsMade} of {selectedJobDetails.job.maxAttempts} max
                  </div>
                </div>
                <div className="detail-item">
                  <div className="detail-label">Next Scheduled Run</div>
                  <div className="detail-value">{new Date(selectedJobDetails.job.scheduledAt).toLocaleString()}</div>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">JSON Parameters Payload</label>
                <pre className="payload-preview">{JSON.stringify(selectedJobDetails.job.payload, null, 2)}</pre>
              </div>

              {selectedJobDetails.job.lastError && (
                <div className="form-group">
                  <label className="form-label" style={{ color: 'var(--error)' }}>Last Failure Cause</label>
                  <div className="detail-item" style={{ borderLeft: '3px solid var(--error)', background: 'rgba(239, 68, 68, 0.05)' }}>
                    <div className="detail-value" style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                      {selectedJobDetails.job.lastError}
                    </div>
                  </div>
                </div>
              )}

              {/* Execution history with execution logs */}
              <div className="form-group">
                <label className="form-label">Attempt Executions History</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '5px' }}>
                  {selectedJobDetails.executions.map((exec) => (
                    <div 
                      key={exec._id} 
                      style={{ 
                        border: '1px solid var(--glass-border)', 
                        borderRadius: '8px', 
                        padding: '15px',
                        background: 'rgba(255,255,255,0.01)'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '0.85rem' }}>
                        <span>
                          <strong>Attempt #{exec.attempt}</strong> ({exec.durationMs ? `${exec.durationMs}ms` : 'running'})
                        </span>
                        <span className={`badge badge-${exec.status}`}>{exec.status}</span>
                      </div>

                      {exec.logs && exec.logs.length > 0 ? (
                        <div className="terminal-panel">
                          {exec.logs.map((log) => (
                            <div className="log-row" key={log._id}>
                              <span className="log-time">{new Date(log.timestamp).toLocaleTimeString()}</span>
                              <span className={`log-level ${log.level}`}>{log.level}</span>
                              <span className="log-text">{log.message}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No execution logs recorded.</p>
                      )}
                    </div>
                  ))}
                  {selectedJobDetails.executions.length === 0 && (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center' }}>
                      No execution logs created yet. The job is currently in the queue.
                    </p>
                  )}
                </div>
              </div>
            </div>
            
            <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
              <div>
                {(selectedJobDetails.job.status === 'failed' || 
                  selectedJobDetails.job.status === 'dead_letter' || 
                  selectedJobDetails.job.status === 'cancelled') && (
                  <button 
                    type="button" 
                    className="btn btn-secondary"
                    onClick={() => handleRetryJob(selectedJobDetails.job._id)}
                  >
                    Retry Job Now
                  </button>
                )}

                {['queued', 'scheduled', 'retrying'].includes(selectedJobDetails.job.status) && (
                  <button 
                    type="button" 
                    className="btn btn-danger"
                    onClick={() => handleCancelJob(selectedJobDetails.job._id)}
                  >
                    Cancel Job
                  </button>
                )}
              </div>
              
              <button type="button" className="btn" onClick={() => setModalType(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
