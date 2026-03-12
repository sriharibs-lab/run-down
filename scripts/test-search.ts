import { readFileSync } from "fs";
import { resolve } from "path";
import { config } from "dotenv";

config({ path: resolve(import.meta.dirname, "..", ".env") });

const FIREWORKS_API_KEY = process.env.FIREWORKS_API_KEY;
const EMBED_ENDPOINT = "https://api.fireworks.ai/inference/v1/embeddings";
const EMBED_MODEL = "nomic-ai/nomic-embed-text-v1.5";
const CHAT_ENDPOINT = "https://api.fireworks.ai/inference/v1/chat/completions";
const CHAT_MODEL = "accounts/fireworks/models/llama-v3p3-70b-instruct";

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; normA += a[i] * a[i]; normB += b[i] * b[i]; }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function main() {
  const query = process.argv[2] || "scenic half marathon in Oregon";
  const totalStart = Date.now();

  // Embed query
  const embedStart = Date.now();
  const embedRes = await fetch(EMBED_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${FIREWORKS_API_KEY}` },
    body: JSON.stringify({ model: EMBED_MODEL, input: [query] }),
  });
  const embedJson = await embedRes.json() as any;
  if (!embedRes.ok) { console.error("Embed API error:", embedJson); process.exit(1); }
  const queryEmb = embedJson.data[0].embedding;
  const embeddingMs = Date.now() - embedStart;

  // Search
  const searchStart = Date.now();
  const embeddings = JSON.parse(readFileSync(resolve(import.meta.dirname, "..", "data", "race-embeddings.json"), "utf-8"));
  const scored = embeddings.map((r: any) => ({ race: r, score: cosineSimilarity(queryEmb, r.embedding) }));
  scored.sort((a: any, b: any) => b.score - a.score);
  const top5 = scored.slice(0, 5);
  const searchMs = Date.now() - searchStart;

  // LLM
  const context = top5.map((r: any, i: number) =>
    `${i + 1}. ${r.race.metadata.name} — ${r.race.metadata.distance} in ${r.race.metadata.city}, ${r.race.metadata.state} on ${r.race.metadata.date} (${r.race.metadata.difficulty}) [sim: ${r.score.toFixed(3)}]`
  ).join("\n");

  const llmStart = Date.now();
  const chatRes = await fetch(CHAT_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${FIREWORKS_API_KEY}` },
    body: JSON.stringify({
      model: CHAT_MODEL,
      messages: [
        { role: "system", content: "You are a friendly running race advisor. Based on the race data provided, answer the user's question concisely. Mention specific race names, dates, and locations. If no races match well, say so honestly." },
        { role: "user", content: `Here are relevant races:\n${context}\n\nUser question: ${query}` },
      ],
      max_tokens: 512,
      temperature: 0.7,
    }),
  });
  const chatJson = await chatRes.json() as any;
  if (!chatRes.ok) { console.error("Chat API error:", chatJson); process.exit(1); }
  const answer = chatJson.choices[0].message.content;
  const llmMs = Date.now() - llmStart;
  const totalMs = Date.now() - totalStart;

  console.log("=== RESULTS ===");
  console.log(`Query: "${query}"\n`);
  console.log("Top 5 races:");
  top5.forEach((r: any, i: number) =>
    console.log(`  ${i + 1}. [${r.score.toFixed(3)}] ${r.race.metadata.name} — ${r.race.metadata.distance}, ${r.race.metadata.city}, ${r.race.metadata.state}, ${r.race.metadata.date}`)
  );
  console.log(`\nLLM Answer:\n${answer}`);
  console.log(`\nLatency: embed=${embeddingMs}ms search=${searchMs}ms llm=${llmMs}ms total=${totalMs}ms`);
}

main().catch(console.error);
