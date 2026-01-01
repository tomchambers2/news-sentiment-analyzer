import { readdirSync, existsSync, readFileSync, writeFileSync, statSync } from "fs";

/**
 * Generate an index page listing all topic dashboards
 */
export function generateIndex() {
  // Find all results files
  const files = readdirSync(".");
  const topicFiles = files.filter(f => f.startsWith("results-") && f.endsWith(".json"));

  if (topicFiles.length === 0) {
    console.log("ℹ️  No topic results found yet - skipping index generation");
    return;
  }

  // Extract topic info from each results file
  const topics = topicFiles.map(filename => {
    const topicId = filename.replace("results-", "").replace(".json", "");
    const dashboardFile = `dashboard-${topicId}.html`;

    // Load results to get article count and description
    let articleCount = 0;
    let description = topicId;
    let lastUpdated = "Unknown";

    try {
      const results = JSON.parse(readFileSync(filename, "utf-8"));
      articleCount = results.length;

      if (results.length > 0 && results[0].topic_description) {
        description = results[0].topic_description;
      }

      // Get file modification time
      const stats = statSync(filename);
      lastUpdated = stats.mtime.toLocaleDateString();
    } catch (err) {
      console.warn(`⚠️  Could not read ${filename}`);
    }

    return {
      id: topicId,
      description,
      articleCount,
      resultsFile: filename,
      dashboardFile,
      hasDashboard: existsSync(dashboardFile),
      lastUpdated
    };
  });

  // Sort by article count (descending)
  topics.sort((a, b) => b.articleCount - a.articleCount);

  // Generate HTML
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>News Analysis Topics - Index</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 2rem;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
    }

    header {
      background: white;
      border-radius: 16px;
      padding: 2rem;
      margin-bottom: 2rem;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
    }

    h1 {
      color: #1a202c;
      font-size: 2.5rem;
      margin-bottom: 0.5rem;
    }

    .subtitle {
      color: #718096;
      font-size: 1.1rem;
    }

    .stats {
      display: flex;
      gap: 2rem;
      margin-top: 1.5rem;
      padding-top: 1.5rem;
      border-top: 2px solid #e2e8f0;
    }

    .stat {
      display: flex;
      flex-direction: column;
    }

    .stat-value {
      font-size: 2rem;
      font-weight: bold;
      color: #667eea;
    }

    .stat-label {
      color: #718096;
      font-size: 0.9rem;
      margin-top: 0.25rem;
    }

    .topics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
      gap: 1.5rem;
    }

    .topic-card {
      background: white;
      border-radius: 12px;
      padding: 1.5rem;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
      transition: transform 0.2s, box-shadow 0.2s;
      cursor: pointer;
    }

    .topic-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
    }

    .topic-header {
      display: flex;
      justify-content: space-between;
      align-items: start;
      margin-bottom: 1rem;
    }

    .topic-id {
      font-weight: 600;
      color: #667eea;
      font-size: 1.1rem;
      text-transform: capitalize;
    }

    .article-count {
      background: #667eea;
      color: white;
      padding: 0.25rem 0.75rem;
      border-radius: 20px;
      font-size: 0.85rem;
      font-weight: 600;
    }

    .topic-description {
      color: #4a5568;
      font-size: 0.95rem;
      line-height: 1.6;
      margin-bottom: 1rem;
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .topic-meta {
      display: flex;
      gap: 1rem;
      font-size: 0.85rem;
      color: #718096;
      padding-top: 1rem;
      border-top: 1px solid #e2e8f0;
    }

    .meta-item {
      display: flex;
      align-items: center;
      gap: 0.25rem;
    }

    .btn {
      display: inline-block;
      padding: 0.75rem 1.5rem;
      background: #667eea;
      color: white;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 500;
      transition: background 0.2s;
      margin-top: 1rem;
    }

    .btn:hover {
      background: #5a67d8;
    }

    .btn-secondary {
      background: #718096;
    }

    .btn-secondary:hover {
      background: #4a5568;
    }

    .no-topics {
      background: white;
      border-radius: 12px;
      padding: 3rem;
      text-align: center;
      color: #718096;
    }

    .footer {
      margin-top: 3rem;
      text-align: center;
      color: white;
      opacity: 0.8;
    }

    @media (max-width: 768px) {
      .topics-grid {
        grid-template-columns: 1fr;
      }

      .stats {
        flex-direction: column;
        gap: 1rem;
      }

      h1 {
        font-size: 2rem;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>📊 News Analysis Topics</h1>
      <p class="subtitle">Bristol news sentiment analysis across multiple topics</p>

      <div class="stats">
        <div class="stat">
          <div class="stat-value">${topics.length}</div>
          <div class="stat-label">Topics Analyzed</div>
        </div>
        <div class="stat">
          <div class="stat-value">${topics.reduce((sum, t) => sum + t.articleCount, 0)}</div>
          <div class="stat-label">Total Articles</div>
        </div>
        <div class="stat">
          <div class="stat-value">${topics.filter(t => t.hasDashboard).length}</div>
          <div class="stat-label">Active Dashboards</div>
        </div>
      </div>
    </header>

    ${topics.length > 0 ? `
    <div class="topics-grid">
      ${topics.map(topic => `
        <div class="topic-card" onclick="window.location.href='${topic.dashboardFile}'">
          <div class="topic-header">
            <div class="topic-id">${topic.id.replace(/-/g, ' ')}</div>
            <div class="article-count">${topic.articleCount} articles</div>
          </div>

          <div class="topic-description">${topic.description}</div>

          <div class="topic-meta">
            <div class="meta-item">
              <span>📅</span>
              <span>Updated ${topic.lastUpdated}</span>
            </div>
            <div class="meta-item">
              <span>${topic.hasDashboard ? '✅' : '⚠️'}</span>
              <span>${topic.hasDashboard ? 'Dashboard ready' : 'No dashboard'}</span>
            </div>
          </div>

          ${topic.hasDashboard ? `
            <a href="${topic.dashboardFile}" class="btn" onclick="event.stopPropagation()">
              View Dashboard →
            </a>
          ` : `
            <a href="${topic.resultsFile}" class="btn btn-secondary" onclick="event.stopPropagation()">
              View Raw Data →
            </a>
          `}
        </div>
      `).join('')}
    </div>
    ` : `
    <div class="no-topics">
      <h2>No topics analyzed yet</h2>
      <p>Run <code>npm start</code> to analyze your first topic</p>
    </div>
    `}

    <div class="footer">
      <p>Generated ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
    </div>
  </div>
</body>
</html>`;

  writeFileSync("index.html", html);
  console.log(`\n🏠 Generated index page: index.html`);
  console.log(`   View at: http://localhost:8000/\n`);
}
