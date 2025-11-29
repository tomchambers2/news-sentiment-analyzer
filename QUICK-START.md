# Quick Start Guide

## Running for a Specific Topic

### 1. Edit the Topic

Open `src/main.js` and change the TOPIC constant (lines 29-33):

```javascript
const TOPIC = {
  id: "your-topic-id",              // kebab-case, stable identifier
  description: "your topic description for AI classification"
};
```

**Examples:**

```javascript
// Current topic (liveable neighbourhoods)
const TOPIC = {
  id: "liveable-neighbourhoods",
  description: "liveable neighbourhoods, low traffic neighbourhoods, modal filters, liveable streets, traffic calming, or community opposition to these schemes"
};

// Housing development
const TOPIC = {
  id: "housing-development",
  description: "housing development, new builds, planning applications, affordable housing, social housing"
};

// Clean air zone
const TOPIC = {
  id: "clean-air-zone",
  description: "clean air zone, CAZ, air pollution, emissions, vehicle restrictions"
};

// Public transport
const TOPIC = {
  id: "public-transport",
  description: "buses, trains, metro, public transport, First Bus, Great Western Railway"
};
```

### 2. Run the Analysis

```bash
npm start
```

The script will:
1. ✅ Discover articles from Bristol news sites
2. ✅ Scrape article content (or use cache)
3. ✅ Classify articles for relevance to your topic
4. ✅ Analyze sentiment of relevant articles
5. ✅ Generate `results-{topic-id}.json`
6. ✅ Generate `dashboard-{topic-id}.html`
7. ✅ Update `index.html` with all topics

### 3. View Results

```bash
npm run serve
```

Then open http://localhost:8000/ to see all topics.

## How Caching Works

### ✅ What Gets Reused Across Topics

- **Scraped article text** - Never re-scraped! Saves time and API costs.

### ✅ What's Unique Per Topic

- **Classification results** - Each topic gets fresh AI classification
- **Sentiment analysis** - Only analyzed for articles relevant to that topic
- **Results files** - Separate JSON and dashboard for each topic

### Example: Adding a Second Topic

You've already run "liveable-neighbourhoods" and have 170k articles scraped.

To add "housing-development":
1. Edit TOPIC in `src/main.js`
2. Run `npm start`
3. Result: **No re-scraping!** Just classifies 170k cached articles (~2 hours)

## File Structure

After running multiple topics:

```
results-liveable-neighbourhoods.json       # 225 articles analyzed
results-housing-development.json           # 180 articles analyzed
results-clean-air-zone.json                # 95 articles analyzed

dashboard-liveable-neighbourhoods.html     # Interactive visualizations
dashboard-housing-development.html
dashboard-clean-air-zone.html

index.html                                 # Lists all topics

cache/
  3_scrape/article_text.json              # Shared! (170k articles)
  2_filter/filter_output.json             # Per-topic classifications
```

## Best Practices

### Topic IDs
- ✅ Use kebab-case: `clean-air-zone`, `housing-development`
- ✅ Be descriptive and stable
- ❌ Don't change IDs once set (breaks cache)

### Topic Descriptions
- ✅ Be specific and comprehensive
- ✅ Include synonyms and related terms
- ✅ Can be refined over time (won't break cache)
- ✅ Example: "housing development, new builds, planning applications, affordable housing, social housing"

### Running Multiple Topics
- ✅ Run one at a time (edit TOPIC, run `npm start`)
- ✅ Results accumulate - old topics stay intact
- ✅ Index page updates automatically

## Troubleshooting

### "Jina API failing with 402"
- Add credits to your Jina API account
- Minimum top-up: $50 for 1B tokens

### "All articles already processed"
- You've already run this topic
- Check `results-{topic-id}.json` for results
- To re-run: delete the results file

### "Want to refine topic description"
- Just edit the description in `src/main.js`
- Classifications will re-run (using cached article text)

## Quick Commands

```bash
npm start              # Run analysis for current topic
npm run serve          # Start web server to view results
```

That's it! Edit TOPIC, run npm start, view at http://localhost:8000/
