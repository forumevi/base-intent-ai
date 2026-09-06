import { NextResponse } from 'next/server';
import { encodeFunctionData, parseUnits, getAddress } from 'viem';

// Base Mainnet Adresleri
const NATIVE_ETH = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const DEFAULT_KYBER_ROUTER = '0x6131b5fae19ea4f9d964eac09af83311a6337b5';

// Güvenli Adres Formatlama Yardımcısı
const safeGetAddress = (addr: string): `0x${string}` => {
  try {
    return getAddress(addr);
  } catch {
    // Checksum hatası verirse küçük harfe çevirip tekrar dener
    return getAddress(addr.toLowerCase());
  }
};

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
      ? safeGetAddress(userAddress)
      : safeGetAddress('0x95773c1f40b82dd8d0529471f6a6016fdfe990aa');

    const lowerPrompt = prompt?.toLowerCase() || '';

    // İşlem Yönü Doğrulaması
    let isBuyEth = false;
    if (lowerPrompt.includes('buy eth') || lowerPrompt.includes('usdc to eth') || lowerPrompt.includes('eth al')) {
      isBuyEth = true;
    }

    const tokenIn = isBuyEth ? USDC : NATIVE_ETH;
    const tokenOut = isBuyEth ? NATIVE_ETH : USDC;

    // USDC için 6 Decimals, ETH için 18 Decimals
    const amountInWei = isBuyEth 
      ? parseUnits('1', 6).toString()  // 1 USDC
      : parseUnits('0.0001', 18).toString(); // 0.0001 ETH

    // KyberSwap Rota Sorgusu
    const routeUrl = `https://aggregator-api.kyberswap.com/base/api/v1/routes?tokenIn=${tokenIn}&tokenOut=${tokenOut}&amountIn=${amountInWei}`;
    const routeRes = await fetch(routeUrl, { headers: { 'x-client-id': 'BaseIntentAI' } });
    const routeData = await routeRes.json();

    if (!routeData?.data?.routeSummary) {
      throw new Error('KyberSwap üzerinde rota bulunamadı.');
    }

    const rawRouter = routeData.data.routeSummary.routerAddress || DEFAULT_KYBER_ROUTER;
    const routerAddress = safeGetAddress(rawRouter);

    // Calldata Paketleme (Build)
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
      throw new Error('Calldata üretilemedi.');
    }

    const swapCalldata = buildData.data.data;
    const executionBatch = [];

    if (isBuyEth) {
      // Step 1: Approve USDC
      const approveData = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [routerAddress, parseUnits('1', 6)]
      });

      executionBatch.push({
        step: 1,
        action: 'Approve 1 USDC for KyberSwap Router',
        targetContract: safeGetAddress(USDC),
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
      // Direct ETH -> USDC Swap
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
        to: isBuyEth ? safeGetAddress(USDC) : routerAddress,
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
