import { NextResponse } from 'next/server';
import { encodeFunctionData, parseUnits, getAddress } from 'viem';

// Base Mainnet Desteklenen Token Adresleri ve Decimal Bilgileri
const TOKENS: Record<string, { address: `0x${string}`; decimals: number }> = {
  ETH: { address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', decimals: 18 },
  USDC: { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6 },
  USDT: { address: '0xf82323B9123f287B44f19B26E074D76735e5d3D6', decimals: 6 },
  DAI: { address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb', decimals: 18 },
  CBETH: { address: '0x2Ae3F1Ec7F1F5012A327e5D6A53A042A2D405788', decimals: 18 }
};

const DEFAULT_KYBER_ROUTER = '0x6131B5fae19EA4f9D964eAc09af83311A6337b5';

const ERC20_ABI = [
  {
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function'
  }
] as const;

function toChecksum(address: string): `0x${string}` {
  try {
    return getAddress(address);
  } catch {
    const cleanAddress = address.toLowerCase().replace('0x', '');
    return getAddress(`0x${cleanAddress}`);
  }
}

// Groq LLM Entegrasyonu / Güvenli LLM Parsing Motoru
async function parseIntentWithLLM(prompt: string) {
  const apiKey = process.env.GROQ_API_KEY;
  
  if (apiKey) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            {
              role: 'system',
              content: `You are a DeFi Intent Parser for Base Mainnet. Analyze the user's prompt and respond ONLY with a JSON object containing:
              - "sellToken": Symbol being sold (ETH, USDC, USDT, DAI, CBETH)
              - "buyToken": Symbol being bought (ETH, USDC, USDT, DAI, CBETH)
              - "amount": String numeric value of sellToken amount.
              Do not include any extra text or Markdown code blocks, just raw JSON.`
            },
            { role: 'user', content: prompt }
          ],
          temperature: 0.1
        })
      });
      const data = await res.json();
      
      // Temizlik işlemi string parçalama (replaceAll) ile yapılarak RegEx build hataları kesin engellenir
      let rawContent = data.choices[0].message.content.trim();
      rawContent = rawContent.replaceAll('```json', '').replaceAll('```', '').trim();
      
      const parsed = JSON.parse(rawContent);
      return {
        sellToken: parsed.sellToken.toUpperCase(),
        buyToken: parsed.buyToken.toUpperCase(),
        amount: String(parsed.amount)
      };
    } catch (e) {
      console.warn('Groq API fallback triggered:', e);
    }
  }

  // Fallback Deterministik Logic (LLM Yanıt Vermezse)
  const p = prompt.toLowerCase().trim();
  let sellToken = 'ETH';
  let buyToken = 'USDC';
  let amount = '0.0001';

  const numbers = p.match(/\d+(\.\d+)?/g);
  if (numbers && numbers.length > 0) amount = numbers[0];

  if (p.includes('dai')) {
    if (p.startsWith('swap') && p.includes('dai') && (p.includes('for eth') || p.includes('to eth'))) {
      sellToken = 'DAI';
      buyToken = 'ETH';
    } else if (p.includes('buy dai')) {
      sellToken = 'ETH';
      buyToken = 'DAI';
    } else {
      sellToken = 'DAI';
      buyToken = 'ETH';
    }
  } else if (p.includes('usdc')) {
    if (p.includes('buy eth with usdc') || p.includes('usdc for eth') || p.includes('usdc to eth')) {
      sellToken = 'USDC';
      buyToken = 'ETH';
    } else {
      sellToken = 'ETH';
      buyToken = 'USDC';
    }
  }

  return { sellToken, buyToken, amount };
}

export async function POST(req: Request) {
  try {
    const { prompt, userAddress } = await req.json();

    const recipient = userAddress && userAddress.startsWith('0x')
      ? toChecksum(userAddress)
      : toChecksum('0x95773c1f40b82dd8d0529471f6a6016fdfe990aa');

    // Niyet Yapay Zeka Tarafından Ayrıştırılır
    const parsed = await parseIntentWithLLM(prompt);

    const tokenInObj = TOKENS[parsed.sellToken] || TOKENS.ETH;
    const tokenOutObj = TOKENS[parsed.buyToken] || TOKENS.USDC;

    const tokenIn = toChecksum(tokenInObj.address);
    const tokenOut = toChecksum(tokenOutObj.address);

    const amountInWei = parseUnits(parsed.amount, tokenInObj.decimals).toString();

    // KyberSwap Rota Sorgusu
    const routeUrl = `https://aggregator-api.kyberswap.com/base/api/v1/routes?tokenIn=${tokenIn}&tokenOut=${tokenOut}&amountIn=${amountInWei}`;
    const routeRes = await fetch(routeUrl, { headers: { 'x-client-id': 'BaseIntentAI' } });
    const routeData = await routeRes.json();

    const routeSummary = routeData?.data?.routeSummary;
    if (!routeSummary) {
      throw new Error(`${parsed.sellToken} ➔ ${parsed.buyToken} için KyberSwap üzerinde likidite rotası bulunamadı.`);
    }

    const rawRouter = routeSummary.routerAddress || routeData?.data?.routerAddress || DEFAULT_KYBER_ROUTER;
    const routerAddress = toChecksum(rawRouter);

    // Calldata Build
    const buildRes = await fetch(`https://aggregator-api.kyberswap.com/base/api/v1/route/build`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-client-id': 'BaseIntentAI' },
      body: JSON.stringify({
        routeSummary: routeSummary,
        sender: recipient,
        recipient: recipient,
        slippageTolerance: 100
      })
    });
    const buildData = await buildRes.json();

    if (!buildData?.data?.data) {
      throw new Error('Calldata üretilemedi.');
    }

    const swapCalldata = buildData.data.data;
    const executionBatch = [];
    const isNativeIn = parsed.sellToken === 'ETH';

    // ERC20 Satılıyorsa (DAI, USDC vs.) Approve İşlemi Ekle
    if (!isNativeIn) {
      const approveData = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [routerAddress, BigInt(amountInWei)]
      });

      executionBatch.push({
        step: 1,
        action: `Approve ${parsed.amount} ${parsed.sellToken} for KyberSwap Router`,
        targetContract: tokenIn,
        details: { calldata: approveData }
      });
    }

    executionBatch.push({
      step: isNativeIn ? 1 : 2,
      action: `Swap ${parsed.amount} ${parsed.sellToken} for ${parsed.buyToken}`,
      targetContract: routerAddress,
      details: { calldata: swapCalldata }
    });

    // KESİN GÜVENLİK KONTROLÜ: Satılan token ETH değilse value HER ZAMAN 0x0 olmalıdır!
    const txValue = isNativeIn ? `0x${BigInt(amountInWei).toString(16)}` : '0x0';

    return NextResponse.json({
      success: true,
      data: {
        to: isNativeIn ? routerAddress : tokenIn,
        data: executionBatch[0].details.calldata,
        value: txValue,
        sellToken: parsed.sellToken,
        buyToken: parsed.buyToken,
        amount: parsed.amount,
        executionBatch: executionBatch
      }
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Route Failed' }, { status: 500 });
  }
}
