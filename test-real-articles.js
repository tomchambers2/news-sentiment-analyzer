import "dotenv/config";
import { filterBatch } from "./src/filter-fewshot.js";
import { readFileSync } from "fs";

// Load real articles from cache that weren't in training data
const cache = JSON.parse(readFileSync("cache/2_filter/filter_input.json", "utf-8"));

// Real articles to test (selected from cache, not used in training)
const TEST_URLS = {
  // Should be RELEVANT
  relevant: [
    "https://www.bristolpost.co.uk/news/bristol-news/calls-create-liveable-neighbourhoods-across-4460392",
    "https://www.bristolpost.co.uk/news/bristol-news/delay-liveable-neighbourhoods-strategy-triggers-6228137",
    "https://www.bristolpost.co.uk/news/bristol-news/resident-parking-zones-reviewed-south-4440228",
    "https://www.bristolpost.co.uk/news/bristol-news/calls-new-parking-zones-bedminster-6799830",
    "https://www.bristolpost.co.uk/news/bristol-news/bristol-greens-deny-being-anti-10577529",
    "https://www.bristolpost.co.uk/news/bristol-news/bristol-neighbourhoods-residents-could-soon-10580064",
  ],

  // Should be NOT RELEVANT
  not_relevant: [
    "https://www.bristolpost.co.uk/news/health/single-blood-test-more-50-10582061", // Health/medical
    "https://www.bristolpost.co.uk/news/real-life/foodie-tries-pizza-hut-dominos-10571863", // Food/lifestyle
    "https://www.bristolpost.co.uk/news/bristol-news/dogs-cats-live-longer-south-10580619", // Pets
    "https://www.bristolpost.co.uk/news/celebs-tv/asked-readers-best-celebrity-encounters-2788491", // Celebrity
    "https://www.bristolpost.co.uk/news/uk-world-news/colourful-town-two-hours-bristol-10572371", // Travel
    "https://www.bristolpost.co.uk/news/local-news/alexander-hosea-primary-school-1052090", // School ratings
    "https://www.bristolpost.co.uk/news/bristol-news/live-major-m5-traffic-after-10580827", // Motorway accident
  ]
};

async function runTest() {
  console.log("🧪 Testing on REAL UNSEEN Articles from Cache\n");
  console.log("=" .repeat(80));

  // Prepare test articles
  const testArticles = [];

  for (const url of TEST_URLS.relevant) {
    if (cache[url]) {
      testArticles.push({
        url,
        title: cache[url].title,
        content: cache[url].content,
        expectedRelevant: true
      });
    }
  }

  for (const url of TEST_URLS.not_relevant) {
    if (cache[url]) {
      testArticles.push({
        url,
        title: cache[url].title,
        content: cache[url].content,
        expectedRelevant: false
      });
    }
  }

  console.log(`\nTesting on ${testArticles.length} real articles from your cache`);
  console.log(`  Expected relevant: ${TEST_URLS.relevant.length}`);
  console.log(`  Expected not relevant: ${TEST_URLS.not_relevant.length}\n`);

  try {
    const results = await filterBatch(
      testArticles,
      "liveable-neighbourhoods",
      "liveable neighbourhoods, low traffic neighbourhoods, modal filters, liveable streets, traffic calming, or community opposition to these schemes"
    );

    console.log("\n📊 RESULTS:\n");

    let correctClassifications = 0;
    let totalTests = testArticles.length;
    let relevantScores = [];
    let irrelevantScores = [];
    let errors = [];

    results.forEach((result, index) => {
      const testArticle = testArticles[index];
      const correct = result.relevant === testArticle.expectedRelevant;

      if (correct) {
        correctClassifications++;
      } else {
        errors.push({
          title: testArticle.title,
          expected: testArticle.expectedRelevant,
          got: result.relevant,
          score: result.score
        });
      }

      if (testArticle.expectedRelevant) {
        relevantScores.push(result.score);
      } else {
        irrelevantScores.push(result.score);
      }

      const icon = correct ? "✅" : "❌";
      const status = result.relevant ? "RELEVANT" : "NOT RELEVANT";
      const expected = testArticle.expectedRelevant ? "RELEVANT" : "NOT RELEVANT";

      console.log(`${icon} ${status} (score: ${result.score.toFixed(3)}) - Expected: ${expected}`);
      console.log(`   ${testArticle.title.substring(0, 100)}...`);
      if (!correct) {
        console.log(`   ⚠️  MISCLASSIFIED!`);
      }
      console.log();
    });

    console.log("=" .repeat(80));
    console.log("\n📈 STATISTICS:\n");

    const accuracy = (correctClassifications / totalTests * 100).toFixed(1);
    console.log(`Accuracy: ${correctClassifications}/${totalTests} (${accuracy}%)`);

    if (relevantScores.length > 0) {
      const avgRelevant = (relevantScores.reduce((a, b) => a + b, 0) / relevantScores.length).toFixed(3);
      const minRelevant = Math.min(...relevantScores).toFixed(3);
      const maxRelevant = Math.max(...relevantScores).toFixed(3);
      console.log(`\nRelevant articles (should score high):`);
      console.log(`  Average: ${avgRelevant}`);
      console.log(`  Range: ${minRelevant} - ${maxRelevant}`);
    }

    if (irrelevantScores.length > 0) {
      const avgIrrelevant = (irrelevantScores.reduce((a, b) => a + b, 0) / irrelevantScores.length).toFixed(3);
      const minIrrelevant = Math.min(...irrelevantScores).toFixed(3);
      const maxIrrelevant = Math.max(...irrelevantScores).toFixed(3);
      console.log(`\nIrrelevant articles (should score low):`);
      console.log(`  Average: ${avgIrrelevant}`);
      console.log(`  Range: ${minIrrelevant} - ${maxIrrelevant}`);
    }

    if (relevantScores.length > 0 && irrelevantScores.length > 0) {
      const avgRelevant = relevantScores.reduce((a, b) => a + b, 0) / relevantScores.length;
      const avgIrrelevant = irrelevantScores.reduce((a, b) => a + b, 0) / irrelevantScores.length;
      const separation = (avgRelevant - avgIrrelevant).toFixed(3);
      console.log(`\nScore Separation: ${separation}`);
      console.log(`(Positive = good discrimination)`);
    }

    if (errors.length > 0) {
      console.log("\n❌ MISCLASSIFIED ARTICLES:");
      errors.forEach(err => {
        console.log(`\n  "${err.title.substring(0, 80)}..."`);
        console.log(`  Expected: ${err.expected}, Got: ${err.got ? "RELEVANT" : "NOT RELEVANT"} (score: ${err.score.toFixed(3)})`);
      });
    }

    console.log("\n" + "=".repeat(80));

    if (accuracy >= 85) {
      console.log("\n✅ EXCELLENT: Few-shot classifier works well on unseen data!");
    } else if (accuracy >= 70) {
      console.log("\n⚠️  GOOD: Works reasonably well but could use more training examples.");
    } else {
      console.log("\n❌ POOR: Needs more/better training examples.");
    }

  } catch (error) {
    console.error("❌ Test failed:", error.message);
    console.error(error);
  }
}

runTest();
