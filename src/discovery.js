import { getJson } from "serpapi";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import {
  discoverFromSitemap,
  hasSitemapSupport,
} from "./sitemap-discovery.js";

const CACHE_FILE = "cache/1_discover/serp.json";
const DISCOVERED_URLS_CACHE_FILE = "cache/1_discover/discover_output.json";

// Load or initialize cache
function loadCache() {
  if (existsSync(CACHE_FILE)) {
    return JSON.parse(readFileSync(CACHE_FILE, "utf-8"));
  }
  return {};
}

// Save cache to disk
function saveCache(cache) {
  mkdirSync("cache/1_discover", { recursive: true });
  writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
}

// Load discovered URLs cache
function loadDiscoveredUrlsCache() {
  if (existsSync(DISCOVERED_URLS_CACHE_FILE)) {
    return JSON.parse(readFileSync(DISCOVERED_URLS_CACHE_FILE, "utf-8"));
  }
  return {};
}

// Save discovered URLs cache
function saveDiscoveredUrlsCache(cache) {
  mkdirSync("cache/1_discover", { recursive: true });
  writeFileSync(DISCOVERED_URLS_CACHE_FILE, JSON.stringify(cache, null, 2));
}

// Generate cache key from search parameters
function getCacheKey(site, topic, start) {
  return `${site}|${topic}|${start}`;
}

// Discover articles using SerpAPI (with caching)
export async function discoverGoogleResults(site, topic) {
  console.log(`🔍 Searching ${site} for "${topic}"...`);

  const cache = loadCache();
  let allArticles = [];
  let start = 0;
  const perPage = 100;
  const maxPages = 1000; // TEST: limit to 1 page

  while (true) {
    const cacheKey = getCacheKey(site, topic, start);

    // Check cache first
    if (cache[cacheKey]) {
      console.log(`  💾 Using cached results for page ${start / perPage + 1}`);
      const articles = cache[cacheKey];
      allArticles.push(...articles);
      console.log(
        `  Page ${start / perPage + 1}: ${articles.length} results (cached) (${
          allArticles.length
        } total)`,
      );

      if (articles.length < perPage) break;
      if (start / perPage + 1 >= maxPages) break;
      start += perPage;
      continue;
    }

    // Not in cache - make API call
    console.log(`  🌐 Fetching from SERP API...`);
    const params = {
      engine: "google",
      q: `site:${site} ${topic}`,
      api_key: process.env.SERPAPI_KEY,
      num: perPage,
      start: start,
    };

    const results = await getJson(params);
    const articles = (results.organic_results || []).map((r) => ({
      title: r.title,
      link: r.link,
      snippet: r.snippet,
      source: site,
    }));

    // Save to cache
    cache[cacheKey] = articles;
    saveCache(cache);
    console.log(`  💾 Cached ${articles.length} results`);

    if (articles.length === 0) break;

    allArticles.push(...articles);
    console.log(
      `  Page ${start / perPage + 1}: ${articles.length} results (${
        allArticles.length
      } total)`,
    );

    if (articles.length < perPage) break;
    if (start / perPage + 1 >= maxPages) break;

    start += perPage;
    await new Promise((r) => setTimeout(r, 1000));
  }

  console.log(`  ✓ Found ${allArticles.length} total results`);
  return allArticles;
}

// Discover articles from sitemap
export async function discoverSitemapResults(site) {
  if (!hasSitemapSupport(site)) {
    return [];
  }

  try {
    const articles = await discoverFromSitemap(site);
    return articles;
  } catch (error) {
    console.log(`  ⚠️ Sitemap discovery failed: ${error.message}`);
    return [];
  }
}

// Combined discovery: sitemap + Google search, deduplicated by URL
export async function discover(site, topic) {
  console.log(`\n🔍 Discovering articles from ${site}...`);

  // Check discovered URLs cache first
  const discoveredCache = loadDiscoveredUrlsCache();
  const cacheKey = `${site}|${topic}`;
  
  if (discoveredCache[cacheKey]) {
    console.log(`  💾 Using cached discovered URLs (${discoveredCache[cacheKey].length} articles)`);
    return discoveredCache[cacheKey];
  }

  const allArticles = [];
  const seenUrls = new Set();

  // Try sitemap first (comprehensive historical data)
  if (hasSitemapSupport(site)) {
    console.log(`  📋 Using sitemap discovery...`);
    const sitemapArticles = await discoverSitemapResults(site);

    for (const article of sitemapArticles) {
      if (!seenUrls.has(article.link)) {
        seenUrls.add(article.link);
        allArticles.push(article);
      }
    }

    console.log(`  ✓ Sitemap: ${sitemapArticles.length} articles`);
  } else {
    console.log(`  ⚠️ No sitemap available, using Google search only`);
  }

  // Supplement with Google search (for recent articles or sites without sitemaps)
  console.log(`  🔎 Supplementing with Google search...`);
  const googleArticles = await discoverGoogleResults(site, topic);

  let newFromGoogle = 0;
  for (const article of googleArticles) {
    if (!seenUrls.has(article.link)) {
      seenUrls.add(article.link);
      allArticles.push(article);
      newFromGoogle++;
    }
  }

  console.log(
    `  ✓ Google: ${newFromGoogle} new articles (${googleArticles.length - newFromGoogle} duplicates)`,
  );
  console.log(`  📊 Total unique articles: ${allArticles.length}`);

  // Save to discovered URLs cache
  discoveredCache[cacheKey] = allArticles;
  saveDiscoveredUrlsCache(discoveredCache);
  console.log(`  💾 Cached ${allArticles.length} discovered URLs`);

  return allArticles;
}
