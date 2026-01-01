import "dotenv/config";
import { writeFileSync, readFileSync, existsSync } from "fs";
import { discover } from "./discovery.js";
import { filterBatch } from "./filter-gpt.js";
import { scrape } from "./scraper.js";
import { analyze } from "./analyzer.js";
import { generateDashboard } from "./generate-dashboard.js";
import { generateIndex } from "./generate-index.js";
import { getTopic, listTopics } from "./topics.js";

const SITES = [
  "bristolpost.co.uk",
  "bristol247.com",
  "thebristolcable.org",
  "https://cliftonvoice.co.uk/",
  "northbristolpress.co.uk",
  "directlocalbristol.co.uk",
  "bristol.today",
  "bristolworld.com",
  "southbristolvoice.co.uk",
  "fishpondsvoice.co.uk",
  "filtonvoice.co.uk",
  "bishopstonmatters.co.uk",
  "https://thebristolian.net/",
];

// Topic selection: REQUIRED command line argument
// Usage: npm start cycling
const TOPIC_ID = process.argv[2];

if (!TOPIC_ID) {
  console.error("\n❌ ERROR: Topic ID required\n");
  console.log("Available topics:");
  listTopics().forEach(t => console.log(`   ${t.id} - ${t.description}`));
  console.log("\nUsage: npm start <topic-id>\n");
  process.exit(1);
}

const TOPIC = getTopic(TOPIC_ID); // Throws if invalid
console.log(`\n🎯 Topic: ${TOPIC.id} - ${TOPIC.description}\n`);

// Limit articles per site for testing (set to null for unlimited)
const MAX_ARTICLES_PER_SITE = null;

// Adaptive concurrency configuration
const INITIAL_CONCURRENCY = 200;
const MIN_CONCURRENCY = 10;

// Batch size for classification (GPT-4o-mini works best with smaller batches)
const CLASSIFICATION_BATCH_SIZE = 100;

/**
 * Adaptive concurrency controller with hysteresis to prevent flapping.
 * Automatically adjusts concurrency based on rate limit feedback.
 */
class AdaptiveConcurrency {
  constructor(initial, min) {
    this.current = initial;
    this.min = min;

    // Hysteresis settings
    this.successStreak = 0;
    this.successThreshold = 100; // More successes needed before increasing (was 20)
    this.increaseAmount = 10;
    this.decreaseMultiplier = 0.8; // Gentler decrease on rate limit
    this.cooldownUntil = 0; // Timestamp - don't increase until this time
    this.cooldownDuration = 5000; // 5 seconds cooldown after decrease

    // Learning - remember where rate limits occur
    this.ceiling = Infinity; // Don't exceed this level
    this.failedLevels = new Map(); // Track how many times each level failed
    this.lastDropTime = 0; // When we last dropped concurrency

    // Logging
    this.completedCount = 0;
    this.cachedCount = 0;
    this.retryCount = 0;
    this.rateLimitCount = 0;
    this.logInterval = 10; // Log every N completions
  }

  recordCached() {
    this.cachedCount++;
  }

  recordSuccess() {
    this.successStreak++;
    this.completedCount++;

    // Log status periodically
    if (this.completedCount % this.logInterval === 0) {
      const total = this.completedCount + this.cachedCount;
      const cacheInfo = this.cachedCount > 0 ? ` (${this.cachedCount} cached)` : '';
      const retryInfo = this.retryCount > 0 ? ` | Retries: ${this.retryCount}` : '';
      const ceilingInfo = this.ceiling < Infinity ? ` | Ceiling: ${this.ceiling}` : '';
      console.log(`  📊 ${total} done${cacheInfo} | ${this.completedCount} API | Concurrency: ${this.current} | Streak: ${this.successStreak}/${this.successThreshold}${retryInfo}${ceilingInfo}`);
    }

    // Only increase if we've had enough successes and cooldown has passed
    if (this.successStreak >= this.successThreshold && Date.now() > this.cooldownUntil) {
      const oldConcurrency = this.current;
      // Don't exceed the learned ceiling
      const newConcurrency = this.current + this.increaseAmount;
      if (newConcurrency < this.ceiling) {
        this.current = newConcurrency;
        this.successStreak = 0;
        console.log(`  📈 Concurrency increased: ${oldConcurrency} → ${this.current}`);
      } else if (this.current < this.ceiling - 5) {
        // Approach ceiling more carefully
        this.current = this.ceiling - 5;
        this.successStreak = 0;
        console.log(`  📈 Concurrency increased: ${oldConcurrency} → ${this.current} (approaching ceiling)`);
      }
    }
  }

  recordRateLimit() {
    const oldConcurrency = this.current;

    // Track failures at this level (rounded to nearest 10 for grouping)
    const levelBucket = Math.round(oldConcurrency / 10) * 10;
    const failCount = (this.failedLevels.get(levelBucket) || 0) + 1;
    this.failedLevels.set(levelBucket, failCount);

    // Only learn ceiling after repeated failures at similar levels
    // This confirms it's the actual limit, not just noise from previous high concurrency
    if (failCount >= 3 && levelBucket < this.ceiling) {
      this.ceiling = levelBucket - 10; // Set ceiling below the problem level
      console.log(`  🎯 Learned ceiling: ${this.ceiling} (failed ${failCount}x at ~${levelBucket})`);
    }

    this.rateLimitCount++;

    // If we just dropped, don't drop again - just wait longer
    // The rate limit is probably from the previous higher concurrency, not current
    const timeSinceLastDrop = Date.now() - this.lastDropTime;
    if (this.lastDropTime && timeSinceLastDrop < 30000) {
      // Still paying for previous high concurrency - just wait, don't drop further
      const cooldown = 15000; // Wait 15s to let window clear
      this.cooldownUntil = Date.now() + cooldown;
      console.log(`  ⏸️  Rate limited at ${oldConcurrency} - waiting ${cooldown/1000}s (still clearing previous load)`);
    } else {
      // First rate limit in a while - drop concurrency
      this.current = Math.max(this.min, Math.floor(oldConcurrency * this.decreaseMultiplier));
      this.lastDropTime = Date.now();
      const cooldown = 10000; // 10s cooldown after drop
      this.cooldownUntil = Date.now() + cooldown;
      console.log(`  📉 Rate limited at ${oldConcurrency} (${failCount}x at ~${levelBucket}) → ${this.current} (pausing ${cooldown/1000}s)`);
    }

    this.successStreak = 0;
  }

  recordRetry() {
    this.retryCount++;
  }

  getCurrent() {
    return this.current;
  }

  // Call this before retrying rate-limited items
  async waitForCooldown() {
    const now = Date.now();
    if (now < this.cooldownUntil) {
      const waitTime = this.cooldownUntil - now;
      console.log(`  ⏳ Waiting ${(waitTime/1000).toFixed(1)}s before retry...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
}

/**
 * Process items in parallel with adaptive concurrency using a sliding window.
 * Maintains active operations up to the current concurrency limit, adjusting
 * dynamically based on rate limit feedback. Retries rate-limited items.
 * @param {Array} items - Items to process
 * @param {Function} processor - Async function to process each item
 * @param {AdaptiveConcurrency} adaptiveConcurrency - Adaptive concurrency controller
 */
async function processInParallel(items, processor, adaptiveConcurrency) {
  const results = new Array(items.length);
  const retryQueue = []; // Items to retry after rate limit
  let nextIndex = 0;
  let activeCount = 0;
  let resolveWhenDone;
  const donePromise = new Promise((resolve) => {
    resolveWhenDone = resolve;
  });

  function checkDone() {
    if (activeCount === 0 && nextIndex >= items.length && retryQueue.length === 0) {
      resolveWhenDone();
    }
  }

  async function tryStartMore() {
    // First try items from retry queue (after cooldown)
    while (activeCount < adaptiveConcurrency.getCurrent() && retryQueue.length > 0) {
      // Wait for cooldown before retrying
      await adaptiveConcurrency.waitForCooldown();

      // Re-check after waiting - another worker may have taken the item
      if (retryQueue.length === 0) break;

      const { index, item } = retryQueue.shift();
      activeCount++;
      adaptiveConcurrency.recordRetry();

      (async () => {
        try {
          const value = await processor(item);
          results[index] = { status: "fulfilled", value };
          // Only count non-cached API calls for adaptive concurrency
          if (!value?.fromCache) {
            adaptiveConcurrency.recordSuccess();
          }
        } catch (reason) {
          if (reason.isRateLimited) {
            // Re-queue for another retry
            retryQueue.push({ index, item });
            adaptiveConcurrency.recordRateLimit();
          } else {
            results[index] = { status: "rejected", reason };
          }
        }

        activeCount--;
        tryStartMore();
        checkDone();
      })();
    }

    // Then process new items
    while (activeCount < adaptiveConcurrency.getCurrent() && nextIndex < items.length) {
      const index = nextIndex++;
      activeCount++;

      (async () => {
        try {
          const value = await processor(items[index]);
          results[index] = { status: "fulfilled", value };

          if (value?.fromCache) {
            // Cached items don't count toward concurrency tracking
            // Immediately free the slot since no API call was made
            activeCount--;
            adaptiveConcurrency.recordCached();
            // Immediately try to start more since we freed a slot
            tryStartMore();
          } else {
            // This was an actual API call
            activeCount--;
            adaptiveConcurrency.recordSuccess();
          }
        } catch (reason) {
          activeCount--;
          if (reason.isRateLimited) {
            // Queue for retry
            retryQueue.push({ index, item: items[index] });
            adaptiveConcurrency.recordRateLimit();
          } else {
            results[index] = { status: "rejected", reason };
          }
        }

        tryStartMore();
        checkDone();
      })();
    }

    checkDone();
  }

  // Start initial batch
  tryStartMore();

  // Wait for all to complete
  await donePromise;

  return results;
}

async function main() {
  // Generate filenames based on topic ID
  const resultsFile = `results-${TOPIC.id}.json`;
  const outputHtmlFile = `output-${TOPIC.id}.html`;

  console.log(`Topic ID: "${TOPIC.id}"`);
  console.log(`Topic description: "${TOPIC.description}"\n`);
  console.log(`Results file: ${resultsFile}`);
  console.log(`Output file: ${outputHtmlFile}\n`);

  let results = [];

  const filterOutputCachePath = "cache/2_filter/filter_output.json";
  let filterOutputCache = {};
  if (existsSync(filterOutputCachePath)) {
    filterOutputCache = JSON.parse(
      readFileSync(filterOutputCachePath, "utf-8"),
    );
  }

  const failCachePath = "cache/3_scrape/failures.json";
  let failCache = {};
  if (existsSync(failCachePath)) {
    failCache = JSON.parse(readFileSync(failCachePath, "utf-8"));
  }

  if (existsSync(resultsFile)) {
    results = JSON.parse(readFileSync(resultsFile, "utf-8"));
    console.log(`📂 Loaded ${results.length} existing results\n`);
  }

  // Create adaptive concurrency controller (shared across all sites)
  const adaptiveConcurrency = new AdaptiveConcurrency(
    INITIAL_CONCURRENCY,
    MIN_CONCURRENCY
  );
  console.log(`🚀 Starting with adaptive concurrency: ${INITIAL_CONCURRENCY} (min: ${MIN_CONCURRENCY}, no max)\n`);

  for (const site of SITES) {
    const allArticles = await discover(site, TOPIC.description);

    // Limit articles if MAX_ARTICLES_PER_SITE is set
    const articles = MAX_ARTICLES_PER_SITE
      ? allArticles.slice(0, MAX_ARTICLES_PER_SITE)
      : allArticles;

    console.log(
      `\n📰 ${site}: Processing ${articles.length} of ${allArticles.length} discovered articles`,
    );

    let stats = {
      discovered: allArticles.length,
      limited: articles.length,
      alreadyProcessed: 0,
      notRelevant: 0,
      scrapeFailed: 0,
      analysisFailed: 0,
      processed: 0,
    };

    // Filter articles first (before parallel processing)
    const articlesToProcess = articles.filter((article) => {
      // URL filtering by site
      if (site === "bristol247.com") {
        const allowedPrefixes = [
          "https://www.bristol247.com/news-and-features/",
          "https://www.bristol247.com/opinion/",
          "https://www.bristol247.com/lifestyle/",
        ];

        const isAllowed = allowedPrefixes.some((prefix) =>
          article.link.startsWith(prefix),
        );

        if (!isAllowed) {
          console.log(
            `  ⏭️  Skipping Bristol247 URL outside target sections: ${article.link}`,
          );
          return false;
        }
      }

      // Bristol Post: Only /news/ articles from 2020 onwards, exclude low-relevance categories
      if (site === "bristolpost.co.uk") {
        // Check URL prefix
        if (!article.link.includes("/news/")) {
          console.log(
            `  ⏭️  Skipping Bristol Post non-news URL: ${article.link}`,
          );
          return false;
        }

        // Exclude low-relevance subcategories (based on classification analysis)
        // These categories have low relevance rates and mostly produce false positives
        const excludedCategories = [
          "/news/jobs/",           // 0% relevant - job listings
          "/news/celebs-tv/",      // 0.46% - celebrity news, all false positives
          "/news/health/",         // 0.39% - health articles
          "/news/cost-of-living/", // 0.68% - finance/money articles  
          "/news/real-life/",      // 0.62% - human interest stories
          "/news/uk-world-news/",  // 1.19% - national/international news
          "/news/history/",        // 3% but only 3 "relevant", all false positives
          "/news/business/",       // 2.8% but only 2 "relevant", all false positives
          "/news/property/",       // 1.45% - property listings, all 8 "relevant" are false positives
        ];
        
        const excludedCategory = excludedCategories.find(cat => article.link.includes(cat));
        if (excludedCategory) {
          // Don't log each skip to reduce noise - these are expected exclusions
          return false;
        }

        // Exclude articles with URL slugs that are never relevant
        // (crime reports, lottery results, live updates, weather, etc.)
        const excludedUrlPatterns = [
          /stabb/i,           // stabbing/stabbed - 206 articles, 0 relevant
          /murder/i,          // murder cases - 405 articles, 0 genuinely relevant
          /lottery|euromillions|thunderball|lotto/i,  // lottery results - 122 articles, 0 relevant
          /coronavirus|covid/i,  // pandemic news - 2,075 articles, 0 genuinely relevant
          /\/live-/i,         // live updates - 1,562 articles, all FPs
          /weather|forecast|rain(?!bow)|snow|storm|temperature|freeze|frost/i,  // weather - 1,381 articles
          /hospital/i,        // hospital news - 538 articles, 0 genuinely relevant
          /\bfire\b/i,        // fire incidents - 504 articles, 0 genuinely relevant
          /jailed/i,          // court sentencing - 353 articles, 0 genuinely relevant
          /funeral|tributes?-paid|tributes?-pour/i,  // death tributes - 239 articles, 0 relevant
        ];
        
        const hasExcludedPattern = excludedUrlPatterns.some(pattern => pattern.test(article.link));
        if (hasExcludedPattern) {
          return false;
        }

        // Check date (2020 onwards)
        if (article.lastmod) {
          const year = parseInt(article.lastmod.substring(0, 4));
          if (year < 2020) {
            console.log(
              `  ⏭️  Skipping Bristol Post article before 2020: ${article.link}`,
            );
            return false;
          }
        }
      }

      if (results.some((r) => r.url === article.link)) {
        console.log(`  ⏭️  Already processed (results cache): ${article.link}`);
        stats.alreadyProcessed++;
        return false;
      }

      // Check filter cache with URL + topic ID key (backward compatible)
      const filterCacheKey = `${article.link}|||${TOPIC.id}`;
      let cachedFilter = filterOutputCache[filterCacheKey];

      // Fall back to old format (URL only) if new format not found
      if (!cachedFilter && article.link in filterOutputCache) {
        cachedFilter = filterOutputCache[article.link];
      }

      if (cachedFilter && cachedFilter.relevant === false) {
        console.log(
          `  ⏭️  Previously marked not relevant (filter cache): ${article.link}`,
        );
        stats.notRelevant++;
        return false;
      }

      const failCount = failCache[article.link]?.count || 0;
      if (failCount >= 2) {
        console.log(
          `  ⏭️  Previously failed ${failCount}x (scrape failure cache): ${article.link}`,
        );
        stats.scrapeFailed++;
        return false;
      }

      return true;
    });

    console.log(
      `\n⚡ Step 1: Scraping ${articlesToProcess.length} articles (adaptive concurrency: ${adaptiveConcurrency.getCurrent()})...\n`,
    );

    // Step 1: Scrape all articles in parallel
    const scrapedArticles = [];
    const scrapeArticle = async (article) => {
      const scrapeResult = await scrape(article.link);
      const text =
        scrapeResult && typeof scrapeResult === "object"
          ? scrapeResult.text
          : scrapeResult;

      if (!text || text.length < 100) {
        stats.scrapeFailed++;
        return null;
      }

      const title =
        article.title && article.title !== "Untitled"
          ? article.title
          : text.substring(0, 100);

      return {
        url: article.link,
        title,
        text,
        author: scrapeResult?.author || null,
        originalArticle: article,
        fromCache: scrapeResult?.fromCache || false,
      };
    };

    const scrapeResults = await processInParallel(
      articlesToProcess,
      scrapeArticle,
      adaptiveConcurrency,
    );

    // Collect successful scrapes
    for (const result of scrapeResults) {
      if (result.status === "fulfilled" && result.value) {
        scrapedArticles.push(result.value);
      }
    }

    console.log(`\n✅ Scraped ${scrapedArticles.length} articles successfully`);

    if (scrapedArticles.length === 0) {
      console.log(`⏭️  No articles to classify`);
    } else {
      // Step 2: Batch classify articles
      console.log(
        `\n⚡ Step 2: Batch classifying ${scrapedArticles.length} articles (batch size: ${CLASSIFICATION_BATCH_SIZE})...\n`,
      );

      const relevantArticles = [];

      for (
        let i = 0;
        i < scrapedArticles.length;
        i += CLASSIFICATION_BATCH_SIZE
      ) {
        const batch = scrapedArticles.slice(i, i + CLASSIFICATION_BATCH_SIZE);
        console.log(
          `\n🔍 Classifying batch ${
            Math.floor(i / CLASSIFICATION_BATCH_SIZE) + 1
          } (${batch.length} articles from ${batch[0]?.url?.match(/https?:\/\/[^/]+/)?.[0] || 'unknown'})...`,
        );
        // Show URLs being classified
        batch.forEach((a, idx) => console.log(`  [${i + idx + 1}] ${a.url}`));

        try {
          const batchInput = batch.map((a) => ({
            url: a.url,
            title: a.title,
            content: a.text,
          }));

          const classificationResults = await filterBatch(
            batchInput,
            TOPIC.id,
            TOPIC.prompt,
          );

          // Process results
          for (const result of classificationResults) {
            if (result.relevant) {
              const article = batch.find((a) => a.url === result.url);
              relevantArticles.push(article);
              console.log(
                `  ✓ Relevant: ${result.url} (score: ${result.score.toFixed(
                  3,
                )})`,
              );
            } else {
              stats.notRelevant++;
              console.log(
                `  ✗ Not relevant: ${result.url} (score: ${result.score.toFixed(
                  3,
                )})`,
              );
            }
          }

          // Add delay between batches to avoid rate limiting (500 RPM = ~120ms per request)
          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (err) {
          console.log(`  ❌ Batch classification error: ${err.message}`);
          // Fall back to individual classification for this batch
          for (const article of batch) {
            try {
              const isRelevant = await filter(
                article.url,
                article.title,
                article.text,
                TOPIC.id,
                TOPIC.description,
              );
              if (isRelevant) {
                relevantArticles.push(article);
              } else {
                stats.notRelevant++;
              }
            } catch (filterErr) {
              console.log(
                `  ❌ Filter error for ${article.url}: ${filterErr.message}`,
              );
            }
          }
        }
      }

      console.log(`\n✅ Found ${relevantArticles.length} relevant articles`);

      // Step 3: Analyze relevant articles
      if (relevantArticles.length > 0) {
        console.log(
          `\n⚡ Step 3: Analyzing ${relevantArticles.length} relevant articles...\n`,
        );

        for (const article of relevantArticles) {
          console.log(`🧠 Analyzing: ${article.url}`);
          const analysis = await analyze(site, article.text, article.title, TOPIC.id, article.author);

          if (!analysis) {
            console.log(`  ❌ Analysis failed, skipping`);
            stats.analysisFailed++;
            continue;
          }

          console.log(
            `  📊 ${analysis.sentiment} | ${analysis.main_angle} | ${analysis.sentiment_score}`,
          );

          const entry = {
            source: site,
            url: article.url,
            title: article.title,
            full_headline: article.title,
            topic: TOPIC.id,
            topic_description: TOPIC.description,
            ...analysis,
            // Normalize publication to match source for consistency
            publication: site.replace(/^https?:\/\//, '').replace(/\/$/, ''),
          };

          results.push(entry);
          writeFileSync(resultsFile, JSON.stringify(results, null, 2));

          console.log(`  💾 Saved (${results.length} total)`);
          stats.processed++;
        }
      }
    }

    console.log(`\n📊 ${site} Summary:`);
    console.log(`  Discovered: ${stats.discovered}`);
    if (MAX_ARTICLES_PER_SITE) {
      console.log(
        `  Limited to: ${stats.limited} (MAX_ARTICLES_PER_SITE = ${MAX_ARTICLES_PER_SITE})`,
      );
    }
    console.log(`  Already processed: ${stats.alreadyProcessed}`);
    console.log(`  Not relevant: ${stats.notRelevant}`);
    console.log(`  Scrape failed: ${stats.scrapeFailed}`);
    console.log(`  Analysis failed: ${stats.analysisFailed}`);
    console.log(`  ✅ Successfully processed: ${stats.processed}\n`);
  }

  console.log(`\n✨ Done! Analyzed ${results.length} articles.`);
  console.log(`📊 Results saved to ${resultsFile}`);

  // Generate topic-specific dashboard
  generateDashboard(TOPIC.id, TOPIC.description);

  // Generate index page with all topics
  generateIndex();
}

main().catch(console.error);
