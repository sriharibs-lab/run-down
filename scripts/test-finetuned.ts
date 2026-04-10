/**
 * Compares fine-tuned 8B model vs 70B baseline on the same queries.
 *
 * For each query: embed → cosine sim → top 5 → call both models → compare.
 *
 * Usage: npx tsx scripts/test-finetuned.ts
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { config } from "dotenv";

config({ path: resolve(import.meta.dirname, "..", ".env") });

const FIREWORKS_API_KEY = process.env.FIREWORKS_API_KEY;
const EMBED_ENDPOINT = "https://api.fireworks.ai/inference/v1/embeddings";
const EMBED_MODEL = "nomic-ai/nomic-embed-text-v1.5";
const CHAT_ENDPOINT = "https://api.fireworks.ai/inference/v1/chat/completions";

const MODEL_70B = "accounts/fireworks/models/llama-v3p3-70b-instruct";
const MODEL_8B_FT = "accounts/srihari-srinivasa/deployments/ap41brsm";

const SYSTEM_PROMPT =
  "You are a friendly running race advisor. Based on the race data provided, answer the user's question concisely. Mention specific race names, dates, and locations. If no races match well, say so honestly.";

const TOP_K = 5;

const EMBEDDINGS_PATH = resolve(import.meta.dirname, "..", "data", "race-embeddings.json");

const TEST_QUERIES = [
  "flat spring race in WA for kids",
  "challenging trail run near Portland",
  "Thanksgiving 5K in California",
  "beginner-friendly half marathon with ocean views",
  "charity race in Oregon this summer",
];

// ── Types ──

interface RaceEmbedding {
  id: string;
  text: string;
  embedding: number[];
  metadata: {
    name: string;
    city: string;
    state: string;
    distance: string | null;
    difficulty: string;
    date: string;
  };
}

interface ComparisonResult {
  query: string;
  raceContext: string;
  answer70B: string;
  answer8B: string;
  latency70B: number;
  latency8B: number;
  embedLatency: number;
  searchLatency: number;
  error?: string;
}

// ── Helpers ──

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function embedQuery(query: string): Promise<{ embedding: number[]; latency: number }> {
  const start = Date.now();
  const res = await fetch(EMBED_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${FIREWORKS_API_KEY}` },
    body: JSON.stringify({ model: EMBED_MODEL, input: [query] }),
  });
  if (!res.ok) throw new Error(`Embedding API error ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { data: { embedding: number[] }[] };
  return { embedding: json.data[0].embedding, latency: Date.now() - start };
}

async function chatCompletion(
  model: string,
  messages: { role: string; content: string }[]
): Promise<{ answer: string; latency: number }> {
  const start = Date.now();
  const res = await fetch(CHAT_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${FIREWORKS_API_KEY}` },
    body: JSON.stringify({ model, messages, max_tokens: 512, temperature: 0.0 }),
  });
  if (!res.ok) throw new Error(`Chat API error (${model}) ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { choices: { message: { content: string } }[] };
  return { answer: json.choices[0].message.content.trim(), latency: Date.now() - start };
}

function formatRaceContext(
  races: { race: RaceEmbedding; score: number }[]
): string {
  return races
    .map(
      ({ race, score }, i) =>
        `${i + 1}. ${race.metadata.name} — ${race.metadata.distance} in ${race.metadata.city}, ${race.metadata.state} on ${race.metadata.date} (${race.metadata.difficulty}) [similarity: ${score.toFixed(3)}]`
    )
    .join("\n");
}

// ── Main ──

async function main() {
  if (!FIREWORKS_API_KEY) {
    console.error("❌ FIREWORKS_API_KEY not set in .env");
    process.exit(1);
  }

  console.log("Loading race embeddings...");
  const embeddings: RaceEmbedding[] = JSON.parse(readFileSync(EMBEDDINGS_PATH, "utf-8"));
  console.log(`Loaded ${embeddings.length} embeddings\n`);

  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  FINE-TUNED vs 70B COMPARISON TEST");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`  70B model:  ${MODEL_70B}`);
  console.log(`  8B model:   ${MODEL_8B_FT}`);
  console.log(`  Queries:    ${TEST_QUERIES.length}`);
  console.log("═══════════════════════════════════════════════════════════════\n");

  const results: ComparisonResult[] = [];

  for (let i = 0; i < TEST_QUERIES.length; i++) {
    const query = TEST_QUERIES[i];
    console.log(`\n── [${i + 1}/${TEST_QUERIES.length}] "${query}" ──\n`);

    try {
      // Step 1: Embed
      const { embedding, latency: embedLatency } = await embedQuery(query);
      console.log(`  Embed: ${embedLatency}ms`);

      // Step 2: Search
      const searchStart = Date.now();
      const scored = embeddings
        .map((race) => ({ race, score: cosineSimilarity(embedding, race.embedding) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, TOP_K);
      const searchLatency = Date.now() - searchStart;
      console.log(`  Search: ${searchLatency}ms`);
      console.log(`  Top match: ${scored[0].race.metadata.name} (${scored[0].score.toFixed(3)})`);

      const raceContext = formatRaceContext(scored);
      const userContent = `Here are relevant races:\n${raceContext}\n\nUser question: ${query}`;

      // Step 3: Call 70B (with system prompt)
      console.log(`  Calling 70B...`);
      const result70B = await chatCompletion(MODEL_70B, [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ]);
      console.log(`  70B: ${result70B.latency}ms | ${result70B.answer.slice(0, 80)}...`);

      await sleep(2000); // rate limit buffer

      // Step 4: Call fine-tuned 8B (no system prompt)
      console.log(`  Calling 8B fine-tuned...`);
      const result8B = await chatCompletion(MODEL_8B_FT, [
        { role: "user", content: userContent },
      ]);
      console.log(`  8B:  ${result8B.latency}ms | ${result8B.answer.slice(0, 80)}...`);

      results.push({
        query,
        raceContext,
        answer70B: result70B.answer,
        answer8B: result8B.answer,
        latency70B: result70B.latency,
        latency8B: result8B.latency,
        embedLatency,
        searchLatency,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`  ❌ Error: ${msg}`);
      results.push({
        query,
        raceContext: "",
        answer70B: "",
        answer8B: "",
        latency70B: 0,
        latency8B: 0,
        embedLatency: 0,
        searchLatency: 0,
        error: msg,
      });
    }

    if (i < TEST_QUERIES.length - 1) await sleep(2000);
  }

  // ── Comparison Table ──

  console.log("\n\n═══════════════════════════════════════════════════════════════");
  console.log("  COMPARISON TABLE");
  console.log("═══════════════════════════════════════════════════════════════\n");

  const pad = (s: string, n: number) => s.length > n ? s.slice(0, n - 1) + "…" : s.padEnd(n);
  const header = `| ${pad("Query", 45)} | ${pad("70B ms", 7)} | ${pad("8B ms", 7)} | ${pad("70B answer", 40)} | ${pad("8B answer", 40)} |`;
  const separator = `|${"-".repeat(47)}|${"-".repeat(9)}|${"-".repeat(9)}|${"-".repeat(42)}|${"-".repeat(42)}|`;

  console.log(header);
  console.log(separator);

  for (const r of results) {
    if (r.error) {
      console.log(`| ${pad(r.query, 45)} | ${pad("ERR", 7)} | ${pad("ERR", 7)} | ${pad(r.error.slice(0, 40), 40)} | ${pad("", 40)} |`);
    } else {
      console.log(
        `| ${pad(r.query, 45)} | ${pad(String(r.latency70B), 7)} | ${pad(String(r.latency8B), 7)} | ${pad(r.answer70B.replace(/\n/g, " ").slice(0, 40), 40)} | ${pad(r.answer8B.replace(/\n/g, " ").slice(0, 40), 40)} |`
      );
    }
  }

  // ── Full Answers ──

  console.log("\n\n═══════════════════════════════════════════════════════════════");
  console.log("  FULL ANSWERS");
  console.log("═══════════════════════════════════════════════════════════════");

  for (const r of results) {
    if (r.error) continue;
    console.log(`\n── Q: "${r.query}" ──`);
    console.log(`\n  [70B] (${r.latency70B}ms):`);
    console.log(`  ${r.answer70B.split("\n").join("\n  ")}`);
    console.log(`\n  [8B fine-tuned] (${r.latency8B}ms):`);
    console.log(`  ${r.answer8B.split("\n").join("\n  ")}`);
  }

  // ── Summary Stats ──

  const successful = results.filter((r) => !r.error);
  if (successful.length > 0) {
    const avg = (arr: number[]) => Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
    const avg70B = avg(successful.map((r) => r.latency70B));
    const avg8B = avg(successful.map((r) => r.latency8B));
    const speedup = (avg70B / avg8B).toFixed(1);

    console.log("\n\n═══════════════════════════════════════════════════════════════");
    console.log("  SUMMARY");
    console.log("═══════════════════════════════════════════════════════════════");
    console.log(`  Avg 70B latency:  ${avg70B}ms`);
    console.log(`  Avg 8B latency:   ${avg8B}ms`);
    console.log(`  Speedup:          ${speedup}x`);
    console.log(`  Avg answer length (70B): ${avg(successful.map((r) => r.answer70B.length))} chars`);
    console.log(`  Avg answer length (8B):  ${avg(successful.map((r) => r.answer8B.length))} chars`);
    console.log("═══════════════════════════════════════════════════════════════\n");
  }
}

main();
