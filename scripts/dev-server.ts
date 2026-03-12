/**
 * Local dev server that runs the /api/search endpoint
 * alongside Vite's dev server via proxy.
 *
 * Usage: npm run dev:api
 * Then run `npm run dev` in another terminal — Vite proxies /api to this server.
 */
import express from "express";
import { readFileSync } from "fs";
import { resolve } from "path";
import { config } from "dotenv";

config({ path: resolve(import.meta.dirname, "..", ".env") });

const FIREWORKS_API_KEY = process.env.FIREWORKS_API_KEY;
const EMBED_ENDPOINT = "https://api.fireworks.ai/inference/v1/embeddings";
const EMBED_MODEL = "nomic-ai/nomic-embed-text-v1.5";
const CHAT_ENDPOINT = "https://api.fireworks.ai/inference/v1/chat/completions";
const CHAT_MODEL = "accounts/fireworks/models/llama-v3p3-70b-instruct";
const TOP_K = 5;

// ── Types ──

interface RaceEmbedding {
  id: string;
  text: string;
  embedding: number[];
  metadata: RaceMetadata;
}

interface RaceMetadata {
  name: string;
  city: string;
  state: string;
  distance: string;
  difficulty: string;
  date: string;
}

interface ScoredRace {
  race: RaceEmbedding;
  score: number;
}

interface ToolCall {
  name: string;
  parameters: Record<string, string>;
}

// ── Tool definitions ──

const TOOL_DEFINITIONS = [
  {
    type: "function" as const,
    function: {
      name: "semantic_search",
      description:
        "Search races by vibe, theme, or natural language description. Use for subjective or exploratory queries.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Natural language search query" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "filter_races",
      description:
        "Filter races by exact criteria like distance, state, difficulty level, or month. Use for specific factual queries.",
      parameters: {
        type: "object",
        properties: {
          distance: { type: "string", description: "Race distance, e.g. 5K, 10K, Half Marathon, Marathon, Ultra" },
          state: { type: "string", description: "US state abbreviation, e.g. WA, OR, CA" },
          difficulty: { type: "string", description: "Difficulty level: Easy, Moderate, or Challenging" },
          month: { type: "string", description: "Month name, e.g. January, February" },
        },
        required: [],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "compare_races",
      description:
        "Compare two specific races side by side. Use when user asks to compare or choose between named races.",
      parameters: {
        type: "object",
        properties: {
          race_name_1: { type: "string", description: "First race name" },
          race_name_2: { type: "string", description: "Second race name" },
        },
        required: ["race_name_1", "race_name_2"],
      },
    },
  },
];

// ── Load embeddings at startup ──

const embeddingsPath = resolve(import.meta.dirname, "..", "data", "race-embeddings.json");
console.log("Loading race embeddings...");
const embeddings: RaceEmbedding[] = JSON.parse(readFileSync(embeddingsPath, "utf-8"));
console.log(`Loaded ${embeddings.length} race embeddings`);

// ── Utilities ──

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

async function embedQuery(query: string): Promise<number[]> {
  const res = await fetch(EMBED_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${FIREWORKS_API_KEY}` },
    body: JSON.stringify({ model: EMBED_MODEL, input: [query] }),
  });
  if (!res.ok) throw new Error(`Embedding API error ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { data: { embedding: number[] }[] };
  return json.data[0].embedding;
}

async function chatCompletion(
  messages: { role: string; content: string }[],
  tools?: typeof TOOL_DEFINITIONS
): Promise<string> {
  const body: Record<string, unknown> = { model: CHAT_MODEL, messages, max_tokens: 512, temperature: 0.7 };
  if (tools) { body.tools = tools; body.tool_choice = "auto"; }

  const res = await fetch(CHAT_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${FIREWORKS_API_KEY}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Chat API error ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as {
    choices: { message: { content: string; tool_calls?: { function: { name: string; arguments: string } }[] } }[];
  };
  const msg = json.choices[0].message;
  if (msg.tool_calls && msg.tool_calls.length > 0) {
    const tc = msg.tool_calls[0].function;
    return JSON.stringify({ type: "function", name: tc.name, parameters: JSON.parse(tc.arguments) });
  }
  return msg.content;
}

function fuzzyMatch(name: string, candidates: RaceEmbedding[]): RaceEmbedding | null {
  const lower = name.toLowerCase().trim();
  const exact = candidates.find((r) => r.metadata.name.toLowerCase().includes(lower));
  if (exact) return exact;
  const queryWords = lower.split(/\s+/);
  let best: RaceEmbedding | null = null;
  let bestScore = 0;
  for (const r of candidates) {
    const raceWords = r.metadata.name.toLowerCase().split(/\s+/);
    const overlap = queryWords.filter((w) => raceWords.some((rw) => rw.includes(w) || w.includes(rw))).length;
    const score = overlap / Math.max(queryWords.length, 1);
    if (score > bestScore) { bestScore = score; best = r; }
  }
  return bestScore >= 0.3 ? best : null;
}

function parseMonth(month: string): number | null {
  const months: Record<string, number> = {
    january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
    july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
    jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  };
  return months[month.toLowerCase().trim()] || null;
}

function getRaceMonth(dateStr: string): number | null {
  if (dateStr.includes("/")) return parseInt(dateStr.split("/")[0]) || null;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d.getMonth() + 1;
}

// ── Tool implementations ──

async function toolSemanticSearch(query: string): Promise<{ races: ScoredRace[]; embedding_ms: number; search_ms: number }> {
  const embedStart = Date.now();
  const queryEmbedding = await embedQuery(query);
  const embedding_ms = Date.now() - embedStart;
  const searchStart = Date.now();
  const scored = embeddings.map((race) => ({ race, score: cosineSimilarity(queryEmbedding, race.embedding) }));
  scored.sort((a, b) => b.score - a.score);
  const search_ms = Date.now() - searchStart;
  return { races: scored.slice(0, TOP_K), embedding_ms, search_ms };
}

function toolFilterRaces(args: { distance?: string; state?: string; difficulty?: string; month?: string }): ScoredRace[] {
  const filtered = embeddings.filter((r) => {
    if (args.distance && !(r.metadata.distance || "").toLowerCase().includes(args.distance.toLowerCase())) return false;
    if (args.state && (r.metadata.state || "").toUpperCase() !== args.state.toUpperCase()) return false;
    if (args.difficulty && (r.metadata.difficulty || "").toLowerCase() !== args.difficulty.toLowerCase()) return false;
    if (args.month) {
      const targetMonth = parseMonth(args.month);
      const raceMonth = getRaceMonth(r.metadata.date);
      if (targetMonth && raceMonth && targetMonth !== raceMonth) return false;
    }
    return true;
  });
  return filtered.slice(0, TOP_K).map((race) => ({ race, score: 1 }));
}

function toolCompareRaces(name1: string, name2: string): ScoredRace[] {
  const results: ScoredRace[] = [];
  const race1 = fuzzyMatch(name1, embeddings);
  const race2 = fuzzyMatch(name2, embeddings);
  if (race1) results.push({ race: race1, score: 1 });
  if (race2) results.push({ race: race2, score: 1 });
  return results;
}

function parseToolCall(content: string): ToolCall | null {
  try {
    const parsed = JSON.parse(content.trim());
    if (parsed.name && parsed.parameters !== undefined) {
      return { name: parsed.name, parameters: parsed.parameters || {} };
    }
  } catch { /* not JSON */ }
  return null;
}

// ── Express server ──

const app = express();
app.use(express.json());

app.post("/api/search", async (req, res) => {
  if (!FIREWORKS_API_KEY) return res.status(500).json({ error: "FIREWORKS_API_KEY not configured." });

  const { query } = req.body || {};
  if (!query || typeof query !== "string" || query.trim().length === 0) {
    return res.status(400).json({ error: "Missing or empty 'query' field." });
  }

  const userQuery = query.trim();
  const totalStart = Date.now();

  try {
    // Step 1: Route to tool
    const routingStart = Date.now();
    const routingResponse = await chatCompletion([{ role: "user", content: userQuery }], TOOL_DEFINITIONS);
    const routingMs = Date.now() - routingStart;

    const toolCall = parseToolCall(routingResponse);

    let toolUsed = "semantic_search";
    let toolArgs: Record<string, string> = { query: userQuery };
    let matchedRaces: ScoredRace[] = [];
    let embedding_ms = 0;
    let search_ms = 0;

    if (toolCall) {
      toolUsed = toolCall.name;
      toolArgs = toolCall.parameters;
      const toolStart = Date.now();

      switch (toolCall.name) {
        case "semantic_search": {
          const result = await toolSemanticSearch(toolCall.parameters.query || userQuery);
          matchedRaces = result.races;
          embedding_ms = result.embedding_ms;
          search_ms = result.search_ms;
          break;
        }
        case "filter_races": {
          matchedRaces = toolFilterRaces(toolCall.parameters);
          search_ms = Date.now() - toolStart;
          break;
        }
        case "compare_races": {
          matchedRaces = toolCompareRaces(toolCall.parameters.race_name_1 || "", toolCall.parameters.race_name_2 || "");
          search_ms = Date.now() - toolStart;
          break;
        }
        default: {
          toolUsed = "semantic_search (fallback)";
          const result = await toolSemanticSearch(userQuery);
          matchedRaces = result.races;
          embedding_ms = result.embedding_ms;
          search_ms = result.search_ms;
        }
      }
    } else {
      toolUsed = "semantic_search (fallback)";
      const result = await toolSemanticSearch(userQuery);
      matchedRaces = result.races;
      embedding_ms = result.embedding_ms;
      search_ms = result.search_ms;
    }

    // Step 2: Generate answer
    const raceContext = matchedRaces.length > 0
      ? matchedRaces.map(({ race, score }, i) =>
          `${i + 1}. ${race.metadata.name} — ${race.metadata.distance} in ${race.metadata.city}, ${race.metadata.state} on ${race.metadata.date} (${race.metadata.difficulty})${score < 1 ? ` [similarity: ${score.toFixed(3)}]` : ""}`
        ).join("\n")
      : "No matching races found.";

    const systemPrompt = toolUsed.startsWith("compare")
      ? "You are a friendly running race advisor. Compare the races provided side by side, highlighting differences in distance, difficulty, location, and date. Be concise and helpful."
      : "You are a friendly running race advisor. Based on the race data provided, answer the user's question concisely. Mention specific race names, dates, and locations. If no races match well, say so honestly.";

    const llmStart = Date.now();
    const answer = await chatCompletion([
      { role: "system", content: systemPrompt },
      { role: "user", content: `Tool used: ${toolUsed}\nTool args: ${JSON.stringify(toolArgs)}\n\nResults:\n${raceContext}\n\nUser question: ${userQuery}` },
    ]);
    const llmMs = Date.now() - llmStart;
    const totalMs = Date.now() - totalStart;

    const latency = { routing_ms: routingMs, embedding_ms, search_ms, llm_ms: llmMs, total_ms: totalMs };

    console.log(`[search] query="${userQuery}" tool=${toolUsed} args=${JSON.stringify(toolArgs)} | routing=${routingMs}ms embed=${embedding_ms}ms search=${search_ms}ms llm=${llmMs}ms total=${totalMs}ms`);

    return res.json({
      answer,
      tool_used: toolUsed,
      tool_args: toolArgs,
      races: matchedRaces.map(({ race, score }) => ({
        id: race.id,
        score: Math.round(score * 1000) / 1000,
        metadata: race.metadata,
      })),
      latency,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[search] error: ${message}`);
    return res.status(500).json({ error: message });
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`\nAPI server running at http://localhost:${PORT}`);
  console.log(`POST http://localhost:${PORT}/api/search`);
  console.log(`\nMake sure Vite dev server is running (npm run dev) on port 8080\n`);
});
