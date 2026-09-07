import React, { useState, useEffect } from 'react';
import {
  Phone,
  PhoneCall,
  Repeat,
  CheckCircle2,
  XCircle,
  Clock,
  Square,
  Sparkles,
  PhoneForwarded,
  Volume2,
  Activity,
  AlertCircle,
  Sliders,
  Settings2,
  ArrowRight,
  Zap,
} from 'lucide-react';

export interface RedialLogEntry {
  timestamp: string;
  attempt: number;
  message: string;
  status?: string;
  callId?: string;
}

export interface RedialSessionData {
  id: string;
  destination: string;
  content: string;
  reason?: string;
  status: 'active' | 'waiting_retry' | 'answered' | 'stopped' | 'failed';
  currentAttempt: number;
  maxAttempts: number;
  retryIntervalSeconds: number;
  lastCallId?: string;
  lastStatus?: string;
  startedAt: string;
  lastAttemptAt?: string;
  nextAttemptAt?: string;
  answeredAt?: string;
  logs: RedialLogEntry[];
}

interface PersistentRedialCardProps {
  authToken: string;
  destination: string;
  onSetDestination: (dest: string) => void;
  retryUntilAnswered: boolean;
  onToggleRetry: (enabled: boolean) => void;
  retryIntervalSeconds: number;
  onChangeInterval: (seconds: number) => void;
  onCallSuccess?: () => void;
}

export const PersistentRedialCard: React.FC<PersistentRedialCardProps> = ({
  authToken,
  destination,
  onSetDestination,
  retryUntilAnswered,
  onToggleRetry,
  retryIntervalSeconds,
  onChangeInterval,
  onCallSuccess,
}) => {
  const [activeSession, setActiveSession] = useState<RedialSessionData | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [countdownSeconds, setCountdownSeconds] = useState<number | null>(null);

  // Custom manual interval editor states
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [customValue, setCustomValue] = useState<number>(1);
  const [customUnit, setCustomUnit] = useState<'minutes' | 'seconds'>('minutes');

  // Poll for active redial session
  const fetchActiveSession = async () => {
    try {
      const res = await fetch(`/api/redial/active?destination=${encodeURIComponent(destination)}`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setActiveSession(data.session || null);
        if (data.session?.status === 'answered' && onCallSuccess) {
          onCallSuccess();
        }
      }
    } catch {
      // ignore transient poll error
    }
  };

  // Poll periodically if an active or waiting session is ongoing
  useEffect(() => {
    fetchActiveSession();
    const interval = setInterval(() => {
      fetchActiveSession();
    }, 1500);

    return () => clearInterval(interval);
  }, [destination, authToken]);

  // Countdown effect for nextAttemptAt
  useEffect(() => {
    if (!activeSession?.nextAttemptAt || activeSession.status !== 'waiting_retry') {
      setCountdownSeconds(null);
      return;
    }

    const targetTime = new Date(activeSession.nextAttemptAt).getTime();
    const updateCountdown = () => {
      const now = Date.now();
      const diff = Math.max(0, Math.ceil((targetTime - now) / 1000));
      setCountdownSeconds(diff);
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 400);
    return () => clearInterval(timer);
  }, [activeSession?.nextAttemptAt, activeSession?.status]);

  // Stop Redial
  const handleStopRedial = async () => {
    setActionLoading(true);
    try {
      await fetch('/api/redial/stop', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          sessionId: activeSession?.id,
          destination,
        }),
      });
      await fetchActiveSession();
    } catch (err) {
      console.error('Failed to stop redial', err);
    } finally {
      setActionLoading(false);
    }
  };

  // Simulate Answer (For testing when user picks up handset)
  const handleSimulateAnswer = async () => {
    setActionLoading(true);
    try {
      await fetch('/api/redial/simulate-answer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          sessionId: activeSession?.id,
        }),
      });
      await fetchActiveSession();
      if (onCallSuccess) onCallSuccess();
    } catch (err) {
      console.error('Failed to simulate answer', err);
    } finally {
      setActionLoading(false);
    }
  };

  // Handle custom interval apply
  const handleApplyCustomInterval = (val: number, unit: 'minutes' | 'seconds') => {
    const safeVal = Math.max(0, val);
    const totalSec = unit === 'minutes' ? safeVal * 60 : safeVal;
    onChangeInterval(totalSec);
  };

  const isLoopRunning = activeSession && (activeSession.status === 'active' || activeSession.status === 'waiting_retry');
  const isAnswered = activeSession?.status === 'answered';

  // Format seconds into nice readable English string
  const formatSecondsToEnglish = (sec: number) => {
    if (sec === 0) return 'Immediate (0s)';
    if (sec < 60) return `${sec} seconds`;
    const mins = Math.floor(sec / 60);
    const remSec = sec % 60;
    if (remSec === 0) return `${mins} min`;
    return `${mins} min ${remSec} sec`;
  };

  const presetIntervals = [
    { label: 'Immediate', sub: '0s (Instant)', seconds: 0, icon: Zap },
    { label: '1 Minute', sub: '60 seconds', seconds: 60, icon: Clock },
    { label: '2 Minutes', sub: '120 seconds', seconds: 120, icon: Clock },
    { label: '5 Minutes', sub: '300 seconds', seconds: 300, icon: Clock },
  ];

  return (
    <div
      className={`p-5 sm:p-6 rounded-xl border transition-all duration-300 ${
        isAnswered
          ? 'bg-emerald-950/20 border-emerald-500/40 shadow-[0_0_25px_rgba(16,185,129,0.15)]'
          : isLoopRunning
          ? 'bg-blue-950/25 border-blue-500/40 shadow-[0_0_25px_rgba(59,130,246,0.15)]'
          : 'bg-[#090909] border-white/10'
      }`}
    >
      {/* Top Header & Master Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Repeat className={`w-4 h-4 ${isLoopRunning ? 'text-blue-400 animate-spin' : isAnswered ? 'text-emerald-400' : 'text-blue-400'}`} />
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white">
              Persistent Redial Engine (Loop Until Answered)
            </h3>
            {isLoopRunning && (
              <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 animate-pulse">
                LOOP ACTIVE
              </span>
            )}
            {isAnswered && (
              <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                <CheckCircle2 className="w-2.5 h-2.5" /> ANSWERED
              </span>
            )}
          </div>
          <p className="text-xs text-white/60">
            Continuously redials the target destination until the recipient answers the handset.
          </p>
        </div>

        {/* Master ON/OFF Toggle */}
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer select-none bg-white/5 hover:bg-white/10 px-3.5 py-2 rounded-lg border border-white/10 transition-colors">
            <input
              type="checkbox"
              checked={retryUntilAnswered}
              onChange={(e) => onToggleRetry(e.target.checked)}
              className="w-4 h-4 accent-blue-500 rounded cursor-pointer"
            />
            <span className="text-xs font-mono font-bold text-white">
              {retryUntilAnswered ? 'Auto-Retry Enabled (ON)' : 'Auto-Retry Disabled (OFF)'}
            </span>
          </label>
        </div>
      </div>

      {/* Target Destination Section */}
      <div className="py-3 border-b border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-white/50 font-mono text-[11px]">Call Target Destination:</span>
          <div className="px-2.5 py-1 bg-white/5 border border-white/10 rounded font-mono text-xs text-emerald-400 font-bold tracking-wider">
            {destination || '+8801750010459'}
          </div>
          <button
            type="button"
            onClick={() => onSetDestination('+8801750010459')}
            className="px-2.5 py-1 bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded text-[10px] font-mono transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Set to primary target number (+8801750010459)"
          >
            <Phone className="w-3.5 h-3.5 text-blue-400" />
            <span>+8801750010459</span>
          </button>
        </div>

        <div className="text-[11px] font-mono text-white/40">
          Current Retry Delay: <span className="text-blue-400 font-bold">{formatSecondsToEnglish(retryIntervalSeconds)}</span>
        </div>
      </div>

      {/* Timing Controls (Immediate, 1m, 2m, 5m, or Custom Input) */}
      <div className="py-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs text-white/70">
            <Clock className="w-3.5 h-3.5 text-blue-400" />
            <span className="font-bold text-white">Delay between unanswered call attempts:</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsCustomMode(!isCustomMode)}
              className={`text-[10px] font-mono px-2 py-1 rounded transition-colors flex items-center gap-1 cursor-pointer ${
                isCustomMode
                  ? 'bg-blue-500 text-white font-bold'
                  : 'bg-white/5 text-white/60 hover:bg-white/10 border border-white/10'
              }`}
            >
              <Sliders className="w-3 h-3" />
              <span>{isCustomMode ? 'Custom Mode Active' : 'Custom Interval'}</span>
            </button>
          </div>
        </div>

        {/* Quick Interval Presets */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {presetIntervals.map((preset) => {
            const isSelected = !isCustomMode && retryIntervalSeconds === preset.seconds;
            const Icon = preset.icon;
            return (
              <button
                key={preset.seconds}
                type="button"
                onClick={() => {
                  setIsCustomMode(false);
                  onChangeInterval(preset.seconds);
                }}
                className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-blue-500/20 border-blue-400 text-white shadow-sm ring-1 ring-blue-500/40'
                    : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold ${isSelected ? 'text-blue-300' : 'text-white'}`}>
                    {preset.label}
                  </span>
                  <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-blue-400' : 'text-white/30'}`} />
                </div>
                <div className="text-[10px] font-mono text-white/40 mt-0.5">
                  {preset.sub}
                </div>
              </button>
            );
          })}
        </div>

        {/* Manual Custom Time Form */}
        {isCustomMode && (
          <div className="p-3.5 rounded-lg bg-black/40 border border-blue-500/30 space-y-2.5 animate-in fade-in duration-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <span className="text-[11px] font-bold text-white flex items-center gap-1.5">
                  <Settings2 className="w-3.5 h-3.5 text-blue-400" />
                  Custom Retry Duration Setup
                </span>
                <p className="text-[10px] text-white/50">
                  Specify exact time to wait after an unanswered call before redialing:
                </p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="1440"
                  step="1"
                  value={customValue}
                  onChange={(e) => {
                    const val = Math.max(0, parseInt(e.target.value) || 0);
                    setCustomValue(val);
                    handleApplyCustomInterval(val, customUnit);
                  }}
                  className="w-20 px-2.5 py-1.5 bg-white/5 border border-white/20 rounded font-mono text-xs text-white text-center focus:outline-none focus:border-blue-400"
                />

                <select
                  value={customUnit}
                  onChange={(e) => {
                    const u = e.target.value as 'minutes' | 'seconds';
                    setCustomUnit(u);
                    handleApplyCustomInterval(customValue, u);
                  }}
                  className="px-2.5 py-1.5 bg-[#141414] border border-white/20 rounded text-xs text-white focus:outline-none focus:border-blue-400 font-mono"
                >
                  <option value="minutes">Minutes</option>
                  <option value="seconds">Seconds</option>
                </select>

                <button
                  type="button"
                  onClick={() => handleApplyCustomInterval(customValue, customUnit)}
                  className="px-3 py-1.5 bg-blue-500 hover:bg-blue-400 text-white font-bold text-xs rounded transition-colors cursor-pointer"
                >
                  Apply
                </button>
              </div>
            </div>

            <div className="text-[11px] font-mono text-blue-300/80 bg-blue-500/10 p-2 rounded border border-blue-500/20">
              💡 Behavior: When a call terminates without being answered, the system will wait exactly{' '}
              <strong className="text-white">
                {customValue} {customUnit}
              </strong>{' '}
              before initiating the next attempt.
            </div>
          </div>
        )}
      </div>

      {/* ACTIVE LOOP LIVE DASHBOARD */}
      {isLoopRunning && (
        <div className="mt-2 p-4 rounded-xl bg-blue-950/30 border border-blue-500/30 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-300">
                <PhoneCall className="w-5 h-5 animate-bounce" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    Dial Attempt #{activeSession.currentAttempt}
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/20 text-blue-300">
                    {activeSession.status === 'waiting_retry'
                      ? activeSession.retryIntervalSeconds === 0
                        ? 'Retrying immediately...'
                        : `Next attempt in: ${countdownSeconds !== null ? `${countdownSeconds}s` : `${activeSession.retryIntervalSeconds}s`}`
                      : 'Dialing / Handset Ringing'}
                  </span>
                </div>
                <p className="text-[11px] text-blue-200/80 font-mono mt-0.5">
                  {activeSession.status === 'waiting_retry'
                    ? activeSession.retryIntervalSeconds === 0
                      ? 'No answer. Retrying immediately without delay...'
                      : 'No answer. Waiting configured delay before next attempt...'
                    : `Ringing (${destination})... Awaiting answer`}
                </p>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSimulateAnswer}
                disabled={actionLoading}
                className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
                title="Simulate recipient answering the phone"
              >
                <Volume2 className="w-3.5 h-3.5 text-black" />
                <span>Simulate Answer</span>
              </button>

              <button
                type="button"
                onClick={handleStopRedial}
                disabled={actionLoading}
                className="px-3.5 py-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                title="Stop persistent redial loop"
              >
                <Square className="w-3.5 h-3.5 text-rose-400" />
                <span>Stop Redial</span>
              </button>
            </div>
          </div>

          {/* Animated Countdown Progress Bar */}
          {activeSession.status === 'waiting_retry' && countdownSeconds !== null && activeSession.retryIntervalSeconds > 0 && (
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] font-mono text-blue-300/70">
                <span>Countdown</span>
                <span>{countdownSeconds}s remaining</span>
              </div>
              <div className="w-full bg-black/40 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-blue-400 h-full transition-all duration-300 rounded-full"
                  style={{
                    width: `${Math.min(100, Math.max(0, ((activeSession.retryIntervalSeconds - countdownSeconds) / activeSession.retryIntervalSeconds) * 100))}%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ANSWERED CELEBRATION CARD */}
      {isAnswered && (
        <div className="mt-2 p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/30 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-emerald-300">
                  🎉 Call Successfully Answered!
                </h4>
                <p className="text-[11px] text-white/70 font-mono">
                  Recipient answered on attempt #{activeSession.currentAttempt}. Persistent redial loop completed.
                </p>
              </div>
            </div>
            <span className="text-[10px] font-mono text-emerald-400/80">
              {activeSession.answeredAt ? new Date(activeSession.answeredAt).toLocaleTimeString() : ''}
            </span>
          </div>
        </div>
      )}

      {/* STOPPED OR FAILED CARD */}
      {activeSession && (activeSession.status === 'stopped' || activeSession.status === 'failed') && (
        <div className="mt-2 p-3 rounded-lg bg-white/5 border border-white/10 flex items-center justify-between text-xs font-mono text-white/70">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400" />
            <span>
              {activeSession.status === 'stopped'
                ? 'Persistent redial loop stopped by user'
                : 'Maximum attempt limit exceeded'}
            </span>
          </div>
          <span className="text-white/40">Attempts: {activeSession.currentAttempt}</span>
        </div>
      )}

      {/* Real-time Activity Logs for Redial */}
      {activeSession && activeSession.logs && activeSession.logs.length > 0 && (
        <div className="mt-3 pt-3 border-t border-white/5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-mono uppercase tracking-wider text-white/40 flex items-center gap-1.5">
              <Activity className="w-3 h-3 text-blue-400" />
              Auto-Redial Live Events ({activeSession.logs.length} events)
            </span>
          </div>
          <div className="max-h-28 overflow-y-auto space-y-1 font-mono text-[10px] pr-1">
            {activeSession.logs.slice(0, 5).map((log, idx) => (
              <div
                key={idx}
                className="p-1.5 rounded bg-black/40 border border-white/5 flex items-start justify-between gap-2 text-white/80"
              >
                <div className="flex items-start gap-1.5">
                  <span className="text-blue-400 font-bold shrink-0">#{log.attempt}</span>
                  <span className="leading-snug">{log.message}</span>
                </div>
                <span className="text-white/30 shrink-0">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
