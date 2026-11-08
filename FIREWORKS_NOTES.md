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

## Fine-tuning results (synthesis SFT)

### Numbers
- Training examples: 180 (200 minus 10% eval)
- Training time: ~[X] minutes
- Cost: $0 (free tier, sub-16B)
- Deployment cost: ~$[X] for testing window

### 8B fine-tuned vs 70B prompted
- Latency: 644ms vs 1,397ms (2.2x faster)
- Response length: 346 vs 403 chars (14% shorter)
- Quality: comparable or better
- No system prompt needed for 8B

### Observations
- 8B is more direct; 70B hedges with "Unfortunately..."
- 8B leaks similarity scores (training artifact)
- Similarity score leak = the model learned the *format* 
  of the training data too literally. Fixable by cleaning 
  training examples or adding more diverse outputs.

### Product friction log
- epochs flag rejects floats (docs say supported)
- Payment method required for free tier
- firectl install path undocumented / 404 on GitHub
- Deployment shape selection has no "recommended" default
- LoRA vs multi-LoRA choice isn't explained at decision point