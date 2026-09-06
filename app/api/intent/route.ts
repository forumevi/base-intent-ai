import { NextResponse } from 'next/server';
import { encodeFunctionData, parseEther, parseUnits, getAddress } from 'viem';

// Base Mainnet Doğru Havuz Fee Tier'ları
const BASE_TOKENS: Record<string, { address: `0x${string}`; fee: number; decimals: number }> = {
  ETH:  { address: getAddress('0x4200000000000000000000000000000000000006'), fee: 500, decimals: 18 },
  WETH: { address: getAddress('0x4200000000000000000000000000000000000006'), fee: 500, decimals: 18 },
  USDC: { address: getAddress('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'), fee: 500, decimals: 6 },  // %0.05
  USDT: { address: getAddress('0xfde4C96cDB63B34c82808dd471eC8f6c321A8839'), fee: 3000, decimals: 6 }, // Base'de WETH/USDT %0.30 (3000) fee tier kullanır
  DAI:  { address: getAddress('0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb'), fee: 500, decimals: 18 },
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

function parseGroundedIntent(prompt: string) {
  const cleanPrompt = prompt.trim();
  const lower = cleanPrompt.toLowerCase();

  const amountMatch = cleanPrompt.match(/(\d+(\.\d+)?)/);
  const targetAmount = amountMatch ? amountMatch[0] : '0.0001';

  let sellToken = 'ETH';
  let buyToken = 'USDC';

  const isBuyIntent = lower.includes('al') || lower.includes('buy') || lower.includes('get');

  if (isBuyIntent) {
    if (lower.includes('usdt')) buyToken = 'USDT';
    else if (lower.includes('usdc')) buyToken = 'USDC';
    else if (lower.includes('dai')) buyToken = 'DAI';
    else if (lower.includes('aero')) buyToken = 'AERO';

    if (lower.includes('eth ile') || lower.includes('with eth') || lower.includes('pay eth')) {
      sellToken = 'ETH';
    }
  } else {
    if (lower.includes('eth')) sellToken = 'ETH';
    if (lower.includes('usdt')) buyToken = 'USDT';
    else if (lower.includes('usdc')) buyToken = 'USDC';
    else if (lower.includes('dai')) buyToken = 'DAI';
    else if (lower.includes('aero')) buyToken = 'AERO';
  }

  return {
    sellToken,
    buyToken,
    amount: targetAmount,
    isBuyIntent
  };
}

export async function POST(req: Request) {
  try {
    const { prompt, userAddress } = await req.json();

    if (!prompt) {
      return NextResponse.json({ success: false, error: 'Prompt is required' }, { status: 400 });
    }

    const intent = parseGroundedIntent(prompt);
    
    const sellTokenObj = BASE_TOKENS[intent.sellToken] || BASE_TOKENS.ETH;
    const buyTokenObj = BASE_TOKENS[intent.buyToken] || BASE_TOKENS.USDT;

    let sellAmountWei: bigint;

    if (intent.isBuyIntent && intent.sellToken === 'ETH') {
      const targetBuyAmount = parseFloat(intent.amount);
      const estimatedEthRequired = targetBuyAmount / 2500;
      sellAmountWei = parseEther(estimatedEthRequired.toFixed(8));
    } else {
      sellAmountWei = intent.sellToken === 'ETH' 
        ? parseEther(intent.amount) 
        : parseUnits(intent.amount, sellTokenObj.decimals);
    }

    const validUserAddress = (userAddress && userAddress.startsWith('0x')) 
      ? getAddress(userAddress) 
      : getAddress('0x0000000000000000000000000000000000000000');

    // Uniswap V3 Swap Parametreleri
    const swapCalldata = encodeFunctionData({
      abi: SWAP_ROUTER_ABI,
      functionName: 'exactInputSingle',
      args: [{
        tokenIn: getAddress(sellTokenObj.address),
        tokenOut: getAddress(buyTokenObj.address),
        fee: buyTokenObj.fee, // USDT için artırılan 3000 fee uygulanır
        recipient: validUserAddress,
        amountIn: sellAmountWei,
        amountOutMinimum: BigInt(0),
        sqrtPriceLimitX96: BigInt(0)
      }]
    });

    const aggregatorQuote = {
      transaction: {
        to: getAddress('0x2626664c2603336E57B271c5C0b26F421741e481'),
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
