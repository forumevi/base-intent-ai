import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ success: false, error: "Groq API Key missing on Vercel" }, { status: 500 });
    }

    // Gerçek AI Ajanı System Prompt'u
    const systemPrompt = `
      You are BaseIntent AI, an autonomous Web3 Intent Engine for Base Network (Chain ID: 8453).
      Analyze the user prompt and extract structured Web3 execution calldata, risk assessment, and batch actions.
      
      Respond STRICTLY in JSON format with no markdown wrappers or extra prose. Structure:
      {
        "intentType": "SWAP" | "BRIDGE" | "BATCH_EXECUTION" | "UNKNOWN",
        "confidenceScore": number (0 to 1),
        "riskAnalysis": {
          "score": "LOW" | "MEDIUM" | "HIGH",
          "warnings": string[]
        },
        "executionBatch": [
          {
            "step": number,
            "action": string,
            "targetContract": string (0x address),
            "estimatedGasUsd": string,
            "details": object
          }
        ],
        "simulationSummary": string
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
    const parsedIntent = JSON.parse(aiData.choices[0].message.content);

    return NextResponse.json({ success: true, data: parsedIntent });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || "Intent parsing failed" }, { status: 500 });
  }
}
