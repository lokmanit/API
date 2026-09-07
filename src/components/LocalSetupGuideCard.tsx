import React, { useState } from 'react';
import { Terminal, Copy, Check, Server, ShieldCheck, ArrowRight, Globe, Laptop } from 'lucide-react';

export const LocalSetupGuideCard: React.FC = () => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [platform, setPlatform] = useState<'linux' | 'windows' | 'agent'>('linux');

  const copy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  return (
    <div className="border border-emerald-500/20 rounded-lg bg-[#080c09] p-5 sm:p-6 space-y-6 shadow-2xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              ONE-CLICK COPY-PASTE GUIDE
            </span>
            <span className="text-[10px] font-mono text-white/40 uppercase">
              BANGLA & ENGLISH
            </span>
          </div>
          <h3 className="text-base sm:text-lg font-black uppercase tracking-tight text-white flex items-center gap-2">
            <Laptop className="w-5 h-5 text-emerald-400" />
            লোকাল মেশিন সেটআপ ও মুম্বাই এজেন্ট কানেকশন গাইড
          </h3>
          <p className="text-xs text-white/60 font-mono mt-1">
            বাংলাদেশের লোকাল পিসিতে (শেয়ার্ড আইপি) এই সার্ভারটি চালিয়ে মুম্বাই এজেন্টের সাথে কানেক্ট করার সহজ ধাপ।
          </p>
        </div>

        {/* Tab Selection */}
        <div className="flex items-center gap-1 bg-black/40 p-1 rounded border border-white/10 shrink-0">
          <button
            type="button"
            onClick={() => setPlatform('linux')}
            className={`px-3 py-1.5 rounded text-xs font-mono font-bold transition-colors cursor-pointer ${
              platform === 'linux' ? 'bg-emerald-500 text-black' : 'text-white/60 hover:text-white'
            }`}
          >
            Linux / Mac
          </button>
          <button
            type="button"
            onClick={() => setPlatform('windows')}
            className={`px-3 py-1.5 rounded text-xs font-mono font-bold transition-colors cursor-pointer ${
              platform === 'windows' ? 'bg-emerald-500 text-black' : 'text-white/60 hover:text-white'
            }`}
          >
            Windows
          </button>
          <button
            type="button"
            onClick={() => setPlatform('agent')}
            className={`px-3 py-1.5 rounded text-xs font-mono font-bold transition-colors cursor-pointer ${
              platform === 'agent' ? 'bg-blue-500 text-white' : 'text-white/60 hover:text-white'
            }`}
          >
            মুম্বাই এজেন্ট কোড
          </button>
        </div>
      </div>

      {/* Linux / Mac Setup */}
      {platform === 'linux' && (
        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-black/50 border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white font-mono flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[10px]">1</span>
                ধাপ ১: জিপ ফাইল আনজিপ করে অটো-সেটআপ রান করুন
              </span>
              <button
                type="button"
                onClick={() => copy('chmod +x setup.sh && ./setup.sh', 'linux-setup')}
                className="px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-white text-[10px] font-mono flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {copiedId === 'linux-setup' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedId === 'linux-setup' ? 'কপি হয়েছে' : 'কপি কমান্ড'}</span>
              </button>
            </div>
            <pre className="p-3 bg-[#050505] rounded border border-white/10 text-emerald-300 font-mono text-xs select-all">
              chmod +x setup.sh &amp;&amp; ./setup.sh
            </pre>
            <p className="text-[11px] text-white/50 font-mono">
              এটি স্বয়ংক্রিয়ভাবে নোড প্যাকেজ ইনস্টল করবে এবং `.env` কনফিগার করবে।
            </p>
          </div>

          <div className="p-4 rounded-lg bg-black/50 border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white font-mono flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[10px]">2</span>
                ধাপ ২: সার্ভার স্টার্ট করুন
              </span>
              <button
                type="button"
                onClick={() => copy('npm run dev', 'linux-run')}
                className="px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-white text-[10px] font-mono flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {copiedId === 'linux-run' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedId === 'linux-run' ? 'কপি হয়েছে' : 'কপি কমান্ড'}</span>
              </button>
            </div>
            <pre className="p-3 bg-[#050505] rounded border border-white/10 text-emerald-300 font-mono text-xs select-all">
              npm run dev
            </pre>
            <p className="text-[11px] text-white/50 font-mono">
              সার্ভারটি লোকাল মেশিনে <code className="text-white">http://localhost:3000</code> পোর্টে চালু হবে।
            </p>
          </div>

          <div className="p-4 rounded-lg bg-black/50 border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white font-mono flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-[10px]">3</span>
                ধাপ ৩: মুম্বাই এজেন্টের জন্য ফ্রি পাবলিক লিংক তৈরি (Cloudflare Tunnel)
              </span>
              <button
                type="button"
                onClick={() => copy('npx cloudflared tunnel --url http://localhost:3000', 'linux-tunnel')}
                className="px-2.5 py-1 rounded bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 text-[10px] font-mono flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {copiedId === 'linux-tunnel' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedId === 'linux-tunnel' ? 'কপি হয়েছে' : 'কপি কমান্ড'}</span>
              </button>
            </div>
            <pre className="p-3 bg-[#050505] rounded border border-white/10 text-blue-300 font-mono text-xs select-all">
              npx cloudflared tunnel --url http://localhost:3000
            </pre>
            <p className="text-[11px] text-white/50 font-mono">
              শেয়ার্ড আইপিতে কোনো পোর্ট ফরোয়ার্ডিং লাগবে না। টার্মিনালে একটি সুরক্ষিত HTTPS লিঙ্ক জেনারেট হবে।
            </p>
          </div>
        </div>
      )}

      {/* Windows Setup */}
      {platform === 'windows' && (
        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-black/50 border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white font-mono flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[10px]">1</span>
                ধাপ ১: PowerShell বা CMD খুলে প্যাকেজ ইনস্টল করুন
              </span>
              <button
                type="button"
                onClick={() => copy('npm install', 'win-install')}
                className="px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-white text-[10px] font-mono flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {copiedId === 'win-install' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedId === 'win-install' ? 'কপি হয়েছে' : 'কপি কমান্ড'}</span>
              </button>
            </div>
            <pre className="p-3 bg-[#050505] rounded border border-white/10 text-emerald-300 font-mono text-xs select-all">
              npm install
            </pre>
          </div>

          <div className="p-4 rounded-lg bg-black/50 border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white font-mono flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[10px]">2</span>
                ধাপ ২: সার্ভার রান করুন
              </span>
              <button
                type="button"
                onClick={() => copy('npm run dev', 'win-run')}
                className="px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-white text-[10px] font-mono flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {copiedId === 'win-run' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedId === 'win-run' ? 'কপি হয়েছে' : 'কপি কমান্ড'}</span>
              </button>
            </div>
            <pre className="p-3 bg-[#050505] rounded border border-white/10 text-emerald-300 font-mono text-xs select-all">
              npm run dev
            </pre>
          </div>

          <div className="p-4 rounded-lg bg-black/50 border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white font-mono flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-[10px]">3</span>
                ধাপ ৩: Cloudflare টানেল চালু করুন
              </span>
              <button
                type="button"
                onClick={() => copy('npx cloudflared tunnel --url http://localhost:3000', 'win-tunnel')}
                className="px-2.5 py-1 rounded bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 text-[10px] font-mono flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {copiedId === 'win-tunnel' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedId === 'win-tunnel' ? 'কপি হয়েছে' : 'কপি কমান্ড'}</span>
              </button>
            </div>
            <pre className="p-3 bg-[#050505] rounded border border-white/10 text-blue-300 font-mono text-xs select-all">
              npx cloudflared tunnel --url http://localhost:3000
            </pre>
          </div>
        </div>
      )}

      {/* Mumbai Agent Code Snippet */}
      {platform === 'agent' && (
        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-black/50 border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white font-mono flex items-center gap-2">
                <Globe className="w-4 h-4 text-blue-400" />
                মুম্বাই এজেন্ট সার্ভার থেকে কল পাঠানোর cURL কমান্ড
              </span>
              <button
                type="button"
                onClick={() =>
                  copy(
                    `curl -X POST https://YOUR-TUNNEL-URL.trycloudflare.com/api/call \\\n  -H "Authorization: Bearer call_api_sec_token_9f8d7c6b5a4" \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "destination": "+8801750010459",\n    "content": "Emergency Alert from Mumbai Agent",\n    "reason": "AI_AGENT_DECISION"\n  }'`,
                    'agent-curl'
                  )
                }
                className="px-2.5 py-1 rounded bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 text-[10px] font-mono flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {copiedId === 'agent-curl' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedId === 'agent-curl' ? 'কপি হয়েছে' : 'কপি cURL'}</span>
              </button>
            </div>
            <pre className="p-3 bg-[#050505] rounded border border-white/10 text-emerald-300 font-mono text-xs overflow-x-auto select-all">
{`curl -X POST https://YOUR-TUNNEL-URL.trycloudflare.com/api/call \\
  -H "Authorization: Bearer call_api_sec_token_9f8d7c6b5a4" \\
  -H "Content-Type: application/json" \\
  -d '{
    "destination": "+8801750010459",
    "content": "Emergency Alert from Mumbai Agent",
    "reason": "AI_AGENT_DECISION"
  }'`}
            </pre>
            <p className="text-[11px] text-white/60 leading-relaxed font-mono">
              মুম্বাইয়ের এআই এজেন্ট সিদ্ধান্ত নেবে এবং উপরের এন্ডপয়েন্টে হিট করলেই আপনার লোকাল বাংলাদেশ মেশিন সেকেন্ডের মধ্যে RanksTel SIP ট্রাঙ্ক দিয়ে আপনার নির্দিষ্ট মোবাইল নম্বর <span className="text-white font-bold">+8801750010459</span>-এ আসল কল পাঠিয়ে দেবে।
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
