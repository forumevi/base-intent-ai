import { NextResponse } from 'next/server';
import { getAddress } from 'viem';

const WETH = '0x4200000000000000000000000000000000000006';
const CBETH = '0x2Ae3F1Ec7F1F5012A327B6231F67a030B7B80498';
const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

export async function POST(req: Request) {
  try {
    const { prompt, userAddress } = await req.json();

    const recipient = (userAddress && userAddress.startsWith('0x'))
      ? getAddress(userAddress)
      : '0x95773c1f40b82dd8d0529471f6a6016fdfe990aa';

    let buyToken = CBETH;
    let buySymbol = "CBETH";
    if (prompt?.toUpperCase().includes("USDC")) {
      buyToken = USDC;
      buySymbol = "USDC";
    }

    const amountInWei = "100000000000000"; // 0.0001 ETH (Wei)

    // 0x Aggregator V2 Swap API Çağrısı (Base Mainnet)
    const response = await fetch(
      `https://base.api.0x.org/swap/v1/quote?buyToken=${buyToken}&sellToken=${WETH}&sellAmount=${amountInWei}&takerAddress=${recipient}`,
      {
        headers: {
          '0x-api-key': '00000000-0000-0000-0000-000000000000' // Public rate limit
        }
      }
    );

    const quote = await response.json();

    if (!quote || quote.reason || !quote.to) {
      throw new Error(quote.reason || "0x Quote alınamadı.");
    }

    return NextResponse.json({
      success: true,
      data: {
        to: quote.to,
        data: quote.data,
        value: quote.value || `0x${BigInt(amountInWei).toString(16)}`,
        sellToken: 'ETH',
        buyToken: buySymbol,
        amount: '0.0001',
        executionBatch: [
          {
            step: 1,
            action: `Swap 0.0001 ETH for ${buySymbol} via 0x Aggregator`,
            targetContract: quote.to,
            estimatedGasUsd: "$0.01",
            details: { calldata: quote.data }
          }
        ]
      }
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || "Route Failed" }, { status: 500 });
  }
}
