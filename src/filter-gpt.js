import OpenAI from "openai";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
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
 * Batch filter multiple articles using GPT-4o-mini
 * @param {Array<{url: string, title: string, content: string}>} articles - Articles to classify
 * @param {string} topicId - Topic ID for caching (stable identifier)
 * @param {string} topicPrompt - Classification prompt from topic config
 * @returns {Promise<Array<{url: string, relevant: boolean, reasoning: string, score: number}>>}
 */
export async function filterBatch(articles, topicId, topicPrompt) {
  const inputCache = loadFilterInputCache();
  const outputCache = loadFilterOutputCache();

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

  // Batch size 10 for reliable alignment - larger batches can cause ordering issues
  const BATCH_SIZE = 10;
  const client = new OpenAI({ apiKey: OPENAI_API_KEY });

  for (let i = 0; i < uncached.length; i += BATCH_SIZE) {
    const batch = uncached.slice(i, i + BATCH_SIZE);

    // Create prompt for batch classification - use numbered format, no delimiter that could appear in content
    const articlesText = batch
      .map((article, idx) => {
        const excerpt = article.content.slice(0, 600).replace(/\n/g, ' '); // Flatten to single line
        return `[${idx + 1}] "${article.title}" - ${excerpt}`;
      })
      .join("\n\n");

    const prompt = `${topicPrompt}

Articles to classify (${batch.length} total):

${articlesText}

Respond with EXACTLY ${batch.length} JSON objects (one per article, in order):
[{"relevant": true/false, "confidence": 0.0-1.0, "reasoning": "5 words max"}]`;

    try {
      const response = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: batch.length * 60, // ~60 tokens per article response
        temperature: 0,
      });

      const responseText = response.choices[0].message.content;

      // Parse JSON, handling potential markdown code blocks
      let jsonText = responseText.trim();
      if (jsonText.startsWith("```")) {
        jsonText = jsonText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
      }

      const classifications = JSON.parse(jsonText);

      // STRICT: Result count must match exactly to prevent alignment issues
      if (classifications.length !== batch.length) {
        console.log(`    ⚠️ Got ${classifications.length} results for ${batch.length} articles - SKIPPING (alignment risk)`);
        continue; // Skip this batch, will be retried next run
      }

      // Process classifications
      batch.forEach((article, idx) => {
        const classification = classifications[idx];
        const excerpt = article.content.slice(0, 1500);

        // Cache input
        inputCache[article.url] = {
          title: article.title,
          content: excerpt,
          topicId,
          method: "gpt-4o-mini",
        };

        // Cache output
        const cacheKey = `${article.url}|||${topicId}`;
        outputCache[cacheKey] = {
          relevant: classification.relevant,
          reasoning: classification.reasoning,
          score: classification.confidence,
        };

        results.push({
          url: article.url,
          relevant: classification.relevant,
          cached: false,
          reasoning: classification.reasoning,
          score: classification.confidence,
        });
      });

      // Save caches after each batch
      saveFilterInputCache(inputCache);
      saveFilterOutputCache(outputCache);

      // Log progress
      if (uncached.length > BATCH_SIZE) {
        console.log(`    📝 ${Math.min(i + BATCH_SIZE, uncached.length)}/${uncached.length} classified`);
      }
    } catch (error) {
      console.log(`    ⚠️ GPT-4o-mini Classifier failed: ${error.message}`);
      throw error;
    }
  }

  return results;
}

/**
 * Filter single article using GPT-4o-mini
 */
export async function filter(url, title, content, topicId, topicPrompt) {
  const outputCache = loadFilterOutputCache();
  const cacheKey = `${url}|||${topicId}`;

  let cached = outputCache[cacheKey];
  if (cached) {
    return typeof cached === "boolean" ? cached : cached.relevant;
  }

  const result = await filterBatch(
    [{ url, title, content }],
    topicId,
    topicPrompt
  );

  return result[0].relevant;
}
