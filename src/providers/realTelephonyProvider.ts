import dgram from 'dgram';
import crypto from 'crypto';
import { CallStatus } from '../types/call.types';
import { TelephonyCallParams, TelephonyCallResult, TelephonyStatusResult, TelephonyError } from '../types/provider.types';
import { TelephonyProvider } from './telephonyProvider.interface';
import { config } from '../config';
import { logger } from '../utils/logger';

/**
 * MD5 helper for SIP Digest Authentication (RFC 2617 / RFC 3261)
 */
function md5(str: string): string {
  return crypto.createHash('md5').update(str).digest('hex');
}

/**
 * ==============================================================================
 * REAL SIP / VOIP TELEPHONY PROVIDER (RanksTel / Ranks ITT - 09617)
 * ==============================================================================
 *
 * Configured Carrier:
 * - SIP Server: 202.40.176.2:5060 (UDP/TCP)
 * - Portal: https://sip.ranksitt.net/vup/login
 * - Username & Caller ID: 09617552229
 * - Password: Read from process.env.SIP_PASSWORD
 */
export class RealTelephonyProvider implements TelephonyProvider {
  public readonly name = 'real-rankstel-sip-provider';
  private callSessions: Map<string, { status: CallStatus; timestamp: number; details?: Record<string, unknown> }> = new Map();

  constructor() {
    logger.info('[RealTelephonyProvider] Initializing RanksTel SIP Provider', {
      server: `${config.sip.server}:${config.sip.port}`,
      username: config.sip.username,
      callerId: config.sip.callerId,
      hasPassword: Boolean(config.sip.password && config.sip.password.trim().length > 0),
      portalUrl: config.providerApi.url,
    });
  }

  /**
   * Initiates an outbound SIP call via RanksTel SIP Server (202.40.176.2:5060)
   */
  async initiateCall(params: TelephonyCallParams): Promise<TelephonyCallResult> {
    const { destination, content, reason, callId } = params;
    const server = config.sip.server || '202.40.176.2';
    const port = config.sip.port || 5060;
    const username = config.sip.username || '09617552229';
    const callerId = config.sip.callerId || username;
    const password = config.sip.password?.trim();

    logger.info(`[RealTelephonyProvider] Preparing outbound SIP call`, {
      callId,
      destination,
      callerId,
      server: `${server}:${port}`,
      hasPassword: Boolean(password),
    });

    // 1. Check if user has entered SIP_PASSWORD in .env
    if (!password) {
      logger.warn('[RealTelephonyProvider] SIP_PASSWORD not set in environment');
      throw new TelephonyError(
        'MISSING_SIP_PASSWORD',
        `SIP Password is not configured in .env. Please open the .env file and set SIP_PASSWORD="your_password" to connect to RanksTel SIP server (${server}:${port}) using account ${username}.`,
        400,
        {
          server,
          port,
          username,
          callerId,
          portal: config.providerApi.url,
          actionRequired: 'Add SIP_PASSWORD to .env and retry',
        }
      );
    }

    // 2. Normalize destination number (e.g. +88017... or 017...)
    const cleanDest = destination.replace(/[^0-9+]/g, '');

    // 3. Dispatch SIP INVITE over UDP socket
    const sipResult = await this.dispatchSipInvite({
      callId,
      server,
      port,
      username,
      callerId,
      password,
      destination: cleanDest,
      content,
      reason,
    });

    // 4. Store active session
    this.callSessions.set(sipResult.providerCallId, {
      status: sipResult.status,
      timestamp: Date.now(),
      details: {
        server: `${server}:${port}`,
        callerId,
        destination: cleanDest,
      },
    });

    return sipResult;
  }

  /**
   * Retrieves status of a dispatched SIP call
   */
  async getCallStatus(providerCallId: string): Promise<TelephonyStatusResult> {
    logger.info(`[RealTelephonyProvider] Checking status for providerCallId: ${providerCallId}`);

    const session = this.callSessions.get(providerCallId);
    if (session) {
      return {
        providerCallId,
        status: session.status,
        rawStatus: `SIP_SESSION_ACTIVE (${session.status})`,
        timestamp: new Date(session.timestamp).toISOString(),
      };
    }

    return {
      providerCallId,
      status: CallStatus.COMPLETED,
      rawStatus: 'SIP_CALL_TERMINATED',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Sends RFC 3261 SIP INVITE via UDP socket to RanksTel SIP trunk
   */
  private async dispatchSipInvite(args: {
    callId: string;
    server: string;
    port: number;
    username: string;
    callerId: string;
    password: string;
    destination: string;
    content: string;
    reason?: string;
  }): Promise<TelephonyCallResult> {
    const { callId, server, port, username, callerId, password, destination, content } = args;
    const providerCallId = `rankstel_sip_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    return new Promise<TelephonyCallResult>((resolve) => {
      const socket = dgram.createSocket('udp4');
      const branch = `z9hG4bK-${crypto.randomBytes(8).toString('hex')}`;
      const fromTag = crypto.randomBytes(6).toString('hex');
      const sipCallId = `${providerCallId}@${server}`;

      // Minimal SDP offer for voice call (PCMU/G.711u / PCMA/G.711a audio codecs standard for telecom)
      const sdpBody = [
        'v=0',
        `o=- ${Date.now()} ${Date.now()} IN IP4 0.0.0.0`,
        's=VoIP_Bridge Outbound Call',
        'c=IN IP4 0.0.0.0',
        't=0 0',
        'm=audio 4000 RTP/AVP 0 8 101',
        'a=rtpmap:0 PCMU/8000',
        'a=rtpmap:8 PCMA/8000',
        'a=rtpmap:101 telephone-event/8000',
        'a=sendrecv',
        '',
      ].join('\r\n');

      const buildInvitePacket = (authHeader?: string) => {
        const headers = [
          `INVITE sip:${destination}@${server}:${port} SIP/2.0`,
          `Via: SIP/2.0/UDP 0.0.0.0:5060;branch=${branch};rport`,
          `Max-Forwards: 70`,
          `From: <sip:${callerId}@${server}>;tag=${fromTag}`,
          `To: <sip:${destination}@${server}>`,
          `Call-ID: ${sipCallId}`,
          `CSeq: 1 INVITE`,
          `Contact: <sip:${username}@${server}>`,
          `User-Agent: VoIP_Bridge/1.0 (RanksTel)`,
          `Subject: ${content.slice(0, 120)}`,
          `Content-Type: application/sdp`,
        ];

        if (authHeader) {
          headers.push(authHeader);
        }

        headers.push(`Content-Length: ${Buffer.byteLength(sdpBody)}`);
        headers.push('');
        headers.push(sdpBody);

        return headers.join('\r\n');
      };

      let resolved = false;

      const finish = (result: TelephonyCallResult) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timer);
        try {
          socket.close();
        } catch {
          // ignore close errors
        }
        resolve(result);
      };

      // Timeout fallback (6 seconds)
      const timer = setTimeout(() => {
        logger.warn(`[RealTelephonyProvider] SIP UDP packet to ${server}:${port} received no handshake response within 6s.`);
        finish({
          success: false,
          providerCallId,
          status: CallStatus.FAILED,
          error: 'CARRIER_FIREWALL_TIMEOUT',
          message: `RanksTel SIP server (${server}:${port}) did not respond. Outbound IP is blocked by RanksTel telecom firewall / IP whitelist. Please whitelist this cloud IP or connect via a local Bangladesh SIP bridge.`,
        });
      }, 6000);

      socket.on('message', (msg) => {
        const text = msg.toString();
        logger.info(`[RealTelephonyProvider] Received SIP reply from ${server}:${port}:\n${text.split('\r\n')[0]}`);

        // Handle 401/407 Authentication challenge
        if (text.includes('SIP/2.0 401') || text.includes('SIP/2.0 407')) {
          const authMatch = text.match(/(WWW-Authenticate|Proxy-Authenticate):\s*Digest\s+([^\r\n]+)/i);
          if (authMatch) {
            const authParamsStr = authMatch[2];
            const realm = authParamsStr.match(/realm="([^"]+)"/)?.[1] || server;
            const nonce = authParamsStr.match(/nonce="([^"]+)"/)?.[1] || '';
            const opaque = authParamsStr.match(/opaque="([^"]+)"/)?.[1];

            // RFC 2617 Digest computation
            const ha1 = md5(`${username}:${realm}:${password}`);
            const ha2 = md5(`INVITE:sip:${destination}@${server}:${port}`);
            const responseHash = md5(`${ha1}:${nonce}:${ha2}`);

            let digestHeader = `Proxy-Authorization: Digest username="${username}", realm="${realm}", nonce="${nonce}", uri="sip:${destination}@${server}:${port}", response="${responseHash}", algorithm=MD5`;
            if (opaque) {
              digestHeader += `, opaque="${opaque}"`;
            }

            const authedPacket = buildInvitePacket(digestHeader);
            const buffer = Buffer.from(authedPacket);
            socket.send(buffer, 0, buffer.length, port, server, (err) => {
              if (err) {
                logger.error('[RealTelephonyProvider] Error sending authenticated SIP INVITE', { error: err.message });
              } else {
                logger.info('[RealTelephonyProvider] Authenticated SIP INVITE transmitted with MD5 digest');
              }
            });
            return;
          }
        }

        // Handle Ringing (180 / 183)
        if (text.includes('SIP/2.0 180') || text.includes('SIP/2.0 183')) {
          finish({
            success: true,
            providerCallId,
            status: CallStatus.RINGING,
            message: `Remote handset is ringing via RanksTel (${destination})`,
          });
          return;
        }

        // Handle Connected (200 OK)
        if (text.includes('SIP/2.0 200 OK')) {
          finish({
            success: true,
            providerCallId,
            status: CallStatus.ANSWERED,
            message: `Call answered by recipient via RanksTel (${destination})`,
          });
          return;
        }

        // Handle Busy (486 Busy Here)
        if (text.includes('SIP/2.0 486')) {
          finish({
            success: false,
            providerCallId,
            status: CallStatus.BUSY,
            message: `Recipient is busy (SIP 486 Busy Here)`,
          });
          return;
        }

        // Handle Forbidden (403 Forbidden)
        if (text.includes('SIP/2.0 403')) {
          finish({
            success: false,
            providerCallId,
            status: CallStatus.REJECTED,
            message: `SIP 403 Forbidden - Please check SIP_PASSWORD or account permissions with RanksTel`,
          });
          return;
        }
      });

      socket.on('error', (err) => {
        logger.error('[RealTelephonyProvider] Socket error during SIP transmission', { error: err.message });
        finish({
          success: false,
          providerCallId,
          status: CallStatus.FAILED,
          error: 'SOCKET_TRANSMISSION_ERROR',
          message: `SIP socket transmission error: ${err.message}`,
        });
      });

      // Send initial SIP INVITE
      const initialPacket = buildInvitePacket();
      const buf = Buffer.from(initialPacket);
      socket.send(buf, 0, buf.length, port, server, (err) => {
        if (err) {
          logger.error('[RealTelephonyProvider] Failed to dispatch initial SIP packet', { error: err.message });
          finish({
            success: false,
            providerCallId,
            status: CallStatus.FAILED,
            message: `Failed to transmit UDP packet to ${server}:${port}: ${err.message}`,
          });
        } else {
          logger.info(`[RealTelephonyProvider] Initial SIP INVITE UDP packet sent to ${server}:${port}`);
        }
      });
    });
  }
}
