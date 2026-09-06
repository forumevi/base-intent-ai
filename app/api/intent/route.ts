import { NextResponse } from 'next/server';
import { encodeFunctionData, parseEther, parseUnits, getAddress } from 'viem';

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
  const p = prompt.toLowerCase();
  
  // Miktar bulma (varsayılan: 0.0001 ETH veya 1 USDC)
  const amountMatch = p.match(/(\d+(\.\d+)?)/);
  let rawAmount = amountMatch ? amountMatch[0] : null;

  let sellToken = 'ETH';
  let buyToken = 'USDC';

  // "USDC ile ETH al" / "Buy ETH with USDC" mantığı
  const isBuyingEthWithUsdc = 
    (p.includes('usdc') && (p.includes('eth al') || p.includes('buy eth') || p.includes('for eth') || p.includes('to eth'))) ||
    (p.indexOf('usdc') < p.indexOf('eth') && (p.includes('with') || p.includes('ile')));

  if (isBuyingEthWithUsdc) {
    sellToken = 'USDC';
    buyToken = 'ETH';
    if (!rawAmount) rawAmount = '1'; // Varsayılan 1 USDC
  } else if (p.includes('cbeth')) {
    buyToken = 'CBETH';
  } else if (p.includes('dai')) {
    buyToken = 'DAI';
  } else if (p.includes('aero')) {
    buyToken = 'AERO';
  }

  if (!rawAmount) rawAmount = '0.0001';

  return { sellToken, buyToken, amount: rawAmount };
}

export async function POST(req: Request) {
  try {
    const { prompt, userAddress } = await req.json();

    if (!prompt) {
      return NextResponse.json({ success: false, error: 'Prompt is required' }, { status: 400 });
    }

    const intent = parseIntent(prompt);
    const sellObj = BASE_TOKENS[intent.sellToken];
    const buyObj = BASE_TOKENS[intent.buyToken];

    // Miktarı token'ın kendi decimal değerine göre çevir
    const amountInWei = parseUnits(intent.amount, sellObj.decimals);

    const recipientAddress = (userAddress && userAddress.startsWith('0x')) 
      ? getAddress(userAddress) 
      : getAddress('0x0000000000000000000000000000000000000000');

    // Uniswap V3 Calldata Oluşturma
    const swapCalldata = encodeFunctionData({
      abi: SWAP_ROUTER_ABI,
      functionName: 'exactInputSingle',
      args: [{
        tokenIn: sellObj.address,
        tokenOut: buyObj.address,
        fee: sellObj.fee || buyObj.fee,
        recipient: recipientAddress,
        amountIn: amountInWei,
        amountOutMinimum: BigInt(0),
        sqrtPriceLimitX96: BigInt(0)
      }]
    });

    // Satılan token ETH ise wei gönderilir, ERC-20 ise value = 0x0
    const txValue = intent.sellToken === 'ETH' ? `0x${amountInWei.toString(16)}` : '0x0';

    return NextResponse.json({
      success: true,
      data: {
        to: getAddress('0x2626664c2603336E57B271c5C0b26F421741e481'), // Uniswap V3 Router
        data: swapCalldata,
        value: txValue,
        sellToken: intent.sellToken,
        buyToken: intent.buyToken,
        amount: intent.amount
      }
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Error processing intent' }, { status: 500 });
  }
}
