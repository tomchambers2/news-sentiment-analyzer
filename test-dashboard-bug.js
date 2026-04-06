const fs = require('fs');
const data = JSON.parse(fs.readFileSync('./results.json', 'utf8'));

// Test getFeatureValues function (from dashboard)
function getFeatureValues(item, feature) {
  const value = item[feature];
  if (value === null || value === undefined) return ["unknown"];
  if (Array.isArray(value)) {
    return value.length > 0 ? value : ["unknown"];
  }
  return [String(value)];
}

// Test article_length
const feature = "article_length";
console.log(`Testing feature: ${feature}`);
console.log('First 5 articles:');
for (let i = 0; i < 5; i++) {
  const values = getFeatureValues(data[i], feature);
  console.log(`  Article ${i}: ${values}`);
}

// Count all values
const counts = {};
data.forEach((d) => {
  const values = getFeatureValues(d, feature);
  values.forEach((value) => {
    counts[value] = (counts[value] || 0) + 1;
  });
});
console.log('\nCounts:', counts);
