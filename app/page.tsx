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
  const [isMainnet, setIsMainnet] = useState(true);
  const [agentLogs, setAgentLogs] = useState<string[]>([
    'SYSTEM_INIT: Base Swap Engine Active',
    'AWAITING: Connect Web3 Wallet'
  ]);

  useEffect(() => {
    if (isConnected) {
      setAgentLogs((prev) => [
        `WALLET_CONNECTED: ${address?.slice(0, 6)}...${address?.slice(-4)}`,
        `CURRENT_CHAIN_ID: ${currentChainId}`,
        ...prev
      ]);
    }
  }, [isConnected, address, currentChainId]);

  const handleRunAgent = async (selectedPrompt?: string) => {
    const activePrompt = selectedPrompt || prompt;
    if (!activePrompt) return;

    if (!isConnected) {
      alert('Lütfen önce cüzdanınızı bağlayın!');
      return;
    }

    setLoading(true);
    setAgentLogs((prev) => [
      `[${new Date().toLocaleTimeString()}] INTENT: "${activePrompt}"`,
      `[${new Date().toLocaleTimeString()}] Base AI Routing...`,
      ...prev
    ]);

    try {
      const res = await fetch('/api/intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: activePrompt, userAddress: address })
      });
      const data = await res.json();

      if (!data.success) throw new Error(data.error);

      const txData = data.data.aggregatorQuote.transaction;

      // Cüzdana İşlem Gönderme
      setAgentLogs((prev) => [
        `[${new Date().toLocaleTimeString()}] SIGNING: Confirm transaction in wallet...`,
        ...prev
      ]);

      const txHash = await sendTransactionAsync({
        to: txData.to as `0x${string}`,
        data: txData.data as `0x${string}`,
        value: BigInt(txData.value)
      });

      setAgentLogs((prev) => [
        `[${new Date().toLocaleTimeString()}] SUCCESS: TX Broadcasted! Hash: ${txHash.slice(0, 10)}...`,
        ...prev
      ]);

    } catch (err: any) {
      setAgentLogs((prev) => [
        `[${new Date().toLocaleTimeString()}] ERROR: ${err.message || 'Transaction Rejected'}`,
        ...prev
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#07080C] text-slate-100 flex flex-col items-center p-4 md:p-8 relative overflow-hidden font-sans">
      
      {/* ⚠️ MAINNET / SEPOLIA WARNING BANNER */}
      <div className={`w-full max-w-4xl py-2 px-4 rounded-xl text-xs font-semibold flex items-center justify-between mb-6 border ${
        isMainnet 
          ? 'bg-amber-500/10 border-amber-500/30 text-amber-300' 
          : 'bg-blue-500/10 border-blue-500/30 text-blue-300'
      }`}>
        <div className="flex items-center gap-2">
          <span>⚠️</span>
          <span>
            {isMainnet 
              ? 'CANLI AĞ (BASE MAINNET): Gerçek fonlar (Real Value) kullanılmaktadır.' 
              : 'TESTNET (BASE SEPOLIA): Test bakiyeleri kullanılmaktadır.'}
          </span>
        </div>
        <button 
          onClick={() => {
            const targetChainId = isMainnet ? 84532 : 8453; // Base Sepolia vs Base Mainnet
            switchChain?.({ chainId: targetChainId });
            setIsMainnet(!isMainnet);
          }}
          className="underline hover:text-white text-[11px]"
        >
          {isMainnet ? "Sepolia'ya Geç" : "Mainnet'e Geç"}
        </button>
      </div>

      {/* Top Navbar Header */}
      <div className="w-full max-w-4xl flex items-center justify-between py-3 px-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md mb-8 shadow-xl">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-blue-500 animate-pulse" />
          <span className="font-bold text-sm tracking-wide">BaseSwap.ai</span>
        </div>

        {/* Custom Wallet Button */}
        {isConnected ? (
          <div className="flex items-center gap-3">
            <span className="text-xs bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700 font-mono">
              {address?.slice(0, 6)}...{address?.slice(-4)}
            </span>
            <button 
              onClick={() => disconnect()}
              className="text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 px-3 py-1.5 rounded-xl border border-red-500/30 transition"
            >
              Çıkış
            </button>
          </div>
        ) : (
          <button 
            onClick={() => connect({ connector: connectors[0] })}
            className="text-xs bg-blue-600 hover:bg-blue-500 text-white font-semibold px-4 py-2 rounded-xl transition shadow-lg"
          >
            Cüzdan Bağla 🔒
          </button>
        )}
      </div>

      <div className="max-w-2xl w-full z-10 space-y-6">
        
        {/* Title */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-black tracking-tight text-white">
            Base Network <span className="text-blue-500">AI Swap</span>
          </h1>
          <p className="text-slate-400 text-xs">
            Doğal dille yazın, Base ağında anında swap yapın.
          </p>
        </div>

        {/* Input Box */}
        <div className="bg-[#0D0F17] border border-slate-800/90 rounded-3xl p-6 shadow-2xl space-y-4">
          <div className="relative">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Örn: Swap 0.0001 ETH for USDC on Base..."
              className="w-full h-28 bg-[#07080C] border border-slate-800 rounded-2xl p-4 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500 font-mono"
            />
            <button
              onClick={() => handleRunAgent()}
              disabled={loading || !isConnected}
              className="absolute bottom-3 right-3 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-xl shadow-lg disabled:opacity-40"
            >
              {loading ? 'İşleniyor...' : isConnected ? 'Swap Çalıştır ⚡' : 'Cüzdan Bağlayın 🔒'}
            </button>
          </div>

          {/* Quick Buttons */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              onClick={() => setPrompt('Swap 0.0001 ETH for USDC')}
              className="p-3 rounded-xl bg-slate-900/50 border border-slate-800 hover:border-blue-500/40 text-left text-slate-300 font-mono"
            >
              🔄 0.0001 ETH ➔ USDC
            </button>
            <button
              onClick={() => setPrompt('Swap 1 USDC for ETH')}
              className="p-3 rounded-xl bg-slate-900/50 border border-slate-800 hover:border-blue-500/40 text-left text-slate-300 font-mono"
            >
              🔄 1 USDC ➔ ETH
            </button>
          </div>
        </div>

        {/* Telemetry Console */}
        <div className="bg-[#05060A] border border-slate-800 rounded-2xl p-4 font-mono text-xs text-slate-400 space-y-2">
          <div className="text-slate-500 border-b border-slate-800 pb-2 flex justify-between">
            <span>İŞLEM LOGLARI</span>
            <span>{isConnected ? 'ONLINE' : 'OFFLINE'}</span>
          </div>
          <div className="space-y-1 max-h-36 overflow-y-auto">
            {agentLogs.map((log, i) => (
              <div key={i}>› {log}</div>
            ))}
          </div>
        </div>

      </div>
    </main>
  );
}
