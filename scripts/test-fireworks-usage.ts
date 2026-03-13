/**
 * Automated test suite to measure Fireworks AI platform usage and consumption.
 *
 * Runs a variety of queries across all 3 tool types, tracks:
 *  - API calls made (routing LLM call + embedding call + answer LLM call per query)
 *  - Latency breakdown per query
 *  - Tool routing accuracy
 *  - Total session cost estimate
 *
 * Usage: npx tsx scripts/test-fireworks-usage.ts
 */

const API_URL = "http://localhost:3001/api/search";

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

const DELAY_BETWEEN_QUERIES_MS = 6000; // avoid rate limiting on free tier (each query makes 2-3 API calls)

const TEST_CASES: TestCase[] = [
  // Semantic search queries (vibe/theme based) — 10 queries
  { query: "scenic trail race through mountains", expectedTool: "semantic_search", category: "Semantic" },
  { query: "beginner-friendly fun run with good vibes", expectedTool: "semantic_search", category: "Semantic" },
  { query: "challenging ultra in the desert", expectedTool: "semantic_search", category: "Semantic" },
  { query: "flat and fast course for a PR", expectedTool: "semantic_search", category: "Semantic" },
  { query: "race along the beach or coast", expectedTool: "semantic_search", category: "Semantic" },
  { query: "family friendly race with kids activities", expectedTool: "semantic_search", category: "Semantic" },
  { query: "muddy obstacle course race", expectedTool: "semantic_search", category: "Semantic" },
  { query: "winter race in the snow", expectedTool: "semantic_search", category: "Semantic" },
  { query: "charity race for a good cause", expectedTool: "semantic_search", category: "Semantic" },
  { query: "night run or glow run", expectedTool: "semantic_search", category: "Semantic" },

  // Filter queries (exact criteria) — 10 queries
  { query: "half marathons in California", expectedTool: "filter_races", category: "Filter" },
  { query: "easy 5K races in July", expectedTool: "filter_races", category: "Filter" },
  { query: "marathons in Oregon", expectedTool: "filter_races", category: "Filter" },
  { query: "10K races in Texas", expectedTool: "filter_races", category: "Filter" },
  { query: "challenging races in Colorado", expectedTool: "filter_races", category: "Filter" },
  { query: "ultra marathons in Washington", expectedTool: "filter_races", category: "Filter" },
  { query: "easy races in September", expectedTool: "filter_races", category: "Filter" },
  { query: "5K in New York in March", expectedTool: "filter_races", category: "Filter" },
  { query: "moderate half marathons in November", expectedTool: "filter_races", category: "Filter" },
  { query: "marathon in Florida in January", expectedTool: "filter_races", category: "Filter" },

  // Compare queries — 5 queries
  { query: "compare Boston Marathon and New York Marathon", expectedTool: "compare_races", category: "Compare" },
  { query: "which is harder, Lake Washington Half Marathon or Jack and Jill Marathon", expectedTool: "compare_races", category: "Compare" },
  { query: "differences between Big Sur Marathon and LA Marathon", expectedTool: "compare_races", category: "Compare" },
  { query: "compare Hood to Coast and Ragnar Relay", expectedTool: "compare_races", category: "Compare" },
  { query: "Seattle Marathon vs Portland Marathon which should I run", expectedTool: "compare_races", category: "Compare" },
];

interface TestResult {
  query: string;
  category: string;
  expectedTool: string;
  actualTool: string;
  toolCorrect: boolean;
  toolArgs: Record<string, string>;
  racesReturned: number;
  latency: SearchResponse["latency"];
  answerLength: number;
  error?: string;
}

async function runQuery(query: string, retries = 3): Promise<SearchResponse> {
  for (let attempt = 0; attempt < retries; attempt++) {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    const data = (await res.json()) as SearchResponse;
    if (data.error && data.error.includes("429") || data.error?.includes("RATE_LIMIT")) {
      const wait = (attempt + 1) * 8000;
      console.log(`  ⏳ Rate limited, waiting ${wait / 1000}s (retry ${attempt + 1}/${retries})...`);
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    return data;
  }
  return { answer: "", tool_used: "", tool_args: {}, races: [], latency: { routing_ms: 0, embedding_ms: 0, search_ms: 0, llm_ms: 0, total_ms: 0 }, error: "Rate limit exceeded after retries" };
}

async function main() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  FIREWORKS AI — USAGE & CONSUMPTION TEST REPORT");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`  Date: ${new Date().toISOString()}`);
  console.log(`  Endpoint: ${API_URL}`);
  console.log(`  Test queries: ${TEST_CASES.length}`);
  console.log("═══════════════════════════════════════════════════════════════\n");

  const results: TestResult[] = [];

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  for (let i = 0; i < TEST_CASES.length; i++) {
    if (i > 0) await sleep(DELAY_BETWEEN_QUERIES_MS);
    const tc = TEST_CASES[i];
    console.log(`[${i + 1}/${TEST_CASES.length}] ${tc.category}: "${tc.query}"`);

    try {
      const response = await runQuery(tc.query);

      if (response.error) {
        console.log(`  ❌ ERROR: ${response.error}\n`);
        results.push({
          query: tc.query, category: tc.category, expectedTool: tc.expectedTool,
          actualTool: "error", toolCorrect: false, toolArgs: {}, racesReturned: 0,
          latency: { routing_ms: 0, embedding_ms: 0, search_ms: 0, llm_ms: 0, total_ms: 0 },
          answerLength: 0, error: response.error,
        });
        continue;
      }

      const toolCorrect = response.tool_used.startsWith(tc.expectedTool);
      const result: TestResult = {
        query: tc.query,
        category: tc.category,
        expectedTool: tc.expectedTool,
        actualTool: response.tool_used,
        toolCorrect,
        toolArgs: response.tool_args,
        racesReturned: response.races.length,
        latency: response.latency,
        answerLength: response.answer.length,
      };
      results.push(result);

      console.log(`  Tool: ${response.tool_used} ${toolCorrect ? "✅" : "⚠️  expected " + tc.expectedTool}`);
      console.log(`  Args: ${JSON.stringify(response.tool_args)}`);
      console.log(`  Races: ${response.races.length} | Answer: ${response.answer.length} chars`);
      console.log(`  Latency: route=${response.latency.routing_ms}ms embed=${response.latency.embedding_ms}ms search=${response.latency.search_ms}ms llm=${response.latency.llm_ms}ms total=${response.latency.total_ms}ms`);
      console.log();
    } catch (err) {
      console.log(`  ❌ FETCH ERROR: ${err instanceof Error ? err.message : err}\n`);
      results.push({
        query: tc.query, category: tc.category, expectedTool: tc.expectedTool,
        actualTool: "fetch_error", toolCorrect: false, toolArgs: {}, racesReturned: 0,
        latency: { routing_ms: 0, embedding_ms: 0, search_ms: 0, llm_ms: 0, total_ms: 0 },
        answerLength: 0, error: String(err),
      });
    }
  }

  // ── Summary Report ──
  const successful = results.filter((r) => !r.error);
  const correct = results.filter((r) => r.toolCorrect);

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("  SUMMARY");
  console.log("═══════════════════════════════════════════════════════════════");

  // Tool routing accuracy
  console.log(`\n  Tool Routing Accuracy: ${correct.length}/${results.length} (${Math.round((correct.length / results.length) * 100)}%)`);
  const byCategory = ["Semantic", "Filter", "Compare"];
  for (const cat of byCategory) {
    const catResults = results.filter((r) => r.category === cat);
    const catCorrect = catResults.filter((r) => r.toolCorrect);
    console.log(`    ${cat}: ${catCorrect.length}/${catResults.length}`);
  }

  // Latency stats
  if (successful.length > 0) {
    const avg = (arr: number[]) => Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
    const min = (arr: number[]) => Math.min(...arr);
    const max = (arr: number[]) => Math.max(...arr);

    const routingTimes = successful.map((r) => r.latency.routing_ms);
    const embedTimes = successful.map((r) => r.latency.embedding_ms);
    const searchTimes = successful.map((r) => r.latency.search_ms);
    const llmTimes = successful.map((r) => r.latency.llm_ms);
    const totalTimes = successful.map((r) => r.latency.total_ms);

    console.log("\n  Latency (ms)         Avg      Min      Max");
    console.log("  ─────────────────────────────────────────────");
    console.log(`  Routing (LLM #1)   ${String(avg(routingTimes)).padStart(6)}   ${String(min(routingTimes)).padStart(6)}   ${String(max(routingTimes)).padStart(6)}`);
    console.log(`  Embedding          ${String(avg(embedTimes)).padStart(6)}   ${String(min(embedTimes)).padStart(6)}   ${String(max(embedTimes)).padStart(6)}`);
    console.log(`  Search             ${String(avg(searchTimes)).padStart(6)}   ${String(min(searchTimes)).padStart(6)}   ${String(max(searchTimes)).padStart(6)}`);
    console.log(`  Answer (LLM #2)    ${String(avg(llmTimes)).padStart(6)}   ${String(min(llmTimes)).padStart(6)}   ${String(max(llmTimes)).padStart(6)}`);
    console.log(`  Total              ${String(avg(totalTimes)).padStart(6)}   ${String(min(totalTimes)).padStart(6)}   ${String(max(totalTimes)).padStart(6)}`);

    // API call count
    const semanticCount = successful.filter((r) => r.actualTool.includes("semantic")).length;
    const filterCount = successful.filter((r) => r.actualTool.includes("filter")).length;
    const compareCount = successful.filter((r) => r.actualTool.includes("compare")).length;

    const routingCalls = successful.length;           // 1 LLM call per query for routing
    const embeddingCalls = semanticCount;              // 1 embedding call per semantic search
    const answerCalls = successful.length;             // 1 LLM call per query for answer
    const totalLLMCalls = routingCalls + answerCalls;
    const totalAPICalls = totalLLMCalls + embeddingCalls;

    console.log("\n  API Calls Breakdown");
    console.log("  ─────────────────────────────────────────────");
    console.log(`  Routing LLM calls:      ${routingCalls}  (1 per query — llama-v3p3-70b-instruct)`);
    console.log(`  Embedding calls:        ${embeddingCalls}  (1 per semantic search — nomic-embed-text-v1.5)`);
    console.log(`  Answer LLM calls:       ${answerCalls}  (1 per query — llama-v3p3-70b-instruct)`);
    console.log(`  ─────────────────────────────────────────────`);
    console.log(`  Total Fireworks calls:  ${totalAPICalls}  for ${successful.length} queries`);

    // Cost estimate (Fireworks pricing)
    // llama-v3p3-70b-instruct: $0.90/M input tokens, $0.90/M output tokens
    // nomic-embed-text-v1.5: $0.008/M tokens
    // Rough estimates: routing ~200 input tokens, answer ~500 input + 200 output, embedding ~50 tokens
    const routingInputTokens = routingCalls * 200;
    const routingOutputTokens = routingCalls * 50;
    const answerInputTokens = answerCalls * 500;
    const answerOutputTokens = answerCalls * 200;
    const embedTokens = embeddingCalls * 50;

    const llmInputCost = ((routingInputTokens + answerInputTokens) / 1_000_000) * 0.90;
    const llmOutputCost = ((routingOutputTokens + answerOutputTokens) / 1_000_000) * 0.90;
    const embedCost = (embedTokens / 1_000_000) * 0.008;
    const totalCost = llmInputCost + llmOutputCost + embedCost;

    console.log("\n  Estimated Cost (Fireworks pricing)");
    console.log("  ─────────────────────────────────────────────");
    console.log(`  LLM input tokens:     ~${routingInputTokens + answerInputTokens} @ $0.90/M = $${llmInputCost.toFixed(6)}`);
    console.log(`  LLM output tokens:    ~${routingOutputTokens + answerOutputTokens} @ $0.90/M = $${llmOutputCost.toFixed(6)}`);
    console.log(`  Embedding tokens:     ~${embedTokens} @ $0.008/M = $${embedCost.toFixed(6)}`);
    console.log(`  ─────────────────────────────────────────────`);
    console.log(`  Total est. cost:      $${totalCost.toFixed(6)} for ${successful.length} queries`);
    console.log(`  Per-query avg:        $${(totalCost / successful.length).toFixed(6)}`);

    // Races returned
    const totalRaces = successful.reduce((sum, r) => sum + r.racesReturned, 0);
    console.log(`\n  Races returned: ${totalRaces} total (avg ${(totalRaces / successful.length).toFixed(1)} per query)`);
  }

  console.log("\n═══════════════════════════════════════════════════════════════\n");

  // Exit with error code if any failures
  const failures = results.filter((r) => r.error);
  if (failures.length > 0) {
    console.log(`⚠️  ${failures.length} queries failed.`);
    process.exit(1);
  }
}

main();
