import { NextResponse } from 'next/server';
import { encodeFunctionData, parseUnits, getAddress } from 'viem';

// Base Mainnet Adresleri
const WETH = getAddress('0x4200000000000000000000000000000000000006');
const CBETH = getAddress('0x2Ae3F1Ec7F1F5012A327B6231F67a030B7B80498');
const USDC = getAddress('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');

// Uniswap V3 SwapRouter02 (Base)
const UNISWAP_ROUTER = getAddress('0x2626664c2603336E57B271c5C0b26F421741e481');

const UNISWAP_ROUTER_ABI = [
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
  },
  {
    inputs: [
      { name: 'amountMinimum', type: 'uint256' },
      { name: 'recipient', type: 'address' }
    ],
    name: 'unwrapWETH9',
    outputs: [],
    stateMutability: 'payable',
    type: 'function'
  },
  {
    inputs: [{ name: 'data', type: 'bytes[]' }],
    name: 'multicall',
    outputs: [{ name: 'results', type: 'bytes[]' }],
    stateMutability: 'payable',
    type: 'function'
  }
] as const;

export async function POST(req: Request) {
  try {
    const { prompt, userAddress } = await req.json();

    const recipient = (userAddress && userAddress.startsWith('0x'))
      ? getAddress(userAddress)
      : getAddress('0x95773c1f40b82dd8d0529471f6a6016fdfe990aa');

    let buyToken = CBETH;
    let buySymbol = "CBETH";
    let feeTier = 100; // cbETH / WETH -> %0.01

    if (prompt?.toUpperCase().includes("USDC")) {
      buyToken = USDC;
      buySymbol = "USDC";
      feeTier = 500; // USDC / WETH -> %0.05
    }

    const amountInWei = parseUnits("0.0001", 18);

    // 1. exactInputSingle Calldata (Alıcı MSG.SENDER/ROUTER Olmalı - 0x000...000 veya Router)
    // MSG.VALUE ile ham ETH gönderileceği için recipient doğrudan kullanıcı adresi olur.
    const swapData = encodeFunctionData({
      abi: UNISWAP_ROUTER_ABI,
      functionName: 'exactInputSingle',
      args: [{
        tokenIn: WETH,
        tokenOut: getAddress(buyToken),
        fee: feeTier,
        recipient: recipient, // Satın alınan token doğrudan kullanıcıya gider
        amountIn: amountInWei,
        amountOutMinimum: BigInt(0),
        sqrtPriceLimitX96: BigInt(0)
      }]
    });

    // 2. ETH ile Swap Yapabilmek İçin Multicall Paketlemesi
    const multicallCalldata = encodeFunctionData({
      abi: UNISWAP_ROUTER_ABI,
      functionName: 'multicall',
      args: [[swapData]]
    });

    return NextResponse.json({
      success: true,
      data: {
        to: UNISWAP_ROUTER,
        data: multicallCalldata,
        value: `0x${amountInWei.toString(16)}`,
        sellToken: 'ETH',
        buyToken: buySymbol,
        amount: '0.0001',
        executionBatch: [
          {
            step: 1,
            action: `Swap 0.0001 ETH for ${buySymbol} via Uniswap V3 Multicall`,
            targetContract: UNISWAP_ROUTER,
            estimatedGasUsd: "$0.01",
            details: { calldata: multicallCalldata }
          }
        ]
      }
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
