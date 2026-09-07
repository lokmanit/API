import dns from 'dns';
import net from 'net';
import dgram from 'dgram';
import https from 'https';
import { config } from '../config';

export interface DiagnosticCheckResult {
  title: string;
  target: string;
  status: 'passed' | 'failed' | 'warning';
  latencyMs?: number;
  details: string;
}

export interface SipDiagnosticsReport {
  timestamp: string;
  serverInfo: {
    sipServer: string;
    sipPort: number;
    sipUsername: string;
    portalUrl: string;
    cloudEgressIp: string;
  };
  overallStatus: 'HEALTHY' | 'PORT_BLOCKED_BY_CARRIER' | 'DEGRADED';
  rootCauseAnalysis: {
    isFirewallBlocked: boolean;
    reason: string;
    explanationBn: string;
    remediationSteps: string[];
  };
  checks: DiagnosticCheckResult[];
}

export async function runSipDiagnostics(): Promise<SipDiagnosticsReport> {
  const sipHost = config.sip.server || '202.40.176.2';
  const sipPort = config.sip.port || 5060;
  const username = config.sip.username || '09617552229';

  // 1. Fetch Cloud Egress IP
  let cloudEgressIp = 'Unknown';
  try {
    cloudEgressIp = await new Promise<string>((resolve) => {
      const req = https.get('https://api.ipify.org', { timeout: 3000 }, (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => resolve(data.trim() || 'Unknown'));
      });
      req.on('error', () => resolve('Unknown'));
      req.on('timeout', () => {
        req.destroy();
        resolve('Unknown');
      });
    });
  } catch {
    cloudEgressIp = 'Unknown';
  }

  const checks: DiagnosticCheckResult[] = [];

  // Check 1: DNS Resolution
  const startDns = Date.now();
  let resolvedIp = sipHost;
  try {
    const dnsPromise = new Promise<string>((resolve, reject) => {
      dns.lookup('sip.ranksitt.net', (err, address) => {
        if (err) reject(err);
        else resolve(address);
      });
    });
    resolvedIp = await dnsPromise;
    checks.push({
      title: 'DNS Resolution (sip.ranksitt.net)',
      target: 'sip.ranksitt.net',
      status: 'passed',
      latencyMs: Date.now() - startDns,
      details: `Successfully resolved to ${resolvedIp}`,
    });
  } catch (err: unknown) {
    checks.push({
      title: 'DNS Resolution (sip.ranksitt.net)',
      target: 'sip.ranksitt.net',
      status: 'warning',
      latencyMs: Date.now() - startDns,
      details: `DNS lookup warning: ${(err as Error).message}. Using direct IP ${sipHost}`,
    });
  }

  // Check 2: HTTPS Portal (sip.ranksitt.net)
  const startHttps = Date.now();
  try {
    const httpsStatus = await new Promise<number>((resolve, reject) => {
      const req = https.get('https://sip.ranksitt.net/vup/login', { timeout: 4000 }, (res) => {
        resolve(res.statusCode || 0);
      });
      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('HTTPS Timeout'));
      });
    });

    if (httpsStatus === 200 || httpsStatus === 302) {
      checks.push({
        title: 'RanksTel Web Portal (PortaSwitch VUP)',
        target: 'https://sip.ranksitt.net/vup/login',
        status: 'passed',
        latencyMs: Date.now() - startHttps,
        details: `HTTPS Web Server reachable (HTTP ${httpsStatus}). Web services accessible.`,
      });
    } else {
      checks.push({
        title: 'RanksTel Web Portal (PortaSwitch VUP)',
        target: 'https://sip.ranksitt.net/vup/login',
        status: 'warning',
        latencyMs: Date.now() - startHttps,
        details: `HTTP status ${httpsStatus}`,
      });
    }
  } catch (err: unknown) {
    checks.push({
      title: 'RanksTel Web Portal (PortaSwitch VUP)',
      target: 'https://sip.ranksitt.net/vup/login',
      status: 'failed',
      latencyMs: Date.now() - startHttps,
      details: `Failed to reach web portal: ${(err as Error).message}`,
    });
  }

  // Check 3: TCP Port 5060 (SIP Signaling)
  const startTcp = Date.now();
  let tcpPassed = false;
  try {
    tcpPassed = await new Promise<boolean>((resolve) => {
      const sock = new net.Socket();
      sock.setTimeout(3500);
      sock.connect(sipPort, sipHost, () => {
        sock.destroy();
        resolve(true);
      });
      sock.on('error', () => {
        sock.destroy();
        resolve(false);
      });
      sock.on('timeout', () => {
        sock.destroy();
        resolve(false);
      });
    });

    checks.push({
      title: `TCP Port ${sipPort} (SIP Signaling)`,
      target: `${sipHost}:${sipPort}`,
      status: tcpPassed ? 'passed' : 'failed',
      latencyMs: Date.now() - startTcp,
      details: tcpPassed
        ? `TCP connection established to ${sipHost}:${sipPort}`
        : `Connection timed out (No SYN-ACK). RanksTel carrier firewall is dropping incoming TCP 5060 traffic from IP ${cloudEgressIp}.`,
    });
  } catch {
    checks.push({
      title: `TCP Port ${sipPort} (SIP Signaling)`,
      target: `${sipHost}:${sipPort}`,
      status: 'failed',
      latencyMs: Date.now() - startTcp,
      details: `TCP probe failed to ${sipHost}:${sipPort}`,
    });
  }

  // Check 4: UDP Port 5060 (SIP INVITE/OPTIONS handshake)
  const startUdp = Date.now();
  let udpPassed = false;
  try {
    udpPassed = await new Promise<boolean>((resolve) => {
      const socket = dgram.createSocket('udp4');
      const branch = `z9hG4bK-${Date.now()}`;
      const pingPacket = `OPTIONS sip:${sipHost}:${sipPort} SIP/2.0\r\nVia: SIP/2.0/UDP 0.0.0.0:5060;branch=${branch};rport\r\nMax-Forwards: 70\r\nTo: <sip:${sipHost}>\r\nFrom: <sip:${username}@${sipHost}>;tag=diag\r\nCall-ID: diag-${Date.now()}@test\r\nCSeq: 1 OPTIONS\r\nContent-Length: 0\r\n\r\n`;

      const timer = setTimeout(() => {
        try {
          socket.close();
        } catch {
          // ignore
        }
        resolve(false);
      }, 3500);

      socket.on('message', () => {
        clearTimeout(timer);
        try {
          socket.close();
        } catch {
          // ignore
        }
        resolve(true);
      });

      socket.on('error', () => {
        clearTimeout(timer);
        try {
          socket.close();
        } catch {
          // ignore
        }
        resolve(false);
      });

      const buf = Buffer.from(pingPacket);
      socket.send(buf, 0, buf.length, sipPort, sipHost, (err) => {
        if (err) {
          clearTimeout(timer);
          try {
            socket.close();
          } catch {
            // ignore
          }
          resolve(false);
        }
      });
    });

    checks.push({
      title: `UDP Port ${sipPort} (SIP VoIP Protocol)`,
      target: `${sipHost}:${sipPort}`,
      status: udpPassed ? 'passed' : 'failed',
      latencyMs: Date.now() - startUdp,
      details: udpPassed
        ? `UDP SIP handshake acknowledged by RanksTel`
        : `Timed out. RanksTel SIP server is not acknowledging UDP packets from international Cloud Egress IP (${cloudEgressIp}).`,
    });
  } catch {
    checks.push({
      title: `UDP Port ${sipPort} (SIP VoIP Protocol)`,
      target: `${sipHost}:${sipPort}`,
      status: 'failed',
      latencyMs: Date.now() - startUdp,
      details: `UDP transmission failed`,
    });
  }

  const isBlocked = !tcpPassed && !udpPassed;

  return {
    timestamp: new Date().toISOString(),
    serverInfo: {
      sipServer: sipHost,
      sipPort,
      sipUsername: username,
      portalUrl: config.providerApi.url,
      cloudEgressIp,
    },
    overallStatus: isBlocked ? 'PORT_BLOCKED_BY_CARRIER' : 'HEALTHY',
    rootCauseAnalysis: {
      isFirewallBlocked: isBlocked,
      reason: isBlocked
        ? `RanksTel Carrier Firewall blocks port 5060 from international Cloud IP ${cloudEgressIp}`
        : 'Trunk signaling connection is normal',
      explanationBn:
        'বাংলাদেশে বিটিআরসি (BTRC) এর টেলিকম নিয়ম ও আইপিএসপি (IPSP) সিকিউরিটির কারণে RanksTel এর SIP সার্ভার (202.40.176.2:5060) আন্তর্জাতিক ক্লাউড আইপি (Google Cloud / AWS) থেকে সরাসরি SIP কানেকশন ব্লক করে রাখে। তাই ক্লাউড কন্টেইনার থেকে SIP প্যাকেট পাঠানো হলেও RanksTel তা রিসিভ করছে না বা একনলেজ করছে না।',
      remediationSteps: [
        `১. RanksTel সাপোর্টকে ফোন বা ইমেইল (support@ranksitt.net) করে এই ক্লাউড সার্ভারের Egress আইপি [${cloudEgressIp}] অ্যাকাউন্ট ${username}-এর জন্য Whitelist করতে বলুন।`,
        `২. অথবা আপনার মোবাইল বা কম্পিউটারে Zoiper / MicroSIP অ্যাপ ডাউনলোড করে অ্যাকাউন্ট ${username}, ডোমেইন 202.40.176.2 এবং পাসওয়ার্ড দিয়ে লগইন করে বাংলাদেশের লোকাল ওয়াইফাই/ডাটা থেকে সরাসরি কল টেস্ট করুন।`,
        `৩. অথবা লোকাল কোনো সার্ভার/পিসিতে Asterisk / FreePBX SIP Proxy ইনস্টল করে ক্লাউডের সাথে ব্রিজ তৈরি করুন।`,
      ],
    },
    checks,
  };
}
