import { NextResponse } from 'next/server';
import { parseUnits, formatUnits, getAddress, createPublicClient, http } from 'viem';
import { base } from 'viem/chains';

const publicClient = createPublicClient({
  chain: base,
  transport: http('https://mainnet.base.org')
});

const BASE_TOKENS: Record<string, { address: `0x${string}`; decimals: number }> = {
  ETH:   { address: getAddress('0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'), decimals: 18 },
  WETH:  { address: getAddress('0x4200000000000000000000000000000000000006'), decimals: 18 },
  USDC:  { address: getAddress('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'), decimals: 6 },
  CBETH: { address: getAddress('0x2Ae3F1Ec7F1F5012A327B6231F67a030B7B80498'), decimals: 18 },
  DAI:   { address: getAddress('0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb'), decimals: 18 },
  AERO:  { address: getAddress('0x94b008aA00579c1307B0EF2c499aD98a8ce58e58'), decimals: 18 }
};

const ERC20_ABI = [
  {
    inputs: [{ name: 'owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  }
] as const;

async function fetchLLMWithFallback(apiKey: string, prompt: string) {
  const models = ['openai/gpt-oss-120b', 'llama-3.3-70b-versatile'];
  const systemPrompt = `
    You are BaseIntent AI, an autonomous Web3 Intent Engine for Base Network (Chain ID: 8453).
    Analyze prompt and return strictly JSON:
    {
      "sellToken": "ETH" | "USDC" | "CBETH" | "DAI" | "AERO",
      "buyToken": "ETH" | "USDC" | "CBETH" | "DAI" | "AERO",
      "amount": "0.0001" or "ALL",
      "isAll": boolean,
      "intentType": "SWAP"
    }
  `;

  for (const model of models) {
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [{ role: "system", content: systemPrompt }, { role: "user", content: prompt }],
          temperature: 0.1,
          response_format: { type: "json_object" }
        })
      });
      const data = await res.json();
      if (res.ok && data.choices && data.choices[0]?.message?.content) {
        return JSON.parse(data.choices[0].message.content);
      }
    } catch {
      continue;
    }
  }
  throw new Error("LLM Hatası");
}

export async function POST(req: Request) {
  try {
    const { prompt, userAddress } = await req.json();
    const apiKey = process.env.GROQ_API_KEY?.trim();

    if (!apiKey) return NextResponse.json({ success: false, error: "API Key eksik." }, { status: 500 });

    const parsedIntent = await fetchLLMWithFallback(apiKey, prompt);
    const sellToken = (parsedIntent.sellToken || 'ETH').toUpperCase();
    const buyToken = (parsedIntent.buyToken || 'CBETH').toUpperCase();

    const sellObj = BASE_TOKENS[sellToken] || BASE_TOKENS.ETH;
    const buyObj = BASE_TOKENS[buyToken] || BASE_TOKENS.CBETH;

    let amountInWei: bigint;
    let finalAmountStr = String(parsedIntent.amount || '0.0001');

    if (parsedIntent.isAll || parsedIntent.amount === 'ALL') {
      if (userAddress && userAddress.startsWith('0x')) {
        if (sellToken === 'ETH') {
          const balance = await publicClient.getBalance({ address: getAddress(userAddress) });
          amountInWei = balance > parseUnits('0.0005', 18) ? balance - parseUnits('0.0005', 18) : BigInt(0);
        } else {
          amountInWei = await publicClient.readContract({
            address: sellObj.address,
            abi: ERC20_ABI,
            functionName: 'balanceOf',
            args: [getAddress(userAddress)]
          }) as bigint;
        }
        finalAmountStr = formatUnits(amountInWei, sellObj.decimals);
      } else {
        amountInWei = parseUnits('0.0001', sellObj.decimals);
      }
    } else {
      amountInWei = parseUnits(finalAmountStr, sellObj.decimals);
    }

    if (amountInWei <= BigInt(0)) {
      return NextResponse.json({ success: false, error: "Yetersiz bakiye." }, { status: 400 });
    }

    // 0x API üzerinden en ideal likidite rotasının calldata'sını çekiyoruz
    const queryParams = new URLSearchParams({
      sellToken: sellObj.address,
      buyToken: buyObj.address,
      sellAmount: amountInWei.toString(),
      takerAddress: userAddress && userAddress.startsWith('0x') ? userAddress : '0x0000000000000000000000000000000000000000'
    });

    const zeroExRes = await fetch(`https://base.api.0x.org/swap/v1/quote?${queryParams.toString()}`, {
      headers: {
        '0x-api-key': process.env.ZEROEX_API_KEY || '' // API key olmadan da rate-limit dahilinde çalışır
      }
    });

    const quote = await zeroExRes.json();

    if (!zeroExRes.ok) {
      throw new Error(quote.reason || "0x API likidite rotası oluşturamadı.");
    }

    return NextResponse.json({
      success: true,
      data: {
        ...parsedIntent,
        to: getAddress(quote.to),
        data: quote.data,
        value: `0x${BigInt(quote.value || 0).toString(16)}`,
        sellToken,
        buyToken,
        amount: finalAmountStr,
        executionBatch: [
          {
            step: 1,
            action: `Swap ${finalAmountStr} ${sellToken} for ${buyToken}`,
            targetContract: quote.to,
            estimatedGasUsd: "$0.01",
            details: { calldata: quote.data }
          }
        ]
      }
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || "İşlem rotası oluşturulamadı." }, { status: 500 });
  }
}
