import { NextResponse } from 'next/server';
import { encodeFunctionData, parseUnits, formatUnits, getAddress, createPublicClient, http } from 'viem';
import { base } from 'viem/chains';

const publicClient = createPublicClient({
  chain: base,
  transport: http('https://mainnet.base.org')
});

const BASE_TOKENS: Record<string, { address: `0x${string}`; decimals: number }> = {
  ETH:   { address: getAddress('0x4200000000000000000000000000000000000006'), decimals: 18 },
  WETH:  { address: getAddress('0x4200000000000000000000000000000000000006'), decimals: 18 },
  USDC:  { address: getAddress('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'), decimals: 6 },
  CBETH: { address: getAddress('0x2Ae3F1Ec7F1F5012A327B6231F67a030B7B80498'), decimals: 18 },
  DAI:   { address: getAddress('0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb'), decimals: 18 },
  AERO:  { address: getAddress('0x94b008aA00579c1307B0EF2c499aD98a8ce58e58'), decimals: 18 }
};

// Base Ağındaki V3 Router ve Quoter
const UNISWAP_ROUTER = getAddress('0x2626664c2603336E57B271c5C0b26F421741e481');
const UNISWAP_QUOTER = getAddress('0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a');

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

const QUOTER_ABI = [
  {
    inputs: [
      { name: 'tokenIn', type: 'address' },
      { name: 'tokenOut', type: 'address' },
      { name: 'fee', type: 'uint24' },
      { name: 'amountIn', type: 'uint256' },
      { name: 'sqrtPriceLimitX96', type: 'uint160' }
    ],
    name: 'quoteExactInputSingle',
    outputs: [{ name: 'amountOut', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function'
  }
] as const;

const ERC20_ABI = [
  {
    inputs: [{ name: 'owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  }
] as const;

// Base üzerindeki aktif likidite havuzu fee katmanını dinamik bulan Quoter sistemi
async function findBestFeeTier(tokenIn: `0x${string}`, tokenOut: `0x${string}`, amountIn: bigint): Promise<number> {
  const possibleFees = [100, 500, 3000, 10000]; // %0.01, %0.05, %0.30, %1.00

  for (const fee of possibleFees) {
    try {
      const result = await publicClient.readContract({
        address: UNISWAP_QUOTER,
        abi: QUOTER_ABI,
        functionName: 'quoteExactInputSingle',
        args: [tokenIn, tokenOut, fee, amountIn, BigInt(0)]
      });

      if (result && (result as bigint) > BigInt(0)) {
        return fee; // Çalışan likidite havuzunu tespit etti
      }
    } catch {
      continue;
    }
  }

  // Varsayılan havuz fallback'i
  return 500;
}

async function fetchLLMWithFallback(apiKey: string, prompt: string) {
  const models = ['openai/gpt-oss-120b', 'llama-3.3-70b-versatile'];
  const systemPrompt = `
    You are BaseIntent AI, an autonomous Web3 Intent Engine for Base Network (Chain ID: 8453).
    Analyze the user prompt and extract intent parameters.

    If user prompt asks to buy/swap with "all", "everything", "cüzdandaki tüm", or no specific amount is given, set "isAll": true and "amount": "ALL".

    Respond STRICTLY in JSON format without markdown blocks:
    {
      "sellToken": "ETH" | "USDC" | "CBETH" | "DAI" | "AERO",
      "buyToken": "ETH" | "USDC" | "CBETH" | "DAI" | "AERO",
      "amount": "0.0001" or "ALL",
      "isAll": boolean,
      "intentType": "SWAP",
      "confidenceScore": 0.98,
      "riskAnalysis": { "score": "LOW", "warnings": [] },
      "simulationSummary": "Summary of intent for Base Network."
    }
  `;

  for (const model of models) {
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: prompt }
          ],
          temperature: 0.1,
          response_format: { type: "json_object" }
        })
      });

      const data = await res.json();
      if (res.ok && data.choices && data.choices[0]?.message?.content) {
        return JSON.parse(data.choices[0].message.content);
      }
    } catch (err) {
      console.warn(`Model ${model} failed, trying next...`);
    }
  }

  throw new Error("LLM yanıt veremedi.");
}

export async function POST(req: Request) {
  try {
    const { prompt, userAddress } = await req.json();
    const apiKey = process.env.GROQ_API_KEY?.trim();

    if (!apiKey) {
      return NextResponse.json({ success: false, error: "Groq API Key eksik." }, { status: 500 });
    }

    const parsedIntent = await fetchLLMWithFallback(apiKey, prompt);

    const sellToken = (parsedIntent.sellToken || 'ETH').toUpperCase();
    const buyToken = (parsedIntent.buyToken || 'USDC').toUpperCase();
    
    const sellObj = BASE_TOKENS[sellToken] || BASE_TOKENS.ETH;
    const buyObj = BASE_TOKENS[buyToken] || BASE_TOKENS.USDC;

    let amountInWei: bigint;
    let finalAmountStr = String(parsedIntent.amount || '0.0001');

    if (parsedIntent.isAll || parsedIntent.amount === 'ALL') {
      if (userAddress && userAddress.startsWith('0x')) {
        if (sellToken === 'ETH') {
          const balance = await publicClient.getBalance({ address: getAddress(userAddress) });
          amountInWei = balance > parseUnits('0.0005', 18) ? balance - parseUnits('0.0005', 18) : BigInt(0);
        } else {
          const balance = await publicClient.readContract({
            address: sellObj.address,
            abi: ERC20_ABI,
            functionName: 'balanceOf',
            args: [getAddress(userAddress)]
          }) as bigint;
          amountInWei = balance;
        }
        finalAmountStr = formatUnits(amountInWei, sellObj.decimals);
      } else {
        amountInWei = parseUnits('0.0001', sellObj.decimals);
        finalAmountStr = '0.0001';
      }
    } else {
      amountInWei = parseUnits(finalAmountStr, sellObj.decimals);
    }

    if (amountInWei <= BigInt(0)) {
      return NextResponse.json({ success: false, error: `Cüzdanda yeterli ${sellToken} bulunamadı.` }, { status: 400 });
    }

    // Likidite havuzunu on-chain simüle ederek dinamik olarak çekiyoruz
    const optimalFee = await findBestFeeTier(sellObj.address, buyObj.address, amountInWei);

    const recipientAddress = (userAddress && userAddress.startsWith('0x')) ? getAddress(userAddress) : UNISWAP_ROUTER;

    const swapCalldata = encodeFunctionData({
      abi: SWAP_ROUTER_ABI,
      functionName: 'exactInputSingle',
      args: [{
        tokenIn: sellObj.address,
        tokenOut: buyObj.address,
        fee: optimalFee,
        recipient: recipientAddress,
        amountIn: amountInWei,
        amountOutMinimum: BigInt(0),
        sqrtPriceLimitX96: BigInt(0)
      }]
    });

    return NextResponse.json({
      success: true,
      data: {
        ...parsedIntent,
        to: UNISWAP_ROUTER,
        data: swapCalldata,
        value: sellToken === 'ETH' ? `0x${amountInWei.toString(16)}` : '0x0',
        sellToken,
        buyToken,
        amount: finalAmountStr,
        sellTokenAddress: sellObj.address,
        amountInWei: amountInWei.toString(),
        executionBatch: [
          {
            step: 1,
            action: `Swap ${finalAmountStr} ${sellToken} for ${buyToken}`,
            targetContract: UNISWAP_ROUTER,
            estimatedGasUsd: "$0.01",
            details: { calldata: swapCalldata }
          }
        ]
      }
    });

  } catch (error: any) {
    console.error("API Intent Error:", error);
    return NextResponse.json({ success: false, error: error.message || "Hata oluştu." }, { status: 500 });
  }
}
