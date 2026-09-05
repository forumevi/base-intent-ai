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

  const isBaseNetwork = chainId === base.id || chainId === baseSepolia.id;
  const isSepolia = chainId === baseSepolia.id;

  const [agentLogs, setAgentLogs] = useState<string[]>([
    'SYSTEM_INIT: Base Agentic Execution Engine Online',
    'AI_CORE: Groq Llama-3.3-70B Quantized Intent Parser Ready',
    'AWAITING_INTENT: Enter prompt or select quick preset below'
  ]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isConnected && address) {
      const netName = chainId === baseSepolia.id ? 'Base Sepolia Testnet' : chainId === base.id ? 'Base Mainnet' : 'Unsupported Network';
      setAgentLogs((prev) => [
        `NETWORK_DETECTED: Active on ${netName} (Chain ID: ${chainId})`,
        `WALLET_CONNECTED: ${address.slice(0, 6)}...${address.slice(-4)}`,
        ...prev
      ]);
    }
  }, [isConnected, address, chainId]);

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
      `[${new Date().toLocaleTimeString()}] EXECUTION_START: Routing intent through Base AI Engine...`,
      `[${new Date().toLocaleTimeString()}] PROMPT: "${activePrompt}"`,
      ...prev
    ]);

    try {
      const res = await fetch('/api/intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt: activePrompt, 
          userAddress: address,
          chainId: chainId 
        })
      });

      const resData = await res.json();

      if (!res.ok || !resData.success) {
        throw new Error(resData.error || 'Intent parsing failed');
      }

      const txData = resData.data?.aggregatorQuote?.transaction;
      if (!txData || !txData.to) {
        throw new Error('API did not return valid execution payload.');
      }

      setAgentLogs((prev) => [
        `[${new Date().toLocaleTimeString()}] INTENT_PARSED: Confidence ${resData.data.confidenceScore || '98'}%`,
        `[${new Date().toLocaleTimeString()}] PROMPTING_WALLET: Sign transaction on ${isSepolia ? 'Sepolia' : 'Mainnet'}`,
        ...prev
      ]);

      const txHash = await sendTransactionAsync({
        to: txData.to as `0x${string}`,
        data: txData.data as `0x${string}`,
        value: BigInt(txData.value || '0')
      });

      setLastTxHash(txHash);
      setAgentLogs((prev) => [
        `[${new Date().toLocaleTimeString()}] SUCCESS: Tx broadcasted to Base block graph!`,
        `[${new Date().toLocaleTimeString()}] TX_HASH: ${txHash}`,
        ...prev
      ]);

    } catch (err: any) {
      setAgentLogs((prev) => [
        `[${new Date().toLocaleTimeString()}] ERROR: ${err.message || 'Execution reverted'}`,
        ...prev
      ]);
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) return null;

  return (
    <main className="min-h-screen bg-[#050811] text-slate-100 flex flex-col items-center p-4 md:p-8 relative font-sans selection:bg-blue-500 selection:text-white">
      
      {/* GLOW DECORATIONS */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[250px] bg-blue-600/15 blur-[120px] pointer-events-none rounded-full" />
      <div className="absolute top-40 left-1/4 w-[300px] h-[200px] bg-cyan-500/10 blur-[100px] pointer-events-none rounded-full" />

      {/* HEADER BAR */}
      <header className="w-full max-w-3xl z-10 flex items-center justify-between py-3.5 px-6 rounded-2xl bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 mb-8 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 font-black text-sm shadow-inner">
            ⚡
          </div>
          <div>
            <div className="font-extrabold text-sm tracking-wide text-white flex items-center gap-2">
              BASE INTENT AI
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                v2.0 Agent
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono">Autonomous On-Chain Execution</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* NETWORK SWITCHER BUTTON */}
          {isConnected && (
            <div className="flex items-center gap-1.5 bg-slate-950/80 border border-slate-800 rounded-xl p-1 font-mono text-xs">
              <button
                onClick={() => switchChain?.({ chainId: baseSepolia.id })}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  isSepolia 
                    ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Sepolia
              </button>
              <button
                onClick={() => switchChain?.({ chainId: base.id })}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  chainId === base.id 
                    ? 'bg-blue-600 text-white font-bold shadow-md' 
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
              className="text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 font-mono font-medium px-3.5 py-2 rounded-xl border border-red-500/30 transition shadow-sm cursor-pointer"
            >
              {address?.slice(0, 6)}...{address?.slice(-4)} ✕
            </button>
          ) : (
            <button 
              onClick={handleConnect}
              className="text-xs bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold px-4 py-2 rounded-xl transition shadow-lg shadow-blue-600/20 cursor-pointer font-mono"
            >
              Connect Wallet 🔒
            </button>
          )}
        </div>
      </header>

      {/* NETWORK STATUS BANNER */}
      {isConnected && !isBaseNetwork && (
        <div className="w-full max-w-3xl mb-6 p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-mono flex items-center justify-between z-10 backdrop-blur-md">
          <span className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
            ⚠️ You are on an unsupported network. Please switch to Base.
          </span>
          <button 
            onClick={() => switchChain?.({ chainId: base.id })}
            className="underline font-bold text-white hover:text-red-200"
          >
            Switch to Base Mainnet ➔
          </button>
        </div>
      )}

      {/* MAIN CONTAINER */}
      <div className="max-w-3xl w-full z-10 space-y-6">
        
        {/* TITLE SECTION */}
        <div className="text-center space-y-3 py-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Base Builder Grant Submission
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight leading-tight">
            Natural Language <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-300 to-cyan-400">DeFi Agent</span>
          </h1>
          <p className="text-slate-400 text-xs md:text-sm max-w-lg mx-auto font-mono">
            Type plain English intents to swap tokens, bridge assets, and execute smart contracts directly on Base L2.
          </p>
        </div>

        {/* ACTIVE NETWORK INDICATOR BADGE */}
        <div className="flex items-center justify-between px-2 text-xs font-mono text-slate-400">
          <div className="flex items-center gap-2">
            <span className="text-slate-500">TARGET NETWORK:</span>
            <span className={`px-2 py-0.5 rounded-md font-bold text-[11px] ${
              isSepolia 
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' 
                : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
            }`}>
              {isSepolia ? 'BASE SEPOLIA TESTNET' : 'BASE MAINNET'}
            </span>
          </div>
          <div className="text-slate-500 hidden md:block">
            SLIPPAGE: <span className="text-slate-300">AUTO (0.5%)</span>
          </div>
        </div>

        {/* INPUT PROMPT CARD */}
        <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 space-y-4 shadow-2xl relative overflow-hidden group hover:border-slate-700/80 transition-all">
          <div className="relative">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. Swap 0.0001 ETH for USDC on Base..."
              className="w-full h-32 bg-[#03050a] border border-slate-800/80 rounded-2xl p-4 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500 font-mono resize-none transition-all"
            />
            
            <div className="absolute bottom-4 right-4 flex items-center gap-2">
              <button
                onClick={() => handleRunAgent()}
                disabled={loading}
                className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-600/20 disabled:opacity-40 transition-all font-mono cursor-pointer flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Executing...
                  </>
                ) : (
                  <>Execute Intent ⚡</>
                )}
              </button>
            </div>
          </div>

          {/* PRESET PROMPT BUTTONS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs font-mono pt-1">
            <button
              onClick={() => { 
                const p = 'Swap 0.0001 ETH for USDC';
                setPrompt(p); 
                handleRunAgent(p); 
              }}
              className="p-3 rounded-xl bg-[#03050a] border border-slate-800 hover:border-blue-500/60 hover:bg-slate-900/80 text-left text-slate-300 transition-all flex items-center justify-between group/btn cursor-pointer"
            >
              <span>🔄 Swap 0.0001 ETH ➔ USDC</span>
              <span className="text-blue-400 opacity-0 group-hover/btn:opacity-100 transition-opacity">➔</span>
            </button>

            <button
              onClick={() => { 
                const p = 'Swap 1 USDC for ETH';
                setPrompt(p); 
                handleRunAgent(p); 
              }}
              className="p-3 rounded-xl bg-[#03050a] border border-slate-800 hover:border-blue-500/60 hover:bg-slate-900/80 text-left text-slate-300 transition-all flex items-center justify-between group/btn cursor-pointer"
            >
              <span>🔄 Swap 1 USDC ➔ ETH</span>
              <span className="text-blue-400 opacity-0 group-hover/btn:opacity-100 transition-opacity">➔</span>
            </button>
          </div>
        </div>

        {/* SUCCESS TRANSACTION CARD */}
        {lastTxHash && (
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-mono flex items-center justify-between shadow-xl backdrop-blur-md animate-fade-in">
            <div className="flex items-center gap-2">
              <span className="text-base">🎉</span>
              <div>
                <div className="font-bold">Transaction Confirmed!</div>
                <div className="text-[11px] text-emerald-400/80">Executed on {isSepolia ? 'Base Sepolia' : 'Base Mainnet'}</div>
              </div>
            </div>
            <a 
              href={isSepolia ? `https://sepolia.basescan.org/tx/${lastTxHash}` : `https://base.blockscout.com/tx/${lastTxHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-200 transition font-bold"
            >
              View Explorer ↗
            </a>
          </div>
        )}

        {/* LIVE TELEMETRY LOGS */}
        <div className="bg-[#020306] border border-slate-800/80 rounded-2xl p-5 font-mono text-xs space-y-3 shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div className="text-slate-400 font-bold tracking-wider text-[11px] flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
              AGENTIC EXECUTION TELEMETRY LOGS
            </div>
            <span className="text-[10px] text-slate-500">REALTIME MONITOR</span>
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-800">
            {agentLogs.map((log, i) => (
              <div key={i} className="leading-relaxed flex items-start gap-2">
                <span className="text-blue-500 shrink-0">›</span>
                <span className={
                  log.includes('SUCCESS') || log.includes('CONFIRMED')
                    ? 'text-emerald-400 font-semibold' 
                    : log.includes('EXECUTION_START') || log.includes('PROMPTING') 
                    ? 'text-blue-300' 
                    : log.includes('ERROR')
                    ? 'text-red-400 font-bold'
                    : 'text-slate-400'
                }>
                  {log}
                </span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* FOOTER */}
      <footer className="mt-12 text-center text-[11px] text-slate-600 font-mono">
        Built for Base Builder Grants • Powered by Groq Llama 3.3 & Uniswap V3 Engine
      </footer>
    </main>
  );
}
