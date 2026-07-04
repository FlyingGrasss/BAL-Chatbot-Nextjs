import { CONFIG } from "./config";

const HF_TOKEN = process.env.HF_TOKEN || "";

export async function embedQuery(text: string): Promise<number[]> {
  // Vektör veritabanınızın boyutuna (384) uygun model
  const modelId = "intfloat/multilingual-e5-small";

  try {
    // 2026 Hugging Face Serverless Inference API kesin ve güncel endpoint'i:
    const response = await fetch(
      `https://router.huggingface.co/hf-inference/models/${modelId}/pipeline/feature-extraction`,
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
      console.error("➔ Hugging Face API Hata Detayı:", errorText);
      throw new Error(`HF API Status: ${response.status} - ${errorText}`);
    }

    const result = await response.json();

    // --- DİZİ BOYUTUNU DÜZLEŞTİRME ---
    // HF bazen [[[embedding]]] şeklinde döner, flat(Infinity) ile bunu temiz bir number[] yaparız.
    const flatArray = Array.isArray(result) ? result.flat(Infinity) : [];

    if (flatArray.length === 0 || typeof flatArray[0] !== "number") {
      console.error("➔ Hugging Face beklenmeyen bir veri döndürdü:", result);
      throw new Error("Döndürülen veri geçerli bir embedding vektörü değil.");
    }

    return flatArray as number[];
  } catch (error) {
    console.error("➔ embedQuery fonksiyonu içinde hata gerçekleşti:", error);
    throw error;
  }
}
