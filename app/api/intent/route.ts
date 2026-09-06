import { NextResponse } from 'next/server';
import { encodeFunctionData, parseEther, parseUnits, getAddress } from 'viem';

// Base Mainnet Doğrulanmış Kontrat Listesi
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

// LLM Parsleme Çağrısı (Groq Llama 3.3-70B Entegrasyonu)
async function parseIntentWithLLM(prompt: string) {
  const apiKey = process.env.GROQ_API_KEY;
  
  if (!apiKey) {
    // Fallback if API key missing
    return { sellToken: 'ETH', buyToken: 'USDC', amount: '0.0001' };
  }

  const systemPrompt = `You are an AI DeFi Intent Parser for Base Mainnet. 
Analyze the user query and output ONLY a raw JSON object (no markdown, no backticks) with 3 keys:
- "sellToken": Symbol (ETH, USDC, CBETH, DAI, AERO)
- "buyToken": Symbol (ETH, USDC, CBETH, DAI, AERO)
- "amount": String representation of amount (e.g. "0.0001" or "1")

Available tokens: ETH, USDC, CBETH, DAI, AERO.
If user says "buy ETH with USDC", sellToken is USDC, buyToken is ETH.`;

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' }
    })
  });

  const data = await response.json();
  const parsed = JSON.parse(data.choices[0].message.content);
  return {
    sellToken: parsed.sellToken?.toUpperCase() || 'ETH',
    buyToken: parsed.buyToken?.toUpperCase() || 'USDC',
    amount: String(parsed.amount || '0.0001')
  };
}

export async function POST(req: Request) {
  try {
    const { prompt, userAddress } = await req.json();

    if (!prompt) {
      return NextResponse.json({ success: false, error: 'Prompt is required' }, { status: 400 });
    }

    // 1. LLM ile Intent Analizi Yapılıyor
    const intent = await parseIntentWithLLM(prompt);

    const sellObj = BASE_TOKENS[intent.sellToken] || BASE_TOKENS.ETH;
    const buyObj = BASE_TOKENS[intent.buyToken] || BASE_TOKENS.USDC;

    const amountInWei = parseUnits(intent.amount, sellObj.decimals);

    const recipientAddress = (userAddress && userAddress.startsWith('0x')) 
      ? getAddress(userAddress) 
      : UNISWAP_ROUTER;

    // 2. Uniswap V3 Calldata Hazırlığı
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

    const isNativeEth = intent.sellToken === 'ETH';

    return NextResponse.json({
      success: true,
      data: {
        to: UNISWAP_ROUTER,
        data: swapCalldata,
        value: isNativeEth ? `0x${amountInWei.toString(16)}` : '0x0',
        sellToken: intent.sellToken,
        buyToken: intent.buyToken,
        amount: intent.amount,
        sellTokenAddress: sellObj.address,
        amountInWei: amountInWei.toString(),
        requiresApproval: !isNativeEth
      }
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Error processing intent' }, { status: 500 });
  }
}
