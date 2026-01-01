import { readFileSync, writeFileSync } from "fs";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const JINA_READER_BASE_URL = "https://r.jina.ai/";
const JINA_API_KEY = process.env.JINA_API_KEY || "";
const RESULTS_FILE = "./results-cycling.json";

async function getAuthorFromJina(url, retries = 2) {
  const jinaUrl = `${JINA_READER_BASE_URL}${url}`;
  
  const headers = {
    "Accept": "application/json",
  };
  
  if (JINA_API_KEY) {
    headers["Authorization"] = `Bearer ${JINA_API_KEY}`;
  }
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await axios.get(jinaUrl, {
        headers,
        timeout: 60000, // Increase to 60 seconds
      });
      
      return response.data?.data?.metadata?.author || null;
    } catch (err) {
      if (attempt < retries && err.code === 'ECONNABORTED') {
        console.error(`  ⏱️  Timeout (attempt ${attempt + 1}/${retries + 1}), retrying...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        continue;
      }
      console.error(`  ❌ Error: ${err.message}`);
      return null;
    }
  }
}

async function fixAuthors() {
  console.log("📖 Reading results-cycling.json...");
  const results = JSON.parse(readFileSync(RESULTS_FILE, "utf-8"));
  
  const unknownAuthors = results.filter(
    (r) => r.author === "unknown" || !r.author
  );
  
  console.log(`\n📊 Found ${unknownAuthors.length} articles with unknown authors`);
  console.log(`📊 Total articles: ${results.length}`);
  
  if (unknownAuthors.length === 0) {
    console.log("\n✅ No articles need fixing!");
    return;
  }
  
  console.log(`\n🔄 Fetching author metadata for ${unknownAuthors.length} articles...\n`);
  
  let updated = 0;
  let failed = 0;
  
  for (let i = 0; i < unknownAuthors.length; i++) {
    const article = unknownAuthors[i];
    console.log(`[${i + 1}/${unknownAuthors.length}] ${article.url}`);
    
    const author = await getAuthorFromJina(article.url);
    
    if (author) {
      article.author = author;
      updated++;
      console.log(`  ✓ Found: ${author}`);
    } else {
      failed++;
      console.log(`  ✗ No author found`);
    }
    
    // Save progress every 50 articles
    if ((i + 1) % 50 === 0) {
      console.log(`\n💾 Saving progress (${i + 1}/${unknownAuthors.length})...`);
      writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));
      console.log(`✅ Progress saved\n`);
    }
    
    // Rate limiting: Jina free tier is 20 RPM, paid is 500 RPM
    // Use 100ms delay for paid tier, 3000ms for free tier
    const delay = JINA_API_KEY ? 100 : 3000;
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  
  console.log(`\n💾 Saving updated results...`);
  writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));
  
  console.log(`\n✅ Done!`);
  console.log(`  📊 Updated: ${updated} articles`);
  console.log(`  ❌ Failed: ${failed} articles`);
  console.log(`  📊 Still unknown: ${results.filter(r => r.author === "unknown" || !r.author).length} articles`);
}

fixAuthors().catch(console.error);
