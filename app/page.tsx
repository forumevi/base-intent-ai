'use client';

import { useState, useEffect } from 'react';
import { useAccount, useConnect, useDisconnect, useSendTransaction } from 'wagmi';

export default function Home() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { sendTransactionAsync } = useSendTransaction();

  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  const [agentLogs, setAgentLogs] = useState<string[]>([
    'BASE_ENGINE_INIT: Base Agentic Execution Environment Active',
    'AI_MODEL_READY: Groq Llama 3.3 70B Quantized Engine Standby',
    'AWAITING_USER_INTENT: Connect Web3 Wallet to Execute On-Chain Actions'
  ]);

  // Hydration hatasını ve cüzdanların yüklenme gecikmesini engellemek için
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isConnected && address) {
      setAgentLogs((prev) => [
        `WALLET_CONNECTED: ${address.slice(0, 6)}...${address.slice(-4)}`,
        ...prev
      ]);
    }
  }, [isConnected, address]);

  const handleRunAgent = async (selectedPrompt?: string) => {
    const activePrompt = selectedPrompt || prompt;
    if (!activePrompt) return;

    if (!isConnected) {
      if (connectors.length > 0) {
        connect({ connector: connectors[0] });
      } else {
        alert('Lütfen cüzdan eklentinizi (Rabby / MetaMask) kontrol edin.');
      }
      return;
    }

    setLoading(true);
    setLastTxHash(null);

    setAgentLogs((prev) => [
      `[${new Date().toLocaleTimeString()}] STEP 1/2: Parsing Natural Language Intent...`,
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

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Intent işlenirken hata oluştu');
      }

      const txData = data.data?.aggregatorQuote?.transaction;
      if (!txData || !txData.to) {
        throw new Error('API tarafından geçerli bir işlem verisi dönmedi.');
      }

      setAgentLogs((prev) => [
        `[${new Date().toLocaleTimeString()}] STEP 2/2: Prompting wallet for signature...`,
        `[${new Date().toLocaleTimeString()}] TARGET_CONTRACT: ${txData.to}`,
        ...prev
      ]);

      const txHash = await sendTransactionAsync({
        to: txData.to as `0x${string}`,
        data: txData.data as `0x${string}`,
        value: BigInt(txData.value || '0')
      });

      setLastTxHash(txHash);
      setAgentLogs((prev) => [
        `[${new Date().toLocaleTimeString()}] ON-CHAIN TRANSACTION CONFIRMED!`,
        `[${new Date().toLocaleTimeString()}] HASH: ${txHash}`,
        ...prev
      ]);

    } catch (err: any) {
      setAgentLogs((prev) => [
        `[${new Date().toLocaleTimeString()}] EXECUTION_ERROR: ${err.message || 'İşlem iptal edildi veya başarısız oldu'}`,
        ...prev
      ]);
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) return null;

  return (
    <main className="min-h-screen bg-[#030407] text-slate-100 flex flex-col items-center p-4 md:p-8 relative font-sans">
      
      {/* HEADER */}
      <div className="w-full max-w-2xl z-10 flex items-center justify-between py-4 px-6 rounded-2xl bg-slate-900/50 border border-slate-800 mb-8 shadow-xl">
        <div className="font-bold text-sm tracking-wide text-white flex items-center gap-2">
          🛡️ BASE INTENT AI
        </div>

        {isConnected ? (
          <div className="flex items-center gap-3">
            <span className="text-xs text-blue-400 font-mono">{address?.slice(0, 6)}...{address?.slice(-4)}</span>
            <button 
              onClick={() => disconnect()}
              className="text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 px-3 py-1.5 rounded-xl border border-red-500/30 transition font-mono cursor-pointer"
            >
              Disconnect
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            {connectors.length > 0 ? (
              connectors.map((connector) => (
                <button
                  key={connector.uid}
                  onClick={() => connect({ connector })}
                  className="text-xs bg-blue-600 hover:bg-blue-500 text-white font-semibold px-4 py-2 rounded-xl transition shadow-md font-mono cursor-pointer"
                >
                  Connect ({connector.name}) 🔒
                </button>
              ))
            ) : (
              <button
                onClick={() => alert('Cüzdan eklentisi bulunamadı!')}
                className="text-xs bg-blue-600/50 text-white font-semibold px-4 py-2 rounded-xl font-mono"
              >
                Connect Wallet 🔒
              </button>
            )}
          </div>
        )}
      </div>

      {/* MAIN CONTAINER */}
      <div className="max-w-2xl w-full z-10 space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl md:text-4xl font-black text-white">
            Autonomous <span className="text-blue-500">DeFi Intents</span> on Base
          </h1>
          <p className="text-slate-400 text-xs font-mono">
            Transform plain text prompt into executed Base L2 transactions.
          </p>
        </div>

        {/* INPUT FORM */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-2xl">
          <div className="relative">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. Swap 0.0001 ETH for USDC..."
              className="w-full h-28 bg-[#05070D] border border-slate-800 rounded-2xl p-4 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500 font-mono resize-none"
            />
            <button
              onClick={() => handleRunAgent()}
              disabled={loading}
              className="absolute bottom-3 right-3 px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-xl shadow-md disabled:opacity-40 transition font-mono cursor-pointer"
            >
              {loading ? 'Executing...' : isConnected ? 'Execute Intent ⚡' : 'Connect Wallet 🔒'}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
            <button
              onClick={() => { 
                setPrompt('Swap 0.0001 ETH for USDC'); 
                handleRunAgent('Swap 0.0001 ETH for USDC'); 
              }}
              className="p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-blue-500 text-left text-slate-300 transition cursor-pointer"
            >
              🔄 Swap 0.0001 ETH ➔ USDC
            </button>
            <button
              onClick={() => { 
                setPrompt('Swap 1 USDC for ETH'); 
                handleRunAgent('Swap 1 USDC for ETH'); 
              }}
              className="p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-blue-500 text-left text-slate-300 transition cursor-pointer"
            >
              🔄 Swap 1 USDC ➔ ETH
            </button>
          </div>
        </div>

        {/* TX PROOF */}
        {lastTxHash && (
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono flex items-center justify-between">
            <span>🎉 Transaction Confirmed on Base!</span>
            <a 
              href={`https://base.blockscout.com/tx/${lastTxHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-bold"
            >
              View Explorer ↗
            </a>
          </div>
        )}

        {/* LOGS */}
        <div className="bg-[#020305] border border-slate-800 rounded-2xl p-4 font-mono text-xs text-slate-400 space-y-2">
          <div className="text-slate-500 border-b border-slate-800 pb-2 text-[11px] font-bold">
            ON-CHAIN AGENT TELEMETRY LOGS
          </div>
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {agentLogs.map((log, i) => (
              <div key={i} className="leading-relaxed">
                <span className="text-blue-500">› </span>
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
