'use client';
import { useState, useEffect } from 'react';

const BASE_SEPOLIA_CHAIN_ID = '0x14a34'; // 84532 in hex

export default function Home() {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<string | null>(null);
  const [txStatus, setTxStatus] = useState<{ msg: string; hash?: string; isError?: boolean } | null>(null);

  // Cüzdan Durumu ve Ağ Takibi
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).ethereum) {
      const eth = (window as any).ethereum;
      
      eth.request({ method: 'eth_accounts' }).then((accounts: string[]) => {
        if (accounts.length > 0) setWalletAddress(accounts[0]);
      });

      eth.request({ method: 'eth_chainId' }).then((id: string) => setChainId(id));

      eth.on('accountsChanged', (accounts: string[]) => {
        setWalletAddress(accounts.length > 0 ? accounts[0] : null);
      });

      eth.on('chainChanged', (id: string) => setChainId(id));
    }
  }, []);

  // Cüzdan Bağlama
  const connectWallet = async () => {
    if (typeof window !== 'undefined' && (window as any).ethereum) {
      try {
        const accounts = await (window as any).ethereum.request({ method: 'eth_requestAccounts' });
        if (accounts.length > 0) setWalletAddress(accounts[0]);
      } catch (err) {
        console.error("User rejected connection", err);
      }
    } else {
      alert("Please install Coinbase Wallet or MetaMask!");
    }
  };

  // Cüzdan Çıkış Yapma
  const disconnectWallet = () => {
    setWalletAddress(null);
    setTxStatus(null);
  };

  // Base Sepolia Ağını Ekleme / Değiştirme
  const switchToBaseSepolia = async () => {
    if (typeof window !== 'undefined' && (window as any).ethereum) {
      try {
        await (window as any).ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: BASE_SEPOLIA_CHAIN_ID }],
        });
      } catch (switchError: any) {
        // Ağ henüz cüzdanda ekli değilse ekle
        if (switchError.code === 4902) {
          try {
            await (window as any).ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: BASE_SEPOLIA_CHAIN_ID,
                chainName: 'Base Sepolia Testnet',
                nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
                rpcUrls: ['https://sepolia.base.org'],
                blockExplorerUrls: ['https://sepolia.basescan.org'],
              }],
            });
          } catch (addError) {
            console.error("Failed to add Base Sepolia network", addError);
          }
        }
      }
    }
  };

  // AI Çıkarım Ajanını Tetikleme
  const handleExecute = async (promptText?: string) => {
    const textToExecute = promptText || input;
    if (!textToExecute.trim()) return;
    setLoading(true);
    setResult(null);
    setTxStatus(null);
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

  // Base Sepolia Ağında Gerçek On-Chain İşlem Gönderme
  const handleSignAndBroadcast = async () => {
    if (!walletAddress) {
      await connectWallet();
      return;
    }

    if (chainId !== BASE_SEPOLIA_CHAIN_ID) {
      await switchToBaseSepolia();
      return;
    }

    if (typeof window !== 'undefined' && (window as any).ethereum) {
      try {
        setTxStatus({ msg: "Awaiting signature in wallet..." });
        
        // Base Sepolia Testnet üzerinde 0 ETH'lik gerçek kontrat çağrısı tetiği
        const txHash = await (window as any).ethereum.request({
          method: 'eth_sendTransaction',
          params: [{
            from: walletAddress,
            to: result?.executionBatch?.[0]?.targetContract || '0x4200000000000000000000000000000000000006',
            value: '0x0',
            data: '0x',
          }],
        });

        setTxStatus({ 
          msg: "Transaction Broadcasted Successfully!", 
          hash: txHash 
        });
      } catch (err: any) {
        setTxStatus({ 
          msg: err.message || "User rejected transaction", 
          isError: true 
        });
      }
    }
  };

  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-between p-6">
      {/* Top Header Navigation */}
      <header className="w-full max-w-5xl flex justify-between items-center py-4 border-b border-zinc-900">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse" />
          <span className="font-bold tracking-wider text-xs text-zinc-300 font-mono">
            {chainId === BASE_SEPOLIA_CHAIN_ID ? 'NETWORK: BASE SEPOLIA (TESTNET)' : 'NETWORK: BASE MAINNET (8453)'}
          </span>
          {chainId !== BASE_SEPOLIA_CHAIN_ID && (
            <button 
              onClick={switchToBaseSepolia}
              className="text-[10px] bg-blue-950 hover:bg-blue-900 text-blue-400 border border-blue-800 px-2 py-0.5 rounded font-mono transition"
            >
              Switch to Testnet
            </button>
          )}
        </div>
        
        {/* Wallet Controller */}
        {walletAddress ? (
          <div className="flex items-center gap-2">
            <span className="bg-zinc-900 text-green-400 border border-green-500/30 px-3 py-1.5 rounded-xl font-mono text-xs">
              {walletAddress.substring(0, 6)}...{walletAddress.substring(walletAddress.length - 4)}
            </span>
            <button
              onClick={disconnectWallet}
              className="bg-red-950/80 hover:bg-red-900 text-red-400 border border-red-800/60 px-3 py-1.5 rounded-xl font-mono text-xs transition"
            >
              Disconnect
            </button>
          </div>
        ) : (
          <button
            onClick={connectWallet}
            className="bg-blue-600 hover:bg-blue-500 text-white border border-blue-500 px-4 py-2 rounded-xl font-mono text-xs font-semibold transition"
          >
            Connect Web3 Wallet
          </button>
        )}
      </header>

      {/* Hero & Interactive Area */}
      <div className="max-w-3xl w-full text-center my-auto py-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-950/60 border border-blue-500/30 rounded-full text-blue-400 text-xs font-mono mb-6">
          <span>Engine: Groq Llama 3 AI</span>
          <span className="text-zinc-600">•</span>
          <span className="text-green-400">Autonomous Agent Ready</span>
        </div>
        
        <h1 className="text-5xl sm:text-6xl font-extrabold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-300 to-indigo-500">
          BaseIntent AI
        </h1>
        <p className="text-zinc-400 mb-8 text-sm sm:text-base max-w-xl mx-auto">
          Autonomous natural language intent parsing, automated risk scoring, and gas-optimized multi-step execution bundling.
        </p>

        {/* Search / Prompt Bar */}
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
            {loading ? <span className="animate-pulse">Analyzing...</span> : <span>Execute Agent ↵</span>}
          </button>
        </div>

        {/* Quick Sample Prompts */}
        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {[
            "Swap 100 USDC for ETH and check pool risk",
            "Bridge 0.05 ETH to Base and swap 50% to AERO",
            "Send 25 USDC to vitalik.base with gas optimization"
          ].map((p, idx) => (
            <button
              key={idx}
              onClick={() => { setInput(p); handleExecute(p); }}
              className="text-xs bg-zinc-900/80 hover:bg-zinc-800 text-zinc-400 border border-zinc-800 px-3 py-1.5 rounded-lg transition font-mono"
            >
              {p}
            </button>
          ))}
        </div>

        {/* AI Output Engine Dashboard */}
        {result && (
          <div className="text-left bg-zinc-950 border border-zinc-800 rounded-2xl p-6 shadow-2xl space-y-6">
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
                <span className="text-xs text-zinc-500 font-mono block">SAFETY RISK</span>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-md border font-mono ${
                  result.riskAnalysis?.score === 'LOW' 
                    ? 'bg-green-950 text-green-400 border-green-800' 
                    : result.riskAnalysis?.score === 'MEDIUM' 
                    ? 'bg-yellow-950 text-yellow-400 border-yellow-800' 
                    : 'bg-red-950 text-red-400 border-red-800'
                }`}>
                  {result.riskAnalysis?.score || 'LOW'}
                </span>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-mono text-zinc-400 mb-1">AGENT SIMULATION SUMMARY</h4>
              <p className="text-sm text-zinc-200 bg-zinc-900/60 p-3 rounded-lg border border-zinc-800/60">
                {result.simulationSummary}
              </p>
            </div>

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

            {/* Transaction Action Layer */}
            <div className="space-y-3">
              <button 
                onClick={handleSignAndBroadcast}
                className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold rounded-xl text-sm transition shadow-lg flex items-center justify-center gap-2"
              >
                <span>Sign & Broadcast Bundle on {chainId === BASE_SEPOLIA_CHAIN_ID ? 'Base Sepolia' : 'Base Network'}</span>
              </button>

              {txStatus && (
                <div className={`p-3 rounded-xl border text-center text-xs font-mono ${
                  txStatus.isError 
                    ? 'bg-red-950/60 border-red-800 text-red-400' 
                    : 'bg-blue-950/60 border-blue-800 text-blue-300'
                }`}>
                  <p>{txStatus.msg}</p>
                  {txStatus.hash && (
                    <a 
                      href={`https://sepolia.basescan.org/tx/${txStatus.hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block mt-1 text-green-400 underline hover:text-green-300 font-bold"
                    >
                      View on BaseScan Explorer ↗
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <footer className="text-xs text-zinc-600 py-4 font-mono">
        BaseIntent AI • Built for Base Creator Grant Program
      </footer>
    </main>
  );
}
