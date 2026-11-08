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
// Fireworks retired the Llama 3.x serverless models in late 2026; gpt-oss-120b is the current base.
const CHAT_MODEL_ROUTING = process.env.FIREWORKS_ROUTING_MODEL || "accounts/fireworks/models/gpt-oss-120b";
const CHAT_MODEL_ANSWER = process.env.FIREWORKS_ANSWER_MODEL || CHAT_MODEL_ROUTING;
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
  distances?: string[];
}

interface ToolCall {
  name: string;
  parameters: Record<string, string>;
}

// ── Canonical vocab (duplicated verbatim in api/search.ts and scripts/dev-server.ts — keep in sync) ──

type DistanceClass =
  | "Kids / Fun Run"
  | "5K"
  | "8K"
  | "10K"
  | "15K"
  | "Half Marathon"
  | "Marathon"
  | "50K"
  | "50 Miles"
  | "100K"
  | "100 Miles"
  | "Ultra"
  | "Other";

const DISTANCE_ENUM: DistanceClass[] = [
  "Kids / Fun Run", "5K", "8K", "10K", "15K", "Half Marathon", "Marathon",
  "50K", "50 Miles", "100K", "100 Miles", "Ultra",
];

// Scraper emits Beginner / Easy / Moderate / Extreme. Older UI copy used Easy / Moderate / Challenging.
const DIFFICULTY_ENUM = ["Beginner", "Easy", "Moderate", "Extreme"];

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
        "Filter races by exact criteria: distance class, state, city, difficulty, month/season, or a keyword in the race name. Use for specific factual queries. Combine several criteria in one call.",
      parameters: {
        type: "object",
        properties: {
          distance: {
            type: "string",
            enum: DISTANCE_ENUM,
            description:
              "Canonical distance class. Map user words: 5k -> 5K; 10k -> 10K; half / half marathon / 13.1 -> Half Marathon; marathon / full / 26.2 -> Marathon; 50k -> 50K; 100k -> 100K; 50 miles -> 50 Miles; 100 miles -> 100 Miles; ultra or ultramarathon with no distance -> Ultra; kids / fun run / 1 mile -> Kids / Fun Run. Terrain words like trail are not distances: put them in keyword instead.",
          },
          state: {
            type: "string",
            description: "US state abbreviation, e.g. WA, OR, CA",
          },
          city: {
            type: "string",
            description: "City name when the user names one, e.g. Seattle, Portland. Omit when only a state is mentioned.",
          },
          difficulty: {
            type: "string",
            enum: DIFFICULTY_ENUM,
            description:
              "Beginner (beginner-friendly, first-timers), Easy (gentle, relaxed), Moderate (intermediate), Extreme (challenging, hard, tough).",
          },
          month: {
            type: "string",
            description:
              "When the race happens: a month name or abbreviation (October, Oct), a season (spring, summer, fall, autumn, winter), a relative term (this fall, this month, next month) or a range (September to November). Pass the user's own words.",
          },
          keyword: {
            type: "string",
            description: "A word that must appear in the race name, e.g. trail, turkey trot, relay, night, virtual.",
          },
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
  tools?: typeof TOOL_DEFINITIONS,
  model: string = CHAT_MODEL_ROUTING
): Promise<string> {
  const body: Record<string, unknown> = { model, messages, max_tokens: 512, temperature: 0.7 };
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
  const lower = name.toLowerCase().replace(/\s+/g, " ").trim();
  if (!lower) return null;
  // Exact substring match first
  const exact = candidates.find((r) => r.metadata.name.toLowerCase().replace(/\s+/g, " ").includes(lower));
  if (exact) return exact;
  // Word overlap scoring (ignore empty/short tokens; a city match counts as a bonus)
  const queryWords = lower.split(/[^a-z0-9.]+/).filter((w) => w.length >= 2);
  if (queryWords.length === 0) return null;
  const wordMatches = (w: string, rw: string) =>
    rw === w || (w.length >= 4 && rw.length >= 4 && (rw.startsWith(w) || w.startsWith(rw)));
  let best: RaceEmbedding | null = null;
  let bestScore = 0;
  for (const r of candidates) {
    const raceWords = r.metadata.name.toLowerCase().split(/[^a-z0-9.]+/).filter((w) => w.length >= 2);
    const overlap = queryWords.filter((w) => raceWords.some((rw) => wordMatches(w, rw))).length;
    let score = overlap / queryWords.length;
    const city = (r.metadata.city || "").toLowerCase();
    if (city && queryWords.includes(city)) score += 0.5;
    if (score > bestScore) {
      bestScore = score;
      best = r;
    }
  }
  return bestScore >= 0.5 ? best : null;
}

// ── Normalizers (this block is duplicated verbatim in api/search.ts and scripts/dev-server.ts — keep in sync) ──


const ULTRA_CLASSES = new Set<DistanceClass>(["50K", "50 Miles", "100K", "100 Miles", "Ultra"]);

// Exact user/model terms → class. Keys are normalized (lowercase, single spaces, no trailing run/race).
const DISTANCE_TERMS: Record<string, DistanceClass> = {
  "kids / fun run": "Kids / Fun Run", "kids": "Kids / Fun Run", "kids run": "Kids / Fun Run",
  "fun run": "Kids / Fun Run", "mile": "Kids / Fun Run", "1 mile": "Kids / Fun Run",
  "one mile": "Kids / Fun Run", "1 miler": "Kids / Fun Run", "1k": "Kids / Fun Run",
  "5k": "5K", "5km": "5K", "3.1": "5K", "3.1 miles": "5K",
  "8k": "8K", "5 mile": "8K", "5 miler": "8K", "5 miles": "8K",
  "10k": "10K", "10km": "10K", "6.2": "10K", "6.2 miles": "10K", "12k": "10K",
  "15k": "15K", "10 mile": "15K", "10 miler": "15K", "10 miles": "15K", "9.3": "15K",
  "half": "Half Marathon", "half marathon": "Half Marathon", "half-marathon": "Half Marathon",
  "13.1": "Half Marathon", "13.1 miles": "Half Marathon", "21k": "Half Marathon", "21.1k": "Half Marathon", "hm": "Half Marathon",
  "marathon": "Marathon", "full": "Marathon", "full marathon": "Marathon", "road marathon": "Marathon",
  "26.2": "Marathon", "26.2 miles": "Marathon", "42k": "Marathon", "42.2k": "Marathon",
  "50k": "50K", "50 km": "50K", "31 miles": "50K",
  "50 miles": "50 Miles", "50 mile": "50 Miles", "50 miler": "50 Miles",
  "100k": "100K", "100 km": "100K", "62 miles": "100K",
  "100 miles": "100 Miles", "100 mile": "100 Miles", "100 miler": "100 Miles", "hundred": "100 Miles",
  "ultra": "Ultra", "ultras": "Ultra", "ultramarathon": "Ultra", "ultra marathon": "Ultra", "ultra-marathon": "Ultra",
};

/** Parse a dataset distance string ("13.1 Miles", "50K", "400m", "9977.91m") into miles. */
function distanceToMiles(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const m = raw.trim().toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(k|km|kms|kilometers?|m|meters?|metres?|mi|mile|miles|miler|yards?|yds?)?$/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  if (!isFinite(n) || n <= 0) return null;
  const unit = m[2] || "miles";
  if (/^k/.test(unit)) return n * 0.621371;
  if (/^(m|meters?|metres?)$/.test(unit)) return (n / 1000) * 0.621371;
  if (/^y/.test(unit)) return n / 1760;
  return n;
}

function classifyMiles(mi: number): DistanceClass {
  if (mi < 2.5) return "Kids / Fun Run";
  if (mi < 4) return "5K";
  if (mi < 5.6) return "8K";
  if (mi < 8) return "10K";
  if (mi < 11) return "15K";
  if (mi < 12) return "Other";
  if (mi < 15.5) return "Half Marathon";
  if (mi < 24) return "Other";
  if (mi <= 27.5) return "Marathon";
  if (mi <= 35) return "50K";
  if (mi < 45) return "Ultra";
  if (mi <= 56) return "50 Miles";
  if (mi <= 70) return "100K";
  if (mi < 90) return "Ultra";
  if (mi <= 110) return "100 Miles";
  return "Ultra";
}

/** Canonical class for a dataset distance string, or null when the row has no usable distance. */
function classifyRaceDistance(raw: string | null | undefined): DistanceClass | null {
  const mi = distanceToMiles(raw);
  return mi === null ? null : classifyMiles(mi);
}

/** Canonical class for a user/model distance term, or null when the term is not a distance (e.g. "trail"). */
function normalizeDistanceTerm(term: string): DistanceClass | null {
  const t = term.toLowerCase().replace(/[\s_]+/g, " ").replace(/\s*(run|race|races|runs|distance)$/g, "").trim();
  if (!t) return null;
  if (DISTANCE_TERMS[t]) return DISTANCE_TERMS[t];
  const exact = DISTANCE_ENUM.find((c) => c.toLowerCase() === t);
  if (exact) return exact;
  const mi = distanceToMiles(t);
  return mi === null ? null : classifyMiles(mi);
}

function distanceClassMatches(query: DistanceClass, race: DistanceClass | null): boolean {
  if (!race) return false;
  if (query === race) return true;
  return query === "Ultra" && ULTRA_CLASSES.has(race);
}

// Months and seasons
const MONTH_NAMES: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};
const SEASONS: Record<string, number[]> = {
  spring: [3, 4, 5], summer: [6, 7, 8], fall: [9, 10, 11], autumn: [9, 10, 11],
  winter: [12, 1, 2], holiday: [11, 12], holidays: [11, 12], christmas: [12], thanksgiving: [11],
};

/**
 * Parse a month expression into a set of month numbers (1–12).
 * Accepts month names/abbreviations ("October", "oct"), seasons ("fall", "this autumn"),
 * relative terms ("this month", "next month"), lists ("Oct, Nov") and ranges ("September to November").
 * Returns null when nothing parseable is found (the filter is then skipped).
 */
function parseMonths(term: string, now: Date = new Date()): Set<number> | null {
  const out = new Set<number>();
  let t = term.toLowerCase().trim();
  if (!t) return null;
  if (/\bnext month\b/.test(t)) out.add(((now.getMonth() + 1) % 12) + 1);
  if (/\b(this|current) month\b/.test(t)) out.add(now.getMonth() + 1);
  t = t.replace(/\b(this|next|coming|upcoming|early|late|mid|in|of|the|season|month|current|year)\b/g, " ");
  t = t.replace(/\b(through|thru|until|till|to)\b|[-–—]/g, " to ");
  const tokens = t.split(/[\s,/&]+|\band\b|\bor\b/).filter(Boolean);
  let pendingRangeStart: number | null = null;
  let expectRangeEnd = false;
  for (const tok of tokens) {
    if (tok === "to") { expectRangeEnd = pendingRangeStart !== null; continue; }
    const month = MONTH_NAMES[tok] ?? MONTH_NAMES[tok.replace(/\.$/, "")];
    if (month) {
      if (expectRangeEnd && pendingRangeStart !== null) {
        for (let m: number = pendingRangeStart; ; m = (m % 12) + 1) { out.add(m); if (m === month) break; }
        expectRangeEnd = false;
      } else {
        out.add(month);
      }
      pendingRangeStart = month;
      continue;
    }
    if (SEASONS[tok]) { for (const m of SEASONS[tok]) out.add(m); pendingRangeStart = null; expectRangeEnd = false; }
  }
  return out.size > 0 ? out : null;
}

function getRaceMonth(dateStr: string): number | null {
  if (!dateStr) return null;
  if (dateStr.includes("/")) return parseInt(dateStr.split("/")[0]) || null;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d.getMonth() + 1;
}

function raceDateValue(dateStr: string): number {
  if (!dateStr) return Number.MAX_SAFE_INTEGER;
  if (dateStr.includes("/")) {
    const [m, d, y] = dateStr.split("/").map((p) => parseInt(p));
    if (m && d && y) return new Date(y, m - 1, d).getTime();
  }
  const t = new Date(dateStr).getTime();
  return isNaN(t) ? Number.MAX_SAFE_INTEGER : t;
}

// Difficulty synonyms
const DIFFICULTY_TERMS: Record<string, string[]> = {
  beginner: ["Beginner"], "beginner friendly": ["Beginner"], "beginner-friendly": ["Beginner"],
  novice: ["Beginner"], "first timer": ["Beginner"], "first-timer": ["Beginner"], "first time": ["Beginner"],
  "beginner/easy": ["Beginner", "Easy"], "easy/beginner": ["Beginner", "Easy"],
  easy: ["Easy"], gentle: ["Easy"], relaxed: ["Easy"], casual: ["Easy"], flat: ["Easy"], fun: ["Easy"],
  moderate: ["Moderate"], intermediate: ["Moderate"], medium: ["Moderate"], average: ["Moderate"],
  extreme: ["Extreme"], challenging: ["Extreme"], hard: ["Extreme"], difficult: ["Extreme"],
  tough: ["Extreme"], advanced: ["Extreme"], brutal: ["Extreme"], hilly: ["Extreme"], expert: ["Extreme"],
};

/** Map a user/model difficulty term onto the dataset's values, or null when unrecognized (filter skipped). */
function normalizeDifficulty(term: string): Set<string> | null {
  const t = term.toLowerCase().replace(/\s+/g, " ").trim();
  if (!t) return null;
  if (DIFFICULTY_TERMS[t]) return new Set(DIFFICULTY_TERMS[t]);
  const exact = DIFFICULTY_ENUM.find((d) => d.toLowerCase() === t);
  if (exact) return new Set([exact]);
  for (const [k, v] of Object.entries(DIFFICULTY_TERMS)) if (t.includes(k)) return new Set(v);
  return null;
}

// ── Dedup: the scraper emits one row per distance; collapse by name + date + city ──

function raceKey(m: RaceMetadata): string {
  return `${(m.name || "").trim().toLowerCase()}|${m.date || ""}|${(m.city || "").trim().toLowerCase()}`;
}

let distanceIndex: Map<string, string[]> | null = null;
let distanceIndexSource: RaceEmbedding[] | null = null;

/** All distinct distances offered by a race (across its duplicate rows), shortest first. */
function distancesForKey(key: string, embeddings: RaceEmbedding[]): string[] {
  if (!distanceIndex || distanceIndexSource !== embeddings) {
    distanceIndex = new Map();
    distanceIndexSource = embeddings;
    for (const r of embeddings) {
      const k = raceKey(r.metadata);
      const list = distanceIndex.get(k) || [];
      const d = r.metadata.distance;
      if (d && !list.includes(d)) list.push(d);
      distanceIndex.set(k, list);
    }
    for (const list of distanceIndex.values()) {
      list.sort((a, b) => (distanceToMiles(a) ?? Infinity) - (distanceToMiles(b) ?? Infinity));
    }
  }
  return distanceIndex.get(key) || [];
}

/** Collapse duplicate rows, keeping the best score per race and attaching every distance it offers. Preserves order of first appearance. */
function dedupeRaces(scored: ScoredRace[], embeddings: RaceEmbedding[]): ScoredRace[] {
  const seen = new Map<string, ScoredRace>();
  const order: ScoredRace[] = [];
  for (const s of scored) {
    const key = raceKey(s.race.metadata);
    const prev = seen.get(key);
    if (prev) {
      if (s.score > prev.score) { prev.score = s.score; prev.race = s.race; }
      continue;
    }
    const entry: ScoredRace = { race: s.race, score: s.score, distances: distancesForKey(key, embeddings) };
    seen.set(key, entry);
    order.push(entry);
  }
  return order;
}

// ── Tool implementations ──

async function toolSemanticSearch(
  query: string,
  embeddings: RaceEmbedding[]
): Promise<{ races: ScoredRace[]; embedding_ms: number; search_ms: number }> {
  const embedStart = Date.now();
  const queryEmbedding = await embedQuery(query);
  const embedding_ms = Date.now() - embedStart;

  const searchStart = Date.now();
  const scored = embeddings.map((race) => ({
    race,
    score: cosineSimilarity(queryEmbedding, race.embedding),
  }));
  scored.sort((a, b) => b.score - a.score);
  const races = dedupeRaces(scored, embeddings).slice(0, TOP_K);
  const search_ms = Date.now() - searchStart;

  return { races, embedding_ms, search_ms };
}

interface FilterArgs {
  distance?: string;
  state?: string;
  city?: string;
  difficulty?: string;
  month?: string;
  keyword?: string;
  relaxed?: string;
}

function toolFilterRaces(args: FilterArgs, embeddings: RaceEmbedding[]): ScoredRace[] {
  // Normalize once; unrecognized values are dropped rather than returning zero results.
  const distanceClass = args.distance ? normalizeDistanceTerm(args.distance) : null;
  const keywords: string[] = [];
  if (args.keyword) keywords.push(args.keyword.toLowerCase().trim());
  if (args.distance && !distanceClass) keywords.push(args.distance.toLowerCase().trim()); // e.g. "trail" — not a distance
  const months = args.month ? parseMonths(args.month) : null;
  const difficulties = args.difficulty ? normalizeDifficulty(args.difficulty) : null;
  const state = args.state ? args.state.trim().toUpperCase() : null;
  const city = args.city ? args.city.trim().toLowerCase() : null;

  const filtered = embeddings.filter((r) => {
    const m = r.metadata;
    if (distanceClass && !distanceClassMatches(distanceClass, classifyRaceDistance(m.distance))) return false;
    if (state && (m.state || "").toUpperCase() !== state) return false;
    if (city && !(m.city || "").toLowerCase().includes(city)) return false;
    if (difficulties && !difficulties.has(m.difficulty || "")) return false;
    if (months) {
      const raceMonth = getRaceMonth(m.date);
      if (raceMonth && !months.has(raceMonth)) return false;
    }
    if (keywords.length > 0) {
      const name = (m.name || "").toLowerCase();
      if (!keywords.every((k) => k && name.includes(k))) return false;
    }
    return true;
  });

  // Soft criteria: when the strict filter is empty, relax city ("near Portland" → the whole state), then difficulty.
  // Each relaxation is recorded in args.relaxed so the answer model (and the UI) can see what was dropped.
  if (filtered.length === 0 && city) {
    // Keep the search local: if no state was given, inherit the state(s) that city belongs to.
    if (!state) {
      const states = new Set(
        embeddings.filter((r) => (r.metadata.city || "").toLowerCase().includes(city)).map((r) => (r.metadata.state || "").toUpperCase()).filter(Boolean)
      );
      if (states.size === 1) args.state = [...states][0];
    }
    delete args.city;
    args.relaxed = [args.relaxed, "city (no exact matches, widened to the state)"].filter(Boolean).join("; ");
    return toolFilterRaces(args, embeddings);
  }
  if (filtered.length === 0 && difficulties) {
    delete args.difficulty;
    args.relaxed = [args.relaxed, "difficulty (no exact matches, showing all difficulty levels)"].filter(Boolean).join("; ");
    return toolFilterRaces(args, embeddings);
  }

  filtered.sort((a, b) => raceDateValue(a.metadata.date) - raceDateValue(b.metadata.date));
  return dedupeRaces(filtered.map((race) => ({ race, score: 1 })), embeddings).slice(0, TOP_K);
}

function toolCompareRaces(
  name1: string,
  name2: string,
  embeddings: RaceEmbedding[]
): ScoredRace[] {
  const race1 = fuzzyMatch(name1, embeddings);
  const race2 = fuzzyMatch(name2, embeddings);
  const results: ScoredRace[] = [];
  if (race1) results.push({ race: race1, score: 1 });
  if (race2) results.push({ race: race2, score: 1 });
  return dedupeRaces(results, embeddings);
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
          const result = await toolSemanticSearch(toolCall.parameters.query || userQuery, embeddings);
          matchedRaces = result.races;
          embedding_ms = result.embedding_ms;
          search_ms = result.search_ms;
          break;
        }
        case "filter_races": {
          matchedRaces = toolFilterRaces(toolCall.parameters, embeddings);
          search_ms = Date.now() - toolStart;
          break;
        }
        case "compare_races": {
          matchedRaces = toolCompareRaces(toolCall.parameters.race_name_1 || "", toolCall.parameters.race_name_2 || "", embeddings);
          search_ms = Date.now() - toolStart;
          break;
        }
        default: {
          toolUsed = "semantic_search (fallback)";
          const result = await toolSemanticSearch(userQuery, embeddings);
          matchedRaces = result.races;
          embedding_ms = result.embedding_ms;
          search_ms = result.search_ms;
        }
      }
    } else {
      toolUsed = "semantic_search (fallback)";
      const result = await toolSemanticSearch(userQuery, embeddings);
      matchedRaces = result.races;
      embedding_ms = result.embedding_ms;
      search_ms = result.search_ms;
    }

    // Step 2: Generate answer
    const raceContext = matchedRaces.length > 0
      ? matchedRaces.map(({ race, score, distances }, i) =>
          `${i + 1}. ${race.metadata.name} — ${distances && distances.length > 0 ? distances.join(" / ") : race.metadata.distance || "distance TBD"} in ${race.metadata.city}, ${race.metadata.state} on ${race.metadata.date} (${race.metadata.difficulty})${score < 1 ? ` [similarity: ${score.toFixed(3)}]` : ""}`
        ).join("\n")
      : "No matching races found.";

    const systemPrompt = toolUsed.startsWith("compare")
      ? "You are a friendly running race advisor. Compare the races provided side by side, highlighting differences in distance, difficulty, location, and date. Be concise and helpful. Reply in plain text only: no markdown, no asterisks, no tables, no headings. Short paragraphs or simple dash bullets are fine."
      : "You are a friendly running race advisor. Based on the race data provided, answer the user's question concisely. Mention specific race names, dates, and locations. If no races match well, say so honestly. Reply in plain text only: no markdown, no asterisks, no tables, no headings. Short paragraphs or simple dash bullets are fine.";

    const llmStart = Date.now();
    const answer = await chatCompletion(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Tool used: ${toolUsed}\nTool args: ${JSON.stringify(toolArgs)}\n\nResults:\n${raceContext}\n\nUser question: ${userQuery}` },
      ],
      undefined,
      CHAT_MODEL_ANSWER
    );
    const llmMs = Date.now() - llmStart;
    const totalMs = Date.now() - totalStart;

    const latency = { routing_ms: routingMs, embedding_ms, search_ms, llm_ms: llmMs, total_ms: totalMs };

    console.log(`[search] query="${userQuery}" tool=${toolUsed} args=${JSON.stringify(toolArgs)} | routing=${routingMs}ms embed=${embedding_ms}ms search=${search_ms}ms llm=${llmMs}ms total=${totalMs}ms`);

    return res.json({
      answer,
      tool_used: toolUsed,
      tool_args: toolArgs,
      model: CHAT_MODEL_ANSWER,
      is_finetuned: true,
      races: matchedRaces.map(({ race, score, distances }) => ({
        id: race.id,
        score: Math.round(score * 1000) / 1000,
        metadata: race.metadata,
        distances: distances || [],
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
