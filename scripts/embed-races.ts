import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { config } from "dotenv";

config({ path: resolve(import.meta.dirname, "..", ".env") });

const API_KEY = process.env.FIREWORKS_API_KEY;
if (!API_KEY) {
  console.error("Missing FIREWORKS_API_KEY in .env");
  process.exit(1);
}

const ENDPOINT = "https://api.fireworks.ai/inference/v1/embeddings";
const MODEL = "nomic-ai/nomic-embed-text-v1.5";
const BATCH_SIZE = 20;

interface Race {
  id: string;
  name: string;
  date: string;
  city: string;
  state: string;
  distance: string;
  difficulty: string;
  description: string;
  [key: string]: unknown;
}

interface EmbeddingResult {
  id: string;
  text: string;
  embedding: number[];
  metadata: {
    name: string;
    city: string;
    state: string;
    distance: string;
    difficulty: string;
    date: string;
  };
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#\d+;/g, "")
    .replace(/&\w+;/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildText(race: Race): string {
  const desc = stripHtml(race.description || "");
  return `${race.name} is a ${race.distance} race in ${race.city}, ${race.state}. Difficulty: ${race.difficulty}. ${desc}`;
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function embedBatch(texts: string[], retries = 3): Promise<number[][]> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({ model: MODEL, input: texts }),
      });

      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Fireworks API error ${res.status}: ${body}`);
      }

      const json = (await res.json()) as {
        data: { embedding: number[] }[];
      };
      return json.data.map((d) => d.embedding);
    } catch (err) {
      if (attempt < retries) {
        const delay = attempt * 2000;
        console.warn(`  Retry ${attempt}/${retries} after error: ${(err as Error).message}. Waiting ${delay}ms...`);
        await sleep(delay);
      } else {
        throw err;
      }
    }
  }
  throw new Error("unreachable");
}

async function main() {
  const racesPath = resolve(import.meta.dirname, "..", "src", "data", "races.json");
  const races: Race[] = JSON.parse(readFileSync(racesPath, "utf-8"));
  const total = races.length;

  console.log(`Loaded ${total} races from races.json`);

  const results: EmbeddingResult[] = [];
  const startTime = Date.now();

  for (let i = 0; i < total; i += BATCH_SIZE) {
    const batch = races.slice(i, i + BATCH_SIZE);
    const texts = batch.map(buildText);

    const batchStart = Date.now();
    const embeddings = await embedBatch(texts);
    const batchMs = Date.now() - batchStart;

    for (let j = 0; j < batch.length; j++) {
      results.push({
        id: batch[j].id,
        text: texts[j],
        embedding: embeddings[j],
        metadata: {
          name: batch[j].name,
          city: batch[j].city,
          state: batch[j].state,
          distance: batch[j].distance,
          difficulty: batch[j].difficulty,
          date: batch[j].date,
        },
      });
    }

    const done = Math.min(i + BATCH_SIZE, total);
    const avgMs = Math.round(batchMs / batch.length);
    console.log(`Embedded ${done}/${total} races... (avg ${avgMs}ms per race, batch ${batchMs}ms)`);
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  const dim = results[0]?.embedding.length ?? 0;

  const outPath = resolve(import.meta.dirname, "..", "data", "race-embeddings.json");
  writeFileSync(outPath, JSON.stringify(results, null, 2));

  console.log(`\nDone! ${results.length} embeddings saved to data/race-embeddings.json`);
  console.log(`Total time: ${totalTime}s | Embedding dimension: ${dim}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
