require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const key = process.env.GEMINI_API_KEY;
console.log('Key loaded:', key ? `${key.slice(0, 8)}...${key.slice(-4)} (${key.length} chars)` : 'NOT SET');

const MODELS = [
  'gemini-3.1-flash-lite',
];

async function testModel(genAI, modelName) {
  try {
    const model = genAI.getGenerativeModel({ model: modelName });
    const result = await model.generateContent('Say hello in one word.');
    const text = result.response.text().trim();
    console.log(`  ✓ ${modelName} — "${text}"`);
    return true;
  } catch (err) {
    console.log(`  ✗ ${modelName} — [${err.status || 'ERR'}] ${err.message?.slice(0, 80)}`);
    return false;
  }
}

async function test() {
  const genAI = new GoogleGenerativeAI(key);
  console.log('\nTesting models...\n');
  for (const model of MODELS) {
    await testModel(genAI, model);
  }
}

test().catch(err => {
  console.error('Fatal:', err.message);
});
