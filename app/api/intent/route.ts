import { NextResponse } from 'next/server';
import { getAddress } from 'viem';

// Base Mainnet Token Adresleri
const WETH = getAddress('0x4200000000000000000000000000000000000006');
const CBETH = getAddress('0x2Ae3F1Ec7F1F5012A327B6231F67a030B7B80498');
const USDC = getAddress('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');

export async function POST(req: Request) {
  try {
    const { prompt, userAddress } = await req.json();

    const recipient = (userAddress && userAddress.startsWith('0x'))
      ? getAddress(userAddress)
      : getAddress('0x95773c1f40b82dd8d0529471f6a6016fdfe990aa');

    let buyToken = CBETH;
    let buySymbol = "CBETH";

    if (prompt?.toUpperCase().includes("USDC")) {
      buyToken = USDC;
      buySymbol = "USDC";
    }

    const amountInWei = "100000000000000"; // 0.0001 ETH (Wei)

    // 0x Open API / Aggregator Endpoint (Base Mainnet)
    // Dynamic routing: 0x kontratı ETH'yi otomatik Wrap edip doğru likidite havuzuna yönlendirir.
    const url = `https://base.api.0x.org/swap/v1/quote?sellToken=${WETH}&buyToken=${buyToken}&sellAmount=${amountInWei}&takerAddress=${recipient}&slippagePercentage=0.01`;

    const response = await fetch(url, {
      headers: {
        '0x-api-key': process.env.ZEROX_API_KEY || '00000000-0000-0000-0000-000000000000', // API Key veya varsayılan public rate limit
      },
    });

    const data = await response.json();

    if (!response.ok || !data.to || !data.data) {
      throw new Error(data.reason || data.message || "0x Aggregator'dan geçerli rota alınamadı.");
    }

    return NextResponse.json({
      success: true,
      data: {
        to: getAddress(data.to),
        data: data.data,
        value: data.value ? `0x${BigInt(data.value).toString(16)}` : `0x${BigInt(amountInWei).toString(16)}`,
        sellToken: 'ETH',
        buyToken: buySymbol,
        amount: '0.0001',
        executionBatch: [
          {
            step: 1,
            action: `Swap 0.0001 ETH for ${buySymbol} via 0x Aggregator SDK`,
            targetContract: data.to,
            estimatedGasUsd: "$0.01",
            details: { calldata: data.data }
          }
        ]
      }
    });

  } catch (error: any) {
    return NextResponse.json({ 
      success: false, 
      error: error.message || "Routing hatası oluştu." 
    }, { status: 500 });
  }
}
