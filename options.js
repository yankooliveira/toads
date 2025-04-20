// options.js
import { DEFAULTS } from './defaults.js';
import { BUILTIN_CHARACTERS, PROMPT_BASE_TEMPLATE, PROMPT_SECTIONS } from './characters.js';
import { createFinalPrompt } from './promptBuilder.js';


// --- Get references to DOM elements ---
const tabButtons = document.querySelectorAll('.tab-button');
const tabPanes = document.querySelectorAll('.tab-pane');

const chanceInput = document.getElementById('chance');

// Character Hub elements
const carouselSlides = document.getElementById('carousel-slides');
const carouselPrevBtn = document.getElementById('carousel-prev');
const carouselNextBtn = document.getElementById('carousel-next');
const carouselDots = document.getElementById('carousel-dots');
const selectedCharacterDetails = document.getElementById('selected-character-details');
const selectCustomFolderBtn = document.getElementById('select-custom-folder-btn');
const customFolderPathSpan = document.getElementById('custom-folder-path');
const rescanCustomFolderBtn = document.getElementById('rescan-custom-folder-btn');
// --- Add reference to the custom folder fieldset ---
const customFolderFieldset = document.getElementById('custom-folder-fieldset');


// Backend Settings elements
const backendOllamaRadio = document.getElementById('backend-ollama');
const geminiSettingsDiv = document.getElementById('gemini-settings');
const geminiApiKeyInput = document.getElementById('geminiApiKey');
const geminiModelSelect = document.getElementById('geminiModel');
const geminiRPMInput = document.getElementById('geminiRPM');
const geminiRPDInput = document.getElementById('geminiRPD');
const promptPreviewArea = document.getElementById('prompt-preview-area');
const backendGeminiRadio = document.getElementById('backend-gemini');
const ollamaSettingsDiv = document.getElementById('ollama-settings');
const ollamaModelInput = document.getElementById('ollamaModel');
const ollamaUrlInput = document.getElementById('ollamaUrl');
const ollamaSendPageContentCheckbox = document.getElementById('ollamaSendPageContent');


// Data Management elements
const maxHistorySizeInput = document.getElementById('maxHistorySize');
const blockedUrlsList = document.getElementById('blocked-urls-list');
const addBlockedUrlBtn = document.getElementById('add-blocked-url-btn');
const newBlockedUrlInput = document.getElementById('new-blocked-url-input');
const historySection = document.getElementById('history-section');
const historyList = document.getElementById('history-list');
const clearHistoryBtn = document.getElementById('clear-history-btn');

const saveButton = document.getElementById('save');
const statusDiv = document.getElementById('status');

// --- Global state ---
let currentBlockedUrls = [];
let currentHistory = []; // Only loaded for display in the UI, background script manages the source of truth
let availableCharacters = []; // List of all characters (builtin + custom)
let selectedCharacterIndex = -1; // Index in availableCharacters array
let currentCustomDirectoryHandle = null; // Store the handle for rescanning (non-persistent across reloads)


// --- Utility Functions ---
function cleanUrlForDisplay(fullUrl) {
    try {
        if (!fullUrl || (!fullUrl.startsWith('http:') && !fullUrl.startsWith('https:'))) {
            return fullUrl;
        }
        const urlObj = new URL(fullUrl);
        return urlObj.origin + urlObj.pathname;
    } catch (e) {
        console.warn("Could not parse URL for display cleaning:", fullUrl, e);
        return fullUrl;
    }
}

function displayStatus(message, color = 'green') {
    statusDiv.textContent = message;
    statusDiv.style.color = color;
    clearTimeout(statusDiv.dataset.timer);
    const timer = setTimeout(() => { statusDiv.textContent = ''; }, 3500);
    statusDiv.dataset.timer = String(timer); // Store as string to be safe with dataset
}

// --- Tab Switching Logic ---
function activateTab(tabId) {
    tabButtons.forEach(button => {
        button.classList.remove('active');
        if (button.dataset.tab === tabId) {
            button.classList.add('active');
        }
    });
    tabPanes.forEach(pane => {
        pane.classList.remove('active');
        if (pane.id === `tab-${tabId}`) {
            pane.classList.add('active');
        }
    });
    // Trigger prompt preview update when backend settings tab is activated
    if (tabId === 'backend-settings') {
         renderPromptPreview();
    }
}

// --- Backend Settings Visibility ---
function updateVisibleSettings() {
    if (backendOllamaRadio.checked) {
        ollamaSettingsDiv.style.display = 'block';
        geminiSettingsDiv.style.display = 'none';
    } else if (backendGeminiRadio.checked) {
        ollamaSettingsDiv.style.display = 'none';
        geminiSettingsDiv.style.display = 'block';
    } else {
         ollamaSettingsDiv.style.display = 'none';
         geminiSettingsDiv.style.display = 'none';
    }
    // Re-render prompt preview as backend settings affect it
     renderPromptPreview();
}


// --- Character Carousel Functions ---

/**
 * Renders the carousel slides and navigation dots.
 * @param {Array<CharacterDefinition>} characters - The list of characters.
 */
function renderCarousel(characters) {
    carouselSlides.innerHTML = '';
    carouselDots.innerHTML = '';

    if (!characters || characters.length === 0) {
        const slide = document.createElement('div');
        slide.className = 'carousel-slide';
        slide.textContent = "No characters available.";
        carouselSlides.appendChild(slide);
        carouselPrevBtn.disabled = true;
        carouselNextBtn.disabled = true;
        selectedCharacterDetails.innerHTML = "<p>No characters available.</p>";
        return;
    }

    carouselPrevBtn.disabled = false;
    carouselNextBtn.disabled = false;

    characters.forEach((char, index) => {
        const slide = document.createElement('div');
        slide.className = 'carousel-slide';
        slide.dataset.index = index; // Store index

        // Use background image for styling flexibility
        if (char.imagePath) {
            slide.style.backgroundImage = `url('${char.imagePath}')`;
            slide.textContent = ''; // No text if image is loaded
             slide.classList.remove('loading');
        } else {
             slide.textContent = char.name; // Fallback text
             slide.classList.add('loading');
        }

        // Add click listener to select this character
        slide.addEventListener('click', () => selectCharacter(index));

        carouselSlides.appendChild(slide);

        // Create corresponding dot
        const dot = document.createElement('span');
        dot.className = 'carousel-dot';
        dot.dataset.index = index;
        dot.addEventListener('click', () => selectCharacter(index));
        carouselDots.appendChild(dot);
    });

     // Ensure slides container width is correct for smooth transition
     carouselSlides.style.width = `${characters.length * 100}%`;
     // Ensure each slide width is correct percentage
     const allSlides = carouselSlides.querySelectorAll('.carousel-slide');
     allSlides.forEach(slide => slide.style.width = `${100 / characters.length}%`);
}

/**
 * Selects a character by index in the availableCharacters array.
 * Updates UI, state, and saves selected ID to storage.
 * @param {number} index - The index of the character to select.
 */
async function selectCharacter(index) {
    if (index < 0 || index >= availableCharacters.length || selectedCharacterIndex === index) {
        return; // Invalid index or already selected
    }

    selectedCharacterIndex = index;
    const selectedChar = availableCharacters[selectedCharacterIndex];

    // Update UI - active slide and dot
    carouselSlides.querySelectorAll('.carousel-slide').forEach((slide, i) => {
        slide.classList.remove('selected');
        if (i === index) slide.classList.add('selected');
    });
    carouselDots.querySelectorAll('.carousel-dot').forEach((dot, i) => {
        dot.classList.remove('active');
        if (i === index) dot.classList.add('active');
    });

    // Scroll the carousel to the selected slide
     const slideWidth = carouselSlides.querySelector('.carousel-slide')?.offsetWidth || 0;
     carouselSlides.style.transform = `translateX(-${index * slideWidth}px)`;


    // Update selected character details display
    renderSelectedCharacterDetails(selectedChar);

    // Save the selected character ID to sync storage
    try {
        // Use browser.storage automatically if polyfill is loaded
        await chrome.storage.sync.set({ selectedCharacterId: selectedChar.id });
        console.log("Selected character ID saved:", selectedChar.id);
    } catch (error) {
        console.error("Error saving selected character ID:", error);
        displayStatus("Error saving character selection.", "red");
    }

    // Update prompt preview based on new character selection
    renderPromptPreview();
}

/**
 * Renders details of the selected character.
 * @param {CharacterDefinition} character - The selected character definition.
 */
function renderSelectedCharacterDetails(character) {
     if (!character) {
         selectedCharacterDetails.innerHTML = "<p>No character selected or available.</p>";
         return;
     }
     selectedCharacterDetails.innerHTML = `
         <h4>${character.name} (${character.source})</h4>
         <p><strong>Persona:</strong> ${character.persona}</p>
         <p><strong>Output Constraints:</strong> ${character.outputConstraints}</p>
         <p><strong>Examples:</strong><br>${character.examples.replace(/\n/g, '<br>')}</p>
         ${character.customPromptTemplate ? `<p><strong>Uses Custom Template:</strong> Yes</p>` : ''}
     `;
}


/**
 * Navigates the carousel left (-1) or right (1).
 * @param {number} direction - -1 for left, 1 for right.
 */
function navigateCarousel(direction) {
    if (availableCharacters.length <= 1) return; // No navigation needed

    let newIndex = selectedCharacterIndex + direction;

    // Wrap around
    if (newIndex < 0) {
        newIndex = availableCharacters.length - 1;
    } else if (newIndex >= availableCharacters.length) {
        newIndex = 0;
    }

    selectCharacter(newIndex);
}


/**
 * Loads available characters from storage and populates the carousel.
 * Initializes with built-ins if storage is empty.
 */
async function loadAvailableCharacters(selectedIdFromSettings) {
    try {
        // Use browser.storage automatically if polyfill is loaded
        const data = await chrome.storage.local.get({ availableCharacters: [] });
        availableCharacters = data.availableCharacters || [];

        if (availableCharacters.length === 0) {
            availableCharacters = [...BUILTIN_CHARACTERS];
             // Use browser.storage automatically if polyfill is loaded
            await chrome.storage.local.set({ availableCharacters: availableCharacters });
            console.log("Initialized available characters with built-ins.");
        } else {
             console.log(`Loaded ${availableCharacters.length} available characters from storage.`);
        }

        renderCarousel(availableCharacters); // Render the slides and dots

        // Find the index of the selected character. Fallback to first available index.
        let initialSelectedIndex = availableCharacters.findIndex(char => char.id === selectedIdFromSettings);
         if (initialSelectedIndex === -1 && availableCharacters.length > 0) {
             initialSelectedIndex = 0; // Fallback to first available index
             console.log(`Selected character ID "${selectedIdFromSettings}" not found. Falling back to first available: ${availableCharacters[initialSelectedIndex].name}`);
             // No need to save selected ID here, selectCharacter will do it on load
         } else if (initialSelectedIndex === -1 && availableCharacters.length === 0) {
              console.warn("No characters available at all.");
              initialSelectedIndex = -1; // No index to select
         }

        // Select the initial character if available
        if (initialSelectedIndex !== -1) {
             selectCharacter(initialSelectedIndex);
        } else {
             // If no characters, display empty state
             renderSelectedCharacterDetails(null);
        }


    } catch (error) {
        console.error("Error loading available characters:", error);
        displayStatus("Error loading characters.", "red");
        availableCharacters = [];
        renderCarousel([]); // Render empty carousel
        renderSelectedCharacterDetails(null);
    }
}

/**
 * Handles the selection of a custom character directory.
 * NOTE: This relies on window.showDirectoryPicker, which is NOT supported in Firefox extension contexts.
 * This function will only work in Chrome or browsers supporting the File System Access API in extension contexts.
 */
async function selectCustomCharacterFolder() {
    if (!window.showDirectoryPicker) {
        displayStatus("File System Access API not supported in your browser/context.", "red");
        console.error("File System Access API not supported.");
        return;
    }

    try {
        // Request permission to select a directory
        const directoryHandle = await window.showDirectoryPicker({
            id: 'ollama-page-quip-characters', // ID for persistence (Chrome only?)
            mode: 'read'
        });

        if (directoryHandle) {
             currentCustomDirectoryHandle = directoryHandle; // Store the handle
             customFolderPathSpan.textContent = directoryHandle.name; // Display name

             // Immediately scan the selected directory
             scanCustomDirectory(directoryHandle);

             // Save the name of the directory for display on next load
             // This only saves the name, not the handle itself, as handles are not persistently stored
             await chrome.storage.sync.set({ customCharacterDirectoryName: directoryHandle.name });

        } else {
             console.log("Directory picker cancelled.");
             // Do nothing if user cancels
        }

    } catch (error) {
        console.error("Error selecting custom character folder:", error);
        if (error.name === 'NotAllowedError') {
             displayStatus("Permission denied to access directory.", "red");
        } else {
             displayStatus("Error selecting folder.", "red");
        }
        currentCustomDirectoryHandle = null; // Clear handle on error
        customFolderPathSpan.textContent = 'No custom folder selected'; // Clear display on error
         chrome.storage.sync.remove('customCharacterDirectoryName'); // Remove saved name
    }
}

/**
 * Scans the given directory handle for custom character definitions.
 * Combines with built-in characters and updates storage/UI.
 * NOTE: This relies on File System Access API which is NOT supported in Firefox extension contexts.
 * @param {FileSystemDirectoryHandle} directoryHandle - The handle for the custom character directory.
 */
async function scanCustomDirectory(directoryHandle) {
    if (!directoryHandle) {
        console.warn("No directory handle provided for scanning.");
         displayStatus("No custom folder selected.", "orange");
        return;
    }
     // Check again for File System Access API support before proceeding
     if (!window.showDirectoryPicker) {
          console.warn("File System Access API not available, cannot scan custom directory.");
          displayStatus("Custom character scanning is not supported in this browser/context.", "red");
          // Optional: Disable UI here if not already done
          if (selectCustomFolderBtn) selectCustomFolderBtn.disabled = true;
          if (rescanCustomFolderBtn) rescanCustomFolderBtn.disabled = true;
          return;
     }


    displayStatus(`Scanning "${directoryHandle.name}"...`, 'orange');
    console.log(`Starting scan of custom directory: ${directoryHandle.name}`);

    let customCharacters = [];
    let directoriesScanned = 0;
    let charactersFound = 0;

    try {
        // Iterate through entries in the root of the selected directory
        for await (const entry of directoryHandle.values()) {
            if (entry.kind === 'directory') {
                directoriesScanned++;
                const charDirHandle = entry;
                // console.log(`Found potential character directory: ${charDirHandle.name}`); // Too noisy

                try {
                    // Look for manifest.json and character.png inside the subdirectory
                    const manifestFileHandle = await charDirHandle.getFileHandle('manifest.json');
                    const imageFileHandle = await charDirHandle.getFileHandle('character.png');

                    const manifestFile = await manifestFileHandle.getFile();
                    const imageFile = await imageFileHandle.getFile();

                    // Read manifest JSON
                    const manifestText = await manifestFile.text();
                    const manifest = JSON.parse(manifestText);

                    // Validate manifest structure
                    if (!manifest.name || !manifest.persona || !manifest.outputConstraints || !manifest.examples) {
                         console.warn(`Skipping directory "${charDirHandle.name}": manifest.json is missing required fields.`);
                         continue;
                    }

                    // Read image as Data URL
                    const reader = new FileReader();
                    const imageDataUrl = await new Promise((resolve, reject) => {
                        reader.onload = () => resolve(reader.result);
                        reader.onerror = reject;
                        reader.readAsDataURL(imageFile);
                    });

                    // Create Custom Character Definition
                    /** @type {CharacterDefinition} */
                    const customCharDef = {
                        id: `custom-${charDirHandle.name}`,
                        name: manifest.name,
                        source: 'custom',
                        imagePath: imageDataUrl, // Data URL
                        persona: manifest.persona,
                        outputConstraints: manifest.outputConstraints,
                        examples: manifest.examples,
                        customPromptTemplate: manifest.customPromptTemplate || null
                    };
                    customCharacters.push(customCharDef);
                    charactersFound++;
                    console.log(`Successfully loaded custom character: ${customCharDef.name} (${customCharDef.id})`);

                } catch (fileError) {
                    if (fileError.name === 'NotFoundError') {
                        // console.warn(`Skipping directory "${charDirHandle.name}": manifest.json or character.png not found.`); // Common, maybe don't log
                    } else if (fileError instanceof SyntaxError) {
                        console.warn(`Skipping directory "${charDirHandle.name}": manifest.json has invalid JSON.`, fileError);
                    } else {
                        console.error(`Error processing directory "${charDirHandle.name}":`, fileError);
                    }
                }
            }
        }

        // Combine built-in and custom characters
        availableCharacters = [...BUILTIN_CHARACTERS, ...customCharacters];

        // Save the updated list of available characters to local storage
        // Use browser.storage automatically if polyfill is loaded
        await chrome.storage.local.set({ availableCharacters: availableCharacters });

        // Update the carousel with the new list
        // Keep the currently selected character if it still exists, otherwise default to first available
        const currentlySelectedId = availableCharacters[selectedCharacterIndex]?.id; // Get ID before re-rendering
        renderCarousel(availableCharacters); // Render the new list
        let newSelectedIndex = availableCharacters.findIndex(char => char.id === currentlySelectedId);

         if (newSelectedIndex === -1 && availableCharacters.length > 0) {
             newSelectedIndex = 0; // Fallback to first available index if old selection gone
             console.log(`Previous selected character ID "${currentlySelectedId}" not found after rescan. Falling back to first available: ${availableCharacters[newSelectedIndex].name}`);
             // selectCharacter will save the new ID
         } else if (newSelectedIndex === -1 && availableCharacters.length === 0) {
             newSelectedIndex = -1; // No characters available
              console.warn("No characters available after rescan.");
              // selectCharacter(null) equivalent handled below
         }

        // Select the appropriate character in the UI
        if (newSelectedIndex !== -1) {
             selectCharacter(newSelectedIndex);
        } else {
             selectedCharacterIndex = -1; // Reset index
             renderSelectedCharacterDetails(null); // Clear details
             // No character ID to save if list is empty
        }


        displayStatus(`Scanned ${directoriesScanned} directories, found ${charactersFound} custom characters from "${directoryHandle.name}".`, 'green');
        console.log(`Finished scanning custom directory "${directoryHandle.name}". Total available characters: ${availableCharacters.length}`);

    } catch (error) {
        console.error("Error during custom directory scan:", error);
        displayStatus("Error scanning custom folder.", "red");
         // On severe scan error, maybe revert availableCharacters to built-ins?
         // For now, just log error and keep whatever list was loaded before the scan.
         // If error happened *after* finding some custom characters, they might be in the list.
    }
}


// --- Render Prompt Preview ---
function renderPromptPreview() {
    const selectedChar = availableCharacters[selectedCharacterIndex];
     if (!selectedChar) {
         promptPreviewArea.value = "Select a character to preview the prompt.";
         return;
     }

     const backendUsed = document.querySelector('input[name="backend"]:checked').value;
     let pageTextRelevant = false; // Will page text be included in the prompt?

     // Determine which template is effectively being used
     const effectiveTemplate = selectedChar.customPromptTemplate || PROMPT_BASE_TEMPLATE;

     if (backendUsed === 'gemini') {
          // For preview, page text is relevant if the effective template includes the placeholder
          pageTextRelevant = effectiveTemplate.includes('{PAGE_TEXT}') || effectiveTemplate.includes('{PAGE_TEXT_SECTION}');

     } else { // Ollama
         // For preview, page text is relevant if the ollamaSendPageContent setting is checked AND
         // if the effective template includes the placeholder
         pageTextRelevant = ollamaSendPageContentCheckbox.checked && (effectiveTemplate.includes('{PAGE_TEXT}') || effectiveTemplate.includes('{PAGE_TEXT_SECTION}'));
     }

     // Simulate context strings for the preview
     const previewUrl = "https://example.com/some/page?query=test#section";
     // Show example history if the history size setting > 0 AND a history placeholder exists in the template being used
      const historyRelevant = parseInt(maxHistorySizeInput.value, 10) > 0 && (effectiveTemplate.includes('{HISTORY}') || effectiveTemplate.includes('{HISTORY_SECTION}'));
     const previewHistory = historyRelevant ? "- Previous quip example 1\n- Previous quip example 2" : "[No history available or included]"; // Improved placeholder

     const previewPageText = pageTextRelevant ? "This is a snippet of the page content for preview." : "[Page text not included]";

     // Use the shared prompt builder function
     const finalPrompt = createFinalPrompt(
         selectedChar,
         previewUrl,
         previewHistory,
         previewPageText // Pass simulated page text
     );

     promptPreviewArea.value = finalPrompt;
}


// --- Blocked URL Functions ---
function renderBlockedUrls() {
    blockedUrlsList.innerHTML = ''; // Clear list
    if (!currentBlockedUrls || currentBlockedUrls.length === 0) {
        blockedUrlsList.innerHTML = '<li><span class="list-item-text">No URLs blocked.</span></li>';
        return;
    }

    currentBlockedUrls.forEach(url => {
        const li = document.createElement('li');
        const span = document.createElement('span');
        span.textContent = url;
        span.className = 'list-item-text';
        li.appendChild(span);

        const removeBtn = document.createElement('button');
        removeBtn.textContent = 'X';
        removeBtn.className = 'remove-btn';
        removeBtn.title = `Remove ${url}`;
        removeBtn.addEventListener('click', () => removeBlockedUrl(url));
        li.appendChild(removeBtn);
        blockedUrlsList.appendChild(li);
    });
}

async function loadBlockedUrls() {
    try {
        // Use browser.storage automatically if polyfill is loaded
        const data = await chrome.storage.sync.get({ blockedUrls: [] });
        currentBlockedUrls = data.blockedUrls || [];
        renderBlockedUrls();
    } catch (error) {
        console.error("Error loading blocked URLs:", error);
        displayStatus("Error loading blocked URLs.", "red");
        currentBlockedUrls = [];
        renderBlockedUrls();
    }
}

async function addBlockedUrl() {
    const rawUrl = newBlockedUrlInput.value.trim();
    if (!rawUrl) return;

    let urlToAdd;
    try {
        urlToAdd = cleanUrlForDisplay(rawUrl);
        // Basic validation: must look like a URL after cleaning
        if (!urlToAdd || !(urlToAdd.startsWith('http://') || urlToAdd.startsWith('https://'))) {
             throw new Error("Invalid URL format (must be a valid web URL).");
        }
    } catch (error) {
        displayStatus(`Invalid URL: ${error.message}`, 'red');
        return;
    }

    if (currentBlockedUrls.includes(urlToAdd)) {
        displayStatus('URL is already blocked.', 'orange');
        newBlockedUrlInput.value = '';
        return;
    }

    currentBlockedUrls.push(urlToAdd);
    currentBlockedUrls.sort();

    try {
        // Use browser.storage automatically if polyfill is loaded
        await chrome.storage.sync.set({ blockedUrls: currentBlockedUrls });
        newBlockedUrlInput.value = '';
        renderBlockedUrls();
        displayStatus('Blocked URL added.', 'green');
    } catch (error) {
        console.error("Error saving blocked URLs:", error);
        displayStatus('Error saving blocked URL.', 'red');
        currentBlockedUrls = currentBlockedUrls.filter(url => url !== urlToAdd); // Revert
        renderBlockedUrls(); // Re-render to show reverted state
    }
}

async function removeBlockedUrl(urlToRemove) {
    const initialBlockedUrls = [...currentBlockedUrls]; // Keep backup
    currentBlockedUrls = currentBlockedUrls.filter(url => url !== urlToRemove);
    renderBlockedUrls(); // Optimistic UI update

    try {
        // Use browser.storage automatically if polyfill is loaded
        await chrome.storage.sync.set({ blockedUrls: currentBlockedUrls });
        displayStatus('Blocked URL removed.', 'green');
    } catch (error) {
        console.error("Error saving blocked URLs after removal:", error);
        displayStatus('Error removing blocked URL.', 'red');
        currentBlockedUrls = initialBlockedUrls; // Revert state on error
        renderBlockedUrls(); // Re-render reverted list
    }
}

// --- History Functions ---
async function clearHistory() {
    displayStatus("Clearing history...", "orange");
    try {
        // Use browser.storage automatically if polyfill is loaded
        await chrome.storage.local.remove('requestHistory');
        currentHistory = []; // Clear global state
        renderHistory([]); // Render empty list
        displayStatus('History cleared!', 'green');
        console.log("History cleared from local storage.");
    } catch (error) {
        console.error("Error clearing history:", error);
        displayStatus('Error clearing history.', 'red');
    }
}

clearHistoryBtn.addEventListener('click', clearHistory); // Call clearHistory
historySection.addEventListener('toggle', (event) => {
    if (event.target.open) {
        // When the history section is opened, load and render history from storage
        loadHistory();
    }
});


function renderHistory() {
    historyList.innerHTML = ''; // Clear list
     if (!currentHistory || currentHistory.length === 0) {
        historyList.innerHTML = '<li><span class="list-item-text">History is empty or not loaded.</span></li>';
        return;
    }

    [...currentHistory].reverse().forEach((item) => { // Newest first
         const li = document.createElement('li');
         const textSpan = document.createElement('span');
         textSpan.className = 'list-item-text';

         const quipText = document.createTextNode(item.quip);
         textSpan.appendChild(quipText);

         const detailsSpan = document.createElement('span');
         detailsSpan.className = 'list-item-details';
         const timestampStr = new Date(item.timestamp).toLocaleString();
         detailsSpan.textContent = `(${cleanUrlForDisplay(item.url)} - ${timestampStr})`;
         textSpan.appendChild(detailsSpan);
         li.appendChild(textSpan);

         const removeBtn = document.createElement('button');
         removeBtn.textContent = 'X';
         removeBtn.className = 'remove-btn';
         removeBtn.title = `Remove this history entry`;
         removeBtn.addEventListener('click', () => removeHistoryItem(item.timestamp));
         li.appendChild(removeBtn);
         historyList.appendChild(li);
    });
}

async function loadHistory() {
    historyList.innerHTML = '<li><span class="list-item-text">Loading history...</span></li>';
    try {
        // Use browser.storage automatically if polyfill is loaded
        const data = await chrome.storage.local.get({ requestHistory: [] });
        currentHistory = data.requestHistory || [];
        renderHistory();
    } catch (error) {
        console.error("Error loading history:", error);
        displayStatus("Error loading history.", "red");
        currentHistory = [];
        renderHistory();
    }
}

async function removeHistoryItem(timestampToRemove) {
    const initialHistory = [...currentHistory]; // Backup
    currentHistory = currentHistory.filter(item => item.timestamp !== timestampToRemove);
    renderHistory(); // Optimistic UI update

     try {
        // Use browser.storage automatically if polyfill is loaded
        await chrome.storage.local.set({ requestHistory: currentHistory });
        displayStatus('History item removed.', 'green');
         // No need to re-render prompt preview here, it uses the maxHistorySize setting, not the list content
    } catch (error) {
        console.error("Error saving history after removal:", error);
        displayStatus('Error removing history item.', 'red');
        currentHistory = initialHistory; // Revert state
        renderHistory(); // Re-render reverted list
    }
}

// --- Save Config Settings ---
function saveOptions() {
    // Read values from form
    const chance = parseInt(chanceInput.value, 10);
    const backendType = document.querySelector('input[name="backend"]:checked').value;
    const ollamaModel = ollamaModelInput.value.trim();
    // Ollama URL is currently not used by the background script's fetch call (it's hardcoded)
    // If you plan to make the URL configurable, you'd read it here and pass it to the background script.
    // const ollamaUrl = ollamaUrlInput.value.trim();
    const ollamaSendPageContent = ollamaSendPageContentCheckbox.checked;
    const geminiApiKey = geminiApiKeyInput.value.trim();
    const geminiModel = geminiModelSelect.value;
    const geminiRPM = parseInt(geminiRPMInput.value, 10);
    const geminiRPD = parseInt(geminiRPDInput.value, 10);
    const maxHistorySize = parseInt(maxHistorySizeInput.value, 10);
    // selectedCharacterId is saved by selectCharacter


    // Validation
    if (isNaN(chance) || chance < 0 || chance > 100) { displayStatus('Error: Chance must be between 0 and 100.', 'red'); return; }
    if (backendType === 'ollama' && !ollamaModel) { displayStatus('Error: Ollama Model name cannot be empty.', 'red'); return; }
    if (backendType === 'gemini' && !geminiModel) { displayStatus('Error: Gemini Model must be selected.', 'red'); return; }
     if (isNaN(geminiRPM) || geminiRPM < 0) { displayStatus('Error: Gemini RPM must be a non-negative number.', 'red'); return; }
    if (isNaN(geminiRPD) || geminiRPD < 0) { displayStatus('Error: Gemini RPD must be a non-negative number.', 'red'); return; }
     if (isNaN(maxHistorySize) || maxHistorySize < 0) { displayStatus('Error: Max History Size must be a non-negative number.', 'red'); return; }
    if (selectedCharacterIndex === -1) { displayStatus('Error: No character available or selected.', 'red'); return; } // Check if any character is selected/available


    // Construct settings object (excluding lists managed separately)
    const settingsToSave = {
        chance: chance,
        backendType: backendType,
        ollamaModel: ollamaModel,
        // ollamaUrl: ollamaUrl, // Not currently used by background script API call
        ollamaSendPageContent: ollamaSendPageContent,
        geminiApiKey: geminiApiKey,
        geminiModel: geminiModel,
        geminiRPM: geminiRPM,
        geminiRPD: geminiRPD,
        maxHistorySize: maxHistorySize
        // selectedCharacterId is saved by selectCharacter
        // customCharacterDirectoryName is saved in selectCustomCharacterFolder/scanCustomDirectory
        // availableCharacters is saved in scanCustomDirectory/loadAvailableCharacters
        // blockedUrls and requestHistory are saved separately
    };

    // Use browser.storage automatically if polyfill is loaded
    chrome.storage.sync.set(settingsToSave, () => {
        if (chrome.runtime.lastError) {
            console.error("Error saving config settings:", chrome.runtime.lastError);
            displayStatus(`Error saving settings: ${chrome.runtime.lastError.message}`, 'red');
        } else {
            console.log("Config settings saved successfully.");
            displayStatus('Config Settings saved!', 'green');
        }
    });
}

// --- Restore All Options ---
async function restoreOptions() {
    try {
        // Load all settings, blocked URLs, history data initially
         // Use browser.storage automatically if polyfill is loaded
        const [settings, blockedUrlsData, historyData, customDirNameData] = await Promise.all([
            chrome.storage.sync.get(DEFAULTS),
            chrome.storage.sync.get({ blockedUrls: [] }),
            chrome.storage.local.get({ requestHistory: [] }),
            chrome.storage.sync.get({ customCharacterDirectoryName: null }) // Load saved custom folder name
        ]);

        const currentSettings = { ...DEFAULTS, ...settings };
        currentBlockedUrls = blockedUrlsData.blockedUrls || [];
        currentHistory = historyData.requestHistory || []; // Loaded for potential future use in UI or initial display

        console.log("Options: Loaded settings:", currentSettings);
        console.log("Options: Loaded blocked URLs:", currentBlockedUrls);
        console.log(`Options: Loaded history size: ${currentHistory.length}`);

        // --- Populate Config UI Fields ---
        chanceInput.value = currentSettings.chance;
        if (currentSettings.backendType === 'gemini') { backendGeminiRadio.checked = true; } else { backendOllamaRadio.checked = true; }
        ollamaModelInput.value = currentSettings.ollamaModel;
        ollamaUrlInput.value = currentSettings.ollamaUrl;
        ollamaSendPageContentCheckbox.checked = currentSettings.ollamaSendPageContent;
        geminiApiKeyInput.value = currentSettings.geminiApiKey;
        geminiModelSelect.value = currentSettings.geminiModel;
        geminiRPMInput.value = currentSettings.geminiRPM;
        geminiRPDInput.value = currentSettings.geminiRPD;
        maxHistorySizeInput.value = currentSettings.maxHistorySize;

        // --- Load & Populate Character Carousel ---
        // This will select the initial character and trigger renderPromptPreview
        await loadAvailableCharacters(currentSettings.selectedCharacterId);

        // --- Handle Custom Folder UI based on API Support ---
        const savedCustomDirName = customDirNameData.customCharacterDirectoryName;

        if (!window.showDirectoryPicker) {
            // File System Access API not supported, disable/hide the custom folder UI
            if (customFolderFieldset) customFolderFieldset.style.display = 'none';
            console.warn("Custom character folder selection disabled: File System Access API not supported.");
            // Optionally display a message in the Character Hub tab
            const charHubPane = document.getElementById('tab-character-hub');
            if (charHubPane && !charHubPane.querySelector('.custom-folder-unavailable')) {
                 const msg = document.createElement('p');
                 msg.className = 'description custom-folder-unavailable';
                 msg.style.color = 'orange';
                 msg.textContent = 'Custom character folders are not supported in this browser.';
                 charHubPane.appendChild(msg);
            }
        } else {
            // API is supported, display the UI and saved folder name if any
             if (customFolderFieldset) customFolderFieldset.style.display = 'block'; // Ensure it's visible if it was hidden by CSS
             if (savedCustomDirName) {
                 customFolderPathSpan.textContent = savedCustomDirName;
             } else {
                 customFolderPathSpan.textContent = 'No custom folder selected';
             }
        }


        // --- Populate List UIs ---
        renderBlockedUrls(); // Render blocked URLs list immediately

        // History list is loaded on demand when section is opened.

        // --- Initial UI State ---
        updateVisibleSettings(); // Ensure correct backend section is shown (also triggers initial prompt preview via event listener)
        // Activate the default tab (e.g., 'general')
        activateTab('general'); // Call this last


    } catch (error) {
        console.error("Options: Uncaught error during restore:", error);
        displayStatus("Error loading options.", "red");
        // Fallback UI if loading fails badly
        renderCarousel([]); // Render empty carousel
        renderSelectedCharacterDetails(null);
        // ... potentially reset other fields to defaults ...
         // Ensure custom folder UI is hidden on restore error if needed
         if (customFolderFieldset) customFolderFieldset.style.display = 'none';
         const charHubPane = document.getElementById('tab-character-hub');
         if (charHubPane && !charHubPane.querySelector('.custom-folder-unavailable')) {
              const msg = document.createElement('p');
              msg.className = 'description custom-folder-unavailable';
              msg.style.color = 'red';
              msg.textContent = 'Failed to load options, custom folders may be unavailable.';
              charHubPane.appendChild(msg);
         }
    }
}

// --- Status Display (Defined above utility functions) ---


// --- Event Listeners (These should be at the bottom) ---
document.addEventListener('DOMContentLoaded', restoreOptions);
saveButton.addEventListener('click', saveOptions); // Saves config only

// Tab button listeners
tabButtons.forEach(button => {
    button.addEventListener('click', () => {
        activateTab(button.dataset.tab);
    });
});

// Backend radio listeners
// updateVisibleSettings is called by both radio listeners AND at the end of restoreOptions
backendOllamaRadio.addEventListener('change', updateVisibleSettings);
backendGeminiRadio.addEventListener('change', updateVisibleSettings);

// Re-render prompt preview when relevant inputs change
// Note: Changing the selected character also triggers renderPromptPreview inside selectCharacter
ollamaSendPageContentCheckbox.addEventListener('change', renderPromptPreview);
maxHistorySizeInput.addEventListener('input', renderPromptPreview);


// Blocked URL listeners
addBlockedUrlBtn.addEventListener('click', addBlockedUrl);
newBlockedUrlInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') { addBlockedUrl(); event.preventDefault(); }
});

// --- Character Selection Listeners ---
// Navigation button listeners
carouselPrevBtn.addEventListener('click', () => navigateCarousel(-1));
carouselNextBtn.addEventListener('click', () => navigateCarousel(1));

// Listener for selecting custom folder - Only add if API is supported
// This check should happen *after* restoreOptions runs,
// or the button should be disabled/hidden first, then listener potentially added/enabled.
// Let's add the listener unconditionally but have the function check support.
selectCustomFolderBtn.addEventListener('click', selectCustomCharacterFolder);

// Listener for rescanning the custom folder - Only add if API is supported
// Same as above, add listener unconditionally, let the function check support.
rescanCustomFolderBtn.addEventListener('click', () => {
    if (currentCustomDirectoryHandle) {
         scanCustomDirectory(currentCustomDirectoryHandle);
    } else {
         displayStatus("Please select a custom folder first.", "orange");
    }
});


console.log("Options script loaded.");