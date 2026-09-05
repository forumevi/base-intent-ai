import { NextResponse } from 'next/server';
import { encodeFunctionData, parseEther, parseUnits } from 'viem';

const BASE_TOKENS: Record<string, { address: string; fee: number; decimals: number }> = {
  ETH:  { address: '0x4200000000000000000000000000000000000006', fee: 500, decimals: 18 },
  WETH: { address: '0x4200000000000000000000000000000000000006', fee: 500, decimals: 18 },
  USDC: { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', fee: 500, decimals: 6 },
  USDT: { address: '0xfde4C96cDB63B34c82808dd471eC8f6c321A8839', fee: 100, decimals: 6 },
  DAI:  { address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb', fee: 100, decimals: 18 },
  AERO: { address: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58', fee: 3000, decimals: 18 }
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
  },
  {
    inputs: [{ name: 'data', type: 'bytes[]' }],
    name: 'multicall',
    outputs: [{ name: 'results', type: 'bytes[]' }],
    stateMutability: 'payable',
    type: 'function'
  }
] as const;

function parsePromptDirectly(prompt: string) {
  const p = prompt.toLowerCase();
  
  // Miktar bul
  const amountMatch = p.match(/(\d+(\.\d+)?)/);
  const rawAmount = amountMatch ? parseFloat(amountMatch[0]) : 0.0001;

  // "1 usdc buy with eth" -> TokenIn: ETH, TokenOut: USDC, Ama miktar ne?
  // Eğer prompt'ta '0.0001 eth' gibi açık belirtilmediyse, güvenli mikro tutarlar belirlenir.
  let sellToken = 'ETH';
  let buyToken = 'USDC';

  if (p.includes('usdc') && (p.includes('buy with eth') || p.includes('for eth') || p.includes('eth to usdc') || p.includes('swap eth'))) {
    sellToken = 'ETH';
    buyToken = 'USDC';
  } else if (p.includes('eth') && (p.includes('buy with usdc') || p.includes('usdc to eth') || p.includes('for usdc'))) {
    sellToken = 'USDC';
    buyToken = 'ETH';
  }

  // Güvenlik Limiti: Eğer ETH satılıyorsa ve miktar 0.01'den büyükse yanlış anlamayı önlemek için 0.0001 ETH'ye sabitle!
  let safeAmountStr = rawAmount.toString();
  if (sellToken === 'ETH' && rawAmount > 0.005) {
    safeAmountStr = '0.0001'; // Güvenlik çemberi! 1 ETH çekmesini engeller.
  } else if (sellToken === 'USDC' && rawAmount > 10) {
    safeAmountStr = '1';
  }

  return {
    intentType: 'SWAP',
    sellToken,
    buyToken,
    amount: safeAmountStr,
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

    // Decimal çevrimi
    const sellAmountWei = intent.sellToken === 'ETH' 
      ? parseEther(intent.amount) 
      : parseUnits(intent.amount, sellTokenObj.decimals);

    const recipient = (userAddress && userAddress.startsWith('0x')) ? userAddress : '0x0000000000000000000000000000000000000000';

    const swapCalldata = encodeFunctionData({
      abi: SWAP_ROUTER_ABI,
      functionName: 'exactInputSingle',
      args: [{
        tokenIn: sellTokenObj.address as `0x${string}`,
        tokenOut: buyTokenObj.address as `0x${string}`,
        fee: buyTokenObj.fee,
        recipient: recipient as `0x${string}`,
        amountIn: sellAmountWei,
        amountOutMinimum: BigInt(0),
        sqrtPriceLimitX96: BigInt(0)
      }]
    });

    const multicallCalldata = encodeFunctionData({
      abi: SWAP_ROUTER_ABI,
      functionName: 'multicall',
      args: [[swapCalldata]]
    });

    const aggregatorQuote = {
      transaction: {
        to: '0x2626664c2603336E57B271c5C0b26F421741e481', // Base SwapRouter02
        data: multicallCalldata,
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
