import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();
    const apiKey = process.env.GROQ_API_KEY?.trim();

    if (!apiKey) {
      return NextResponse.json({ 
        success: false, 
        error: "Groq API Key bulunamadı. Vercel uzerinden ekleyip Redeploy yapin." 
      }, { status: 500 });
    }

    const systemPrompt = `
      You are BaseIntent AI, an autonomous Web3 Intent Engine for Base Network (Chain ID: 8453).
      Analyze the user prompt and extract structured Web3 execution calldata, risk assessment, and batch actions.
      
      Respond STRICTLY in JSON format. Structure:
      {
        "intentType": "SWAP",
        "confidenceScore": 0.98,
        "riskAnalysis": {
          "score": "LOW",
          "warnings": ["Low slippage tolerance detected"]
        },
        "executionBatch": [
          {
            "step": 1,
            "action": "Approve USDC Spend on Base Router",
            "targetContract": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
            "estimatedGasUsd": "$0.002",
            "details": {}
          }
        ],
        "simulationSummary": "Parsed intent successfully for Base Network."
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

    const aiData = await response.json();

    if (!response.ok || !aiData.choices || !aiData.choices[0]) {
      const errorMsg = aiData.error?.message || JSON.stringify(aiData);
      return NextResponse.json({ 
        success: false, 
        error: `Groq Yanit Hatasi: ${errorMsg}` 
      }, { status: 500 });
    }

    const parsedIntent = JSON.parse(aiData.choices[0].message.content);
    return NextResponse.json({ success: true, data: parsedIntent });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || "Bilinmeyen bir hata olustu." }, { status: 500 });
  }
}
