import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { prompts } from "../prompts.js";

const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Load prompt from prompts.js
function loadPrompt() {
  return prompts.analyzer.prompt;
}

/**
 * Analyze article with AI to extract sentiment and features
 * @param {string} site - Publication site
 * @param {string} text - Article text content
 * @param {string} title - Article title
 * @returns {Promise<Object|null>} - Analysis results or null on failure
 */
export async function analyze(site, text, title) {
  // Load prompt template and substitute variables
  const promptTemplate = loadPrompt();
  const prompt = promptTemplate
    .replace(/\$\{site\}/g, site)
    .replace(/\$\{title\}/g, title)
    .replace(/\$\{text\}/g, text);

  const { text: result } = await generateText({
    model: openai("gpt-4o-mini"),
    prompt: prompt,
  });

  const jsonMatch = result.match(/\{[\s\S]*\}/);
  return jsonMatch ? JSON.parse(jsonMatch[0]) : null;
}
