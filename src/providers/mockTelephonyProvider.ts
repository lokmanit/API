import crypto from 'crypto';
import { CallStatus } from '../types/call.types';
import { TelephonyCallParams, TelephonyCallResult, TelephonyStatusResult, TelephonyError } from '../types/provider.types';
import { TelephonyProvider } from './telephonyProvider.interface';
import { logger } from '../utils/logger';

interface MockCallRecord {
  providerCallId: string;
  internalCallId: string;
  destination: string;
  content: string;
  reason?: string;
  createdAt: number;
  initialStatus: CallStatus;
  scenario: 'normal' | 'busy' | 'rejected' | 'timeout' | 'unavailable' | 'unanswered';
}

/**
 * MockTelephonyProvider
 *
 * Simulates a SIP/VoIP telephony provider for development, testing,
 * and staging environments without dialing real carrier networks.
 *
 * Simulation Scenarios (driven by destination number patterns or programmatic flags):
 * - Standard number (e.g. +8801712345678): Progresses from initiated -> ringing -> answered -> completed
 * - Destination ending in '0000': Simulates BUSY / REJECTED carrier response
 * - Destination ending in '5000': Simulates SIP_CONNECTION_FAILURE / PROVIDER_UNAVAILABLE
 * - Destination ending in '9999': Simulates PROVIDER_TIMEOUT (hangs longer than configured timeout)
 */
export class MockTelephonyProvider implements TelephonyProvider {
  public readonly name = 'mock-telephony-provider';
  private calls = new Map<string, MockCallRecord>();

  /**
   * Optional manual override map for unit test control
   */
  private testOverrides = new Map<string, { status: CallStatus; error?: TelephonyError }>();

  public setTestOverride(destinationPattern: string, override: { status: CallStatus; error?: TelephonyError }) {
    this.testOverrides.set(destinationPattern, override);
  }

  public clearTestOverrides() {
    this.testOverrides.clear();
  }

  async initiateCall(params: TelephonyCallParams): Promise<TelephonyCallResult> {
    logger.info(`[MockProvider] Initiating call to destination: ${params.destination}`, {
      callId: params.callId,
      destination: params.destination,
      contentLength: params.content.length,
      reason: params.reason,
    });

    // Check test overrides
    for (const [pattern, override] of this.testOverrides.entries()) {
      if (params.destination.includes(pattern)) {
        if (override.error) {
          throw override.error;
        }
        const providerCallId = `mock_override_${crypto.randomUUID().slice(0, 8)}`;
        return {
          success: override.status !== CallStatus.FAILED && override.status !== CallStatus.REJECTED,
          providerCallId,
          status: override.status,
          message: `Mock override response: ${override.status}`,
        };
      }
    }

    // Special test destination patterns:
    // 1. Timeout simulation: ends with 9999
    if (params.destination.endsWith('9999')) {
      logger.warn(`[MockProvider] Simulating provider timeout for destination: ${params.destination}`);
      // Sleep for 15 seconds to trigger caller timeout handler
      await new Promise((resolve) => setTimeout(resolve, 15000));
      throw new TelephonyError(
        'PROVIDER_TIMEOUT',
        'Telephony provider SIP trunk gateway timed out waiting for ACK',
        504
      );
    }

    // 2. Provider unavailable / SIP connection error: ends with 5000
    if (params.destination.endsWith('5000')) {
      logger.error(`[MockProvider] Simulating SIP trunk connection failure`);
      throw new TelephonyError(
        'SIP_CONNECTION_FAILURE',
        'Could not establish SIP handshake with upstream SIP proxy: Connection refused',
        502
      );
    }

    // 3. Destination busy: ends with 4444
    if (params.destination.endsWith('4444')) {
      const providerCallId = `mock_busy_${crypto.randomUUID().slice(0, 8)}`;
      this.calls.set(providerCallId, {
        providerCallId,
        internalCallId: params.callId,
        destination: params.destination,
        content: params.content,
        reason: params.reason,
        createdAt: Date.now(),
        initialStatus: CallStatus.BUSY,
        scenario: 'busy',
      });
      return {
        success: false,
        providerCallId,
        status: CallStatus.BUSY,
        error: 'DESTINATION_BUSY',
        message: 'Destination user is currently busy / line engaged',
      };
    }

    // 4. Call rejected: ends with 0000
    if (params.destination.endsWith('0000')) {
      const providerCallId = `mock_rej_${crypto.randomUUID().slice(0, 8)}`;
      this.calls.set(providerCallId, {
        providerCallId,
        internalCallId: params.callId,
        destination: params.destination,
        content: params.content,
        reason: params.reason,
        createdAt: Date.now(),
        initialStatus: CallStatus.REJECTED,
        scenario: 'rejected',
      });
      return {
        success: false,
        providerCallId,
        status: CallStatus.REJECTED,
        error: 'CALL_REJECTED',
        message: 'Call rejected by recipient carrier with SIP 603 Decline',
      };
    }

    // 5. Unanswered / Ring Timeout simulation: ends with 7777 or flagged
    const isUnansweredSim = params.destination.endsWith('7777') || params.reason === 'SIMULATE_UNANSWERED';
    if (isUnansweredSim) {
      const providerCallId = `mock_unans_${crypto.randomUUID().slice(0, 8)}`;
      this.calls.set(providerCallId, {
        providerCallId,
        internalCallId: params.callId,
        destination: params.destination,
        content: params.content,
        reason: params.reason,
        createdAt: Date.now(),
        initialStatus: CallStatus.INITIATED,
        scenario: 'unanswered',
      });
      return {
        success: true,
        providerCallId,
        status: CallStatus.INITIATED,
        message: 'Mock call initiated - simulating ring timeout / no answer',
      };
    }

    // Normal successful initiation simulation
    // Add realistic 50-150ms network delay
    await new Promise((resolve) => setTimeout(resolve, 80));

    const providerCallId = `mock_sip_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;

    this.calls.set(providerCallId, {
      providerCallId,
      internalCallId: params.callId,
      destination: params.destination,
      content: params.content,
      reason: params.reason,
      createdAt: Date.now(),
      initialStatus: CallStatus.INITIATED,
      scenario: 'normal',
    });

    logger.info(`[MockProvider] Call successfully initiated`, {
      providerCallId,
      destination: params.destination,
    });

    return {
      success: true,
      providerCallId,
      status: CallStatus.INITIATED,
      message: 'Call initiated successfully',
    };
  }

  async getCallStatus(providerCallId: string): Promise<TelephonyStatusResult> {
    const record = this.calls.get(providerCallId);

    if (!record) {
      // If provider ID is unknown, default to initiated or completed depending on format
      return {
        providerCallId,
        status: CallStatus.COMPLETED,
        rawStatus: 'SIP_200_OK',
        timestamp: new Date().toISOString(),
      };
    }

    // Calculate dynamic realistic status progression for 'normal' calls:
    // 0s - 3s: initiated
    // 3s - 7s: ringing
    // 7s - 15s: answered
    // > 15s: completed
    const elapsedMs = Date.now() - record.createdAt;

    let currentStatus = record.initialStatus;

    if (record.scenario === 'normal') {
      if (elapsedMs < 3000) {
        currentStatus = CallStatus.INITIATED;
      } else if (elapsedMs < 7000) {
        currentStatus = CallStatus.RINGING;
      } else if (elapsedMs < 15000) {
        currentStatus = CallStatus.ANSWERED;
      } else {
        currentStatus = CallStatus.COMPLETED;
      }
    } else if (record.scenario === 'unanswered') {
      if (elapsedMs < 2000) {
        currentStatus = CallStatus.INITIATED;
      } else if (elapsedMs < 7500) {
        currentStatus = CallStatus.RINGING;
      } else {
        currentStatus = CallStatus.TIMEOUT;
      }
    }

    return {
      providerCallId,
      status: currentStatus,
      rawStatus: `MOCK_${currentStatus.toUpperCase()}`,
      timestamp: new Date().toISOString(),
    };
  }
}
