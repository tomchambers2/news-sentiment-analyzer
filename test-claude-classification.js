import "dotenv/config";
import { filterBatch } from "./src/filter-claude.js";

// Same test articles as before
const TEST_ARTICLES = [
  // SHOULD BE RELEVANT - Transport policy articles
  {
    url: "test://ltn-opposition",
    title: "Residents protest against Low Traffic Neighbourhood scheme in East Bristol",
    content: "Hundreds of residents gathered to protest against new low traffic neighbourhood measures in their area. The controversial modal filters have divided the community, with some supporting the liveable streets initiative while others demand their removal. Traffic calming measures have caused significant disruption to local drivers.",
    expectedRelevant: true,
    category: "LTN Opposition"
  },
  {
    url: "test://traffic-filters",
    title: "Council approves modal filters for residential streets",
    content: "Bristol City Council has approved plans to install modal filters on several residential streets as part of their liveable neighbourhoods programme. The measures aim to reduce rat-running traffic and make streets safer for pedestrians and cyclists. Local residents have mixed reactions to the traffic calming proposals.",
    expectedRelevant: true,
    category: "Traffic Policy"
  },
  {
    url: "test://liveable-streets",
    title: "New liveable streets scheme launches in South Bristol",
    content: "A new liveable streets scheme has been launched in South Bristol, introducing traffic calming measures and restrictions on through traffic. The council hopes the initiative will create safer, cleaner neighbourhoods while reducing vehicle emissions and improving air quality for residents.",
    expectedRelevant: true,
    category: "Liveable Streets"
  },
  {
    url: "test://parking-zones",
    title: "Bristol neighbourhoods face new resident parking restrictions",
    content: "Several neighbourhoods across Bristol will soon require residents to pay for parking permits. Transport planners hope the new zones will tackle parking pressures and reduce car trips. The measures are part of wider efforts to make neighbourhoods more liveable and reduce traffic congestion.",
    expectedRelevant: true,
    category: "Parking Policy"
  },

  // SHOULD NOT BE RELEVANT - General news
  {
    url: "test://cooking-tips",
    title: "Mum shares thrifty meal prep tips to save money",
    content: "A Bristol mum has shared her top tips for batch cooking and meal preparation to help families save money during the cost of living crisis. Her methods include planning weekly menus, buying ingredients in bulk, and freezing portions for later use. She estimates her family saves £70 per week using these techniques.",
    expectedRelevant: false,
    category: "Cooking/Lifestyle"
  },
  {
    url: "test://school-ratings",
    title: "Primary school receives outstanding Ofsted rating",
    content: "Alexander Hosea Primary School has been rated outstanding by Ofsted inspectors. The school scored highly for pupil attainment, progress, and attendance. Parents praised the dedicated teaching staff and supportive learning environment. The school has 250 pupils and a teacher to pupil ratio of 1:20.",
    expectedRelevant: false,
    category: "Education"
  },
  {
    url: "test://celebrity-news",
    title: "Love Island star spotted at Bristol restaurant",
    content: "A popular Love Island contestant was spotted dining at a trendy Bristol restaurant over the weekend. Fans gathered outside hoping for photos and autographs. The reality TV star posted about their visit on social media, praising the food and atmosphere.",
    expectedRelevant: false,
    category: "Celebrity/Entertainment"
  },
  {
    url: "test://motorway-accident",
    title: "M5 closed after multi-vehicle collision",
    content: "The M5 motorway was closed for several hours following a serious collision involving three vehicles. Emergency services attended the scene and traffic was diverted. Long delays were reported in both directions. Police are investigating the cause of the accident.",
    expectedRelevant: false,
    category: "Traffic Accident"
  },
  {
    url: "test://cleaning-hacks",
    title: "15 cleaning hacks that will transform your home",
    content: "Professional cleaners have shared their top tips and tricks for keeping your home spotless. From using vinegar to clean windows to baking soda for tough stains, these simple hacks can save time and money. The experts recommend establishing a regular cleaning routine and decluttering regularly.",
    expectedRelevant: false,
    category: "Cleaning/Lifestyle"
  },
  {
    url: "test://dog-story",
    title: "Adorable dog reunited with owner after going missing",
    content: "A beloved family dog has been reunited with its owner after going missing for three days. The cockapoo wandered off during a walk in a Bristol park. Thanks to social media appeals and local volunteers, the dog was found safe and well. The emotional reunion was captured on video.",
    expectedRelevant: false,
    category: "Human Interest"
  }
];

async function runTest() {
  console.log("🧪 Testing Classification with Claude (Haiku)\n");
  console.log("=" .repeat(80));

  try {
    // Run classification
    const results = await filterBatch(
      TEST_ARTICLES,
      "liveable-neighbourhoods",
      "liveable neighbourhoods, low traffic neighbourhoods, modal filters, liveable streets, traffic calming, or community opposition to these schemes"
    );

    console.log("\n📊 RESULTS:\n");

    let correctClassifications = 0;
    let totalTests = TEST_ARTICLES.length;
    let relevantScores = [];
    let irrelevantScores = [];

    // Analyze results
    results.forEach((result, index) => {
      const testArticle = TEST_ARTICLES[index];
      const correct = result.relevant === testArticle.expectedRelevant;

      if (correct) correctClassifications++;

      if (testArticle.expectedRelevant) {
        relevantScores.push(result.score);
      } else {
        irrelevantScores.push(result.score);
      }

      const icon = correct ? "✅" : "❌";
      const status = result.relevant ? "RELEVANT" : "NOT RELEVANT";

      console.log(`${icon} ${status} (confidence: ${result.score.toFixed(3)}) - Expected: ${testArticle.expectedRelevant ? "RELEVANT" : "NOT RELEVANT"}`);
      console.log(`   Category: ${testArticle.category}`);
      console.log(`   Title: ${testArticle.title}`);
      console.log(`   Reasoning: ${result.reasoning}`);
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
      console.log(`\nRelevant articles (expected to score high):`);
      console.log(`  Average: ${avgRelevant}`);
      console.log(`  Range: ${minRelevant} - ${maxRelevant}`);
    }

    if (irrelevantScores.length > 0) {
      const avgIrrelevant = (irrelevantScores.reduce((a, b) => a + b, 0) / irrelevantScores.length).toFixed(3);
      const minIrrelevant = Math.min(...irrelevantScores).toFixed(3);
      const maxIrrelevant = Math.max(...irrelevantScores).toFixed(3);
      console.log(`\nIrrelevant articles (expected to score low):`);
      console.log(`  Average: ${avgIrrelevant}`);
      console.log(`  Range: ${minIrrelevant} - ${maxIrrelevant}`);
    }

    // Calculate score separation
    if (relevantScores.length > 0 && irrelevantScores.length > 0) {
      const avgRelevant = relevantScores.reduce((a, b) => a + b, 0) / relevantScores.length;
      const avgIrrelevant = irrelevantScores.reduce((a, b) => a + b, 0) / irrelevantScores.length;
      const separation = (avgRelevant - avgIrrelevant).toFixed(3);
      console.log(`\nScore Separation: ${separation}`);
      console.log(`(Higher is better - indicates clearer distinction between relevant/irrelevant)`);
    }

    console.log("\n" + "=".repeat(80));

    if (accuracy >= 90) {
      console.log("\n✅ EXCELLENT: Classification is working very well!");
    } else if (accuracy >= 70) {
      console.log("\n⚠️  GOOD: Classification is working but could be improved.");
    } else {
      console.log("\n❌ POOR: Classification needs improvement.");
    }

  } catch (error) {
    console.error("❌ Test failed:", error.message);
    console.error(error);
  }
}

// Run the test
runTest();
