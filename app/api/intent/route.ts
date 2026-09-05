import { NextResponse } from 'next/server';
import { encodeFunctionData, parseEther } from 'viem';

// Ağ Kimlikleri (Chain IDs)
const CHAIN_IDS: Record<string, number> = {
  ETHEREUM: 1,
  OPTIMISM: 10,
  POLYGON: 137,
  BASE: 8453,
  ARBITRUM: 42161
};

const BASE_TOKENS: Record<string, { address: string; fee: number }> = {
  ETH:  { address: '0x4200000000000000000000000000000000000006', fee: 500 },
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
    inputs: [
      { name: 'deadline', type: 'uint256' },
      { name: 'data', type: 'bytes[]' }
    ],
    name: 'multicall',
    outputs: [{ name: 'results', type: 'bytes[]' }],
    stateMutability: 'payable',
    type: 'function'
  }
] as const;

function fallbackParseIntent(prompt: string) {
  const cleanPrompt = prompt.toUpperCase();
  const amountMatch = prompt.match(/(\d+(\.\d+)?)/);
  const amount = amountMatch ? amountMatch[0] : '0.001';

  const isBridge = cleanPrompt.includes('BRIDGE') || cleanPrompt.includes('KÖPRÜ') || cleanPrompt.includes('FROM') || cleanPrompt.includes('TRANSFER');

  if (isBridge) {
    let sourceChain = 'ARBITRUM';
    if (cleanPrompt.includes('OPTIMISM') || cleanPrompt.includes('OP')) sourceChain = 'OPTIMISM';
    else if (cleanPrompt.includes('POLYGON') || cleanPrompt.includes('MATIC')) sourceChain = 'POLYGON';
    else if (cleanPrompt.includes('ETHEREUM') || cleanPrompt.includes('MAINNET')) sourceChain = 'ETHEREUM';

    return {
      intentType: 'BRIDGE',
      sourceChain,
      targetChain: 'BASE',
      sellToken: 'ETH',
      buyToken: 'ETH',
      amount,
      confidenceScore: 0.99,
      summary: `Bridge ${amount} ETH from ${sourceChain} to Base via Across`
    };
  }

  let buyToken = 'USDC';
  if (cleanPrompt.includes('USDT')) buyToken = 'USDT';
  else if (cleanPrompt.includes('DAI')) buyToken = 'DAI';
  else if (cleanPrompt.includes('AERO')) buyToken = 'AERO';

  return {
    intentType: 'SWAP',
    sellToken: 'ETH',
    buyToken,
    amount,
    confidenceScore: 0.99,
    summary: `Swap ${amount} ETH for ${buyToken} via Uniswap V3 Engine`
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
        const systemPrompt = `You are an Intent AI Agent supporting SWAP on Base and BRIDGE to Base. Convert prompt to JSON.
Required Fields: "intentType" ("SWAP" or "BRIDGE"), "sourceChain", "targetChain", "sellToken", "buyToken", "amount", "confidenceScore".
Supported Chains: ARBITRUM, OPTIMISM, ETHEREUM, POLYGON, BASE.
Output ONLY raw JSON.`;

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
        console.warn("Groq API fallback triggered");
      }
    }

    if (!parsedIntent) {
      parsedIntent = fallbackParseIntent(prompt);
    }

    const recipient = (userAddress && userAddress.startsWith('0x')) ? userAddress : '0x0000000000000000000000000000000000000000';
    const amountWei = parseEther(parsedIntent.amount || '0.001');

    // 1. KÖPRÜ (BRIDGE) İŞLEMİ
    if (parsedIntent.intentType === 'BRIDGE') {
      const sourceChainName = parsedIntent.sourceChain?.toUpperCase() || 'ARBITRUM';
      const originChainId = CHAIN_IDS[sourceChainName] || CHAIN_IDS.ARBITRUM;
      const destinationChainId = CHAIN_IDS.BASE;

      // Across Protocol API'den Rota ve Calldata Alma
      const acrossUrl = `https://across.to/api/suggested-fees?inputToken=0x0000000000000000000000000000000000000000&outputToken=0x0000000000000000000000000000000000000000&originChainId=${originChainId}&destinationChainId=${destinationChainId}&amount=${amountWei.toString()}&recipient=${recipient}`;

      let bridgeTransaction = null;
      try {
        const acrossRes = await fetch(acrossUrl);
        if (acrossRes.ok) {
          const acrossData = await acrossRes.json();
          bridgeTransaction = {
            to: acrossData.spokePoolAddress,
            data: acrossData.spokePoolCalldata || '0x',
            value: `0x${amountWei.toString(16)}`,
            chainId: originChainId
          };
        }
      } catch (err) {
        console.warn("Across API fetch failed, fallback mock returned");
      }

      return NextResponse.json({
        success: true,
        data: {
          ...parsedIntent,
          originChainId,
          destinationChainId,
          sellAmountWei: amountWei.toString(),
          aggregatorQuote: {
            transaction: bridgeTransaction || {
              to: '0x5c7BC9637f62024254823a0A38e8EE2FF45D8E65', // Across SpokePool Fallback
              data: '0x',
              value: `0x${amountWei.toString(16)}`,
              chainId: originChainId
            }
          }
        }
      });
    }

    // 2. TAKAS (SWAP) İŞLEMİ (Uniswap V3 Base)
    const buyTokenSymbol = parsedIntent.buyToken?.toUpperCase() || 'USDC';
    const targetTokenObj = BASE_TOKENS[buyTokenSymbol] || BASE_TOKENS.USDC;
    const wethObj = BASE_TOKENS.ETH;

    const swapCalldata = encodeFunctionData({
      abi: SWAP_ROUTER_ABI,
      functionName: 'exactInputSingle',
      args: [{
        tokenIn: wethObj.address as `0x${string}`,
        tokenOut: targetTokenObj.address as `0x${string}`,
        fee: targetTokenObj.fee,
        recipient: recipient as `0x${string}`,
        amountIn: amountWei,
        amountOutMinimum: BigInt(0),
        sqrtPriceLimitX96: BigInt(0)
      }]
    });

    const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200);
    const multicallCalldata = encodeFunctionData({
      abi: SWAP_ROUTER_ABI,
      functionName: 'multicall',
      args: [deadline, [swapCalldata]]
    });

    return NextResponse.json({
      success: true,
      data: {
        ...parsedIntent,
        sellTokenAddress: wethObj.address,
        buyTokenAddress: targetTokenObj.address,
        sellAmountWei: amountWei.toString(),
        aggregatorQuote: {
          transaction: {
            to: '0x2626664c2603336E57B271c5C0b26F421741e481',
            data: multicallCalldata,
            value: `0x${amountWei.toString(16)}`,
            chainId: CHAIN_IDS.BASE
          }
        }
      }
    });

  } catch (error: any) {
    console.error('API Handler Error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Agent Execution Error' }, { status: 500 });
  }
}
