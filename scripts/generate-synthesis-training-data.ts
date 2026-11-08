/**
 * Generates SFT training data by running sample queries through the same
 * pipeline as /api/search.ts: embed query → cosine similarity → top 5 → LLM answer.
 *
 * The 70B response becomes the gold answer for fine-tuning a smaller model.
 *
 * Usage: npx tsx scripts/generate-synthesis-training-data.ts
 * Output: data/sft-synthesis-train.jsonl
 */

import { readFileSync, writeFileSync, appendFileSync, existsSync } from "fs";
import { resolve } from "path";
import { config } from "dotenv";

config({ path: resolve(import.meta.dirname, "..", ".env") });

const FIREWORKS_API_KEY = process.env.FIREWORKS_API_KEY;
const EMBED_ENDPOINT = "https://api.fireworks.ai/inference/v1/embeddings";
const EMBED_MODEL = "nomic-ai/nomic-embed-text-v1.5";
const CHAT_ENDPOINT = "https://api.fireworks.ai/inference/v1/chat/completions";
const CHAT_MODEL = "accounts/fireworks/models/llama-v3p3-70b-instruct";
const TOP_K = 5;

const QUERIES_PATH = resolve(import.meta.dirname, "..", "data", "sample-queries.txt");
const EMBEDDINGS_PATH = resolve(import.meta.dirname, "..", "data", "race-embeddings.json");
const OUTPUT_PATH = resolve(import.meta.dirname, "..", "data", "sft-synthesis-train.jsonl");
const PROGRESS_PATH = resolve(import.meta.dirname, "..", "data", "synthesis-progress.json");

const DELAY_MS = 2000;
const LOG_EVERY = 25;

// ── System prompt (same as api/search.ts) ──

const SYSTEM_PROMPT =
  "You are a friendly running race advisor. Based on the race data provided, answer the user's question concisely. Mention specific race names, dates, and locations. If no races match well, say so honestly.";

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

interface ScoredRace {
  race: RaceEmbedding;
  score: number;
}

// ── Helpers ──

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

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

async function embedQuery(query: string, retries = 3): Promise<number[]> {
  for (let attempt = 0; attempt < retries; attempt++) {
    const res = await fetch(EMBED_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${FIREWORKS_API_KEY}` },
      body: JSON.stringify({ model: EMBED_MODEL, input: [query] }),
    });

    if (res.status === 429) {
      const wait = (attempt + 1) * 8000;
      console.log(`  ⏳ Embed rate limited, waiting ${wait / 1000}s...`);
      await sleep(wait);
      continue;
    }

    if (!res.ok) throw new Error(`Embedding API error ${res.status}: ${await res.text()}`);
    const json = (await res.json()) as { data: { embedding: number[] }[] };
    return json.data[0].embedding;
  }
  throw new Error("Embedding rate limit exceeded after retries");
}

async function chatCompletion(
  messages: { role: string; content: string }[],
  retries = 3
): Promise<string> {
  for (let attempt = 0; attempt < retries; attempt++) {
    const res = await fetch(CHAT_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${FIREWORKS_API_KEY}` },
      body: JSON.stringify({
        model: CHAT_MODEL,
        messages,
        max_tokens: 512,
        temperature: 0.0,
      }),
    });

    if (res.status === 429) {
      const wait = (attempt + 1) * 8000;
      console.log(`  ⏳ Chat rate limited, waiting ${wait / 1000}s...`);
      await sleep(wait);
      continue;
    }

    if (!res.ok) throw new Error(`Chat API error ${res.status}: ${await res.text()}`);
    const json = (await res.json()) as { choices: { message: { content: string } }[] };
    return json.choices[0].message.content.trim();
  }
  throw new Error("Chat rate limit exceeded after retries");
}

function formatRaceContext(races: ScoredRace[]): string {
  if (races.length === 0) return "No matching races found.";
  return races
    .map(
      ({ race, score }, i) =>
        `${i + 1}. ${race.metadata.name} — ${race.metadata.distance} in ${race.metadata.city}, ${race.metadata.state} on ${race.metadata.date} (${race.metadata.difficulty}) [similarity: ${score.toFixed(3)}]`
    )
    .join("\n");
}

function loadProgress(): Set<string> {
  if (!existsSync(PROGRESS_PATH)) return new Set();
  const data = JSON.parse(readFileSync(PROGRESS_PATH, "utf-8")) as string[];
  return new Set(data);
}

function saveProgress(completed: Set<string>): void {
  writeFileSync(PROGRESS_PATH, JSON.stringify([...completed], null, 2));
}

// ── Main ──

async function main() {
  if (!FIREWORKS_API_KEY) {
    console.error("❌ FIREWORKS_API_KEY not set in .env");
    process.exit(1);
  }

  // Load queries
  const allQueries = readFileSync(QUERIES_PATH, "utf-8")
    .split("\n")
    .map((q) => q.trim())
    .filter((q) => q.length > 0);

  // Load embeddings
  console.log("Loading race embeddings...");
  const embeddings: RaceEmbedding[] = JSON.parse(readFileSync(EMBEDDINGS_PATH, "utf-8"));
  console.log(`Loaded ${embeddings.length} embeddings\n`);

  // Resume support
  const completed = loadProgress();
  const remaining = allQueries.filter((q) => !completed.has(q));

  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  SYNTHESIS TRAINING DATA GENERATOR");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`  Queries file:  ${QUERIES_PATH}`);
  console.log(`  Output:        ${OUTPUT_PATH}`);
  console.log(`  Model:         ${CHAT_MODEL}`);
  console.log(`  Total queries: ${allQueries.length}`);
  console.log(`  Already done:  ${completed.size} | Remaining: ${remaining.length}`);
  console.log("═══════════════════════════════════════════════════════════════\n");

  let successCount = 0;
  let errorCount = 0;
  const startTime = Date.now();

  for (let i = 0; i < remaining.length; i++) {
    const query = remaining[i];
    const overall = completed.size + i + 1;

    process.stdout.write(`[${overall}/${allQueries.length}] "${query.slice(0, 55)}"... `);

    try {
      // Step 1: Embed the query
      const queryEmbedding = await embedQuery(query);

      // Step 2: Cosine similarity → top 5
      const scored: ScoredRace[] = embeddings
        .map((race) => ({ race, score: cosineSimilarity(queryEmbedding, race.embedding) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, TOP_K);

      // Step 3: Format context (same as api/search.ts)
      const raceContext = formatRaceContext(scored);
      const userContent = `Here are relevant races:\n${raceContext}\n\nUser question: ${query}`;

      // Step 4: Call 70B for the gold answer
      const answer = await chatCompletion([
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ]);

      // Step 5: Write SFT training example
      const example = {
        messages: [
          { role: "user", content: userContent },
          { role: "assistant", content: answer },
        ],
      };
      appendFileSync(OUTPUT_PATH, JSON.stringify(example) + "\n");

      process.stdout.write("✅\n");
      successCount++;

      // Log sample every LOG_EVERY
      if (overall % LOG_EVERY === 0) {
        console.log("\n  ── Sample Q&A (spot-check) ──");
        console.log(`  Q: ${query}`);
        console.log(`  Top race: ${scored[0].race.metadata.name} (${scored[0].score.toFixed(3)})`);
        console.log(`  A: ${answer.slice(0, 300)}${answer.length > 300 ? "..." : ""}`);
        console.log();
      }
    } catch (err) {
      process.stdout.write(`❌ ${err instanceof Error ? err.message : err}\n`);
      errorCount++;
    }

    // Mark complete and save progress
    completed.add(query);
    if (i % 10 === 0) saveProgress(completed);

    // Rate limit delay
    if (i < remaining.length - 1) await sleep(DELAY_MS);
  }

  saveProgress(completed);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("  COMPLETE");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`  Processed:  ${successCount + errorCount}`);
  console.log(`  Success:    ${successCount}`);
  console.log(`  Errors:     ${errorCount}`);
  console.log(`  Time:       ${elapsed}s`);
  console.log(`  Output:     ${OUTPUT_PATH}`);
  console.log("═══════════════════════════════════════════════════════════════\n");
}

main();
