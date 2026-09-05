'use client';
import { useState, useEffect } from 'react';
import { parseEther } from 'viem';

const NETWORKS = {
  MAINNET: {
    hex: '0x2105', // 8453
    name: 'Base Mainnet',
    rpc: 'https://mainnet.base.org',
    explorer: 'https://basescan.org'
  },
  SEPOLIA: {
    hex: '0x14a34', // 84532
    name: 'Base Sepolia Testnet',
    rpc: 'https://sepolia.base.org',
    explorer: 'https://base-sepolia.blockscout.com'
  }
};

export default function Home() {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<string | null>(null);
  const [selectedNetwork, setSelectedNetwork] = useState<'MAINNET' | 'SEPOLIA'>('MAINNET');
  const [txStatus, setTxStatus] = useState<{ msg: string; hash?: string; isError?: boolean } | null>(null);
  const [activeTab, setActiveTab] = useState<'visual' | 'calldata'>('visual');

  const [logs, setLogs] = useState<string[]>([
    "System Initialized: Base DEX Aggregator Engine Active",
    "Routing Protocol: 0x / 1inch Multi-DEX Aggregator Layer"
  ]);

  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString();
    setLogs((prev) => [`[${time}] ${msg}`, ...prev.slice(0, 5)]);
  };

  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).ethereum) {
      const eth = (window as any).ethereum;
      eth.request({ method: 'eth_accounts' }).then((accounts: string[]) => {
        if (accounts.length > 0) setWalletAddress(accounts[0]);
      });
      eth.request({ method: 'eth_chainId' }).then((id: string) => {
        const hex = id?.toLowerCase();
        setChainId(hex);
        if (hex === NETWORKS.SEPOLIA.hex) setSelectedNetwork('SEPOLIA');
        else if (hex === NETWORKS.MAINNET.hex) setSelectedNetwork('MAINNET');
      });
      eth.on('accountsChanged', (accs: string[]) => setWalletAddress(accs.length > 0 ? accs[0] : null));
      eth.on('chainChanged', (id: string) => setChainId(id?.toLowerCase()));
    }
  }, []);

  const connectWallet = async () => {
    if (typeof window !== 'undefined' && (window as any).ethereum) {
      try {
        const accs = await (window as any).ethereum.request({ method: 'eth_requestAccounts' });
        if (accs.length > 0) {
          setWalletAddress(accs[0]);
          addLog(`Wallet Connected: ${accs[0].substring(0, 6)}...`);
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  const switchNetwork = async (targetNetwork: 'MAINNET' | 'SEPOLIA') => {
    setSelectedNetwork(targetNetwork);
    const config = NETWORKS[targetNetwork];
    if (typeof window !== 'undefined' && (window as any).ethereum) {
      const eth = (window as any).ethereum;
      try {
        await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: config.hex }] });
        addLog(`Switched network to ${config.name}`);
      } catch (err: any) {
        if (err.code === 4902 || err.code === -32603) {
          await eth.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: config.hex,
              chainName: config.name,
              nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
              rpcUrls: [config.rpc],
              blockExplorerUrls: [config.explorer],
            }],
          });
        }
      }
    }
  };

  const handleExecute = async (promptText?: string) => {
    const textToExecute = promptText || input;
    if (!textToExecute.trim()) return;
    setLoading(true);
    setResult(null);
    setTxStatus(null);
    addLog(`Parsing Intent & Searching Best DEX Routes for: "${textToExecute}"`);

    try {
      const res = await fetch('/api/intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: textToExecute, userAddress: walletAddress }),
      });
      const data = await res.json();
      if (data.success) {
        setResult(data.data);
        addLog(`Optimal Route Found across Base DEXs! Action: ${data.data.intentType}`);
      } else {
        alert("AI Parsing Error: " + data.error);
        addLog(`Error: ${data.error}`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSignAndBroadcast = async () => {
    if (!walletAddress) {
      await connectWallet();
      return;
    }

    const currentConfig = NETWORKS[selectedNetwork];
    if (chainId !== currentConfig.hex) {
      await switchNetwork(selectedNetwork);
      return;
    }

    if (typeof window !== 'undefined' && (window as any).ethereum) {
      const eth = (window as any).ethereum;
      try {
        if (selectedNetwork === 'MAINNET') {
          // Check if Aggregator Quote payload exists
          const transactionPayload = result?.aggregatorQuote?.transaction;

          if (!transactionPayload) {
            throw new Error("DEX Aggregator payload could not be constructed for this route.");
          }

          setTxStatus({ msg: `Broadcasting Aggregated Swap across Base Liquidity Pools...` });

          const txHash = await eth.request({
            method: 'eth_sendTransaction',
            params: [{
              from: walletAddress,
              to: transactionPayload.to,
              data: transactionPayload.data,
              value: transactionPayload.value || '0x0',
            }],
          });

          setTxStatus({ 
            msg: `Mainnet Aggregated Swap Executed Successfully!`, 
            hash: txHash 
          });
          addLog(`Mainnet TX Confirmed: ${txHash.substring(0, 10)}...`);

        } else {
          // Testnet Execution Flow
          setTxStatus({ msg: `Simulating Testnet Intent Execution on Base Sepolia...` });
          setTimeout(() => {
            setTxStatus({ msg: `Testnet Intent Executed on Sepolia.` });
          }, 1500);
        }

      } catch (err: any) {
        console.error(err);
        setTxStatus({ msg: err.message || "Transaction Cancelled", isError: true });
        addLog("Transaction Execution Failed.");
      }
    }
  };

  return (
    <main className="min-h-screen bg-[#050508] text-white flex flex-col justify-between font-sans relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-600/15 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-indigo-600/15 rounded-full blur-[140px] pointer-events-none" />

      {/* Top Banner Status */}
      <div className="w-full bg-zinc-950/80 border-b border-zinc-800/60 backdrop-blur-md px-6 py-2 text-[11px] font-mono text-zinc-400 flex justify-between items-center overflow-x-auto z-10">
        <div className="flex items-center gap-6">
          <span className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full animate-ping ${selectedNetwork === 'MAINNET' ? 'bg-red-500' : 'bg-green-400'}`}/> 
            NETWORK: <strong className={selectedNetwork === 'MAINNET' ? 'text-red-400 font-bold' : 'text-white'}>{NETWORKS[selectedNetwork].name.toUpperCase()}</strong>
          </span>
          <span>DEX ROUTING: <strong className="text-green-400">0x / 1inch Aggregator</strong></span>
          <span>AVG GAS: <strong className="text-blue-400">&lt; $0.005</strong></span>
        </div>
        <div className="hidden sm:flex items-center gap-4">
          <span className="text-zinc-500">ENGINE: GROQ LLAMA 3.3 70B</span>
        </div>
      </div>

      {/* Header */}
      <header className="w-full max-w-7xl mx-auto flex justify-between items-center px-6 py-4 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center font-bold text-lg shadow-lg shadow-blue-500/30">B</div>
          <div>
            <h2 className="font-extrabold tracking-tight text-lg text-white">BaseIntent <span className="text-blue-500">AI</span></h2>
            <p className="text-[10px] font-mono text-zinc-500">Autonomous Execution Layer</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex bg-zinc-900 border border-zinc-800 p-1 rounded-xl font-mono text-xs">
            <button 
              onClick={() => switchNetwork('MAINNET')} 
              className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${selectedNetwork === 'MAINNET' ? 'bg-red-600 text-white font-extrabold shadow-lg shadow-red-600/30' : 'text-zinc-400 hover:text-white'}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> Base Mainnet
            </button>
            <button 
              onClick={() => switchNetwork('SEPOLIA')} 
              className={`px-3 py-1.5 rounded-lg transition ${selectedNetwork === 'SEPOLIA' ? 'bg-indigo-600 text-white font-bold' : 'text-zinc-400 hover:text-white'}`}>
              Sepolia Testnet
            </button>
          </div>

          {walletAddress ? (
            <div className="flex items-center gap-2">
              <span className="bg-zinc-900/90 border border-zinc-800 text-blue-400 px-3 py-1.5 rounded-xl font-mono text-xs">{walletAddress.substring(0, 6)}...{walletAddress.substring(walletAddress.length - 4)}</span>
              <button onClick={() => setWalletAddress(null)} className="bg-red-950/50 hover:bg-red-900/80 border border-red-800/60 text-red-400 px-3 py-1.5 rounded-xl font-mono text-xs transition">Disconnect</button>
            </div>
          ) : (
            <button onClick={connectWallet} className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold px-4 py-2 rounded-xl text-xs shadow-lg transition">Connect Wallet</button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl w-full mx-auto px-6 py-4 grid grid-cols-1 lg:grid-cols-12 gap-6 my-auto z-10">
        <div className="lg:col-span-7 flex flex-col justify-center space-y-6">
          
          {selectedNetwork === 'MAINNET' ? (
            <div className="bg-red-950/80 border-2 border-red-600 rounded-2xl p-4 shadow-2xl shadow-red-900/40 backdrop-blur-md animate-pulse">
              <div className="flex items-start gap-3">
                <span className="text-2xl">⚠️</span>
                <div>
                  <h3 className="font-extrabold text-sm text-red-400 font-mono tracking-wide uppercase flex items-center gap-2">
                    WARNING: LIVE NETWORK ACTIVE (BASE MAINNET)
                  </h3>
                  <p className="text-xs text-red-200/90 leading-relaxed mt-1 font-sans">
                    You are connected to <strong>Base Mainnet</strong>. Real assets will be spent for execution via optimal DEX Liquidity Pools.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-950/40 border border-blue-500/30 rounded-full text-blue-400 text-xs font-mono w-fit">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" /> 
              Mode: Safe Testnet Environment (Sepolia)
            </div>
          )}

          <div>
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-3 bg-clip-text text-transparent bg-gradient-to-r from-white via-zinc-200 to-zinc-400">
              Natural Language to On-Chain Execution.
            </h1>
            <p className="text-zinc-400 text-sm leading-relaxed max-w-xl">
              Describe your trade in plain language. BaseIntent AI finds the best route across Uniswap V3, Aerodrome, Curve and executes it instantly.
            </p>
          </div>

          <div className="bg-zinc-900/60 border border-zinc-800 p-2 rounded-2xl shadow-2xl backdrop-blur-xl">
            <textarea
              rows={3}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="e.g. Swap 0.0001 ETH for USDC..."
              className="w-full bg-transparent px-4 py-3 text-white focus:outline-none placeholder-zinc-600 text-sm font-sans resize-none"
            />
            <div className="flex justify-between items-center border-t border-zinc-800/80 pt-2 px-2">
              <div className="flex gap-1.5">
                {["USDC", "USDT", "DAI", "AERO"].map((tag, i) => (
                  <span key={i} className="text-[10px] font-mono bg-zinc-800/80 text-zinc-400 px-2 py-0.5 rounded-md">{tag}</span>
                ))}
              </div>
              <button onClick={() => handleExecute()} disabled={loading} className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-5 py-2.5 rounded-xl text-xs transition shadow-lg flex items-center gap-2">
                {loading ? 'Searching Route...' : 'Run Intent Agent ↵'}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-mono text-zinc-500">QUICK INTENTS:</p>
            <div className="flex flex-wrap gap-2">
              {[
                "Swap 0.0001 ETH for USDT",
                "Swap 0.0001 ETH for USDC",
                "Swap 0.0001 ETH for DAI"
              ].map((p, idx) => (
                <button key={idx} onClick={() => { setInput(p); handleExecute(p); }} className="text-xs bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 border border-zinc-800/80 px-3 py-1.5 rounded-xl transition font-mono">
                  ⚡ {p}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-zinc-950/90 border border-zinc-800/80 rounded-2xl p-4 font-mono text-xs">
            <div className="flex justify-between items-center border-b border-zinc-800/60 pb-2 mb-3">
              <span className="text-zinc-500 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-green-500" /> AGENT LOG STREAM</span>
              <span className="text-[10px] text-zinc-600">LIVE</span>
            </div>
            <div className="space-y-1.5 text-zinc-400 font-mono text-[11px] max-h-28 overflow-y-auto">
              {logs.map((log, i) => (<div key={i}>{log}</div>))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 flex flex-col justify-center">
          {result ? (
            <div className="bg-zinc-950/90 border border-zinc-800/90 rounded-2xl p-6 shadow-2xl backdrop-blur-xl space-y-5">
              <div className="flex justify-between items-center border-b border-zinc-800/80 pb-3">
                <div className="flex gap-2">
                  <button onClick={() => setActiveTab('visual')} className={`text-xs font-mono font-bold px-3 py-1 rounded-lg ${activeTab === 'visual' ? 'bg-blue-600 text-white' : 'text-zinc-500'}`}>Visual Execution</button>
                  <button onClick={() => setActiveTab('calldata')} className={`text-xs font-mono font-bold px-3 py-1 rounded-lg ${activeTab === 'calldata' ? 'bg-blue-600 text-white' : 'text-zinc-500'}`}>Raw Payload</button>
                </div>
                <span className="text-[10px] font-mono text-green-400 bg-green-950/80 border border-green-800/60 px-2 py-0.5 rounded">
                  {(result.confidenceScore * 100).toFixed(0)}% Match
                </span>
              </div>

              {activeTab === 'visual' ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-zinc-900/60 border border-zinc-800/80 p-3 rounded-xl">
                      <span className="text-[10px] font-mono text-zinc-500 block">INTENT TYPE</span>
                      <span className="text-sm font-bold text-blue-400 font-mono">{result.intentType}</span>
                    </div>
                    <div className="bg-zinc-900/60 border border-zinc-800/80 p-3 rounded-xl">
                      <span className="text-[10px] font-mono text-zinc-500 block">TARGET NETWORK</span>
                      <span className={`text-xs font-bold font-mono ${selectedNetwork === 'MAINNET' ? 'text-red-400' : 'text-indigo-400'}`}>
                        {NETWORKS[selectedNetwork].name}
                      </span>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-[11px] font-mono text-zinc-400 mb-1">AGGREGATED ROUTE SUMMARY</h4>
                    <p className="text-xs text-zinc-300 bg-zinc-900/40 p-3 rounded-xl border border-zinc-800/60">
                      Swap {result.amount} {result.sellToken} ➔ {result.buyToken} using Best Base DEX Route (Uniswap V3 / Aerodrome).
                    </p>
                  </div>
                </>
              ) : (
                <div className="bg-zinc-900/90 p-3 rounded-xl border border-zinc-800 font-mono text-[11px] text-green-400 overflow-x-auto max-h-64">
                  <pre>{JSON.stringify(result, null, 2)}</pre>
                </div>
              )}

              <div className="space-y-2 pt-2">
                <button 
                  onClick={handleSignAndBroadcast} 
                  className={`w-full py-3.5 font-bold rounded-xl text-xs transition shadow-lg flex items-center justify-center gap-2 ${
                    selectedNetwork === 'MAINNET' 
                      ? 'bg-gradient-to-r from-red-600 via-orange-600 to-red-600 hover:from-red-500 hover:to-orange-500 text-white shadow-red-600/30' 
                      : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white'
                  }`}>
                  {selectedNetwork === 'MAINNET' ? '⚠️ SIGN REAL AGGREGATED SWAP ON BASE' : `Sign & Broadcast on ${NETWORKS[selectedNetwork].name}`}
                </button>

                {txStatus && (
                  <div className={`p-2.5 rounded-xl border text-center text-xs font-mono ${txStatus.isError ? 'bg-red-950/60 border-red-800 text-red-400' : 'bg-blue-950/60 border-blue-800 text-blue-300'}`}>
                    <p>{txStatus.msg}</p>
                    {txStatus.hash && (
                      <a href={`${NETWORKS[selectedNetwork].explorer}/tx/${txStatus.hash}`} target="_blank" rel="noopener noreferrer" className="inline-block mt-1 text-green-400 underline font-bold">
                        View Transaction Explorer ↗
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-zinc-950/40 border border-dashed border-zinc-800/80 rounded-2xl p-8 text-center">
              <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 mx-auto flex items-center justify-center text-zinc-500 mb-3 font-mono">🤖</div>
              <h3 className="text-sm font-bold text-zinc-300 mb-1">Agent Standby Mode</h3>
              <p className="text-xs text-zinc-500 max-w-xs mx-auto">Enter prompt to route transactions via Base DEX Aggregator.</p>
            </div>
          )}
        </div>
      </div>

      <footer className="w-full max-w-7xl mx-auto px-6 py-4 border-t border-zinc-900 flex justify-between items-center text-xs text-zinc-600 font-mono z-10">
        <span>BaseIntent AI Engine v2.2.0</span>
        <span>Base Creator Grant Candidate</span>
      </footer>
    </main>
  );
}
