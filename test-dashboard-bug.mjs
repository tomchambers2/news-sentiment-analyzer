import fs from 'fs';
const data = JSON.parse(fs.readFileSync('./results.json', 'utf8'));

function getFeatureValues(item, feature) {
  const value = item[feature];
  if (value === null || value === undefined) return ["unknown"];
  if (Array.isArray(value)) {
    return value.length > 0 ? value : ["unknown"];
  }
  return [String(value)];
}

const feature = "article_length";
console.log(`Testing: ${feature}\n`);

const counts = {};
data.forEach((d) => {
  const values = getFeatureValues(d, feature);
  values.forEach((value) => {
    counts[value] = (counts[value] || 0) + 1;
  });
});

console.log('What the dashboard should show:', counts);
console.log('\nFirst 10 raw values:');
data.slice(0, 10).forEach((d, i) => {
  console.log(`  ${i}: "${d[feature]}" (type: ${typeof d[feature]})`);
});
