import { CallStatus } from '../types/call.types';

export interface Call {
  id: string;
  call_id: string;
  destination: string;
  content: string;
  reason?: string;
  status: CallStatus;
  provider_call_id?: string;
  error?: string;
  created_at: string;
  updated_at: string;
}

export type CreateCallInput = Omit<Call, 'id' | 'created_at' | 'updated_at'>;
