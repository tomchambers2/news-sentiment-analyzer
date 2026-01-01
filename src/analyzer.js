import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { getTopic } from "./topics.js";

const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Analyze article with AI to extract sentiment and features
 * @param {string} site - Publication site
 * @param {string} text - Article text content
 * @param {string} title - Article title
 * @param {string} topicId - Topic ID to get the correct analyzer prompt
 * @param {string|null} author - Article author (from metadata)
 * @returns {Promise<Object|null>} - Analysis results or null on failure
 */
export async function analyze(site, text, title, topicId, author = null) {
  // Get topic-specific analyzer prompt
  const topic = getTopic(topicId);
  if (!topic.analyzerPrompt) {
    throw new Error(`Topic "${topicId}" has no analyzerPrompt defined`);
  }

  // Substitute variables in prompt
  const prompt = topic.analyzerPrompt
    .replace(/\$\{site\}/g, site)
    .replace(/\$\{title\}/g, title)
    .replace(/\$\{text\}/g, text);

  const { text: result } = await generateText({
    model: openai("gpt-4o-mini"),
    prompt: prompt,
  });

  const jsonMatch = result.match(/\{[\s\S]*\}/);
  const analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
  
  // Override author with metadata if available
  if (analysis && author) {
    analysis.author = author;
  }
  
  return analysis;
}
