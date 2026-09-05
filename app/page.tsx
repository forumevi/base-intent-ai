'use client';

import { useState } from 'react';

export default function Home() {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [agentLogs, setAgentLogs] = useState<string[]>([
    'System Initialized: Base Intent Engine v2.0 Active',
    'Supported Protocols: Uniswap V3 (Base) | Across V2 (Cross-Chain Bridge)'
  ]);

  const handleRunAgent = async (selectedPrompt?: string) => {
    const activePrompt = selectedPrompt || prompt;
    if (!activePrompt) return;

    setLoading(true);
    setAgentLogs((prev) => [
      `[${new Date().toLocaleTimeString()}] Parsing Intent: "${activePrompt}"...`,
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
        setAgentLogs((prev) => [
          `[${new Date().toLocaleTimeString()}] SUCCESS: Route found via ${
            data.data.intentType === 'BRIDGE' ? 'Across Bridge Protocol' : 'Uniswap V3 Engine'
          }`,
          ...prev
        ]);
      } else {
        throw new Error(data.error);
      }
    } catch (err: any) {
      setAgentLogs((prev) => [
        `[${new Date().toLocaleTimeString()}] ERROR: ${err.message || 'Execution Failed'}`,
        ...prev
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#090A0F] text-white flex flex-col items-center p-6 md:p-12 relative overflow-hidden font-sans">
      {/* Background Glow Effects */}
      <div className="absolute top-[-10%] left-[20%] w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-[40%] right-[10%] w-[400px] h-[400px] bg-purple-600/10 rounded-full blur-[140px] pointer-events-none" />

      {/* Main Container */}
      <div className="max-w-4xl w-full z-10 space-y-8">
        
        {/* Header Section */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-blue-500/20 bg-blue-500/10 backdrop-blur-md text-xs font-medium text-blue-400">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
            Autonomous Execution Engine Active
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-200 to-slate-500">
            Natural Language to On-Chain Execution.
          </h1>
          <p className="text-slate-400 text-sm md:text-base max-w-2xl mx-auto font-light">
            Describe your trade or cross-chain transfer in plain language. BaseIntent AI finds the optimal route across Uniswap V3 and Across Protocol instantly.
          </p>
        </div>

        {/* Input Card */}
        <div className="bg-[#12141D]/80 border border-slate-800/80 rounded-2xl p-4 md:p-6 backdrop-blur-xl shadow-2xl space-y-4">
          <div className="relative">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. Bridge 0.001 ETH from Arbitrum to Base or Swap 0.0001 ETH for USDC..."
              className="w-full h-28 bg-[#0B0C10] border border-slate-800 rounded-xl p-4 text-sm md:text-base text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500/50 transition resize-none font-mono"
            />
            <button
              onClick={() => handleRunAgent()}
              disabled={loading}
              className="absolute bottom-3 right-3 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium text-xs md:text-sm rounded-lg transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  Routing...
                </>
              ) : (
                <>Run Intent Agent ⚡</>
              )}
            </button>
          </div>

          {/* Quick Intents Prompts */}
          <div className="space-y-2 pt-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              ⚡ Quick Execution Prompts
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {/* Cross-Chain Bridges */}
              <button
                onClick={() => {
                  setPrompt('Bridge 0.001 ETH from Arbitrum to Base');
                  handleRunAgent('Bridge 0.001 ETH from Arbitrum to Base');
                }}
                className="flex items-center justify-between p-3 rounded-xl bg-indigo-950/20 border border-indigo-500/20 hover:border-indigo-500/40 hover:bg-indigo-900/30 text-left transition group"
              >
                <div>
                  <div className="text-xs font-semibold text-indigo-300">🌉 Bridge Arbitrum → Base</div>
                  <div className="text-[11px] text-slate-400 font-mono">"Bridge 0.001 ETH from Arbitrum to Base"</div>
                </div>
                <span className="text-slate-500 group-hover:text-indigo-400 transition">→</span>
              </button>

              <button
                onClick={() => {
                  setPrompt('Bridge 0.001 ETH from Optimism to Base');
                  handleRunAgent('Bridge 0.001 ETH from Optimism to Base');
                }}
                className="flex items-center justify-between p-3 rounded-xl bg-indigo-950/20 border border-indigo-500/20 hover:border-indigo-500/40 hover:bg-indigo-900/30 text-left transition group"
              >
                <div>
                  <div className="text-xs font-semibold text-indigo-300">🌉 Bridge Optimism → Base</div>
                  <div className="text-[11px] text-slate-400 font-mono">"Bridge 0.001 ETH from Optimism to Base"</div>
                </div>
                <span className="text-slate-500 group-hover:text-indigo-400 transition">→</span>
              </button>

              {/* Base Swaps */}
              <button
                onClick={() => {
                  setPrompt('Swap 0.0001 ETH for USDC');
                  handleRunAgent('Swap 0.0001 ETH for USDC');
                }}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-900/50 border border-slate-800 hover:border-slate-700 hover:bg-slate-800/50 text-left transition group"
              >
                <div>
                  <div className="text-xs font-semibold text-slate-200">🔄 Base DEX Swap</div>
                  <div className="text-[11px] text-slate-400 font-mono">"Swap 0.0001 ETH for USDC"</div>
                </div>
                <span className="text-slate-500 group-hover:text-slate-300 transition">→</span>
              </button>

              <button
                onClick={() => {
                  setPrompt('Swap 0.0001 ETH for AERO');
                  handleRunAgent('Swap 0.0001 ETH for AERO');
                }}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-900/50 border border-slate-800 hover:border-slate-700 hover:bg-slate-800/50 text-left transition group"
              >
                <div>
                  <div className="text-xs font-semibold text-slate-200">🔄 Base Ecosystem Swap</div>
                  <div className="text-[11px] text-slate-400 font-mono">"Swap 0.0001 ETH for AERO"</div>
                </div>
                <span className="text-slate-500 group-hover:text-slate-300 transition">→</span>
              </button>
            </div>
          </div>
        </div>

        {/* Live Terminal / Agent Console */}
        <div className="bg-[#0B0C10] border border-slate-800 rounded-2xl p-4 font-mono text-xs text-slate-300 space-y-2">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2 text-slate-500">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              AGENT LOG STREAM
            </span>
            <span>LIVE</span>
          </div>
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {agentLogs.map((log, index) => (
              <div key={index} className="text-slate-400">
                {log}
              </div>
            ))}
          </div>
        </div>

      </div>
    </main>
  );
}
