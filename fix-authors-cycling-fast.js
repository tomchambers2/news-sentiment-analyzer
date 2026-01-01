import { readFileSync, writeFileSync } from "fs";
import axios from "axios";
import * as cheerio from "cheerio";
import dotenv from "dotenv";

dotenv.config();

const RESULTS_FILE = "./results-cycling.json";

async function getAuthorFromHTML(url, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await axios.get(url, {
        timeout: 15000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        }
      });
      
      const $ = cheerio.load(response.data);
      
      // Try multiple meta tag patterns
      const author = 
        $('meta[name="author"]').attr('content') ||
        $('meta[property="article:author"]').attr('content') ||
        $('meta[name="twitter:creator"]').attr('content')?.replace('@', '') ||
        $('.author-name').first().text().trim() ||
        $('[rel="author"]').first().text().trim() ||
        null;
      
      return author;
    } catch (err) {
      if (attempt < retries && (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT')) {
        console.error(`  ⏱️  Timeout (attempt ${attempt + 1}/${retries + 1}), retrying...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
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
    
    const author = await getAuthorFromHTML(article.url);
    
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
    
    // Rate limiting: Be nice to the server
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  console.log(`\n💾 Saving updated results...`);
  writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));
  
  console.log(`\n✅ Done!`);
  console.log(`  📊 Updated: ${updated} articles`);
  console.log(`  ❌ Failed: ${failed} articles`);
  console.log(`  📊 Still unknown: ${results.filter(r => r.author === "unknown" || !r.author).length} articles`);
}

fixAuthors().catch(console.error);
