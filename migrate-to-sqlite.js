/**
 * Migrate JSON caches to SQLite database
 */

import { createReadStream, existsSync, readFileSync } from 'fs';
import { createInterface } from 'readline';
import { bulkInsertArticles, bulkInsertFailures, getStats, close } from './src/cache-db.js';

const ARTICLE_CACHE_FILE = 'cache/3_scrape/article_text.json';
const ARCHIVE_FILE = 'cache/3_scrape/article_text_archive.json';
const FAILURES_FILE = 'cache/3_scrape/failures.json';

async function migrateArticles(filePath, label) {
  if (!existsSync(filePath)) {
    console.log(`  ⚠️ ${label} not found: ${filePath}`);
    return 0;
  }

  console.log(`  📂 Loading ${label}...`);

  return new Promise((resolve, reject) => {
    const articles = [];
    let count = 0;

    const rl = createInterface({
      input: createReadStream(filePath),
      crlfDelay: Infinity
    });

    let currentKey = null;
    let currentValue = '';
    let inValue = false;

    rl.on('line', (line) => {
      // Match key-value pairs like:  "url": "text content"
      const keyMatch = line.match(/^\s*"([^"]+)":\s*"(.*)$/);
      if (keyMatch) {
        // Save previous entry
        if (currentKey && inValue) {
          let val = currentValue;
          if (val.endsWith('",')) val = val.slice(0, -2);
          else if (val.endsWith('"')) val = val.slice(0, -1);
          try {
            articles.push({ url: currentKey, text: JSON.parse('"' + val + '"') });
          } catch {
            articles.push({ url: currentKey, text: val });
          }
          count++;

          // Batch insert every 1000 articles
          if (articles.length >= 1000) {
            bulkInsertArticles(articles);
            articles.length = 0;
            process.stdout.write(`\r  📥 Migrated ${count} articles...`);
          }
        }

        currentKey = keyMatch[1];
        currentValue = keyMatch[2];
        inValue = true;

        // Check if value ends on same line
        if (currentValue.endsWith('",') || currentValue.endsWith('"')) {
          let val = currentValue;
          if (val.endsWith('",')) val = val.slice(0, -2);
          else if (val.endsWith('"')) val = val.slice(0, -1);
          try {
            articles.push({ url: currentKey, text: JSON.parse('"' + val + '"') });
          } catch {
            articles.push({ url: currentKey, text: val });
          }
          count++;
          currentKey = null;
          inValue = false;

          if (articles.length >= 1000) {
            bulkInsertArticles(articles);
            articles.length = 0;
            process.stdout.write(`\r  📥 Migrated ${count} articles...`);
          }
        }
      } else if (inValue && currentKey) {
        currentValue += '\n' + line;
        if (line.endsWith('",') || line.endsWith('"')) {
          let val = currentValue;
          if (val.endsWith('",')) val = val.slice(0, -2);
          else if (val.endsWith('"')) val = val.slice(0, -1);
          try {
            articles.push({ url: currentKey, text: JSON.parse('"' + val + '"') });
          } catch {
            articles.push({ url: currentKey, text: val });
          }
          count++;
          currentKey = null;
          inValue = false;

          if (articles.length >= 1000) {
            bulkInsertArticles(articles);
            articles.length = 0;
            process.stdout.write(`\r  📥 Migrated ${count} articles...`);
          }
        }
      }
    });

    rl.on('close', () => {
      // Insert remaining articles
      if (articles.length > 0) {
        bulkInsertArticles(articles);
      }
      console.log(`\r  ✅ Migrated ${count} articles from ${label}`);
      resolve(count);
    });

    rl.on('error', reject);
  });
}

async function migrateFailures() {
  if (!existsSync(FAILURES_FILE)) {
    console.log(`  ⚠️ Failures file not found`);
    return 0;
  }

  console.log(`  📂 Loading failures...`);

  try {
    const data = JSON.parse(readFileSync(FAILURES_FILE, 'utf-8'));
    const failures = Object.entries(data).map(([url, info]) => ({
      url,
      count: info.count || 1,
      last_failed_at: info.lastFailedAt || new Date().toISOString(),
      error: info.error || 'Unknown error'
    }));

    bulkInsertFailures(failures);
    console.log(`  ✅ Migrated ${failures.length} failure records`);
    return failures.length;
  } catch (err) {
    console.log(`  ⚠️ Error loading failures: ${err.message}`);
    return 0;
  }
}

async function main() {
  console.log('🔄 Migrating JSON caches to SQLite...\n');

  // Migrate archive first (older data)
  await migrateArticles(ARCHIVE_FILE, 'archive');

  // Migrate current cache (newer data overwrites)
  await migrateArticles(ARTICLE_CACHE_FILE, 'current cache');

  // Migrate failures
  await migrateFailures();

  // Show stats
  const stats = getStats();
  console.log(`\n📊 Migration Complete:`);
  console.log(`   Total articles: ${stats.articles}`);
  console.log(`   Total failures: ${stats.failures}`);
  console.log(`   Database: cache/cache.db`);

  close();
}

main().catch(console.error);
