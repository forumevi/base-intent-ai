'use client';

import { useState } from 'react';

export default function Home() {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [walletConnected, setWalletConnected] = useState(false);
  const [userAddress, setUserAddress] = useState('');

  const [logs, setLogs] = useState<string[]>([
    '[SYSTEM] Agent initialized on Base Mainnet...',
    '[LLM_ENGINE] Groq Llama-3.3-70B Ready'
  ]);

  const addLog = (msg: string) => {
    setLogs((prev) => [...prev, msg]);
  };

  const connectWallet = async () => {
    if (typeof window !== 'undefined' && (window as any).ethereum) {
      try {
        const accounts = await (window as any).ethereum.request({
          method: 'eth_requestAccounts'
        });
        setUserAddress(accounts[0]);
        setWalletConnected(true);
        addLog(`[WALLET] Connected: ${accounts[0].slice(0, 6)}...${accounts[0].slice(-4)}`);
      } catch (err: any) {
        addLog(`[WALLET_ERROR] ${err.message}`);
      }
    } else {
      addLog('[WALLET_ERROR] Web3 Wallet not found. Please install MetaMask or Coinbase Wallet.');
    }
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
          userAddress: userAddress || '0x95773c1f40b82dd8d0529471f6a6016fdfe990aa'
        })
      });

      const result = await res.json();

      if (!result.success) {
        throw new Error(result.error);
      }

      addLog(`[ROUTE_FOUND] ${result.data.sellToken} ➔ ${result.data.buyToken} via KyberSwap`);
      addLog('[PROMPTING_WALLET] Transaction batch generated. Sending to wallet...');

      // Cüzdandan doğrudan işlem gönderme
      if ((window as any).ethereum && walletConnected) {
        const txHash = await (window as any).ethereum.request({
          method: 'eth_sendTransaction',
          params: [{
            from: userAddress,
            to: result.data.to,
            data: result.data.data,
            value: result.data.value
          }]
        });
        addLog(`[TX_SUBMITTED] Hash: ${txHash}`);
      }

    } catch (err: any) {
      addLog(`[EXECUTION_FAILED] ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-12 flex flex-col items-center">
      
      {/* NAVBAR / HEADER */}
      <header className="max-w-4xl w-full flex justify-between items-center mb-10 pb-4 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-lg shadow-lg shadow-blue-500/30">
            A
          </div>
          <span className="font-bold text-lg tracking-wider text-slate-200">BASE INTENT AI</span>
        </div>

        <button
          onClick={connectWallet}
          className="bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-mono px-4 py-2 rounded-lg transition-all flex items-center gap-2 text-slate-200 shadow-md"
        >
          <span className={`h-2 w-2 rounded-full ${walletConnected ? 'bg-emerald-400' : 'bg-amber-400 animate-ping'}`}></span>
          {walletConnected 
            ? `${userAddress.slice(0, 6)}...${userAddress.slice(-4)}`
            : 'Connect Wallet'}
        </button>
      </header>

      <div className="max-w-3xl w-full space-y-8">
        
        {/* TITLE SECTION */}
        <div className="text-center space-y-3">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
            Autonomous Intent Protocol
          </h1>
          <p className="text-slate-400 text-sm max-w-lg mx-auto">
            Execute complex DeFi transactions on Base Mainnet with natural language prompts.
          </p>
        </div>

        {/* INPUT BOX */}
        <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
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
            className="w-full bg-slate-950/90 border border-slate-800 rounded-xl p-4 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-all h-28 resize-none font-mono text-sm"
          />

          <div className="flex justify-between items-center pt-2">
            <button
              onClick={() => setPrompt('')}
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors font-mono"
            >
              Clear
            </button>
            <button
              onClick={handleExecute}
              disabled={loading || !prompt}
              className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white font-medium px-6 py-2.5 rounded-xl text-sm transition-all shadow-lg shadow-blue-500/25 disabled:shadow-none flex items-center gap-2 font-mono"
            >
              {loading ? 'Processing...' : 'Execute Intent ⚡'}
            </button>
          </div>

          {/* POPULAR EXAMPLES */}
          <div className="pt-4 border-t border-slate-800/80">
            <p className="text-xs font-mono text-slate-400 mb-3 flex items-center gap-1.5">
              <span>⚡</span> POPULAR INTENT EXAMPLES
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <button
                onClick={() => setPrompt('Swap 0.0001 ETH for USDC')}
                className="flex items-center justify-between p-3.5 rounded-xl border border-slate-800/80 bg-slate-950/50 hover:bg-slate-800/50 hover:border-blue-500/30 transition-all text-left group"
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
                className="flex items-center justify-between p-3.5 rounded-xl border border-slate-800/80 bg-slate-950/50 hover:bg-slate-800/50 hover:border-blue-500/30 transition-all text-left group"
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
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 font-mono text-xs space-y-3 shadow-xl">
          <div className="text-slate-500 pb-2 border-b border-slate-800/80 flex justify-between items-center">
            <span>REALTIME AGENT TELEMETRY LOGS</span>
            <span className="text-[10px] text-emerald-400 flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping"></span>
              LIVE FEED
            </span>
          </div>
          <div className="max-h-48 overflow-y-auto space-y-1.5 pt-1 text-slate-300">
            {logs.map((log, index) => {
              const isError = log.includes('EXECUTION_FAILED') || log.includes('ERROR');
              const isSuccess = log.includes('ROUTE_FOUND') || log.includes('WALLET');
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
