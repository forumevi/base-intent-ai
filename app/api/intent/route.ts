import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();

    // Dinamik mock yanıt üreteci
    const isSwap = prompt.toLowerCase().includes('swap');
    const isBridge = prompt.toLowerCase().includes('bridge');

    const mockParsedIntent = {
      protocol: "BaseIntent Engine v1",
      chain: "Base Mainnet (8453)",
      intent: {
        type: isSwap ? "SWAP" : isBridge ? "BRIDGE" : "TRANSFER",
        status: "PARSED",
        rawPrompt: prompt,
        parsedParams: {
          fromToken: isSwap ? "USDC" : "ETH",
          toToken: isSwap ? "ETH" : "USDC",
          amount: "Auto-calculated",
          estimatedGasFee: "~0.00004 ETH",
          routerContract: "0x4200000000000000000000000000000000000006"
        }
      },
      timestamp: new Date().toISOString()
    };

    return NextResponse.json({ success: true, data: mockParsedIntent });
  } catch (error) {
    return NextResponse.json({ success: false, error: "Intent parsing failed" }, { status: 500 });
  }
}
