import { CONFIG } from "./config";

const HF_TOKEN = process.env.HF_TOKEN || "";

export async function embedQuery(text: string): Promise<number[]> {
  // Use the exact model matching your JSON vectorstore dimensions (384)
  const modelId = "intfloat/multilingual-e5-small";

  const response = await fetch(
    `https://api-inference.huggingface.co/pipeline/feature-extraction/${modelId}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${HF_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ inputs: `query: ${text}` }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Hugging Face API Details:", errorText);
    throw new Error(`Hugging Face API Error: ${response.status}`);
  }

  const result = await response.json();

  // Cleanly flatten the tensor output to a flat number array
  return Array.isArray(result[0]) ? result[0] : result;
}
