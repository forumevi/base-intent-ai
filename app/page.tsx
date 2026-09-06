'use client';

import { useState } from 'react';

export default function Home() {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [userAddress, setUserAddress] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([
    '[SYSTEM] Agent initialized on Base Mainnet...'
  ]);

  const addLog = (msg: string) => {
    setLogs((prev) => [...prev, msg]);
  };

  const handleConnectWallet = async () => {
    if (typeof window !== 'undefined' && (window as any).ethereum) {
      try {
        const accounts = await (window as any).ethereum.request({ 
          method: 'eth_requestAccounts' 
        });
        if (accounts && accounts[0]) {
          setUserAddress(accounts[0]);
          addLog(`[WALLET_CONNECTED] ${accounts[0]}`);
        }
      } catch (err: any) {
        addLog(`[ERROR] Wallet connection failed: ${err.message}`);
      }
    } else {
      alert('Please install MetaMask, Rabby or Coinbase Wallet.');
    }
  };

  const handleExecute = async () => {
    if (!prompt) return;

    setLoading(true);
    addLog(`[INTENT_RECEIVE] "${prompt}"`);

    try {
      let currentAddress = userAddress;
      if (!currentAddress && typeof window !== 'undefined' && (window as any).ethereum) {
        const accounts = await (window as any).ethereum.request({ method: 'eth_accounts' });
        if (accounts && accounts[0]) {
          currentAddress = accounts[0];
          setUserAddress(currentAddress);
        } else {
          addLog('[PROMPT] Requesting wallet connection...');
          const reqAccounts = await (window as any).ethereum.request({ method: 'eth_requestAccounts' });
          currentAddress = reqAccounts[0];
          setUserAddress(currentAddress);
        }
      }

      addLog('[PARSING] Evaluating Base Mainnet Liquidity Routes...');
      const res = await fetch('/api/intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, userAddress: currentAddress })
      });

      const result = await res.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to generate transaction payload');
      }

      const txData = result.data;
      addLog(`[ROUTE_FOUND] ${txData.sellToken} ➔ ${txData.buyToken} via Uniswap V3`);
      addLog('[PROMPTING_WALLET] Please approve transaction in wallet...');

      const txHash = await (window as any).ethereum.request({
        method: 'eth_sendTransaction',
        params: [{
          from: currentAddress,
          to: txData.to,
          data: txData.data,
          value: txData.value
        }]
      });

      addLog(`[EXECUTION_SUCCESS] TX Hash: ${txHash}`);
    } catch (err: any) {
      console.error(err);
      addLog(`[EXECUTION_FAILED] ${err.message || 'Transaction rejected'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#040711] text-slate-100 font-sans p-4 md:p-8 selection:bg-blue-500/30">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* TOP STATUS BAR */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2 bg-[#0a0f1d] border border-slate-800/80 rounded-xl text-xs font-mono text-slate-400 shadow-sm">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-slate-200 font-semibold">BASE ENGINE: ONLINE</span>
            </span>
            <span className="text-slate-600">|</span>
            <span>ROUTER: <strong className="text-blue-400">Uniswap V3 / Aerodrome</strong></span>
            <span className="text-slate-600">|</span>
            <span>LLAMA: <strong className="text-slate-300">3.3-70B Quantized</strong></span>
          </div>
          <div className="bg-blue-600/10 text-blue-400 px-3 py-1 rounded-md border border-blue-500/20 font-bold text-[11px]">
            Base Builder Grant Submission
          </div>
        </div>

        {/* HEADER */}
        <header className="flex items-center justify-between py-2 border-b border-slate-800/60 pb-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-xl flex items-center justify-center font-bold text-lg shadow-lg shadow-blue-500/20">
              ⚡
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
                BASE INTENT AI
                <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-mono">
                  PROD AGENT
                </span>
              </h1>
              <p className="text-xs text-slate-400 font-mono">Autonomous DeFi Execution Platform</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono font-medium">
              <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
              BASE MAINNET
            </span>

            <button
              type="button"
              onClick={handleConnectWallet}
              className="bg-blue-600 hover:bg-blue-500 text-white font-mono text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-md shadow-blue-600/20 border border-blue-400/30 flex items-center gap-2 cursor-pointer"
            >
              🔒 {userAddress ? `${userAddress.slice(0, 6)}...${userAddress.slice(-4)}` : 'Connect Wallet'}
            </button>
          </div>
        </header>

        {/* HERO TITLE */}
        <div className="text-center py-6 space-y-2">
          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-200 to-blue-400">
            Autonomous Intent Protocol
          </h2>
          <p className="text-sm md:text-base text-slate-400 max-w-2xl mx-auto font-mono">
            Execute complex DeFi transactions with natural language prompts.
          </p>
        </div>

        {/* MAIN INTERACTION CARD */}
        <div className="bg-[#080d1a] border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-4 relative overflow-hidden">
          <div className="flex justify-between items-center text-xs font-mono text-slate-400 border-b border-slate-800/60 pb-2">
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 bg-blue-500 rounded-full"></span>
              INTENT PROMPT INPUT
            </span>
            <span className="text-slate-500">TARGET: <strong className="text-slate-300">BASE MAINNET (CHAIN ID 8453)</strong></span>
          </div>

          <div className="relative">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Type any natural language prompt... e.g. 'Swap 0.0001 ETH for cbETH'"
              className="w-full bg-[#030611] border border-slate-800 focus:border-blue-500/80 rounded-xl p-4 text-sm font-mono text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500/50 resize-none transition-all h-28"
            />
            
            <div className="absolute right-3 bottom-3 flex items-center gap-2">
              {prompt && (
                <button 
                  type="button"
                  onClick={() => setPrompt('')}
                  className="text-xs text-slate-500 hover:text-slate-300 px-2 py-1 font-mono cursor-pointer"
                >
                  Clear
                </button>
              )}
              <button
                type="button"
                onClick={handleExecute}
                disabled={loading || !prompt}
                className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-mono text-xs font-bold px-5 py-2.5 rounded-lg transition-all shadow-md shadow-blue-600/20 flex items-center gap-2 cursor-pointer"
              >
                {loading ? 'Processing Agent...' : 'Execute Intent ⚡'}
              </button>
            </div>
          </div>

          {/* EXAMPLES (SEÇİNCE SADECE METNİ DOLDURUR) */}
          <div className="space-y-2 pt-2">
            <div className="text-[11px] text-slate-400 font-bold font-mono tracking-wider">
              ⚡ POPULAR INTENT EXAMPLES (CLICK TO FILL)
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs font-mono">
              <button
                type="button"
                onClick={() => setPrompt('Swap 0.0001 ETH for USDC')}
                className="p-3 rounded-xl bg-[#030611] border border-slate-800/80 hover:border-blue-500/60 hover:bg-slate-900/60 text-left text-slate-300 transition-all flex items-center justify-between cursor-pointer"
              >
                <span>🔄 0.0001 ETH ➔ <strong className="text-white">USDC</strong></span>
                <span className="text-[10px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded border border-blue-500/20">Uniswap V3</span>
              </button>

              <button
                type="button"
                onClick={() => setPrompt('Swap 0.0001 ETH for cbETH')}
                className="p-3 rounded-xl bg-[#030611] border border-slate-800/80 hover:border-emerald-500/60 hover:bg-slate-900/60 text-left text-slate-300 transition-all flex items-center justify-between cursor-pointer"
              >
                <span>🔄 0.0001 ETH ➔ <strong className="text-white">cbETH</strong></span>
                <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20">Coinbase V3</span>
              </button>

              <button
                type="button"
                onClick={() => setPrompt('Swap 0.0001 ETH for DAI')}
                className="p-3 rounded-xl bg-[#030611] border border-slate-800/80 hover:border-amber-500/60 hover:bg-slate-900/60 text-left text-slate-300 transition-all flex items-center justify-between cursor-pointer"
              >
                <span>🔄 0.0001 ETH ➔ <strong className="text-white">DAI</strong></span>
                <span className="text-[10px] bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded border border-amber-500/20">Uniswap V3</span>
              </button>

              <button
                type="button"
                onClick={() => setPrompt('Swap 0.0001 ETH for AERO')}
                className="p-3 rounded-xl bg-[#030611] border border-slate-800/80 hover:border-indigo-500/60 hover:bg-slate-900/60 text-left text-slate-300 transition-all flex items-center justify-between cursor-pointer"
              >
                <span>🔄 0.0001 ETH ➔ <strong className="text-white">AERO</strong></span>
                <span className="text-[10px] bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded border border-indigo-500/20">Aerodrome Protocol</span>
              </button>
            </div>
          </div>
        </div>

        {/* LOGS */}
        <div className="bg-[#080d1a] border border-slate-800 rounded-2xl p-4 font-mono text-xs space-y-2">
          <div className="flex justify-between items-center text-slate-400 border-b border-slate-800/60 pb-2">
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 bg-emerald-400 rounded-full animate-ping"></span>
              REALTIME AGENT TELEMETRY LOGS
            </span>
            <span className="text-[10px] text-slate-500">LIVE FEED</span>
          </div>

          <div className="h-32 overflow-y-auto space-y-1 pr-2 text-slate-300 bg-[#02040a] p-3 rounded-xl border border-slate-900">
            {logs.map((log, index) => (
              <p key={index} className={
                log.includes('EXECUTION_SUCCESS') ? 'text-emerald-400 font-bold' :
                log.includes('EXECUTION_FAILED') ? 'text-red-400' :
                log.includes('ROUTE_FOUND') ? 'text-blue-400' : 'text-slate-400'
              }>
                {log}
              </p>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
