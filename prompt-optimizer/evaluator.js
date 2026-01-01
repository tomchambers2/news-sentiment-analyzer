import "dotenv/config";
import { existsSync, readFileSync } from "fs";
import { filterBatch } from "../src/filter-gpt.js";
import Database from 'better-sqlite3';

const TEST_CASES_FILE = "./prompt-optimizer/test_cases.json";
const DB_PATH = "cache/cache.db";

// Load test cases
function loadTestCases() {
  if (!existsSync(TEST_CASES_FILE)) {
    console.log("❌ No test cases found. Create test_cases.json first.");
    process.exit(1);
  }
  return JSON.parse(readFileSync(TEST_CASES_FILE, "utf-8"));
}

// Load article content from SQLite cache
function loadArticleContent(url) {
  if (!existsSync(DB_PATH)) {
    return null;
  }
  const db = new Database(DB_PATH, { readonly: true });
  const stmt = db.prepare('SELECT text FROM articles WHERE url = ?');
  const row = stmt.get(url);
  db.close();
  return row ? row.text : null;
}

// Run filter on test cases
async function runFilterTests(testCases, topicId, topicDescription) {
  console.log(`\n🧪 Testing filter on ${testCases.length} cases...`);
  console.log(`   Topic: ${topicId}\n`);

  // Load article content for each test case
  const articlesWithContent = testCases.map(tc => {
    const content = loadArticleContent(tc.url);
    if (!content) {
      console.log(`   ⚠️  No content for: ${tc.title?.substring(0, 50)}...`);
    }
    return {
      ...tc,
      content: content || tc.title // fallback to title if no content
    };
  });

  // Filter out cases without content
  const validCases = articlesWithContent.filter(tc => tc.content && tc.content.length > 50);
  
  if (validCases.length < testCases.length) {
    console.log(`   ⚠️  Only ${validCases.length}/${testCases.length} cases have content\n`);
  }

  // Run batch classification (bypasses cache by not using topicId in lookup)
  const batchInput = validCases.map(tc => ({
    url: tc.url,
    title: tc.title,
    content: tc.content
  }));

  console.log(`   Running classification...`);
  const classificationResults = await filterBatch(batchInput, topicId, topicDescription);

  // Map results back to test cases
  const results = validCases.map(tc => {
    const classification = classificationResults.find(r => r.url === tc.url);
    const actual = classification ? classification.relevant : null;
    
    return {
      input: tc,
      actual,
      expected: tc.expected,
      correct: actual === tc.expected,
      reasoning: classification?.reasoning || 'N/A'
    };
  });

  return results;
}

// Evaluate results
function evaluate(results) {
  const total = results.length;
  const correct = results.filter((r) => r.correct).length;
  const accuracy = total > 0 ? correct / total : 0;

  const truePositives = results.filter(
    (r) => r.expected === true && r.actual === true
  ).length;
  const falsePositives = results.filter(
    (r) => r.expected === false && r.actual === true
  ).length;
  const falseNegatives = results.filter(
    (r) => r.expected === true && r.actual === false
  ).length;
  const trueNegatives = results.filter(
    (r) => r.expected === false && r.actual === false
  ).length;

  const precision =
    truePositives + falsePositives > 0
      ? truePositives / (truePositives + falsePositives)
      : 0;
  const recall =
    truePositives + falseNegatives > 0
      ? truePositives / (truePositives + falseNegatives)
      : 0;
  const f1 =
    precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

  return {
    total,
    correct,
    incorrect: total - correct,
    accuracy,
    precision,
    recall,
    f1,
    truePositives,
    falsePositives,
    falseNegatives,
    trueNegatives,
  };
}

// Display results
function displayResults(metrics, results) {
  console.log("\n" + "=".repeat(60));
  console.log(`📊 FILTER EVALUATION RESULTS`);
  console.log("=".repeat(60));

  console.log(`\n📈 Overall Metrics:`);
  console.log(`  Total cases:    ${metrics.total}`);
  console.log(`  Correct:        ${metrics.correct} (${(metrics.accuracy * 100).toFixed(1)}%)`);
  console.log(`  Incorrect:      ${metrics.incorrect} (${((1 - metrics.accuracy) * 100).toFixed(1)}%)`);

    console.log(`\n🎯 Classification Metrics:`);
    console.log(`  Precision:      ${(metrics.precision * 100).toFixed(1)}%`);
    console.log(`  Recall:         ${(metrics.recall * 100).toFixed(1)}%`);
    console.log(`  F1 Score:       ${(metrics.f1 * 100).toFixed(1)}%`);

    console.log(`\n📋 Confusion Matrix:`);
  console.log(`  True Positives:  ${metrics.truePositives} (correctly identified as relevant)`);
  console.log(`  False Positives: ${metrics.falsePositives} (wrongly marked relevant)`);
  console.log(`  False Negatives: ${metrics.falseNegatives} (missed relevant articles)`);
  console.log(`  True Negatives:  ${metrics.trueNegatives} (correctly rejected)`);

  // Show all results with reasoning
  console.log(`\n📝 All Results:`);
    console.log("-".repeat(60));

  results.forEach((r, idx) => {
    const icon = r.correct ? '✅' : '❌';
    const status = r.actual ? 'RELEVANT' : 'NOT RELEVANT';
    console.log(`\n${icon} [${idx + 1}] ${r.input.title?.substring(0, 60)}...`);
    console.log(`   Expected: ${r.expected ? 'relevant' : 'not relevant'}`);
    console.log(`   Actual:   ${status}`);
    console.log(`   AI reasoning: "${r.reasoning}"`);
    console.log(`   Your reason:  "${r.input.reason}"`);
  });

  console.log("\n" + "=".repeat(60));
}

// Main
async function main() {
  console.log("\n🧪 Filter Prompt Evaluator");
  console.log("=".repeat(60));

  const testData = loadTestCases();
  const testCases = testData.filter;

  if (!testCases || testCases.length === 0) {
    console.log("❌ No filter test cases found in test_cases.json");
    return;
  }

  console.log(`   Test cases: ${testCases.length}`);

  // Use real topic ID to check cached results
  const topicId = "liveable-neighbourhoods";
  const topicDescription = "liveable neighbourhoods, low traffic neighbourhoods, modal filters, liveable streets, traffic calming, or community opposition to these schemes";
  
  console.log(`   Using real topic ID: ${topicId} (checks cached results)`);

  const results = await runFilterTests(testCases, topicId, topicDescription);
  const metrics = evaluate(results);

  displayResults(metrics, results);
}

main().catch(console.error);
