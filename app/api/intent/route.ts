import { NextResponse } from 'next/server';
import { encodeFunctionData, parseEther, parseUnits, getAddress } from 'viem';

// Base Mainnet Likiditesi Yüksek Doğrulanmış Kontratlar
const BASE_TOKENS: Record<string, { address: `0x${string}`; fee: number; decimals: number }> = {
  ETH:   { address: getAddress('0x4200000000000000000000000000000000000006'), fee: 500, decimals: 18 },
  WETH:  { address: getAddress('0x4200000000000000000000000000000000000006'), fee: 500, decimals: 18 },
  USDC:  { address: getAddress('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'), fee: 500, decimals: 6 },
  CBETH: { address: getAddress('0x2Ae3F1Ec7F1F5012A327B6231F67a030B7B80498'), fee: 500, decimals: 18 },
  DAI:   { address: getAddress('0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb'), fee: 500, decimals: 18 },
  AERO:  { address: getAddress('0x94b008aA00579c1307B0EF2c499aD98a8ce58e58'), fee: 3000, decimals: 18 }
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

function parseIntent(prompt: string) {
  const cleanPrompt = prompt.trim().toLowerCase();
  const amountMatch = cleanPrompt.match(/(\d+(\.\d+)?)/);
  const amount = amountMatch ? amountMatch[0] : '0.0001';

  let sellToken = 'ETH';
  let buyToken = 'USDC';

  if (cleanPrompt.includes('cbeth')) buyToken = 'CBETH';
  else if (cleanPrompt.includes('dai')) buyToken = 'DAI';
  else if (cleanPrompt.includes('aero')) buyToken = 'AERO';
  else if (cleanPrompt.includes('usdc')) buyToken = 'USDC';

  return { sellToken, buyToken, amount };
}

export async function POST(req: Request) {
  try {
    const { prompt, userAddress } = await req.json();

    if (!prompt) {
      return NextResponse.json({ success: false, error: 'Prompt is required' }, { status: 400 });
    }

    const intent = parseIntent(prompt);
    const sellTokenObj = BASE_TOKENS[intent.sellToken];
    const buyTokenObj = BASE_TOKENS[intent.buyToken];

    const sellAmountWei = parseEther(intent.amount);

    // Eğer cüzdan bağlı değilse veya boşsa fallback address kullanımı
    const recipientAddress = (userAddress && userAddress.startsWith('0x')) 
      ? getAddress(userAddress) 
      : getAddress('0x0000000000000000000000000000000000000000');

    const swapCalldata = encodeFunctionData({
      abi: SWAP_ROUTER_ABI,
      functionName: 'exactInputSingle',
      args: [{
        tokenIn: getAddress(sellTokenObj.address),
        tokenOut: getAddress(buyTokenObj.address),
        fee: buyTokenObj.fee,
        recipient: recipientAddress,
        amountIn: sellAmountWei,
        amountOutMinimum: BigInt(0),
        sqrtPriceLimitX96: BigInt(0)
      }]
    });

    return NextResponse.json({
      success: true,
      data: {
        to: getAddress('0x2626664c2603336E57B271c5C0b26F421741e481'), // Uniswap V3 SwapRouter02
        data: swapCalldata,
        value: `0x${sellAmountWei.toString(16)}`,
        sellToken: intent.sellToken,
        buyToken: intent.buyToken,
        amount: intent.amount
      }
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Error processing intent' }, { status: 500 });
  }
}
