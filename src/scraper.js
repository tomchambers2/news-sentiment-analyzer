import axios from "axios";
import { getArticle, saveArticle, getFailure, saveFailure, deleteFailure } from "./cache-db.js";

// Jina AI Reader API configuration
const JINA_READER_BASE_URL = "https://r.jina.ai/";
const JINA_API_KEY = process.env.JINA_API_KEY || ""; // Optional - increases rate limits

/**
 * Scrape with Jina AI Reader API
 * @param {string} url - URL to scrape
 * @returns {Promise<string>} - Scraped text content (clean markdown)
 */
async function scrapeWithJina(url) {
  const jinaUrl = `${JINA_READER_BASE_URL}${url}`;

  const headers = {
    "Accept": "application/json",
  };

  // Add API key if available for higher rate limits
  if (JINA_API_KEY) {
    headers["Authorization"] = `Bearer ${JINA_API_KEY}`;
  }

  const response = await axios.get(jinaUrl, {
    headers,
    timeout: 60000, // 60 seconds - Jina AI may take longer for complex pages
  });

  // Jina AI returns JSON with structured data
  if (response.data && response.data.data) {
    const { content, title } = response.data.data;
    // Combine title and content for full article text
    const fullText = title ? `${title}\n\n${content}` : content;
    return fullText.replace(/\s+/g, " ").trim();
  }

  throw new Error("Invalid response from Jina AI Reader API");
}

/**
 * Scrape article text using Jina AI Reader API
 * @param {string} url - URL to scrape
 * @returns {Promise<{text: string, fromCache: boolean}|null>} - Scraped text content or null on failure
 */
export async function scrape(url) {
  // Check cache first (instant SQLite lookup)
  const cachedText = getArticle(url);
  if (cachedText) {
    return { text: cachedText, fromCache: true };
  }

  try {
    const text = await scrapeWithJina(url);

    // Cache the scraped text
    saveArticle(url, text);

    // Clear failure record on success
    deleteFailure(url);

    return { text, fromCache: false };
  } catch (err) {
    // Log the full error for debugging
    const errorMessage = err.response?.data
      ? JSON.stringify(err.response.data)
      : err.message;

    // Check for rate limit errors
    const isRateLimited =
      err.response?.status === 429 ||
      err.message.includes('429') ||
      errorMessage.includes('blocked') ||
      errorMessage.includes('DDoS') ||
      errorMessage.includes('rate');

    // Only cache permanent failures (404, etc.), not transient errors
    const isTransientError =
      err.message.includes('timeout') ||
      err.message.includes('ECONNRESET') ||
      err.message.includes('ETIMEDOUT') ||
      err.message.includes('500') || // Server errors are usually transient
      err.message.includes('502') ||
      err.message.includes('503') ||
      isRateLimited;

    if (!isTransientError) {
      // Record permanent failure
      const existing = getFailure(url);
      const count = existing ? existing.count + 1 : 1;
      saveFailure(url, errorMessage, count);
      console.log(`    ⚠️ Permanent failure for ${url}: ${errorMessage}`);
    }

    // Return error info for adaptive concurrency
    if (isRateLimited) {
      const error = new Error('RATE_LIMITED');
      error.isRateLimited = true;
      throw error;
    }

    return null;
  }
}
