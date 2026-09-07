import crypto from 'crypto';
import { config } from '../config';
import { CallStatus, InitiateCallPayload } from '../types/call.types';
import { TelephonyError } from '../types/provider.types';
import { Call } from '../models/call.model';
import { callRepository, CallRepository } from './storage.service';
import { getTelephonyProvider, TelephonyProvider } from '../providers';
import { logger } from '../utils/logger';

export interface InitiateCallServiceResult {
  success: boolean;
  call_id: string;
  status: CallStatus;
  message: string;
  error?: string;
  statusCode: number;
}

export class CallService {
  constructor(
    private repository: CallRepository = callRepository,
    private providerFactory: () => TelephonyProvider = getTelephonyProvider
  ) {}

  /**
   * Initiates an outbound phone call.
   */
  async initiateCall(
    payload: InitiateCallPayload,
    idempotencyKey?: string,
    options?: { isRetry?: boolean; redialTaskId?: string }
  ): Promise<InitiateCallServiceResult> {
    const { destination, content, reason } = payload;
    const provider = this.providerFactory();

    // 1. Duplicate & Idempotency check
    if (idempotencyKey) {
      const existingByIdempotency = await this.repository.findByCallId(idempotencyKey);
      if (existingByIdempotency) {
        logger.info(`Returning existing call for idempotency key: ${idempotencyKey}`);
        return {
          success: existingByIdempotency.status !== CallStatus.FAILED,
          call_id: existingByIdempotency.call_id,
          status: existingByIdempotency.status,
          message: 'Call retrieved from idempotency key',
          statusCode: 200,
        };
      }
    }

    // Check duplicate call window for identical destination & content (bypass if isRetry)
    if (!options?.isRetry) {
      const duplicateWindow = config.duplicateProtection.windowSeconds;
      const recentDuplicate = await this.repository.findRecentDuplicate(
        destination,
        content,
        duplicateWindow
      );

      if (recentDuplicate) {
        logger.warn(`Duplicate call blocked for destination ${destination} within ${duplicateWindow}s`);
        const err = new TelephonyError(
          'DUPLICATE_REQUEST',
          `A call to destination ${destination} with identical content was initiated within the last ${duplicateWindow} seconds.`,
          409,
          { existing_call_id: recentDuplicate.call_id }
        );
        throw err;
      }
    }

    // 2. Generate unique Call ID
    const callId = idempotencyKey || `call_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;

    // 3. Persist initial initiating record
    await this.repository.create({
      call_id: callId,
      destination,
      content,
      reason,
      status: CallStatus.INITIATING,
    });

    // 4. Invoke Telephony Provider with timeout safeguard
    try {
      const timeoutMs = config.callTimeoutMs;
      const callPromise = provider.initiateCall({
        destination,
        content,
        reason,
        callId,
      });

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(
            new TelephonyError(
              'PROVIDER_TIMEOUT',
              'The telephony provider did not respond within the configured timeout',
              504
            )
          );
        }, timeoutMs);
      });

      const result = await Promise.race([callPromise, timeoutPromise]);

      if (result.success) {
        await this.repository.updateStatus(
          callId,
          result.status,
          undefined,
          result.providerCallId
        );

        logger.info(`Call successfully initiated: ${callId}`, {
          callId,
          providerCallId: result.providerCallId,
          status: result.status,
        });

        return {
          success: true,
          call_id: callId,
          status: result.status,
          message: result.message || 'Call initiated successfully',
          statusCode: 200,
        };
      } else {
        // Provider reported failure (e.g. busy, rejected)
        const failureStatus = result.status || CallStatus.FAILED;
        const failureError = result.error || 'CALL_FAILED';
        const failureMsg = result.message || 'Unable to initiate the call';

        await this.repository.updateStatus(
          callId,
          failureStatus,
          failureMsg,
          result.providerCallId
        );

        return {
          success: false,
          call_id: callId,
          status: failureStatus,
          error: failureError,
          message: failureMsg,
          statusCode: failureStatus === CallStatus.BUSY ? 486 : 400,
        };
      }
    } catch (err: unknown) {
      const isTelephonyError = err instanceof TelephonyError;
      const errorCode = isTelephonyError ? err.code : 'CALL_FAILED';
      const errorMessage = isTelephonyError ? err.message : 'Unable to initiate the call';
      const statusCode = isTelephonyError ? err.statusCode : 500;

      await this.repository.updateStatus(callId, CallStatus.FAILED, errorMessage);

      logger.error(`Call failed for ${callId}: ${errorMessage}`, {
        callId,
        errorCode,
        statusCode,
      });

      throw new TelephonyError(errorCode, errorMessage, statusCode, { call_id: callId });
    }
  }

  /**
   * Retrieves status for a given call_id.
   */
  async getCallStatus(callId: string): Promise<Call> {
    const record = await this.repository.findByCallId(callId);
    if (!record) {
      throw new TelephonyError('CALL_NOT_FOUND', `Call record with ID '${callId}' was not found.`, 404);
    }

    // If call has a provider call ID and is not already in a terminal state, query provider
    const terminalStates = [CallStatus.COMPLETED, CallStatus.FAILED, CallStatus.REJECTED, CallStatus.TIMEOUT];
    if (record.provider_call_id && !terminalStates.includes(record.status)) {
      try {
        const provider = this.providerFactory();
        const liveStatus = await provider.getCallStatus(record.provider_call_id);
        if (liveStatus && liveStatus.status !== record.status) {
          const updated = await this.repository.updateStatus(callId, liveStatus.status);
          if (updated) return updated;
        }
      } catch (err) {
        logger.warn(`Could not refresh live status from provider for call ${callId}`, {
          error: String(err),
        });
      }
    }

    return record;
  }

  /**
   * Lists recent call history (useful for dashboard / test console)
   */
  async listRecentCalls(limit: number = 30): Promise<Call[]> {
    return this.repository.listRecent(limit);
  }
}

export const callService = new CallService();
