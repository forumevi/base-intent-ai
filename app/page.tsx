'use client';
import { useState } from 'react';

export default function Home() {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [connected, setConnected] = useState(false);

  const samplePrompts = [
    "Swap 100 USDC for ETH on Base",
    "Bridge 0.05 ETH to Base Mainnet",
    "Send 25 USDC to vitalik.base"
  ];

  const handleExecute = async (promptText?: string) => {
    const textToExecute = promptText || input;
    if (!textToExecute.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: textToExecute }),
      });
      const data = await res.json();
      setResult(data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-between p-6">
      <header className="w-full max-w-4xl flex justify-between items-center py-4">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse" />
          <span className="font-bold tracking-wider text-sm text-zinc-400">BASE NETWORK (CHAIN ID: 8453)</span>
        </div>
        <button
          onClick={() => setConnected(!connected)}
          className={`px-4 py-2 rounded-lg font-medium text-sm transition ${
            connected 
              ? 'bg-zinc-800 text-green-400 border border-green-500/30' 
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          {connected ? '0x71C...4f9A (Connected)' : 'Connect Base Wallet'}
        </button>
      </header>

      <div className="max-w-2xl w-full text-center my-auto">
        <div className="inline-block px-3 py-1 bg-blue-950/50 border border-blue-500/20 rounded-full text-blue-400 text-xs font-semibold mb-4">
          Autonomous On-Chain Intent Engine
        </div>
        
        <h1 className="text-5xl font-extrabold mb-3 text-transparent bg-clip-text bg-gradient-to-r from-blue-500 via-cyan-400 to-indigo-500">
          BaseIntent AI
        </h1>
        <p className="text-gray-400 mb-8 text-base max-w-lg mx-auto">
          Translate natural language into structured, gas-optimized Base execution transactions in seconds.
        </p>

        <div className="flex gap-2 mb-4 bg-zinc-900/90 p-2 border border-zinc-800 rounded-2xl shadow-xl">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="e.g. Swap 50 USDC for ETH on Base..."
            className="flex-1 bg-transparent px-4 py-3 text-white focus:outline-none placeholder-zinc-500"
          />
          <button
            onClick={() => handleExecute()}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-6 py-3 rounded-xl font-semibold transition flex items-center gap-2"
          >
            {loading ? (
              <span>Parsing...</span>
            ) : (
              <>
                <span>Execute</span>
                <span className="text-xs opacity-75">↵</span>
              </>
            )}
          </button>
        </div>

        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {samplePrompts.map((p, idx) => (
            <button
              key={idx}
              onClick={() => {
                setInput(p);
                handleExecute(p);
              }}
              className="text-xs bg-zinc-900/60 hover:bg-zinc-800 text-zinc-400 border border-zinc-800/80 px-3 py-1.5 rounded-lg transition"
            >
              {p}
            </button>
          ))}
        </div>

        {result && (
          <div className="text-left bg-zinc-900/80 border border-zinc-800/80 p-5 rounded-xl shadow-2xl backdrop-blur-sm">
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs text-blue-400 font-mono tracking-wider">PARSED_INTENT_PAYLOAD</span>
              <span className="text-[10px] bg-green-950 text-green-400 px-2 py-0.5 rounded border border-green-800/50">READY_FOR_CALLEDATA</span>
            </div>
            <pre className="text-green-400 text-xs overflow-x-auto font-mono bg-black/60 p-4 rounded-lg border border-zinc-800/50">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </div>

      <footer className="text-xs text-zinc-600 py-4">
        Built for Base Creator Grant Program • Powered by BaseIntent AI
      </footer>
    </main>
  );
}
