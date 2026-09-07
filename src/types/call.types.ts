export enum CallStatus {
  PENDING = 'pending',
  INITIATING = 'initiating',
  INITIATED = 'initiated',
  RINGING = 'ringing',
  ANSWERED = 'answered',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REJECTED = 'rejected',
  BUSY = 'busy',
  TIMEOUT = 'timeout',
}

export interface InitiateCallPayload {
  destination: string;
  content: string;
  reason?: string;
  retryUntilAnswered?: boolean;
  retryIntervalSeconds?: number;
  maxAttempts?: number;
}

export interface TestCallPayload {
  destination: string;
}

export interface CallInitiateSuccessResponse {
  success: true;
  call_id: string;
  status: string;
  message: string;
  retryUntilAnswered?: boolean;
  redialTaskId?: string;
}

export interface TestCallSuccessResponse {
  success: true;
  call_id: string;
  status: string;
}

export interface CallStatusResponse {
  success: true;
  call_id: string;
  status: string;
  destination?: string;
  reason?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ApiErrorResponse {
  success: false;
  error: string;
  message: string;
  details?: unknown;
}

export interface HealthResponse {
  status: 'ok';
  service: 'call-api';
}
