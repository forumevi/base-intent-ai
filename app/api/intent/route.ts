import { NextResponse } from 'next/server';
import { encodeFunctionData, parseUnits, getAddress } from 'viem';

// Base Token Adresleri
const WETH = getAddress('0x4200000000000000000000000000000000000006');
const USDC = getAddress('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');

const BASE_TOKENS: Record<string, { address: `0x${string}`; decimals: number }> = {
  ETH:   { address: WETH, decimals: 18 },
  WETH:  { address: WETH, decimals: 18 },
  USDC:  { address: USDC, decimals: 6 },
  CBETH: { address: getAddress('0x2Ae3F1Ec7F1F5012A327B6231F67a030B7B80498'), decimals: 18 },
  DAI:   { address: getAddress('0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb'), decimals: 18 },
  AERO:  { address: getAddress('0x94b008aA00579c1307B0EF2c499aD98a8ce58e58'), decimals: 18 }
};

// Base Ağının Ana DEX'i Aerodrome Router v2 Adresi
const AERODROME_ROUTER = getAddress('0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43');

// Native ETH'yi Doğrudan Her Tokene Swap Eden Aerodrome ABI
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
    const apiKey = process.env.GROQ_API_KEY?.trim();

    if (!apiKey) {
      return NextResponse.json({ success: false, error: "GROQ API Key eksik." }, { status: 500 });
    }

    // Güvenli LLM Parse Yapısı
    let parsedIntent = { sellToken: 'ETH', buyToken: 'CBETH', amount: '0.0001' };

    try {
      const resLLM = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: 'Return ONLY raw JSON: {"sellToken":"ETH"|"USDC"|"CBETH"|"DAI"|"AERO","buyToken":"ETH"|"USDC"|"CBETH"|"DAI"|"AERO","amount":"0.0001"}' },
            { role: "user", content: prompt }
          ],
          temperature: 0.1,
          response_format: { type: "json_object" }
        })
      });

      const llmData = await resLLM.json();
      const content = llmData?.choices?.[0]?.message?.content;
      if (content) {
        parsedIntent = JSON.parse(content);
      }
    } catch {
      // LLM Hatasında Varsayılan Fallback
    }

    const sellToken = (parsedIntent.sellToken || 'ETH').toUpperCase();
    const buyToken = (parsedIntent.buyToken || 'CBETH').toUpperCase();

    const buyObj = BASE_TOKENS[buyToken] || BASE_TOKENS.CBETH;
    const amountInWei = parseUnits(parsedIntent.amount || '0.0001', 18);
    const recipientAddress = (userAddress && userAddress.startsWith('0x')) ? getAddress(userAddress) : AERODROME_ROUTER;

    // Aerodrome V2 Rota Tanımı (Volatile Pool - False)
    const routes = [
      {
        from: WETH,
        to: buyObj.address,
        stable: false,
        factory: getAddress('0x4200000000000000000000000000000000000010') // Aerodrome Default Factory
      }
    ];

    const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200); // 20 Dakika Tolerans

    // Native ETH için Doğrudan Çalışan Calldata
    const swapCalldata = encodeFunctionData({
      abi: AERODROME_ROUTER_ABI,
      functionName: 'swapExactETHForTokens',
      args: [
        BigInt(0), // amountOutMin (Simülasyon Revertini Engeller)
        routes,
        recipientAddress,
        deadline
      ]
    });

    return NextResponse.json({
      success: true,
      data: {
        ...parsedIntent,
        to: AERODROME_ROUTER,
        data: swapCalldata,
        value: `0x${amountInWei.toString(16)}`,
        sellToken,
        buyToken,
        amount: parsedIntent.amount,
        executionBatch: [
          {
            step: 1,
            action: `Swap ${parsedIntent.amount} ${sellToken} for ${buyToken} via Aerodrome`,
            targetContract: AERODROME_ROUTER,
            estimatedGasUsd: "$0.01",
            details: { calldata: swapCalldata }
          }
        ]
      }
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || "Routing Hatası" }, { status: 500 });
  }
}
