import axios from "axios";
import { parseStringPromise } from "xml2js";
import { Agent as HttpAgent } from "http";
import { Agent as HttpsAgent } from "https";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";

// Jina AI Reader API configuration
const JINA_READER_BASE_URL = "https://r.jina.ai/";
const JINA_API_KEY = process.env.JINA_API_KEY || "";

const httpClient = axios.create({
  timeout: 15000,
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  },
  httpAgent: new HttpAgent({ keepAlive: true }),
  httpsAgent: new HttpsAgent({ keepAlive: true }),
});

const SITEMAP_CACHE_FILE = "cache/1_discover/sitemap_urls.json";
const SITEMAP_XML_CACHE_DIR = "cache/1_discover/sitemap_xml";

// Load sitemap URL cache
function loadSitemapCache() {
  if (existsSync(SITEMAP_CACHE_FILE)) {
    return JSON.parse(readFileSync(SITEMAP_CACHE_FILE, "utf-8"));
  }
  return {};
}

// Save sitemap URL cache
function saveSitemapCache(cache) {
  mkdirSync("cache/1_discover", { recursive: true });
  writeFileSync(SITEMAP_CACHE_FILE, JSON.stringify(cache, null, 2));
}

// Generate cache filename from URL
function getCacheFilename(url) {
  // Create a safe filename from URL
  return url
    .replace(/https?:\/\//, "")
    .replace(/[^a-zA-Z0-9]/g, "_")
    .substring(0, 200) + ".xml";
}

// Load cached XML content
function loadCachedXml(url) {
  mkdirSync(SITEMAP_XML_CACHE_DIR, { recursive: true });
  const filename = getCacheFilename(url);
  const filepath = `${SITEMAP_XML_CACHE_DIR}/${filename}`;
  
  if (existsSync(filepath)) {
    return readFileSync(filepath, "utf-8");
  }
  return null;
}

// Save XML content to cache
function saveCachedXml(url, xmlContent) {
  mkdirSync(SITEMAP_XML_CACHE_DIR, { recursive: true });
  const filename = getCacheFilename(url);
  const filepath = `${SITEMAP_XML_CACHE_DIR}/${filename}`;
  writeFileSync(filepath, xmlContent, "utf-8");
}

// Sitemap configurations for each site
const SITEMAP_CONFIGS = {
  "bristolpost.co.uk": {
    sitemaps: [
      "https://www.bristolpost.co.uk/map_news.xml",
      "https://www.bristolpost.co.uk/sitemaps/sitemap_index.xml",
    ],
    type: "custom",
  },
  "bristol247.com": {
    sitemaps: ["https://www.bristol247.com/sitemap.xml"],
    type: "yoast",
  },
  "thebristolcable.org": {
    sitemaps: ["https://thebristolcable.org/sitemap.xml"],
    type: "yoast",
  },
  "cliftonvoice.co.uk": {
    sitemaps: ["https://cliftonvoice.co.uk/sitemap.xml"],
    type: "yoast",
  },
  "bishopstonmatters.co.uk": {
    sitemaps: ["https://www.bishopstonmatters.co.uk/sitemap.xml"],
    type: "yoast",
  },
  "northbristolpress.co.uk": {
    sitemaps: ["https://www.northbristolpress.co.uk/sitemap.xml"],
    type: "yoast",
  },
  "thebristolian.net": {
    sitemaps: ["https://thebristolian.net/sitemap.xml"],
    type: "wordpress",
  },
};

/**
 * Fetch and parse XML sitemap (with caching)
 */
async function fetchSitemap(url) {
  try {
    // Check cache first
    const cachedXml = loadCachedXml(url);
    if (cachedXml) {
      console.log(`    💾 Using cached XML for ${url}`);
      const xml = await parseStringPromise(cachedXml);
      return xml;
    }

    // Fetch from network
    console.log(`    🌐 Fetching ${url}...`);
    const response = await httpClient.get(url);
    
    // Cache the raw XML
    saveCachedXml(url, response.data);
    
    const xml = await parseStringPromise(response.data);
    return xml;
  } catch (error) {
    console.log(`    ⚠️ Failed to fetch sitemap ${url}: ${error.message}`);
    return null;
  }
}

/**
 * Extract article URLs from a sitemap index (Yoast/WordPress style)
 */
async function extractFromSitemapIndex(indexUrl) {
  const articles = [];
  const xml = await fetchSitemap(indexUrl);

  if (!xml) return articles;

  // Check if it's a sitemap index (contains other sitemaps)
  if (xml.sitemapindex?.sitemap) {
    const sitemaps = xml.sitemapindex.sitemap;

    // Filter for post/article sitemaps only
    const postSitemaps = sitemaps.filter((sitemap) => {
      const loc = sitemap.loc[0];
      return (
        loc.includes("post-sitemap") ||
        loc.includes("wp-sitemap-posts-post") ||
        loc.includes("map_news") ||
        loc.includes("map_art_") // Bristol Post article sitemaps
      );
    });

    console.log(`    Found ${postSitemaps.length} post sitemaps to process...`);

    // Fetch each post sitemap
    for (const sitemap of postSitemaps) {
      const sitemapUrl = sitemap.loc[0];

      const postXml = await fetchSitemap(sitemapUrl);
      if (postXml?.urlset?.url) {
        const urls = postXml.urlset.url;

        for (const url of urls) {
          const link = url.loc[0];
          const lastmod = url.lastmod ? url.lastmod[0] : null;

          articles.push({
            link,
            lastmod,
            title: null, // Will be extracted when scraping
            snippet: null,
          });
        }
      }

      // Small delay to be respectful
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  // If it's a direct urlset (not an index)
  else if (xml.urlset?.url) {
    const urls = xml.urlset.url;

    for (const url of urls) {
      const link = url.loc[0];
      const lastmod = url.lastmod ? url.lastmod[0] : null;

      articles.push({
        link,
        lastmod,
        title: null,
        snippet: null,
      });
    }
  }

  return articles;
}

/**
 * Extract title from HTML page using Jina AI
 */
async function extractTitleFromPage(url) {
  try {
    const jinaUrl = `${JINA_READER_BASE_URL}${url}`;

    const headers = {
      "Accept": "application/json",
    };

    if (JINA_API_KEY) {
      headers["Authorization"] = `Bearer ${JINA_API_KEY}`;
    }

    const response = await axios.get(jinaUrl, {
      headers,
      timeout: 30000,
    });

    // Jina AI returns JSON with structured data
    if (response.data && response.data.data && response.data.data.title) {
      return response.data.data.title.trim();
    }

    return null;
  } catch (error) {
    console.log(`    ⚠️ Failed to extract title from ${url}`);
    return null;
  }
}

/**
 * Discover articles from a site's sitemap
 * @param {string} site - The site domain
 * @param {boolean} extractTitles - Whether to extract titles from HTML (slower but enables filtering)
 */
export async function discoverFromSitemap(site, extractTitles = false) {
  console.log(`🗺️  Discovering articles from ${site} sitemap...`);

  const config = SITEMAP_CONFIGS[site];

  if (!config) {
    console.log(`  ⚠️ No sitemap configuration for ${site}`);
    return [];
  }

  // Check cache first
  const cache = loadSitemapCache();
  if (cache[site]) {
    console.log(`  💾 Using cached sitemap URLs (${cache[site].length} articles)`);
    return cache[site];
  }

  let allArticles = [];

  for (const sitemapUrl of config.sitemaps) {
    console.log(`  📍 Processing ${sitemapUrl}...`);

    try {
      const articles = await extractFromSitemapIndex(sitemapUrl);
      // Use concat instead of spread operator to avoid stack overflow with large arrays
      allArticles = allArticles.concat(articles);
    } catch (error) {
      console.log(`  ⚠️ Error processing sitemap: ${error.message}`);
    }
  }

  console.log(`  ✓ Found ${allArticles.length} articles from sitemap`);

  // Optionally extract titles for filtering
  if (extractTitles && allArticles.length > 0) {
    console.log(`  📰 Extracting titles from HTML (this may take a while)...`);
    let extracted = 0;

    for (const article of allArticles) {
      if (!article.title) {
        article.title = await extractTitleFromPage(article.link);
        if (article.title) extracted++;

        // Small delay to be respectful
        if (extracted % 10 === 0) {
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
    }

    console.log(`  ✓ Extracted ${extracted} titles`);
  }

  // Add source to each article
  allArticles = allArticles.map((article) => ({
    ...article,
    title: article.title || "Untitled",
    snippet: article.snippet || "",
    source: site,
  }));

  // Save to cache
  cache[site] = allArticles;
  saveSitemapCache(cache);
  console.log(`  💾 Cached ${allArticles.length} sitemap URLs`);

  return allArticles;
}

/**
 * Check if a site has sitemap support
 */
export function hasSitemapSupport(site) {
  // Remove protocol if present
  const cleanSite = site.replace(/^https?:\/\//, "");
  return cleanSite in SITEMAP_CONFIGS;
}

/**
 * Get list of sites with sitemap support
 */
export function getSitemapSites() {
  return Object.keys(SITEMAP_CONFIGS);
}
