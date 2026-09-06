'use client';

import { useState } from 'react';

export default function Home() {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([
    '[SYSTEM] Agent initialized on Base Mainnet...',
    '[LLM_ENGINE] Groq Llama-3.3-70B Ready'
  ]);

  const addLog = (msg: string) => {
    setLogs((prev) => [...prev, msg]);
  };

  const handleExecute = async () => {
    if (!prompt) return;
    setLoading(true);
    addLog(`[INTENT_RECEIVE] "${prompt}"`);
    addLog('[LLM_AGENT] Parsing intent via Llama-3.3-70B...');

    try {
      const res = await fetch('/api/intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          userAddress: '0x95773c1f40b82dd8d0529471f6a6016fdfe990aa' // Bağlı Cüzdan Adresi
        })
      });

      const result = await res.json();

      if (!result.success) {
        throw new Error(result.error);
      }

      addLog(`[ROUTE_FOUND] ${result.data.sellToken} ➔ ${result.data.buyToken} via KyberSwap`);
      addLog('[PROMPTING_WALLET] Transaction batch generated. Please approve in wallet...');

      // Wallet interaction (evm transaction call) buraya gelecek

    } catch (err: any) {
      addLog(`[EXECUTION_FAILED] ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-8 flex flex-col items-center justify-center">
      <div className="max-w-3xl w-full space-y-8">
        
        {/* HEADER */}
        <div className="text-center space-y-3">
          <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">
            Autonomous Intent Protocol
          </h1>
          <p className="text-slate-400 text-sm">
            Execute complex DeFi transactions on Base Mainnet with natural language prompts.
          </p>
        </div>

        {/* INPUT SECTION */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-2xl space-y-4">
          <div className="flex justify-between items-center text-xs font-mono text-slate-400">
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse"></span>
              INTENT PROMPT INPUT
            </span>
            <span>TARGET: <strong className="text-slate-200">BASE MAINNET (8453)</strong></span>
          </div>

          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g. Swap 0.0001 ETH for USDC or Buy ETH with 1 USDC"
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-4 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors h-28 resize-none font-mono text-sm"
          />

          <div className="flex justify-between items-center pt-2">
            <button
              onClick={() => setPrompt('')}
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              Clear
            </button>
            <button
              onClick={handleExecute}
              disabled={loading || !prompt}
              className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white font-medium px-6 py-2.5 rounded-lg text-sm transition-all shadow-lg shadow-blue-500/20 disabled:shadow-none flex items-center gap-2"
            >
              {loading ? 'Processing...' : 'Execute Intent ⚡'}
            </button>
          </div>

          {/* POPULAR INTENTS (GÜNCELLENEN KISIM) */}
          <div className="pt-4 border-t border-slate-800/60">
            <p className="text-xs font-mono text-slate-400 mb-3 flex items-center gap-1.5">
              <span>⚡</span> POPULAR INTENT EXAMPLES
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <button
                onClick={() => setPrompt('Swap 0.0001 ETH for USDC')}
                className="flex items-center justify-between p-3 rounded-lg border border-slate-800 bg-slate-950/60 hover:bg-slate-800/50 hover:border-blue-500/30 transition-all text-left group"
              >
                <span className="text-xs font-mono text-slate-300 group-hover:text-blue-400">
                  0.0001 ETH ➔ USDC
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  KyberSwap
                </span>
              </button>

              <button
                onClick={() => setPrompt('Buy ETH with 1 USDC')}
                className="flex items-center justify-between p-3 rounded-lg border border-slate-800 bg-slate-950/60 hover:bg-slate-800/50 hover:border-blue-500/30 transition-all text-left group"
              >
                <span className="text-xs font-mono text-slate-300 group-hover:text-blue-400">
                  1 USDC ➔ ETH
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Approve + Swap
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* TELEMETRY LOGS */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 font-mono text-xs space-y-2">
          <div className="text-slate-500 pb-2 border-b border-slate-800 flex justify-between items-center">
            <span>REALTIME AGENT TELEMETRY LOGS</span>
            <span className="text-[10px] text-emerald-400">LIVE FEED</span>
          </div>
          <div className="max-h-48 overflow-y-auto space-y-1.5 pt-1 text-slate-300">
            {logs.map((log, index) => {
              const isError = log.includes('EXECUTION_FAILED');
              const isSuccess = log.includes('ROUTE_FOUND');
              return (
                <div
                  key={index}
                  className={
                    isError
                      ? 'text-red-400 font-semibold'
                      : isSuccess
                      ? 'text-emerald-400 font-semibold'
                      : 'text-slate-400'
                  }
                >
                  {log}
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </main>
  );
}
