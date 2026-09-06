import { NextResponse } from 'next/server';
import { encodeFunctionData, parseUnits, getAddress } from 'viem';

const BASE_TOKENS: Record<string, { address: `0x${string}`; decimals: number }> = {
  ETH:   { address: getAddress('0x4200000000000000000000000000000000000006'), decimals: 18 },
  WETH:  { address: getAddress('0x4200000000000000000000000000000000000006'), decimals: 18 },
  USDC:  { address: getAddress('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'), decimals: 6 },
  CBETH: { address: getAddress('0x2Ae3F1Ec7F1F5012A327B6231F67a030B7B80498'), decimals: 18 },
  DAI:   { address: getAddress('0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb'), decimals: 18 },
  AERO:  { address: getAddress('0x94b008aA00579c1307B0EF2c499aD98a8ce58e58'), decimals: 18 }
};

const UNISWAP_ROUTER = getAddress('0x2626664c2603336E57B271c5C0b26F421741e481');

const SWAP_ROUTER_ABI = [
  {
    inputs: [
      {
        components: [
          { name: 'tokenIn', type: 'address' },
          { name: 'tokenOut', type: 'address' },
          { name: 'fee', type: 'uint24' },
          { name: 'recipient', type: 'address' },
          { name: 'amountIn', type: 'uint256' },
          { name: 'amountOutMinimum', type: 'uint256' },
          { name: 'sqrtPriceLimitX96', type: 'uint160' }
        ],
        name: 'params',
        type: 'tuple'
      }
    ],
    name: 'exactInputSingle',
    outputs: [{ name: 'amountOut', type: 'uint256' }],
    stateMutability: 'payable',
    type: 'function'
  }
] as const;

export async function POST(req: Request) {
  try {
    const { prompt, userAddress } = await req.json();
    const apiKey = process.env.GROQ_API_KEY?.trim();

    if (!apiKey) {
      return NextResponse.json({ 
        success: false, 
        error: "Groq API Key bulunamadı. Vercel ortam değişkenlerini kontrol edin." 
      }, { status: 500 });
    }

    const systemPrompt = `
      You are BaseIntent AI, an autonomous Web3 Intent Engine for Base Network (Chain ID: 8453).
      Analyze the user prompt and extract structured Web3 intent details.
      
      Respond STRICTLY in JSON format. Structure:
      {
        "sellToken": "ETH",
        "buyToken": "USDC",
        "amount": "0.0001",
        "intentType": "SWAP",
        "confidenceScore": 0.98,
        "riskAnalysis": {
          "score": "LOW",
          "warnings": []
        },
        "simulationSummary": "Clear summary of parsed intent for Base Network."
      }
    `;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt }
        ],
        temperature: 0.1,
        response_format: { type: "json_object" }
      })
    });

    const aiData = await response.json();

    if (!response.ok || !aiData.choices || !aiData.choices[0]) {
      const errorMsg = aiData.error?.message || JSON.stringify(aiData);
      return NextResponse.json({ 
        success: false, 
        error: `Groq Yanit Hatasi: ${errorMsg}` 
      }, { status: 500 });
    }

    const parsedIntent = JSON.parse(aiData.choices[0].message.content);

    // Token & Swap verilerini çözümleme (Yeni Geliştirmeler)
    const sellToken = (parsedIntent.sellToken || 'ETH').toUpperCase();
    const buyToken = (parsedIntent.buyToken || 'USDC').toUpperCase();
    const amountStr = String(parsedIntent.amount || '0.0001');

    const sellObj = BASE_TOKENS[sellToken] || BASE_TOKENS.ETH;
    const buyObj = BASE_TOKENS[buyToken] || BASE_TOKENS.USDC;

    const amountInWei = parseUnits(amountStr, sellObj.decimals);

    const recipientAddress = (userAddress && userAddress.startsWith('0x')) 
      ? getAddress(userAddress) 
      : UNISWAP_ROUTER;

    const swapCalldata = encodeFunctionData({
      abi: SWAP_ROUTER_ABI,
      functionName: 'exactInputSingle',
      args: [{
        tokenIn: sellObj.address,
        tokenOut: buyObj.address,
        fee: 500,
        recipient: recipientAddress,
        amountIn: amountInWei,
        amountOutMinimum: BigInt(0),
        sqrtPriceLimitX96: BigInt(0)
      }]
    });

    // Hem UI hem de Swap kontratı için gereken tüm çıktılar harmanlandı
    return NextResponse.json({ 
      success: true, 
      data: {
        ...parsedIntent,
        to: UNISWAP_ROUTER,
        data: swapCalldata,
        value: sellToken === 'ETH' ? `0x${amountInWei.toString(16)}` : '0x0',
        sellToken,
        buyToken,
        amount: amountStr,
        sellTokenAddress: sellObj.address,
        amountInWei: amountInWei.toString(),
        executionBatch: [
          {
            step: 1,
            action: `Swap ${amountStr} ${sellToken} for ${buyToken}`,
            targetContract: UNISWAP_ROUTER,
            estimatedGasUsd: "$0.01",
            details: { calldata: swapCalldata }
          }
        ]
      } 
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || "Bilinmeyen bir hata oluştu." }, { status: 500 });
  }
}
