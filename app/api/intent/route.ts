import { NextResponse } from 'next/server';
import { encodeFunctionData, parseUnits, getAddress } from 'viem';

const WETH = '0x4200000000000000000000000000000000000006';
const CBETH = '0x2Ae3F1Ec7F1F5012A327B6231F67a030B7B80498';
const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

// Uniswap V3 SwapRouter02 (Base)
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

    let buyToken = CBETH;
    let buySymbol = "CBETH";
    if (prompt?.toUpperCase().includes("USDC")) {
      buyToken = USDC;
      buySymbol = "USDC";
    }

    const amountInWei = parseUnits("0.0001", 18);

    // 1. KyberSwap Aggregator API'si (API Key Gerektirmez, Güvenilirdir)
    try {
      const kyberRes = await fetch(
        `https://aggregator-api.kyberswap.com/base/api/v1/routes?tokenIn=${WETH}&tokenOut=${buyToken}&amountIn=${amountInWei.toString()}`
      );
      const kyberData = await kyberRes.json();

      if (kyberData?.code === 0 && kyberData?.data?.routeSummary) {
        const buildRes = await fetch(`https://aggregator-api.kyberswap.com/base/api/v1/route/build`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            routeSummary: kyberData.data.routeSummary,
            sender: recipient,
            recipient: recipient,
            slippageTolerance: 100 // %1
          })
        });
        const buildData = await buildRes.json();

        if (buildData?.code === 0 && buildData?.data) {
          return NextResponse.json({
            success: true,
            data: {
              to: buildData.data.routerAddress,
              data: buildData.data.data,
              value: `0x${amountInWei.toString(16)}`,
              sellToken: 'ETH',
              buyToken: buySymbol,
              amount: '0.0001',
              executionBatch: [
                {
                  step: 1,
                  action: `Swap 0.0001 ETH for ${buySymbol} via KyberSwap`,
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
      console.warn("KyberSwap failed, falling back to Uniswap V3 direct call");
    }

    // 2. Fallback: Uniswap V3 Direct Calldata (Sorunsuz Yedek)
    const swapCalldata = encodeFunctionData({
      abi: UNISWAP_ABI,
      functionName: 'exactInputSingle',
      args: [{
        tokenIn: WETH,
        tokenOut: getAddress(buyToken),
        fee: buySymbol === 'CBETH' ? 100 : 500, // cbETH havuzu %0.01 fee
        recipient: recipient,
        amountIn: amountInWei,
        amountOutMinimum: BigInt(0),
        sqrtPriceLimitX96: BigInt(0)
      }]
    });

    return NextResponse.json({
      success: true,
      data: {
        to: UNISWAP_ROUTER,
        data: swapCalldata,
        value: `0x${amountInWei.toString(16)}`,
        sellToken: 'ETH',
        buyToken: buySymbol,
        amount: '0.0001',
        executionBatch: [
          {
            step: 1,
            action: `Swap 0.0001 ETH for ${buySymbol} via Uniswap V3`,
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
