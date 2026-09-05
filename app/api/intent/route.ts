import { NextResponse } from 'next/server';
import { encodeFunctionData, parseEther } from 'viem';

const BASE_TOKENS: Record<string, { address: string; fee: number }> = {
  ETH:  { address: '0x4200000000000000000000000000000000000006', fee: 500 }, // WETH Base Address
  USDC: { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', fee: 500 },
  USDT: { address: '0xfde4C96cDB63B34c82808dd471eC8f6c321A8839', fee: 100 },
  DAI:  { address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb', fee: 100 },
  AERO: { address: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58', fee: 3000 }
};

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
  },
  {
    inputs: [{ name: 'data', type: 'bytes[]' }],
    name: 'multicall',
    outputs: [{ name: 'results', type: 'bytes[]' }],
    stateMutability: 'payable',
    type: 'function'
  }
] as const;

function fallbackParseIntent(prompt: string) {
  const cleanPrompt = prompt.toUpperCase();
  const amountMatch = prompt.match(/(\d+(\.\d+)?)/);
  const amount = amountMatch ? amountMatch[0] : '0.0001';

  let buyToken = 'USDC';
  if (cleanPrompt.includes('USDT')) buyToken = 'USDT';
  else if (cleanPrompt.includes('DAI')) buyToken = 'DAI';
  else if (cleanPrompt.includes('AERO')) buyToken = 'AERO';

  return {
    intentType: 'SWAP',
    sellToken: 'ETH',
    buyToken: buyToken,
    amount: amount,
    confidenceScore: 0.98,
    summary: `Swap ${amount} ETH for ${buyToken} via Uniswap V3 Multicall Router`
  };
}

export async function POST(req: Request) {
  try {
    const { prompt, userAddress } = await req.json();

    if (!prompt) {
      return NextResponse.json({ success: false, error: 'Prompt is required' }, { status: 400 });
    }

    let parsedIntent: any = null;
    const GROQ_API_KEY = process.env.GROQ_API_KEY;

    if (GROQ_API_KEY) {
      try {
        const systemPrompt = `You are a Base Blockchain Intent Agent. Convert user request into JSON.
Output ONLY raw JSON with these exact fields: "intentType", "sellToken", "buyToken", "amount", "confidenceScore".
Supported tokens: ETH, USDC, USDT, DAI, AERO.`;

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

        if (groqRes.ok) {
          const groqData = await groqRes.json();
          const content = groqData?.choices?.[0]?.message?.content;
          if (content) {
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) parsedIntent = JSON.parse(jsonMatch[0]);
          }
        }
      } catch (e) {
        console.warn("Groq API error, using Fallback Parser");
      }
    }

    if (!parsedIntent) {
      parsedIntent = fallbackParseIntent(prompt);
    }

    const buyTokenSymbol = parsedIntent.buyToken?.toUpperCase() || 'USDC';
    const sellAmount = parsedIntent.amount || '0.0001';

    const wethObj = BASE_TOKENS.ETH;
    const targetTokenObj = BASE_TOKENS[buyTokenSymbol] || BASE_TOKENS.USDC;
    
    const sellAmountWei = parseEther(sellAmount);
    
    const recipient = (userAddress && userAddress.startsWith('0x')) ? userAddress : '0x0000000000000000000000000000000000000000';

    const swapCalldata = encodeFunctionData({
      abi: SWAP_ROUTER_ABI,
      functionName: 'exactInputSingle',
      args: [{
        tokenIn: wethObj.address as `0x${string}`,
        tokenOut: targetTokenObj.address as `0x${string}`,
        fee: targetTokenObj.fee,
        recipient: recipient as `0x${string}`,
        amountIn: sellAmountWei,
        amountOutMinimum: BigInt(0),
        sqrtPriceLimitX96: BigInt(0)
      }]
    });

    const multicallCalldata = encodeFunctionData({
      abi: SWAP_ROUTER_ABI,
      functionName: 'multicall',
      args: [[swapCalldata]]
    });

    const aggregatorQuote = {
      transaction: {
        to: '0x2626664c2603336E57B271c5C0b26F421741e481', // Base SwapRouter02
        data: multicallCalldata,
        value: `0x${sellAmountWei.toString(16)}`
      }
    };

    return NextResponse.json({
      success: true,
      data: {
        ...parsedIntent,
        sellTokenAddress: wethObj.address,
        buyTokenAddress: targetTokenObj.address,
        sellAmountWei: sellAmountWei.toString(),
        aggregatorQuote
      }
    });

  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Server Error' }, { status: 500 });
  }
}
