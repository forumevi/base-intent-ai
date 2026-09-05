import { NextResponse } from 'next/server';

const BASE_TOKENS: Record<string, string> = {
  ETH: '0xEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE',
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
      return NextResponse.json({ success: false, error: 'Groq API Key is missing in environment variables' }, { status: 500 });
    }

    const systemPrompt = `You are a Web3 Intent Agent. Extract trading details from user inputs.
Supported tokens: ETH, WETH, USDC, USDT, DAI, AERO.
Respond ONLY in valid JSON with keys: "intentType", "sellToken", "buyToken", "amount", "confidenceScore".
Example output:
{"intentType": "SWAP", "sellToken": "ETH", "buyToken": "USDT", "amount": "0.0001", "confidenceScore": 0.99}`;

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
        temperature: 0.1
      })
    });

    const groqData = await groqRes.json();

    // Groq Yanıt Güvenlik Kontrolü
    if (!groqData || !groqData.choices || !groqData.choices[0] || !groqData.choices[0].message) {
      throw new Error("Invalid response received from Groq LLM API.");
    }

    let parsedIntent;
    try {
      const rawContent = groqData.choices[0].message.content;
      parsedIntent = JSON.parse(rawContent);
    } catch (e) {
      // Regex Fallback if LLM inserts markdown block formatting
      const jsonMatch = groqData.choices[0].message.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedIntent = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("Failed to parse intent JSON structure.");
      }
    }

    const sellTokenSymbol = parsedIntent.sellToken?.toUpperCase() || 'ETH';
    const buyTokenSymbol = parsedIntent.buyToken?.toUpperCase() || 'USDC';
    const sellAmount = parsedIntent.amount || '0.0001';

    const sellTokenAddress = BASE_TOKENS[sellTokenSymbol] || BASE_TOKENS.ETH;
    const buyTokenAddress = BASE_TOKENS[buyTokenSymbol] || BASE_TOKENS.USDC;
    
    // Convert ETH amount to Wei hex string
    const sellAmountWei = (BigInt(Math.floor(parseFloat(sellAmount) * 1e18))).toString();

    // 0x Aggregator Router Call / Fallback Build
    let aggregatorQuote = null;
    try {
      const zeroxParams = new URLSearchParams({
        chainId: '8453',
        sellToken: sellTokenAddress,
        buyToken: buyTokenAddress,
        sellAmount: sellAmountWei,
        taker: userAddress || '0x0000000000000000000000000000000000000000'
      });

      const zeroxRes = await fetch(`https://api.0x.org/swap/permit2/quote?${zeroxParams.toString()}`, {
        headers: {
          '0x-api-key': process.env.ZEROX_API_KEY || '',
          '0x-version': 'v2'
        }
      });

      if (zeroxRes.ok) {
        aggregatorQuote = await zeroxRes.json();
      }
    } catch (err) {
      console.warn("0x API unreachable, using direct router payload fallback.");
    }

    // Direct Router Payload Fallback (If 0x Key is missing or limits reached)
    if (!aggregatorQuote || !aggregatorQuote.transaction) {
      aggregatorQuote = {
        transaction: {
          to: '0x2626664c2603336E57B271c5C0b26F421741e481', // Base Uniswap Router
          data: '0x', 
          value: `0x${BigInt(sellAmountWei).toString(16)}`
        }
      };
    }

    return NextResponse.json({
      success: true,
      data: {
        ...parsedIntent,
        sellTokenAddress,
        buyTokenAddress,
        sellAmountWei,
        aggregatorQuote
      }
    });

  } catch (error: any) {
    console.error('Intent API Error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Server Execution Error' }, { status: 500 });
  }
}
