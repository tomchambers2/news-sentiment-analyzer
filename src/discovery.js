import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import {
  discoverFromSitemap,
  hasSitemapSupport,
} from "./sitemap-discovery.js";

const DISCOVERED_URLS_CACHE_FILE = "cache/1_discover/discover_output.json";

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

// Discover articles from a site's sitemap
export async function discover(site, topic) {
  console.log(`\n🔍 Discovering articles from ${site}...`);

  // Check discovered URLs cache first
  const discoveredCache = loadDiscoveredUrlsCache();
  const cacheKey = `${site}|${topic}`;
  
  if (discoveredCache[cacheKey]) {
    console.log(`  💾 Using cached discovered URLs (${discoveredCache[cacheKey].length} articles)`);
    return discoveredCache[cacheKey];
  }

  // Use sitemap discovery
  if (!hasSitemapSupport(site)) {
    console.log(`  ⚠️ No sitemap support for ${site}, skipping`);
    return [];
    }

  console.log(`  📋 Using sitemap discovery...`);
  const articles = await discoverSitemapResults(site);
  console.log(`  ✓ Found ${articles.length} articles from sitemap`);

  // Save to discovered URLs cache
  discoveredCache[cacheKey] = articles;
  saveDiscoveredUrlsCache(discoveredCache);
  console.log(`  💾 Cached ${articles.length} discovered URLs`);

  return articles;
}
