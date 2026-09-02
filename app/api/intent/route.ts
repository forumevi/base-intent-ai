import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();
    const apiKey = process.env.GROQ_API_KEY?.trim();

    if (!apiKey) {
      return NextResponse.json({ 
        success: false, 
        error: "Groq API Key eksik! Lütfen Vercel Settings -> Environment Variables altından GROQ_API_KEY ekleyip Redeploy yapın." 
      }, { status: 500 });
    }

    const systemPrompt = `
      You are BaseIntent AI, an autonomous Web3 Intent Engine for Base Network (Chain ID: 8453).
      Analyze the user prompt and extract structured Web3 execution calldata, risk assessment, and batch actions.
      
      Respond STRICTLY in JSON format with no markdown wrappers or extra prose. Structure:
      {
        "intentType": "SWAP" | "BRIDGE" | "BATCH_EXECUTION" | "UNKNOWN",
        "confidenceScore": 0.98,
        "riskAnalysis": {
          "score": "LOW" | "MEDIUM" | "HIGH",
          "warnings": ["Low slippage tolerance detected", "Verified Aerodrome Router"]
        },
        "executionBatch": [
          {
            "step": 1,
            "action": "Approve USDC Spend on Base Router",
            "targetContract": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
            "estimatedGasUsd": "$0.002",
            "details": {}
          },
          {
            "step": 2,
            "action": "Execute Liquidity Swap on Base Pool",
            "targetContract": "0x4200000000000000000000000000000000000006",
            "estimatedGasUsd": "$0.012",
            "details": {}
          }
        ],
        "simulationSummary": "Parsed intent successfully. Calculated optimal path on Base Mainnet with 0.001% price impact."
      }
    `;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt }
        ],
        temperature: 0.1,
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json({ success: false, error: `Groq API Bağlantı Hatası: ${errText}` }, { status: 500 });
    }

    const aiData = await response.json();
    const parsedIntent = JSON.parse(aiData.choices[0].message.content);

    return NextResponse.json({ success: true, data: parsedIntent });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || "Intent parsing hatası oluştu." }, { status: 500 });
  }
}
