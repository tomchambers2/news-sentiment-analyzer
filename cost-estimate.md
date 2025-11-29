# Cost Estimate: Claude Haiku for 80,000 Articles

## Token Usage Estimate

Per batch (20 articles):
- **Input tokens:**
  - System prompt/instructions: ~300 tokens
  - 20 articles × ~250 tokens each (title + 800 char excerpt): ~5,000 tokens
  - **Total per batch: ~5,300 tokens**

- **Output tokens:**
  - 20 JSON responses with reasoning: ~400 tokens per batch

## Total for 80,000 Articles

- **Batches needed:** 80,000 ÷ 20 = 4,000 batches

- **Input tokens:** 4,000 × 5,300 = **21,200,000 tokens** (21.2M)
- **Output tokens:** 4,000 × 400 = **1,600,000 tokens** (1.6M)

## Claude 3.5 Haiku Pricing

- Input: **$0.80 per million tokens**
- Output: **$4.00 per million tokens**

## Cost Breakdown

| Category | Tokens | Rate | Cost |
|----------|--------|------|------|
| Input | 21.2M | $0.80/M | **$16.96** |
| Output | 1.6M | $4.00/M | **$6.40** |
| **TOTAL** | | | **$23.36** |

## Cost per Article

**$23.36 ÷ 80,000 = $0.000292 per article**

## Important Notes

### 1. Cache Reduces Actual Cost

You already have cached classifications in `cache/2_filter/filter_output.json`. Only **uncached articles** will be classified:

```bash
# Check how many articles are already cached
jq 'keys | length' cache/2_filter/filter_output.json
```

If you have 50,000 already cached, you'd only pay for 30,000 new classifications = **~$8.80**

### 2. Optimization Options

**Option A: Shorter excerpts** (500 chars instead of 800)
- Reduces tokens by ~30%
- Total cost: **~$16-18** for 80k articles
- Should still be accurate enough

**Option B: Pre-filter with keywords**
- First pass: Free keyword filtering for obvious cases
- Second pass: Claude only for uncertain articles (~20-30% of total)
- Total cost: **~$5-7** for 80k articles

**Option C: Use cheaper models for some articles**
- Claude Haiku for first classification
- If confidence > 0.9, trust it
- If confidence < 0.9, use Sonnet for verification (only ~10% of articles)
- Minimal extra cost, higher accuracy

## Comparison to Jina

| Service | Cost | Accuracy | Notes |
|---------|------|----------|-------|
| **Jina embeddings** | ~$0 (using existing API) | **60%** ❌ | Unusable - too many false positives/negatives |
| **Claude Haiku** | **~$23** | **95-100%** ✅ | Reliable, provides reasoning |

## Recommendation

**Spend the $23** - it's extremely reasonable for:
- ✅ Reliable classification (vs unusable 60% accuracy)
- ✅ High-quality confidence scores
- ✅ Reasoning for each decision
- ✅ One-time cost (results are cached)

For comparison:
- A single hour of manual classification (even at minimum wage) costs more
- 80,000 articles manually reviewed at 30 seconds each = 667 hours = **$10,000-20,000** in labor
- Claude cost: **$23** for the same task with consistent quality

## Budget-Conscious Option

If $23 is too much:

1. **Sample first:** Test on 1,000 articles (~$0.30)
2. **Review accuracy:** If >95%, proceed with full dataset
3. **Optimize if needed:** Implement keyword pre-filtering to reduce API calls

Or use the hybrid approach (keyword + Claude) for **~$5-7 total**.
