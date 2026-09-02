'use client';
import { useState } from 'react';

export default function Home() {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);

  const samplePrompts = [
    "Swap 100 USDC for ETH and check pool risk",
    "Bridge 0.05 ETH to Base and swap 50% to AERO",
    "Send 25 USDC to vitalik.base with gas optimization"
  ];

  // Gerçek Cüzdan Bağlantı Tetiği
  const connectWallet = async () => {
    if (typeof window !== 'undefined' && (window as any).ethereum) {
      try {
        const accounts = await (window as any).ethereum.request({ method: 'eth_requestAccounts' });
        if (accounts.length > 0) {
          setWalletAddress(accounts[0]);
        }
      } catch (err) {
        console.error("User rejected wallet connection", err);
      }
    } else {
      alert("Please install Coinbase Wallet or MetaMask to interact on Base Network!");
    }
  };

  const handleExecute = async (promptText?: string) => {
    const textToExecute = promptText || input;
    if (!textToExecute.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: textToExecute }),
      });
      const data = await res.json();
      if (data.success) {
        setResult(data.data);
      } else {
        alert("AI Parsing Error: " + data.error);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-between p-6">
      {/* Header */}
      <header className="w-full max-w-4xl flex justify-between items-center py-4 border-b border-zinc-900">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse" />
          <span className="font-bold tracking-wider text-xs text-zinc-400">BASE MAINNET (8453)</span>
        </div>
        
        <button
          onClick={connectWallet}
          className={`px-4 py-2 rounded-xl font-mono text-xs font-semibold transition border ${
            walletAddress 
              ? 'bg-zinc-900 text-green-400 border-green-500/40' 
              : 'bg-blue-600 hover:bg-blue-500 text-white border-blue-500'
          }`}
        >
          {walletAddress 
            ? `${walletAddress.substring(0, 6)}...${walletAddress.substring(walletAddress.length - 4)}` 
            : 'Connect Web3 Wallet'}
        </button>
      </header>

      {/* Main Content */}
      <div className="max-w-3xl w-full text-center my-auto py-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-950/60 border border-blue-500/30 rounded-full text-blue-400 text-xs font-mono mb-6">
          <span>LLM Engine: Llama-3.3-70B</span>
          <span className="text-zinc-600">•</span>
          <span className="text-green-400">Autonomous Agent Active</span>
        </div>
        
        <h1 className="text-5xl sm:text-6xl font-extrabold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-300 to-indigo-500">
          BaseIntent AI
        </h1>
        <p className="text-zinc-400 mb-8 text-sm sm:text-base max-w-xl mx-auto">
          Autonomous natural language intent parsing, risk scoring, and multi-step execution bundling for Base Network.
        </p>

        {/* Input Bar */}
        <div className="flex gap-2 mb-4 bg-zinc-900/90 p-2 border border-zinc-800 rounded-2xl shadow-2xl focus-within:border-blue-500/50 transition">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="e.g. Swap 100 USDC for ETH and check pool risk..."
            className="flex-1 bg-transparent px-4 py-3 text-white focus:outline-none placeholder-zinc-600 text-sm font-sans"
          />
          <button
            onClick={() => handleExecute()}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-6 py-3 rounded-xl font-semibold text-sm transition flex items-center gap-2"
          >
            {loading ? (
              <span className="animate-pulse">Analyzing Intent...</span>
            ) : (
              <>
                <span>Execute Agent</span>
                <span className="text-xs opacity-75">↵</span>
              </>
            )}
          </button>
        </div>

        {/* Prompts */}
        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {samplePrompts.map((p, idx) => (
            <button
              key={idx}
              onClick={() => {
                setInput(p);
                handleExecute(p);
              }}
              className="text-xs bg-zinc-900/80 hover:bg-zinc-800 text-zinc-400 border border-zinc-800 px-3 py-1.5 rounded-lg transition font-mono"
            >
              {p}
            </button>
          ))}
        </div>

        {/* Result Dashboard */}
        {result && (
          <div className="text-left bg-zinc-950 border border-zinc-800 rounded-2xl p-6 shadow-2xl space-y-6">
            {/* Top Status Bar */}
            <div className="flex justify-between items-center border-b border-zinc-900 pb-4">
              <div>
                <span className="text-xs text-zinc-500 font-mono block">INTENT TYPE</span>
                <span className="text-sm font-bold text-blue-400 font-mono">{result.intentType}</span>
              </div>
              <div>
                <span className="text-xs text-zinc-500 font-mono block">CONFIDENCE</span>
                <span className="text-sm font-bold text-green-400 font-mono">{(result.confidenceScore * 100).toFixed(0)}%</span>
              </div>
              <div>
                <span className="text-xs text-zinc-500 font-mono block">RISK LEVEL</span>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-md border font-mono ${
                  result.riskAnalysis?.score === 'LOW' 
                    ? 'bg-green-950 text-green-400 border-green-800' 
                    : result.riskAnalysis?.score === 'MEDIUM' 
                    ? 'bg-yellow-950 text-yellow-400 border-yellow-800' 
                    : 'bg-red-950 text-red-400 border-red-800'
                }`}>
                  {result.riskAnalysis?.score || 'UNKNOWN'}
                </span>
              </div>
            </div>

            {/* Simulation Summary */}
            <div>
              <h4 className="text-xs font-mono text-zinc-400 mb-1">AGENT SIMULATION SUMMARY</h4>
              <p className="text-sm text-zinc-200 bg-zinc-900/60 p-3 rounded-lg border border-zinc-800/60">
                {result.simulationSummary}
              </p>
            </div>

            {/* Execution Steps */}
            <div>
              <h4 className="text-xs font-mono text-zinc-400 mb-2">BUNDLED EXECUTION STEPS</h4>
              <div className="space-y-2">
                {result.executionBatch?.map((step: any, i: number) => (
                  <div key={i} className="flex items-center justify-between bg-zinc-900 p-3 rounded-xl border border-zinc-800/80">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-blue-950 text-blue-400 border border-blue-800 text-xs flex items-center justify-center font-mono font-bold">
                        {step.step || i + 1}
                      </span>
                      <div>
                        <p className="text-xs font-bold text-white">{step.action}</p>
                        <p className="text-[10px] font-mono text-zinc-500">{step.targetContract}</p>
                      </div>
                    </div>
                    <span className="text-xs font-mono text-zinc-400">Gas: {step.estimatedGasUsd}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* On-Chain Action Button */}
            <button 
              onClick={() => alert("Submitting transaction payload to Base Network via Viem...")}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold rounded-xl text-sm transition shadow-lg"
            >
              Sign & Broadcast Transaction Bundle
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="text-xs text-zinc-600 py-4 font-mono">
        BaseIntent AI • Built for Base Creator Grant Program
      </footer>
    </main>
  );
}
