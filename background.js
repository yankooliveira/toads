// background.js
import { createFinalPrompt } from './promptBuilder.js';
import { DEFAULTS } from './defaults.js'; // Import DEFAULTS
import { BUILTIN_CHARACTERS, PROMPT_BASE_TEMPLATE, PROMPT_SECTIONS } from './characters.js'; // Import character data

console.log("TOADs: Background service worker started.");

// --- Constants ---
const OLLAMA_API_URL = "http://localhost:11434/api/generate";
const GEMINI_API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models/";

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
        // Keep protocol, hostname, port (if any), and pathname
        return urlObj.origin + urlObj.pathname;
    } catch (e) {
        console.warn("Error cleaning URL:", fullUrl, e);
        return null; // Return null for invalid URLs
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
    if (!rpmLimit && !rpdLimit) return true; // Limits disabled

    const now = Date.now();
    const oneMinuteAgo = now - 60 * 1000;
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    let countLastMinute = 0;
    let countLastDay = 0;

    // Ensure history is an array before iterating
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
        return history; // Return original history if item is invalid
    }
     if (maxSize <= 0) return []; // History disabled

    // Filter out any potential invalid entries before adding
    const cleanHistory = Array.isArray(history) ? history.filter(item => item && typeof item === 'object' && item.timestamp) : [];

    cleanHistory.push(newItem);

    // Prune oldest items if over limit
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
     // Ensure availableChars is a valid array
    const validChars = Array.isArray(availableChars) ? availableChars : [];

    let selectedCharacter = validChars.find(char => char.id === selectedId);

    // Fallback to the first built-in character if the selected one is not found
    if (!selectedCharacter) {
         console.warn(`Selected character ID "${selectedId}" not found among available characters. Falling back to first built-in.`);
         selectedCharacter = BUILTIN_CHARACTERS[0] || null; // Use first built-in or null if none
    }

    // Final fallback if even the first built-in isn't available but others exist
    if (!selectedCharacter && validChars.length > 0) {
        console.warn("Selected character and first built-in not found. Falling back to first available character.");
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
async function getOllamaQuip(url, model, finalPrompt) {
    console.log(`Ollama: Getting quip for URL: ${url} using model: ${model}`);

    try {
        const response = await fetch(OLLAMA_API_URL, {
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
    // Ensure page is loaded and URL is valid
    if (changeInfo.status === 'complete' && tab.url && (tab.url.startsWith('http:') || tab.url.startsWith('https:'))) {
         const currentFullUrl = tab.url;
         console.log(`Tab ${tabId} updated to ${currentFullUrl}`);

         try {
             // Load all necessary data concurrently
             // Load settings (sync) and availableCharacters (local) first to get character info
             const [settings, availableCharsData, historyData, blockedUrlsData] = await Promise.all([
                 chrome.storage.sync.get(DEFAULTS), // Includes selectedCharacterId
                 chrome.storage.local.get({ availableCharacters: [] }), // Load list of all characters
                 chrome.storage.local.get({ requestHistory: [] }), // Load history
                 chrome.storage.sync.get({ blockedUrls: [] }) // Load blocked URLs
             ]);

             // Apply defaults to settings
             const currentSettings = { ...DEFAULTS, ...settings };
             // Ensure availableCharacters is an array, falling back to built-ins if local storage is empty
             let availableCharacters = Array.isArray(availableCharsData.availableCharacters) && availableCharsData.availableCharacters.length > 0
                                       ? availableCharsData.availableCharacters
                                       : BUILTIN_CHARACTERS; // Use built-ins if local storage empty

             let currentHistory = historyData.requestHistory || [];
             let currentBlockedUrls = blockedUrlsData.blockedUrls || [];


             console.log("Background: Loaded settings:", currentSettings);
             console.log(`Background: Loaded available characters count: ${availableCharacters.length}`);
             console.log(`Background: Loaded history size: ${currentHistory.length}`);
             console.log(`Background: Loaded blocked URLs:`, currentBlockedUrls);

             // --- Find the selected character definition ---
             const selectedCharacter = getSelectedCharacter(currentSettings.selectedCharacterId, availableCharacters);

             if (!selectedCharacter) {
                  console.error("Background: Cannot find any character definition. Stopping.");
                  // Optionally send an error message to content script?
                  return; // Cannot proceed without a character
             }
             console.log(`Background: Using character: ${selectedCharacter.name} (${selectedCharacter.id})`);


             // --- Start Checks ---

             // 0. Blocked URL Check
             const currentCleanUrl = cleanUrl(currentFullUrl);
             if (!currentCleanUrl) {
                 console.log("Skipping invalid/uncleanable URL:", currentFullUrl);
                 return;
             }
             if (currentBlockedUrls.includes(currentCleanUrl)) {
                  console.log(`%cSkipping blocked URL: ${currentCleanUrl}`, 'color: gray');
                  return;
             }

             // 1. Appearance Chance
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
             let userCustomPromptString = null; // User's raw custom prompt string from settings
             let requiresPageText = false; // Reset flag for each run

             // 2. Rate Limiting & Backend Setup
             if (currentSettings.backendType === 'gemini') {
                 backendUsed = 'gemini';
                 if (!checkRateLimits(currentHistory, currentSettings.geminiRPM, currentSettings.geminiRPD)) {
                     return; // Stop if rate limited
                 }
                 getQuipFunction = getGeminiQuip;
                 model = currentSettings.geminiModel;
                 apiKey = currentSettings.geminiApiKey;
                 userCustomPromptString = currentSettings.geminiCustomPrompt; // Get Gemini custom prompt

                 // Gemini requires page text if user specifically included the placeholder in their custom prompt string
                 if (userCustomPromptString?.includes('{PAGE_TEXT}') || selectedCharacter.customPromptTemplate?.includes('{PAGE_TEXT}') || PROMPT_BASE_TEMPLATE.includes('{PAGE_TEXT_SECTION}')) {
                     // We need page text if *any* of the potential base templates or the user's custom string use the placeholder
                     // This makes the logic simpler: always request page text if placeholder exists somewhere?
                     // No, let's stick to the setting: only request if explicitly enabled for Ollama OR Gemini AND placeholder exists.
                     // For Gemini, let's say we request if the user's custom prompt field has {PAGE_TEXT}
                     if (userCustomPromptString?.includes('{PAGE_TEXT}')) {
                         requiresPageText = true;
                         console.log("Gemini user custom prompt includes {PAGE_TEXT}, requesting content.");
                     } else if (selectedCharacter.customPromptTemplate?.includes('{PAGE_TEXT_SECTION}') || selectedCharacter.customPromptTemplate?.includes('{PAGE_TEXT}')) {
                         // If character's template uses it AND NO user custom prompt, request
                          if (!userCustomPromptString) {
                             requiresPageText = true;
                              console.log("Selected character template includes {PAGE_TEXT}, requesting content.");
                         }
                     } else if (!userCustomPromptString && !selectedCharacter.customPromptTemplate && (PROMPT_BASE_TEMPLATE.includes('{PAGE_TEXT_SECTION}') || PROMPT_BASE_TEMPLATE.includes('{PAGE_TEXT}'))) {
                          // If NO user custom prompt AND NO character template AND base template has it, request
                          requiresPageText = true;
                          console.log("Default base template includes {PAGE_TEXT}, requesting content.");
                     }
                 }


             } else { // Ollama
                 backendUsed = 'ollama';
                 getQuipFunction = getOllamaQuip;
                 model = currentSettings.ollamaModel;
                 userCustomPromptString = currentSettings.customPrompt; // Get Ollama custom prompt

                 // Ollama requires page text ONLY if the setting is enabled
                 if (currentSettings.ollamaSendPageContent) {
                     requiresPageText = true;
                     console.log("Ollama setting to send page content is enabled.");
                     // Note: createFinalPrompt will handle placeholder replacement based on whether text was successfully retrieved
                 }
             }

             // --- Determine Image Path ---
             let characterImagePath;
             if (selectedCharacter.source === 'builtin') {
                 characterImagePath = chrome.runtime.getURL(selectedCharacter.imagePath);
             } else if (selectedCharacter.source === 'custom') {
                 characterImagePath = selectedCharacter.imagePath; // It's already a Data URL
             } else {
                 console.error("Unknown character source:", selectedCharacter.source);
                 characterImagePath = chrome.runtime.getURL("images/character.png"); // Fallback
             }
             console.log("Character image path:", characterImagePath);


             // 3. Get Page Text (if required)
             let pageTextContent = null;
             if (requiresPageText) { // Check the requiresPageText flag determined above
                 console.log("Requesting page text from content script...");
                 try {
                     // Use a timeout for the content script message in case it fails or page is slow
                     const response = await Promise.race([
                         chrome.tabs.sendMessage(tabId, { type: "GET_PAGE_TEXT" }),
                         new Promise((_, reject) => setTimeout(() => reject(new Error("Content script response timeout")), 3000)) // 3 second timeout
                     ]);

                     if (response && typeof response.pageText === 'string') {
                         pageTextContent = response.pageText;
                         console.log(`%cReceived page text (${pageTextContent.length} chars).`, 'color: blue');
                     } else {
                         console.warn("Received invalid or missing page text response:", response);
                         pageTextContent = "[Page content not received]"; // Indicate issue
                     }
                 } catch (error) {
                     console.error("Error getting page text from content script:", error);
                     pageTextContent = "[Error retrieving page content]"; // Indicate specific error
                 }
             } else {
                 console.log("Page text not required for this request.");
             }


             // 4. Prepare History for Prompt
             let historyString = "";
             if (currentSettings.maxHistorySize > 0) {
                 const relevantHistoryItems = currentHistory
                     .filter(item => cleanUrl(item.url) === currentCleanUrl) // Match cleaned URL
                     .map(item => item.quip); // Get only the quips

                 if (relevantHistoryItems.length > 0) {
                     historyString = relevantHistoryItems.map(q => `- ${q}`).join("\n");
                     console.log(`History for prompt (${currentCleanUrl}):\n${historyString}`);
                 } else {
                      console.log(`No relevant history found for ${currentCleanUrl}`);
                 }
             } else {
                 console.log("History feature disabled (maxHistorySize <= 0).");
             }

             // 5. Create Final Prompt & Get Quip
             // Pass all components to the prompt function
             const finalPrompt = createFinalPrompt(
                 selectedCharacter,          // Character definition
                 userCustomPromptString,     // User's raw custom prompt string
                 currentFullUrl,             // Full URL
                 historyString,              // Formatted history
                 pageTextContent             // Page text snippet
             );
             let quip;

             // Call the selected backend function
             if (backendUsed === 'gemini') {
                 quip = await getQuipFunction(currentFullUrl, model, apiKey, finalPrompt);
             } else { // Ollama
                 quip = await getQuipFunction(currentFullUrl, model, finalPrompt);
             }

             // 6. Update History on Successful Generation
             // Check if the quip looks like an error message before adding to history
             const isErrorQuip = !quip || /error|limit|fail|invalid|reach|blocked|speechless|confused|malfunctioning|missing api key|couldn't generate a quip|blocked the prompt|unexpected response/i.test(quip);
             if (quip && !isErrorQuip && currentSettings.maxHistorySize > 0) {
                 const newItem = { timestamp: Date.now(), url: currentFullUrl, quip: quip };
                 currentHistory = updateHistory(currentHistory, newItem, currentSettings.maxHistorySize);

                 // Save updated history (fire and forget is fine)
                 chrome.storage.local.set({ requestHistory: currentHistory }).then(() => {
                      console.log(`History updated. New size: ${currentHistory.length}`);
                 }).catch(err => {
                     console.error("Error saving updated history:", err);
                 });
             } else if (isErrorQuip) {
                 console.log("%cSkipping history update due to error/non-quip response:", 'color: orange', quip);
             }

             // 7. Send Result to Content Script
             if (quip) { // Send message even if it's an error generated by backend helpers
                 try {
                     // Send the quip AND the character image path
                     await chrome.tabs.sendMessage(tabId, {
                         type: "SHOW_QUIP",
                         quip: quip,
                         imagePath: characterImagePath // Include the image path
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
                 // This case should be rare now as API functions return error strings
                 console.log(`${backendUsed}: No quip or error message generated for ${currentFullUrl}`);
                  // Optionally send an explicit message to hide the bubble if it was already visible
             }

         } catch (error) { // Catch errors during storage loading or initial processing
            console.error("Background: Uncaught error during main processing loop.", error);
         }
    }
});

// Installation listener
chrome.runtime.onInstalled.addListener(async (details) => {
    console.log("TOADs: Extension installed or updated.", details);

    try {
        // Load the current available characters from storage
        const data = await chrome.storage.local.get({ availableCharacters: [] });
        let availableCharacters = data.availableCharacters || [];

        console.log(`OnInstalled: Loaded ${availableCharacters.length} characters from storage.`);

        // Create a map of current built-in characters from the package
        const latestBuiltinsMap = new Map(BUILTIN_CHARACTERS.map(char => [char.id, char]));

        // Build the updated list
        const updatedAvailableCharacters = [];
        const seenBuiltinIds = new Set(); // To track built-ins already added

        // 1. Add existing characters from storage, updating built-ins to the latest version
        for (const char of availableCharacters) {
            if (char && char.id) { // Basic validation
                if (char.source === 'custom') {
                    // Keep custom characters as they are stored
                    updatedAvailableCharacters.push(char);
                } else if (char.source === 'builtin') {
                    // If this built-in still exists in the latest package, use the latest definition
                    if (latestBuiltinsMap.has(char.id)) {
                        updatedAvailableCharacters.push(latestBuiltinsMap.get(char.id));
                        seenBuiltinIds.add(char.id); // Mark as added
                    } else {
                        // This built-in was removed from the package, skip it
                        console.log(`OnInstalled: Removing old built-in character "${char.name}" (${char.id}) which is no longer in the package.`);
                    }
                }
                // Ignore characters with unknown source or missing ID
            } else {
                 console.warn("OnInstalled: Skipping invalid character found in storage:", char);
            }
        }

        // 2. Add any new built-in characters from the package that were not already in storage
        for (const latestBuiltin of BUILTIN_CHARACTERS) {
            if (!seenBuiltinIds.has(latestBuiltin.id)) {
                updatedAvailableCharacters.push(latestBuiltin);
                console.log(`OnInstalled: Adding new built-in character "${latestBuiltin.name}" (${latestBuiltin.id}).`);
            }
        }

        // Save the updated list back to storage
        await chrome.storage.local.set({ availableCharacters: updatedAvailableCharacters });
        console.log(`OnInstalled: Saved updated available characters list (${updatedAvailableCharacters.length} items).`);

        // --- Handle Selected Character ID on Install ---
        // On first install, set the default selected character to the first built-in
        if (details.reason === "install" && updatedAvailableCharacters.length > 0) {
             const settings = await chrome.storage.sync.get({ selectedCharacterId: null });
            if (settings.selectedCharacterId === null) {
                // Find the first built-in in the updated list
                const firstBuiltin = updatedAvailableCharacters.find(char => char.source === 'builtin');
                const defaultSelectedId = firstBuiltin ? firstBuiltin.id : updatedAvailableCharacters[0].id; // Fallback to first available
                await chrome.storage.sync.set({ selectedCharacterId: defaultSelectedId });
                console.log(`OnInstalled: Setting default character ID "${defaultSelectedId}" on first install.`);
            } else {
                 // If selectedCharacterId already exists (e.g., after an update),
                 // check if the selected character is still valid.
                 // The getSelectedCharacter function in the main listener handles fallback if it's not found.
                 console.log(`OnInstalled: Existing selected character ID "${settings.selectedCharacterId}" found.`);
            }
        } else if (details.reason === "update") {
             console.log("OnInstalled: Update complete. Available characters list in storage updated.");
             // The main onUpdated listener will load the updated list and use the (potentially defaulted) selected ID.
        }


    } catch (error) {
        console.error("OnInstalled: Error during update/install process:", error);
        // If a severe error occurs here, the availableCharacters list in storage might be incomplete or empty.
        // The main onUpdated listener and options page load will handle fallbacks (e.g., using BUILTIN_CHARACTERS directly)
    }
});