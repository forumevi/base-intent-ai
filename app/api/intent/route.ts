import { NextResponse } from 'next/server';
import { encodeFunctionData, parseUnits, getAddress } from 'viem';

// Base Mainnet Adresleri
const NATIVE_ETH = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
// Base KyberSwap Aggregator V3 Default Router
const DEFAULT_KYBER_ROUTER = '0x6131B5fae19EA4f9D964eAc09af83311A6337b5';

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

function toChecksum(address: string): `0x${string}` {
  try {
    return getAddress(address);
  } catch {
    const cleanAddress = address.toLowerCase().replace('0x', '');
    return getAddress(`0x${cleanAddress}`);
  }
}

export async function POST(req: Request) {
  try {
    const { prompt, userAddress } = await req.json();

    const recipient = userAddress && userAddress.startsWith('0x')
      ? toChecksum(userAddress)
      : toChecksum('0x95773c1f40b82dd8d0529471f6a6016fdfe990aa');

    const lowerPrompt = prompt?.toLowerCase() || '';

    let isBuyEth = false;
    if (lowerPrompt.includes('buy eth') || lowerPrompt.includes('usdc to eth') || lowerPrompt.includes('eth al')) {
      isBuyEth = true;
    }

    const tokenIn = isBuyEth ? toChecksum(USDC) : NATIVE_ETH;
    const tokenOut = isBuyEth ? NATIVE_ETH : toChecksum(USDC);

    const amountInWei = isBuyEth 
      ? parseUnits('1', 6).toString()
      : parseUnits('0.0001', 18).toString();

    // KyberSwap Rota Sorgusu
    const routeUrl = `https://aggregator-api.kyberswap.com/base/api/v1/routes?tokenIn=${tokenIn}&tokenOut=${tokenOut}&amountIn=${amountInWei}`;
    const routeRes = await fetch(routeUrl, { headers: { 'x-client-id': 'BaseIntentAI' } });
    const routeData = await routeRes.json();

    const routeSummary = routeData?.data?.routeSummary;
    if (!routeSummary) {
      throw new Error('KyberSwap üzerinde geçerli likidite rotası bulunamadı.');
    }

    // Router adresi API yanıtından veya varsayılan adresten güvenle çekilir
    const rawRouter = routeSummary.routerAddress || routeData?.data?.routerAddress || DEFAULT_KYBER_ROUTER;
    const routerAddress = toChecksum(rawRouter);

    // Calldata Paketleme (Build)
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

    if (isBuyEth) {
      const approveData = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [routerAddress, parseUnits('1', 6)]
      });

      executionBatch.push({
        step: 1,
        action: 'Approve 1 USDC for KyberSwap Router',
        targetContract: toChecksum(USDC),
        estimatedGasUsd: '$0.001',
        details: { calldata: approveData }
      });

      executionBatch.push({
        step: 2,
        action: 'Swap 1 USDC for ETH via KyberSwap',
        targetContract: routerAddress,
        estimatedGasUsd: '$0.01',
        details: { calldata: swapCalldata }
      });
    } else {
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
        to: isBuyEth ? toChecksum(USDC) : routerAddress,
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
