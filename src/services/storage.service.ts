import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { Call, CreateCallInput } from '../models/call.model';
import { CallStatus } from '../types/call.types';
import { logger } from '../utils/logger';

export interface CallRepository {
  create(data: CreateCallInput): Promise<Call>;
  findByCallId(callId: string): Promise<Call | null>;
  updateStatus(
    callId: string,
    status: CallStatus,
    error?: string,
    providerCallId?: string
  ): Promise<Call | null>;
  findRecentDuplicate(
    destination: string,
    content: string,
    windowSeconds: number
  ): Promise<Call | null>;
  listRecent(limit?: number): Promise<Call[]>;
  clearAll(): Promise<void>;
}

class JsonFileCallRepository implements CallRepository {
  private memoryStore = new Map<string, Call>();
  private filePath: string;
  private isPersisting = false;

  constructor() {
    const dataDir = path.join(process.cwd(), 'data');
    try {
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
    } catch {
      // Ignore if directory cannot be created in restricted envs
    }

    this.filePath = path.join(dataDir, 'calls.json');
    this.loadFromDisk();
  }

  private loadFromDisk() {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const parsed: Call[] = JSON.parse(raw);
        for (const item of parsed) {
          this.memoryStore.set(item.call_id, item);
        }
        logger.info(`Loaded ${parsed.length} call records from storage cache`);
      }
    } catch (err) {
      logger.warn('Could not load persistent storage from disk, starting in-memory store', {
        error: String(err),
      });
    }
  }

  private persistToDisk() {
    if (this.isPersisting) return;
    this.isPersisting = true;

    // Async write
    setImmediate(() => {
      try {
        const records = Array.from(this.memoryStore.values());
        fs.writeFileSync(this.filePath, JSON.stringify(records, null, 2), 'utf-8');
      } catch (err) {
        // Safe failover to memory-only
      } finally {
        this.isPersisting = false;
      }
    });
  }

  async create(data: CreateCallInput): Promise<Call> {
    const now = new Date().toISOString();
    const record: Call = {
      id: crypto.randomUUID(),
      call_id: data.call_id,
      destination: data.destination,
      content: data.content,
      reason: data.reason,
      status: data.status,
      provider_call_id: data.provider_call_id,
      error: data.error,
      created_at: now,
      updated_at: now,
    };

    this.memoryStore.set(record.call_id, record);
    this.persistToDisk();
    return record;
  }

  async findByCallId(callId: string): Promise<Call | null> {
    return this.memoryStore.get(callId) || null;
  }

  async updateStatus(
    callId: string,
    status: CallStatus,
    error?: string,
    providerCallId?: string
  ): Promise<Call | null> {
    const existing = this.memoryStore.get(callId);
    if (!existing) return null;

    existing.status = status;
    existing.updated_at = new Date().toISOString();
    if (error !== undefined) {
      existing.error = error;
    }
    if (providerCallId !== undefined) {
      existing.provider_call_id = providerCallId;
    }

    this.memoryStore.set(callId, existing);
    this.persistToDisk();
    return existing;
  }

  async findRecentDuplicate(
    destination: string,
    content: string,
    windowSeconds: number
  ): Promise<Call | null> {
    const thresholdMs = Date.now() - windowSeconds * 1000;

    for (const call of this.memoryStore.values()) {
      if (
        call.destination === destination &&
        call.content === content &&
        new Date(call.created_at).getTime() >= thresholdMs
      ) {
        return call;
      }
    }

    return null;
  }

  async listRecent(limit: number = 50): Promise<Call[]> {
    const items = Array.from(this.memoryStore.values());
    items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return items.slice(0, limit);
  }

  async clearAll(): Promise<void> {
    this.memoryStore.clear();
    this.persistToDisk();
  }
}

export const callRepository: CallRepository = new JsonFileCallRepository();
