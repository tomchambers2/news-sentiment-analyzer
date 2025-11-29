import Anthropic from "@anthropic-ai/sdk";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";
const FILTER_INPUT_FILE = "cache/2_filter/filter_input.json";
const FILTER_OUTPUT_FILE = "cache/2_filter/filter_output.json";

// Load/save cache functions (same as before)
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
 * Batch filter multiple articles using Claude (Anthropic API)
 * @param {Array<{url: string, title: string, content: string}>} articles - Articles to classify
 * @param {string} topicId - Topic ID for caching (stable identifier)
 * @param {string} topicDescription - Topic description for classification
 * @returns {Promise<Array<{url: string, relevant: boolean, reasoning: string, score: number}>>}
 */
export async function filterBatch(articles, topicId, topicDescription) {
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

  // Process in smaller batches to avoid token limits
  const BATCH_SIZE = 20;
  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

  for (let i = 0; i < uncached.length; i += BATCH_SIZE) {
    const batch = uncached.slice(i, i + BATCH_SIZE);

    // Create prompt for batch classification
    const articlesText = batch
      .map((article, idx) => {
        const excerpt = article.content.slice(0, 800);
        return `
Article ${idx + 1}:
Title: ${article.title}
Content: ${excerpt}
`;
      })
      .join("\n---\n");

    const prompt = `You are classifying news articles to determine if they are relevant to: "${topicDescription}".

Articles that ARE relevant include:
- Policy announcements about low traffic neighbourhoods, modal filters, or liveable streets
- Community responses, protests, or debates about these traffic schemes
- Implementation details of traffic calming measures
- Local government decisions on transport policy related to these schemes

Articles that are NOT relevant include:
- General traffic accidents or motorway closures (M5, M4, etc.)
- School news or ratings
- Entertainment, celebrity, lifestyle, cooking, or cleaning articles
- Sports news
- General crime or human interest stories

For each article below, respond with ONLY a JSON array. Each element should be:
{"relevant": true/false, "confidence": 0.0-1.0, "reasoning": "brief explanation"}

${articlesText}

Respond with ONLY the JSON array, no other text:`;

    try {
      const message = await client.messages.create({
        model: "claude-3-5-haiku-20241022",
        max_tokens: 2000,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      });

      const responseText = message.content[0].text;
      const classifications = JSON.parse(responseText);

      // Process classifications
      batch.forEach((article, idx) => {
        const classification = classifications[idx];
        const excerpt = article.content.slice(0, 1500);

        // Cache input
        inputCache[article.url] = {
          title: article.title,
          content: excerpt,
          topicId,
          topicDescription,
          method: "claude-haiku",
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
    } catch (error) {
      console.log(`    ⚠️ Claude Classifier failed: ${error.message}`);
      throw error;
    }
  }

  return results;
}

/**
 * Filter single article using Claude
 * @param {string} url - Article URL
 * @param {string} title - Article title
 * @param {string} content - Full article text
 * @param {string} topicId - Topic ID for caching
 * @param {string} topicDescription - Topic description
 * @returns {Promise<boolean>} - True if article is relevant
 */
export async function filter(url, title, content, topicId, topicDescription) {
  const outputCache = loadFilterOutputCache();
  const cacheKey = `${url}|||${topicId}`;

  // Check cache
  let cached = outputCache[cacheKey];
  if (cached) {
    return typeof cached === "boolean" ? cached : cached.relevant;
  }

  // Use batch function for single article
  const result = await filterBatch(
    [{ url, title, content }],
    topicId,
    topicDescription
  );

  return result[0].relevant;
}
