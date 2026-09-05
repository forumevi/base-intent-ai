'use client';

import { useState, useEffect } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useChainId, useSendTransaction, useSwitchChain } from 'wagmi';
import { parseEther } from 'viem';

export default function Home() {
  const { address, isConnected } = useAccount();
  const currentChainId = useChainId();
  const { switchChain } = useSwitchChain();
  const { sendTransactionAsync } = useSendTransaction();

  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'SWAP' | 'BRIDGE'>('SWAP');
  const [isMainnet, setIsMainnet] = useState(true);
  const [agentLogs, setAgentLogs] = useState<string[]>([
    'SYSTEM_INIT: Base AI Intent Engine Active',
    'AWAITING: Connect Web3 Wallet to Proceed'
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
      `[${new Date().toLocaleTimeString()}] AI Routing via Engine...`,
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

      // Ağ Kontrolü (İşlem Hangi Ağda Yapılacak?)
      if (txData.chainId && currentChainId !== txData.chainId) {
        setAgentLogs((prev) => [
          `[${new Date().toLocaleTimeString()}] SWITCHING_NETWORK: Requesting switch to Chain ID ${txData.chainId}...`,
          ...prev
        ]);
        await switchChain({ chainId: txData.chainId });
      }

      // Cüzdana İmza/İşlem Gönderme
      setAgentLogs((prev) => [
        `[${new Date().toLocaleTimeString()}] SIGNING: Please confirm transaction in your wallet...`,
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
      <div className={`w-full max-w-5xl py-2 px-4 rounded-xl text-xs font-semibold flex items-center justify-between mb-6 border ${
        isMainnet 
          ? 'bg-amber-500/10 border-amber-500/30 text-amber-300' 
          : 'bg-blue-500/10 border-blue-500/30 text-blue-300'
      }`}>
        <div className="flex items-center gap-2">
          <span>⚠️</span>
          <span>
            {isMainnet 
              ? 'CANLI AĞ (MAINNET) MODU: Yapacağınız işlemler gerçek fonlar (Real Value) kullanır.' 
              : 'TESTNET (SEPOLIA) MODU: Test bakiyeleri kullanılmaktadır.'}
          </span>
        </div>
        <button 
          onClick={() => setIsMainnet(!isMainnet)}
          className="underline hover:text-white text-[11px]"
        >
          {isMainnet ? 'Testnet\'e Geç' : 'Mainnet\'e Geç'}
        </button>
      </div>

      {/* Top Navbar Header */}
      <div className="w-full max-w-5xl flex items-center justify-between py-3 px-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md mb-8 shadow-xl">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-blue-500 animate-pulse" />
          <span className="font-bold text-sm tracking-wide">BaseIntent.ai</span>
        </div>

        {/* RainbowKit Connect Button */}
        <ConnectButton showBalance={false} chainStatus="icon" />
      </div>

      <div className="max-w-4xl w-full z-10 space-y-6">
        
        {/* Main Title */}
        <div className="text-center space-y-3">
          <h1 className="text-3xl md:text-5xl font-black tracking-tight text-white">
            Natural Language <span className="text-blue-500">DeFi Execution</span>
          </h1>
          <p className="text-slate-400 text-sm max-w-xl mx-auto">
            Base ağında doğrudan cüzdanınızla swap yapın veya diğer ağlardan tek komutla köprü kurun.
          </p>
        </div>

        {/* Input Card */}
        <div className="bg-[#0D0F17] border border-slate-800/90 rounded-3xl p-6 shadow-2xl space-y-5">
          
          {/* Mode Tabs */}
          <div className="flex items-center gap-2 p-1 bg-[#07080C] rounded-xl border border-slate-800/80 w-fit text-xs font-semibold">
            <button
              onClick={() => setActiveTab('SWAP')}
              className={`px-4 py-2 rounded-lg transition ${
                activeTab === 'SWAP' ? 'bg-blue-600 text-white' : 'text-slate-400'
              }`}
            >
              🔄 DEX Swap (Base)
            </button>
            <button
              onClick={() => setActiveTab('BRIDGE')}
              className={`px-4 py-2 rounded-lg transition ${
                activeTab === 'BRIDGE' ? 'bg-purple-600 text-white' : 'text-slate-400'
              }`}
            >
              🌉 Cross-Chain Bridge
            </button>
          </div>

          {/* Prompt Form */}
          <div className="relative">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={
                activeTab === 'SWAP'
                  ? 'e.g. Swap 0.0001 ETH for USDC...'
                  : 'e.g. Bridge 0.001 ETH from Arbitrum to Base...'
              }
              className="w-full h-28 bg-[#07080C] border border-slate-800 rounded-2xl p-4 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500 font-mono"
            />
            <button
              onClick={() => handleRunAgent()}
              disabled={loading || !isConnected}
              className="absolute bottom-3 right-3 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-xl shadow-lg disabled:opacity-40"
            >
              {loading ? 'İşleniyor...' : isConnected ? 'İşlemi Çalıştır ⚡' : 'Cüzdan Bağlayın 🔒'}
            </button>
          </div>

          {/* Quick Prompts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
            <button
              onClick={() => { setPrompt('Swap 0.0001 ETH for USDC'); setActiveTab('SWAP'); }}
              className="p-3 rounded-xl bg-slate-900/50 border border-slate-800 hover:border-blue-500/40 text-left text-slate-300"
            >
              🔄 Swap 0.0001 ETH for USDC (Base)
            </button>
            <button
              onClick={() => { setPrompt('Bridge 0.001 ETH from Arbitrum to Base'); setActiveTab('BRIDGE'); }}
              className="p-3 rounded-xl bg-slate-900/50 border border-slate-800 hover:border-purple-500/40 text-left text-slate-300"
            >
              🌉 Bridge 0.001 ETH from Arbitrum
            </button>
          </div>
        </div>

        {/* Live Telemetry Console */}
        <div className="bg-[#05060A] border border-slate-800 rounded-2xl p-4 font-mono text-xs text-slate-400 space-y-2">
          <div className="text-slate-500 border-b border-slate-800 pb-2 flex justify-between">
            <span>CANLI İŞLEM LOGLARI</span>
            <span>{isConnected ? 'WALLET READY' : 'NO WALLET'}</span>
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
