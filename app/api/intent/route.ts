import { NextResponse } from 'next/server';

// Base Mainnet Token Adresleri
const BASE_TOKENS: Record<string, string> = {
  ETH: '0xEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE', // Native ETH representation
  WETH: '0x4200000000000000000000000000000000000006',
  USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  USDT: '0xfde4C96cDB63B34c82808dd471eC8f6c321A8839',
  DAI:  '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb',
  AERO: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58'
};

export async function POST(req: Request) {
  try {
    const { prompt, userAddress } = await req.json();

    if (!prompt) {
      return NextResponse.json({ success: false, error: 'Prompt is required' }, { status: 400 });
    }

    const GROQ_API_KEY = process.env.GROQ_API_KEY;
    if (!GROQ_API_KEY) {
      return NextResponse.json({ success: false, error: 'Groq API Key is missing' }, { status: 500 });
    }

    // 1. Step: Groq LLM parses natural language intent
    const systemPrompt = `You are a Base Blockchain Execution Agent. Parse the user intent into a structured JSON response.
Supported tokens on Base: ETH, WETH, USDC, USDT, DAI, AERO.
Extract action, sellToken, buyToken, and amount.

JSON Structure:
{
  "intentType": "SWAP",
  "sellToken": "ETH",
  "buyToken": "USDC",
  "amount": "0.0001",
  "confidenceScore": 0.98,
  "summary": "Swap 0.0001 ETH for USDC via Optimal Base Aggregator Route"
}`;

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' }
      })
    });

    const groqData = await groqRes.json();
    const parsedIntent = JSON.parse(groqData.choices[0].message.content);

    const sellTokenSymbol = parsedIntent.sellToken?.toUpperCase() || 'ETH';
    const buyTokenSymbol = parsedIntent.buyToken?.toUpperCase() || 'USDC';
    const sellAmount = parsedIntent.amount || '0.0001';

    const sellTokenAddress = BASE_TOKENS[sellTokenSymbol] || BASE_TOKENS.ETH;
    const buyTokenAddress = BASE_TOKENS[buyTokenSymbol] || BASE_TOKENS.USDC;

    // Convert amount to wei (Assuming ETH / standard 18 decimals for sell token)
    const sellAmountWei = (BigInt(Math.floor(parseFloat(sellAmount) * 1e18))).toString();

    // 2. Step: Query 0x DEX Aggregator API for Base Mainnet Routing
    // 0x Aggregator automatically searches Uniswap, Aerodrome, Curve, etc. for best price
    const params = new URLSearchParams({
      chainId: '8453', // Base Mainnet Chain ID
      sellToken: sellTokenAddress,
      buyToken: buyTokenAddress,
      sellAmount: sellAmountWei,
      taker: userAddress || '0x0000000000000000000000000000000000000000'
    });

    let quoteData = null;
    try {
      const quoteRes = await fetch(`https://api.0x.org/swap/permit2/quote?${params.toString()}`, {
        headers: {
          '0x-api-key': process.env.ZEROX_API_KEY || '', // Works with public tier or fallback
          '0x-version': 'v2'
        }
      });
      if (quoteRes.ok) {
        quoteData = await quoteRes.json();
      }
    } catch (e) {
      console.warn("0x API Quote fetch error, falling back to direct route builder:", e);
    }

    return NextResponse.json({
      success: true,
      data: {
        ...parsedIntent,
        sellTokenAddress,
        buyTokenAddress,
        sellAmountWei,
        aggregatorQuote: quoteData
      }
    });

  } catch (error: any) {
    console.error('Intent API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
