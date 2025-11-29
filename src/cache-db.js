import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';

const DB_PATH = 'cache/cache.db';

// Ensure cache directory exists
mkdirSync('cache', { recursive: true });

// Initialize database
const db = new Database(DB_PATH);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');

// Create tables if they don't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS articles (
    url TEXT PRIMARY KEY,
    text TEXT NOT NULL,
    scraped_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS failures (
    url TEXT PRIMARY KEY,
    count INTEGER DEFAULT 1,
    last_failed_at TEXT DEFAULT CURRENT_TIMESTAMP,
    error TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_articles_scraped_at ON articles(scraped_at);
`);

// Prepared statements for performance
const stmts = {
  getArticle: db.prepare('SELECT text FROM articles WHERE url = ?'),
  saveArticle: db.prepare('INSERT OR REPLACE INTO articles (url, text, scraped_at) VALUES (?, ?, CURRENT_TIMESTAMP)'),
  getFailure: db.prepare('SELECT * FROM failures WHERE url = ?'),
  saveFailure: db.prepare('INSERT OR REPLACE INTO failures (url, count, last_failed_at, error) VALUES (?, ?, CURRENT_TIMESTAMP, ?)'),
  deleteFailure: db.prepare('DELETE FROM failures WHERE url = ?'),
  countArticles: db.prepare('SELECT COUNT(*) as count FROM articles'),
  countFailures: db.prepare('SELECT COUNT(*) as count FROM failures'),
};

/**
 * Get cached article text by URL
 * @param {string} url
 * @returns {string|null}
 */
export function getArticle(url) {
  const row = stmts.getArticle.get(url);
  return row ? row.text : null;
}

/**
 * Save article text to cache
 * @param {string} url
 * @param {string} text
 */
export function saveArticle(url, text) {
  stmts.saveArticle.run(url, text);
}

/**
 * Get failure record by URL
 * @param {string} url
 * @returns {{url: string, count: number, last_failed_at: string, error: string}|null}
 */
export function getFailure(url) {
  return stmts.getFailure.get(url) || null;
}

/**
 * Save or update failure record
 * @param {string} url
 * @param {string} error
 * @param {number} count
 */
export function saveFailure(url, error, count = 1) {
  stmts.saveFailure.run(url, count, error);
}

/**
 * Delete failure record (on successful scrape)
 * @param {string} url
 */
export function deleteFailure(url) {
  stmts.deleteFailure.run(url);
}

/**
 * Get cache statistics
 * @returns {{articles: number, failures: number}}
 */
export function getStats() {
  return {
    articles: stmts.countArticles.get().count,
    failures: stmts.countFailures.get().count,
  };
}

/**
 * Bulk insert articles (for migration)
 * @param {Array<{url: string, text: string}>} articles
 */
export function bulkInsertArticles(articles) {
  const insert = db.prepare('INSERT OR IGNORE INTO articles (url, text) VALUES (?, ?)');
  const insertMany = db.transaction((items) => {
    for (const item of items) {
      insert.run(item.url, item.text);
    }
  });
  insertMany(articles);
}

/**
 * Bulk insert failures (for migration)
 * @param {Array<{url: string, count: number, last_failed_at: string, error: string}>} failures
 */
export function bulkInsertFailures(failures) {
  const insert = db.prepare('INSERT OR IGNORE INTO failures (url, count, last_failed_at, error) VALUES (?, ?, ?, ?)');
  const insertMany = db.transaction((items) => {
    for (const item of items) {
      insert.run(item.url, item.count, item.last_failed_at, item.error);
    }
  });
  insertMany(failures);
}

/**
 * Close database connection
 */
export function close() {
  db.close();
}

export default db;
