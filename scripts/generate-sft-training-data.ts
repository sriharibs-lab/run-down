/**
 * Generates SFT (supervised fine-tuning) training data from race descriptions.
 *
 * For each race, calls the Fireworks LLM to extract structured metadata,
 * and writes JSONL output where each line is a training example:
 *   { messages: [ {role: "system", ...}, {role: "user", ...}, {role: "assistant", ...} ] }
 *
 * Usage: npx tsx scripts/generate-sft-training-data.ts
 * Output: data/sft-training-data.jsonl
 */

import { readFileSync, writeFileSync, appendFileSync, existsSync } from "fs";
import { resolve } from "path";
import { config } from "dotenv";

config({ path: resolve(import.meta.dirname, "..", ".env") });

const FIREWORKS_API_KEY = process.env.FIREWORKS_API_KEY;
const CHAT_ENDPOINT = "https://api.fireworks.ai/inference/v1/chat/completions";
const CHAT_MODEL = "accounts/fireworks/models/llama-v3p3-70b-instruct";

const INPUT_PATH = resolve(import.meta.dirname, "..", "src", "data", "races.json");
const OUTPUT_PATH = resolve(import.meta.dirname, "..", "data", "sft-training-data.jsonl");
const PROGRESS_PATH = resolve(import.meta.dirname, "..", "data", "sft-progress.json");

const BATCH_DELAY_MS = 2000;   // delay between calls to avoid rate limiting
const LOG_EVERY = 50;          // print sample output every N races

// ── Types ──

interface Race {
  id: string;
  name: string;
  date: string;
  city: string;
  state: string;
  distance: string | null;
  difficulty: string;
  description: string;
}

interface ExtractedMetadata {
  terrain: "road" | "trail" | "mixed" | null;
  course_type: "loop" | "out-and-back" | "point-to-point" | null;
  elevation_gain_ft: number | null;
  all_distances: string[];
  is_flat_and_fast: boolean;
  is_charity: boolean;
  cause: string | null;
  includes_kids_event: boolean;
  event_type: "running" | "triathlon" | "cycling" | "swimrun" | "multi-sport";
  vibe: "competitive" | "casual" | "family" | "festive" | null;
}

interface TrainingExample {
  messages: {
    role: "system" | "user" | "assistant";
    content: string;
  }[];
  metadata: {
    race_id: string;
    race_name: string;
  };
}

// ── Helpers ──

function stripHtml(html: string | null): string {
  if (!html) return "";
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&[a-z#0-9]+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildPrompt(race: Race): { system: string; user: string } {
  const system = `You extract structured metadata from race event descriptions. Return ONLY valid JSON. Use null for any field you cannot confidently determine from the text. Do not guess or infer.`;

  const description = stripHtml(race.description).slice(0, 1500); // cap to avoid token overflow
  const user = `Extract metadata from this race description:

Race name: ${race.name}
Listed distance: ${race.distance ?? "not specified"}
Listed difficulty: ${race.difficulty}

Description:
${description}

Return JSON with these fields:
- terrain: 'road' | 'trail' | 'mixed' | null
- course_type: 'loop' | 'out-and-back' | 'point-to-point' | null
- elevation_gain_ft: number | null
- all_distances: string[] (every distance offered, e.g. ['5K','10K','Half Marathon'])
- is_flat_and_fast: boolean
- is_charity: boolean
- cause: string | null (the cause name if charity)
- includes_kids_event: boolean
- event_type: 'running' | 'triathlon' | 'cycling' | 'swimrun' | 'multi-sport'
- vibe: 'competitive' | 'casual' | 'family' | 'festive' | null`;

  return { system, user };
}

async function extractMetadata(race: Race, retries = 3): Promise<string | null> {
  const { system, user } = buildPrompt(race);

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(CHAT_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${FIREWORKS_API_KEY}`,
        },
        body: JSON.stringify({
          model: CHAT_MODEL,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          max_tokens: 512,
          temperature: 0.0, // deterministic for training data quality
        }),
      });

      if (res.status === 429) {
        const wait = (attempt + 1) * 10000;
        console.log(`  ⏳ Rate limited, waiting ${wait / 1000}s...`);
        await sleep(wait);
        continue;
      }

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`API error ${res.status}: ${text}`);
      }

      const json = (await res.json()) as {
        choices: { message: { content: string } }[];
      };
      return json.choices[0].message.content.trim();
    } catch (err) {
      if (attempt < retries - 1) {
        console.log(`  ⚠️  Attempt ${attempt + 1} failed: ${err}. Retrying...`);
        await sleep(3000);
      } else {
        console.log(`  ❌ Failed after ${retries} attempts: ${err}`);
        return null;
      }
    }
  }
  return null;
}

function parseJson(raw: string): ExtractedMetadata | null {
  try {
    // Model sometimes wraps in markdown code fences
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
    const parsed = JSON.parse(cleaned);
    return parsed as ExtractedMetadata;
  } catch {
    return null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
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

  const races = JSON.parse(readFileSync(INPUT_PATH, "utf-8")) as Race[];
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  SFT TRAINING DATA GENERATOR");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`  Input:    ${INPUT_PATH}`);
  console.log(`  Output:   ${OUTPUT_PATH}`);
  console.log(`  Model:    ${CHAT_MODEL}`);
  console.log(`  Total races: ${races.length}`);

  // Resume support — skip already-processed race IDs
  const completed = loadProgress();
  const remaining = races.filter((r) => !completed.has(r.id));
  console.log(`  Already done: ${completed.size} | Remaining: ${remaining.length}`);
  console.log("═══════════════════════════════════════════════════════════════\n");

  let successCount = 0;
  let errorCount = 0;
  let parseErrorCount = 0;

  const startTime = Date.now();

  for (let i = 0; i < remaining.length; i++) {
    const race = remaining[i];
    const overall = completed.size + i + 1;

    process.stdout.write(`[${overall}/${races.length}] ${race.name.slice(0, 60)}... `);

    const raw = await extractMetadata(race);

    if (!raw) {
      process.stdout.write("❌ API error\n");
      errorCount++;
      continue;
    }

    const parsed = parseJson(raw);
    if (!parsed) {
      process.stdout.write("⚠️  JSON parse error\n");
      parseErrorCount++;
      // Still save raw output for inspection
      const { system, user } = buildPrompt(race);
      const example: TrainingExample = {
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
          { role: "assistant", content: raw },
        ],
        metadata: { race_id: race.id, race_name: race.name },
      };
      appendFileSync(OUTPUT_PATH, JSON.stringify(example) + "\n");
    } else {
      process.stdout.write("✅\n");
      const { system, user } = buildPrompt(race);
      const example: TrainingExample = {
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
          { role: "assistant", content: JSON.stringify(parsed) },
        ],
        metadata: { race_id: race.id, race_name: race.name },
      };
      appendFileSync(OUTPUT_PATH, JSON.stringify(example) + "\n");
      successCount++;
    }

    // Mark complete and save progress
    completed.add(race.id);
    if (i % 10 === 0) saveProgress(completed);

    // Log sample every LOG_EVERY races
    if ((overall) % LOG_EVERY === 0 && parsed) {
      console.log("\n  ── Sample output (spot-check) ──");
      console.log(`  Race: ${race.name}`);
      console.log(`  ${JSON.stringify(parsed, null, 2).split("\n").join("\n  ")}`);
      console.log();
    }

    // Rate limit delay (skip after last item)
    if (i < remaining.length - 1) await sleep(BATCH_DELAY_MS);
  }

  saveProgress(completed);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const total = successCount + errorCount + parseErrorCount;

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("  COMPLETE");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`  Processed:    ${total}`);
  console.log(`  Success:      ${successCount}`);
  console.log(`  Parse errors: ${parseErrorCount}`);
  console.log(`  API errors:   ${errorCount}`);
  console.log(`  Time:         ${elapsed}s`);
  console.log(`  Output:       ${OUTPUT_PATH}`);
  console.log("═══════════════════════════════════════════════════════════════\n");
}

main();
