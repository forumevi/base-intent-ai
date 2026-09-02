'use client';
import { useState } from 'react';

export default function Home() {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleExecute = async () => {
    if (!input.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: input }),
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
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6">
      <div className="max-w-xl w-full text-center">
        <h1 className="text-5xl font-extrabold mb-3 text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-cyan-400">
          BaseIntent AI
        </h1>
        <p className="text-gray-400 mb-8 text-lg">
          Natural Language to On-Chain Intent Engine for Base Network
        </p>

        <div className="flex gap-2 mb-6">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="e.g. Swap 50 USDC for ETH on Base..."
            className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition"
          />
          <button
            onClick={handleExecute}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-6 py-3 rounded-xl font-semibold transition"
          >
            {loading ? 'Parsing...' : 'Execute'}
          </button>
        </div>

        {result && (
          <div className="text-left bg-zinc-900/80 border border-zinc-800 p-5 rounded-xl">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Parsed Execution Payload</p>
            <pre className="text-green-400 text-sm overflow-x-auto font-mono">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </main>
  );
}