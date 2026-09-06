import { NextResponse } from 'next/server';
import { encodeFunctionData, parseUnits, getAddress } from 'viem';

// Base Token Adresleri
const WETH = getAddress('0x4200000000000000000000000000000000000006');
const USDC = getAddress('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');
const CBETH = getAddress('0x2Ae3F1Ec7F1F5012A327B6231F67a030B7B80498');
const DAI = getAddress('0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb');
const AERO = getAddress('0x94b008aA00579c1307B0EF2c499aD98a8ce58e58');

// Aerodrome V2 Router (Base Mainnet)
const AERODROME_ROUTER = getAddress('0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43');

// Aerodrome Router V2 ABI
const AERODROME_ROUTER_ABI = [
  {
    inputs: [
      { name: 'amountOutMin', type: 'uint256' },
      {
        components: [
          { name: 'from', type: 'address' },
          { name: 'to', type: 'address' },
          { name: 'stable', type: 'bool' },
          { name: 'factory', type: 'address' }
        ],
        name: 'routes',
        type: 'tuple[]'
      },
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' }
    ],
    name: 'swapExactETHForTokens',
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
    stateMutability: 'payable',
    type: 'function'
  }
] as const;

// Base Aerodrome V2 Pool Yapılandırma Haritası
// cbETH/WETH -> Stable Pool (true)
// USDC/WETH -> Volatile Pool (false)
const POOL_CONFIG: Record<string, { address: `0x${string}`; isStable: boolean }> = {
  CBETH: { address: CBETH, isStable: true },
  USDC:  { address: USDC, isStable: false },
  DAI:   { address: DAI, isStable: true },
  AERO:  { address: AERO, isStable: false }
};

export async function POST(req: Request) {
  try {
    const { prompt, userAddress } = await req.json();

    // Token Tespiti
    let buyToken = "CBETH";
    if (prompt.includes("USDC")) buyToken = "USDC";
    if (prompt.includes("DAI")) buyToken = "DAI";
    if (prompt.includes("AERO")) buyToken = "AERO";

    const tokenConfig = POOL_CONFIG[buyToken] || POOL_CONFIG.CBETH;
    const amountInWei = parseUnits("0.0001", 18);
    const recipient = (userAddress && userAddress.startsWith('0x')) ? getAddress(userAddress) : AERODROME_ROUTER;

    // Aerodrome V2 Factory Adresi
    const AERODROME_FACTORY = getAddress('0x4200000000000000000000000000000000000006'); // Default Pool Factory

    // 20 Dakikalık Geçerli Deadline (Aksi takdirde Revert eder)
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200);

    // Aerodrome Rota Dizisi
    const routes = [
      {
        from: WETH,
        to: tokenConfig.address,
        stable: tokenConfig.isStable,
        factory: '0x4200000000000000000000000000000000000006' as `0x${string}` // Standard Aerodrome V2 Pool
      }
    ];

    // Calldata Encode İşlemi
    const swapCalldata = encodeFunctionData({
      abi: AERODROME_ROUTER_ABI,
      functionName: 'swapExactETHForTokens',
      args: [
        BigInt(0), // amountOutMin (Slippage hatasını engeller)
        routes,
        recipient,
        deadline
      ]
    });

    return NextResponse.json({
      success: true,
      data: {
        to: AERODROME_ROUTER,
        data: swapCalldata,
        value: `0x${amountInWei.toString(16)}`,
        sellToken: "ETH",
        buyToken: buyToken,
        amount: "0.0001",
        executionBatch: [
          {
            step: 1,
            action: `Swap 0.0001 ETH for ${buyToken} on Aerodrome`,
            targetContract: AERODROME_ROUTER,
            estimatedGasUsd: "$0.01",
            details: { calldata: swapCalldata }
          }
        ]
      }
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || "Routing Failed" }, { status: 500 });
  }
}
