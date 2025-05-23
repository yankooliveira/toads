import { createFinalPrompt } from './promptBuilder.js';
import { DEFAULTS } from './defaults.js';
import { BUILTIN_CHARACTERS } from './characters.js';

console.log("TOADs: Background service worker started.");

// --- Constants ---
const GEMINI_API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models/";
const lastProcessedUrls = new Map();

// --- Helper Functions ---

/**
 * Cleans a URL, removing query parameters and hash fragments.
 * @param {string} fullUrl The original URL.
 * @returns {string|null} The cleaned URL (origin + pathname) or null if invalid.
 */
function cleanUrl(fullUrl) {
    try {
         if (!fullUrl || (!fullUrl.startsWith('http:') && !fullUrl.startsWith('https:'))) {
            return null; // Not a standard web URL
        }
        const urlObj = new URL(fullUrl);
        return urlObj.origin + urlObj.pathname;
    } catch (e) {
        console.warn("Error cleaning URL:", fullUrl, e);
        return null;
    }
}

/**
 * Checks if making a request would violate RPM or RPD limits based on history.
 * @param {Array} history Array of {timestamp: number} objects.
 * @param {number} rpmLimit Max requests per minute (0 = disabled).
 * @param {number} rpdLimit Max requests per day (0 = disabled).
 * @returns {boolean} True if okay to proceed, False if limit hit.
 */
function checkRateLimits(history, rpmLimit, rpdLimit) {
    if (!rpmLimit && !rpdLimit) return true;

    const now = Date.now();
    const oneMinuteAgo = now - 60 * 1000;
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    let countLastMinute = 0;
    let countLastDay = 0;

    const validHistory = Array.isArray(history) ? history : [];

    for (let i = validHistory.length - 1; i >= 0; i--) {
        const timestamp = validHistory[i]?.timestamp;
        if (!timestamp) continue;

        if (timestamp < oneDayAgo) break;

        if (timestamp >= oneMinuteAgo) {
            countLastMinute++;
        }
        countLastDay++;
    }

    if (rpmLimit > 0 && countLastMinute >= rpmLimit) {
        console.log(`%cRate Limit Hit: RPM (${countLastMinute}/${rpmLimit})`, 'color: orange');
        return false;
    }
    if (rpdLimit > 0 && countLastDay >= rpdLimit) {
        console.log(`%cRate Limit Hit: RPD (${countLastDay}/${rpdLimit})`, 'color: orange');
        return false;
    }

    console.log(`Rate Limit Check Passed: RPM (${countLastMinute}/${rpmLimit || 'disabled'}), RPD (${countLastDay}/${rpdLimit || 'disabled'})`);
    return true;
}

/**
 * Adds a new item to the history and prunes it to maxSize using FIFO.
 * @param {Array} history The current history array.
 * @param {object} newItem {timestamp: number, url: string, quip: string}.
 * @param {number} maxSize Max number of items to keep (0 = disabled).
 * @returns {Array} The updated history array.
 */
function updateHistory(history, newItem, maxSize) {
    if (!newItem || typeof newItem !== 'object' || !newItem.timestamp) {
        console.warn("Attempted to add invalid item to history:", newItem);
        return history;
    }
     if (maxSize <= 0) return [];

    const cleanHistory = Array.isArray(history) ? history.filter(item => item && typeof item === 'object' && item.timestamp) : [];

    cleanHistory.push(newItem);

    while (cleanHistory.length > maxSize) {
        cleanHistory.shift();
    }
    return cleanHistory;
}


/**
 * Finds the selected character definition from the available list.
 * Falls back to the first built-in character if selected ID is not found or null.
 * @param {string|null} selectedId - The ID of the character selected in options.
 * @param {Array<CharacterDefinition>} availableChars - List of all loaded characters.
 * @returns {CharacterDefinition|null} The selected character definition, or null if none available.
 */
function getSelectedCharacter(selectedId, availableChars) {
    const validChars = Array.isArray(availableChars) ? availableChars : [];
    let selectedCharacter = validChars.find(char => char.id === selectedId);

    if (!selectedCharacter) {
         console.warn(`Selected character ID "${selectedId}" not found. Falling back to first built-in.`);
         selectedCharacter = BUILTIN_CHARACTERS[0] || null;
    }

    if (!selectedCharacter && validChars.length > 0) {
        console.warn("Selected character and first built-in not found. Falling back to first available.");
         selectedCharacter = validChars[0];
    }

     if (!selectedCharacter) {
         console.error("No characters available at all! Cannot proceed.");
         return null;
     }

     console.log(`Using character: ${selectedCharacter.name} (${selectedCharacter.id})`);
     return selectedCharacter;
}

// --- API Call Functions ---
async function getOllamaQuip(url, model, ollamaBaseUrl, finalPrompt) {
    console.log(`Ollama: Getting quip for URL: ${url} using model: ${model}`);

    const fullOllamaApiUrl = `${ollamaBaseUrl.replace(/\/+$/, '')}/api/generate`;
    try {
        const response = await fetch(fullOllamaApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: model, prompt: finalPrompt, stream: false }),
        });

        if (!response.ok) {
            let errorBody = `Ollama API Error: ${response.status} ${response.statusText}`;
            try { const errorData = await response.json(); if (errorData?.error) { errorBody += ` - ${errorData.error}`; } } catch (e) {}
            throw new Error(errorBody);
        }
        const data = await response.json();
        if (data?.response) { return data.response.trim(); }
        else { console.error("Ollama: Invalid response format:", data); return "Ollama seems confused."; }

    } catch (error) {
        console.error("Ollama: Error calling API:", error);
        let userMessage = "Ollama error. Check console.";
        if (error.message.includes('Failed to fetch')) { userMessage = "Can't reach Ollama. Is it running?"; }
        else if (error.message.includes('403 Forbidden')) { userMessage = "Ollama blocked request (check OLLAMA_ORIGINS)."; }
        else if (error.message.toLowerCase().includes('model') && error.message.toLowerCase().includes('not found')) { userMessage = `Ollama model '${model}' not found. Is it pulled?`; }
        else if (error.message.includes('Ollama API Error')) { userMessage = error.message; }
        return userMessage;
    }
}

async function getGeminiQuip(url, model, apiKey, finalPrompt) {
    console.log(`Gemini: Getting quip for URL: ${url} using model: ${model}`);
    if (!apiKey) { return "Gemini API Key is missing in settings."; }

    const apiUrl = `${GEMINI_API_BASE_URL}${model}:generateContent?key=${apiKey}`;

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: finalPrompt }] }]
            }),
        });

        if (!response.ok) {
             let errorBody = `Gemini API Error: ${response.status} ${response.statusText}`;
             let detailedMessage = errorBody;
             try {
                 const errorData = await response.json();
                 if (errorData?.error?.message) { detailedMessage = `Gemini API Error: ${errorData.error.message}`; }
             } catch (e) {}

             if (response.status === 400 && detailedMessage.includes('API key not valid')) { return "Gemini API Key is invalid. Please check settings."; }
             if (response.status === 400 && detailedMessage.includes('model') && detailedMessage.includes('not found')) { return `Gemini model '${model}' not found or incompatible.`; }
              if (response.status === 400 && detailedMessage.includes('Invalid JSON payload')) { return "Gemini Error: Invalid request structure sent."; }
             if (response.status === 429) { return "Gemini rate limit exceeded. Try again later."; }
              if (response.status === 500) { return "Gemini Server Error (500). Please try again later."; }
             throw new Error(detailedMessage);
        }

        const data = await response.json();

        if (data?.candidates?.[0]?.content?.parts?.[0]?.text) {
            return data.candidates[0].content.parts[0].text.trim();
        } else if (data?.candidates?.[0]?.finishReason) {
            const reason = data.candidates[0].finishReason;
            console.warn("Gemini: Generation finished with reason:", reason, data.candidates[0]?.safetyRatings);
            return `Gemini couldn't generate a quip (Reason: ${reason}).`;
        } else if (data?.promptFeedback?.blockReason) {
             console.warn("Gemini: Prompt blocked with reason:", data.promptFeedback.blockReason, data.promptFeedback?.safetyRatings);
             return `Gemini blocked the prompt (Reason: ${data.promptFeedback.blockReason}).`;
        } else {
             console.error("Gemini: Invalid response format:", JSON.stringify(data));
             return "Gemini returned an unexpected response.";
        }

    } catch (error) {
        console.error("Gemini: Error calling API:", error);
        let userMessage = "Gemini error. Check console.";
        if (error.message.includes('Failed to fetch')) { userMessage = "Can't reach Gemini API. Check connection/firewall."; }
        else if (error.message.includes('Gemini API Error')) { userMessage = error.message; }
        return userMessage;
    }
}


// --- Main Logic: Tab Update Listener ---
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    const currentFullUrl = tab.url;
    const currentCleanUrl = cleanUrl(currentFullUrl);
    const lastUrl = lastProcessedUrls.get(tabId);

    // Only proceed if the status is 'complete', the URL is valid,
    // AND the cleaned URL is different from the last one we processed for this tab.
    if (changeInfo.status === 'complete' && currentCleanUrl && currentCleanUrl !== lastUrl) {
         console.log(`Tab ${tabId} updated to ${currentFullUrl} (New 'complete' URL, processing).`);

         // Mark this URL as processed for this tab BEFORE starting the async operations.
         lastProcessedUrls.set(tabId, currentCleanUrl);

         try {
             const [settings, availableCharsData, historyData, blockedUrlsData] = await Promise.all([
                 chrome.storage.sync.get(DEFAULTS),
                 chrome.storage.local.get({ availableCharacters: [] }),
                 chrome.storage.local.get({ requestHistory: [] }),
                 chrome.storage.sync.get({ blockedUrls: [] })
             ]);

             const currentSettings = { ...DEFAULTS, ...settings };
             let availableCharacters = Array.isArray(availableCharsData.availableCharacters) && availableCharsData.availableCharacters.length > 0
                                       ? availableCharsData.availableCharacters
                                       : BUILTIN_CHARACTERS;

             let currentHistory = historyData.requestHistory || [];
             let currentBlockedUrls = blockedUrlsData.blockedUrls || [];

             console.log("Background: Loaded settings:", currentSettings);
             console.log(`Background: Loaded available characters count: ${availableCharacters.length}`);
             console.log(`Background: Loaded history size: ${currentHistory.length}`);
             console.log(`Background: Loaded blocked URLs:`, currentBlockedUrls);

             const selectedCharacter = getSelectedCharacter(currentSettings.selectedCharacterId, availableCharacters);

             if (!selectedCharacter) {
                  console.error("Background: Cannot find any character definition. Stopping.");
                  return;
             }
             console.log(`Background: Using character: ${selectedCharacter.name} (${selectedCharacter.id})`);


             if (currentBlockedUrls.includes(currentCleanUrl)) {
                  console.log(`%cSkipping blocked URL: ${currentCleanUrl}`, 'color: gray');
                  return;
             }

             const randomChance = Math.random() * 100;
             if (randomChance >= currentSettings.chance) {
                 console.log(`%cAppearance skipped (Chance: ${randomChance.toFixed(1)}% < Needed: ${currentSettings.chance}%)`, 'color: gray');
                 return;
             }
             console.log(`Appearance check passed (Chance: ${randomChance.toFixed(1)}% >= Needed: ${currentSettings.chance}%)`);

             let backendUsed = currentSettings.backendType;
             let getQuipFunction;
             let model;
             let apiKey = null;
             let requiresPageText = false;

             const template = selectedCharacter?.customPromptTemplate;
             const characterTemplateHasPageTextPlaceholder = template !== null && typeof template === 'string' && (template.includes('{PAGE_TEXT}') || template.includes('{PAGE_TEXT_SECTION}'));


             if (currentSettings.backendType === 'gemini') {
                 backendUsed = 'gemini';
                 // Check rate limits only when actually using Gemini
                 if (!checkRateLimits(currentHistory, currentSettings.geminiRPM, currentSettings.geminiRPD)) {
                     // If rate limit hit, we still marked the URL as processed above.
                     // This prevents subsequent 'complete' events for the same URL from re-checking the limit immediately.
                     // The user will have to navigate away and back, or wait for time to pass.
                     return;
                 }
                 getQuipFunction = getGeminiQuip;
                 model = currentSettings.geminiModel;
                 apiKey = currentSettings.geminiApiKey;

                 // Page text is required for Gemini if the template includes the placeholder
                 // Either the character's template has it, OR there's no character template and the base template has it.
                 if (characterTemplateHasPageTextPlaceholder) {
                      requiresPageText = true;
                      console.log("Gemini backend and prompt template includes {PAGE_TEXT}, requesting content.");
                 }

             } else { // Ollama
                 backendUsed = 'ollama';
                 getQuipFunction = getOllamaQuip;
                 model = currentSettings.ollamaModel;

                 // Check if page text is required based on Ollama setting and template placeholders
                 if (currentSettings.ollamaSendPageContent) {
                      requiresPageText = true;
                      console.log("Ollama backend, setting to send page content is enabled, and template supports it.");
                 } else {
                     console.log("Ollama backend, page text not required (setting disabled or template doesn't support it).");
                 }
             }

             let characterImagePath;
             if (selectedCharacter.source === 'builtin') {
                 characterImagePath = chrome.runtime.getURL(selectedCharacter.imagePath);
             } else if (selectedCharacter.source === 'custom') {
                 characterImagePath = selectedCharacter.imagePath;
             } else {
                 console.error("Unknown character source:", selectedCharacter.source);
                 characterImagePath = chrome.runtime.getURL("images/character.png");
             }
             console.log("Character image path:", characterImagePath);

             let pageTextContent = null;
             if (requiresPageText) {
                 console.log("Requesting page text from content script...");
                 try {
                     const response = await Promise.race([
                         chrome.tabs.sendMessage(tabId, { type: "GET_PAGE_TEXT" }),
                         new Promise((_, reject) => setTimeout(() => reject(new Error("Content script response timeout")), 3000))
                     ]);

                     if (response && typeof response.pageText === 'string') {
                         pageTextContent = response.pageText;
                         console.log(`%cReceived page text (${pageTextContent.length} chars).`, 'color: blue');
                     } else {
                         console.warn("Received invalid or missing page text response:", response);
                         pageTextContent = "[Page content not received]";
                     }
                 } catch (error) {
                     console.error("Error getting page text from content script:", error);
                     pageTextContent = "[Error retrieving page content]";
                 }
             } else {
                 console.log("Page text not required for this request.");
             }

             let historyString = "";
             if (currentSettings.maxHistorySize > 0) {
                 const relevantHistoryItems = currentHistory
                 .filter(item => cleanUrl(item.url) === currentCleanUrl)
                 .map(item => item.quip);

             if (relevantHistoryItems.length > 0) {
                 historyString = relevantHistoryItems.map(q => `- ${q}`).join("\n");
                 console.log(`History for prompt (${currentCleanUrl}):\n${historyString}`);
             } else {
                  console.log(`No relevant history found for ${currentCleanUrl}`);
             }
         } else {
             console.log("History feature disabled.");
         }

         const finalPrompt = createFinalPrompt(
             selectedCharacter,
             currentFullUrl,
             historyString,
             pageTextContent
         );

         let quip;
         if (backendUsed === 'gemini') {
             quip = await getQuipFunction(currentFullUrl, model, apiKey, finalPrompt);
         } else { 
             quip = await getQuipFunction(currentFullUrl, model, currentSettings.ollamaUrl, finalPrompt);
         }

         const isErrorQuip = !quip || /error|limit|fail|invalid|reach|blocked|speechless|confused|malfunctioning|missing api key|couldn't generate a quip|blocked the prompt|unexpected response/i.test(quip.toLowerCase());
         if (quip && !isErrorQuip && currentSettings.maxHistorySize > 0) {
             // Add to history only if it's not an error message AND history is enabled
             const newItem = { timestamp: Date.now(), url: currentFullUrl, quip: quip };
             currentHistory = updateHistory(currentHistory, newItem, currentSettings.maxHistorySize);

             chrome.storage.local.set({ requestHistory: currentHistory }).then(() => {
                  console.log(`History updated. New size: ${currentHistory.length}`);
             }).catch(err => {
                 console.error("Error saving updated history:", err);
             });
         } else if (isErrorQuip) {
             console.log("%cSkipping history update due to error/non-quip response:", 'color: orange', quip);
         }

         if (quip) {
             try {
                 await chrome.tabs.sendMessage(tabId, {
                     type: "SHOW_QUIP",
                     quip: quip,
                     imagePath: characterImagePath
                 });
                 console.log(`%c${backendUsed}: Sent message (and image path) to tab ${tabId}`, 'color: green');
             } catch (sendError) {
                  if (sendError.message.includes("Could not establish connection") || sendError.message.includes("Receiving end does not exist")) {
                     console.warn(`Could not send message to tab ${tabId} (content script possibly unloaded or not injected): ${sendError.message}`);
                  } else {
                     console.error(`Error sending message to tab ${tabId}:`, sendError);
                  }
             }
         } else {
             console.log(`${backendUsed}: No quip or error message generated for ${currentFullUrl}`);
         }

     } catch (error) {
        console.error("Background: Uncaught error during main processing loop.", error);
        // Note: If an error occurs here *after* setting lastProcessedUrls,
        // it might prevent a retry on subsequent 'complete' events for the same URL.
        // This is generally acceptable behavior to avoid endless failed loops.
     }
} else {
     // Log why it was skipped (optional, but good for debugging)
     if (changeInfo.status === 'complete' && currentCleanUrl === lastUrl) {
         console.log(`Tab ${tabId}: 'complete' status for same URL ${currentCleanUrl}. Skipping.`);
     } else if (!currentCleanUrl) {
          console.log(`Tab ${tabId}: Invalid URL ${currentFullUrl}. Skipping.`);
     } else {
          console.log(`Tab ${tabId}: Status is '${changeInfo.status}' for ${currentFullUrl}. Skipping.`);
     }
}
});

// Clean up the map when a tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
if (lastProcessedUrls.has(tabId)) {
    lastProcessedUrls.delete(tabId);
    console.log(`Tab ${tabId} closed, removed from tracking map.`);
}
});

chrome.runtime.onInstalled.addListener(async (details) => {
console.log("TOADs: Extension installed or updated.", details);

try {
    const data = await chrome.storage.local.get({ availableCharacters: [] });
    let availableCharacters = data.availableCharacters || [];

    console.log(`OnInstalled: Loaded ${availableCharacters.length} characters from storage.`);

    const latestBuiltinsMap = new Map(BUILTIN_CHARACTERS.map(char => [char.id, char]));

    const updatedAvailableCharacters = [];
    const seenBuiltinIds = new Set();

    for (const char of availableCharacters) {
        if (char && char.id) {
            if (char.source === 'custom') {
                updatedAvailableCharacters.push(char);
            } else if (char.source === 'builtin') {
                if (latestBuiltinsMap.has(char.id)) {
                    updatedAvailableCharacters.push(latestBuiltinsMap.get(char.id));
                    seenBuiltinIds.add(char.id);
                } else {
                    console.log(`OnInstalled: Removing old built-in character "${char.name}" (${char.id}) which is no longer in the package.`);
                }
            } else {
                 console.warn("OnInstalled: Skipping invalid character found in storage (unknown source):", char);
            }
        } else {
             console.warn("OnInstalled: Skipping invalid character found in storage:", char);
        }
    }

    for (const latestBuiltin of BUILTIN_CHARACTERS) {
        if (!seenBuiltinIds.has(latestBuiltin.id)) {
            updatedAvailableCharacters.push(latestBuiltin);
            console.log(`OnInstalled: Adding new built-in character "${latestBuiltin.name}" (${latestBuiltin.id}).`);
        }
    }

    await chrome.storage.local.set({ availableCharacters: updatedAvailableCharacters });
    console.log(`OnInstalled: Saved updated available characters list (${updatedAvailableCharacters.length} items).`);

    // Set default selected character only on first install if not already set
    if (details.reason === "install") {
         const settings = await chrome.storage.sync.get({ selectedCharacterId: null });
        if (settings.selectedCharacterId === null) {
            // Find the first available character, prioritize built-in if available
            const firstCharacter = updatedAvailableCharacters.find(char => char.source === 'builtin') || updatedAvailableCharacters[0];
            const defaultSelectedId = firstCharacter ? firstCharacter.id : null;

            if (defaultSelectedId) {
                 await chrome.storage.sync.set({ selectedCharacterId: defaultSelectedId });
                 console.log(`OnInstalled: Setting default character ID "${defaultSelectedId}" on first install.`);
            } else {
                 console.warn("OnInstalled: No characters available to set a default selected character ID.");
            }
        } else {
             console.log(`OnInstalled: Existing selected character ID "${settings.selectedCharacterId}" found.`);
        }
    } else if (details.reason === "update") {
         console.log("OnInstalled: Update complete. Available characters list in storage updated.");
    }

} catch (error) {
    console.error("OnInstalled: Error during update/install process:", error);
}
});