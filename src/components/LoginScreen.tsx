import React, { useState } from 'react';
import { PhoneCall, Lock, User, Eye, EyeOff, ShieldCheck, ArrowRight } from 'lucide-react';

interface LoginScreenProps {
  onLoginSuccess: (token: string, user: { username: string; role: string }) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        onLoginSuccess(data.token, data.user);
      } else {
        setError(data.message || 'Invalid username or password.');
      }
    } catch {
      setError('Unable to connect to authentication server.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemoFill = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden selection:bg-blue-500 selection:text-white">
      {/* Background Ambience */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-blue-500/5 blur-[120px] pointer-events-none rounded-full" />
      <div className="absolute bottom-10 right-10 w-[300px] h-[300px] bg-emerald-500/5 blur-[100px] pointer-events-none rounded-full" />

      <div className="w-full max-w-md relative z-10 space-y-6">
        {/* Brand & Friendly Title Badge */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-[#0d0d0d] border border-white/10 flex items-center justify-center shadow-lg shadow-black">
            <PhoneCall className="w-8 h-8 text-blue-400" />
          </div>
          <h1 className="text-3xl font-black uppercase tracking-tight text-white flex items-center justify-center gap-2">
            SmartDial Voice
          </h1>
          <p className="text-xs font-mono text-white/50">
            Intelligent Auto-Redial & Outbound Voice Dispatch Gateway
          </p>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full text-[11px] font-mono text-blue-300 mt-1">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            Destination: Dynamic & Freely Configurable
          </div>
        </div>

        {/* Login Card */}
        <div className="p-7 sm:p-8 bg-[#0a0a0a] border border-white/15 rounded-xl shadow-2xl space-y-6">
          <div className="border-b border-white/10 pb-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-white/80 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Admin Authentication
            </h2>
            <p className="text-xs text-white/40 mt-1">
              Sign in to manage SIP trunk credentials, test calls, and auto-redial loops.
            </p>
          </div>

          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded text-rose-300 text-xs font-mono flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username Input */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-mono uppercase tracking-wider text-white/60 block">
                Username / SIP Account
              </label>
              <div className="relative flex items-center">
                <div className="absolute left-3 text-white/30">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin or 09617552229"
                  required
                  className="w-full pl-9 pr-3 py-2.5 bg-white/5 border border-white/10 rounded text-xs font-mono text-white focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-mono uppercase tracking-wider text-white/60">
                  Password / Access Key
                </label>
                <span className="text-[10px] text-white/30 font-mono">admin123</span>
              </div>
              <div className="relative flex items-center">
                <div className="absolute left-3 text-white/30">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter login password..."
                  required
                  className="w-full pl-9 pr-10 py-2.5 bg-white/5 border border-white/10 rounded text-xs font-mono text-white focus:outline-none focus:border-blue-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 text-white/30 hover:text-white/70 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-black uppercase text-xs tracking-wider rounded transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <span>Signing in...</span>
              ) : (
                <>
                  <span>Sign In to Console</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Credentials Assistant */}
          <div className="pt-2 border-t border-white/10 space-y-2">
            <span className="text-[10px] font-mono uppercase text-white/40 block">
              Quick Fill Demo Credentials:
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleQuickDemoFill('admin', 'admin123')}
                className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-left transition-colors cursor-pointer"
              >
                <div className="text-[10px] font-bold text-white">Default Admin</div>
                <div className="text-[9px] font-mono text-white/40">admin / admin123</div>
              </button>
              <button
                type="button"
                onClick={() => handleQuickDemoFill('09617552229', 'admin123')}
                className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-left transition-colors cursor-pointer"
              >
                <div className="text-[10px] font-bold text-blue-400">SIP Account</div>
                <div className="text-[9px] font-mono text-white/40">09617552229</div>
              </button>
            </div>
          </div>
        </div>

        {/* Security Footer Note */}
        <p className="text-[11px] font-mono text-center text-white/30 leading-relaxed">
          &copy; 2026 SmartDial Voice &bull; SIP Voice Gateway & Outbound Automation
        </p>
      </div>
    </div>
  );
};
