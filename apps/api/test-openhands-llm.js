// Quick test to verify LLM credentials are being passed through
import { loadOpenHandsConfig } from './src/services/openhands/config.js';

const config = loadOpenHandsConfig();

console.log('OpenHands Configuration:');
console.log('========================');
console.log('Enabled:', config.enabled);
console.log('Model:', config.model);
console.log('LLM API Key:', config.llmApiKey ? config.llmApiKey.substring(0, 20) + '...' : 'NOT SET');
console.log('LLM Base URL:', config.llmBaseUrl || 'NOT SET');
console.log('');

if (config.llmApiKey && config.llmBaseUrl) {
  console.log('✅ LLM credentials ARE configured - will be passed to Python bridge');
  console.log('✅ Agent Server LLM configuration will be IGNORED');
} else {
  console.log('❌ LLM credentials NOT configured - will use Agent Server LLM (OpenAI)');
}
