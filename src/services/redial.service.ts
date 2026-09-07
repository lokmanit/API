import crypto from 'crypto';
import { CallStatus } from '../types/call.types';
import { callService } from './call.service';
import { logger } from '../utils/logger';

export interface RedialLogEntry {
  timestamp: string;
  attempt: number;
  message: string;
  status?: string;
  callId?: string;
}

export interface RedialSession {
  id: string;
  destination: string;
  content: string;
  reason?: string;
  status: 'active' | 'waiting_retry' | 'answered' | 'stopped' | 'failed';
  currentAttempt: number;
  maxAttempts: number; // 0 = unlimited / until answered
  retryIntervalSeconds: number;
  lastCallId?: string;
  lastStatus?: CallStatus;
  startedAt: string;
  lastAttemptAt?: string;
  nextAttemptAt?: string;
  answeredAt?: string;
  timer?: NodeJS.Timeout;
  monitorTimer?: NodeJS.Timeout;
  logs: RedialLogEntry[];
}

export class RedialService {
  private sessions = new Map<string, RedialSession>();

  /**
   * Starts a persistent redial session that repeatedly calls destination
   * until the phone call is answered/received.
   */
  async startSession(params: {
    destination: string;
    content: string;
    reason?: string;
    retryIntervalSeconds?: number;
    maxAttempts?: number;
  }): Promise<RedialSession> {
    const { destination, content, reason } = params;
    // Default to 0 (immediate redial: re-initiates call immediately upon disconnect)
    const retryIntervalSeconds = Math.max(0, params.retryIntervalSeconds !== undefined ? Number(params.retryIntervalSeconds) : 0);
    const maxAttempts = params.maxAttempts ?? 0; // 0 = infinite / until answered

    // 1. Stop any currently active redial loop for the same destination
    this.stopSessionByDestination(destination);

    const sessionId = `redial_${Date.now()}_${crypto.randomUUID().slice(0, 6)}`;
    const now = new Date().toISOString();

    const intervalDesc = retryIntervalSeconds === 0
      ? 'Immediate (0s delay)'
      : retryIntervalSeconds >= 60
      ? `${(retryIntervalSeconds / 60).toFixed(1)} min`
      : `${retryIntervalSeconds} sec`;

    const session: RedialSession = {
      id: sessionId,
      destination,
      content,
      reason: reason || 'PERSISTENT_REDIAL',
      status: 'active',
      currentAttempt: 0,
      maxAttempts,
      retryIntervalSeconds,
      startedAt: now,
      logs: [
        {
          timestamp: now,
          attempt: 0,
          message: `Persistent redial session started: Calling ${destination} until answered (Interval: ${intervalDesc}).`,
        },
      ],
    };

    this.sessions.set(sessionId, session);
    logger.info(`[RedialService] Started persistent redial session ${sessionId} for ${destination}`);

    // Trigger initial attempt
    await this.executeAttempt(session);

    return this.serializeSession(session);
  }

  /**
   * Executes a single attempt within a redial session and monitors for answer
   */
  private async executeAttempt(session: RedialSession): Promise<void> {
    if (session.status === 'stopped' || session.status === 'answered') {
      return;
    }

    session.currentAttempt++;
    session.status = 'active';
    session.lastAttemptAt = new Date().toISOString();
    delete session.nextAttemptAt;

    const attemptNumber = session.currentAttempt;
    const isRetry = attemptNumber > 1;

    session.logs.unshift({
      timestamp: session.lastAttemptAt,
      attempt: attemptNumber,
      message: `[Attempt #${attemptNumber}] Dialing destination ${session.destination}...`,
      status: 'initiating',
    });

    try {
      const result = await callService.initiateCall(
        {
          destination: session.destination,
          content: session.content,
          reason: session.reason,
        },
        undefined,
        { isRetry, redialTaskId: session.id }
      );

      session.lastCallId = result.call_id;
      session.lastStatus = result.status;

      session.logs.unshift({
        timestamp: new Date().toISOString(),
        attempt: attemptNumber,
        callId: result.call_id,
        status: result.status,
        message: `[Attempt #${attemptNumber}] Call dispatched (Call ID: ${result.call_id}, Status: ${result.status}). Awaiting answer...`,
      });

      // If call failed immediately (e.g. busy or rejected at carrier)
      if (!result.success || result.status === CallStatus.BUSY || result.status === CallStatus.FAILED) {
        this.handleAttemptEnd(session, result.status || CallStatus.FAILED, result.message || 'Call failed or busy');
        return;
      }

      // If already answered immediately
      if (result.status === CallStatus.ANSWERED || result.status === CallStatus.COMPLETED) {
        this.handleCallAnswered(session, result.call_id);
        return;
      }

      // Otherwise, monitor the call status until answered or unanswered termination
      this.monitorCall(session, result.call_id, attemptNumber);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      session.lastStatus = CallStatus.FAILED;
      session.logs.unshift({
        timestamp: new Date().toISOString(),
        attempt: attemptNumber,
        status: 'failed',
        message: `[Attempt #${attemptNumber}] Dial attempt failed: ${errorMsg}`,
      });

      this.handleAttemptEnd(session, CallStatus.FAILED, errorMsg);
    }
  }

  /**
   * Actively monitors an outbound call for user answer or termination
   */
  private monitorCall(session: RedialSession, callId: string, attemptNumber: number): void {
    let checkCount = 0;
    const maxChecks = 25; // 25 * 1.5s = ~37.5s ring timeout window

    if (session.monitorTimer) {
      clearInterval(session.monitorTimer);
    }

    session.monitorTimer = setInterval(async () => {
      // Check if session was terminated in the meantime
      if (session.status === 'stopped' || session.status === 'answered') {
        if (session.monitorTimer) clearInterval(session.monitorTimer);
        return;
      }

      checkCount++;

      try {
        const liveCall = await callService.getCallStatus(callId);
        session.lastStatus = liveCall.status;

        // Check for Answered!
        if (liveCall.status === CallStatus.ANSWERED || liveCall.status === CallStatus.COMPLETED) {
          if (session.monitorTimer) clearInterval(session.monitorTimer);
          this.handleCallAnswered(session, callId);
          return;
        }

        // Check for terminal failure without answering
        const terminalFailure = [
          CallStatus.BUSY,
          CallStatus.FAILED,
          CallStatus.REJECTED,
          CallStatus.TIMEOUT,
        ].includes(liveCall.status);

        if (terminalFailure || checkCount >= maxChecks) {
          if (session.monitorTimer) clearInterval(session.monitorTimer);
          const finalStatus = terminalFailure ? liveCall.status : CallStatus.TIMEOUT;
          this.handleAttemptEnd(session, finalStatus, 'Ring timeout or call terminated without answer');
        }
      } catch {
        if (checkCount >= maxChecks) {
          if (session.monitorTimer) clearInterval(session.monitorTimer);
          this.handleAttemptEnd(session, CallStatus.TIMEOUT, 'Call response timed out');
        }
      }
    }, 1500);
  }

  /**
   * Called when user successfully picks up / receives the phone call
   */
  private handleCallAnswered(session: RedialSession, callId: string): void {
    if (session.timer) clearTimeout(session.timer);
    if (session.monitorTimer) clearInterval(session.monitorTimer);

    session.status = 'answered';
    session.answeredAt = new Date().toISOString();
    session.lastStatus = CallStatus.ANSWERED;

    session.logs.unshift({
      timestamp: session.answeredAt,
      attempt: session.currentAttempt,
      callId,
      status: 'answered',
      message: `🎉 Call Answered! Handset successfully answered at ${session.destination}. Redial loop completed.`,
    });

    logger.info(`[RedialService] Phone answered for session ${session.id}. Terminated redial loop.`);
  }

  /**
   * Called when an attempt finishes without being answered, triggering the next retry
   */
  private handleAttemptEnd(session: RedialSession, status: CallStatus, reason: string): void {
    if (session.status === 'stopped' || session.status === 'answered') {
      return;
    }

    if (session.maxAttempts > 0 && session.currentAttempt >= session.maxAttempts) {
      session.status = 'failed';
      session.logs.unshift({
        timestamp: new Date().toISOString(),
        attempt: session.currentAttempt,
        status: 'failed',
        message: `Exceeded maximum attempt limit (${session.maxAttempts}). Stopping redial loop.`,
      });
      return;
    }

    session.status = 'waiting_retry';
    const intervalSec = session.retryIntervalSeconds;
    // If 0 seconds, wait a tiny 400ms buffer so provider/socket tear-down cleanly finishes, then redial immediately
    const waitMs = intervalSec > 0 ? intervalSec * 1000 : 400;
    const nextTime = new Date(Date.now() + waitMs);
    session.nextAttemptAt = nextTime.toISOString();

    const intervalDesc = intervalSec === 0
      ? 'Immediately (0s)'
      : intervalSec >= 60
      ? `${Math.floor(intervalSec / 60)} min ${intervalSec % 60 > 0 ? (intervalSec % 60) + ' sec' : ''}`
      : `${intervalSec} sec`;

    session.logs.unshift({
      timestamp: new Date().toISOString(),
      attempt: session.currentAttempt,
      status: 'waiting_retry',
      message: `[Attempt #${session.currentAttempt}] Call not answered (${status}) - Next attempt in ${intervalDesc}...`,
    });

    session.timer = setTimeout(() => {
      if (session.status === 'waiting_retry') {
        this.executeAttempt(session);
      }
    }, waitMs);
  }

  /**
   * Stops an active redial session by session ID
   */
  stopSession(sessionId: string): RedialSession | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    if (session.timer) clearTimeout(session.timer);
    if (session.monitorTimer) clearInterval(session.monitorTimer);

    session.status = 'stopped';
    delete session.nextAttemptAt;

    session.logs.unshift({
      timestamp: new Date().toISOString(),
      attempt: session.currentAttempt,
      message: 'Redial loop stopped by user.',
    });

    logger.info(`[RedialService] Session ${sessionId} manually stopped`);
    return this.serializeSession(session);
  }

  /**
   * Stops active sessions by destination phone number
   */
  stopSessionByDestination(destination: string): void {
    const cleanDest = destination.replace(/[^0-9+]/g, '');
    for (const session of this.sessions.values()) {
      if (
        session.destination.replace(/[^0-9+]/g, '') === cleanDest &&
        (session.status === 'active' || session.status === 'waiting_retry')
      ) {
        this.stopSession(session.id);
      }
    }
  }

  /**
   * Stops all running redial sessions
   */
  stopAll(): void {
    for (const session of this.sessions.values()) {
      if (session.status === 'active' || session.status === 'waiting_retry') {
        this.stopSession(session.id);
      }
    }
  }

  /**
   * Simulates answering the phone (for testing / development in UI)
   */
  async simulateAnswer(sessionId?: string): Promise<RedialSession | null> {
    let session: RedialSession | undefined;

    if (sessionId) {
      session = this.sessions.get(sessionId);
    } else {
      // Pick most recent active or waiting session
      session = Array.from(this.sessions.values()).find(
        (s) => s.status === 'active' || s.status === 'waiting_retry'
      );
    }

    if (!session) return null;

    if (session.lastCallId) {
      await callService.getCallStatus(session.lastCallId);
    }

    this.handleCallAnswered(session, session.lastCallId || `mock_ans_${Date.now()}`);
    return this.serializeSession(session);
  }

  /**
   * Retrieves active session for a given destination or the most recent active session
   */
  getActiveSession(destination?: string): RedialSession | null {
    const all = Array.from(this.sessions.values());
    if (destination) {
      const cleanDest = destination.replace(/[^0-9+]/g, '');
      const match = all.find(
        (s) =>
          s.destination.replace(/[^0-9+]/g, '') === cleanDest &&
          (s.status === 'active' || s.status === 'waiting_retry')
      );
      if (match) return this.serializeSession(match);
    }

    // Default to newest active or waiting session
    const active = all
      .filter((s) => s.status === 'active' || s.status === 'waiting_retry')
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())[0];

    if (active) return this.serializeSession(active);

    // Or newest session overall (last 5 minutes)
    const newest = all.sort(
      (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    )[0];

    return newest ? this.serializeSession(newest) : null;
  }

  /**
   * Serializes session avoiding recursive timer objects
   */
  private serializeSession(session: RedialSession): RedialSession {
    const { timer: _t, monitorTimer: _m, ...rest } = session;
    return { ...rest };
  }
}

export const redialService = new RedialService();
