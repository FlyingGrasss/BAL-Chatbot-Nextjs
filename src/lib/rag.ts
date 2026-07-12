import vectorstore from "../data/vectorstore.json";
import { CONFIG } from "./config";
import { embedQuery } from "./embeddings";
import type { ChatMessage, RetrievedChunk } from "./types";

type VectorChunk = {
  id: number;
  text: string;
  breadcrumb?: string;
  section_title?: string;
  embedding: number[];
};

const chunks = vectorstore.chunks as VectorChunk[];

const BAL_TOPIC_TERMS = [
  "bal",
  "bornova",
  "okul",
  "lise",
  "lgs",
  "yks",
  "hazırlık",
  "kayıt",
  "nakil",
  "öğrenci",
  "öğretmen",
  "müdür",
  "ders",
  "sınav",
  "puan",
  "yüzdelik",
  "kontenjan",
  "pansiyon",
  "yurt",
  "kampüs",
  "ayran günü",
  "balev",
  "balmed",
  "balöder",
  "balpod",
  "balspor",
  "dsd",
  "delf",
  "dalf",
  "pasch",
  "advanced placement",
  "kulüp",
  "topluluk",
  "ulaşım",
  "servis",
  "otobüs",
  "metro",
  "forma",
  "devamsızlık",
  "kantin",
  "kütüphane",
  "rehberlik",
  "yabancı dil",
  "ingilizce",
  "almanca",
  "fransızca",
  "mezun",
  "öğle arası",
  "giriş saati",
  "çıkış saati",
  "olimpiyat",
  "bilim",
  "matematik",
  "tübitak",
  "teknofest",
  "yarışma",
  "ballama",
  "gelenek",
] as const;

const VAGUE_FOLLOW_UP = /^(tell me more|more|devam|devam et|biraz daha anlat|daha fazla anlat|detaylandır|detay verir misin|peki|neden|nasıl yani|ne demek|nedir|ne dir)[?.!\s]*$/iu;
const SEARCH_GROUNDING_TERMS = [
  "güncel",
  "şu an",
  "bugün",
  "bu yıl",
  "gelecek yıl",
  "önümüzdeki yıl",
  "en son",
  "son durum",
  "yeni müdür",
  "kim olacak",
  "değişti mi",
  "internetten",
  "webden",
  "web'den",
  "google'da",
  "araştır",
  "current",
  "latest",
  "today",
  "search the web",
] as const;

export function buildRetrievalQuery(message: string, history: ChatMessage[]) {
  if (!VAGUE_FOLLOW_UP.test(message.trim())) return message;
  const previousUserMessage = [...history]
    .reverse()
    .find((item) => item.role === "user")?.content;
  return previousUserMessage ? `${previousUserMessage}\n${message}` : message;
}

export function isBalRelatedQuery(query: string) {
  const normalized = query.toLocaleLowerCase("tr-TR");
  return BAL_TOPIC_TERMS.some((term) => normalized.includes(term));
}

export function shouldUseGoogleSearch(query: string) {
  const normalized = query.toLocaleLowerCase("tr-TR");
  return SEARCH_GROUNDING_TERMS.some((term) => normalized.includes(term));
}

export async function retrieve(query: string, topK = CONFIG.retrievalTopK): Promise<RetrievedChunk[]> {
  const queryEmbedding = await embedQuery(query);
  return chunks
    .map((chunk) => ({
      ...chunk,
      relevance_score: dot(queryEmbedding, chunk.embedding),
    }))
    .sort((a, b) => b.relevance_score - a.relevance_score)
    .slice(0, topK)
    .map(({ embedding: _embedding, ...chunk }) => chunk);
}

export function formatContext(retrieved: RetrievedChunk[], threshold = CONFIG.retrievalScoreThreshold) {
  if (!retrieved.length) return "Bağlamda ilgili bilgi bulunamadı.";

  const parts = retrieved
    .filter((chunk) => chunk.relevance_score >= threshold)
    .map((chunk) => `[Kaynak: ${chunk.breadcrumb || ""}]\n${chunk.text}`);

  return parts.length ? parts.join("\n\n---\n\n") : "Bağlamda yeterince ilgili bilgi bulunamadı.";
}

export function buildAugmentedUserMessage(userInput: string, context: string) {
  const normalized = userInput.toLocaleLowerCase("tr-TR");
  const exactContactContext =
    /(adres|telefon|iletişim)/u.test(normalized)
      ? `## Öncelikli İletişim Bilgisi\n\nTam resmî adres: Mevlana Mahallesi, Ord. Prof. Dr. Muhiddin Erel Caddesi, Bornova Anadolu Lisesi Blok No: 15A, Bornova / İzmir\nTelefon: 0232 388 10 39\n\nAdres sorusunu yanıtlarken bu tam adresi kullan; yalnızca IKEA, Yeni Garaj Yolu veya Altay Ticaret Meslek Lisesi gibi konum tarifleriyle yetinme.\n\n---\n\n`
      : "";

  return `${exactContactContext}## İlgili Bağlam (Okul Bilgi Kaynağı)\n\n${context}\n\n---\n\n## Kullanıcı Sorusu\n\n${userInput}`;
}

export function buildSourcesPayload(retrieved: RetrievedChunk[], threshold = CONFIG.retrievalScoreThreshold) {
  return retrieved
    .slice(0, 3)
    .filter((chunk) => chunk.relevance_score >= threshold)
    .map((chunk) => ({
      breadcrumb: chunk.breadcrumb || "",
      score: Math.round(chunk.relevance_score * 1000) / 1000,
    }));
}

function dot(a: number[], b: number[]) {
  let score = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i += 1) score += a[i] * b[i];
  return score;
}
