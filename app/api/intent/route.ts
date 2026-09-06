import { NextResponse } from 'next/server';
import { encodeFunctionData, parseUnits, getAddress } from 'viem';

// Base Mainnet Adresleri
const NATIVE_ETH = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
const WETH = getAddress('0x4200000000000000000000000000000000000006');
const USDC = getAddress('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');

// Uniswap V3 Router (Base)
const UNISWAP_ROUTER = getAddress('0x2626664c2603336E57B271c5C0b26F421741e481');

const UNISWAP_ABI = [
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

export async function POST(req: Request) {
  try {
    const { prompt, userAddress } = await req.json();

    const recipient = (userAddress && userAddress.startsWith('0x'))
      ? getAddress(userAddress)
      : UNISWAP_ROUTER;

    const lowerPrompt = prompt?.toLowerCase() || "";

    // 1. İşlem Yönünün Doğru Tespiti (Buy ETH vs Sell ETH)
    let isBuyEth = false;
    if (lowerPrompt.includes("buy eth") || lowerPrompt.includes("usdc to eth") || lowerPrompt.includes("eth al")) {
      isBuyEth = true;
    }

    const tokenIn = isBuyEth ? USDC : NATIVE_ETH;
    const tokenOut = isBuyEth ? NATIVE_ETH : USDC;

    // USDC için 6 decimal, ETH için 18 decimal
    const amountInWei = isBuyEth 
      ? parseUnits("1", 6).toString() // Varsayılan 1 USDC
      : parseUnits("0.0001", 18).toString(); // 0.0001 ETH

    // 2. KyberSwap Rota Sorgusu
    try {
      const routeUrl = `https://aggregator-api.kyberswap.com/base/api/v1/routes?tokenIn=${tokenIn}&tokenOut=${tokenOut}&amountIn=${amountInWei}`;
      const routeRes = await fetch(routeUrl, { headers: { 'x-client-id': 'BaseIntentAI' } });
      const routeData = await routeRes.json();

      if (routeData?.data?.routeSummary) {
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

        if (buildData?.data?.data) {
          return NextResponse.json({
            success: true,
            data: {
              to: getAddress(buildData.data.routerAddress),
              data: buildData.data.data,
              value: isBuyEth ? "0x0" : `0x${BigInt(amountInWei).toString(16)}`,
              sellToken: isBuyEth ? 'USDC' : 'ETH',
              buyToken: isBuyEth ? 'ETH' : 'USDC',
              amount: isBuyEth ? '1' : '0.0001',
              executionBatch: [
                {
                  step: 1,
                  action: isBuyEth ? "Swap 1 USDC for ETH" : "Swap 0.0001 ETH for USDC",
                  targetContract: buildData.data.routerAddress,
                  estimatedGasUsd: "$0.01",
                  details: { calldata: buildData.data.data }
                }
              ]
            }
          });
        }
      }
    } catch (e) {
      console.warn("KyberSwap pas geçildi, Uniswap V3 yedek rotası devreye giriyor.");
    }

    // 3. Fallback: Uniswap V3 Doğrudan Çağrı (ETH -> USDC)
    const swapCalldata = encodeFunctionData({
      abi: UNISWAP_ABI,
      functionName: 'exactInputSingle',
      args: [{
        tokenIn: isBuyEth ? USDC : WETH,
        tokenOut: isBuyEth ? WETH : USDC,
        fee: 500, // %0.05
        recipient: recipient,
        amountIn: BigInt(amountInWei),
        amountOutMinimum: BigInt(0),
        sqrtPriceLimitX96: BigInt(0)
      }]
    });

    return NextResponse.json({
      success: true,
      data: {
        to: UNISWAP_ROUTER,
        data: swapCalldata,
        value: isBuyEth ? "0x0" : `0x${BigInt(amountInWei).toString(16)}`,
        sellToken: isBuyEth ? 'USDC' : 'ETH',
        buyToken: isBuyEth ? 'ETH' : 'USDC',
        amount: isBuyEth ? '1' : '0.0001',
        executionBatch: [
          {
            step: 1,
            action: isBuyEth ? "Swap 1 USDC for ETH via Uniswap" : "Swap 0.0001 ETH for USDC via Uniswap",
            targetContract: UNISWAP_ROUTER,
            estimatedGasUsd: "$0.01",
            details: { calldata: swapCalldata }
          }
        ]
      }
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || "Route Failed" }, { status: 500 });
  }
}
