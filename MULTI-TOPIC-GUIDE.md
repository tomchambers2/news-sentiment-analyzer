# Multi-Topic Support Guide

## Overview

The news analyzer now supports analyzing the same articles for different topics without re-scraping. Each topic has its own cached classifications and results files.

## How It Works

### Topic Configuration

Topics are defined in `src/main.js` with two properties:

```javascript
const TOPIC = {
  id: "liveable-neighbourhoods",  // Stable identifier for caching/files (never change)
  description: "liveable neighbourhoods, low traffic neighbourhoods, modal filters, ..."  // Can be refined
};
```

- **id**: Used for file naming and cache keys. Once set, don't change it.
- **description**: Used for AI classification. Can be refined to improve accuracy without breaking cache.

### File Structure

Each topic gets its own files:

```
results-{topic-id}.json          # Analysis results for this topic
dashboard-{topic-id}.html        # Interactive dashboard for this topic
```

Shared caches (reused across topics):
```
cache/3_scrape/article_text.json     # Scraped article content (shared)
cache/2_filter/filter_output.json    # Classifications (keyed by URL|||topic-id)
```

### Running Multiple Topics (One at a Time)

**IMPORTANT**: Only run one topic at a time. Edit the TOPIC constant in `src/main.js` before each run.

1. **First topic** (current: "liveable-neighbourhoods"):

   The TOPIC constant in `src/main.js` is already set:
   ```javascript
   const TOPIC = {
     id: "liveable-neighbourhoods",
     description: "liveable neighbourhoods, low traffic neighbourhoods, modal filters, liveable streets, traffic calming, or community opposition to these schemes"
   };
   ```

   Run:
   ```bash
   npm start
   ```

   Creates:
   - `results-liveable-neighbourhoods.json`
   - `dashboard-liveable-neighbourhoods.html`
   - `index.html` (updated with all topics)

2. **Second topic** (example: "housing-development"):

   **Edit `src/main.js`** and change the TOPIC constant:
   ```javascript
   const TOPIC = {
     id: "housing-development",
     description: "housing development, new builds, planning applications, affordable housing, social housing"
   };
   ```

   Run:
   ```bash
   npm start
   ```

   Creates:
   - `results-housing-development.json`
   - `dashboard-housing-development.html`
   - `index.html` (updated to show both topics)

   **Reuses**: All scraped article text from cache (no re-scraping!)

3. **Third topic, fourth topic, etc.**:

   Repeat the process - edit TOPIC in `src/main.js`, run `npm start`

### Cache Migration

The system automatically migrates old cache format (URL-only keys) to new format (URL|||topic-id keys) when you first run with the new code. You'll see:

```
🔄 Migrated cache entry to new format: https://example.com/article
```

This preserves your existing cached classifications for the "liveable-neighbourhoods" topic.

## Benefits

1. **No Re-Scraping**: Article content is cached once and reused for all topics
2. **Independent Classifications**: Each topic gets fresh AI classifications
3. **Refine Descriptions**: Improve topic descriptions without losing cache
4. **Multiple Dashboards**: Each topic has its own visualization

## Cost Efficiency

- **Scraping**: Only pay once per article (shared cache)
- **Classification**: Pay per topic (but cached per topic)
- **Analysis**: Only for relevant articles per topic

Example with 100,000 articles:
- First topic: Scrape 100k + Classify 100k = Full cost
- Second topic: Scrape 0 + Classify 100k = ~50% cost of first run
- Third topic: Scrape 0 + Classify 100k = ~50% cost of first run

## Viewing Results

Start the local server:

```bash
npm run serve
```

Then visit:
- **Index page** (all topics): http://localhost:8000/
- **Specific topic dashboards**:
  - http://localhost:8000/dashboard-liveable-neighbourhoods.html
  - http://localhost:8000/dashboard-housing-development.html
  - etc.

The index page automatically lists all analyzed topics with article counts and quick links to their dashboards.

## Best Practices

1. **Choose stable IDs**: Use kebab-case, descriptive IDs that won't need changing
2. **Iterate on descriptions**: Feel free to refine the description for better classification
3. **Keep old results**: Results files accumulate - don't delete them
4. **Run sequentially**: Run one topic at a time to avoid cache conflicts
