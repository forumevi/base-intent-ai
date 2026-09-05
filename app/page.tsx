'use client';

import { useState } from 'react';

export default function Home() {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'SWAP' | 'BRIDGE'>('SWAP');
  const [agentLogs, setAgentLogs] = useState<string[]>([
    'SYSTEM_INIT: Base AI Intent Engine v2.0 Online',
    'NET_STATUS: Base Mainnet (Chain ID: 8453) Connected',
    'ROUTER_ACTIVE: Uniswap V3 Engine & Across V2 Bridge Loaded'
  ]);

  const handleRunAgent = async (selectedPrompt?: string) => {
    const activePrompt = selectedPrompt || prompt;
    if (!activePrompt) return;

    setLoading(true);
    setAgentLogs((prev) => [
      `[${new Date().toLocaleTimeString()}] INTENT_INJECTED: "${activePrompt}"`,
      `[${new Date().toLocaleTimeString()}] ANALYZING: Parsing Natural Language with Groq Llama-3...`,
      ...prev
    ]);

    try {
      const res = await fetch('/api/intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: activePrompt })
      });
      const data = await res.json();

      if (data.success) {
        const isBridge = data.data.intentType === 'BRIDGE';
        setAgentLogs((prev) => [
          `[${new Date().toLocaleTimeString()}] ROUTE_FOUND: ${
            isBridge ? 'Across V2 Protocol (Cross-Chain)' : 'Uniswap V3 Multicall Engine (Base)'
          }`,
          `[${new Date().toLocaleTimeString()}] CALLDATA_GENERATED: Target ${data.data.aggregatorQuote.transaction.to}`,
          `[${new Date().toLocaleTimeString()}] EXECUTION_READY: Awaiting Wallet Confirmation...`,
          ...prev
        ]);
      } else {
        throw new Error(data.error);
      }
    } catch (err: any) {
      setAgentLogs((prev) => [
        `[${new Date().toLocaleTimeString()}] EXECUTION_FAILED: ${err.message || 'Unknown Error'}`,
        ...prev
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#07080C] text-slate-100 flex flex-col items-center p-4 md:p-10 relative overflow-hidden font-sans selection:bg-blue-500 selection:text-white">
      
      {/* Dynamic Background Glows */}
      <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-tr from-blue-600/15 via-indigo-500/10 to-purple-600/15 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-[160px] pointer-events-none" />

      {/* Top Network Bar */}
      <div className="w-full max-w-5xl flex items-center justify-between py-2 px-4 rounded-full bg-slate-900/40 border border-slate-800/60 backdrop-blur-md text-xs font-mono text-slate-400 mb-8">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            Base Mainnet
          </span>
          <span className="text-slate-600">|</span>
          <span>Gas: <span className="text-slate-200">0.001 Gwei</span></span>
        </div>
        <div className="hidden sm:flex items-center gap-4 text-[11px]">
          <span>Block Time: <span className="text-slate-200">2.0s</span></span>
          <span className="text-slate-600">|</span>
          <span>Protocols: <span className="text-blue-400">Uniswap V3</span> & <span className="text-purple-400">Across V2</span></span>
        </div>
      </div>

      <div className="max-w-4xl w-full z-10 space-y-8">
        
        {/* Main Hero Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 backdrop-blur-md text-xs font-semibold text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.2)]">
            <span className="text-sm">⚡</span>
            <span>NEXT-GEN AI INTENT ENGINE FOR BASE</span>
          </div>
          
          <h1 className="text-4xl md:text-6xl font-black tracking-tight text-white leading-tight">
            Execute On-Chain Actions <br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400">
              In Pure Plain English.
            </span>
          </h1>
          
          <p className="text-slate-400 text-sm md:text-base max-w-2xl mx-auto font-light leading-relaxed">
            Eliminate complex DEX routing & bridge UIs. Simply type your transaction intent—our autonomous agent builds, simulates, and routes calldata instantly.
          </p>
        </div>

        {/* Interactive Prompt & Control Panel */}
        <div className="bg-[#0D0F17]/90 border border-slate-800/90 rounded-3xl p-5 md:p-8 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.6)] space-y-6 relative group">
          
          <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-3xl blur opacity-30 group-hover:opacity-60 transition duration-500 pointer-events-none" />

          {/* Mode Selector Tabs */}
          <div className="relative flex items-center gap-2 p-1 bg-[#07080C] rounded-xl border border-slate-800/80 w-fit text-xs font-semibold">
            <button
              onClick={() => setActiveTab('SWAP')}
              className={`px-4 py-2 rounded-lg transition-all ${
                activeTab === 'SWAP'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              🔄 DEX Swap Mode
            </button>
            <button
              onClick={() => setActiveTab('BRIDGE')}
              className={`px-4 py-2 rounded-lg transition-all ${
                activeTab === 'BRIDGE'
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              🌉 Cross-Chain Bridge
            </button>
          </div>

          {/* Prompt Area */}
          <div className="relative space-y-3">
            <div className="relative">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={
                  activeTab === 'SWAP'
                    ? 'e.g. Swap 0.0001 ETH for USDC on Base...'
                    : 'e.g. Bridge 0.001 ETH from Arbitrum to Base...'
                }
                className="w-full h-32 bg-[#07080C] border border-slate-800/90 rounded-2xl p-5 text-sm md:text-base text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/50 transition resize-none font-mono shadow-inner"
              />
              <button
                onClick={() => handleRunAgent()}
                disabled={loading}
                className="absolute bottom-4 right-4 px-6 py-3 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:opacity-90 text-white font-semibold text-xs md:text-sm rounded-xl transition-all shadow-xl shadow-blue-600/25 disabled:opacity-50 flex items-center gap-2 cursor-pointer active:scale-95"
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Executing...
                  </>
                ) : (
                  <>Execute Intent ⚡</>
                )}
              </button>
            </div>
          </div>

          {/* Quick Intent Cards Section */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between text-xs font-mono text-slate-500">
              <span>SUGGESTED INTENT TEMPLATES</span>
              <span className="text-slate-600">Click to Auto-Fill & Run</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              
              {/* Swap Prompts (Highlighted) */}
              <div
                onClick={() => {
                  const p = 'Swap 0.0001 ETH for USDC';
                  setPrompt(p);
                  setActiveTab('SWAP');
                  handleRunAgent(p);
                }}
                className="group/card p-4 rounded-2xl bg-gradient-to-b from-blue-950/30 to-slate-900/40 border border-blue-500/20 hover:border-blue-500/50 hover:bg-blue-900/20 transition cursor-pointer flex items-center justify-between"
              >
                <div className="space-y-1">
                  <div className="text-xs font-bold text-blue-300 flex items-center gap-1.5">
                    <span>🔄 Swap ETH to USDC</span>
                    <span className="px-1.5 py-0.5 text-[9px] bg-blue-500/20 rounded text-blue-400">Uniswap V3</span>
                  </div>
                  <div className="text-xs text-slate-400 font-mono">"Swap 0.0001 ETH for USDC"</div>
                </div>
                <span className="text-slate-600 group-hover/card:text-blue-400 group-hover/card:translate-x-1 transition-all">→</span>
              </div>

              <div
                onClick={() => {
                  const p = 'Swap 0.0001 ETH for AERO';
                  setPrompt(p);
                  setActiveTab('SWAP');
                  handleRunAgent(p);
                }}
                className="group/card p-4 rounded-2xl bg-gradient-to-b from-blue-950/30 to-slate-900/40 border border-blue-500/20 hover:border-blue-500/50 hover:bg-blue-900/20 transition cursor-pointer flex items-center justify-between"
              >
                <div className="space-y-1">
                  <div className="text-xs font-bold text-blue-300 flex items-center gap-1.5">
                    <span>🔄 Swap ETH to AERO</span>
                    <span className="px-1.5 py-0.5 text-[9px] bg-blue-500/20 rounded text-blue-400">Aerodrome Token</span>
                  </div>
                  <div className="text-xs text-slate-400 font-mono">"Swap 0.0001 ETH for AERO"</div>
                </div>
                <span className="text-slate-600 group-hover/card:text-blue-400 group-hover/card:translate-x-1 transition-all">→</span>
              </div>

              {/* Bridge Prompts */}
              <div
                onClick={() => {
                  const p = 'Bridge 0.001 ETH from Arbitrum to Base';
                  setPrompt(p);
                  setActiveTab('BRIDGE');
                  handleRunAgent(p);
                }}
                className="group/card p-4 rounded-2xl bg-slate-900/50 border border-slate-800 hover:border-purple-500/40 hover:bg-purple-950/20 transition cursor-pointer flex items-center justify-between"
              >
                <div className="space-y-1">
                  <div className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                    <span>🌉 Bridge Arbitrum → Base</span>
                    <span className="px-1.5 py-0.5 text-[9px] bg-purple-500/20 rounded text-purple-400">Across V2</span>
                  </div>
                  <div className="text-xs text-slate-400 font-mono">"Bridge 0.001 ETH from Arbitrum to Base"</div>
                </div>
                <span className="text-slate-600 group-hover/card:text-purple-400 group-hover/card:translate-x-1 transition-all">→</span>
              </div>

              <div
                onClick={() => {
                  const p = 'Bridge 0.001 ETH from Optimism to Base';
                  setPrompt(p);
                  setActiveTab('BRIDGE');
                  handleRunAgent(p);
                }}
                className="group/card p-4 rounded-2xl bg-slate-900/50 border border-slate-800 hover:border-purple-500/40 hover:bg-purple-950/20 transition cursor-pointer flex items-center justify-between"
              >
                <div className="space-y-1">
                  <div className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                    <span>🌉 Bridge Optimism → Base</span>
                    <span className="px-1.5 py-0.5 text-[9px] bg-purple-500/20 rounded text-purple-400">Across V2</span>
                  </div>
                  <div className="text-xs text-slate-400 font-mono">"Bridge 0.001 ETH from Optimism to Base"</div>
                </div>
                <span className="text-slate-600 group-hover/card:text-purple-400 group-hover/card:translate-x-1 transition-all">→</span>
              </div>

            </div>
          </div>

        </div>

        {/* Live Cyberpunk Telemetry Console */}
        <div className="bg-[#05060A] border border-slate-800/90 rounded-2xl p-5 font-mono text-xs text-slate-300 space-y-3 shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 text-slate-500">
            <span className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse" />
              <span className="text-slate-300 font-semibold tracking-wider">AGENT TELEMETRY LOGS</span>
            </span>
            <span className="text-[10px] bg-slate-800/60 px-2 py-0.5 rounded text-slate-400">STREAMING LIVE</span>
          </div>

          <div className="space-y-2 max-h-44 overflow-y-auto pr-2 custom-scrollbar">
            {agentLogs.map((log, index) => (
              <div key={index} className="flex items-start gap-2 text-slate-400">
                <span className="text-blue-500 font-bold">›</span>
                <span className={log.includes('SUCCESS') || log.includes('ROUTE_FOUND') ? 'text-emerald-400 font-semibold' : ''}>
                  {log}
                </span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </main>
  );
}
