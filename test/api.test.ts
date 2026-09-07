import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp } from '../src/app';
import { config } from '../src/config';
import { resetRateLimits } from '../src/middleware/rateLimit.middleware';
import { callRepository } from '../src/services/storage.service';

let server: http.Server;
let baseUrl: string;
const validToken = config.apiAuthToken;

before(async () => {
  const app = createApp();
  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (typeof addr === 'object' && addr) {
        baseUrl = `http://127.0.0.1:${addr.port}`;
      }
      resolve();
    });
  });
});

beforeEach(async () => {
  await callRepository.clearAll();
  resetRateLimits();
});

after(async () => {
  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
});

describe('1. Health Endpoint (GET /api/health)', () => {
  test('should return 200 with status ok and service name without authentication', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.equal(res.status, 200);

    const data = await res.json();
    assert.deepEqual(data, {
      status: 'ok',
      service: 'call-api',
    });
  });
});

describe('2. Authentication Middleware', () => {
  test('should reject request missing Authorization header with 401', async () => {
    const res = await fetch(`${baseUrl}/api/call`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        destination: '+8801712345678',
        content: 'Alert test',
      }),
    });

    assert.equal(res.status, 401);
    const data = await res.json();
    assert.equal(data.success, false);
    assert.equal(data.error, 'UNAUTHORIZED');
    assert.equal(data.message, 'Invalid or missing authentication token');
  });

  test('should reject request with invalid Bearer token with 401', async () => {
    const res = await fetch(`${baseUrl}/api/call`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer invalid_secret_token',
      },
      body: JSON.stringify({
        destination: '+8801712345678',
        content: 'Alert test',
      }),
    });

    assert.equal(res.status, 401);
    const data = await res.json();
    assert.equal(data.success, false);
    assert.equal(data.error, 'UNAUTHORIZED');
  });
});

describe('3. Validation Middleware (POST /api/call)', () => {
  test('should reject missing destination with 400 VALIDATION_ERROR', async () => {
    const res = await fetch(`${baseUrl}/api/call`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${validToken}`,
      },
      body: JSON.stringify({
        content: 'Valid content here',
      }),
    });

    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.success, false);
    assert.equal(data.error, 'VALIDATION_ERROR');
    assert.match(data.message, /destination/i);
  });

  test('should reject non-international destination with 400 VALIDATION_ERROR', async () => {
    const res = await fetch(`${baseUrl}/api/call`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${validToken}`,
      },
      body: JSON.stringify({
        destination: '01712345678', // missing '+'
        content: 'Valid content',
      }),
    });

    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.success, false);
    assert.equal(data.error, 'VALIDATION_ERROR');
    assert.match(data.message, /invalid international destination/i);
  });

  test('should reject missing content with 400 VALIDATION_ERROR', async () => {
    const res = await fetch(`${baseUrl}/api/call`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${validToken}`,
      },
      body: JSON.stringify({
        destination: '+8801712345678',
      }),
    });

    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.success, false);
    assert.equal(data.error, 'VALIDATION_ERROR');
    assert.match(data.message, /content/i);
  });

  test('should reject empty content with 400 VALIDATION_ERROR', async () => {
    const res = await fetch(`${baseUrl}/api/call`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${validToken}`,
      },
      body: JSON.stringify({
        destination: '+8801712345678',
        content: '   ',
      }),
    });

    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.success, false);
    assert.equal(data.error, 'VALIDATION_ERROR');
  });
});

describe('4. Open-Ended Content Support (POST /api/call)', () => {
  const diverseContents = [
    { label: 'Single keyword', content: 'URGENT' },
    { label: 'Short notification', content: 'New client message received' },
    { label: 'Full URL', content: 'https://security.example.com/alerts/incident-409' },
    { label: 'Domain name', content: 'example.com' },
    {
      label: 'Multi-sentence security incident',
      content:
        'CRITICAL: Security incident detected in production environment. Database replica latency exceeded threshold. Immediate intervention required.',
    },
    { label: 'Special characters and emojis', content: 'Alert [Node #42] [Status: CRITICAL] & [Retry=3]' },
  ];

  for (const item of diverseContents) {
    test(`should accept open-ended content: ${item.label}`, async () => {
      // Use unique phone numbers to avoid duplicate detection during tests
      const randomSuffix = Math.floor(100000 + Math.random() * 900000);
      const destination = `+880171${randomSuffix}`;

      const res = await fetch(`${baseUrl}/api/call`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${validToken}`,
        },
        body: JSON.stringify({
          destination,
          content: item.content,
          reason: 'DIVERSE_CONTENT_TEST',
        }),
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.ok(data.call_id);
      assert.equal(data.status, 'initiated');
      assert.equal(data.message, 'Call initiated successfully');
    });
  }
});

describe('5. Test Call Endpoint (POST /api/test-call)', () => {
  test('should initiate test call with valid destination', async () => {
    const res = await fetch(`${baseUrl}/api/test-call`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${validToken}`,
      },
      body: JSON.stringify({
        destination: '+8801999123456',
      }),
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(data.call_id);
    assert.equal(data.status, 'initiated');
  });
});

describe('6. Call Status Endpoint (GET /api/call/:call_id)', () => {
  test('should return 404 for non-existent call_id', async () => {
    const res = await fetch(`${baseUrl}/api/call/non_existent_call_id_99999`, {
      headers: {
        Authorization: `Bearer ${validToken}`,
      },
    });

    assert.equal(res.status, 404);
    const data = await res.json();
    assert.equal(data.success, false);
    assert.equal(data.error, 'CALL_NOT_FOUND');
  });

  test('should return status for previously created call', async () => {
    // 1. Create a call
    const createRes = await fetch(`${baseUrl}/api/call`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${validToken}`,
      },
      body: JSON.stringify({
        destination: '+8801812349988',
        content: 'Status check verification',
        reason: 'STATUS_TEST',
      }),
    });

    const createData = await createRes.json();
    const callId = createData.call_id;
    assert.ok(callId);

    // 2. Query status
    const statusRes = await fetch(`${baseUrl}/api/call/${callId}`, {
      headers: {
        Authorization: `Bearer ${validToken}`,
      },
    });

    assert.equal(statusRes.status, 200);
    const statusData = await statusRes.json();
    assert.equal(statusData.success, true);
    assert.equal(statusData.call_id, callId);
    assert.ok(['initiated', 'ringing', 'answered', 'completed'].includes(statusData.status));
  });
});

describe('7. Duplicate Call & Idempotency Protection', () => {
  test('should block immediate identical call within duplicate window', async () => {
    const destination = '+8801555123999';
    const content = 'Duplicate protection test string';

    // First call: Success
    const res1 = await fetch(`${baseUrl}/api/call`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${validToken}`,
      },
      body: JSON.stringify({ destination, content }),
    });
    assert.equal(res1.status, 200);

    // Immediate second call: Rejected with 409
    const res2 = await fetch(`${baseUrl}/api/call`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${validToken}`,
      },
      body: JSON.stringify({ destination, content }),
    });

    assert.equal(res2.status, 409);
    const data2 = await res2.json();
    assert.equal(data2.success, false);
    assert.equal(data2.error, 'DUPLICATE_REQUEST');
  });

  test('should support Idempotency-Key safely', async () => {
    const idempotencyKey = `idemp_key_${Date.now()}`;
    const destination = '+8801333777888';
    const content = 'Idempotent request check';

    // First request
    const res1 = await fetch(`${baseUrl}/api/call`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${validToken}`,
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({ destination, content }),
    });

    assert.equal(res1.status, 200);
    const data1 = await res1.json();
    assert.equal(data1.call_id, idempotencyKey);

    // Repeated request with same Idempotency-Key
    const res2 = await fetch(`${baseUrl}/api/call`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${validToken}`,
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({ destination, content }),
    });

    assert.equal(res2.status, 200);
    const data2 = await res2.json();
    assert.equal(data2.call_id, idempotencyKey);
  });
});

describe('8. Provider Failure Simulation (Mock Provider)', () => {
  test('should simulate call rejection when destination ends with 0000', async () => {
    const res = await fetch(`${baseUrl}/api/call`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${validToken}`,
      },
      body: JSON.stringify({
        destination: '+8801700000000',
        content: 'Simulate rejected call',
      }),
    });

    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.success, false);
    assert.equal(data.error, 'CALL_REJECTED');
  });

  test('should simulate SIP connection failure when destination ends with 5000', async () => {
    const res = await fetch(`${baseUrl}/api/call`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${validToken}`,
      },
      body: JSON.stringify({
        destination: '+8801700005000',
        content: 'Simulate connection failure',
      }),
    });

    assert.equal(res.status, 502);
    const data = await res.json();
    assert.equal(data.success, false);
    assert.equal(data.error, 'SIP_CONNECTION_FAILURE');
  });
});

describe('9. Rate Limiting Protection', () => {
  test('should enforce rate limit when rapid threshold exceeded', async () => {
    resetRateLimits();

    const max = config.rateLimit.max;
    let rateLimitedResponse: Response | null = null;

    // Send max + 2 calls
    for (let i = 0; i < max + 2; i++) {
      const res = await fetch(`${baseUrl}/api/call`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${validToken}`,
        },
        body: JSON.stringify({
          destination: `+880171${100000 + i}`,
          content: `Rate limit burst test ${i}`,
        }),
      });

      if (res.status === 429) {
        rateLimitedResponse = res;
        break;
      }
    }

    assert.ok(rateLimitedResponse, 'Expected a 429 Rate Limit Exceeded response');
    const data = await rateLimitedResponse.json();
    assert.equal(data.success, false);
    assert.equal(data.error, 'RATE_LIMIT_EXCEEDED');
  });
});
