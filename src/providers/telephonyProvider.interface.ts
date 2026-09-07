import { TelephonyCallParams, TelephonyCallResult, TelephonyStatusResult } from '../types/provider.types';

/**
 * Universal Telephony Provider Interface.
 *
 * All telephony providers (whether Mock, SIP PBX, FreeSWITCH, Asterisk,
 * or custom VoIP REST gateways) must implement this interface.
 * The core API routes and controllers interact ONLY with this interface.
 */
export interface TelephonyProvider {
  /**
   * Human-readable name/identifier of this provider (e.g. 'mock-telephony', 'real-sip-telephony')
   */
  readonly name: string;

  /**
   * Initiates an outbound phone call to the destination.
   *
   * @param params Parameters containing destination, open-ended content, optional reason, and internal callId
   * @returns TelephonyCallResult with providerCallId, status, and status message
   */
  initiateCall(params: TelephonyCallParams): Promise<TelephonyCallResult>;

  /**
   * Queries the live or final call status from the telephony provider.
   *
   * @param providerCallId Unique call identifier assigned by the provider
   * @returns TelephonyStatusResult with the current CallStatus
   */
  getCallStatus(providerCallId: string): Promise<TelephonyStatusResult>;
}
