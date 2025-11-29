# Workflow Inspection Guide

The analysis pipeline has 4 clear steps, each with its own cache folder for easy inspection.

## Step-by-Step Review

Inspect cache files directly in your editor to review each step.

### Step 1: Discover URLs 📍

**What it does:** Finds article URLs using Google Search + XML sitemaps

**Cache location:** `cache/1_discover/`

**Files:**
- `serp.json` - Google Search results (by site + topic)
- `sitemap_urls.json` - URLs found in XML sitemaps (by site)
- `discover_output.json` - Combined list (by site + topic)

**Review:**
```bash
open cache/1_discover/discover_output.json
```

**What to check:**
- Are the right sites being discovered?
- Is the sitemap finding enough URLs?
- Are Google results relevant?
- Any duplicate URLs?

---

### Step 2: Scrape Content 📰

**What it does:** Fetches full article text from URLs

**Cache location:** `cache/3_scrape/`

**Files:**
- `article_text.json` - Full text content (by URL)

**Review:**
```bash
open cache/3_scrape/article_text.json
```

**What to check:**
- Is the content clean (no HTML noise)?
- Are articles complete or truncated?
- Search for specific URLs to verify

---

### Step 3: Filter Relevance ✅

**What it does:** AI checks full article content for relevance to topic

**Cache location:** `cache/2_filter/`

**Files:**
- `filter_input.json` - What was sent to AI (title + full content + prompt)
- `filter_output.json` - AI decisions (true/false by URL)

**Review:**
```bash
open cache/2_filter/filter_input.json   # See what AI saw
open cache/2_filter/filter_output.json  # See decisions
```

**What to check:**
- Open `filter_input.json` to see exactly what AI saw
- Check `filter_output.json` for true/false decisions
- Are obviously relevant articles passing through?
- Are obviously irrelevant articles being filtered out?

**To improve:**
- Edit `prompts.json` → `filter.prompt`
- Delete `cache/2_filter/` folder
- Re-run to test new prompt

**Evaluate systematically:**
```bash
npm run label                # Label 20 examples
npm run eval-filter          # See accuracy metrics
```

---

### Step 4: Analyze Sentiment 📊

**What it does:** AI analyzes each article for sentiment and features

**Output:** `results.json` (root)

**Review:**
```bash
open results.json
```

**What to check:**
- Sentiment distribution looks reasonable?
- All sources represented?
- Sample some articles to verify sentiment is accurate

**To improve:**
- Edit `prompts.json` → `analyzer.prompt`
- Delete `results.json`
- Re-run to test new prompt

**Evaluate systematically:**
```bash
npm run label                # Label 20 examples
npm run eval-analyzer        # See accuracy metrics
```

---

## Common Workflows

### Test Discovery
```bash
# Clear and re-run just discovery
rm -rf cache/1_discover/
npm start
# Check results
open cache/1_discover/discover_output.json
```

### Test Filter Changes
```bash
# Edit prompts.json filter prompt
# Clear filter cache (input and output)
rm -rf cache/2_filter/ results.json
# Re-run
npm start
# Check results
open cache/2_filter/filter_input.json
open cache/2_filter/filter_output.json
```

### Test Analyzer Changes
```bash
# Edit prompts.json analyzer prompt
# Clear results only (keep discovery + filter)
rm results.json
# Re-run
npm start
# Check results
open results.json
```

### Change Topic
```bash
# Edit src/main.js → TOPIC variable
# Clear topic-dependent caches
rm cache/1_discover/serp.json cache/1_discover/discover_output.json
rm -rf cache/2_filter/
rm results.json
# Re-run
npm start
```

---

## Debugging Tips

**Low filter pass rate (<1%)?**
- Check `npm run inspect:filter` sample articles
- Filter prompt might be too strict
- Edit `prompts.json` → make filter more lenient

**High filter pass rate (>30%)?**
- Check `npm run inspect:filter` sample filtered articles
- Filter might be too loose
- Edit `prompts.json` → make filter more specific

**Wrong sentiment analysis?**
- Use `npm run label` to create 20 labeled examples
- Run `npm run eval-analyzer` to see accuracy
- Look at errors and edit analyzer prompt accordingly

**Missing articles?**
- Check `npm run inspect:discover` - are URLs being found?
- Check `npm run inspect:filter` - are they passing filter?
- Check `npm run inspect:scrape` - are they being scraped?

---

## Cache File Sizes

After a full run, expect:
- `cache/1_discover/` - ~20-30 MB (lots of URLs)
- `cache/2_filter/` - ~100-500 KB (just true/false)
- `cache/3_scrape/` - ~10-20 MB (full article texts)
- `results.json` - ~100-500 KB (analyzed results)

All cache files are JSON and tracked in git for reproducibility.
