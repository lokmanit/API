import React, { useState, useEffect } from 'react';
import {
  Phone,
  PhoneCall,
  PhoneForwarded,
  PhoneOff,
  Activity,
  Shield,
  CheckCircle2,
  XCircle,
  Clock,
  Copy,
  Check,
  Terminal,
  FileText,
  RefreshCw,
  Key,
  Code2,
  Info,
  LogOut,
  User,
  ShieldCheck,
  Repeat,
  Sliders,
  Zap,
} from 'lucide-react';
import { LoginScreen } from './components/LoginScreen';
import { SipVaultCard } from './components/SipVaultCard';
import { PersistentRedialCard } from './components/PersistentRedialCard';
import { AdminApiTestCard } from './components/AdminApiTestCard';
import { SipDiagnosticsCard } from './components/SipDiagnosticsCard';
import { LocalSetupGuideCard } from './components/LocalSetupGuideCard';

interface CallRecord {
  id: string;
  call_id: string;
  destination: string;
  content: string;
  reason?: string;
  status: string;
  provider_call_id?: string;
  error?: string;
  created_at: string;
  updated_at: string;
}

interface ApiResponseState {
  status: number | null;
  durationMs: number | null;
  data: Record<string, unknown> | null;
  rawError?: string;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'console' | 'diagnostics' | 'admin-test' | 'history' | 'docs' | 'config'>('console');

  // GUI Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return Boolean(localStorage.getItem('voip_auth_token'));
  });
  const [currentUser, setCurrentUser] = useState<{ username: string; role: string } | null>(() => {
    const saved = localStorage.getItem('voip_user_session');
    return saved ? JSON.parse(saved) : { username: 'admin', role: 'SUPER_ADMIN' };
  });

  // Auth Token state
  const [authToken, setAuthToken] = useState(() => {
    return localStorage.getItem('voip_auth_token') || 'call_api_sec_token_9f8d7c6b5a4';
  });
  const [showToken, setShowToken] = useState(false);

  // Form states - Specific primary destination by default (+8801750010459)
  const [destination, setDestination] = useState(() => {
    return localStorage.getItem('last_call_destination') || '+8801750010459';
  });
  const [content, setContent] = useState('CRITICAL: Security alert detected in production environment');
  const [reason, setReason] = useState('URGENT');
  const [idempotencyKey, setIdempotencyKey] = useState('');

  // Persistent redial state (until answered)
  const [retryUntilAnswered, setRetryUntilAnswered] = useState(true);
  // Default interval: 0 seconds (Immediate retry)
  const [retryIntervalSeconds, setRetryIntervalSeconds] = useState(0);

  // Call status query state
  const [queryCallId, setQueryCallId] = useState('');

  // UI status
  const [loading, setLoading] = useState(false);
  const [healthStatus, setHealthStatus] = useState<{ status: string; service: string } | null>(null);
  const [lastResponse, setLastResponse] = useState<ApiResponseState | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  // Data lists
  const [callHistory, setCallHistory] = useState<CallRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [sanitizedConfig, setSanitizedConfig] = useState<Record<string, unknown> | null>(null);

  // Probe health on mount
  useEffect(() => {
    checkHealth();
    fetchHistory();
    fetchConfig();
  }, []);

  const checkHealth = async () => {
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      setHealthStatus(data);
    } catch {
      setHealthStatus(null);
    }
  };

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch('/api/calls', {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setCallHistory(data.calls || []);
      }
    } catch (err) {
      console.error('Failed to load call history', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/config', {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setSanitizedConfig(data.config);
      }
    } catch (err) {
      console.error('Failed to fetch config', err);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleLoginSuccess = (token: string, user: { username: string; role: string }) => {
    setAuthToken(token);
    localStorage.setItem('voip_auth_token', token);
    localStorage.setItem('voip_user_session', JSON.stringify(user));
    setCurrentUser(user);
    setIsAuthenticated(true);
    fetchHistory();
    fetchConfig();
    checkHealth();
  };

  const handleLogout = () => {
    localStorage.removeItem('voip_auth_token');
    localStorage.removeItem('voip_user_session');
    sessionStorage.clear();
    setIsAuthenticated(false);
    setCurrentUser(null);
  };

  // Submit POST /api/call
  const handleInitiateCall = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setLastResponse(null);

    const startTime = performance.now();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    };

    if (idempotencyKey.trim()) {
      headers['Idempotency-Key'] = idempotencyKey.trim();
    }

    try {
      const res = await fetch('/api/call', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          destination,
          content,
          reason: reason || undefined,
          retryUntilAnswered,
          retryIntervalSeconds,
        }),
      });

      const durationMs = Math.round(performance.now() - startTime);
      const data = await res.json();

      setLastResponse({
        status: res.status,
        durationMs,
        data,
      });

      if (data.call_id) {
        setQueryCallId(data.call_id);
      }

      fetchHistory();
    } catch (err) {
      setLastResponse({
        status: 500,
        durationMs: Math.round(performance.now() - startTime),
        data: null,
        rawError: err instanceof Error ? err.message : 'Network failure',
      });
    } finally {
      setLoading(false);
    }
  };

  // Submit POST /api/test-call
  const handleTestCall = async () => {
    setLoading(true);
    setLastResponse(null);

    const startTime = performance.now();
    try {
      const res = await fetch('/api/test-call', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          destination,
        }),
      });

      const durationMs = Math.round(performance.now() - startTime);
      const data = await res.json();

      setLastResponse({
        status: res.status,
        durationMs,
        data,
      });

      if (data.call_id) {
        setQueryCallId(data.call_id);
      }

      fetchHistory();
    } catch (err) {
      setLastResponse({
        status: 500,
        durationMs: Math.round(performance.now() - startTime),
        data: null,
        rawError: err instanceof Error ? err.message : 'Network failure',
      });
    } finally {
      setLoading(false);
    }
  };

  // Query GET /api/call/:call_id
  const handleQueryStatus = async (targetCallId?: string) => {
    const idToQuery = targetCallId || queryCallId;
    if (!idToQuery.trim()) return;

    setLoading(true);
    const startTime = performance.now();
    try {
      const res = await fetch(`/api/call/${encodeURIComponent(idToQuery.trim())}`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      const durationMs = Math.round(performance.now() - startTime);
      const data = await res.json();

      setLastResponse({
        status: res.status,
        durationMs,
        data,
      });

      fetchHistory();
    } catch (err) {
      setLastResponse({
        status: 500,
        durationMs: Math.round(performance.now() - startTime),
        data: null,
        rawError: err instanceof Error ? err.message : 'Network query error',
      });
    } finally {
      setLoading(false);
    }
  };

  // Open-ended content presets
  const presets = [
    { label: 'KEYWORD: URGENT', text: 'URGENT', reason: 'ALERT' },
    { label: 'CLIENT NOTICE', text: 'New client notification received regarding contract approval', reason: 'CLIENT' },
    { label: 'SEC INCIDENT URL', text: 'https://incident.company.internal/sec-ops/alert-892', reason: 'INCIDENT' },
    { label: 'DOMAIN ALERT', text: 'auth.api.production.services', reason: 'MONITORING' },
    {
      label: 'DB FAILOVER',
      text: 'CRITICAL: Database primary node failover detected in us-east region. Immediate administrative action required.',
      reason: 'CRITICAL',
    },
  ];

  // Simulation presets for destination with primary specific recipient
  const destPresets = [
    { label: 'Primary Target', dest: '+8801750010459', desc: 'Primary recipient handset (+8801750010459)' },
    { label: 'Test Target 1', dest: '+8801712345678', desc: 'Secondary outbound call test' },
    { label: 'Test Target 2', dest: '+8801811223344', desc: 'Secondary operator test line' },
    { label: 'Busy Signal (BUSY)', dest: '+8801700004444', desc: 'Simulates busy 486 signal (auto-retry test)' },
    { label: 'Ringing (No-Answer)', dest: '+8801700007777', desc: 'Phone rings without answer (persistent redial loop test)' },
  ];

  // Render status badge
  const renderStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'initiated':
      case 'initiating':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-blue-500/20 text-blue-400 border border-blue-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"></span>
            {status}
          </span>
        );
      case 'ringing':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping"></span>
            RINGING
          </span>
        );
      case 'answered':
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            {status.toUpperCase()}
          </span>
        );
      case 'busy':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
            <PhoneOff className="w-3 h-3 text-yellow-400" />
            BUSY (486)
          </span>
        );
      case 'failed':
      case 'rejected':
      case 'timeout':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-rose-500/20 text-rose-400 border border-rose-500/30">
            <XCircle className="w-3 h-3 text-rose-400" />
            {status.toUpperCase()}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-white/10 text-white/60 border border-white/10">
            {status ? status.toUpperCase() : 'UNKNOWN'}
          </span>
        );
    }
  };

  const curlExample = `curl -X POST "${window.location.origin}/api/call" \\
  -H "Authorization: Bearer ${authToken}" \\
  -H "Content-Type: application/json"${idempotencyKey ? ` \\\n  -H "Idempotency-Key: ${idempotencyKey}"` : ''} \\
  -d '${JSON.stringify(
    {
      destination,
      content,
      reason: reason || undefined,
    },
    null,
    2
  )}'`;

  if (!isAuthenticated) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans flex flex-col selection:bg-blue-500 selection:text-white">
      {/* Top Header */}
      <header className="h-20 border-b border-white/10 flex items-center justify-between px-4 sm:px-8 bg-[#0a0a0a] sticky top-0 z-20">
        <div className="flex items-baseline gap-4">
          <h1 className="text-2xl sm:text-4xl font-black tracking-tighter uppercase text-white flex items-center gap-3">
            <PhoneCall className="w-6 h-6 sm:w-8 sm:h-8 text-blue-400 inline-block" />
            SmartDial Voice
          </h1>
          <span className="hidden sm:inline-block text-xs font-mono text-white/40 tracking-widest uppercase">
            Intelligent Auto-Calling System
          </span>
        </div>

        <div className="flex items-center gap-3 sm:gap-4">
          <button
            type="button"
            onClick={checkHealth}
            className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-sm hover:bg-white/10 transition-colors cursor-pointer"
            title="Click to probe GET /api/health"
          >
            <div
              className={`w-2 h-2 rounded-full ${
                healthStatus?.status === 'ok'
                  ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]'
                  : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]'
              }`}
            />
            <span
              className={`text-[10px] font-bold uppercase tracking-widest ${
                healthStatus?.status === 'ok' ? 'text-emerald-500' : 'text-rose-500'
              }`}
            >
              {healthStatus?.status === 'ok' ? 'API_HEALTH_OK' : 'API_OFFLINE'}
            </span>
            <Activity className="w-3 h-3 text-white/30" />
          </button>

          <div className="hidden lg:flex items-center gap-2">
            <div className="px-2.5 py-1 bg-white/5 border border-white/10 rounded-sm text-[10px] font-mono text-emerald-400">
              TRUNK: 202.40.176.2
            </div>
            <div className="px-2.5 py-1 bg-white/5 border border-white/10 rounded-sm text-[10px] font-mono text-white/80">
              CALLER_ID: 09617552229
            </div>
            <div
              className="px-2.5 py-1 bg-blue-500/10 border border-blue-500/30 rounded-sm text-[10px] font-mono text-blue-300 font-bold flex items-center gap-1.5"
              title="Current outbound call target recipient"
            >
              <Phone className="w-3 h-3 text-blue-400" />
              TARGET: {destination || '+8801750010459'}
            </div>
          </div>

          {/* User Session & Logout */}
          <div className="flex items-center gap-2 pl-2 border-l border-white/10">
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-white/5 border border-white/10 rounded-sm text-[11px] font-mono text-white/80">
              <User className="w-3 h-3 text-emerald-400" />
              <span>{currentUser?.username || 'admin'}</span>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-sm text-[10px] font-mono uppercase tracking-wider transition-colors cursor-pointer"
              title="Logout session"
            >
              <LogOut className="w-3 h-3" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Navigation Sub-Bar */}
      <nav className="border-b border-white/10 bg-[#080808] px-4 sm:px-8 flex space-x-2 sm:space-x-4 overflow-x-auto">
        <button
          onClick={() => setActiveTab('console')}
          className={`py-3 px-3 text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all border-b-2 whitespace-nowrap ${
            activeTab === 'console'
              ? 'border-white text-white bg-white/5'
              : 'border-transparent text-white/40 hover:text-white/80 hover:bg-white/5'
          }`}
        >
          <Terminal className="w-4 h-4 text-blue-400" />
          Call Console
        </button>

        <button
          onClick={() => setActiveTab('admin-test')}
          className={`py-3 px-3 text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all border-b-2 whitespace-nowrap ${
            activeTab === 'admin-test'
              ? 'border-white text-white bg-white/5'
              : 'border-transparent text-white/40 hover:text-white/80 hover:bg-white/5'
          }`}
        >
          <ShieldCheck className="w-4 h-4 text-blue-400" />
          API &amp; Call Tester
          <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
            TEST
          </span>
        </button>

        <button
          onClick={() => setActiveTab('diagnostics')}
          className={`py-3 px-3 text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all border-b-2 whitespace-nowrap ${
            activeTab === 'diagnostics'
              ? 'border-white text-white bg-white/5'
              : 'border-transparent text-white/40 hover:text-white/80 hover:bg-white/5'
          }`}
        >
          <Activity className="w-4 h-4 text-amber-400" />
          Carrier Firewall Probe
          <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
            DIAGNOSTIC
          </span>
        </button>

        <button
          onClick={() => {
            setActiveTab('history');
            fetchHistory();
          }}
          className={`py-3 px-3 text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all border-b-2 whitespace-nowrap ${
            activeTab === 'history'
              ? 'border-white text-white bg-white/5'
              : 'border-transparent text-white/40 hover:text-white/80 hover:bg-white/5'
          }`}
        >
          <Clock className="w-4 h-4 text-emerald-400" />
          Call Logs ({callHistory.length})
        </button>

        <button
          onClick={() => setActiveTab('docs')}
          className={`py-3 px-3 text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all border-b-2 whitespace-nowrap ${
            activeTab === 'docs'
              ? 'border-white text-white bg-white/5'
              : 'border-transparent text-white/40 hover:text-white/80 hover:bg-white/5'
          }`}
        >
          <FileText className="w-4 h-4 text-amber-400" />
          API Documentation
        </button>

        <button
          onClick={() => {
            setActiveTab('config');
            fetchConfig();
          }}
          className={`py-3 px-3 text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all border-b-2 whitespace-nowrap ${
            activeTab === 'config'
              ? 'border-white text-white bg-white/5'
              : 'border-transparent text-white/40 hover:text-white/80 hover:bg-white/5'
          }`}
        >
          <Shield className="w-4 h-4 text-violet-400" />
          SIP Telephony Config
        </button>
      </nav>

      {/* Main Container */}
      <main className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-8">
        {/* TAB 1: INTERACTIVE CALL CONSOLE */}
        {activeTab === 'console' && (
          <div className="space-y-8">
            {/* Title Section */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-400">
                  ENDPOINT DISPATCH // POST /api/call
                </span>
              </div>
              <h2 className="text-4xl sm:text-6xl font-black tracking-tighter uppercase mb-2">
                Initiate Call
              </h2>
              <p className="text-white/40 text-base sm:text-lg max-w-2xl">
                Secure, idempotent endpoint for triggering outbound SIP/VoIP communication through your provider.
              </p>
            </div>

            {/* SIP Trunk & Password Hash Vault */}
            <SipVaultCard
              authToken={authToken}
              destination={destination}
              onSetDestination={setDestination}
              onPasswordVaulted={fetchConfig}
            />

            {/* Carrier Firewall & SIP Diagnostic Probe */}
            <SipDiagnosticsCard authToken={authToken} />

            {/* Admin API & Call Verification Suite */}
            <AdminApiTestCard
              authToken={authToken}
              destination={destination}
              onSetDestination={setDestination}
              onCallSuccess={() => {
                fetchHistory();
              }}
            />

            {/* Persistent Redial / Retry Until Answered Card */}
            <PersistentRedialCard
              authToken={authToken}
              destination={destination}
              onSetDestination={setDestination}
              retryUntilAnswered={retryUntilAnswered}
              onToggleRetry={setRetryUntilAnswered}
              retryIntervalSeconds={retryIntervalSeconds}
              onChangeInterval={setRetryIntervalSeconds}
              onCallSuccess={() => {
                fetchHistory();
              }}
            />

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Left Column: Form & Auth */}
              <div className="lg:col-span-7 space-y-6">
                {/* Auth Token Card */}
                <div className="p-5 border border-white/10 rounded-lg bg-[#0c0c0c] space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 flex items-center gap-2">
                      <Key className="w-3.5 h-3.5 text-amber-400" />
                      Authorization Bearer Token
                    </h3>
                    <span className="text-[10px] font-mono text-white/30 uppercase tracking-widest">
                      Header: Authorization
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type={showToken ? 'text' : 'password'}
                      value={authToken}
                      onChange={(e) => setAuthToken(e.target.value)}
                      placeholder="Enter API_AUTH_TOKEN..."
                      className="flex-1 bg-white/5 border border-white/10 p-2.5 text-xs font-mono text-white rounded-sm focus:outline-none focus:border-blue-500 placeholder:text-white/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowToken(!showToken)}
                      className="bg-white/10 hover:bg-white/20 text-white font-bold uppercase text-[10px] tracking-wider px-3 py-2.5 rounded-sm transition-colors border border-white/10"
                    >
                      {showToken ? 'HIDE' : 'SHOW'}
                    </button>
                  </div>
                  <p className="text-[10px] font-mono text-white/40">
                    Required for all dispatch requests. Validated against server environment secret.
                  </p>
                </div>

                {/* Call Dispatch Form */}
                <form
                  onSubmit={handleInitiateCall}
                  className="p-6 border border-white/10 rounded-lg bg-[#080808] space-y-6"
                >
                  <div className="flex items-center justify-between border-b border-white/10 pb-4">
                    <div>
                      <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-blue-400 flex items-center gap-2">
                        <Phone className="w-4 h-4 text-emerald-400" />
                        Call Initiation Request Body
                      </h3>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <span className="text-[11px] text-white/50 font-mono">
                          POST /api/call
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          CALLER_ID: 09617552229
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                          TRUNK: 202.40.176.2:5060
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleTestCall}
                      disabled={loading}
                      className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white font-bold uppercase text-[10px] tracking-wider rounded-sm border border-white/10 transition-colors flex items-center gap-1.5"
                      title="Sends automated quick test call"
                    >
                      <Activity className="w-3.5 h-3.5 text-blue-400" />
                      Quick Test Call
                    </button>
                  </div>

                  {/* Destination Field */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] uppercase font-bold tracking-wider text-white/60 flex items-center gap-2">
                        Destination Number (Recipient) <span className="text-rose-400">*</span>
                        <span className="text-[9px] font-mono text-blue-300 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">
                          Customizable
                        </span>
                      </label>
                      <span className="text-[10px] font-mono text-white/30">E.164 Standard Format</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={destination}
                        onChange={(e) => {
                          setDestination(e.target.value);
                          localStorage.setItem('last_call_destination', e.target.value);
                        }}
                        placeholder="+8801XXXXXXXXX or +12025550123"
                        required
                        className="flex-1 bg-white/5 border border-white/10 p-3 text-sm font-mono text-white rounded-sm focus:outline-none focus:border-blue-500 placeholder:text-white/20"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setDestination('+8801750010459');
                          localStorage.setItem('last_call_destination', '+8801750010459');
                        }}
                        className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border border-blue-500/30 px-3.5 py-3 rounded text-xs font-mono font-bold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                        title="Set to primary target number (+8801750010459)"
                      >
                        <Phone className="w-4 h-4 text-blue-400" />
                        <span>+8801750010459</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDestination('');
                          localStorage.removeItem('last_call_destination');
                        }}
                        className="bg-white/5 hover:bg-white/10 text-white/50 hover:text-white border border-white/10 px-3 py-3 rounded text-xs font-mono transition-colors cursor-pointer shrink-0"
                        title="Clear number field"
                      >
                        Clear
                      </button>
                    </div>

                    {/* Simulation presets */}
                    <div className="pt-2">
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 block mb-2">
                        Quick Destination / Test Scenarios:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {destPresets.map((p, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              setDestination(p.dest);
                              localStorage.setItem('last_call_destination', p.dest);
                            }}
                            className={`text-[10px] font-mono uppercase px-2.5 py-1 rounded-sm border transition-colors cursor-pointer ${
                              destination === p.dest
                                ? 'bg-white text-black font-black border-white'
                                : 'bg-white/5 hover:bg-white/10 text-white/70 border-white/10'
                            }`}
                            title={p.desc}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Content Field */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] uppercase font-bold tracking-wider text-white/60 flex items-center gap-2">
                        Open-Ended Content <span className="text-rose-400">*</span>
                        <span className="text-[9px] font-mono bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded">
                          ANY ARBITRARY STRING
                        </span>
                      </label>
                      <span className="text-[10px] font-mono text-white/30">{content.length} bytes</span>
                    </div>

                    <textarea
                      rows={4}
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      placeholder="Enter arbitrary string, URL, keyword, notification, domain, or message..."
                      required
                      className="w-full bg-white/5 border border-white/10 p-3 text-sm font-mono text-white rounded-sm focus:outline-none focus:border-blue-500 placeholder:text-white/20 resize-none leading-relaxed"
                    />

                    {/* Content presets */}
                    <div className="pt-2">
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 block mb-2">
                        Arbitrary Content Presets:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {presets.map((p, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              setContent(p.text);
                              setReason(p.reason);
                            }}
                            className="text-[10px] font-mono uppercase px-2.5 py-1 rounded-sm bg-white/5 hover:bg-white/10 text-white/70 border border-white/10 transition-colors"
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Reason and Idempotency */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold tracking-wider text-white/40">
                        Reason (Optional String)
                      </label>
                      <input
                        type="text"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="e.g. URGENT, NOTIFICATION"
                        className="w-full bg-white/5 border border-white/10 p-2.5 text-xs font-mono text-white rounded-sm focus:outline-none focus:border-blue-500 placeholder:text-white/20"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold tracking-wider text-white/40">
                        Idempotency-Key Header
                      </label>
                      <input
                        type="text"
                        value={idempotencyKey}
                        onChange={(e) => setIdempotencyKey(e.target.value)}
                        placeholder="e.g. req_uuid_4921"
                        className="w-full bg-white/5 border border-white/10 p-2.5 text-xs font-mono text-white rounded-sm focus:outline-none focus:border-blue-500 placeholder:text-white/20"
                      />
                    </div>
                  </div>

                  {/* Submit button & Persistent Redial indicator */}
                  <div className="pt-3 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-white/10">
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-2 cursor-pointer select-none text-[11px] font-mono text-white/80">
                        <input
                          type="checkbox"
                          checked={retryUntilAnswered}
                          onChange={(e) => setRetryUntilAnswered(e.target.checked)}
                          className="w-3.5 h-3.5 accent-blue-500 rounded cursor-pointer"
                        />
                        <span className={retryUntilAnswered ? 'text-blue-400 font-bold' : 'text-white/40'}>
                          {retryUntilAnswered
                            ? retryIntervalSeconds === 0
                              ? 'Persistent Redial: Immediate retry upon disconnect (0s default)'
                              : `Persistent Redial: Retry every ${retryIntervalSeconds >= 60 ? `${Math.floor(retryIntervalSeconds / 60)} min` : `${retryIntervalSeconds}s`}`
                            : 'Single Call (Auto-retry disabled)'}
                        </span>
                      </label>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full sm:w-auto bg-white text-black font-black uppercase text-xs tracking-wider py-3.5 px-8 hover:bg-blue-400 transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 rounded-sm shadow-md"
                    >
                      {loading ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin text-black" />
                          DISPATCHING CALL...
                        </>
                      ) : (
                        <>
                          <PhoneForwarded className="w-4 h-4 text-black" />
                          {retryUntilAnswered ? 'START PERSISTENT REDIAL LOOP' : 'SEND CALL (POST /api/call)'}
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>

              {/* Right Column: Status Query & Response Viewer & Curl */}
              <div className="lg:col-span-5 space-y-6">
                {/* Query Call ID Widget */}
                <div className="p-5 border border-white/10 rounded-lg bg-[#0a0a0a] space-y-3">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 flex items-center gap-2">
                    <Activity className="w-3.5 h-3.5 text-blue-400" />
                    Query Status (GET /api/call/:call_id)
                  </h3>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={queryCallId}
                      onChange={(e) => setQueryCallId(e.target.value)}
                      placeholder="Enter call_id..."
                      className="flex-1 bg-white/5 border border-white/10 p-2 text-xs font-mono text-white rounded-sm focus:outline-none focus:border-blue-500 placeholder:text-white/20"
                    />
                    <button
                      type="button"
                      onClick={() => handleQueryStatus()}
                      disabled={loading || !queryCallId.trim()}
                      className="bg-white/10 hover:bg-white/20 text-white font-black uppercase text-[10px] tracking-wider px-4 py-2 rounded-sm transition-colors border border-white/10 disabled:opacity-40 cursor-pointer"
                    >
                      POLL
                    </button>
                  </div>
                </div>

                {/* API Response Display Card */}
                <div className="p-5 border border-white/10 rounded-lg bg-[#0c0c0c] space-y-4">
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400 flex items-center gap-2">
                      <Code2 className="w-3.5 h-3.5 text-blue-400" />
                      API Response Inspector
                    </span>

                    {lastResponse && (
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                            lastResponse.status && lastResponse.status >= 200 && lastResponse.status < 300
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          }`}
                        >
                          HTTP {lastResponse.status}
                        </span>
                        <span className="text-[10px] font-mono text-white/40">
                          {lastResponse.durationMs}ms
                        </span>
                      </div>
                    )}
                  </div>

                  {lastResponse ? (
                    <div className="space-y-3">
                      {/* Call ID display pill */}
                      {lastResponse.data && (lastResponse.data as Record<string, unknown>).call_id && (
                        <div className="p-3 bg-white/5 border border-white/10 rounded-sm flex items-center justify-between">
                          <div>
                            <span className="text-[9px] font-mono uppercase font-bold text-white/40 block">
                              CALL_ID
                            </span>
                            <span className="text-xs font-mono font-bold text-white">
                              {String((lastResponse.data as Record<string, unknown>).call_id)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {renderStatusBadge(
                              String((lastResponse.data as Record<string, unknown>).status || 'unknown')
                            )}
                            <button
                              type="button"
                              onClick={() =>
                                copyToClipboard(
                                  String((lastResponse.data as Record<string, unknown>).call_id),
                                  'res_call_id'
                                )
                              }
                              className="p-1 text-white/40 hover:text-white rounded"
                              title="Copy Call ID"
                            >
                              {copied === 'res_call_id' ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Raw JSON Code Block */}
                      <div className="relative">
                        <pre className="p-4 bg-[#050505] text-emerald-400 font-mono text-[11px] rounded border border-white/10 overflow-x-auto max-h-72 leading-relaxed">
                          {JSON.stringify(lastResponse.data || { error: lastResponse.rawError }, null, 2)}
                        </pre>
                        <button
                          type="button"
                          onClick={() =>
                            copyToClipboard(
                              JSON.stringify(lastResponse.data || { error: lastResponse.rawError }, null, 2),
                              'raw_json'
                            )
                          }
                          className="absolute top-2 right-2 px-2 py-1 bg-white/10 hover:bg-white/20 text-white font-mono text-[10px] rounded border border-white/10 flex items-center gap-1"
                        >
                          {copied === 'raw_json' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          COPY
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="py-12 text-center text-white/30 text-xs font-mono">
                      <Terminal className="w-8 h-8 text-white/20 mx-auto mb-2" />
                      NO DISPATCH EXECUTED YET
                      <br />
                      PRESS "SEND CALL" OR "QUICK TEST CALL"
                    </div>
                  )}
                </div>

                {/* Generated cURL Command */}
                <div className="p-5 border border-white/10 rounded-lg bg-[#111] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400 flex items-center gap-2">
                      <Terminal className="w-3.5 h-3.5 text-blue-400" />
                      Generated cURL Command
                    </span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(curlExample, 'curl')}
                      className="text-[10px] font-mono uppercase text-white/60 hover:text-white flex items-center gap-1"
                    >
                      {copied === 'curl' ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          COPIED
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          COPY CURL
                        </>
                      )}
                    </button>
                  </div>

                  <pre className="p-4 bg-[#050505] text-emerald-400 font-mono text-[11px] rounded border border-white/10 overflow-x-auto leading-relaxed">
                    {curlExample}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB: CARRIER FIREWALL & SIP DIAGNOSTICS */}
        {activeTab === 'diagnostics' && (
          <div className="space-y-6">
            <div className="border-b border-white/10 pb-4">
              <h2 className="text-3xl sm:text-5xl font-black tracking-tighter uppercase mb-1 text-white">
                Carrier Firewall &amp; Network Probe
              </h2>
              <p className="text-xs font-mono text-white/40 uppercase tracking-wider">
                Real-time diagnostic analysis for RanksTel SIP server connectivity, UDP/TCP port 5060 reachability, and egress IP whitelisting.
              </p>
            </div>

            <SipDiagnosticsCard authToken={authToken} />
          </div>
        )}

        {/* TAB: ADMIN API & CALL TESTER */}
        {activeTab === 'admin-test' && (
          <div className="space-y-6">
            <div className="border-b border-white/10 pb-4">
              <h2 className="text-3xl sm:text-5xl font-black tracking-tighter uppercase mb-1 text-white">
                Admin API &amp; Call Verification
              </h2>
              <p className="text-xs font-mono text-white/40 uppercase tracking-wider">
                Comprehensive diagnostic suite to test API routes, authentication, SIP trunk connectivity, and verify call delivery.
              </p>
            </div>

            <AdminApiTestCard
              authToken={authToken}
              destination={destination}
              onSetDestination={setDestination}
              onCallSuccess={() => {
                fetchHistory();
              }}
            />
          </div>
        )}

        {/* TAB 2: CALL RECORDS REPOSITORY */}
        {activeTab === 'history' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
              <div>
                <h2 className="text-4xl sm:text-5xl font-black tracking-tighter uppercase mb-1">
                  Call Repository
                </h2>
                <p className="text-xs font-mono text-white/40 uppercase tracking-wider">
                  Persistent log tracking of all dispatched outbound calls and status transitions
                </p>
              </div>

              <button
                type="button"
                onClick={fetchHistory}
                disabled={historyLoading}
                className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white font-black uppercase text-xs tracking-wider rounded-sm border border-white/10 transition-colors flex items-center gap-2 cursor-pointer w-fit"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${historyLoading ? 'animate-spin' : ''}`} />
                REFRESH LOGS
              </button>
            </div>

            {callHistory.length === 0 ? (
              <div className="py-20 text-center text-white/30 text-xs font-mono border border-white/10 rounded-lg bg-[#0a0a0a]">
                <Phone className="w-10 h-10 text-white/20 mx-auto mb-3" />
                NO CALLS RECORDED IN REPOSITORY
              </div>
            ) : (
              <div className="border border-white/10 rounded-lg bg-[#0a0a0a] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-white/10 bg-[#0c0c0c]">
                        <th className="py-3 px-4 text-xs font-mono text-white/40 uppercase">CALL_ID</th>
                        <th className="py-3 px-4 text-xs font-mono text-white/40 uppercase">DESTINATION</th>
                        <th className="py-3 px-4 text-xs font-mono text-white/40 uppercase">CONTENT</th>
                        <th className="py-3 px-4 text-xs font-mono text-white/40 uppercase">REASON</th>
                        <th className="py-3 px-4 text-xs font-mono text-white/40 uppercase">STATUS</th>
                        <th className="py-3 px-4 text-xs font-mono text-white/40 uppercase">PROVIDER_ID</th>
                        <th className="py-3 px-4 text-xs font-mono text-white/40 uppercase">TIMESTAMP</th>
                        <th className="py-3 px-4 text-xs font-mono text-white/40 uppercase text-right">ACTION</th>
                      </tr>
                    </thead>
                    <tbody>
                      {callHistory.map((call) => (
                        <tr key={call.id} className="border-b border-white/5 hover:bg-white/5 transition-colors font-mono text-xs">
                          <td className="py-3.5 px-4 font-bold text-white">
                            <div className="flex items-center gap-2">
                              <span className="truncate max-w-[140px]">{call.call_id}</span>
                              <button
                                onClick={() => copyToClipboard(call.call_id, call.id)}
                                className="text-white/40 hover:text-white"
                                title="Copy Call ID"
                              >
                                {copied === call.id ? (
                                  <Check className="w-3 h-3 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-white/90">{call.destination}</td>
                          <td className="py-3.5 px-4 text-white/60 max-w-xs truncate" title={call.content}>
                            {call.content}
                          </td>
                          <td className="py-3.5 px-4 text-white/40">{call.reason || '—'}</td>
                          <td className="py-3.5 px-4">{renderStatusBadge(call.status)}</td>
                          <td className="py-3.5 px-4 text-white/40 text-[11px] truncate max-w-[100px]">
                            {call.provider_call_id || '—'}
                          </td>
                          <td className="py-3.5 px-4 text-white/40 text-[11px]">
                            {new Date(call.created_at).toLocaleTimeString()}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <button
                              onClick={() => {
                                setActiveTab('console');
                                setQueryCallId(call.call_id);
                                handleQueryStatus(call.call_id);
                              }}
                              className="text-xs font-bold uppercase tracking-wider text-blue-400 hover:text-blue-300"
                            >
                              POLL
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: COMPLETE API DOCUMENTATION */}
        {activeTab === 'docs' && (
          <div className="space-y-8">
            {/* Local Machine & Mumbai Agent Integration Guide */}
            <LocalSetupGuideCard />

            <div>
              <h2 className="text-4xl sm:text-6xl font-black tracking-tighter uppercase mb-2">
                API Reference
              </h2>
              <p className="text-white/40 text-base max-w-2xl leading-relaxed">
                Standardized REST specifications for initiating outbound telephony calls through automation workflows (n8n, incident webhooks, alerts).
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs font-mono">
                <span className="px-3 py-1 bg-white/5 border border-white/10 rounded text-white/80">
                  BASE: {window.location.origin}/api
                </span>
                <span className="px-3 py-1 bg-white/5 border border-white/10 rounded text-emerald-400">
                  AUTH: Bearer [API_AUTH_TOKEN]
                </span>
              </div>
            </div>

            <div className="space-y-6">
              {/* POST /api/call */}
              <div className="border border-white/10 rounded-lg bg-[#0a0a0a] overflow-hidden">
                <div className="p-4 bg-[#080808] border-b border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded border border-blue-500/30">
                      POST
                    </span>
                    <span className="font-mono text-sm font-bold text-white">/api/call</span>
                  </div>
                  <span className="text-[10px] font-mono text-white/40 uppercase">BEARER AUTH REQUIRED</span>
                </div>

                <div className="p-6 space-y-6">
                  <p className="text-xs sm:text-sm text-white/70 leading-relaxed">
                    Initiates an outbound phone call. The <code className="text-emerald-400 font-mono">content</code> parameter is completely unrestricted and accepts any arbitrary string.
                  </p>

                  <div className="border border-white/10 rounded overflow-hidden">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-white/10 bg-[#0c0c0c]">
                          <th className="py-2.5 px-4 text-xs font-mono text-white/40">KEY</th>
                          <th className="py-2.5 px-4 text-xs font-mono text-white/40">TYPE</th>
                          <th className="py-2.5 px-4 text-xs font-mono text-white/40">REQUIRED</th>
                          <th className="py-2.5 px-4 text-xs font-mono text-white/40">DESCRIPTION</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 text-xs font-mono">
                        <tr>
                          <td className="py-3 px-4 font-bold text-white">destination</td>
                          <td className="py-3 px-4 text-white/40 italic">string (E.164)</td>
                          <td className="py-3 px-4 text-emerald-400 font-bold uppercase">TRUE</td>
                          <td className="py-3 px-4 text-white/70">Target phone number (e.g. +8801750010459)</td>
                        </tr>
                        <tr>
                          <td className="py-3 px-4 font-bold text-white">content</td>
                          <td className="py-3 px-4 text-white/40 italic">string (open)</td>
                          <td className="py-3 px-4 text-emerald-400 font-bold uppercase">TRUE</td>
                          <td className="py-3 px-4 text-white/70">Arbitrary message, alert, URL, or keyword</td>
                        </tr>
                        <tr>
                          <td className="py-3 px-4 font-bold text-white">reason</td>
                          <td className="py-3 px-4 text-white/40 italic">string</td>
                          <td className="py-3 px-4 text-white/30 uppercase">FALSE</td>
                          <td className="py-3 px-4 text-white/70">Optional categorization tag (e.g. URGENT)</td>
                        </tr>
                        <tr>
                          <td className="py-3 px-4 font-bold text-white">retryUntilAnswered</td>
                          <td className="py-3 px-4 text-white/40 italic">boolean</td>
                          <td className="py-3 px-4 text-blue-400 font-bold uppercase">OPTIONAL (DEFAULT TRUE)</td>
                          <td className="py-3 px-4 text-white/70">Persistent redial: continuously redials target until recipient answers the phone</td>
                        </tr>
                        <tr>
                          <td className="py-3 px-4 font-bold text-white">retryIntervalSeconds</td>
                          <td className="py-3 px-4 text-white/40 italic">number (2-300)</td>
                          <td className="py-3 px-4 text-white/30 uppercase">FALSE</td>
                          <td className="py-3 px-4 text-white/70">Seconds delay between retry attempts (Default: 8s)</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400 mb-2">
                        Request Body Example (With Persistent Redial)
                      </h4>
                      <pre className="p-4 bg-[#050505] text-emerald-400 font-mono text-xs rounded border border-white/10 leading-relaxed">
{`{
  "destination": "+8801750010459",
  "content": "Alert: Database failover triggered",
  "reason": "URGENT",
  "retryUntilAnswered": true,
  "retryIntervalSeconds": 8
}`}
                      </pre>
                    </div>

                    <div>
                      <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400 mb-2">
                        Response (HTTP 200)
                      </h4>
                      <pre className="p-4 bg-[#050505] text-emerald-400 font-mono text-xs rounded border border-white/10 leading-relaxed">
{`{
  "success": true,
  "call_id": "call_1788788000000_abc12345",
  "status": "initiated",
  "message": "Call initiated successfully"
}`}
                      </pre>
                    </div>
                  </div>
                </div>
              </div>

              {/* POST /api/test-call */}
              <div className="border border-white/10 rounded-lg bg-[#0a0a0a] overflow-hidden">
                <div className="p-4 bg-[#080808] border-b border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded border border-blue-500/30">
                      POST
                    </span>
                    <span className="font-mono text-sm font-bold text-white">/api/test-call</span>
                  </div>
                  <span className="text-[10px] font-mono text-white/40 uppercase">BEARER AUTH REQUIRED</span>
                </div>
                <div className="p-6 space-y-4 text-xs font-mono">
                  <p className="text-white/70">Dispatches an automated test payload to the destination number.</p>
                  <pre className="p-4 bg-[#050505] text-emerald-400 rounded border border-white/10 max-w-md">
{`{
  "destination": "+8801750010459"
}`}
                  </pre>
                </div>
              </div>

              {/* GET /api/call/:call_id */}
              <div className="border border-white/10 rounded-lg bg-[#0a0a0a] overflow-hidden">
                <div className="p-4 bg-[#080808] border-b border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-white/10 text-white/60 rounded border border-white/10">
                      GET
                    </span>
                    <span className="font-mono text-sm font-bold text-white">/api/call/:call_id</span>
                  </div>
                  <span className="text-[10px] font-mono text-white/40 uppercase">BEARER AUTH REQUIRED</span>
                </div>
                <div className="p-6 space-y-4 text-xs font-mono">
                  <p className="text-white/70">Queries current status and details of a previously created call.</p>
                  <pre className="p-4 bg-[#050505] text-emerald-400 rounded border border-white/10 max-w-md leading-relaxed">
{`{
  "success": true,
  "call_id": "call_1788788000000_abc12345",
  "status": "completed",
  "destination": "+8801750010459",
  "created_at": "2026-09-07T13:30:00.000Z"
}`}
                  </pre>
                </div>
              </div>

              {/* GET /api/health */}
              <div className="border border-white/10 rounded-lg bg-[#0a0a0a] overflow-hidden">
                <div className="p-4 bg-[#080808] border-b border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded border border-emerald-500/30">
                      GET
                    </span>
                    <span className="font-mono text-sm font-bold text-white">/api/health</span>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-500 uppercase">PUBLIC HEALTH PROBE</span>
                </div>
                <div className="p-6 text-xs font-mono">
                  <pre className="p-4 bg-[#050505] text-emerald-400 rounded border border-white/10 max-w-md">
{`{
  "status": "ok",
  "service": "call-api"
}`}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: ARCHITECTURE & CONFIGURATION */}
        {activeTab === 'config' && (
          <div className="space-y-8">
            <div>
              <h2 className="text-4xl sm:text-6xl font-black tracking-tighter uppercase mb-2">
                Architecture
              </h2>
              <p className="text-white/40 text-base max-w-2xl">
                Modular provider decoupling architecture isolating HTTP routes from VoIP hardware &amp; SIP trunk providers.
              </p>
            </div>

            {/* In-Console SIP Vault */}
            <SipVaultCard
              authToken={authToken}
              destination={destination}
              onSetDestination={setDestination}
              onPasswordVaulted={fetchConfig}
            />

            {/* Provider Guide */}
            <div className="p-6 border border-white/10 rounded-lg bg-[#080808] space-y-4">
              <div className="flex items-center gap-3">
                <Info className="w-5 h-5 text-blue-400" />
                <h3 className="text-sm font-black uppercase tracking-wider text-white">
                  RanksTel / Ranks ITT SIP Carrier Integration
                </h3>
              </div>
              <p className="text-xs text-white/60 leading-relaxed">
                The application is configured to connect to your RanksTel SIP server (<code className="text-white font-mono">202.40.176.2:5060</code>) using your IP Phone number (<code className="text-white font-mono">09617552229</code>) as both the authentication username and outbound Caller ID.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
                <div className="p-3 bg-[#111] rounded border border-white/10 space-y-1">
                  <span className="text-[10px] text-white/40 uppercase block">SIP Trunk Server</span>
                  <span className="text-emerald-400 font-bold">202.40.176.2:5060 (UDP/SIP)</span>
                </div>
                <div className="p-3 bg-[#111] rounded border border-white/10 space-y-1">
                  <span className="text-[10px] text-white/40 uppercase block">User Portal URL</span>
                  <a
                    href="https://sip.ranksitt.net/vup/login"
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-400 underline font-bold hover:text-blue-300"
                  >
                    https://sip.ranksitt.net/vup/login
                  </a>
                </div>
              </div>
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded text-emerald-300 text-xs">
                <strong>Password Vault:</strong> When you enter and save your password in the <strong>SIP Trunk Credentials &amp; Hash Vault</strong> above, it is immediately preserved as a SHA-256 hash and used for live SIP outbound dispatches. Alternatively, you can define <code className="font-mono bg-black/40 px-1 py-0.5 rounded text-white">SIP_PASSWORD="..."</code> in your environment file.
              </div>
            </div>

            {/* Sanitized Configuration Details */}
            <div className="p-6 border border-white/10 rounded-lg bg-[#0a0a0a] space-y-6">
              <div className="border-b border-white/10 pb-3">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-emerald-400" />
                  Sanitized Runtime Configuration
                </h3>
                <p className="text-xs font-mono text-white/40 mt-1">
                  Sensitive credentials and private tokens are masked at API boundary.
                </p>
              </div>

              {sanitizedConfig ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs font-mono">
                  <div className="p-5 bg-white/5 border border-white/10 rounded-sm space-y-3">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400 block">
                      SIP Carrier Parameters
                    </span>
                    <div className="flex justify-between border-b border-white/5 pb-2">
                      <span className="text-white/40">Carrier:</span>
                      <span className="font-bold text-white">RanksTel / Ranks ITT</span>
                    </div>
                    <div className="flex justify-between border-b border-white/5 pb-2">
                      <span className="text-white/40">SIP Server:</span>
                      <span className="font-bold text-white">
                        {String((sanitizedConfig.sip as Record<string, unknown>)?.server || '202.40.176.2')}
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-white/5 pb-2">
                      <span className="text-white/40">SIP Port:</span>
                      <span className="font-bold text-white">
                        {String((sanitizedConfig.sip as Record<string, unknown>)?.port || 5060)}
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-white/5 pb-2">
                      <span className="text-white/40">SIP Username:</span>
                      <span className="font-bold text-white">
                        {String((sanitizedConfig.sip as Record<string, unknown>)?.username || '09617552229')}
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-white/5 pb-2">
                      <span className="text-white/40">Caller ID:</span>
                      <span className="font-bold text-emerald-400">
                        {String((sanitizedConfig.sip as Record<string, unknown>)?.callerId || '09617552229')}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/40">Password Status:</span>
                      <span className={`font-bold ${Boolean((sanitizedConfig.sip as Record<string, unknown>)?.hasPassword) ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {Boolean((sanitizedConfig.sip as Record<string, unknown>)?.hasPassword) ? 'SET IN .ENV' : 'AWAITING IN .ENV'}
                      </span>
                    </div>
                  </div>

                  <div className="p-5 bg-white/5 border border-white/10 rounded-sm space-y-3">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400 block">
                      Protection &amp; Governance
                    </span>
                    <div className="flex justify-between border-b border-white/5 pb-2">
                      <span className="text-white/40">Active Provider:</span>
                      <span className="font-bold text-emerald-400 uppercase">
                        {String(sanitizedConfig.telephonyProvider)}
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-white/5 pb-2">
                      <span className="text-white/40">Rate Limit:</span>
                      <span className="font-bold text-white">
                        {String((sanitizedConfig.rateLimit as Record<string, unknown>)?.max)} req / window
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-white/5 pb-2">
                      <span className="text-white/40">Dedup Window:</span>
                      <span className="font-bold text-white">
                        {String((sanitizedConfig.duplicateProtection as Record<string, unknown>)?.windowSeconds)}s
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/40">Timeout Limit:</span>
                      <span className="font-bold text-white">{String(sanitizedConfig.callTimeoutMs)}ms</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-xs font-mono text-white/30">Loading configuration...</div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="h-14 border-t border-white/10 flex flex-col sm:flex-row items-center px-4 sm:px-8 bg-[#0a0a0a] justify-between text-[10px] font-mono text-white/30 uppercase tracking-widest gap-2 mt-auto">
        <div>TRUNK: 202.40.176.2:5060 // CALLER_ID: 09617552229</div>
        <div>RATE_LIMIT: 20_REQ/MIN // DEDUP: 30S</div>
        <div>&copy; 2026 VOIP_BRIDGE_SECURITY</div>
      </footer>
    </div>
  );
}
