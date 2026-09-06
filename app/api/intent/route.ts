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
      const content = data.choices[0].message.content.trim().replace(/```json|
