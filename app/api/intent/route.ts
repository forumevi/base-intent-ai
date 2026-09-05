import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { prompt, userAddress } = await req.json();

    if (!prompt || !userAddress) {
      return NextResponse.json({ success: false, error: 'Prompt and userAddress are required' }, { status: 400 });
    }

    const GROQ_API_KEY = process.env.GROQ_API_KEY;

    // Strict AI System Prompt to prevent Token/Amount inversion
    const systemPrompt = `You are an AI Web3 Intent Parser for Base Chain. 
    Analyze the user prompt and extract the exact swap params into JSON format ONLY.

    Token Contracts on Base Mainnet:
    - ETH / WETH: 0x4200000000000000000000000000000000000006
    - USDC: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913

    RULES:
    1. Identify sellToken (token user gives) and buyToken (token user gets).
    2. Convert sellAmount to base units correctly:
       - ETH has 18 decimals (e.g., 0.0001 ETH = 100000000000000 wei)
       - USDC has 6 decimals (e.g., 1 USDC = 1000000 units)
    3. Output JSON format strictly:
    {
      "sellToken": "0x...",
      "buyToken": "0x...",
      "sellAmount": "string_in_base_units",
      "sellTokenSymbol": "ETH|USDC",
      "buyTokenSymbol": "ETH|USDC"
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

    // Fetch Swap Quote from 0x API or KyberSwap on Base
    const zeroXUrl = `https://api.0x.org/swap/v1/quote?buyToken=${parsedIntent.buyToken}&sellToken=${parsedIntent.sellToken}&sellAmount=${parsedIntent.sellAmount}&takerAddress=${userAddress}`;
    
    const quoteRes = await fetch(zeroXUrl, {
      headers: {
        '0x-api-key': process.env.ZEROX_API_KEY || '', // optional or public endpoint
      }
    });

    const quoteData = await quoteRes.json();

    if (quoteData.code || quoteData.reason) {
      throw new Error(quoteData.reason || 'Failed to fetch quote from DEX Aggregator');
    }

    return NextResponse.json({
      success: true,
      data: {
        intent: parsedIntent,
        aggregatorQuote: {
          transaction: {
            to: quoteData.to,
            data: quoteData.data,
            value: quoteData.value || '0'
          }
        }
      }
    });

  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
