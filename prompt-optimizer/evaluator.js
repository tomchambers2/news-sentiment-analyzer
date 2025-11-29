import "dotenv/config";
import { existsSync, readFileSync } from "fs";
import { filter } from "../src/filter.js";
import { analyze } from "../src/analyzer.js";

const TEST_CASES_FILE = "./prompt-optimizer/test_cases.json";

// Load test cases
function loadTestCases() {
  if (!existsSync(TEST_CASES_FILE)) {
    console.log("❌ No test cases found. Run labeler.js first.");
    process.exit(1);
  }
  return JSON.parse(readFileSync(TEST_CASES_FILE, "utf-8"));
}

// Run filter on test cases
async function runFilterTests(testCases) {
  const results = [];

  console.log(`\n🧪 Testing filter on ${testCases.length} cases...`);

  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    process.stdout.write(`\r  Progress: ${i + 1}/${testCases.length}`);

    const result = await filter(
      testCase.headline,
      testCase.snippet,
      testCase.topic
    );

    results.push({
      input: testCase,
      actual: result,
      expected: testCase.expected,
      correct: result === testCase.expected,
    });
  }

  console.log("\n");
  return results;
}

// Run analyzer on test cases
async function runAnalyzerTests(testCases) {
  const results = [];

  console.log(`\n🧪 Testing analyzer on ${testCases.length} cases...`);

  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    process.stdout.write(`\r  Progress: ${i + 1}/${testCases.length}`);

    const result = await analyze("test", testCase.text, testCase.title);

    // Check if key fields match
    const sentimentMatch = result.sentiment === testCase.expected.sentiment;
    const mainAngleMatch = result.main_angle === testCase.expected.main_angle;
    const balanceMatch = result.balance === testCase.expected.balance;

    // Overall correctness (all key fields must match)
    const correct = sentimentMatch && mainAngleMatch && balanceMatch;

    results.push({
      input: testCase,
      actual: result,
      expected: testCase.expected,
      correct,
      field_accuracy: {
        sentiment: sentimentMatch,
        main_angle: mainAngleMatch,
        balance: balanceMatch,
      },
    });
  }

  console.log("\n");
  return results;
}

// Evaluate results
function evaluate(results) {
  const total = results.length;
  const correct = results.filter((r) => r.correct).length;
  const accuracy = total > 0 ? correct / total : 0;

  // Calculate precision, recall, F1 for binary classification
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
function displayResults(metrics, results, type) {
  console.log("\n" + "=".repeat(60));
  console.log(`📊 ${type.toUpperCase()} EVALUATION RESULTS`);
  console.log("=".repeat(60));

  console.log(`\n📈 Overall Metrics:`);
  console.log(`  Total cases:    ${metrics.total}`);
  console.log(`  Correct:        ${metrics.correct} (${(metrics.accuracy * 100).toFixed(1)}%)`);
  console.log(`  Incorrect:      ${metrics.incorrect} (${((1 - metrics.accuracy) * 100).toFixed(1)}%)`);

  if (type === "filter") {
    console.log(`\n🎯 Classification Metrics:`);
    console.log(`  Precision:      ${(metrics.precision * 100).toFixed(1)}%`);
    console.log(`  Recall:         ${(metrics.recall * 100).toFixed(1)}%`);
    console.log(`  F1 Score:       ${(metrics.f1 * 100).toFixed(1)}%`);

    console.log(`\n📋 Confusion Matrix:`);
    console.log(`  True Positives:  ${metrics.truePositives}`);
    console.log(`  False Positives: ${metrics.falsePositives}`);
    console.log(`  False Negatives: ${metrics.falseNegatives}`);
    console.log(`  True Negatives:  ${metrics.trueNegatives}`);
  } else if (type === "analyzer") {
    // Calculate per-field accuracy
    let sentimentCorrect = 0;
    let mainAngleCorrect = 0;
    let balanceCorrect = 0;

    results.forEach((r) => {
      if (r.field_accuracy.sentiment) sentimentCorrect++;
      if (r.field_accuracy.main_angle) mainAngleCorrect++;
      if (r.field_accuracy.balance) balanceCorrect++;
    });

    console.log(`\n🎯 Field Accuracy:`);
    console.log(`  Sentiment:      ${sentimentCorrect}/${metrics.total} (${((sentimentCorrect / metrics.total) * 100).toFixed(1)}%)`);
    console.log(`  Main Angle:     ${mainAngleCorrect}/${metrics.total} (${((mainAngleCorrect / metrics.total) * 100).toFixed(1)}%)`);
    console.log(`  Balance:        ${balanceCorrect}/${metrics.total} (${((balanceCorrect / metrics.total) * 100).toFixed(1)}%)`);
  }

  // Show errors
  const errors = results.filter((r) => !r.correct);

  if (errors.length > 0) {
    console.log(`\n❌ Errors (${errors.length} total):`);
    console.log("-".repeat(60));

    errors.slice(0, 5).forEach((error, idx) => {
      console.log(`\n[${idx + 1}] ${type === "filter" ? error.input.headline : error.input.title}`);
      console.log(`  Expected: ${JSON.stringify(error.expected)}`);
      console.log(`  Actual:   ${JSON.stringify(error.actual)}`);
      if (error.input.reason) {
        console.log(`  Reason:   ${error.input.reason}`);
      }
    });

    if (errors.length > 5) {
      console.log(`\n  ... and ${errors.length - 5} more errors`);
    }
  } else {
    console.log(`\n✅ All test cases passed!`);
  }

  console.log("\n" + "=".repeat(60));
}

// Evaluate filter
async function evaluateFilter() {
  const testCases = loadTestCases().filter_test_cases;

  if (testCases.length === 0) {
    console.log("❌ No filter test cases found. Run labeler.js first.");
    return;
  }

  console.log(`\n🔍 Evaluating Filter Prompt`);
  console.log(`   Test cases: ${testCases.length}`);

  const results = await runFilterTests(testCases);
  const metrics = evaluate(results);

  displayResults(metrics, results, "filter");
}

// Evaluate analyzer
async function evaluateAnalyzer() {
  const testCases = loadTestCases().analyzer_test_cases;

  if (testCases.length === 0) {
    console.log("❌ No analyzer test cases found. Run labeler.js first.");
    return;
  }

  console.log(`\n🔍 Evaluating Analyzer Prompt`);
  console.log(`   Test cases: ${testCases.length}`);

  const results = await runAnalyzerTests(testCases);
  const metrics = evaluate(results);

  displayResults(metrics, results, "analyzer");
}

// Main
async function main() {
  const args = process.argv.slice(2);
  const type = args[0];

  if (!type || !["filter", "analyzer", "both"].includes(type)) {
    console.log("Usage: node evaluator.js [filter|analyzer|both]");
    process.exit(1);
  }

  console.log("\n🧪 Prompt Evaluator");
  console.log("=".repeat(60));

  if (type === "filter" || type === "both") {
    await evaluateFilter();
  }

  if (type === "analyzer" || type === "both") {
    await evaluateAnalyzer();
  }
}

main().catch(console.error);
