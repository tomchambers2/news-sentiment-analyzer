import { readFileSync, writeFileSync } from "fs";

/**
 * Generate a topic-specific dashboard HTML file
 * @param {string} topicId - Topic identifier for file naming
 * @param {string} topicDescription - Topic description for display
 */
export function generateDashboard(topicId, topicDescription) {
  const dashboardTemplate = readFileSync("dashboard.html", "utf-8");

  // Replace results.json with topic-specific file
  const resultsFile = `results-${topicId}.json`;
  const updatedDashboard = dashboardTemplate
    .replace(/results\.json/g, resultsFile)
    .replace(/<title>.*?<\/title>/, `<title>${topicDescription} - Analysis Dashboard</title>`)
    .replace(/<h1>.*?<\/h1>/, `<h1>${topicDescription} - Analysis Dashboard</h1>`);

  // Write topic-specific dashboard
  const outputFile = `dashboard-${topicId}.html`;
  writeFileSync(outputFile, updatedDashboard);

  console.log(`\n📊 Generated dashboard: ${outputFile}`);
  console.log(`   View at: http://localhost:8000/${outputFile}\n`);

  return outputFile;
}
