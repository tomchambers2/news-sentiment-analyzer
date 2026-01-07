import { readFileSync, writeFileSync, existsSync, createWriteStream, unlinkSync, symlinkSync } from "fs";
import Database from 'better-sqlite3';

/**
 * Generate a topic-specific dashboard HTML file
 * @param {string} topicId - Topic identifier for file naming
 * @param {string} topicDescription - Topic description for display
 */
export function generateDashboard(topicId, topicDescription) {
  const resultsFile = `results-${topicId}.json`;
  const topicTextCacheFile = `text-cache-${topicId}.json`;
  const dbPath = 'cache/cache.db';
  
  // Create a small text cache with only the articles in results (from SQLite)
  if (existsSync(resultsFile) && existsSync(dbPath)) {
    try {
      const results = JSON.parse(readFileSync(resultsFile, "utf-8"));
      const resultUrls = results.map(r => r.url);
      
      console.log(`📦 Creating text cache for ${resultUrls.length} result articles...`);
      
      // Query SQLite for article texts
      const db = new Database(dbPath, { readonly: true });
      const stmt = db.prepare('SELECT url, text FROM articles WHERE url = ?');
      
      // Write incrementally to avoid memory issues
      const stream = createWriteStream(topicTextCacheFile);
      stream.write('{');
      
      let first = true;
      let count = 0;
      for (const url of resultUrls) {
        const row = stmt.get(url);
        if (row && row.text) {
          if (!first) stream.write(',');
          first = false;
          stream.write(`${JSON.stringify(url)}:${JSON.stringify(row.text)}`);
          count++;
        }
      }
      
      stream.write('}');
      stream.end();
      db.close();
      
      console.log(`   Created ${topicTextCacheFile} (${count} articles)`);
    } catch (err) {
      console.log(`   ⚠️ Could not create text cache: ${err.message}`);
    }
  }

  // Get total scraped articles count from SQLite
  let totalScraped = 0;
  if (existsSync(dbPath)) {
    try {
      const db = new Database(dbPath, { readonly: true });
      const result = db.prepare('SELECT COUNT(*) as count FROM articles').get();
      totalScraped = result ? result.count : 0;
      db.close();
    } catch (err) {
      console.log(`   ⚠️ Could not get scraped count: ${err.message}`);
    }
  }

  // Create symlink to dashboard.html instead of copying
  // The dashboard now auto-detects topic from filename and loads correct data
  const outputFile = `dashboard-${topicId}.html`;
  
  try {
    // Remove existing file/symlink if it exists
    if (existsSync(outputFile)) {
      unlinkSync(outputFile);
    }
    
    // Create symlink
    symlinkSync('dashboard.html', outputFile);
    
    console.log(`🔗 Created symlink: ${outputFile} -> dashboard.html`);
    console.log(`   Changes to dashboard.html will show immediately!`);
    console.log(`   View at: http://localhost:8000/${outputFile}\n`);
  } catch (err) {
    console.error(`   ⚠️ Could not create symlink: ${err.message}`);
    console.log(`   You may need to manually create it: ln -s dashboard.html ${outputFile}`);
  }

  return outputFile;
}
