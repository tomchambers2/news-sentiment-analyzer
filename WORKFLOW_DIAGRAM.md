# News Sentiment Analyzer - Workflow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          STEP 1: DISCOVER URLs                              │
│                          src/discovery.js                                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                    ┌────────────────┴────────────────┐
                    │                                 │
            ┌───────▼────────┐              ┌────────▼────────┐
            │  Google Search │              │ XML Sitemaps    │
            │   (SerpAPI)    │              │  (crawl sites)  │
            └───────┬────────┘              └────────┬────────┘
                    │                                │
            ┌───────▼────────┐              ┌────────▼─────────┐
            │ cache/1_discover                cache/1_discover │
            │  /serp.json    │              │ /sitemap_urls    │
            │                │              │     .json        │
            │ ┌────────────┐ │              │ ┌──────────────┐ │
            │ │ {          │ │              │ │ {            │ │
            │ │  "site|    │ │              │ │  "site": [   │ │
            │ │   topic|   │ │              │ │   {link, ...}│ │
            │ │   page": [ │ │              │ │  ]           │ │
            │ │    {title, │ │              │ │ }            │ │
            │ │     snippet│ │              │ │              │ │
            │ │     link}  │ │              │ │              │ │
            │ │  ]         │ │              │ │              │ │
            │ │ }          │ │              │ │              │ │
            │ └────────────┘ │              │ └──────────────┘ │
            └────────────────┘              └──────────────────┘
                    │                                │
                    └────────────┬───────────────────┘
                                 │
                         ┌───────▼────────┐
                         │  Merge & Dedup │
                         └───────┬────────┘
                                 │
                    ┌────────────▼────────────┐
                    │ cache/1_discover        │
                    │  /discover_output.json  │
                    │                         │
                    │ ┌─────────────────────┐ │
                    │ │ {                   │ │
                    │ │  "site|topic": [    │ │
                    │ │    {                │ │
                    │ │      link,          │ │
                    │ │      title,         │ │
                    │ │      snippet,       │ │
                    │ │      source         │ │
                    │ │    }                │ │
                    │ │  ]                  │ │
                    │ │ }                   │ │
                    │ └─────────────────────┘ │
                    └─────────────────────────┘
                                 │
                                 │ For each URL
                                 │
┌────────────────────────────────▼────────────────────────────────────────────┐
│                         STEP 2: SCRAPE Content                              │
│                           src/scraper.js                                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │                         │
            ┌───────▼────────┐       ┌───────▼────────┐
            │  Direct HTTP   │       │  ScrapingBee   │
            │   (axios +     │       │   (fallback)   │
            │    cheerio)    │       │                │
            └───────┬────────┘       └────────┬───────┘
                    │                         │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼─────────────┐
                    │  cache/3_scrape          │
                    │   /article_text.json     │
                    │                          │
                    │ ┌──────────────────────┐ │
                    │ │ {                    │ │
                    │ │  "url": "Full clean │ │
                    │ │          article    │ │
                    │ │          text with  │ │
                    │ │          no HTML    │ │
                    │ │          tags..."   │ │
                    │ │ }                    │ │
                    │ └──────────────────────┘ │
                    └──────────────────────────┘
                                 │
                                 │ Reuse cached text
                                 │
┌────────────────────────────────▼────────────────────────────────────────────┐
│                       STEP 3: FILTER Relevance                              │
│                          src/filter.js                                      │
└─────────────────────────────────────────────────────────────────────────────┘
                                 │
                                 │ Send to AI:
                                 │ - Topic
                                 │ - Title  
                                 │ - FULL article text
                                 │
                    ┌────────────▼─────────────┐
                    │   OpenAI GPT-4o-mini     │
                    │   (filter.prompt from    │
                    │    prompts.json)         │
                    └────────────┬─────────────┘
                                 │
                    ┌────────────┴─────────────┐
                    │                          │
        ┌───────────▼───────────┐  ┌──────────▼──────────┐
        │ cache/2_filter        │  │ cache/2_filter      │
        │  /filter_input.json   │  │  /filter_output.json│
        │                       │  │                     │
        │ ┌───────────────────┐ │  │ ┌─────────────────┐ │
        │ │ {                 │ │  │ │ {               │ │
        │ │  "url": {         │ │  │ │  "url": true,   │ │
        │ │   title,          │ │  │ │  "url2": false  │ │
        │ │   content,        │ │  │ │ }               │ │
        │ │   topic,          │ │  │ │                 │ │
        │ │   prompt          │ │  │ │                 │ │
        │ │  }                │ │  │ │                 │ │
        │ │ }                 │ │  │ │                 │ │
        │ └───────────────────┘ │  │ └─────────────────┘ │
        └───────────────────────┘  └─────────────────────┘
                │                           │
                │ Manual inspection         │ Filter decisions
                └───────────────┬───────────┘
                                │
                                │ Only relevant articles (true)
                                │ Reuse cached text
                                │
┌────────────────────────────────▼────────────────────────────────────────────┐
│                      STEP 4: ANALYZE Sentiment                              │
│                         src/analyzer.js                                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                 │
                                 │ Send to AI:
                                 │ - Source site
                                 │ - Title
                                 │ - FULL article text
                                 │
                    ┌────────────▼─────────────┐
                    │   OpenAI GPT-4o-mini     │
                    │  (analyzer.prompt from   │
                    │    prompts.json)         │
                    └────────────┬─────────────┘
                                 │
                                 │ Extract:
                                 │ - sentiment
                                 │ - sentiment_score
                                 │ - main_angle
                                 │ - key_concerns
                                 │ - key_benefits
                                 │ - stakeholder_quotes
                                 │ - council_position
                                 │ - opposition_arguments
                                 │
                    ┌────────────▼─────────────┐
                    │     results.json         │
                    │                          │
                    │ ┌──────────────────────┐ │
                    │ │ [                    │ │
                    │ │  {                   │ │
                    │ │   source,            │ │
                    │ │   url,               │ │
                    │ │   title,             │ │
                    │ │   topic,             │ │
                    │ │   sentiment,         │ │
                    │ │   sentiment_score,   │ │
                    │ │   main_angle,        │ │
                    │ │   key_concerns: [],  │ │
                    │ │   key_benefits: [],  │ │
                    │ │   ...                │ │
                    │ │  }                   │ │
                    │ │ ]                    │ │
                    │ └──────────────────────┘ │
                    └──────────────────────────┘
                                 │
                                 │
┌────────────────────────────────▼────────────────────────────────────────────┐
│                        VISUALIZATION                                        │
│                        dashboard.html                                       │
│                                                                             │
│  • Interactive charts                                                       │
│  • Sentiment distribution                                                   │
│  • Source breakdown                                                         │
│  • Timeline view                                                            │
└─────────────────────────────────────────────────────────────────────────────┘


═══════════════════════════════════════════════════════════════════════════════
                              DATA FLOW SUMMARY
═══════════════════════════════════════════════════════════════════════════════

Input:  TOPIC (in src/main.js)
        SITES (list of news sites)
        MAX_ARTICLES_PER_SITE (limit for testing, set to null for unlimited)

Step 1: DISCOVER
        ↓ cache/1_discover/serp.json (Google results)
        ↓ cache/1_discover/sitemap_xml/ (Raw XML files - cached)
        ↓ cache/1_discover/sitemap_urls.json (Parsed sitemap URLs)
        → cache/1_discover/discover_output.json (Combined URLs)

Step 2: SCRAPE
        ↓ cache/3_scrape/article_text.json (Full article text)

Step 3: FILTER
        → cache/2_filter/filter_input.json (What AI saw)
        → cache/2_filter/filter_output.json (true/false decisions)

Step 4: ANALYZE
        → results.json (Final analyzed articles)

Output: dashboard.html (Visual analysis)


═══════════════════════════════════════════════════════════════════════════════
                              CACHE DEPENDENCIES
═══════════════════════════════════════════════════════════════════════════════

Invalidate when changing TOPIC:
  • cache/1_discover/serp.json
  • cache/1_discover/discover_output.json
  • cache/2_filter/ (all)
  • results.json

Invalidate when changing filter prompt:
  • cache/2_filter/ (all)
  • results.json

Invalidate when changing analyzer prompt:
  • results.json

Never invalidate (unless articles change):
  • cache/3_scrape/article_text.json
  • cache/1_discover/sitemap_xml/ (raw XML - very static)
  • cache/1_discover/sitemap_urls.json (only if site structure changes)
```
