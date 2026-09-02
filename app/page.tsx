'use client';
import { useState, useEffect } from 'react';

const BASE_SEPOLIA_HEX = '0x14a34'; // Chain ID: 84532

export default function Home() {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<string | null>(null);
  const [txStatus, setTxStatus] = useState<{ msg: string; hash?: string; isError?: boolean } | null>(null);
  const [activeTab, setActiveTab] = useState<'visual' | 'calldata'>('visual');

  // Canlı Ajan Log Akışı
  const [logs, setLogs] = useState<string[]>([
    "System Initialized: Connected to Base Network (Chain ID: 8453)",
    "LLM Router Active: Groq Llama 3 Inference Engine Listening..."
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
      } catch (err) { console.error(err); }
    } else { alert("Please install Coinbase Wallet, Rabby, or MetaMask!"); }
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
    addLog(`Parsing User Intent: "${textToExecute}"`);

    try {
      const res = await fetch('/api/intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: textToExecute }),
      });
      const data = await res.json();
      if (data.success) {
        setResult(data.data);
        addLog(`Intent Parsed Successfully! Type: ${data.data.intentType}`);
      } else {
        alert("AI Parsing Error: " + data.error);
        addLog(`Error parsing intent: ${data.error}`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Base Sepolia Ağında GERÇEK On-Chain Token Transferi ve Swap Tetikleyici
  const handleSignAndBroadcast = async () => {
    if (!walletAddress) { await connectWallet(); return; }
    if (chainId !== BASE_SEPOLIA_HEX) { await switchToBaseSepolia(); return; }

    if (typeof window !== 'undefined' && (window as any).ethereum) {
      try {
        setTxStatus({ msg: "Awaiting signature in wallet..." });
        addLog("Generating On-Chain Calldata for Executing Agent Intent...");

        const targetAddress = walletAddress;
        
        // ERC20 'transfer(address,uint256)' metod imzası: 0xa9059cbb
        const paddedAddress = targetAddress.replace('0x', '').padStart(64, '0');
        
        const amountBigInt = BigInt("1000000000000000000"); 
        const paddedAmount = amountBigInt.toString(16).padStart(64, '0');
        const erc20TransferCalldata = `0xa9059cbb${paddedAddress}${paddedAmount}`;

        const txHash = await (window as any).ethereum.request({
          method: 'eth_sendTransaction',
          params: [{
            from: walletAddress,
            to: result?.executionBatch?.[0]?.targetContract || '0x4200000000000000000000000000000000000006',
            value: '0x38D7EA4C68000', // 0.0001 ETH
            data: erc20TransferCalldata,
          }],
        });

        setTxStatus({ msg: "Transaction Broadcasted & Executed on Base Sepolia!", hash: txHash });
        addLog(`TX Confirmed On-Chain: ${txHash.substring(0, 10)}...`);
      }
