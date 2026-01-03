#!/usr/bin/env node
/**
 * Regenerate dashboard HTML files without running the full analysis
 * Usage: node regenerate-dashboard.js [topic-id]
 *   If topic-id is provided, only regenerates that topic's dashboard
 *   If no topic-id, regenerates all topic dashboards
 */

import { getTopic, listTopics } from "./src/topics.js";
import { generateDashboard } from "./src/generate-dashboard.js";

const topicId = process.argv[2];

if (topicId) {
  // Regenerate specific topic
  try {
    const topic = getTopic(topicId);
    console.log(`\n🔄 Regenerating dashboard for: ${topic.id}\n`);
    generateDashboard(topic.id, topic.description);
    console.log(`✅ Done!\n`);
  } catch (err) {
    console.error(`\n❌ Error: ${err.message}\n`);
    console.log("Available topics:");
    listTopics().forEach(t => console.log(`   ${t.id} - ${t.description}`));
    process.exit(1);
  }
} else {
  // Regenerate all topics
  console.log(`\n🔄 Regenerating dashboards for all topics...\n`);
  const topics = listTopics();
  
  for (const topic of topics) {
    console.log(`\n📊 ${topic.id}:`);
    try {
      generateDashboard(topic.id, topic.description);
    } catch (err) {
      console.error(`   ❌ Error: ${err.message}`);
    }
  }
  
  console.log(`\n✅ Done! Regenerated ${topics.length} dashboard(s)\n`);
}


