import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();

    // Kullanıcıdan gelen doğal dili analiz eden mock AI yapısı
    // İleride buraya OpenAI / Claude API'sini bağlayabiliriz.
    const mockParsedIntent = {
      action: "SWAP",
      params: {
        fromToken: "USDC",
        toToken: "ETH",
        amount: "50",
        chain: "Base"
      },
      originalPrompt: prompt
    };

    return NextResponse.json({ success: true, data: mockParsedIntent });
  } catch (error) {
    return NextResponse.json({ success: false, error: "Intent parsing failed" }, { status: 500 });
  }
}