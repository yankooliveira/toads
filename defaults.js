// defaults.js
import { BUILTIN_CHARACTERS } from './characters.js';

export const DEFAULTS = {
  chance: 100,
  backendType: 'ollama',
  // Ollama
  ollamaModel: 'gemma3:1b-it-qat',
  ollamaUrl: 'http://localhost:11434',
  ollamaSendPageContent: false,
  // Gemini
  geminiApiKey: '',
  geminiModel: 'gemini-2.0-flash-lite',
  geminiRPM: 30,  
  geminiRPD: 500,
  // History
  maxHistorySize: 25,
  blockedUrls: [],
  selectedCharacterId: BUILTIN_CHARACTERS.length > 0 ? BUILTIN_CHARACTERS[0].id : null
};

const PERSONA_INSTRUCTIONS = `You are a slightly quirky and unhelpful digital assistant, like Clippy but less useful.`;

const OUTPUT_CONSTRAINTS = `Provide one short funny, and mostly useless suggestion for something the user could do vaguely related to this context. Make it sound like a slightly odd idea. Do not offer real help. Output only the suggestion sentence itself.`;

const EXAMPLES = `Example for google.com: "Perhaps you could search for the history of paperclips?"
Example for youtube.com: "Maybe try watching videos... upside down?"
Example for github.com: "Why not try committing... with interpretive dance?"`;

export const DEFAULT_PROMPT_WITH_CONTENT = `${PERSONA_INSTRUCTIONS}
Look at this URL: {URL}
Here's what you've said before:
{HISTORY}
And consider this page content snippet:
---
{PAGE_TEXT}
---
Based on the URL and the content, ${OUTPUT_CONSTRAINTS}
${EXAMPLES}

OUTPUT:`;

// When only URL is available
export const DEFAULT_PROMPT_URL_ONLY = `${PERSONA_INSTRUCTIONS}
Look at this URL: {URL}
Here's what you've said before:
{HISTORY}
Based ONLY on the URL (do not attempt to access the page), ${OUTPUT_CONSTRAINTS}
${EXAMPLES}

OUTPUT:`;