/**
 * Performance & Reliability Test Suite for Run Down AI Search
 *
 * 50 queries across semantic, filter, compare, edge cases, and stress tests.
 * Measures latency, tool routing accuracy, error rates, and consistency.
 *
 * Usage:
 *   npx tsx scripts/test-performance.ts              # test against live site
 *   npx tsx scripts/test-performance.ts local         # test against localhost:3001
 */

const TARGET = process.argv[2] === "local"
  ? "http://localhost:3001/api/search"
  : "https://run-down.vercel.app/api/search";

interface SearchResponse {
  answer: string;
  tool_used: string;
  tool_args: Record<string, string>;
  races: { id: string; score: number; metadata: Record<string, string> }[];
  latency: {
    routing_ms: number;
    embedding_ms: number;
    search_ms: number;
    llm_ms: number;
    total_ms: number;
  };
  error?: string;
}

interface TestCase {
  query: string;
  expectedTool: string;
  category: string;
}

interface TestResult {
  index: number;
  query: string;
  category: string;
  expectedTool: string;
  actualTool: string;
  toolCorrect: boolean;
  toolArgs: Record<string, string>;
  racesReturned: number;
  latency: SearchResponse["latency"];
  answerLength: number;
  hasAnswer: boolean;
  httpStatus: number;
  error?: string;
}

const TEST_CASES: TestCase[] = [
  // ── Semantic Search (15 queries) ──────────────────────────────────────
  { query: "scenic trail race through mountains", expectedTool: "semantic_search", category: "Semantic" },
  { query: "beginner-friendly fun run with good vibes", expectedTool: "semantic_search", category: "Semantic" },
  { query: "challenging ultra in the desert heat", expectedTool: "semantic_search", category: "Semantic" },
  { query: "flat and fast course for a personal record", expectedTool: "semantic_search", category: "Semantic" },
  { query: "race along the beach at sunrise", expectedTool: "semantic_search", category: "Semantic" },
  { query: "family friendly race with kids activities", expectedTool: "semantic_search", category: "Semantic" },
  { query: "muddy obstacle course race", expectedTool: "semantic_search", category: "Semantic" },
  { query: "winter race in the snow and cold", expectedTool: "semantic_search", category: "Semantic" },
  { query: "charity race for cancer research", expectedTool: "semantic_search", category: "Semantic" },
  { query: "night run or glow run with lights", expectedTool: "semantic_search", category: "Semantic" },
  { query: "downhill race with beautiful views", expectedTool: "semantic_search", category: "Semantic" },
  { query: "race through vineyards or wine country", expectedTool: "semantic_search", category: "Semantic" },
  { query: "run through a national park", expectedTool: "semantic_search", category: "Semantic" },
  { query: "holiday themed race like turkey trot", expectedTool: "semantic_search", category: "Semantic" },
  { query: "race with a good after party and beer", expectedTool: "semantic_search", category: "Semantic" },

  // ── Filter Queries (15 queries) ───────────────────────────────────────
  { query: "half marathons in California", expectedTool: "filter_races", category: "Filter" },
  { query: "easy 5K races in July", expectedTool: "filter_races", category: "Filter" },
  { query: "marathons in Oregon", expectedTool: "filter_races", category: "Filter" },
  { query: "10K races in Texas", expectedTool: "filter_races", category: "Filter" },
  { query: "challenging races in Colorado", expectedTool: "filter_races", category: "Filter" },
  { query: "ultra marathons in Washington state", expectedTool: "filter_races", category: "Filter" },
  { query: "easy races in September", expectedTool: "filter_races", category: "Filter" },
  { query: "5K in New York in March", expectedTool: "filter_races", category: "Filter" },
  { query: "moderate half marathons in November", expectedTool: "filter_races", category: "Filter" },
  { query: "marathon in Florida in January", expectedTool: "filter_races", category: "Filter" },
  { query: "races in Georgia in April", expectedTool: "filter_races", category: "Filter" },
  { query: "10K in Illinois", expectedTool: "filter_races", category: "Filter" },
  { query: "beginner races in Arizona in October", expectedTool: "filter_races", category: "Filter" },
  { query: "half marathon in North Carolina", expectedTool: "filter_races", category: "Filter" },
  { query: "5K races in Ohio in June", expectedTool: "filter_races", category: "Filter" },

  // ── Compare Queries (10 queries) ──────────────────────────────────────
  { query: "compare Boston Marathon and New York Marathon", expectedTool: "compare_races", category: "Compare" },
  { query: "which is harder, Lake Washington Half Marathon or Jack and Jill Marathon", expectedTool: "compare_races", category: "Compare" },
  { query: "differences between Big Sur Marathon and LA Marathon", expectedTool: "compare_races", category: "Compare" },
  { query: "compare Hood to Coast and Ragnar Relay", expectedTool: "compare_races", category: "Compare" },
  { query: "Seattle Marathon vs Portland Marathon which should I run", expectedTool: "compare_races", category: "Compare" },
  { query: "compare Chicago Marathon and Twin Cities Marathon", expectedTool: "compare_races", category: "Compare" },
  { query: "Marine Corps Marathon versus Philadelphia Marathon", expectedTool: "compare_races", category: "Compare" },
  { query: "which is better Honolulu Marathon or Maui Marathon", expectedTool: "compare_races", category: "Compare" },
  { query: "compare Western States 100 and Leadville 100", expectedTool: "compare_races", category: "Compare" },
  { query: "Big Sur Half Marathon vs San Francisco Half Marathon", expectedTool: "compare_races", category: "Compare" },

  // ── Edge Cases & Stress (10 queries) ──────────────────────────────────
  { query: "a", expectedTool: "semantic_search", category: "Edge" },
  { query: "what is the meaning of life", expectedTool: "semantic_search", category: "Edge" },
  { query: "🏃‍♂️🏔️", expectedTool: "semantic_search", category: "Edge" },
  { query: "I want to run a race but I'm scared and have never done one before what should I do", expectedTool: "semantic_search", category: "Edge" },
  { query: "the fastest most elite competitive marathon in the entire united states of america with the best prize money and world record holders", expectedTool: "semantic_search", category: "Edge" },
  { query: "races", expectedTool: "semantic_search", category: "Edge" },
  { query: "compare apples and oranges", expectedTool: "compare_races", category: "Edge" },
  { query: "easy flat 5K in warm weather near the coast in California in December for beginners", expectedTool: "filter_races", category: "Edge" },
  { query: "SELECT * FROM races WHERE difficulty = 'easy'", expectedTool: "semantic_search", category: "Edge" },
  { query: "marathon OR half marathon AND state:CA NOT ultra", expectedTool: "semantic_search", category: "Edge" },
];

const DELAY_MS = 4000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function runQuery(query: string, retries = 3): Promise<{ response: SearchResponse; httpStatus: number }> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(TARGET, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const data = (await res.json()) as SearchResponse;

      if (res.status === 429 || (data.error && (data.error.includes("429") || data.error.includes("rate")))) {
        const wait = (attempt + 1) * 10000;
        console.log(`  ⏳ Rate limited, waiting ${wait / 1000}s (retry ${attempt + 1}/${retries})...`);
        await sleep(wait);
        continue;
      }

      return { response: data, httpStatus: res.status };
    } catch (err) {
      if (attempt < retries - 1) {
        const wait = (attempt + 1) * 5000;
        console.log(`  ⏳ Network error, waiting ${wait / 1000}s (retry ${attempt + 1}/${retries})...`);
        await sleep(wait);
        continue;
      }
      return {
        response: {
          answer: "", tool_used: "", tool_args: {}, races: [],
          latency: { routing_ms: 0, embedding_ms: 0, search_ms: 0, llm_ms: 0, total_ms: 0 },
          error: err instanceof Error ? err.message : String(err),
        },
        httpStatus: 0,
      };
    }
  }
  return {
    response: {
      answer: "", tool_used: "", tool_args: {}, races: [],
      latency: { routing_ms: 0, embedding_ms: 0, search_ms: 0, llm_ms: 0, total_ms: 0 },
      error: "Max retries exceeded",
    },
    httpStatus: 0,
  };
}

function percentile(arr: number[], p: number): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

async function main() {
  const startTime = Date.now();

  console.log("╔═══════════════════════════════════════════════════════════════╗");
  console.log("║     RUN DOWN — AI SEARCH PERFORMANCE & RELIABILITY TEST     ║");
  console.log("╠═══════════════════════════════════════════════════════════════╣");
  console.log(`║  Date:     ${new Date().toISOString().padEnd(49)}║`);
  console.log(`║  Target:   ${TARGET.padEnd(49)}║`);
  console.log(`║  Queries:  ${String(TEST_CASES.length).padEnd(49)}║`);
  console.log(`║  Delay:    ${(DELAY_MS / 1000 + "s between queries").padEnd(49)}║`);
  console.log("╚═══════════════════════════════════════════════════════════════╝\n");

  const results: TestResult[] = [];

  for (let i = 0; i < TEST_CASES.length; i++) {
    if (i > 0) await sleep(DELAY_MS);
    const tc = TEST_CASES[i];
    const shortQuery = tc.query.length > 55 ? tc.query.slice(0, 52) + "..." : tc.query;
    process.stdout.write(`[${String(i + 1).padStart(2)}/${TEST_CASES.length}] ${tc.category.padEnd(9)} "${shortQuery}" `);

    const wallStart = Date.now();
    const { response, httpStatus } = await runQuery(tc.query);
    const wallTime = Date.now() - wallStart;

    if (response.error) {
      console.log(`\n  ❌ ERROR (${httpStatus}): ${response.error}`);
      results.push({
        index: i + 1, query: tc.query, category: tc.category,
        expectedTool: tc.expectedTool, actualTool: "error", toolCorrect: false,
        toolArgs: {}, racesReturned: 0,
        latency: { routing_ms: 0, embedding_ms: 0, search_ms: 0, llm_ms: 0, total_ms: wallTime },
        answerLength: 0, hasAnswer: false, httpStatus, error: response.error,
      });
      continue;
    }

    const toolCorrect = (response.tool_used || "").includes(tc.expectedTool);
    results.push({
      index: i + 1, query: tc.query, category: tc.category,
      expectedTool: tc.expectedTool, actualTool: response.tool_used || "unknown",
      toolCorrect, toolArgs: response.tool_args || {},
      racesReturned: (response.races || []).length,
      latency: response.latency || { routing_ms: 0, embedding_ms: 0, search_ms: 0, llm_ms: 0, total_ms: wallTime },
      answerLength: (response.answer || "").length,
      hasAnswer: (response.answer || "").length > 10,
      httpStatus,
    });

    const icon = toolCorrect ? "✅" : "⚠️";
    const total = response.latency?.total_ms || wallTime;
    console.log(`${icon} ${(response.tool_used || "?").padEnd(16)} ${String(total).padStart(6)}ms  ${(response.races || []).length} races`);
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  REPORT
  // ═══════════════════════════════════════════════════════════════════════
  const successful = results.filter((r) => !r.error);
  const failed = results.filter((r) => !!r.error);
  const correct = results.filter((r) => r.toolCorrect);
  const totalTestTime = Date.now() - startTime;

  console.log("\n\n╔═══════════════════════════════════════════════════════════════╗");
  console.log("║                      TEST RESULTS                           ║");
  console.log("╚═══════════════════════════════════════════════════════════════╝");

  // ── 1. Reliability ────────────────────────────────────────────────────
  console.log("\n┌─── RELIABILITY ─────────────────────────────────────────────┐");
  console.log(`│  Total queries:        ${TEST_CASES.length}`);
  console.log(`│  Successful:           ${successful.length} (${Math.round((successful.length / TEST_CASES.length) * 100)}%)`);
  console.log(`│  Failed:               ${failed.length} (${Math.round((failed.length / TEST_CASES.length) * 100)}%)`);
  console.log(`│  Returned answer:      ${successful.filter((r) => r.hasAnswer).length}/${successful.length}`);
  console.log(`│  Returned races:       ${successful.filter((r) => r.racesReturned > 0).length}/${successful.length}`);
  console.log("└─────────────────────────────────────────────────────────────┘");

  if (failed.length > 0) {
    console.log("\n  Failed queries:");
    for (const f of failed) {
      console.log(`    #${f.index}: "${f.query.slice(0, 50)}" → ${f.error}`);
    }
  }

  // ── 2. Tool Routing Accuracy ──────────────────────────────────────────
  console.log("\n┌─── TOOL ROUTING ACCURACY ───────────────────────────────────┐");
  console.log(`│  Overall:   ${correct.length}/${results.length} (${Math.round((correct.length / results.length) * 100)}%)`);
  const categories = ["Semantic", "Filter", "Compare", "Edge"];
  for (const cat of categories) {
    const catR = results.filter((r) => r.category === cat);
    const catC = catR.filter((r) => r.toolCorrect);
    console.log(`│  ${cat.padEnd(10)}  ${catC.length}/${catR.length} (${catR.length > 0 ? Math.round((catC.length / catR.length) * 100) : 0}%)`);
  }
  console.log("└─────────────────────────────────────────────────────────────┘");

  const misrouted = results.filter((r) => !r.toolCorrect && !r.error);
  if (misrouted.length > 0) {
    console.log("\n  Misrouted queries:");
    for (const m of misrouted) {
      console.log(`    #${m.index}: "${m.query.slice(0, 45)}" → expected ${m.expectedTool}, got ${m.actualTool}`);
    }
  }

  // ── 3. Latency ────────────────────────────────────────────────────────
  if (successful.length > 0) {
    const avg = (arr: number[]) => Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
    const min = (arr: number[]) => Math.min(...arr);
    const max = (arr: number[]) => Math.max(...arr);

    const routing = successful.map((r) => r.latency.routing_ms).filter((v) => v > 0);
    const embed = successful.map((r) => r.latency.embedding_ms).filter((v) => v > 0);
    const search = successful.map((r) => r.latency.search_ms).filter((v) => v > 0);
    const llm = successful.map((r) => r.latency.llm_ms).filter((v) => v > 0);
    const total = successful.map((r) => r.latency.total_ms).filter((v) => v > 0);

    console.log("\n┌─── LATENCY (ms) ───────────────────────────────────────────┐");
    console.log("│                    Avg      Min      Max      p50      p95 │");
    console.log("│  ──────────────────────────────────────────────────────────│");
    if (routing.length > 0)
      console.log(`│  Routing         ${String(avg(routing)).padStart(6)}   ${String(min(routing)).padStart(6)}   ${String(max(routing)).padStart(6)}   ${String(percentile(routing, 50)).padStart(6)}   ${String(percentile(routing, 95)).padStart(6)} │`);
    if (embed.length > 0)
      console.log(`│  Embedding       ${String(avg(embed)).padStart(6)}   ${String(min(embed)).padStart(6)}   ${String(max(embed)).padStart(6)}   ${String(percentile(embed, 50)).padStart(6)}   ${String(percentile(embed, 95)).padStart(6)} │`);
    if (search.length > 0)
      console.log(`│  Search          ${String(avg(search)).padStart(6)}   ${String(min(search)).padStart(6)}   ${String(max(search)).padStart(6)}   ${String(percentile(search, 50)).padStart(6)}   ${String(percentile(search, 95)).padStart(6)} │`);
    if (llm.length > 0)
      console.log(`│  LLM Answer      ${String(avg(llm)).padStart(6)}   ${String(min(llm)).padStart(6)}   ${String(max(llm)).padStart(6)}   ${String(percentile(llm, 50)).padStart(6)}   ${String(percentile(llm, 95)).padStart(6)} │`);
    if (total.length > 0)
      console.log(`│  Total           ${String(avg(total)).padStart(6)}   ${String(min(total)).padStart(6)}   ${String(max(total)).padStart(6)}   ${String(percentile(total, 50)).padStart(6)}   ${String(percentile(total, 95)).padStart(6)} │`);
    console.log("└─────────────────────────────────────────────────────────────┘");

    // Latency by category
    console.log("\n┌─── LATENCY BY CATEGORY (avg total ms) ─────────────────────┐");
    for (const cat of categories) {
      const catTotals = successful.filter((r) => r.category === cat).map((r) => r.latency.total_ms).filter((v) => v > 0);
      if (catTotals.length > 0)
        console.log(`│  ${cat.padEnd(10)}  ${String(avg(catTotals)).padStart(6)}ms avg  (${catTotals.length} queries)`);
    }
    console.log("└─────────────────────────────────────────────────────────────┘");

    // ── 4. API Consumption ──────────────────────────────────────────────
    const semanticCount = successful.filter((r) => r.actualTool.includes("semantic")).length;
    const filterCount = successful.filter((r) => r.actualTool.includes("filter")).length;
    const compareCount = successful.filter((r) => r.actualTool.includes("compare")).length;
    const otherCount = successful.length - semanticCount - filterCount - compareCount;

    const routingCalls = successful.length;
    const embeddingCalls = semanticCount;
    const answerCalls = successful.length;
    const totalAPICalls = routingCalls + answerCalls + embeddingCalls;

    console.log("\n┌─── API CONSUMPTION ─────────────────────────────────────────┐");
    console.log("│  Tool distribution:");
    console.log(`│    semantic_search:   ${semanticCount}`);
    console.log(`│    filter_races:      ${filterCount}`);
    console.log(`│    compare_races:     ${compareCount}`);
    if (otherCount > 0) console.log(`│    other/fallback:    ${otherCount}`);
    console.log("│");
    console.log("│  Fireworks API calls:");
    console.log(`│    Routing LLM:       ${routingCalls}  (llama-v3p3-70b-instruct)`);
    console.log(`│    Embedding:         ${embeddingCalls}  (nomic-embed-text-v1.5)`);
    console.log(`│    Answer LLM:        ${answerCalls}  (llama-v3p3-70b-instruct)`);
    console.log(`│    ─────────────────`);
    console.log(`│    Total:             ${totalAPICalls} API calls for ${successful.length} queries`);
    console.log("│");

    // Cost estimate
    const routingInputTokens = routingCalls * 250;
    const routingOutputTokens = routingCalls * 60;
    const answerInputTokens = answerCalls * 600;
    const answerOutputTokens = answerCalls * 250;
    const embedTokens = embeddingCalls * 50;

    const llmInputCost = ((routingInputTokens + answerInputTokens) / 1_000_000) * 0.90;
    const llmOutputCost = ((routingOutputTokens + answerOutputTokens) / 1_000_000) * 0.90;
    const embedCost = (embedTokens / 1_000_000) * 0.008;
    const totalCost = llmInputCost + llmOutputCost + embedCost;

    console.log("│  Estimated cost:");
    console.log(`│    LLM input:         ~${routingInputTokens + answerInputTokens} tokens → $${llmInputCost.toFixed(4)}`);
    console.log(`│    LLM output:        ~${routingOutputTokens + answerOutputTokens} tokens → $${llmOutputCost.toFixed(4)}`);
    console.log(`│    Embedding:         ~${embedTokens} tokens → $${embedCost.toFixed(6)}`);
    console.log(`│    ─────────────────`);
    console.log(`│    Total:             $${totalCost.toFixed(4)} for ${successful.length} queries`);
    console.log(`│    Per query:         $${(totalCost / successful.length).toFixed(5)}`);
    console.log("└─────────────────────────────────────────────────────────────┘");

    // ── 5. Response Quality ─────────────────────────────────────────────
    const answerLengths = successful.map((r) => r.answerLength);
    const raceCounts = successful.map((r) => r.racesReturned);

    console.log("\n┌─── RESPONSE QUALITY ───────────────────────────────────────┐");
    console.log(`│  Answer length:   avg ${avg(answerLengths)} chars, min ${min(answerLengths)}, max ${max(answerLengths)}`);
    console.log(`│  Races returned:  avg ${(raceCounts.reduce((a, b) => a + b, 0) / raceCounts.length).toFixed(1)}, min ${min(raceCounts)}, max ${max(raceCounts)}`);
    console.log(`│  Empty answers:   ${successful.filter((r) => !r.hasAnswer).length}`);
    console.log(`│  Zero races:      ${successful.filter((r) => r.racesReturned === 0).length}`);
    console.log("└─────────────────────────────────────────────────────────────┘");
  }

  // ── Final Summary ─────────────────────────────────────────────────────
  const totalMin = Math.floor(totalTestTime / 60000);
  const totalSec = Math.round((totalTestTime % 60000) / 1000);

  console.log("\n╔═══════════════════════════════════════════════════════════════╗");
  console.log(`║  Test completed in ${totalMin}m ${totalSec}s                                  `);
  console.log(`║  ${successful.length}/${TEST_CASES.length} passed, ${failed.length} failed, ${correct.length}/${results.length} routed correctly       `);
  console.log("╚═══════════════════════════════════════════════════════════════╝\n");

  if (failed.length > 0) process.exit(1);
}

main();
