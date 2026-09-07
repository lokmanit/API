import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Activity,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Copy,
  Check,
  Server,
  Network,
  Globe,
  Phone,
  HelpCircle,
} from 'lucide-react';
import { SipDiagnosticsReport } from '../services/sipDiagnostics.service';

interface SipDiagnosticsCardProps {
  authToken: string;
}

export const SipDiagnosticsCard: React.FC<SipDiagnosticsCardProps> = ({ authToken }) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [report, setReport] = useState<SipDiagnosticsReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedEmail, setCopiedEmail] = useState<boolean>(false);
  const [copiedSoftphone, setCopiedSoftphone] = useState<boolean>(false);

  const fetchDiagnostics = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/sip/diagnostics', {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      const data = await res.json();
      if (data.success && data.report) {
        setReport(data.report);
      } else {
        setError(data.message || 'Failed to run diagnostics');
      }
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDiagnostics();
  }, [authToken]);

  const egressIp = report?.serverInfo?.cloudEgressIp || '34.34.244.156';
  const username = report?.serverInfo?.sipUsername || '09617552229';

  const whitelistEmailTemplate = `To: support@ranksitt.net
Subject: Request to Whitelist Server IP for SIP Trunk Account ${username}

Dear RanksTel Support Team,

Please whitelist our application server IP address in your SIP/PortaSwitch firewall for outbound calling:

- SIP Account / Username: ${username}
- Caller ID: ${username}
- Server Outbound IP: ${egressIp}
- Protocol: UDP/TCP Port 5060
- Contact Domain: sip.ranksitt.net (202.40.176.2)

Thank you,
Account Holder: ${username}`;

  const softphoneDetails = `Domain / SIP Server: 202.40.176.2:5060 (or sip.ranksitt.net)
Username / Account: ${username}
Caller ID / Display: ${username}
Password: [Saved in Vault / Provided by RanksTel]
Transport: UDP 5060`;

  const copyToClipboard = (text: string, type: 'email' | 'softphone') => {
    navigator.clipboard.writeText(text);
    if (type === 'email') {
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2500);
    } else {
      setCopiedSoftphone(true);
      setTimeout(() => setCopiedSoftphone(false), 2500);
    }
  };

  return (
    <div className="border border-white/10 rounded-lg bg-[#0a0a0c] p-5 space-y-5 shadow-2xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-400">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white flex items-center gap-2">
              SIP Trunk & Carrier Firewall Diagnostic
              {report?.overallStatus === 'PORT_BLOCKED_BY_CARRIER' && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 uppercase">
                  Carrier Firewall Blocked
                </span>
              )}
              {report?.overallStatus === 'HEALTHY' && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase">
                  Signaling OK
                </span>
              )}
            </h3>
            <p className="text-[11px] font-mono text-white/50">
              Live probe checking RanksTel (202.40.176.2:5060) UDP/TCP connectivity and IP whitelisting
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={fetchDiagnostics}
          disabled={loading}
          className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white rounded text-xs font-mono font-bold flex items-center gap-2 transition-colors cursor-pointer shrink-0 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-400' : ''}`} />
          <span>{loading ? 'Probing RanksTel...' : 'Re-test Connection'}</span>
        </button>
      </div>

      {error && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded text-rose-300 text-xs font-mono">
          Diagnostic probe error: {error}
        </div>
      )}

      {/* Main Carrier Firewall Analysis Banner */}
      {report && (
        <div
          className={`p-4 rounded-lg border ${
            report.overallStatus === 'PORT_BLOCKED_BY_CARRIER'
              ? 'bg-rose-950/20 border-rose-500/30 text-rose-200'
              : 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200'
          }`}
        >
          <div className="flex items-start gap-3">
            {report.overallStatus === 'PORT_BLOCKED_BY_CARRIER' ? (
              <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            )}
            <div className="space-y-2">
              <h4 className="text-xs font-bold font-mono tracking-wide uppercase flex items-center gap-2">
                <span>{report.rootCauseAnalysis.reason}</span>
              </h4>
              <p className="text-xs leading-relaxed text-white/90">
                {report.rootCauseAnalysis.explanationBn}
              </p>
              <div className="pt-2 text-xs font-mono text-white/70 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-white/40">Our Cloud Egress IP:</span>
                  <span className="bg-white/10 px-2 py-0.5 rounded text-amber-300 font-bold border border-amber-500/30">
                    {egressIp}
                  </span>
                  <span className="text-white/40">Target Trunk:</span>
                  <span className="bg-white/10 px-2 py-0.5 rounded text-blue-300 font-bold">
                    202.40.176.2:5060 (RanksTel)
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Diagnostic Checks List */}
      {report && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {report.checks.map((c, i) => (
            <div
              key={i}
              className={`p-3 rounded border text-xs font-mono space-y-1 ${
                c.status === 'passed'
                  ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-300'
                  : c.status === 'failed'
                  ? 'bg-rose-500/5 border-rose-500/20 text-rose-300'
                  : 'bg-amber-500/5 border-amber-500/20 text-amber-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-white flex items-center gap-1.5">
                  {c.status === 'passed' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                  {c.status === 'failed' && <XCircle className="w-3.5 h-3.5 text-rose-400" />}
                  {c.status === 'warning' && <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />}
                  {c.title}
                </span>
                {c.latencyMs !== undefined && (
                  <span className="text-[10px] text-white/40">{c.latencyMs}ms</span>
                )}
              </div>
              <p className="text-[11px] text-white/60">{c.details}</p>
            </div>
          ))}
        </div>
      )}

      {/* Solutions & Next Steps */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2">
        {/* Option 1: Whitelist Request */}
        <div className="p-4 rounded-lg border border-blue-500/20 bg-blue-500/5 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-blue-300 flex items-center gap-1.5 font-mono">
              <Network className="w-4 h-4 text-blue-400" />
              সমাধান ১: RanksTel-এ আইপি হোয়াইটলিস্ট
            </h4>
            <button
              type="button"
              onClick={() => copyToClipboard(whitelistEmailTemplate, 'email')}
              className="px-2 py-1 rounded bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 text-[10px] font-mono flex items-center gap-1 transition-colors cursor-pointer"
            >
              {copiedEmail ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copiedEmail ? 'Copied' : 'Copy Email Template'}</span>
            </button>
          </div>
          <p className="text-xs text-white/70 leading-relaxed">
            RanksTel সাপোর্টকে (ইমেইল: <strong className="text-white">support@ranksitt.net</strong> বা আপনার অ্যাকাউন্ট ম্যানেজার) এই ক্লাউড সার্ভারের IP <strong className="text-amber-300">{egressIp}</strong> হোয়াইটলিস্ট করার জন্য একটি রিকোয়েস্ট পাঠান। হোয়াইটলিস্ট করা মাত্রই এই ড্যাশবোর্ড থেকে ডায়াল সরাসরি আপনার ফোনে রিং হবে।
          </p>
          <pre className="p-2.5 rounded bg-black/50 border border-white/10 text-[10px] font-mono text-white/60 overflow-x-auto select-all">
            {whitelistEmailTemplate}
          </pre>
        </div>

        {/* Option 2: Test on Mobile via Softphone */}
        <div className="p-4 rounded-lg border border-emerald-500/20 bg-emerald-500/5 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-300 flex items-center gap-1.5 font-mono">
              <Phone className="w-4 h-4 text-emerald-400" />
              সমাধান ২: সফটফোনে ডিরেক্ট টেস্ট (Local IP)
            </h4>
            <button
              type="button"
              onClick={() => copyToClipboard(softphoneDetails, 'softphone')}
              className="px-2 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-[10px] font-mono flex items-center gap-1 transition-colors cursor-pointer"
            >
              {copiedSoftphone ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copiedSoftphone ? 'Copied' : 'Copy Config'}</span>
            </button>
          </div>
          <p className="text-xs text-white/70 leading-relaxed">
            আপনি চাইলে এই মুহূর্তে আপনার মোবাইল বা কম্পিউটারে <strong className="text-white">Zoiper</strong> বা <strong className="text-white">MicroSIP</strong> অ্যাপ ইনস্টল করে বাংলাদেশের লোকাল ইন্টারনেট থেকে কল টেস্ট করতে পারেন। সেখানে RanksTel এর ফায়ারওয়াল ব্লক করবে না:
          </p>
          <pre className="p-2.5 rounded bg-black/50 border border-white/10 text-[10px] font-mono text-white/60 overflow-x-auto select-all">
            {softphoneDetails}
          </pre>
        </div>
      </div>
    </div>
  );
};
