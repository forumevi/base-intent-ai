'use client';
import { useState, useEffect } from 'react';
import { encodeFunctionData, parseEther, parseUnits } from 'viem';

const BASE_SEPOLIA_HEX = '0x14a34'; // Chain ID: 84532

// Base Sepolia Uniswap V3 SwapRouter02 & Token Kataloğu
const UNISWAP_V3_ROUTER = '0x94cC0aaC535CCDB3C01d6787d6413C739ae12bc4';

const TOKEN_CATALOG: Record<string, { address: string; decimals: number; fee: number }> = {
  USDC: { address: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', decimals: 6, fee: 3000 },
  USDT: { address: '0x2203cBb29D4bA9A8aE48A3fdE90591E8572Bc09a', decimals: 6, fee: 3000 },
  DAI:  { address: '0x5Bd36745f6199CF32d2465Ef1F8D6c51dCA9BdEE', decimals: 18, fee: 3000 },
  AERO: { address: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58', decimals: 18, fee: 10000 },
  WETH: { address: '0x4200000000000000000000000000000000000006', decimals: 18, fee: 3000 },
  WBTC: { address: '0x1A0883a31d4546BCE8A962E33A3eCD7C17a6dCD0', decimals: 8, fee: 3000 }
};

// Uniswap V3 SwapRouter02 ABI Yapısı
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

// ERC20 Approve ABI Yapısı
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
    "Universal Token Router Ready (USDC, USDT, DAI, AERO, WBTC)"
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

  // EVRENSEL VE TÜM TOKENLARI KAPSAYAN AKILLI SWAP ENGINE
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
        
        // Cümleden Hangi Token İle İşlem Yapıldığını Tespit Et
        let targetToken = 'USDC';
        if (text.includes('USDT')) targetToken = 'USDT';
        else if (text.includes('DAI')) targetToken = 'DAI';
        else if (text.includes('AERO')) targetToken = 'AERO';
        else if (text.includes('WBTC')) targetToken = 'WBTC';

        const tokenObj = TOKEN_CATALOG[targetToken] || TOKEN_CATALOG.USDC;
        const wethAddress = TOKEN_CATALOG.WETH.address;

        // İşlem Yönünü Tespit Et (Token->ETH ya da ETH->Token)
        const isTokenToEth = text.includes(`${targetToken} FOR ETH`) || 
                             text.includes(`${targetToken} ILE ETH`) || 
                             text.includes(`${targetToken} TO ETH`);

        if (isTokenToEth) {
          // *** SENARYO 1: TOKEN (USDT / USDC / DAI / AERO) -> ETH ***
          setTxStatus({ msg: `1/2: Preparing Allowance for ${targetToken}...` });

          const tokenAmount = parseUnits('1', tokenObj.decimals); // Standart 1 Birim Token

          // USDT gibi katı kontratlar için izni sıfırlama (Approve Reset)
          try {
            const resetApproveCalldata = encodeFunctionData({
              abi: ERC20_ABI,
