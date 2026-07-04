import { CONFIG } from "./config";

const HF_TOKEN = process.env.HF_TOKEN || "";

export async function embedQuery(text: string): Promise<number[]> {
  const response = await fetch(
    `https://router.huggingface.co/hf-inference/models/${CONFIG.embeddingModel}/pipeline/feature-extraction`,
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
    console.error("Hugging Face API hata detayı:", errorText);
    throw new Error(`HF API Status: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  const flatArray = Array.isArray(result) ? result.flat(Infinity) : [];

  if (flatArray.length === 0 || typeof flatArray[0] !== "number") {
    console.error("Hugging Face beklenmeyen bir veri döndürdü:", result);
    throw new Error("Döndürülen veri geçerli bir embedding vektörü değil.");
  }

  return flatArray as number[];
}
