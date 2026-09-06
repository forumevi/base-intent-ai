import { NextResponse } from 'next/server';
import { encodeFunctionData, parseUnits, getAddress, createPublicClient, http } from 'viem';
import { base } from 'viem/chains';

const publicClient = createPublicClient({
  chain: base,
  transport: http('https://mainnet.base.org')
});

const WETH = getAddress('0x4200000000000000000000000000000000000006');

const BASE_TOKENS: Record<string, { address: `0x${string}`; decimals: number }> = {
  ETH:   { address: WETH, decimals: 18 },
  WETH:  { address: WETH, decimals: 18 },
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

const TOKEN_FEE_MAP: Record<string, number> = {
  USDC: 500,
  CBETH: 100,
  DAI: 100,
  AERO: 3000
};

export async function POST(req: Request) {
  try {
    const { prompt, userAddress } = await req.json();
    const apiKey = process.env.GROQ_API_KEY?.trim();

    if (!apiKey) return NextResponse.json({ success: false, error: "API Key eksik." }, { status: 500 });

    let parsedIntent = { sellToken: 'ETH', buyToken: 'CBETH', amount: '0.0001' };

    // Güvenli LLM Çağrısı (Undefined / Array Crash Engelleme)
    try {
      const resLLM = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: 'Return ONLY JSON: {"sellToken":"ETH"|"USDC"|"CBETH"|"DAI"|"AERO","buyToken":"ETH"|"USDC"|"CBETH"|"DAI"|"AERO","amount":"0.0001"}' },
            { role: "user", content: prompt }
          ],
          temperature: 0.1,
          response_format: { type: "json_object" }
        })
      });

      const llmData = await resLLM.json();
      
      // 'reading 0' hatasını önleyen güvenli parsing kontrolleri
      const content = llmData?.choices?.[0]?.message?.content || llmData?.choices?.[0]?.text;
      if (content) {
        parsedIntent = JSON.parse(content);
      }
    } catch {
      // LLM patlasa bile uygulamanın çökmesini engellemek için varsayılan fallback
    }

    const sellToken = (parsedIntent.sellToken || 'ETH').toUpperCase();
    const buyToken = (parsedIntent.buyToken || 'CBETH').toUpperCase();

    const sellObj = BASE_TOKENS[sellToken] || BASE_TOKENS.ETH;
    const buyObj = BASE_TOKENS[buyToken] || BASE_TOKENS.CBETH;

    const amountInWei = parseUnits(parsedIntent.amount || '0.0001', sellObj.decimals);
    const recipientAddress = (userAddress && userAddress.startsWith('0x')) ? getAddress(userAddress) : UNISWAP_ROUTER;

    const feeTier = TOKEN_FEE_MAP[buyToken] || 500;

    const swapCalldata = encodeFunctionData({
      abi: SWAP_ROUTER_ABI,
      functionName: 'exactInputSingle',
      args: [{
        tokenIn: WETH,
        tokenOut: buyObj.address,
        fee: feeTier,
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
        amount: parsedIntent.amount,
        executionBatch: [
          {
            step: 1,
            action: `Swap ${parsedIntent.amount} ${sellToken} for ${buyToken}`,
            targetContract: UNISWAP_ROUTER,
            estimatedGasUsd: "$0.01",
            details: { calldata: swapCalldata }
          }
        ]
      }
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || "İşlem oluşturulamadı." }, { status: 500 });
  }
}
