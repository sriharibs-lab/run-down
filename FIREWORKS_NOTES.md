## Fireworks Feature Log

### Embeddings (nomic-embed-text-v1.5)
- Total races: 4,891
- Embedding dimensions: 768
- Total time: 138.2s (~28ms avg per race)
- Retry logic caught 2 transient socket errors automatically
- Gotcha: Without retry + incremental save, would have lost 3,280 embeddings on first failure
- Batch size: 20 (set as BATCH_SIZE in the script)
- Latency per batch: ~500-600ms typical (ranged from ~330ms to ~950ms, with occasional spikes)

### Text Generation (llama-v3p3-70b-instruct)
- Original plan: 8b model, unavailable on free tier
- Fell back to: 70b-instruct
- Latency: ~1.3s (65% of total 2s request)
- Embedding: ~400ms, Search: ~300ms
- Bottleneck: LLM generation by far
- Product insight: model size selection is the biggest 
  latency/cost lever. Would A/B test 8b vs 70b for quality.

### Tool Calling (firefunction-v2)
- Routing accuracy:
- Edge cases that broke: