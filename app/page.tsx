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
    setLogs((prev) => [`[${time}]${msg}`, ...prev.slice(0, 5)]);
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
        addLog(`Intent Parsed Successfully! Type: ${data
