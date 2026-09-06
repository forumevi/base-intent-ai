import { NextResponse } from 'next/server';
import { encodeFunctionData, parseUnits, getAddress } from 'viem';

// Base Mainnet Adresleri
const NATIVE_ETH = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
const WETH = getAddress('0x4200000000000000000000000000000000000006');
const USDC = getAddress('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');

// ERC20 Approve ABI
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

export async function POST(req: Request) {
  try {
    const { prompt, userAddress } = await req.json();

    const recipient = (userAddress && userAddress.startsWith('0x'))
      ? getAddress(userAddress)
      : getAddress('0x95773c1f40b82dd8d0529471f6a6016fdfe990aa');

    const lowerPrompt = prompt?.toLowerCase() || '';

    // 1. İşlem Yönü Doğrulaması
    let isBuyEth = false;
    if (lowerPrompt.includes('buy eth') || lowerPrompt.includes('usdc to eth') || lowerPrompt.includes('eth al')) {
      isBuyEth = true;
    }

    // cbETH veya DAI istendiyse de otomatik USDC çiftine fallback yap
    const tokenIn = isBuyEth ? USDC : NATIVE_ETH;
    const tokenOut = isBuyEth ? NATIVE_ETH : USDC;

    // Tutar Tanımlamaları (USDC: 6 Decimals, ETH: 18 Decimals)
    const amountInWei = isBuyEth 
      ? parseUnits('1', 6).toString()  // 1 USDC
      : parseUnits('0.0001', 18).toString(); // 0.0001 ETH

    // 2. KyberSwap Rota Sorgusu
    const routeUrl = `https://aggregator-api.kyberswap.com/base/api/v1/routes?tokenIn=${tokenIn}&tokenOut=${tokenOut}&amountIn=${amountInWei}`;
    const routeRes = await fetch(routeUrl, { headers: { 'x-client-id': 'BaseIntentAI' } });
    const routeData = await routeRes.json();

    if (!routeData?.data?.routeSummary) {
      throw new Error('KyberSwap üzerinde uygun likidite rotası bulunamadı.');
    }

    const routerAddress = getAddress(routeData.data.routeSummary.routerAddress || '0x6131B5fae19EA4f9D964eAc09af83311A6337b5');

    // 3. Calldata Paketleme (Build)
    const buildRes = await fetch(`https://aggregator-api.kyberswap.com/base/api/v1/route/build`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-client-id': 'BaseIntentAI' },
      body: JSON.stringify({
        routeSummary: routeData.data.routeSummary,
        sender: recipient,
        recipient: recipient,
        slippageTolerance: 100 // %1
      })
    });
    const buildData = await buildRes.json();

    if (!buildData?.data?.data) {
      throw new Error('Calldata oluşturulamadı.');
    }

    const swapCalldata = buildData.data.data;

    // 4. USDC -> ETH ise İŞLEM BATCH'İNE APPROVE EKLEME
    const executionBatch = [];

    if (isBuyEth) {
      // Step 1: Approve USDC for Kyber Router
      const approveData = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [routerAddress, parseUnits('1', 6)]
      });

      executionBatch.push({
        step: 1,
        action: 'Approve 1 USDC for KyberSwap Router',
        targetContract: USDC,
        estimatedGasUsd: '$0.001',
        details: { calldata: approveData }
      });

      // Step 2: Swap USDC for ETH
      executionBatch.push({
        step: 2,
        action: 'Swap 1 USDC for ETH via KyberSwap',
        targetContract: routerAddress,
        estimatedGasUsd: '$0.01',
        details: { calldata: swapCalldata }
      });
    } else {
      // ETH -> USDC için doğrudan takas
      executionBatch.push({
        step: 1,
        action: 'Swap 0.0001 ETH for USDC via KyberSwap',
        targetContract: routerAddress,
        estimatedGasUsd: '$0.01',
        details: { calldata: swapCalldata }
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        to: isBuyEth ? (executionBatch.length > 1 ? USDC : routerAddress) : routerAddress,
        data: executionBatch[0].details.calldata,
        value: isBuyEth ? '0x0' : `0x${BigInt(amountInWei).toString(16)}`,
        sellToken: isBuyEth ? 'USDC' : 'ETH',
        buyToken: isBuyEth ? 'ETH' : 'USDC',
        amount: isBuyEth ? '1' : '0.0001',
        executionBatch: executionBatch
      }
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Route Failed' }, { status: 500 });
  }
}
