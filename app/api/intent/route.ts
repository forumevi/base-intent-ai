import { NextResponse } from 'next/server';
import { encodeFunctionData, parseEther, parseUnits, getAddress } from 'viem';

// Base Mainnet Checksummed Valid Token Addresses
const BASE_TOKENS: Record<string, { address: `0x${string}`; fee: number; decimals: number }> = {
  ETH:  { address: getAddress('0x4200000000000000000000000000000000000006'), fee: 500, decimals: 18 },
  WETH: { address: getAddress('0x4200000000000000000000000000000000000006'), fee: 500, decimals: 18 },
  USDC: { address: getAddress('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'), fee: 500, decimals: 6 },
  USDT: { address: getAddress('0xfde4C96cDB63B34c82808dd471eC8f6c321A8839'), fee: 100, decimals: 6 },
  DAI:  { address: getAddress('0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb'), fee: 100, decimals: 18 },
  AERO: { address: getAddress('0x94b008aA00579c1307B0EF2c499aD98a8ce58e58'), fee: 3000, decimals: 18 }
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

function parsePromptDirectly(prompt: string) {
  const p = prompt.toUpperCase();
  
  const amountMatch = prompt.match(/(\d+(\.\d+)?)/);
  let rawAmount = amountMatch ? parseFloat(amountMatch[0]) : 0.0001;

  const tokens = ['ETH', 'USDC', 'USDT', 'DAI', 'AERO'];
  let sellToken = 'ETH';
  let buyToken = 'USDC';

  const foundTokens = tokens.filter(t => p.includes(t));

  if (foundTokens.length >= 2) {
    if (p.includes('FOR') || p.includes('TO') || p.includes('INTO')) {
      const parts = p.split(/FOR|TO|INTO/);
      const leftToken = tokens.find(t => parts[0].includes(t));
      const rightToken = tokens.find(t => parts[1]?.includes(t));
      if (leftToken) sellToken = leftToken;
      if (rightToken) buyToken = rightToken;
    } else if (p.includes('BUY') || p.includes('GET')) {
      const buyIndex = p.indexOf('BUY') !== -1 ? p.indexOf('BUY') : p.indexOf('GET');
      const targetToken = tokens.find(t => p.indexOf(t) < buyIndex);
      const payToken = tokens.find(t => p.indexOf(t) > buyIndex);
      if (payToken) sellToken = payToken;
      if (targetToken) buyToken = targetToken;
    } else {
      sellToken = foundTokens[0];
      buyToken = foundTokens[1];
    }
  } else if (foundTokens.length === 1) {
    if (foundTokens[0] === 'ETH') {
      sellToken = 'ETH';
      buyToken = 'USDC';
    } else {
      sellToken = 'ETH';
      buyToken = foundTokens[0];
    }
  }

  if (sellToken === 'ETH' && rawAmount > 0.005) {
    rawAmount = 0.0001;
  }

  return {
    intentType: 'SWAP',
    sellToken,
    buyToken,
    amount: rawAmount.toString(),
    confidenceScore: 0.99
  };
}

export async function POST(req: Request) {
  try {
    const { prompt, userAddress } = await req.json();

    if (!prompt) {
      return NextResponse.json({ success: false, error: 'Prompt is required' }, { status: 400 });
    }

    const intent = parsePromptDirectly(prompt);
    
    const sellTokenObj = BASE_TOKENS[intent.sellToken] || BASE_TOKENS.ETH;
    const buyTokenObj = BASE_TOKENS[intent.buyToken] || BASE_TOKENS.USDC;

    const sellAmountWei = intent.sellToken === 'ETH' 
      ? parseEther(intent.amount) 
      : parseUnits(intent.amount, sellTokenObj.decimals);

    const validUserAddress = (userAddress && userAddress.startsWith('0x')) 
      ? getAddress(userAddress) 
      : getAddress('0x0000000000000000000000000000000000000000');

    // Multicall kullanmadan doğrudan exactInputSingle calldata hazırlama
    const swapCalldata = encodeFunctionData({
      abi: SWAP_ROUTER_ABI,
      functionName: 'exactInputSingle',
      args: [{
        tokenIn: getAddress(sellTokenObj.address),
        tokenOut: getAddress(buyTokenObj.address),
        fee: buyTokenObj.fee,
        recipient: validUserAddress,
        amountIn: sellAmountWei,
        amountOutMinimum: BigInt(0),
        sqrtPriceLimitX96: BigInt(0)
      }]
    });

    const aggregatorQuote = {
      transaction: {
        to: getAddress('0x2626664c2603336E57B271c5C0b26F421741e481'), // Base SwapRouter02
        data: swapCalldata,
        value: intent.sellToken === 'ETH' ? `0x${sellAmountWei.toString(16)}` : '0x0'
      }
    };

    return NextResponse.json({
      success: true,
      data: {
        ...intent,
        sellTokenAddress: sellTokenObj.address,
        buyTokenAddress: buyTokenObj.address,
        sellAmountWei: sellAmountWei.toString(),
        aggregatorQuote
      }
    });

  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Server Error' }, { status: 500 });
  }
}
