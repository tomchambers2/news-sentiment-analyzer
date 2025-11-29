import "dotenv/config";
import { existsSync, readFileSync, writeFileSync } from "fs";
import readline from "readline";

const TEST_CASES_FILE = "./prompt-optimizer/test_cases.json";
const FILTER_INPUT_CACHE = "./cache/2_filter/filter_input.json";
const FILTER_OUTPUT_CACHE = "./cache/2_filter/filter_output.json";
const RESULTS_FILE = "./results.json";
const TEXT_CACHE = "./cache/3_scrape/article_text.json";

// Load or initialize test cases
function loadTestCases() {
  if (existsSync(TEST_CASES_FILE)) {
    return JSON.parse(readFileSync(TEST_CASES_FILE, "utf-8"));
  }
  return {
    filter_test_cases: [],
    analyzer_test_cases: [],
  };
}

// Save test cases
function saveTestCases(testCases) {
  writeFileSync(TEST_CASES_FILE, JSON.stringify(testCases, null, 2));
}

// Sample random items from filter cache
function sampleFilterResults(n = 20) {
  if (!existsSync(FILTER_CACHE)) {
    console.log("❌ No filter_cache.json found. Run the analyzer first.");
    return [];
  }

  const cache = JSON.parse(readFileSync(FILTER_CACHE, "utf-8"));
  const entries = Object.entries(cache);

  // Sample random entries
  const samples = [];
  const indices = new Set();

  while (samples.length < Math.min(n, entries.length)) {
    const idx = Math.floor(Math.random() * entries.length);
    if (!indices.has(idx)) {
      indices.add(idx);
      const [key, result] = entries[idx];
      // Key format: "headline|topic"
      const [headline, topic] = key.split("|");
      samples.push({ headline, topic, ai_result: result });
    }
  }

  return samples;
}

// Sample random items from analysis results
function sampleAnalyzerResults(n = 20) {
  if (!existsSync(RESULTS_FILE)) {
    console.log("❌ No results.json found. Run the analyzer first.");
    return [];
  }

  const results = JSON.parse(readFileSync(RESULTS_FILE, "utf-8"));
  const textCache = existsSync(TEXT_CACHE)
    ? JSON.parse(readFileSync(TEXT_CACHE, "utf-8"))
    : {};

  // Sample random results
  const samples = [];
  const indices = new Set();

  while (samples.length < Math.min(n, results.length)) {
    const idx = Math.floor(Math.random() * results.length);
    if (!indices.has(idx)) {
      indices.add(idx);
      const result = results[idx];
      samples.push({
        url: result.url,
        title: result.title,
        text: textCache[result.url] || "",
        ai_result: result,
      });
    }
  }

  return samples;
}

// Interactive labeling for filter results
async function labelFilterResults(samples) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (query) =>
    new Promise((resolve) => rl.question(query, resolve));

  const testCases = loadTestCases();
  let labeled = 0;

  console.log("\n🏷️  Filter Result Labeling");
  console.log("=".repeat(60));
  console.log("Review AI filter decisions and mark as correct/incorrect\n");

  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i];

    console.log(`\n[${i + 1}/${samples.length}]`);
    console.log("-".repeat(60));
    console.log(`Headline: ${sample.headline}`);
    console.log(`Topic: ${sample.topic}`);
    console.log(`AI Decision: ${sample.ai_result ? "✅ RELEVANT" : "❌ NOT RELEVANT"}`);
    console.log("-".repeat(60));

    const answer = await question(
      "Is this correct? (y)es / (n)o / (s)kip / (q)uit: "
    );

    if (answer.toLowerCase() === "q") {
      console.log("\n⏹️  Quitting...");
      break;
    }

    if (answer.toLowerCase() === "s") {
      console.log("⏭️  Skipped");
      continue;
    }

    if (answer.toLowerCase() === "y" || answer.toLowerCase() === "n") {
      const isCorrect = answer.toLowerCase() === "y";
      const expectedResult = isCorrect ? sample.ai_result : !sample.ai_result;

      const reason = await question("Reason (optional): ");

      testCases.filter_test_cases.push({
        id: `filter_${testCases.filter_test_cases.length + 1}`,
        headline: sample.headline,
        snippet: "",
        topic: sample.topic,
        expected: expectedResult,
        ai_result: sample.ai_result,
        is_correct: isCorrect,
        reason: reason.trim(),
        created_at: new Date().toISOString(),
      });

      labeled++;
      console.log(`✅ Labeled (${labeled} total)`);
    }
  }

  rl.close();
  saveTestCases(testCases);

  console.log(`\n✨ Labeled ${labeled} filter results`);
  console.log(`💾 Saved to ${TEST_CASES_FILE}`);
}

// Interactive labeling for analyzer results
async function labelAnalyzerResults(samples) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (query) =>
    new Promise((resolve) => rl.question(query, resolve));

  const testCases = loadTestCases();
  let labeled = 0;

  console.log("\n🏷️  Analyzer Result Labeling");
  console.log("=".repeat(60));
  console.log("Review AI analysis and mark as correct/incorrect\n");

  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i];

    console.log(`\n[${i + 1}/${samples.length}]`);
    console.log("-".repeat(60));
    console.log(`Title: ${sample.title}`);
    console.log(`URL: ${sample.url}`);
    console.log(`Text (first 200 chars): ${sample.text.substring(0, 200)}...`);
    console.log("-".repeat(60));
    console.log("AI Analysis:");
    console.log(`  Sentiment: ${sample.ai_result.sentiment}`);
    console.log(`  Score: ${sample.ai_result.sentiment_score}`);
    console.log(`  Main Angle: ${sample.ai_result.main_angle}`);
    console.log(`  Balance: ${sample.ai_result.balance}`);
    console.log(`  Summary: ${sample.ai_result.summary}`);
    console.log("-".repeat(60));

    const answer = await question(
      "Is this analysis correct? (y)es / (n)o / (s)kip / (q)uit: "
    );

    if (answer.toLowerCase() === "q") {
      console.log("\n⏹️  Quitting...");
      break;
    }

    if (answer.toLowerCase() === "s") {
      console.log("⏭️  Skipped");
      continue;
    }

    if (answer.toLowerCase() === "y") {
      const reason = await question("Reason (optional): ");

      testCases.analyzer_test_cases.push({
        id: `analyzer_${testCases.analyzer_test_cases.length + 1}`,
        url: sample.url,
        title: sample.title,
        text: sample.text,
        expected: sample.ai_result,
        is_correct: true,
        reason: reason.trim(),
        created_at: new Date().toISOString(),
      });

      labeled++;
      console.log(`✅ Labeled (${labeled} total)`);
    } else if (answer.toLowerCase() === "n") {
      console.log("\n❌ Incorrect. Please provide correct values:");

      const sentiment = await question(`  Correct sentiment (current: ${sample.ai_result.sentiment}): `);
      const score = await question(`  Correct score (current: ${sample.ai_result.sentiment_score}): `);
      const mainAngle = await question(`  Correct main_angle (current: ${sample.ai_result.main_angle}): `);
      const balance = await question(`  Correct balance (current: ${sample.ai_result.balance}): `);
      const reason = await question("  Reason for correction: ");

      const expected = {
        ...sample.ai_result,
        sentiment: sentiment.trim() || sample.ai_result.sentiment,
        sentiment_score: score.trim() || sample.ai_result.sentiment_score,
        main_angle: mainAngle.trim() || sample.ai_result.main_angle,
        balance: balance.trim() || sample.ai_result.balance,
      };

      testCases.analyzer_test_cases.push({
        id: `analyzer_${testCases.analyzer_test_cases.length + 1}`,
        url: sample.url,
        title: sample.title,
        text: sample.text,
        expected: expected,
        ai_result: sample.ai_result,
        is_correct: false,
        reason: reason.trim(),
        created_at: new Date().toISOString(),
      });

      labeled++;
      console.log(`✅ Labeled (${labeled} total)`);
    }
  }

  rl.close();
  saveTestCases(testCases);

  console.log(`\n✨ Labeled ${labeled} analyzer results`);
  console.log(`💾 Saved to ${TEST_CASES_FILE}`);
}

// Main menu
async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (query) =>
    new Promise((resolve) => rl.question(query, resolve));

  console.log("\n🏷️  Test Case Labeler");
  console.log("=".repeat(60));
  console.log("Create test data from existing cached results\n");

  console.log("Options:");
  console.log("  1. Label filter results (relevance decisions)");
  console.log("  2. Label analyzer results (sentiment analysis)");
  console.log("  3. View current test cases");
  console.log("  4. Exit\n");

  const choice = await question("Select option (1-4): ");

  rl.close();

  if (choice === "1") {
    const n = 20;
    console.log(`\nSampling ${n} random filter results...`);
    const samples = sampleFilterResults(n);

    if (samples.length === 0) {
      console.log("No samples found.");
      return;
    }

    await labelFilterResults(samples);
  } else if (choice === "2") {
    const n = 20;
    console.log(`\nSampling ${n} random analyzer results...`);
    const samples = sampleAnalyzerResults(n);

    if (samples.length === 0) {
      console.log("No samples found.");
      return;
    }

    await labelAnalyzerResults(samples);
  } else if (choice === "3") {
    const testCases = loadTestCases();
    console.log("\n📊 Current Test Cases:");
    console.log(`  Filter cases: ${testCases.filter_test_cases.length}`);
    console.log(`  Analyzer cases: ${testCases.analyzer_test_cases.length}`);
    console.log(
      `  Correct: ${testCases.filter_test_cases.filter((c) => c.is_correct).length + testCases.analyzer_test_cases.filter((c) => c.is_correct).length}`
    );
    console.log(
      `  Incorrect: ${testCases.filter_test_cases.filter((c) => !c.is_correct).length + testCases.analyzer_test_cases.filter((c) => !c.is_correct).length}`
    );
  } else {
    console.log("Goodbye!");
  }
}

main().catch(console.error);
