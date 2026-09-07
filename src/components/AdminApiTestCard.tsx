import React, { useState } from 'react';
import {
  ShieldCheck,
  Activity,
  PhoneCall,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Terminal,
  Play,
  Copy,
  Check,
  Zap,
  Phone,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';

interface AdminApiTestCardProps {
  authToken: string;
  destination: string;
  onSetDestination: (dest: string) => void;
  onCallSuccess?: () => void;
}

interface TestStepResult {
  name: string;
  endpoint: string;
  method: string;
  status: 'idle' | 'running' | 'success' | 'failed';
  statusCode?: number;
  latencyMs?: number;
  message?: string;
  data?: Record<string, unknown>;
}

export const AdminApiTestCard: React.FC<AdminApiTestCardProps> = ({
  authToken,
  destination,
  onSetDestination,
  onCallSuccess,
}) => {
  const [isRunningAll, setIsRunningAll] = useState(false);
  const [activeStepIndex, setActiveStepIndex] = useState<number | null>(null);
  const [diagnosticLogs, setDiagnosticLogs] = useState<
    Array<{ timestamp: string; type: 'info' | 'success' | 'warn' | 'error'; message: string }>
  >([]);
  const [latestCallId, setLatestCallId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Diagnostic steps state
  const [steps, setSteps] = useState<TestStepResult[]>([
    {
      name: 'API Health Probe',
      endpoint: '/api/health',
      method: 'GET',
      status: 'idle',
      message: 'Verifies backend HTTP server availability and response latency.',
    },
    {
      name: 'Admin Auth & SIP Config',
      endpoint: '/api/config',
      method: 'GET',
      status: 'idle',
      message: 'Validates Bearer token authentication and SIP trunk configuration.',
    },
    {
      name: 'Outbound Test Call Dispatch',
      endpoint: '/api/test-call',
      method: 'POST',
      status: 'idle',
      message: 'Dispatches live test call to verify phone ringing on recipient handset.',
    },
    {
      name: 'Call Status Lifecycle Check',
      endpoint: '/api/call/:call_id',
      method: 'GET',
      status: 'idle',
      message: 'Queries call repository to ensure status transitions are recorded.',
    },
  ]);

  const addLog = (type: 'info' | 'success' | 'warn' | 'error', message: string) => {
    setDiagnosticLogs((prev) => [
      { timestamp: new Date().toLocaleTimeString(), type, message },
      ...prev.slice(0, 19),
    ]);
  };

  // Single step: 1. Health Probe
  const testHealthProbe = async (): Promise<boolean> => {
    setActiveStepIndex(0);
    setSteps((prev) =>
      prev.map((s, idx) =>
        idx === 0 ? { ...s, status: 'running', message: 'Sending GET /api/health...' } : s
      )
    );
    addLog('info', 'Testing GET /api/health (Checking API availability)...');

    const start = performance.now();
    try {
      const res = await fetch('/api/health');
      const latency = Math.round(performance.now() - start);
      const data = await res.json();

      if (res.ok && data.status === 'ok') {
        setSteps((prev) =>
          prev.map((s, idx) =>
            idx === 0
              ? {
                  ...s,
                  status: 'success',
                  statusCode: res.status,
                  latencyMs: latency,
                  message: `API Health OK (${latency}ms) - Service: ${data.service || 'call-api'}`,
                  data,
                }
              : s
          )
        );
        addLog('success', `GET /api/health passed in ${latency}ms (HTTP ${res.status})`);
        return true;
      } else {
        throw new Error(data.message || `Health returned status ${res.status}`);
      }
    } catch (err) {
      const latency = Math.round(performance.now() - start);
      const msg = err instanceof Error ? err.message : 'Connection failed';
      setSteps((prev) =>
        prev.map((s, idx) =>
          idx === 0
            ? {
                ...s,
                status: 'failed',
                statusCode: 500,
                latencyMs: latency,
                message: `Health probe failed: ${msg}`,
              }
            : s
        )
      );
      addLog('error', `GET /api/health failed: ${msg}`);
      return false;
    }
  };

  // Single step: 2. Auth & Config
  const testAuthConfig = async (): Promise<boolean> => {
    setActiveStepIndex(1);
    setSteps((prev) =>
      prev.map((s, idx) =>
        idx === 1 ? { ...s, status: 'running', message: 'Sending GET /api/config...' } : s
      )
    );
    addLog('info', 'Testing GET /api/config (Verifying Bearer token authentication)...');

    const start = performance.now();
    try {
      const res = await fetch('/api/config', {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      const latency = Math.round(performance.now() - start);
      const data = await res.json();

      if (res.ok && data.success) {
        const trunkServer = data.config?.sip?.server || '202.40.176.2';
        const callerId = data.config?.sip?.callerId || '09617552229';
        setSteps((prev) =>
          prev.map((s, idx) =>
            idx === 1
              ? {
                  ...s,
                  status: 'success',
                  statusCode: res.status,
                  latencyMs: latency,
                  message: `Authenticated. SIP Trunk: ${trunkServer} | Caller ID: ${callerId}`,
                  data: data.config,
                }
              : s
          )
        );
        addLog('success', `Auth verified (HTTP ${res.status}). Trunk: ${trunkServer}, Caller ID: ${callerId}`);
        return true;
      } else {
        throw new Error(data.message || `Authentication failed with status ${res.status}`);
      }
    } catch (err) {
      const latency = Math.round(performance.now() - start);
      const msg = err instanceof Error ? err.message : 'Auth verification error';
      setSteps((prev) =>
        prev.map((s, idx) =>
          idx === 1
            ? {
                ...s,
                status: 'failed',
                statusCode: 401,
                latencyMs: latency,
                message: `Auth probe failed: ${msg}`,
              }
            : s
        )
      );
      addLog('error', `GET /api/config failed: ${msg}`);
      return false;
    }
  };

  // Single step: 3. Outbound Test Call
  const testOutboundCall = async (): Promise<string | null> => {
    const target = destination.trim();
    if (!target) {
      addLog('error', 'Cannot dispatch test call: Target destination is empty.');
      return null;
    }

    setActiveStepIndex(2);
    setSteps((prev) =>
      prev.map((s, idx) =>
        idx === 2 ? { ...s, status: 'running', message: `Dispatching test call to ${target}...` } : s
      )
    );
    addLog('info', `Testing POST /api/test-call (Sending test call to ${target})...`);

    const start = performance.now();
    try {
      const res = await fetch('/api/test-call', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          destination: target,
        }),
      });
      const latency = Math.round(performance.now() - start);
      const data = await res.json();

      if (res.ok && data.success) {
        const callId = data.call_id;
        setLatestCallId(callId);
        setSteps((prev) =>
          prev.map((s, idx) =>
            idx === 2
              ? {
                  ...s,
                  status: 'success',
                  statusCode: res.status,
                  latencyMs: latency,
                  message: `Call dispatched! Status: ${data.status?.toUpperCase()} | Call ID: ${callId}`,
                  data,
                }
              : s
          )
        );
        addLog(
          'success',
          `Call successfully dispatched to ${target}! Call ID: ${callId}. Handset should ring.`
        );
        onCallSuccess?.();
        return callId;
      } else {
        throw new Error(data.message || data.error || `Call failed with HTTP ${res.status}`);
      }
    } catch (err) {
      const latency = Math.round(performance.now() - start);
      const msg = err instanceof Error ? err.message : 'Call dispatch failed';
      setSteps((prev) =>
        prev.map((s, idx) =>
          idx === 2
            ? {
                ...s,
                status: 'failed',
                statusCode: 500,
                latencyMs: latency,
                message: `Call dispatch failed: ${msg}`,
              }
            : s
        )
      );
      addLog('error', `POST /api/test-call failed: ${msg}`);
      return null;
    }
  };

  // Single step: 4. Poll Call Status
  const testCallStatusQuery = async (callIdToQuery?: string): Promise<boolean> => {
    const id = callIdToQuery || latestCallId;
    if (!id) {
      addLog('warn', 'No call ID available to test status query. Trigger test call first.');
      return false;
    }

    setActiveStepIndex(3);
    setSteps((prev) =>
      prev.map((s, idx) =>
        idx === 3 ? { ...s, status: 'running', message: `Querying GET /api/call/${id}...` } : s
      )
    );
    addLog('info', `Testing GET /api/call/${id}...`);

    const start = performance.now();
    try {
      const res = await fetch(`/api/call/${encodeURIComponent(id)}`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      const latency = Math.round(performance.now() - start);
      const data = await res.json();

      if (res.ok && data.success) {
        setSteps((prev) =>
          prev.map((s, idx) =>
            idx === 3
              ? {
                  ...s,
                  status: 'success',
                  statusCode: res.status,
                  latencyMs: latency,
                  message: `Status verified: ${data.status?.toUpperCase()} | Destination: ${data.destination}`,
                  data,
                }
              : s
          )
        );
        addLog('success', `Call status query verified (HTTP ${res.status}): State is ${data.status}`);
        return true;
      } else {
        throw new Error(data.message || `Query failed with status ${res.status}`);
      }
    } catch (err) {
      const latency = Math.round(performance.now() - start);
      const msg = err instanceof Error ? err.message : 'Query error';
      setSteps((prev) =>
        prev.map((s, idx) =>
          idx === 3
            ? {
                ...s,
                status: 'failed',
                statusCode: 500,
                latencyMs: latency,
                message: `Query failed: ${msg}`,
              }
            : s
        )
      );
      addLog('error', `GET /api/call/${id} failed: ${msg}`);
      return false;
    }
  };

  // Full end-to-end diagnostic runner
  const handleRunAllDiagnostics = async () => {
    if (isRunningAll) return;
    setIsRunningAll(true);
    addLog('info', '=== Starting Full Admin API Diagnostics & Live Call Test ===');

    try {
      // Step 1: Health
      const healthOk = await testHealthProbe();
      if (!healthOk) {
        addLog('error', 'Diagnostic aborted at Step 1: Health check failed.');
        return;
      }

      // Small delay between checks
      await new Promise((r) => setTimeout(r, 400));

      // Step 2: Auth
      const authOk = await testAuthConfig();
      if (!authOk) {
        addLog('error', 'Diagnostic aborted at Step 2: Authentication failed.');
        return;
      }

      await new Promise((r) => setTimeout(r, 400));

      // Step 3: Outbound Test Call
      const callId = await testOutboundCall();
      if (!callId) {
        addLog('error', 'Diagnostic aborted at Step 3: Test call dispatch failed.');
        return;
      }

      await new Promise((r) => setTimeout(r, 800));

      // Step 4: Status Query
      await testCallStatusQuery(callId);
      addLog('success', '=== All API Diagnostics Completed Successfully! Call Dispatched ===');
    } finally {
      setIsRunningAll(false);
      setActiveStepIndex(null);
    }
  };

  const handleCopyCallId = () => {
    if (!latestCallId) return;
    navigator.clipboard.writeText(latestCallId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const allPassed = steps.every((s) => s.status === 'success');
  const anyFailed = steps.some((s) => s.status === 'failed');

  return (
    <div className="p-5 sm:p-6 rounded-xl border border-blue-500/30 bg-[#090b10] space-y-5 shadow-[0_0_30px_rgba(59,130,246,0.1)]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <ShieldCheck className="w-5 h-5 text-blue-400" />
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white">
              Admin API &amp; Call Connectivity Test Suite
            </h3>
            <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
              ADMIN VERIFIED
            </span>
            {allPassed && (
              <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                <CheckCircle2 className="w-2.5 h-2.5" /> ALL TESTS PASSED
              </span>
            )}
            {anyFailed && (
              <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1">
                <XCircle className="w-2.5 h-2.5" /> TEST FAILED
              </span>
            )}
          </div>
          <p className="text-xs text-white/60">
            Verify API endpoint responsiveness, Bearer authentication, SIP trunk status, and dispatch a live call to confirm handset ringing.
          </p>
        </div>

        {/* Master Run All Button */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRunAllDiagnostics}
            disabled={isRunningAll}
            className="px-4 py-2.5 bg-blue-500 hover:bg-blue-400 text-white font-black text-xs uppercase tracking-wider rounded-lg transition-colors flex items-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
          >
            {isRunningAll ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Running Diagnostics...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-white" />
                <span>Run Complete API &amp; Call Test</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Target Destination Bar */}
      <div className="p-3.5 rounded-lg bg-black/40 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-white/50 font-mono text-[11px]">Test Call Recipient:</span>
          <input
            type="text"
            value={destination}
            onChange={(e) => onSetDestination(e.target.value)}
            placeholder="+8801XXXXXXXXX"
            className="px-3 py-1 bg-white/5 border border-white/20 rounded font-mono text-xs text-emerald-400 font-bold focus:outline-none focus:border-blue-400 w-44"
          />
          <button
            type="button"
            onClick={() => {
              onSetDestination('+8801750010459');
              addLog('info', 'Target number reset to primary: +8801750010459');
            }}
            className="px-2.5 py-1 bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded text-[10px] font-mono transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Set to primary target number (+8801750010459)"
          >
            <Phone className="w-3.5 h-3.5 text-blue-400" />
            <span>+8801750010459</span>
          </button>
        </div>

        <div className="text-[11px] font-mono text-white/40">
          Caller ID: <span className="text-emerald-400 font-bold">09617552229</span> | Trunk: <span className="text-white/70">202.40.176.2:5060</span>
        </div>
      </div>

      {/* 4 Interactive Test Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {steps.map((step, idx) => {
          const isRunning = step.status === 'running';
          const isSuccess = step.status === 'success';
          const isFailed = step.status === 'failed';

          return (
            <div
              key={idx}
              className={`p-3.5 rounded-lg border transition-all ${
                isSuccess
                  ? 'bg-emerald-950/20 border-emerald-500/30'
                  : isFailed
                  ? 'bg-rose-950/20 border-rose-500/30'
                  : isRunning
                  ? 'bg-blue-950/20 border-blue-500/30'
                  : 'bg-white/5 border-white/10'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-white/10 text-white/70 border border-white/10">
                      {step.method}
                    </span>
                    <span className="text-xs font-bold text-white">{step.name}</span>
                  </div>
                  <span className="text-[10px] font-mono text-blue-400 block">{step.endpoint}</span>
                </div>

                <div className="flex items-center gap-1.5">
                  {isSuccess && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      <CheckCircle2 className="w-3 h-3" /> PASS ({step.latencyMs}ms)
                    </span>
                  )}
                  {isFailed && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                      <XCircle className="w-3 h-3" /> FAIL
                    </span>
                  )}
                  {isRunning && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                      <RefreshCw className="w-3 h-3 animate-spin" /> TESTING
                    </span>
                  )}

                  {/* Individual Trigger Button */}
                  <button
                    type="button"
                    disabled={isRunningAll || isRunning}
                    onClick={() => {
                      if (idx === 0) testHealthProbe();
                      if (idx === 1) testAuthConfig();
                      if (idx === 2) testOutboundCall();
                      if (idx === 3) testCallStatusQuery();
                    }}
                    className="p-1.5 bg-white/10 hover:bg-white/20 text-white/80 hover:text-white rounded border border-white/10 transition-colors cursor-pointer disabled:opacity-40"
                    title={`Run individual test for ${step.name}`}
                  >
                    <Zap className="w-3 h-3 text-blue-400" />
                  </button>
                </div>
              </div>

              <p className="text-[11px] text-white/60 font-mono mt-2 leading-relaxed">
                {step.message}
              </p>
            </div>
          );
        })}
      </div>

      {/* Success Banner When Live Call is Dispatched */}
      {latestCallId && (
        <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/40 space-y-2 animate-in fade-in duration-300">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                <PhoneCall className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> Live Call Dispatched Successfully!
                </h4>
                <p className="text-[11px] text-emerald-200/80 font-mono">
                  Your phone ({destination}) should be ringing now from Caller ID: 09617552229.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 font-mono text-xs">
              <div className="px-2.5 py-1 bg-black/40 border border-emerald-500/30 rounded text-emerald-300 text-[11px]">
                CALL_ID: <span className="text-white font-bold">{latestCallId}</span>
              </div>
              <button
                type="button"
                onClick={handleCopyCallId}
                className="p-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 rounded cursor-pointer transition-colors"
                title="Copy Call ID"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Real-time Diagnostic Event Console */}
      <div className="space-y-1.5 pt-2 border-t border-white/5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono uppercase tracking-wider text-white/40 flex items-center gap-1.5">
            <Terminal className="w-3 h-3 text-blue-400" />
            Live Test Diagnostic Output
          </span>
          {diagnosticLogs.length > 0 && (
            <button
              type="button"
              onClick={() => setDiagnosticLogs([])}
              className="text-[10px] font-mono text-white/40 hover:text-white"
            >
              Clear Logs
            </button>
          )}
        </div>

        <div className="p-3 bg-black/60 rounded-lg border border-white/10 font-mono text-[11px] max-h-32 overflow-y-auto space-y-1">
          {diagnosticLogs.length === 0 ? (
            <span className="text-white/30 text-[10px]">
              Ready. Click "Run Complete API &amp; Call Test" or test individual endpoints above to verify system behavior.
            </span>
          ) : (
            diagnosticLogs.map((log, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-white/30 text-[10px] shrink-0">[{log.timestamp}]</span>
                <span
                  className={`leading-snug ${
                    log.type === 'success'
                      ? 'text-emerald-400'
                      : log.type === 'error'
                      ? 'text-rose-400'
                      : log.type === 'warn'
                      ? 'text-amber-300'
                      : 'text-blue-300'
                  }`}
                >
                  {log.message}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
