import { NextResponse } from 'next/server';
import { getAddress } from 'viem';

// Base Mainnet Adresleri
const NATIVE_ETH = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'; // Native ETH için standart adres
const CBETH = getAddress('0x2Ae3F1Ec7F1F5012A327B6231F67a030B7B80498');
const USDC = getAddress('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');

export async function POST(req: Request) {
  try {
    const { prompt, userAddress } = await req.json();

    const recipient = (userAddress && userAddress.startsWith('0x'))
      ? getAddress(userAddress)
      : getAddress('0x95773c1f40b82dd8d0529471f6a6016fdfe990aa');

    let buyToken = CBETH;
    let buySymbol = 'CBETH';

    if (prompt?.toUpperCase().includes('USDC')) {
      buyToken = USDC;
      buySymbol = 'USDC';
    }

    const amountInWei = '100000000000000'; // 0.0001 ETH (18 decimals)

    // 1. KyberSwap Router API - Rota Sorgusu
    const routeUrl = `https://aggregator-api.kyberswap.com/base/api/v1/routes?tokenIn=${NATIVE_ETH}&tokenOut=${buyToken}&amountIn=${amountInWei}`;
    
    const routeRes = await fetch(routeUrl, {
      headers: { 'x-client-id': 'BaseIntentAI' }
    });
    const routeData = await routeRes.json();

    if (!routeData?.data?.routeSummary) {
      throw new Error("KyberSwap üzerinde uygun likidite rotası bulunamadı.");
    }

    // 2. KyberSwap Calldata Oluşturma (Build)
    const buildUrl = `https://aggregator-api.kyberswap.com/base/api/v1/route/build`;
    const buildRes = await fetch(buildUrl, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-client-id': 'BaseIntentAI'
      },
      body: JSON.stringify({
        routeSummary: routeData.data.routeSummary,
        sender: recipient,
        recipient: recipient,
        slippageTolerance: 50 // %0.5 Slippage
      })
    });

    const buildData = await buildRes.json();

    if (!buildData?.data?.data) {
      throw new Error("KyberSwap Calldata üretilemedi.");
    }

    return NextResponse.json({
      success: true,
      data: {
        to: getAddress(buildData.data.routerAddress),
        data: buildData.data.data,
        value: `0x${BigInt(amountInWei).toString(16)}`,
        sellToken: 'ETH',
        buyToken: buySymbol,
        amount: '0.0001',
        executionBatch: [
          {
            step: 1,
            action: `Swap 0.0001 ETH for ${buySymbol} via KyberSwap Aggregator`,
            targetContract: buildData.data.routerAddress,
            estimatedGasUsd: '$0.01',
            details: { calldata: buildData.data.data }
          }
        ]
      }
    });

  } catch (error: any) {
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Routing hatası oluştu.' 
    }, { status: 500 });
  }
}
