import "dotenv/config";
import OpenAI from "openai";
import Database from "better-sqlite3";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";

// Known false positives from our analysis
const FALSE_POSITIVES = [
  "https://www.bristolpost.co.uk/news/celebs-tv/gmbs-alex-beresford-ends-line-5350800",
  "https://www.bristolpost.co.uk/news/celebs-tv/masterchef-professionals-start-date-bbc-6120198",
  "https://www.bristolpost.co.uk/news/celebs-tv/friends-star-matthew-perry-found-8866222",
  "https://www.bristolpost.co.uk/news/real-life/student-makes-55k-six-weeks-8281233",
  "https://www.bristolpost.co.uk/news/real-life/emily-ate-5000-calories-day-8571010",
  "https://www.bristolpost.co.uk/news/property/luxury-bristol-house-dating-back-5948498",
  "https://www.bristolpost.co.uk/news/health/nhs-hospital-turns-staff-blood-9338902",
  "https://www.bristolpost.co.uk/news/cost-of-living/martin-lewis-warns-brits-europe-9337841",
];

// Known true positive (should still be marked relevant)
const TRUE_POSITIVES = [
  "https://www.bristolpost.co.uk/news/real-life/bollard-madness-residents-driveway-blocked-8610555",
];

const TOPIC_DESCRIPTION = "liveable neighbourhoods, low traffic neighbourhoods, modal filters, liveable streets, traffic calming, or community opposition to these schemes";

async function getArticleContent(url) {
  const db = new Database("./cache/cache.db", { readonly: true });
  const row = db.prepare("SELECT text FROM articles WHERE url = ?").get(url);
  db.close();
  return row?.text || null;
}

async function classifyWithNewPrompt(articles) {
  const client = new OpenAI({ apiKey: OPENAI_API_KEY });
  
  const articlesText = articles
    .map((article, idx) => {
      const excerpt = article.content.slice(0, 600).replace(/\n/g, " ");
      return `[${idx + 1}] "${article.title}" - ${excerpt}`;
    })
    .join("\n\n");

  // NEW IMPROVED PROMPT
  const prompt = `Classify if each article is SPECIFICALLY about Low Traffic Neighbourhood (LTN) schemes or policies.

RELEVANT - Article must be PRIMARILY about one of these:
- LTN schemes, modal filters, traffic filters, road closures for traffic reduction
- Liveable/low traffic neighbourhood policy announcements, consultations, implementations
- Community protests/support FOR or AGAINST LTN schemes specifically
- 20mph zone policies, school streets schemes, pedestrianisation projects
- Cycle lane infrastructure projects and policy debates
- Council transport policy decisions about reducing car traffic

NOT RELEVANT - Reject these even if they mention traffic/roads:
- Traffic accidents, crashes, road closures due to incidents
- General roadworks, motorway news (M4, M5, M32)
- Celebrity news, TV shows, entertainment
- Property listings, house prices, real estate
- Health, medical, lifestyle, cooking, cleaning tips
- Crime reports, court cases, police incidents
- Weather, travel disruption from weather
- Bus route changes, train delays, airport news
- School ratings, Ofsted reports, education news
- Job listings, career advice
- Human interest stories that mention "traffic" incidentally
- Council bollards blocking driveways (unless part of LTN scheme)

The article must be ABOUT the policy/scheme itself, not just mention traffic in passing.

Respond with ONLY a JSON array of ${articles.length} objects:
[{"relevant": true/false, "confidence": 0.0-1.0, "reasoning": "5 words max"}]

${articlesText}

JSON array:`;

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    max_tokens: articles.length * 60,
    temperature: 0,
  });

  let jsonText = response.choices[0].message.content.trim();
  if (jsonText.startsWith("```")) {
    jsonText = jsonText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }
  
  return JSON.parse(jsonText);
}

async function main() {
  console.log("🧪 Testing new classification prompt on known false/true positives\n");
  console.log("=".repeat(80));
  
  // Test false positives
  console.log("\n📛 FALSE POSITIVES (should now be marked NOT relevant):\n");
  
  const fpArticles = [];
  for (const url of FALSE_POSITIVES) {
    const content = await getArticleContent(url);
    if (content) {
      const title = content.split("\n")[0].substring(0, 100);
      fpArticles.push({ url, title, content });
    } else {
      console.log(`  ⚠️ Could not find content for: ${url.split("/").pop()}`);
    }
  }

  if (fpArticles.length > 0) {
    const fpResults = await classifyWithNewPrompt(fpArticles);
    
    let fpCorrect = 0;
    for (let i = 0; i < fpArticles.length; i++) {
      const result = fpResults[i];
      const shortUrl = fpArticles[i].url.split("/").pop();
      const status = result.relevant ? "❌ FAIL (still marked relevant)" : "✅ PASS (correctly rejected)";
      if (!result.relevant) fpCorrect++;
      console.log(`  ${status}`);
      console.log(`     URL: ${shortUrl}`);
      console.log(`     Reasoning: ${result.reasoning}`);
      console.log(`     Confidence: ${result.confidence}`);
      console.log();
    }
    console.log(`  📊 False positive rejection rate: ${fpCorrect}/${fpArticles.length} (${((fpCorrect/fpArticles.length)*100).toFixed(0)}%)`);
  }

  // Test true positives
  console.log("\n" + "=".repeat(80));
  console.log("\n✅ TRUE POSITIVES (should still be marked relevant):\n");
  
  const tpArticles = [];
  for (const url of TRUE_POSITIVES) {
    const content = await getArticleContent(url);
    if (content) {
      const title = content.split("\n")[0].substring(0, 100);
      tpArticles.push({ url, title, content });
    } else {
      console.log(`  ⚠️ Could not find content for: ${url.split("/").pop()}`);
    }
  }

  if (tpArticles.length > 0) {
    const tpResults = await classifyWithNewPrompt(tpArticles);
    
    let tpCorrect = 0;
    for (let i = 0; i < tpArticles.length; i++) {
      const result = tpResults[i];
      const shortUrl = tpArticles[i].url.split("/").pop();
      const status = result.relevant ? "✅ PASS (correctly marked relevant)" : "❌ FAIL (incorrectly rejected)";
      if (result.relevant) tpCorrect++;
      console.log(`  ${status}`);
      console.log(`     URL: ${shortUrl}`);
      console.log(`     Reasoning: ${result.reasoning}`);
      console.log(`     Confidence: ${result.confidence}`);
      console.log();
    }
    console.log(`  📊 True positive retention rate: ${tpCorrect}/${tpArticles.length} (${((tpCorrect/tpArticles.length)*100).toFixed(0)}%)`);
  }

  console.log("\n" + "=".repeat(80));
  console.log("🏁 Test complete!\n");
}

main().catch(console.error);




























