import { existsSync, readFileSync, writeFileSync } from "fs";

const FILTER_OUTPUT_FILE = "cache/2_filter/filter_output.json";

console.log("🧹 Cleaning up bad cache entries from API errors...\n");

if (!existsSync(FILTER_OUTPUT_FILE)) {
  console.log("❌ No cache file found at:", FILTER_OUTPUT_FILE);
  process.exit(0);
}

// Load the cache
const cache = JSON.parse(readFileSync(FILTER_OUTPUT_FILE, "utf-8"));

// Find entries with error messages
const errorEntries = Object.entries(cache).filter(([url, data]) => {
  if (typeof data === "object" && data.reasoning) {
    return (
      data.reasoning.includes("error") ||
      data.reasoning.includes("Error") ||
      data.reasoning.includes("402") ||
      data.reasoning.includes("429") ||
      data.reasoning.includes("500") ||
      data.reasoning.includes("failed")
    );
  }
  return false;
});

if (errorEntries.length === 0) {
  console.log("✅ No error entries found in cache. Nothing to clean!");
  process.exit(0);
}

console.log(`Found ${errorEntries.length} error entries:\n`);
errorEntries.forEach(([url, data]) => {
  console.log(`  • ${url}`);
  console.log(`    Reason: ${data.reasoning}`);
});

// Remove error entries
errorEntries.forEach(([url]) => {
  delete cache[url];
});

// Save cleaned cache
writeFileSync(FILTER_OUTPUT_FILE, JSON.stringify(cache, null, 2));

console.log(`\n✅ Removed ${errorEntries.length} error entries from cache`);
console.log("These articles will be reprocessed on the next run.");
