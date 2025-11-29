import { existsSync, readFileSync, writeFileSync } from "fs";

const FAIL_CACHE_FILE = "cache/3_scrape/failures.json";

console.log("🧹 Cleaning up transient error failures from scrape cache...\n");

if (!existsSync(FAIL_CACHE_FILE)) {
  console.log("❌ No failure cache file found at:", FAIL_CACHE_FILE);
  process.exit(0);
}

// Load the failure cache
const failCache = JSON.parse(readFileSync(FAIL_CACHE_FILE, "utf-8"));

// Find entries with transient errors (timeouts, network issues)
const transientErrors = Object.entries(failCache).filter(([url, data]) => {
  const error = data.error || "";
  return (
    error.includes("timeout") ||
    error.includes("ECONNRESET") ||
    error.includes("ETIMEDOUT") ||
    error.includes("502") ||
    error.includes("503") ||
    error.includes("429")
  );
});

if (transientErrors.length === 0) {
  console.log("✅ No transient error entries found in cache. Nothing to clean!");
  process.exit(0);
}

console.log(`Found ${transientErrors.length} transient error entries:\n`);
transientErrors.forEach(([url, data]) => {
  console.log(`  • ${url}`);
  console.log(`    Error: ${data.error}`);
  console.log(`    Failed ${data.count}x, last: ${data.lastFailedAt}`);
});

// Remove transient error entries
transientErrors.forEach(([url]) => {
  delete failCache[url];
});

// Save cleaned cache
writeFileSync(FAIL_CACHE_FILE, JSON.stringify(failCache, null, 2));

console.log(`\n✅ Removed ${transientErrors.length} transient error entries from cache`);
console.log("These articles will be retried on the next run.");
