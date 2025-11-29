import axios from "axios";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";

const JINA_API_KEY = process.env.JINA_API_KEY || "";
const JINA_CLASSIFY_URL = "https://api.jina.ai/v1/classify";

const FILTER_INPUT_FILE = "cache/2_filter/filter_input.json";
const FILTER_OUTPUT_FILE = "cache/2_filter/filter_output.json";

// Load classifier ID from file
function loadClassifierId() {
  try {
    const content = readFileSync("jina-classifier-id.txt", "utf-8");
    const classifierId = content.split("\n")[0].trim();
    return classifierId;
  } catch (error) {
    throw new Error(
      "Classifier ID not found! Please run: node train-jina-fewshot.js first"
    );
  }
}

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
 * Batch filter using trained Jina few-shot classifier
 * @param {Array<{url: string, title: string, content: string}>} articles
 * @param {string} topicId
 * @param {string} topicDescription
 * @returns {Promise<Array<{url: string, relevant: boolean, reasoning: string, score: number}>>}
 */
export async function filterBatch(articles, topicId, topicDescription) {
  const inputCache = loadFilterInputCache();
  const outputCache = loadFilterOutputCache();
  const classifierId = loadClassifierId();

  // Separate cached and uncached articles
  const uncached = [];
  const results = [];

  for (const article of articles) {
    const cacheKey = `${article.url}|||${topicId}`;
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
    } else {
      uncached.push(article);
    }
  }

  if (uncached.length === 0) {
    return results;
  }

  if (!JINA_API_KEY) {
    throw new Error("JINA_API_KEY not found in environment");
  }

  // Process in batches (Jina supports up to 1024)
  const BATCH_SIZE = 512;

  for (let i = 0; i < uncached.length; i += BATCH_SIZE) {
    const batch = uncached.slice(i, i + BATCH_SIZE);

    // Prepare batch input
    const batchInput = batch.map((article) => {
      const excerpt = article.content.slice(0, 1500);
      return `${article.title}. ${excerpt}`;
    });

    try {
      const response = await axios.post(
        JINA_CLASSIFY_URL,
        {
          classifier_id: classifierId,
          input: batchInput,
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${JINA_API_KEY}`,
          },
          timeout: 60000,
        }
      );

      // Process results
      batch.forEach((article, idx) => {
        const predictions = response.data.data[idx].predictions;

        // Find highest scoring prediction
        const bestPrediction = predictions.reduce((max, pred) =>
          pred.score > max.score ? pred : max
        );

        const relevant = bestPrediction.label === "relevant";
        const reasoning = `Jina Few-Shot: ${bestPrediction.label} (score: ${bestPrediction.score.toFixed(
          3
        )})`;

        // Cache input
        const excerpt = article.content.slice(0, 1500);
        inputCache[article.url] = {
          title: article.title,
          content: excerpt,
          topicId,
          topicDescription,
          method: "jina-fewshot",
        };

        // Cache output
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
      });

      // Save caches after each batch
      saveFilterInputCache(inputCache);
      saveFilterOutputCache(outputCache);
    } catch (error) {
      console.log(`    ⚠️ Jina Few-Shot Classifier failed: ${error.message}`);
      throw error;
    }
  }

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
