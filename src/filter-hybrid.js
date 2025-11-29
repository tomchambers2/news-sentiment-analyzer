import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";

const FILTER_INPUT_FILE = "cache/2_filter/filter_input.json";
const FILTER_OUTPUT_FILE = "cache/2_filter/filter_output.json";

// Load/save cache functions
function loadFilterInputCache() {
  if (existsSync(FILTER_INPUT_FILE)) {
    return JSON.parse(readFileSync(FILTER_INPUT_FILE, "utf-8"));
  }
  return {};
}

function loadFilterOutputCache() {
  if (existsSync(FILTER_OUTPUT_FILE)) {
    return JSON.parse(readFileSync(FILTER_OUTPUT_FILE, "utf-8"));
  }
  return {};
}

function saveFilterInputCache(cache) {
  mkdirSync("cache/2_filter", { recursive: true });
  writeFileSync(FILTER_INPUT_FILE, JSON.stringify(cache, null, 2));
}

function saveFilterOutputCache(cache) {
  mkdirSync("cache/2_filter", { recursive: true });
  writeFileSync(FILTER_OUTPUT_FILE, JSON.stringify(cache, null, 2));
}

/**
 * Keyword-based classifier (free, instant)
 * Uses carefully selected keywords to identify relevant articles
 */
function classifyByKeywords(title, content) {
  const text = `${title} ${content}`.toLowerCase();

  // Strong positive indicators - almost certainly relevant
  const strongPositiveKeywords = [
    'low traffic neighbourhood',
    'ltn',
    'modal filter',
    'liveable neighbourhood',
    'liveable street',
    'traffic calming',
    'school street',
    'rat running',
    'through traffic',
    'traffic filter',
    'pedestrianisation',
    'pedestrianization',
    'cycle lane opposition',
    'traffic scheme protest',
  ];

  // Moderate positive indicators - likely relevant
  const moderatePositiveKeywords = [
    'resident parking zone',
    'parking permit',
    'traffic restriction',
    'road closure',
    '20mph zone',
    'speed limit',
    'cycle lane',
    'bike lane',
    'pedestrian zone',
    'car free',
    'transport policy',
    'transport plan',
    'clean air zone',
  ];

  // Strong negative indicators - almost certainly NOT relevant
  const strongNegativeKeywords = [
    'ofsted',
    'school rating',
    'love island',
    'celebrity',
    'recipe',
    'cooking',
    'cleaning',
    'martin lewis',
    'money saving',
    'masterchef',
    'strictly come dancing',
    'bake off',
    'coronavirus',
    'covid-19',
    'covid',
    'weather forecast',
  ];

  // Moderate negative indicators - likely NOT relevant
  const moderateNegativeKeywords = [
    'm5 closed',
    'm4 closed',
    'motorway closure',
    'motorway accident',
    'crash on',
    'collision on',
    'primary school',
    'secondary school',
    'academy',
    'dog missing',
    'dog found',
  ];

  // Check strong positive
  for (const keyword of strongPositiveKeywords) {
    if (text.includes(keyword)) {
      return { relevant: true, confidence: 0.95, method: 'keyword-strong-positive', keyword };
    }
  }

  // Check strong negative
  for (const keyword of strongNegativeKeywords) {
    if (text.includes(keyword)) {
      return { relevant: false, confidence: 0.95, method: 'keyword-strong-negative', keyword };
    }
  }

  // Count moderate indicators
  let positiveCount = 0;
  let positiveKeywords = [];
  for (const keyword of moderatePositiveKeywords) {
    if (text.includes(keyword)) {
      positiveCount++;
      positiveKeywords.push(keyword);
    }
  }

  let negativeCount = 0;
  let negativeKeywords = [];
  for (const keyword of moderateNegativeKeywords) {
    if (text.includes(keyword)) {
      negativeCount++;
      negativeKeywords.push(keyword);
    }
  }

  // Multiple positive indicators = likely relevant
  if (positiveCount >= 2) {
    return {
      relevant: true,
      confidence: 0.75,
      method: 'keyword-moderate-positive',
      keywords: positiveKeywords.join(', ')
    };
  }

  // Multiple negative indicators = likely not relevant
  if (negativeCount >= 2) {
    return {
      relevant: false,
      confidence: 0.75,
      method: 'keyword-moderate-negative',
      keywords: negativeKeywords.join(', ')
    };
  }

  // Single positive, no negative = possibly relevant
  if (positiveCount === 1 && negativeCount === 0) {
    return {
      relevant: true,
      confidence: 0.60,
      method: 'keyword-weak-positive',
      keyword: positiveKeywords[0]
    };
  }

  // Single negative, no positive = possibly not relevant
  if (negativeCount === 1 && positiveCount === 0) {
    return {
      relevant: false,
      confidence: 0.60,
      method: 'keyword-weak-negative',
      keyword: negativeKeywords[0]
    };
  }

  // No strong indicators = uncertain
  return { relevant: false, confidence: 0.50, method: 'keyword-uncertain' };
}

/**
 * Batch filter using keyword classifier (free)
 * @param {Array<{url: string, title: string, content: string}>} articles
 * @param {string} topicId
 * @param {string} topicDescription
 * @returns {Promise<Array<{url: string, relevant: boolean, reasoning: string, score: number}>>}
 */
export async function filterBatch(articles, topicId, topicDescription) {
  const inputCache = loadFilterInputCache();
  const outputCache = loadFilterOutputCache();

  const results = [];

  for (const article of articles) {
    const cacheKey = `${article.url}|||${topicId}`;

    // Check cache
    let cached = outputCache[cacheKey];
    if (cached) {
      const relevant = typeof cached === "boolean" ? cached : cached.relevant;
      results.push({
        url: article.url,
        relevant,
        cached: true,
        reasoning: cached.reasoning || "Cached result",
        score: cached.score || (relevant ? 1.0 : 0.0),
      });
      continue;
    }

    // Classify with keywords
    const excerpt = article.content.slice(0, 1500);
    const classification = classifyByKeywords(article.title, excerpt);

    const reasoning = classification.keyword
      ? `Keyword classifier (${classification.method}): matched "${classification.keyword}"`
      : classification.keywords
      ? `Keyword classifier (${classification.method}): matched ${classification.keywords}`
      : `Keyword classifier: ${classification.method}`;

    // Cache input
    inputCache[article.url] = {
      title: article.title,
      content: excerpt,
      topicId,
      topicDescription,
      method: "keyword-classifier",
    };

    // Cache output
    outputCache[cacheKey] = {
      relevant: classification.relevant,
      reasoning,
      score: classification.confidence,
    };

    results.push({
      url: article.url,
      relevant: classification.relevant,
      cached: false,
      reasoning,
      score: classification.confidence,
    });
  }

  // Save caches
  saveFilterInputCache(inputCache);
  saveFilterOutputCache(outputCache);

  return results;
}

/**
 * Filter single article
 */
export async function filter(url, title, content, topicId, topicDescription) {
  const result = await filterBatch(
    [{ url, title, content }],
    topicId,
    topicDescription
  );
  return result[0].relevant;
}
