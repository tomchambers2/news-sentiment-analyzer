const crypto = require('crypto');

// Your webhook secret key
const secret = 'your_webhook_secret_here';

// The exact payload you want to send
const payload = JSON.stringify({
  ref: 'refs/heads/main',
  // ... rest of your payload
});

// Generate the HMAC-SHA256 signature
const signature = 'sha256=' + 
  crypto.createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

console.log('X-Hub-Signature-256:', signature);

// Example curl command
console.log('\nExample curl command:');
console.log(`curl -X POST YOUR_WEBHOOK_URL \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: push" \
  -H "X-Hub-Signature-256: ${signature}" \
  -d '${payload.replace(/\n/g, '')}'`);
