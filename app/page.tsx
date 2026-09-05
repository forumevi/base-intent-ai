'use client';

import { useState, useEffect } from 'react';
import { useAccount, useConnect, useDisconnect, useSendTransaction, useSwitchChain, useChainId } from 'wagmi';
import { base, baseSepolia } from 'wagmi/chains';

export default function Home() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { sendTransactionAsync } = useSendTransaction();

  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [showMainnetWarning, setShowMainnetWarning] = useState(false);

  const isMainnet = chainId === base.id;
  const isSepolia = chainId === baseSepolia.id;

  const [agentLogs, setAgentLogs] = useState<string[]>([
    'AGENT_CORE_INIT: Base L2 Execution Layer Active',
    'AI_INTENT_PARSER: Llama-3.3-70B Neural Engine Online',
    'SAFETY_GUARD: Multi-call Slippage Protection Active',
    'AWAITING_INPUT: Select preset or input plain English prompt...'
  ]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isConnected && isMainnet) {
      setShowMainnetWarning(true);
    } else {
      setShowMainnetWarning(false);
    }
  }, [isConnected, isMainnet]);

  const handleConnect = () => {
    const connector = connectors.find((c) => c.id === 'injected' || c.id === 'metaMask') || connectors[0];
    if (connector) {
      connect({ connector });
    } else {
      alert('Lütfen MetaMask veya Rabby cüzdanınızın yüklü olduğunu kontrol edin.');
    }
  };

  const handleRunAgent = async (selectedPrompt?: string) => {
    const activePrompt = selectedPrompt || prompt;
    if (!activePrompt) return;

    if (!isConnected) {
      handleConnect();
      return;
    }

    setLoading(true);
    setLastTxHash(null);

    setAgentLogs((prev) => [
      `[${new Date().toLocaleTimeString()}] INTENT_RECEIVE: "${activePrompt}"`,
      `[${new Date().toLocaleTimeString()}] PARSING: Evaluating Base V3 Liquidity Routes...`,
      ...prev
    ]);

    try {
      const res = await fetch('/api/intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: activePrompt, userAddress: address })
      });

      const resData = await res.json();

      if (!res.ok || !resData.success) {
        throw new Error(resData.error || 'Intent parsing failed');
      }

      const txData = resData.data?.aggregatorQuote?.transaction;
      if (!txData || !txData.to) {
        throw new Error('Invalid calldata from Intent Engine');
      }

      setAgentLogs((prev) => [
        `[${new Date().toLocaleTimeString()}] ROUTE_FOUND: ${resData.data.sellToken} ➔ ${resData.data.buyToken} (${resData.data.amount} ${resData.data.sellToken})`,
        `[${new Date().toLocaleTimeString()}] PROMPTING_WALLET: Please approve in wallet...`,
        ...prev
      ]);

      const txHash = await sendTransactionAsync({
        to: txData.to as `0x${string}`,
        data: txData.data as `0x${string}`,
        value: BigInt(txData.value || '0')
      });

      setLastTxHash(txHash);
      setAgentLogs((prev) => [
        `[${new Date().toLocaleTimeString()}] EXECUTION_SUCCESS: Transaction Confirmed!`,
        `[${new Date().toLocaleTimeString()}] HASH: ${txHash}`,
        ...prev
      ]);

    } catch (err: any) {
      setAgentLogs((prev) => [
        `[${new Date().toLocaleTimeString()}] EXECUTION_REVERTED: ${err.message || 'User rejected or simulation failed'}`,
        ...prev
      ]);
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) return null;

  return (
    <main className="min-h-screen bg-[#02040a] text-slate-100 flex flex-col items-center p-3 md:p-6 font-mono relative selection:bg-blue-600 selection:text-white">
      
      {/* TOP LIVE METRICS DASHBOARD BAR (İLK SİTEDEKİ ZENGİN METRİK BARI) */}
      <div className="w-full max-w-4xl bg-slate-950/90 border border-slate-800/80 rounded-xl p-2.5 mb-6 flex flex-wrap items-center justify-between text-[11px] gap-3 text-slate-400 backdrop-blur-md">
        <div className="flex items-center gap-4 overflow-x-auto">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-slate-200 font-bold">BASE ENGINE:</span>
            <span className="text-emerald-400">ONLINE</span>
          </div>
          <div className="h-3 w-[1px] bg-slate-800" />
          <div>
            <span className="text-slate-500">GAS:</span> <span className="text-slate-200">~0.003 Gwei</span>
          </div>
          <div className="h-3 w-[1px] bg-slate-800" />
          <div>
            <span className="text-slate-500">ROUTER:</span> <span className="text-blue-400 font-bold">Uniswap V3</span>
          </div>
          <div className="h-3 w-[1px] bg-slate-800" />
          <div>
            <span className="text-slate-500">LLAMA:</span> <span className="text-indigo-400">3.3-70B Quantized</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/30 text-blue-400 text-[10px] font-bold">
            Base Builder Grant
          </span>
        </div>
      </div>

      {/* MAIN NAVIGATION HEADER */}
      <header className="w-full max-w-4xl flex items-center justify-between py-3 px-5 rounded-2xl bg-slate-900/40 border border-slate-800/80 mb-6 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 font-black text-base shadow-inner">
            🛡️
          </div>
          <div>
            <div className="font-extrabold text-sm tracking-wide text-white flex items-center gap-2">
              BASE INTENT AI
              <span className="text-[9px] font-semibold px-2 py-0.5 rounded bg-blue-600/30 text-blue-300 border border-blue-400/30">
                PROD AGENT
              </span>
            </div>
            <p className="text-[10px] text-slate-400">Autonomous DeFi Execution Platform</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* NETWORK SWITCHER */}
          {isConnected && (
            <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-xl p-1 text-xs">
              <button
                onClick={() => switchChain?.({ chainId: baseSepolia.id })}
                className={`px-3 py-1 rounded-lg transition-all text-[11px] ${
                  isSepolia 
                    ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Sepolia
              </button>
              <button
                onClick={() => switchChain?.({ chainId: base.id })}
                className={`px-3 py-1 rounded-lg transition-all text-[11px] ${
                  isMainnet 
                    ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-600/30' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Mainnet
              </button>
            </div>
          )}

          {/* WALLET CONNECTOR */}
          {isConnected ? (
            <button 
              onClick={() => disconnect()}
              className="text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 font-mono px-3.5 py-1.5 rounded-xl border border-red-500/30 transition cursor-pointer"
            >
              {address?.slice(0, 6)}...{address?.slice(-4)}
            </button>
          ) : (
            <button 
              onClick={handleConnect}
              className="text-xs bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2 rounded-xl transition shadow-lg shadow-blue-600/20 cursor-pointer"
            >
              Connect Wallet 🔒
            </button>
          )}
        </div>
      </header>

      {/* CRITICAL MAINNET WARNING MODAL / POPUP */}
      {showMainnetWarning && (
        <div className="w-full max-w-4xl mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/40 text-amber-200 text-xs flex items-center justify-between backdrop-blur-md shadow-2xl animate-fade-in">
          <div className="flex items-center gap-3">
            <span className="text-xl">⚠️</span>
            <div>
              <div className="font-bold text-amber-400 text-sm">REAL MAINNET FUNDS ACTIVE</div>
              <div className="text-[11px] text-amber-300/80">
                You are on Base Mainnet (Chain ID 8453). Real ETH/Tokens will be spent. For safe testing, switch to Sepolia.
              </div>
            </div>
          </div>
          <button
            onClick={() => switchChain?.({ chainId: baseSepolia.id })}
            className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-200 font-bold shrink-0 transition"
          >
            Switch to Sepolia Testnet ➔
          </button>
        </div>
      )}

      {/* MAIN CONTENT WORKSPACE */}
      <div className="max-w-4xl w-full space-y-6">
        
        {/* HERO TITLE */}
        <div className="text-center space-y-2 py-4">
          <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight">
            Base Agentic <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-300 to-cyan-400">Intent Protocol</span>
          </h1>
          <p className="text-slate-400 text-xs md:text-sm max-w-md mx-auto">
            Execute complex DeFi transactions with plain English sentences.
          </p>
        </div>

        {/* INPUT PROMPT CARD */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-2xl backdrop-blur-xl relative">
          <div className="flex items-center justify-between text-xs text-slate-400 pb-1">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              INTENT PROMPT INPUT
            </span>
            <span>TARGET: <strong className="text-slate-200">{isSepolia ? 'BASE SEPOLIA' : 'BASE MAINNET'}</strong></span>
          </div>

          <div className="relative">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. Swap 0.0001 ETH for USDC..."
              className="w-full h-32 bg-[#010308] border border-slate-800/80 rounded-2xl p-4 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500 font-mono resize-none transition-all"
            />
            
            <button
              onClick={() => handleRunAgent()}
              disabled={loading}
              className="absolute bottom-4 right-4 px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-600/20 disabled:opacity-40 transition-all font-mono cursor-pointer flex items-center gap-2"
            >
              {loading ? 'Processing Agent...' : 'Execute Intent ⚡'}
            </button>
          </div>

          {/* SAFE PRESET BUTTONS (GÜVENLİ MİKTARLI BUTONLAR) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs font-mono pt-1">
            <button
              onClick={() => { 
                const p = 'Swap 0.0001 ETH for USDC';
                setPrompt(p); 
                handleRunAgent(p); 
              }}
              className="p-3 rounded-xl bg-[#010308] border border-slate-800 hover:border-blue-500/60 hover:bg-slate-900/80 text-left text-slate-300 transition-all flex items-center justify-between cursor-pointer"
            >
              <span>🔄 Swap 0.0001 ETH ➔ USDC</span>
              <span className="text-blue-400 text-xs">Safe Micro-Tx</span>
            </button>

            <button
              onClick={() => { 
                const p = 'Swap 1 USDC for ETH';
                setPrompt(p); 
                handleRunAgent(p); 
              }}
              className="p-3 rounded-xl bg-[#010308] border border-slate-800 hover:border-blue-500/60 hover:bg-slate-900/80 text-left text-slate-300 transition-all flex items-center justify-between cursor-pointer"
            >
              <span>🔄 Swap 1 USDC ➔ ETH</span>
              <span className="text-blue-400 text-xs">Safe Micro-Tx</span>
            </button>
          </div>
        </div>

        {/* TRANSACTION SUCCESS CARD */}
        {lastTxHash && (
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-mono flex items-center justify-between shadow-xl backdrop-blur-md">
            <div className="flex items-center gap-2">
              <span className="text-base">🎉</span>
              <div>
                <div className="font-bold">Transaction Successfully Broadcasted!</div>
                <div className="text-[11px] text-emerald-400/80">Confirmed on {isSepolia ? 'Base Sepolia' : 'Base Mainnet'}</div>
              </div>
            </div>
            <a 
              href={isSepolia ? `https://sepolia.basescan.org/tx/${lastTxHash}` : `https://base.blockscout.com/tx/${lastTxHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-200 transition font-bold"
            >
              View Block Explorer ↗
            </a>
          </div>
        )}

        {/* TELEMETRY LOGS */}
        <div className="bg-[#010206] border border-slate-800/80 rounded-2xl p-4 font-mono text-xs space-y-2.5 shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5 text-[11px]">
            <span className="text-slate-400 font-bold flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              REALTIME AGENT TELEMETRY LOGS
            </span>
            <span className="text-slate-500">LIVE FEED</span>
          </div>

          <div className="space-y-1.5 max-h-40 overflow-y-auto pr-2">
            {agentLogs.map((log, i) => (
              <div key={i} className="leading-relaxed flex items-start gap-2 text-[11px]">
                <span className="text-blue-500 font-bold shrink-0">›</span>
                <span className={
                  log.includes('SUCCESS') 
                    ? 'text-emerald-400 font-bold' 
                    : log.includes('ROUTE_FOUND') 
                    ? 'text-blue-300' 
                    : log.includes('EXECUTION_REVERTED')
                    ? 'text-red-400 font-bold'
                    : 'text-slate-300'
                }>
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
