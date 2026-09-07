import { CallStatus } from './call.types';

export interface TelephonyCallParams {
  destination: string;
  content: string;
  reason?: string;
  callId: string;
}

export interface TelephonyCallResult {
  success: boolean;
  providerCallId: string;
  status: CallStatus;
  message?: string;
  error?: string;
}

export interface TelephonyStatusResult {
  providerCallId: string;
  status: CallStatus;
  rawStatus?: string;
  timestamp?: string;
}

export class TelephonyError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(code: string, message: string, statusCode: number = 500, details?: unknown) {
    super(message);
    this.name = 'TelephonyError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}
