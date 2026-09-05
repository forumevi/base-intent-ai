'use client';

import { useState, useEffect } from 'react';
import { useAccount, useConnect, useDisconnect, useChainId, useSendTransaction, useSwitchChain } from 'wagmi';

export default function Home() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const currentChainId = useChainId();
  const { switchChain } = useSwitchChain();
  const { sendTransactionAsync } = useSendTransaction();

  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeStep, setActiveStep] = useState<number>(0);
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);
  const [agentLogs, setAgentLogs] = useState<string[]>([
    'BASE_ENGINE_INIT: Base Agentic Execution Environment Active',
    'AI_MODEL_READY: Groq Llama 3.3 70B Quantized Engine Standby',
    'AWAITING_USER_INTENT: Connect Web3 Wallet to Execute On-Chain Actions'
  ]);

  const isSepolia = currentChainId === 84532;

  const handleConnectWallet = () => {
    if (connectors && connectors.length > 0) {
      connect({ connector: connectors[0] });
    } else {
      alert('No Web3 wallet extension found! Please install MetaMask or Rabby Wallet.');
    }
  };

  useEffect(() => {
    if (isConnected && address) {
      setAgentLogs((prev) => [
        `WALLET_CONNECTED: ${address.slice(0, 6)}...${address.slice(-4)}`,
        `CHAIN_STATE: Chain ID ${currentChainId} (${isSepolia ? 'Base Sepolia Testnet' : 'Base Mainnet'})`,
        ...prev
      ]);
    }
  }, [isConnected, address, currentChainId, isSepolia]);

  const handleRunAgent = async (selectedPrompt?: string) => {
    const activePrompt = selectedPrompt || prompt;
    if (!activePrompt) return;

    if (!isConnected) {
      handleConnectWallet();
      return;
    }

    setLoading(true);
    setLastTxHash(null);
    setActiveStep(1);

    setAgentLogs((prev) => [
      `[${new Date().toLocaleTimeString()}] STEP 1/3: Parsing Natural Language Intent...`,
      `[${new Date().toLocaleTimeString()}] PROMPT: "${activePrompt}"`,
      ...prev
    ]);

    try {
      const res = await fetch('/api/intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: activePrompt, userAddress: address })
      });
      const data = await res.json();

      if (!data.success) throw new Error(data.error || 'Failed to parse AI intent');

      setActiveStep(2);
      const txData = data.data.aggregatorQuote.transaction;

      setAgentLogs((prev) => [
        `[${new Date().toLocaleTimeString()}] STEP 2/3: Base Calldata Generated Successfully`,
        `[${new Date().toLocaleTimeString()}] TARGET_CONTRACT: ${txData.to}`,
        `[${new Date().toLocaleTimeString()}] AWAITING_SIGNATURE: Prompting user wallet...`,
        ...prev
      ]);

      const txHash = await sendTransactionAsync({
        to: txData.to as `0x${string}`,
        data: txData.data as `0x${string}`,
        value: BigInt(txData.value || '0')
      });

      setActiveStep(3);
      setLastTxHash(txHash);

      setAgentLogs((prev) => [
        `[${new Date().toLocaleTimeString()}] STEP 3/3: ON-CHAIN TRANSACTION CONFIRMED!`,
        `[${new Date().toLocaleTimeString()}] HASH: ${txHash}`,
        ...prev
      ]);

    } catch (err: any) {
      setActiveStep(0);
      setAgentLogs((prev) => [
        `[${new Date().toLocaleTimeString()}] EXECUTION_ERROR: ${err.message || 'Transaction cancelled by user'}`,
        ...prev
      ]);
    } finally {
      setLoading(false);
    }
  };

  const explorerBaseUrl = isSepolia 
    ? 'https://base-sepolia.blockscout.com/tx/' 
    : 'https://base.blockscout.com/tx/';

  return (
    <main className="min-h-screen bg-[#030407] text-slate-100 flex flex-col items-center p-4 md:p-8 relative overflow-hidden font-sans selection:bg-blue-500 selection:text-white">
      
      <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-blue-600/15 blur-[140px] pointer-events-none rounded-full" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[400px] h-[300px] bg-indigo-600/10 blur-[120px] pointer-events-none rounded-full" />

      <div className="w-full max-w-4xl z-10 mb-6 flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-2xl bg-gradient-to-r from-blue-950/40 via-slate-900/60 to-slate-950/40 border border-blue-500/20 backdrop-blur-xl shadow-[0_0_25px_rgba(0,82,255,0.08)]">
        <div className="flex items-center gap-3">
          <span className="px-2.5 py-1 rounded-lg bg-blue-500/20 border border-blue-500/40 text-blue-400 font-mono text-[10px] font-bold tracking-wider uppercase">
            Base Creator Grant Build
          </span>
          <span className="text-xs text-slate-300 font-medium">
            {!isSepolia ? '🔴 Base Mainnet (Real On-Chain Value)' : '🟡 Base Sepolia Testnet'}
          </span>
        </div>

        <button 
          onClick={() => {
            const targetChainId = isSepolia ? 8453 : 84532;
            switchChain?.({ chainId: targetChainId });
          }}
          className="px-3 py-1 bg-slate-900 hover:bg-slate-800 rounded-xl text-[11px] border border-slate-700 text-slate-300 transition font-mono cursor-pointer"
        >
          {isSepolia ? "Switch to Mainnet 🚀" : "Switch to Sepolia 🧪"}
        </button>
      </div>

      <div className="w-full max-w-4xl z-10 flex items-center justify-between py-4 px-6 rounded-2xl bg-slate-900/40 border border-slate-800/80 backdrop-blur-2xl mb-8 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center font-black text-white text-sm shadow-[0_0_15px_rgba(0,82,255,0.5)]">
            🛡️
          </div>
          <div>
            <div className="font-bold text-sm tracking-wide text-white flex items-center gap-2">
              BASE INTENT AI <span className="text-[10px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full border border-blue-500/30">v2.0</span>
            </div>
            <div className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              BASE L2 AGENT // ONLINE
            </div>
          </div>
        </div>

        {isConnected ? (
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col text-right font-mono text-[11px]">
              <span className="text-slate-400">CONNECTED</span>
              <span className="text-blue-400 font-bold">{address?.slice(0, 6)}...{address?.slice(-4)}</span>
            </div>
            <button 
              onClick={() => disconnect()}
              className="text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 px-3 py-2 rounded-xl border border-red-500/30 transition font-mono cursor-pointer"
            >
              Disconnect
            </button>
          </div>
        ) : (
          <button 
            onClick={handleConnectWallet}
            className="text-xs bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold px-5 py-2.5 rounded-xl transition shadow-[0_0_20px_rgba(0,82,255,0.4)] font-mono cursor-pointer active:scale-95"
          >
            Connect Wallet 🔒
          </button>
        )}
      </div>

      <div className="max-w-2xl w-full z-10 space-y-6">
        
        <div className="text-center space-y-3">
          <h1 className="text-3xl md:text-5xl font-black tracking-tight text-white leading-tight">
            Autonomous <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">DeFi Intents</span> on Base
          </h1>
          <p className="text-slate-400 text-xs md:text-sm font-mono max-w-lg mx-auto">
            Transform plain text prompt into executed Base L2 transactions using Groq AI & Viem Engine.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2 p-3 bg-slate-950/60 border border-slate-800/80 rounded-2xl backdrop-blur-md text-[11px] font-mono">
          <div className={`p-2 rounded-xl border text-center transition-all ${
            activeStep >= 1 ? 'bg-blue-600/20 border-blue-500 text-blue-300 shadow-[0_0_10px_rgba(0,82,255,0.2)]' : 'bg-slate-900/40 border-slate-800 text-slate-500'
          }`}>
            1. AI Parsing
          </div>
          <div className={`p-2 rounded-xl border text-center transition-all ${
            activeStep >= 2 ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300 shadow-[0_0_10px_rgba(99,102,241,0.2)]' : 'bg-slate-900/40 border-slate-800 text-slate-500'
          }`}>
            2. Base Routing
          </div>
          <div className={`p-2 rounded-xl border text-center transition-all ${
            activeStep === 3 ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.2)]' : 'bg-slate-900/40 border-slate-800 text-slate-500'
          }`}>
            3. On-Chain Exec
          </div>
        </div>

        <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 backdrop-blur-2xl shadow-[0_10px_30px_rgba(0,0,0,0.5)] space-y-4">
          <div className="relative">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. Swap 0.0001 ETH for USDC on Base..."
              className="w-full h-32 bg-[#05070D] border border-slate-800/80 rounded-2xl p-4 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500/80 font-mono resize-none transition shadow-inner"
            />
            <button
              onClick={() => handleRunAgent()}
              disabled={loading}
              className="absolute bottom-3 right-3 px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-xs rounded-xl shadow-[0_0_15px_rgba(0,82,255,0.4)] disabled:opacity-40 transition font-mono cursor-pointer"
            >
              {loading ? 'Executing AI Pipeline...' : isConnected ? 'Execute Intent ⚡' : 'Connect Wallet 🔒'}
            </button>
          </div>

          <div className="space-y-1.5">
            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Suggested Base Intents</span>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                onClick={() => setPrompt('Swap 0.0001 ETH for USDC')}
                className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-blue-500/50 text-left text-slate-300 font-mono transition group flex items-center justify-between cursor-pointer"
              >
                <span>🔄 Swap 0.0001 ETH ➔ USDC</span>
                <span className="opacity-0 group-hover:opacity-100 text-blue-400 transition">↗</span>
              </button>
              <button
                onClick={() => setPrompt('Swap 1 USDC for ETH')}
                className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-blue-500/50 text-left text-slate-300 font-mono transition group flex items-center justify-between cursor-pointer"
              >
                <span>🔄 Swap 1 USDC ➔ ETH</span>
                <span className="opacity-0 group-hover:opacity-100 text-blue-400 transition">↗</span>
              </button>
            </div>
          </div>
        </div>

        {lastTxHash && (
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono flex items-center justify-between shadow-[0_0_20px_rgba(16,185,129,0.15)] animate-fade-in">
            <div className="flex items-center gap-2">
              <span className="text-base">🎉</span>
              <span>Transaction Confirmed on Base!</span>
            </div>
            <a 
              href={`${explorerBaseUrl}${lastTxHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 rounded-xl font-bold transition flex items-center gap-1"
            >
              Blockscout Explorer ↗
            </a>
          </div>
        )}

        <div className="bg-[#020305] border border-slate-800/80 rounded-2xl p-4 font-mono text-xs text-slate-400 space-y-2 shadow-2xl">
          <div className="text-slate-500 border-b border-slate-800/80 pb-2 flex justify-between items-center text-[11px]">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              ON-CHAIN AGENT TELEMETRY LOGS
            </span>
            <span className={isConnected ? "text-emerald-400 font-bold" : "text-slate-600"}>
              {isConnected ? 'NODE_CONNECTED' : 'DISCONNECTED'}
            </span>
          </div>
          <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1 scrollbar-thin">
            {agentLogs.map((log, i) => (
              <div key={i} className="leading-relaxed flex items-start gap-2">
                <span className="text-blue-500 select-none">›</span>
                <span className={log.includes('CONFIRMED') ? 'text-emerald-400 font-bold' : log.includes('STEP') ? 'text-blue-300' : 'text-slate-300'}>
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
