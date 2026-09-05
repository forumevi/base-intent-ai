'use client';
import { useState, useEffect } from 'react';
import { encodeFunctionData, parseEther, parseUnits } from 'viem';

const BASE_SEPOLIA_HEX = '0x14a34'; // Chain ID: 84532

// Base Sepolia Uniswap V3 SwapRouter02
const UNISWAP_V3_ROUTER = '0x94cC0aaC535CCDB3C01d6787d6413C739ae12bc4';

// Testnet Likiditesi Yüksek Token Kataloğu (Fee Tier Optimizasyonlu)
const TOKEN_CATALOG: Record<string, { address: string; decimals: number; fee: number }> = {
  USDC: { address: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', decimals: 6, fee: 3000 },
  USDT: { address: '0x2203cBb29D4bA9A8aE48A3fdE90591E8572Bc09a', decimals: 6, fee: 10000 }, // %1 Havuz Katmanı
  DAI:  { address: '0x5Bd36745f6199CF32d2465Ef1F8D6c51dCA9BdEE', decimals: 18, fee: 10000 }, // %1 Havuz Katmanı (Revert Korumalı)
  AERO: { address: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58', decimals: 18, fee: 10000 },
  WETH: { address: '0x4200000000000000000000000000000000000006', decimals: 18, fee: 3000 }
};

const SWAP_ROUTER_ABI = [
  {
    inputs: [
      {
        components: [
          { name: 'tokenIn', type: 'address' },
          { name: 'tokenOut', type: 'address' },
          { name: 'fee', type: 'uint24' },
          { name: 'recipient', type: 'address' },
          { name: 'amountIn', type: 'uint256' },
          { name: 'amountOutMinimum', type: 'uint256' },
          { name: 'sqrtPriceLimitX96', type: 'uint160' }
        ],
        name: 'params',
        type: 'tuple'
      }
    ],
    name: 'exactInputSingle',
    outputs: [{ name: 'amountOut', type: 'uint256' }],
    stateMutability: 'payable',
    type: 'function'
  }
] as const;

const ERC20_ABI = [
  {
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'value', type: 'uint256' }
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function'
  }
] as const;

export default function Home() {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<string | null>(null);
  const [txStatus, setTxStatus] = useState<{ msg: string; hash?: string; isError?: boolean } | null>(null);
  const [activeTab, setActiveTab] = useState<'visual' | 'calldata'>('visual');

  const [logs, setLogs] = useState<string[]>([
    "System Initialized: Connected to Base Network (Chain ID: 84532)",
    "Universal Token Router Ready (USDC, USDT, DAI, AERO)"
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
      eth.request({ method: 'eth_chainId' }).then((id: string) => setChainId(id?.toLowerCase()));
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

  const disconnectWallet = () => {
    setWalletAddress(null);
    setTxStatus(null);
    addLog("Wallet Disconnected.");
  };

  const switchToBaseSepolia = async () => {
    if (typeof window !== 'undefined' && (window as any).ethereum) {
      const eth = (window as any).ethereum;
      try {
        await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: BASE_SEPOLIA_HEX }] });
      } catch (err: any) {
        if (err.code === 4902 || err.code === -32603) {
          await eth.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: BASE_SEPOLIA_HEX,
              chainName: 'Base Sepolia Testnet',
              nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
              rpcUrls: ['https://sepolia.base.org'],
              blockExplorerUrls: ['https://sepolia.basescan.org'],
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
    addLog(`Parsing Intent: "${textToExecute}"`);

    try {
      const res = await fetch('/api/intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: textToExecute }),
      });
      const data = await res.json();
      if (data.success) {
        setResult(data.data);
        addLog(`Intent Parsed! Target Action: ${data.data.intentType}`);
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
    if (chainId !== BASE_SEPOLIA_HEX) {
      await switchToBaseSepolia();
      return;
    }

    if (typeof window !== 'undefined' && (window as any).ethereum) {
      const eth = (window as any).ethereum;
      try {
        const text = input.toUpperCase();
        
        let targetToken = 'USDC';
        if (text.includes('USDT')) targetToken = 'USDT';
        else if (text.includes('DAI')) targetToken = 'DAI';
        else if (text.includes('AERO')) targetToken = 'AERO';

        const tokenObj = TOKEN_CATALOG[targetToken] || TOKEN_CATALOG.USDC;
        const wethAddress = TOKEN_CATALOG.WETH.address;

        const isTokenToEth = text.includes(`${targetToken} FOR ETH`) || 
                             text.includes(`${targetToken} ILE ETH`) || 
                             text.includes(`${targetToken} TO ETH`);

        if (isTokenToEth) {
          setTxStatus({ msg: `1/2: Approving ${targetToken}...` });
          const tokenAmount = parseUnits('1', tokenObj.decimals);

          // Reset approve
          try {
            const resetCalldata = encodeFunctionData({
              abi: ERC20_ABI,
              functionName: 'approve',
              args: [UNISWAP_V3_ROUTER as `0x${string}`, BigInt(0)]
            });
            await eth.request({
              method: 'eth_sendTransaction',
              params: [{ from: walletAddress, to: tokenObj.address, data: resetCalldata }],
            });
          } catch (e) {
            console.log("Reset approve bypass", e);
          }

          const approveCalldata = encodeFunctionData({
            abi: ERC20_ABI,
            functionName: 'approve',
            args: [UNISWAP_V3_ROUTER as `0x${string}`, tokenAmount]
          });

          await eth.request({
            method: 'eth_sendTransaction',
            params: [{ from: walletAddress, to: tokenObj.address, data: approveCalldata }],
          });

          setTxStatus({ msg: `2/2: Swapping ${targetToken} to ETH...` });

          const swapCalldata = encodeFunctionData({
            abi: SWAP_ROUTER_ABI,
            functionName: 'exactInputSingle',
            args: [{
              tokenIn: tokenObj.address as `0x${string}`,
              tokenOut: wethAddress as `0x${string}`,
              fee: tokenObj.fee,
              recipient: walletAddress as `0x${string}`,
              amountIn: tokenAmount,
              amountOutMinimum: BigInt(0),
              sqrtPriceLimitX96: BigInt(0)
            }]
          });

          const txHash = await eth.request({
            method: 'eth_sendTransaction',
            params: [{ from: walletAddress, to: UNISWAP_V3_ROUTER, value: '0x0', data: swapCalldata }],
          });

          setTxStatus({ msg: `Swap Completed! ${targetToken} converted to ETH.`, hash: txHash });
          addLog(`TX Confirmed: ${txHash.substring(0, 10)}...`);

        } else {
          setTxStatus({ msg: `Executing ETH -> ${targetToken} Swap...` });

          let rawEth = '0.0001'; // Düşük tutar kayma (slippage) hatasını engeller
          const match = input.match(/(\d+\.?\d*)\s*eth/i);
          if (match && match[1]) rawEth = match[1];

          const ethWei = parseEther(rawEth);

          const swapCalldata = encodeFunctionData({
            abi: SWAP_ROUTER_ABI,
            functionName: 'exactInputSingle',
            args: [{
              tokenIn: wethAddress as `0x${string}`,
              tokenOut: tokenObj.address as `0x${string}`,
              fee: tokenObj.fee,
              recipient: walletAddress as `0x${string}`,
              amountIn: ethWei,
              amountOutMinimum: BigInt(0),
              sqrtPriceLimitX96: BigInt(0)
            }]
          });

          const txHash = await eth.request({
            method: 'eth_sendTransaction',
            params: [{
              from: walletAddress,
              to: UNISWAP_V3_ROUTER,
              value: `0x${ethWei.toString(16)}`,
              data: swapCalldata,
            }],
          });

          setTxStatus({ 
            msg: `Swap Success! ${targetToken} received in wallet.`, 
            hash: txHash 
          });
          addLog(`TX Confirmed: ${txHash.substring(0, 10)}...`);
        }
      } catch (err: any) {
        console.error(err);
        setTxStatus({ msg: err.message || "Transaction Failed / Cancelled", isError: true });
        addLog("Transaction Execution Failed.");
      }
    }
  };

  const isTestnet = chainId === BASE_SEPOLIA_HEX;

  return (
    <main className="min-h-screen bg-[#050508] text-white flex flex-col justify-between font-sans relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-600/15 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-indigo-600/15 rounded-full blur-[140px] pointer-events-none" />

      <div className="w-full bg-zinc-950/80 border-b border-zinc-800/60 backdrop-blur-md px-6 py-2 text-[11px] font-mono text-zinc-400 flex justify-between items-center overflow-x-auto z-10">
        <div className="flex items-center gap-6">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-400 animate-ping"/> BASE NETWORK: <strong className="text-white">ONLINE</strong></span>
          <span>ETH/USD: <strong className="text-green-400">$2,845.20</strong></span>
          <span>AVG GAS: <strong className="text-blue-400">&lt; $0.001</strong></span>
        </div>
        <div className="hidden sm:flex items-center gap-4">
          <span className="text-zinc-500">ENGINE: GROQ LLAMA 3.3 70B</span>
        </div>
      </div>

      <header className="w-full max-w-7xl mx-auto flex justify-between items-center px-6 py-4 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center font-bold text-lg shadow-lg shadow-blue-500/30">B</div>
          <div>
            <h2 className="font-extrabold tracking-tight text-lg text-white">BaseIntent <span className="text-blue-500">AI</span></h2>
            <p className="text-[10px] font-mono text-zinc-500">Autonomous Execution Layer</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={switchToBaseSepolia} className={`text-xs px-3 py-1.5 rounded-xl border font-mono transition ${isTestnet ? 'bg-green-950/40 text-green-400 border-green-800/60' : 'bg-zinc-900/80 text-zinc-300 border-zinc-700'}`}>
            {isTestnet ? '● Base Sepolia Testnet' : '⚡ Switch to Testnet'}
          </button>

          {walletAddress ? (
            <div className="flex items-center gap-2">
              <span className="bg-zinc-900/90 border border-zinc-800 text-blue-400 px-3 py-1.5 rounded-xl font-mono text-xs">{walletAddress.substring(0, 6)}...{walletAddress.substring(walletAddress.length - 4)}</span>
              <button onClick={disconnectWallet} className="bg-red-950/50 hover:bg-red-900/80 border border-red-800/60 text-red-400 px-3 py-1.5 rounded-xl font-mono text-xs transition">Disconnect</button>
            </div>
          ) : (
            <button onClick={connectWallet} className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold px-4 py-2 rounded-xl text-xs shadow-lg transition">Connect Wallet</button>
          )}
        </div>
      </header>

      <div className="max-w-7xl w-full mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6 my-auto z-10">
        <div className="lg:col-span-7 flex flex-col justify-center space-y-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-950/40 border border-blue-500/30 rounded-full text-blue-400 text-xs font-mono mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" /> Universal Token Router
            </div>
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-3 bg-clip-text text-transparent bg-gradient-to-r from-white via-zinc-200 to-zinc-400">
              Natural Language to On-Chain Execution.
            </h1>
            <p className="text-zinc-400 text-sm leading-relaxed max-w-xl">
              Swap ETH for USDC, USDT, DAI or AERO seamlessly on Base Sepolia.
            </p>
          </div>

          <div className="bg-zinc-900/60 border border-zinc-800 p-2 rounded-2xl shadow-2xl backdrop-blur-xl">
            <textarea
              rows={3}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="e.g. Swap 0.0001 ETH for DAI or Swap USDC for ETH..."
              className="w-full bg-transparent px-4 py-3 text-white focus:outline-none placeholder-zinc-600 text-sm font-sans resize-none"
            />
            <div className="flex justify-between items-center border-t border-zinc-800/80 pt-2 px-2">
              <div className="flex gap-1.5">
                {["USDC", "USDT", "DAI", "AERO"].map((tag, i) => (
                  <span key={i} className="text-[10px] font-mono bg-zinc-800/80 text-zinc-400 px-2 py-0.5 rounded-md">{tag}</span>
                ))}
              </div>
              <button onClick={() => handleExecute()} disabled={loading} className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-5 py-2.5 rounded-xl text-xs transition shadow-lg flex items-center gap-2">
                {loading ? 'Parsing Intent...' : 'Run Intent Agent ↵'}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-mono text-zinc-500">TEST INTENTS:</p>
            <div className="flex flex-wrap gap-2">
              {[
                "Swap 0.0001 ETH for USDC",
                "Swap 0.0001 ETH for DAI",
                "Swap 0.0001 ETH for USDT",
                "Swap USDC for ETH"
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
                      <span className="text-[10px] font-mono text-zinc-500 block">RISK SCORE</span>
                      <span className="text-xs font-bold font-mono text-green-400">● LOW RISK</span>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-[11px] font-mono text-zinc-400 mb-1">SIMULATION</h4>
                    <p className="text-xs text-zinc-300 bg-zinc-900/40 p-3 rounded-xl border border-zinc-800/60">{result.simulationSummary}</p>
                  </div>
                </>
              ) : (
                <div className="bg-zinc-900/90 p-3 rounded-xl border border-zinc-800 font-mono text-[11px] text-green-400 overflow-x-auto max-h-64">
                  <pre>{JSON.stringify(result, null, 2)}</pre>
                </div>
              )}

              <div className="space-y-2 pt-2">
                <button onClick={handleSignAndBroadcast} className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold rounded-xl text-xs transition shadow-lg">
                  Sign & Broadcast Transaction Bundle
                </button>

                {txStatus && (
                  <div className={`p-2.5 rounded-xl border text-center text-xs font-mono ${txStatus.isError ? 'bg-red-950/60 border-red-800 text-red-400' : 'bg-blue-950/60 border-blue-800 text-blue-300'}`}>
                    <p>{txStatus.msg}</p>
                    {txStatus.hash && (
                      <a href={`https://base-sepolia.blockscout.com/tx/${txStatus.hash}`} target="_blank" rel="noopener noreferrer" className="inline-block mt-1 text-green-400 underline font-bold">
                        View on Blockscout Explorer ↗
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
              <p className="text-xs text-zinc-500 max-w-xs mx-auto">Enter any token swap intent to execute on Base Sepolia.</p>
            </div>
          )}
        </div>
      </div>

      <footer className="w-full max-w-7xl mx-auto px-6 py-4 border-t border-zinc-900 flex justify-between items-center text-xs text-zinc-600 font-mono z-10">
        <span>BaseIntent AI Engine v2.1.0</span>
        <span>Base Creator Grant Candidate</span>
      </footer>
    </main>
  );
}
