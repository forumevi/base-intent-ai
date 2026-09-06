import { NextResponse } from 'next/server';
import { encodeFunctionData, parseUnits, getAddress } from 'viem';

const WETH = getAddress('0x4200000000000000000000000000000000000006');
const UNISWAP_ROUTER = getAddress('0x2626664c2603336E57B271c5C0b26F421741e481');

const BASE_TOKENS: Record<string, { address: `0x${string}`; decimals: number }> = {
  ETH:   { address: WETH, decimals: 18 },
  WETH:  { address: WETH, decimals: 18 },
  USDC:  { address: getAddress('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'), decimals: 6 },
  CBETH: { address: getAddress('0x2Ae3F1Ec7F1F5012A327B6231F67a030B7B80498'), decimals: 18 },
  DAI:   { address: getAddress('0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb'), decimals: 18 },
  AERO:  { address: getAddress('0x94b008aA00579c1307B0EF2c499aD98a8ce58e58'), decimals: 18 }
};

const MULTICALL_ABI = [
  {
    inputs: [{ name: 'data', type: 'bytes[]' }],
    name: 'multicall',
    outputs: [{ name: 'results', type: 'bytes[]' }],
    stateMutability: 'payable',
    type: 'function'
  }
] as const;

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

export async function POST(req: Request) {
  try {
    const { prompt, userAddress } = await req.json();

    // Dinamik Prompt Analizi
    let buyToken = "CBETH";
    if (prompt.includes("USDC")) buyToken = "USDC";
    if (prompt.includes("DAI")) buyToken = "DAI";
    if (prompt.includes("AERO")) buyToken = "AERO";

    const sellToken = "ETH";
    const amountStr = "0.0001";

    const buyObj = BASE_TOKENS[buyToken] || BASE_TOKENS.CBETH;
    const amountInWei = parseUnits(amountStr, 18);
    const recipient = (userAddress && userAddress.startsWith('0x')) ? getAddress(userAddress) : UNISWAP_ROUTER;

    // Token bazlı kesin fee tier (cbETH/WETH havuzu %0.01 yani 100 olmak zorundadır)
    const feeTier = buyToken === 'CBETH' || buyToken === 'DAI' ? 100 : 500;

    // 1. Swap Adımının Calldata'sı
    const swapCallData = encodeFunctionData({
      abi: SWAP_ROUTER_ABI,
      functionName: 'exactInputSingle',
      args: [{
        tokenIn: WETH,
        tokenOut: buyObj.address,
        fee: feeTier,
        recipient: recipient,
        amountIn: amountInWei,
        amountOutMinimum: BigInt(0),
        sqrtPriceLimitX96: BigInt(0)
      }]
    });

    // 2. Multicall İle Paketlenmiş Final Calldata
    const multicallData = encodeFunctionData({
      abi: MULTICALL_ABI,
      functionName: 'multicall',
      args: [[swapCallData]]
    });

    return NextResponse.json({
      success: true,
      data: {
        to: UNISWAP_ROUTER,
        data: multicallData,
        value: `0x${amountInWei.toString(16)}`,
        sellToken,
        buyToken,
        amount: amountStr,
        executionBatch: [
          {
            step: 1,
            action: `Swap ${amountStr} ${sellToken} for ${buyToken}`,
            targetContract: UNISWAP_ROUTER,
            estimatedGasUsd: "$0.01",
            details: { calldata: multicallData }
          }
        ]
      }
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || "Hata oluştu" }, { status: 500 });
  }
}
