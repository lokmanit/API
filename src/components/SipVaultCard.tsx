import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Key,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Copy,
  Check,
  Lock,
  Eye,
  EyeOff,
  Hash,
  PhoneForwarded,
  Phone,
} from 'lucide-react';

interface SipVaultCardProps {
  authToken: string;
  onPasswordVaulted?: () => void;
  destination: string;
  onSetDestination: (dest: string) => void;
}

interface SipVaultData {
  hasPassword: boolean;
  sha256: string | null;
  masked: string | null;
  server: string;
  username: string;
  callerId: string;
  defaultDestination: string;
}

export const SipVaultCard: React.FC<SipVaultCardProps> = ({
  authToken,
  onPasswordVaulted,
  destination,
  onSetDestination,
}) => {
  const [vaultData, setVaultData] = useState<SipVaultData>({
    hasPassword: false,
    sha256: null,
    masked: null,
    server: '202.40.176.2:5060',
    username: '09617552229',
    callerId: '09617552229',
    defaultDestination: '+8801750010459',
  });

  const [inputPassword, setInputPassword] = useState('');
  const [showInputPassword, setShowInputPassword] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedHash, setCopiedHash] = useState(false);

  // Fetch initial vault state
  const fetchVaultStatus = async () => {
    try {
      const res = await fetch('/api/sip/vault', {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setVaultData(data);
        if (data.hasPassword) {
          setIsEditing(false);
        }
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchVaultStatus();
  }, [authToken]);

  // Submit and hash SIP password
  const handleSavePassword = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputPassword.trim()) {
      setErrorMsg('Please enter your SIP trunk password.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/sip/vault', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ password: inputPassword.trim() }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setVaultData((prev) => ({
          ...prev,
          hasPassword: true,
          sha256: data.sha256,
          masked: data.masked || '••••••••••••',
        }));
        setInputPassword(''); // Remove raw password from browser memory
        setIsEditing(false);
        setSuccessMsg('Password securely stored & preserved as SHA-256 Hash.');
        if (onPasswordVaulted) {
          onPasswordVaulted();
        }
        setTimeout(() => setSuccessMsg(null), 5000);
      } else {
        setErrorMsg(data.message || 'Failed to save password in vault');
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Vault error');
    } finally {
      setLoading(false);
    }
  };

  const copyHashToClipboard = () => {
    if (!vaultData.sha256) return;
    navigator.clipboard.writeText(vaultData.sha256);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  return (
    <div className="p-5 sm:p-6 border border-emerald-500/20 rounded-xl bg-[#090b0a] space-y-5 shadow-lg relative overflow-hidden">
      {/* Decorative subtle border light */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500/0 via-emerald-500/40 to-emerald-500/0" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <h3 className="text-sm sm:text-base font-black uppercase tracking-wider text-white">
              SIP Trunk Credentials &amp; Hash Vault
            </h3>
            <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-mono rounded">
              RFC 3261 / MD5 DIGEST
            </span>
          </div>
          <p className="text-xs text-white/50">
            Carrier SIP Trunk &bull; Input passwords are saved and preserved in memory as secure SHA-256 digests
          </p>
        </div>

        {/* Carrier Quick Summary */}
        <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono">
          <span className="px-2.5 py-1 bg-white/5 border border-white/10 rounded text-white/70">
            SERVER: <strong className="text-emerald-400">202.40.176.2:5060</strong>
          </span>
          <span className="px-2.5 py-1 bg-white/5 border border-white/10 rounded text-white/70">
            CALLER ID: <strong className="text-white">09617552229</strong>
          </span>
        </div>
      </div>

      {/* Success / Error alerts */}
      {successMsg && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded text-emerald-300 text-xs font-mono flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded text-rose-300 text-xs font-mono flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Target Recipient Setup */}
      <div className="p-3.5 bg-white/5 border border-white/10 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5">
          <PhoneForwarded className="w-4 h-4 text-blue-400 shrink-0" />
          <div>
            <div className="text-[11px] uppercase font-bold text-white/70">
              Active Call Destination Target
            </div>
            <div className="font-mono text-emerald-400 font-bold text-sm">
              {destination || 'No number selected'}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onSetDestination('+8801750010459')}
          className="px-3 py-1.5 rounded text-[11px] font-mono uppercase tracking-wider transition-colors border bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border-blue-500/30 cursor-pointer flex items-center gap-1.5"
          title="Set primary recipient phone number (+8801750010459)"
        >
          <Phone className="w-3.5 h-3.5 text-blue-400" />
          <span>+8801750010459</span>
        </button>
      </div>

      {/* SIP PASSWORD VAULT AREA */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-[11px] uppercase font-mono font-bold tracking-wider text-white/80 flex items-center gap-2">
            <Key className="w-3.5 h-3.5 text-amber-400" />
            SIP Password (Vault &amp; Cryptographic Hash)
          </label>

          {vaultData.hasPassword && !isEditing && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-mono">
              <CheckCircle2 className="w-3 h-3" />
              PRESERVED AS HASH
            </span>
          )}
        </div>

        {/* State A: Password is Saved & Displayed as Hash */}
        {vaultData.hasPassword && !isEditing ? (
          <div className="p-4 bg-[#050706] border border-emerald-500/30 rounded-lg space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="space-y-1 overflow-hidden">
                <div className="text-[10px] font-mono uppercase text-white/40 flex items-center gap-1.5">
                  <Hash className="w-3 h-3 text-emerald-400" />
                  SHA-256 Cryptographic Hash Digest:
                </div>
                <div className="font-mono text-xs sm:text-sm text-emerald-300 font-bold truncate selection:bg-emerald-500 selection:text-black">
                  {vaultData.sha256 || 'SHA-256: SECURED_IN_MEMORY_VAULT'}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={copyHashToClipboard}
                  className="px-2.5 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-[10px] font-mono text-white/80 flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Copy SHA-256 Hash"
                >
                  {copiedHash ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-white/50" />}
                  {copiedHash ? 'COPIED' : 'COPY HASH'}
                </button>

                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-300 rounded text-[10px] font-mono uppercase font-bold tracking-wider transition-colors cursor-pointer"
                >
                  Change Password
                </button>
              </div>
            </div>

            <div className="pt-2 border-t border-white/5 flex flex-col sm:flex-row sm:items-center justify-between text-[11px] font-mono text-white/50 gap-2">
              <div className="flex items-center gap-2">
                <span>Masked Value:</span>
                <span className="text-white/80 tracking-widest">{vaultData.masked || '••••••••••••'}</span>
              </div>
              <span className="text-emerald-400/80">
                &bull; Security Policy: Raw passwords are never stored in browser storage
              </span>
            </div>
          </div>
        ) : (
          /* State B: Input form to enter and hash the password */
          <form onSubmit={handleSavePassword} className="space-y-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="relative flex-1">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showInputPassword ? 'text' : 'password'}
                  value={inputPassword}
                  onChange={(e) => setInputPassword(e.target.value)}
                  placeholder="Enter your SIP trunk password (e.g., Xy9#kL2)..."
                  className="w-full pl-9 pr-10 py-2.5 bg-white/5 border border-white/15 rounded text-xs font-mono text-white focus:outline-none focus:border-emerald-500 transition-colors placeholder:text-white/30"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowInputPassword(!showInputPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80 transition-colors"
                >
                  {showInputPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-black uppercase text-xs font-mono tracking-wider rounded transition-all flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/20 disabled:opacity-50 cursor-pointer"
                >
                  {loading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Hash className="w-4 h-4" />
                  )}
                  <span>Save &amp; Hash</span>
                </button>

                {isEditing && vaultData.hasPassword && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditing(false);
                      setInputPassword('');
                    }}
                    className="px-3 py-2.5 bg-white/10 hover:bg-white/20 text-white font-mono text-xs rounded transition-colors"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>

            <p className="text-[11px] font-mono text-white/40 leading-relaxed">
              &bull; Entering the password and pressing <kbd className="px-1 py-0.5 bg-white/10 rounded text-white text-[10px]">Enter</kbd> instantly converts it into a SHA-256 cryptographic digest preserved in server memory.
            </p>
          </form>
        )}
      </div>
    </div>
  );
};
