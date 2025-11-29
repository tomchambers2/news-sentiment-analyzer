# Bristol News Sentiment Analyzer

Analyze Bristol news coverage of liveable neighbourhoods using AI-powered sentiment analysis.

## Project Structure

### **File Structure**

```
├── src/                    (main code files)
│   ├── main.js
│   ├── discovery.js
│   ├── sitemap-discovery.js
│   ├── filter.js
│   ├── scraper.js
│   └── analyzer.js
├── cache/                  (cache files)
├── prompt-optimizer/       (evaluation tools)
├── dashboard.html          (visualization)
├── prompts.js              (AI prompts - template literals)
├── package.json
└── README.md
```

### Core Modules (in `src/`)

- **`src/main.js`** - Main execution script and processing loop
- **`src/discovery.js`** - Article discovery via Google Search and sitemaps
- **`src/sitemap-discovery.js`** - XML sitemap crawling for comprehensive coverage
- **`src/filter.js`** - AI-powered relevance filtering
- **`src/scraper.js`** - Web scraping with caching and fallback strategies
- **`src/analyzer.js`** - AI-powered sentiment and feature analysis

### Data Files

- **`results.json`** - Analyzed articles with sentiment data (gitignored)
  - Each article includes:
    - Basic metadata (source, URL, title, topic)
    - **`sentiment`** - supportive, negative, neutral, or mixed
    - **`sentiment_score`** - 1-10 rating
    - **`sentiment_explanation`** - Why this sentiment was assigned
    - Detailed analysis (angles, framing, stakeholders, etc.)
    - Filter reasoning available in `cache/2_filter/filter_output.json`

### Cache Files (organized by workflow step)

```
cache/
├── 1_discover/              # Discovery phase
│   ├── serp.json           # Google Search results (by site + topic + page)
│   ├── sitemap_urls.json   # Sitemap-discovered URLs (by site)
│   ├── discover_output.json # Combined URLs (by site + topic)
│   └── sitemap_xml/        # Raw XML files from sitemaps (cached)
├── 2_filter/                # Filter phase
│   ├── filter_input.json   # What was sent to AI (title + content + prompt)
│   └── filter_output.json  # AI decisions (true/false by URL)
└── 3_scrape/                # Scrape phase
    └── article_text.json    # Scraped article content (by URL)
```

### Configuration

- **`.env`** - API keys (OPENAI_API_KEY, SERPAPI_KEY, JINA_API_KEY [optional])
- **`package.json`** - Dependencies and scripts

### Output

- **`dashboard.html`** - Interactive visualization dashboard

## Module Details

### `discovery.js`

Exports:
- `discover(site, topic)` - Combined sitemap + Google search with deduplication
- `discoverGoogleResults(site, topic)` - Google Search via SerpAPI (cached)
- `discoverSitemapResults(site)` - Sitemap-based discovery

### `sitemap-discovery.js`

Exports:
- `discoverFromSitemap(site, extractTitles)` - Fetch and parse XML sitemaps
- `hasSitemapSupport(site)` - Check if site has sitemap
- `getSitemapSites()` - Get list of supported sites

Supports 7 Bristol news sites with comprehensive historical coverage.

### `filter.js`

Exports:
- `filter(headline, snippet, topic)` - AI-powered relevance check

Uses GPT-4o-mini to determine if an article is about the target topic.

### `scraper.js`

Exports:
- `scrape(url)` - Scrape article text with caching

Features:
- Text caching to avoid re-scraping
- Uses Jina AI Reader API for intelligent content extraction
- Returns clean, LLM-friendly markdown content
- Optional API key support for higher rate limits (500 RPM vs 20 RPM)

### `analyzer.js`

Exports:
- `analyze(site, text, title)` - Comprehensive article analysis

Uses GPT-4o-mini to extract:
- Sentiment (supportive/negative/neutral/mixed) + score (1-10)
- Main and secondary angles
- Framing, evidence type, voices
- Stakeholders, article type, length
- Publication date, geographic focus
- Political parties mentioned
- Summary and metadata

## Usage

```bash
# Install dependencies
npm install

# Run the analyzer
npm start

# View the dashboard
npm run serve

# Evaluate prompts (optional)
npm run label           # Create labeled test cases
npm run eval-filter     # Evaluate filter prompt
npm run eval-analyzer   # Evaluate analyzer prompt
npm run eval-both       # Evaluate both prompts
```

### Configuration

**Limit articles for testing:**

Edit `src/main.js` and set `MAX_ARTICLES_PER_SITE`:

```javascript
const MAX_ARTICLES_PER_SITE = 10;  // Process only 10 articles per site
const MAX_ARTICLES_PER_SITE = null; // Process all discovered articles (unlimited)
```

This is useful for:
- Testing prompt changes on a small sample
- Quick validation of the pipeline
- Reviewing filter decisions before full run

## Discovery Strategy

1. **Sitemap Discovery** (for sites with XML sitemaps)
   - Comprehensive historical coverage
   - All articles back to 2017+
   - No recency bias

2. **Google Search** (supplement or fallback)
   - Recent articles not yet in sitemaps
   - Sites without sitemap support
   - Cached to avoid duplicate API calls

3. **Deduplication**
   - URLs tracked to avoid processing duplicates
   - Combines both sources efficiently

## Processing Pipeline

```
For each site:
  1. Discover articles (sitemap + Google)
  2. Deduplicate by URL
  3. Check if already processed
  4. Filter for relevance (AI)
  5. Scrape article text (cached)
  6. Analyze sentiment & features (AI)
  7. Save to results.json
```

## Supported Sites

✅ **With Sitemap Support:**
- Bristol247
- Bristol Cable
- Clifton Voice
- Bishopston Matters
- North Bristol Press
- The Bristolian.net
- Bristol Post

❌ **Google Search Only:**
- South Bristol Voice
- Fishponds Voice
- Filton Voice
- Bristol World
- Bristol.today
- Direct Local Bristol

## Dashboard Features

- Summary statistics
- Sentiment distribution charts
- Trend analysis over time
- Feature breakdowns
- Article browser with filters
- Pagination (10 per page)
- Full text modal viewer

## Prompt Evaluation

Test and improve your prompts with labeled data.

### Workflow

1. **Label Test Cases** - Mark cached results as correct/incorrect
   ```bash
   npm run label
   ```

2. **Evaluate** - Test current prompts and see metrics
   ```bash
   npm run eval-filter     # Test filter prompt
   npm run eval-analyzer   # Test analyzer prompt
   npm run eval-both       # Test both
   ```

3. **Improve** - Manually edit `prompts.js` based on errors

4. **Re-evaluate** - Run evaluation again to check improvement

### Metrics

**Filter:**
- Accuracy, Precision, Recall, F1 Score
- Confusion matrix
- List of errors

**Analyzer:**
- Overall accuracy
- Per-field accuracy (sentiment, main_angle, balance)
- List of errors

### Simple Manual Process

No automatic optimization - you control everything:
- Review errors
- Edit prompts in `prompts.js`
- Re-test
- Iterate until satisfied

See `prompt-optimizer/README.md` for detailed documentation.

## Caching Strategy

The app uses multiple cache layers to speed up reruns:

### Cache Layers

Organized by workflow phase:

**1. Discovery Phase** (`cache/1_discover/`)

- **`serp.json`** - Google Search results
  - Key: `site|topic|page`
  - Saves: API calls and rate limits
  
- **`sitemap_xml/`** - Raw XML sitemap files
  - One file per sitemap URL
  - Saves: Network requests (sitemaps are very static)
  - Rarely needs invalidation (sitemap structure doesn't change)
  
- **`sitemap_urls.json`** - Parsed sitemap results
  - Key: `site`
  - Saves: 30-60 seconds per site with sitemaps
  
- **`discover_output.json`** - Combined discovery results
  - Key: `site|topic`
  - Saves: Full discovery time (~1-2 minutes per site)

**2. Scrape Phase** (`cache/3_scrape/`)

- **`article_text.json`** - Full article content
  - Key: `url`
  - Saves: Network requests and scraping time
  - Rarely needs invalidation (content doesn't change)

**3. Filter Phase** (`cache/2_filter/`)

- **`filter_input.json`** - What was sent to AI
  - Key: `url`
  - Contains: title, full article content, topic, full prompt
  - Review this file to see exactly what the AI saw when making decisions
  
- **`filter_output.json`** - AI relevance decisions
  - Key: `url`
  - Contains: `{ relevant: true/false, reasoning: "why this decision was made" }`
  - Reasoning explains why each article was included or filtered out
  - Saves: ~2-3 seconds per article × hundreds of articles
  - Invalidate when changing filter prompt or topic

### Cost notes

- **Filtering excerpt** – Passing roughly 2k characters (~500 tokens) into the filter prompt costs about **$0.00015** per call (`gpt-4o-mini` input + reply).
- **Scale example** – Filtering **50,000** articles at that length is roughly **$7.5** total. Adjust linearly with the number of URLs you send through `filter()`.

### Cache Management

```bash
# Start fresh (clear all caches)
rm -rf cache/ results.json

# Change topic (keep sitemaps, clear topic-specific caches)
rm cache/1_discover/serp.json cache/1_discover/discover_output.json
rm -rf cache/2_filter/
rm results.json

# Change filter logic (re-filter but keep discovered URLs)
rm -rf cache/2_filter/ results.json

# Re-analyze with different prompt (keep all discovery & filtering)
rm results.json

# Clear specific phases
rm -rf cache/1_discover/    # Clear all discovery caches
rm -rf cache/2_filter/      # Clear filter decisions
rm -rf cache/3_scrape/      # Clear scraped content

# Force refetch sitemaps (clear XML cache and parsed results)
rm -rf cache/1_discover/sitemap_xml/
rm cache/1_discover/sitemap_urls.json
```

## Performance

- **First run**: Several hours (thousands of articles)
- **Subsequent runs with caches**: Seconds to minutes (only new articles)
- **Topic change**: ~10-15 minutes (re-filter + re-analyze)
- **Filter change**: ~5-10 minutes (re-analyze only)
- All caches persist between runs

## Requirements

- Node.js 16+
- OpenAI API key (required)
- SerpAPI key (required)
- Jina AI API key (optional - for higher rate limits: 500 RPM vs 20 RPM free tier)
