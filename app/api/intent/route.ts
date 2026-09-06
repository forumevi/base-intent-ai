import { NextResponse } from 'next/server';
import { encodeFunctionData, parseUnits, getAddress } from 'viem';

// Base Mainnet Desteklenen Token Adresleri
const TOKENS: Record<string, { address: `0x${string}`; decimals: number }> = {
  ETH: { address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', decimals: 18 },
  USDC: { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6 },
  USDT: { address: '0xf82323B9123f287B44f19B26E074D76735e5d3D6', decimals: 6 },
  DAI: { address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb', decimals: 18 },
  CBETH: { address: '0x2Ae3F1Ec7F1F5012A327e5D6A53A042A2D405788', decimals: 18 }
};

const DEFAULT_KYBER_ROUTER = '0x6131B5fae19EA4f9D964eAc09af83311A6337b5';

const ERC20_ABI = [
  {
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function'
  }
] as const;

function toChecksum(address: string): `0x${string}` {
  try {
    return getAddress(address);
  } catch {
    const cleanAddress = address.toLowerCase().replace('0x', '');
    return getAddress(`0x${cleanAddress}`);
  }
}

// Groq / LLM Parsing veya Kural Tabanlı Fallback Niyet Motoru
function parseIntent(prompt: string) {
  const p = prompt.toLowerCase();
  
  let sellToken = 'ETH';
  let buyToken = 'USDC';
  let amount = '0.0001';

  // Tutar Tespiti
  const numbers = p.match(/\d+(\.\d+)?/g);
  if (numbers && numbers.length > 0) {
    amount = numbers[0];
  }

  // Token Tespiti
  if (p.includes('usdc')) {
    if (p.includes('usdc to') || p.includes('buy eth with usdc') || p.includes('usdc ile')) {
      sellToken = 'USDC';
      buyToken = 'ETH';
    } else {
      buyToken = 'USDC';
    }
  } else if (p.includes('usdt')) {
    if (p.includes('usdt to') || p.includes('usdt ile')) {
      sellToken = 'USDT';
      buyToken = 'ETH';
    } else {
      buyToken = 'USDT';
    }
  } else if (p.includes('dai')) {
    if (p.includes('dai to') || p.includes('dai ile')) {
      sellToken = 'DAI';
      buyToken = 'ETH';
    } else {
      buyToken = 'DAI';
    }
  }

  return { sellToken, buyToken, amount };
}

export async function POST(req: Request) {
  try {
    const { prompt, userAddress } = await req.json();

    const recipient = userAddress && userAddress.startsWith('0x')
      ? toChecksum(userAddress)
      : toChecksum('0x95773c1f40b82dd8d0529471f6a6016fdfe990aa');

    // Niyet Ayrıştırma
    const parsed = parseIntent(prompt);
    
    const tokenInObj = TOKENS[parsed.sellToken] || TOKENS.ETH;
    const tokenOutObj = TOKENS[parsed.buyToken] || TOKENS.USDC;

    const tokenIn = toChecksum(tokenInObj.address);
    const tokenOut = toChecksum(tokenOutObj.address);

    const amountInWei = parseUnits(parsed.amount, tokenInObj.decimals).toString();

    // KyberSwap Rota Sorgusu
    const routeUrl = `https://aggregator-api.kyberswap.com/base/api/v1/routes?tokenIn=${tokenIn}&tokenOut=${tokenOut}&amountIn=${amountInWei}`;
    const routeRes = await fetch(routeUrl, { headers: { 'x-client-id': 'BaseIntentAI' } });
    const routeData = await routeRes.json();

    const routeSummary = routeData?.data?.routeSummary;
    if (!routeSummary) {
      throw new Error(`${parsed.sellToken} ➔ ${parsed.buyToken} için KyberSwap üzerinde likidite rotası bulunamadı.`);
    }

    const rawRouter = routeSummary.routerAddress || routeData?.data?.routerAddress || DEFAULT_KYBER_ROUTER;
    const routerAddress = toChecksum(rawRouter);

    // Calldata Build
    const buildRes = await fetch(`https://aggregator-api.kyberswap.com/base/api/v1/route/build`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-client-id': 'BaseIntentAI' },
      body: JSON.stringify({
        routeSummary: routeSummary,
        sender: recipient,
        recipient: recipient,
        slippageTolerance: 100
      })
    });
    const buildData = await buildRes.json();

    if (!buildData?.data?.data) {
      throw new Error('Calldata üretilemedi.');
    }

    const swapCalldata = buildData.data.data;
    const executionBatch = [];
    const isNativeIn = parsed.sellToken === 'ETH';

    if (!isNativeIn) {
      const approveData = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [routerAddress, BigInt(amountInWei)]
      });

      executionBatch.push({
        step: 1,
        action: `Approve ${parsed.amount} ${parsed.sellToken} for KyberSwap`,
        targetContract: tokenIn,
        details: { calldata: approveData }
      });
    }

    executionBatch.push({
      step: isNativeIn ? 1 : 2,
      action: `Swap ${parsed.amount} ${parsed.sellToken} for ${parsed.buyToken}`,
      targetContract: routerAddress,
      details: { calldata: swapCalldata }
    });

    return NextResponse.json({
      success: true,
      data: {
        to: isNativeIn ? routerAddress : tokenIn,
        data: executionBatch[0].details.calldata,
        value: isNativeIn ? `0x${BigInt(amountInWei).toString(16)}` : '0x0',
        sellToken: parsed.sellToken,
        buyToken: parsed.buyToken,
        amount: parsed.amount,
        executionBatch: executionBatch
      }
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Route Failed' }, { status: 500 });
  }
}
