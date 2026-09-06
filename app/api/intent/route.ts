import { NextResponse } from 'next/server';
import { encodeFunctionData, parseUnits, getAddress } from 'viem';

// Base Mainnet Sözleşme Adresleri
const WETH = getAddress('0x4200000000000000000000000000000000000006');
const CBETH = getAddress('0x2Ae3F1Ec7F1F5012A327B6231F67a030B7B80498');
const USDC = getAddress('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');

// Aerodrome Router v2 & Pool Factory
const AERODROME_ROUTER = getAddress('0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43');
const AERODROME_FACTORY = getAddress('0x420DD381b31a868D039F8354386965E9463264d7');

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

export async function POST(req: Request) {
  try {
    const { prompt, userAddress } = await req.json();

    // 1. Hedef Token ve Havuz Türü Ayarları
    let targetToken = CBETH;
    let isStable = true; // Aerodrome üzerinde WETH/cbETH bir Stable Pool'dur.

    if (prompt?.toUpperCase().includes('USDC')) {
      targetToken = USDC;
      isStable = false; // WETH/USDC ise Volatile Pool'dur.
    }

    const amountInWei = parseUnits('0.0001', 18);

    // Recipient adresi olarak doğrudan işlemi başlatan kullanıcı cüzdanını alıyoruz
    const recipient = (userAddress && userAddress.startsWith('0x'))
      ? getAddress(userAddress)
      : getAddress('0x95773c1f40b82dd8d0529471f6a6016fdfe990aa');

    // 20 Dakikalık Geçerli UNIX Timestamp Deadline
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200);

    // 2. Aerodrome Route Yapılandırması
    const routes = [
      {
        from: WETH,
        to: targetToken,
        stable: isStable,
        factory: AERODROME_FACTORY
      }
    ];

    // 3. Calldata Paketleme
    const swapCalldata = encodeFunctionData({
      abi: AERODROME_ROUTER_ABI,
      functionName: 'swapExactETHForTokens',
      args: [
        BigInt(0), // amountOutMin
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
        sellToken: 'ETH',
        buyToken: prompt?.toUpperCase().includes('USDC') ? 'USDC' : 'CBETH',
        amount: '0.0001',
        executionBatch: [
          {
            step: 1,
            action: 'Swap 0.0001 ETH on Aerodrome',
            targetContract: AERODROME_ROUTER,
            estimatedGasUsd: '$0.01',
            details: { calldata: swapCalldata }
          }
        ]
      }
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Execution Error' }, { status: 500 });
  }
}
