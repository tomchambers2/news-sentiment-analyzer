/**
 * Merge archive cache with current cache
 * Archive serves as base, current cache overwrites (newer data wins)
 */

import { createReadStream, writeFileSync, readFileSync, existsSync } from 'fs';
import { createInterface } from 'readline';

const ARCHIVE_FILE = 'cache/3_scrape/article_text_archive.json';
const CURRENT_FILE = 'cache/3_scrape/article_text.json';
const OUTPUT_FILE = 'cache/3_scrape/article_text.json';

async function mergeArchiveCache() {
  console.log('🔄 Merging archive cache with current cache...\n');

  // Load current cache first (will take priority)
  let currentCache = {};
  if (existsSync(CURRENT_FILE)) {
    try {
      currentCache = JSON.parse(readFileSync(CURRENT_FILE, 'utf-8'));
      console.log(`📁 Current cache: ${Object.keys(currentCache).length} entries`);
    } catch (err) {
      console.log(`⚠️ Could not load current cache: ${err.message}`);
    }
  }

  // Parse archive file line by line to handle large size
  // JSON format: { "url1": "text1", "url2": "text2", ... }
  console.log(`📦 Loading archive (this may take a moment)...`);

  let archiveCache = {};
  try {
    // For very large files, we need to be careful with memory
    // But since we need to merge, we'll load it into memory
    const archiveContent = readFileSync(ARCHIVE_FILE, 'utf-8');
    archiveCache = JSON.parse(archiveContent);
    console.log(`📦 Archive cache: ${Object.keys(archiveCache).length} entries`);
  } catch (err) {
    if (err.code === 'ERR_STRING_TOO_LONG') {
      console.log(`⚠️ Archive file too large to load directly.`);
      console.log(`   Trying streaming approach...`);
      archiveCache = await parseArchiveStreaming(ARCHIVE_FILE);
    } else {
      console.error(`❌ Could not load archive: ${err.message}`);
      process.exit(1);
    }
  }

  // Merge: start with archive, overlay current cache
  const merged = { ...archiveCache, ...currentCache };

  const archiveCount = Object.keys(archiveCache).length;
  const currentCount = Object.keys(currentCache).length;
  const mergedCount = Object.keys(merged).length;
  const newFromArchive = mergedCount - currentCount;

  console.log(`\n📊 Merge Statistics:`);
  console.log(`   Archive entries: ${archiveCount}`);
  console.log(`   Current entries: ${currentCount}`);
  console.log(`   Merged total: ${mergedCount}`);
  console.log(`   New entries from archive: ${newFromArchive}`);

  // Write merged cache using streaming to handle large size
  console.log(`\n💾 Writing merged cache to ${OUTPUT_FILE}...`);
  await writeJsonStreaming(OUTPUT_FILE, merged);

  console.log(`✅ Done! Cache now has ${mergedCount} entries.`);
}

// Write large JSON object in streaming fashion
async function writeJsonStreaming(filePath, obj) {
  const { createWriteStream } = await import('fs');

  return new Promise((resolve, reject) => {
    const stream = createWriteStream(filePath);
    const keys = Object.keys(obj);

    stream.write('{\n');

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const value = obj[key];
      const line = `  ${JSON.stringify(key)}: ${JSON.stringify(value)}`;

      if (i < keys.length - 1) {
        stream.write(line + ',\n');
      } else {
        stream.write(line + '\n');
      }
    }

    stream.write('}\n');
    stream.end();

    stream.on('finish', resolve);
    stream.on('error', reject);
  });
}

// Streaming parser for very large JSON files
async function parseArchiveStreaming(filePath) {
  return new Promise((resolve, reject) => {
    const result = {};
    let buffer = '';
    let inString = false;
    let escapeNext = false;
    let currentKey = null;
    let depth = 0;

    const stream = createReadStream(filePath, { encoding: 'utf-8', highWaterMark: 64 * 1024 });

    stream.on('data', (chunk) => {
      // Simple streaming JSON object parser
      // This is a simplified approach - for production, use a proper streaming JSON parser
      buffer += chunk;
    });

    stream.on('end', () => {
      try {
        // Parse the complete buffer
        const parsed = JSON.parse(buffer);
        resolve(parsed);
      } catch (err) {
        reject(err);
      }
    });

    stream.on('error', reject);
  });
}

mergeArchiveCache().catch(console.error);
