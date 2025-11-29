import axios from "axios";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";

const JINA_CLASSIFIER_URL = "https://api.jina.ai/v1/classify";
const JINA_API_KEY = process.env.JINA_API_KEY || "";

const FILTER_INPUT_FILE = "cache/2_filter/filter_input.json";
const FILTER_OUTPUT_FILE = "cache/2_filter/filter_output.json";

// Load filter input cache
function loadFilterInputCache() {
  if (existsSync(FILTER_INPUT_FILE)) {
    return JSON.parse(readFileSync(FILTER_INPUT_FILE, "utf-8"));
  }
  return {};
}

// Load filter output cache
function loadFilterOutputCache() {
  if (existsSync(FILTER_OUTPUT_FILE)) {
    return JSON.parse(readFileSync(FILTER_OUTPUT_FILE, "utf-8"));
  }
  return {};
}

// Save filter input cache
function saveFilterInputCache(cache) {
  mkdirSync("cache/2_filter", { recursive: true });
  writeFileSync(FILTER_INPUT_FILE, JSON.stringify(cache, null, 2));
}

// Save filter output cache
function saveFilterOutputCache(cache) {
  mkdirSync("cache/2_filter", { recursive: true });
  writeFileSync(FILTER_OUTPUT_FILE, JSON.stringify(cache, null, 2));
}

/**
 * Batch filter multiple articles using Jina AI Classifier
 * @param {Array<{url: string, title: string, content: string}>} articles - Articles to classify
 * @param {string} topicId - Topic ID for caching (stable identifier)
 * @param {string} topicDescription - Topic description for classification (can be refined)
 * @returns {Promise<Array<{url: string, relevant: boolean, reasoning: string, score: number}>>}
 */
export async function filterBatch(articles, topicId, topicDescription) {
  const inputCache = loadFilterInputCache();
  const outputCache = loadFilterOutputCache();

  // Separate cached and uncached articles
  const uncached = [];
  const results = [];

  for (const article of articles) {
    // Create cache key combining URL and topic ID
    const cacheKey = `${article.url}|||${topicId}`;

    // Check new format (URL|||topicId) first, then fall back to old format (URL only)
    let cached = outputCache[cacheKey];
    if (!cached && article.url in outputCache) {
      // Migrate old format to new format for this topic
      cached = outputCache[article.url];
      outputCache[cacheKey] = cached;
      console.log(`  🔄 Migrated cache entry to new format: ${article.url}`);
    }

    if (cached) {
      const relevant = typeof cached === "boolean" ? cached : cached.relevant;
      results.push({
        url: article.url,
        relevant,
        cached: true,
        reasoning: cached.reasoning || "Cached result",
        score: cached.score || 0,
      });
    } else {
      uncached.push(article);
    }
  }

  if (uncached.length === 0) {
    return results;
  }

  // Define labels for zero-shot classification
  // Shorter, more distinct labels work better with embedding-based classification
  const labels = [
    "Transport policy: Low traffic neighbourhoods, modal filters, liveable streets, traffic calming schemes, and community responses to these measures",
    "General Bristol news: Entertainment, lifestyle, cooking, cleaning, sports, crime, accidents, schools, weather, and unrelated local stories"
  ];

  try {
    if (!JINA_API_KEY) {
      throw new Error("JINA_API_KEY not found in environment");
    }

    const headers = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${JINA_API_KEY}`,
    };

    // Prepare batch input - Jina API expects array of strings, not objects
    const batchInput = uncached.map(article => {
      const excerpt = article.content.slice(0, 1500);
      return `Title: ${article.title}\n\nContent: ${excerpt}`;
    });

    const requestBody = {
      model: "jina-embeddings-v3",
      labels: labels,
      input: batchInput,
    };

    const response = await axios.post(
      JINA_CLASSIFIER_URL,
      requestBody,
      { headers, timeout: 60000 } // Longer timeout for batch
    );

    // Process batch results
    for (let i = 0; i < uncached.length; i++) {
      const article = uncached[i];
      const predictions = response.data.data[i].predictions;

      // Find the label with highest score
      const bestPrediction = predictions.reduce((max, pred) =>
        pred.score > max.score ? pred : max
      );

      // Minimum confidence threshold to filter out uncertain classifications
      const MIN_CONFIDENCE_THRESHOLD = 0.60;

      // Check if Transport policy label has highest score AND meets confidence threshold
      const isTransportPolicy = bestPrediction.label.startsWith("Transport policy");
      const meetsThreshold = bestPrediction.score >= MIN_CONFIDENCE_THRESHOLD;
      const relevant = isTransportPolicy && meetsThreshold;

      const reasoning = `Jina Classifier score: ${bestPrediction.score.toFixed(3)} for "${bestPrediction.label.substring(0, 50)}..." ${!meetsThreshold ? '(below threshold)' : ''}`;

      // Cache the input (use URL as key since it's just for reference)
      const excerpt = article.content.slice(0, 1500);
      inputCache[article.url] = {
        title: article.title,
        content: excerpt,
        topicId,
        topicDescription,
        method: "jina-classifier-batch",
      };

      // Cache the output with URL + topic ID as key
      const cacheKey = `${article.url}|||${topicId}`;
      outputCache[cacheKey] = {
        relevant,
        reasoning,
        score: bestPrediction.score,
      };

      results.push({
        url: article.url,
        relevant,
        cached: false,
        reasoning,
        score: bestPrediction.score,
      });
    }

    // Save caches
    saveFilterInputCache(inputCache);
    saveFilterOutputCache(outputCache);

    return results;
  } catch (error) {
    console.log(`    ⚠️ Jina Batch Classifier failed: ${error.message}`);
    throw error;
  }
}

/**
 * Filter article using Jina AI Classifier to determine relevance to topic
 * @param {string} url - Article URL (used as cache key)
 * @param {string} title - Article title
 * @param {string} content - Full article text
 * @param {string} topicId - Topic ID for caching (stable identifier)
 * @param {string} topicDescription - Topic description for classification (can be refined)
 * @returns {Promise<boolean>} - True if article is relevant
 */
export async function filter(url, title, content, topicId, topicDescription) {
  // Check cache first
  const inputCache = loadFilterInputCache();
  const outputCache = loadFilterOutputCache();

  // Create cache key combining URL and topic ID
  const cacheKey = `${url}|||${topicId}`;

  // Check new format (URL|||topicId) first, then fall back to old format (URL only)
  let cached = outputCache[cacheKey];
  if (!cached && url in outputCache) {
    // Migrate old format to new format for this topic
    cached = outputCache[url];
    outputCache[cacheKey] = cached;
    saveFilterOutputCache(outputCache);
    console.log(`  🔄 Migrated cache entry to new format: ${url}`);
  }

  if (cached) {
    // Handle both old format (boolean) and new format (object with reasoning)
    return typeof cached === "boolean" ? cached : cached.relevant;
  }

  // Prepare input for classifier (use first 1500 chars of content)
  const excerpt = content.slice(0, 1500);
  const input = `Title: ${title}\n\nContent: ${excerpt}`;

  // Define labels for zero-shot classification
  // Shorter, more distinct labels work better with embedding-based classification
  const labels = [
    "Transport policy: Low traffic neighbourhoods, modal filters, liveable streets, traffic calming schemes, and community responses to these measures",
    "General Bristol news: Entertainment, lifestyle, cooking, cleaning, sports, crime, accidents, schools, weather, and unrelated local stories"
  ];

  // Cache the input that was sent to the AI
  inputCache[url] = {
    title,
    content: excerpt,
    topicId,
    topicDescription,
    method: "jina-classifier",
  };
  saveFilterInputCache(inputCache);

  try {
    if (!JINA_API_KEY) {
      throw new Error("JINA_API_KEY not found in environment");
    }

    const headers = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${JINA_API_KEY}`,
    };

    const requestBody = {
      model: "jina-embeddings-v3",
      labels: labels,
      input: [input],  // Jina API expects array of strings, not objects
    };

    const response = await axios.post(
      JINA_CLASSIFIER_URL,
      requestBody,
      { headers, timeout: 30000 }
    );

    // Jina Classifier returns predictions with scores for each label
    const predictions = response.data.data[0].predictions;

    // Find the label with highest score
    const bestPrediction = predictions.reduce((max, pred) =>
      pred.score > max.score ? pred : max
    );

    // Minimum confidence threshold to filter out uncertain classifications
    const MIN_CONFIDENCE_THRESHOLD = 0.60;

    // Article is relevant if "Transport policy" label has highest score AND meets confidence threshold
    const isTransportPolicy = bestPrediction.label.startsWith("Transport policy");
    const meetsThreshold = bestPrediction.score >= MIN_CONFIDENCE_THRESHOLD;
    const result = isTransportPolicy && meetsThreshold;

    const reasoning = `Jina Classifier score: ${bestPrediction.score.toFixed(3)} for "${bestPrediction.label.substring(0, 50)}..." ${!meetsThreshold ? '(below threshold)' : ''}`;

    // Cache the output decision with reasoning (keyed by URL + topic ID)
    const cacheKey = `${url}|||${topicId}`;
    outputCache[cacheKey] = {
      relevant: result,
      reasoning: reasoning,
      score: bestPrediction.score,
    };
    saveFilterOutputCache(outputCache);

    return result;
  } catch (error) {
    console.log(`    ⚠️ Jina Classifier failed: ${error.message}`);

    // Don't cache API errors (402, 429, 500, etc.) - only cache actual classification results
    // This allows retrying when the API is working again
    throw error;
  }
}
