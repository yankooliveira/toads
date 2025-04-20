import { DEFAULTS } from './defaults.js';
import { BUILTIN_CHARACTERS, PROMPT_BASE_TEMPLATE, PROMPT_SECTIONS } from './characters.js';
import { createFinalPrompt } from './promptBuilder.js';


const tabButtons = document.querySelectorAll('.tab-button');
const tabPanes = document.querySelectorAll('.tab-pane');

const chanceInput = document.getElementById('chance');

const carouselSlides = document.getElementById('carousel-slides');
const carouselPrevBtn = document.getElementById('carousel-prev');
const carouselNextBtn = document.getElementById('carousel-next');
const carouselDots = document.getElementById('carousel-dots');
const selectedCharacterDetails = document.getElementById('selected-character-details');
const selectCustomFolderBtn = document.getElementById('select-custom-folder-btn');
const customFolderPathSpan = document.getElementById('custom-folder-path');
const rescanCustomFolderBtn = document.getElementById('rescan-custom-folder-btn');
const customFolderFieldset = document.getElementById('custom-folder-fieldset');


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


const maxHistorySizeInput = document.getElementById('maxHistorySize');
const blockedUrlsList = document.getElementById('blocked-urls-list');
const addBlockedUrlBtn = document.getElementById('add-blocked-url-btn');
const newBlockedUrlInput = document.getElementById('new-blocked-url-input');
const historySection = document.getElementById('history-section');
const historyList = document.getElementById('history-list');
const clearHistoryBtn = document.getElementById('clear-history-btn');

const saveButton = document.getElementById('save');
const statusDiv = document.getElementById('status');

let currentBlockedUrls = [];
let currentHistory = [];
let availableCharacters = [];
let selectedCharacterIndex = -1;
let currentCustomDirectoryHandle = null;


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
    statusDiv.dataset.timer = String(timer);
}

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
    if (tabId === 'backend-settings') {
         renderPromptPreview();
    }
}

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
     renderPromptPreview();
}


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
        slide.dataset.index = index;

        if (char.imagePath) {
            slide.style.backgroundImage = `url('${char.imagePath}')`;
            slide.textContent = '';
             slide.classList.remove('loading');
        } else {
             slide.textContent = char.name;
             slide.classList.add('loading');
        }

        slide.addEventListener('click', () => selectCharacter(index));

        carouselSlides.appendChild(slide);

        const dot = document.createElement('span');
        dot.className = 'carousel-dot';
        dot.dataset.index = index;
        dot.addEventListener('click', () => selectCharacter(index));
        carouselDots.appendChild(dot);
    });

     carouselSlides.style.width = `${characters.length * 100}%`;
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
        return;
    }

    selectedCharacterIndex = index;
    const selectedChar = availableCharacters[selectedCharacterIndex];

    carouselSlides.querySelectorAll('.carousel-slide').forEach((slide, i) => {
        slide.classList.remove('selected');
        if (i === index) slide.classList.add('selected');
    });
    carouselDots.querySelectorAll('.carousel-dot').forEach((dot, i) => {
        dot.classList.remove('active');
        if (i === index) dot.classList.add('active');
    });

     const slideWidth = carouselSlides.querySelector('.carousel-slide')?.offsetWidth || 0;
     carouselSlides.style.transform = `translateX(-${index * slideWidth}px)`;

    renderSelectedCharacterDetails(selectedChar);

    try {
        await chrome.storage.sync.set({ selectedCharacterId: selectedChar.id });
        console.log("Selected character ID saved:", selectedChar.id);
    } catch (error) {
        console.error("Error saving selected character ID:", error);
        displayStatus("Error saving character selection.", "red");
    }

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
    if (availableCharacters.length <= 1) return;

    let newIndex = selectedCharacterIndex + direction;

    if (newIndex < 0) {
        newIndex = availableCharacters.length - 1;
    } else if (newIndex >= availableCharacters.length) {
        newIndex = 0;
    }

    selectCharacter(newIndex);
}


/**
 * Loads available characters from storage and populates the carousel.
 */
async function loadAvailableCharacters(selectedIdFromSettings) {
    try {
        const data = await chrome.storage.local.get({ availableCharacters: [] });
        availableCharacters = data.availableCharacters || [];

        if (availableCharacters.length === 0) {
            availableCharacters = [...BUILTIN_CHARACTERS];
            await chrome.storage.local.set({ availableCharacters: availableCharacters });
            console.log("Initialized available characters with built-ins.");
        } else {
             console.log(`Loaded ${availableCharacters.length} available characters from storage.`);
        }

        renderCarousel(availableCharacters);

        let initialSelectedIndex = availableCharacters.findIndex(char => char.id === selectedIdFromSettings);
         if (initialSelectedIndex === -1 && availableCharacters.length > 0) {
             initialSelectedIndex = 0;
             console.log(`Selected character ID "${selectedIdFromSettings}" not found. Falling back to first available: ${availableCharacters[initialSelectedIndex].name}`);
         } else if (initialSelectedIndex === -1 && availableCharacters.length === 0) {
              console.warn("No characters available at all.");
              initialSelectedIndex = -1;
         }

        if (initialSelectedIndex !== -1) {
             selectCharacter(initialSelectedIndex);
        } else {
             renderSelectedCharacterDetails(null);
        }

    } catch (error) {
        console.error("Error loading available characters:", error);
        displayStatus("Error loading characters.", "red");
        availableCharacters = [];
        renderCarousel([]);
        renderSelectedCharacterDetails(null);
    }
}

/**
 * Handles the selection of a custom character directory.
 * NOTE: This relies on window.showDirectoryPicker, which is NOT supported in Firefox extension contexts.
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
            id: 'ollama-page-quip-characters',
            mode: 'read'
        });

        if (directoryHandle) {
             currentCustomDirectoryHandle = directoryHandle;
             customFolderPathSpan.textContent = directoryHandle.name;

             scanCustomDirectory(directoryHandle);

             // Save the name of the directory for display on next load
             // This only saves the name, not the handle itself, as handles are not persistently stored
             await chrome.storage.sync.set({ customCharacterDirectoryName: directoryHandle.name });

        } else {
             console.log("Directory picker cancelled.");
        }

    } catch (error) {
        console.error("Error selecting custom character folder:", error);
        if (error.name === 'NotAllowedError') {
             displayStatus("Permission denied to access directory.", "red");
        } else {
             displayStatus("Error selecting folder.", "red");
        }
        currentCustomDirectoryHandle = null;
        customFolderPathSpan.textContent = 'No custom folder selected';
         chrome.storage.sync.remove('customCharacterDirectoryName');
    }
}

/**
 * Scans the given directory handle for custom character definitions.
 * NOTE: This relies on File System Access API which is NOT supported in Firefox extension contexts.
 * @param {FileSystemDirectoryHandle} directoryHandle - The handle for the custom character directory.
 */
async function scanCustomDirectory(directoryHandle) {
    if (!directoryHandle) {
        console.warn("No directory handle provided for scanning.");
         displayStatus("No custom folder selected.", "orange");
        return;
    }
     if (!window.showDirectoryPicker) {
          console.warn("File System Access API not available, cannot scan custom directory.");
          displayStatus("Custom character scanning is not supported in this browser/context.", "red");
          if (selectCustomFolderBtn) selectCustomFolderBtn.disabled = true;
          if (rescanCustomFolderBtn) rescanCustomFolderBtn.disabled = true;
          return;
     }

    displayStatus(`Scanning "${directoryHandle.name}"...`, 'orange');
    console.log(`Starting scan of custom directory: ${directoryHandle.name}`);

    let customCharacters = [];
    let charactersFound = 0;

    try {
        // Iterate through entries in the root of the selected directory
        for await (const entry of directoryHandle.values()) {
            if (entry.kind === 'directory') {
                const charDirHandle = entry;

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
                        imagePath: imageDataUrl,
                        persona: manifest.persona,
                        outputConstraints: manifest.outputConstraints,
                        examples: manifest.examples,
                        customPromptTemplate: manifest.customPromptTemplate || null
                    };
                    customCharacters.push(customCharDef);
                    charactersFound++;
                    console.log(`Successfully loaded custom character: ${customCharDef.name} (${customCharDef.id})`);

                } catch (fileError) {
                    if (fileError.name !== 'NotFoundError' && !(fileError instanceof SyntaxError)) { // Log unexpected errors
                        console.error(`Error processing directory "${charDirHandle.name}":`, fileError);
                    }
                }
            }
        }

        // Combine built-in and custom characters
        availableCharacters = [...BUILTIN_CHARACTERS, ...customCharacters];

        await chrome.storage.local.set({ availableCharacters: availableCharacters });

        // Update the carousel with the new list
        // Keep the currently selected character if it still exists, otherwise default to first available
        const currentlySelectedId = availableCharacters[selectedCharacterIndex]?.id; // Get ID before re-rendering
        renderCarousel(availableCharacters); // Render the new list
        let newSelectedIndex = availableCharacters.findIndex(char => char.id === currentlySelectedId);

         if (newSelectedIndex === -1 && availableCharacters.length > 0) {
             newSelectedIndex = 0;
             console.log(`Previous selected character ID "${currentlySelectedId}" not found. Falling back to first available: ${availableCharacters[newSelectedIndex].name}`);
         } else if (newSelectedIndex === -1 && availableCharacters.length === 0) {
             newSelectedIndex = -1;
              console.warn("No characters available after rescan.");
         }

        // Select the appropriate character in the UI
        if (newSelectedIndex !== -1) {
             selectCharacter(newSelectedIndex);
        } else {
             selectedCharacterIndex = -1;
             renderSelectedCharacterDetails(null);
        }

        displayStatus(`Scanned folder, found ${charactersFound} custom characters.`, 'green');
        console.log(`Finished scanning custom directory "${directoryHandle.name}". Total available characters: ${availableCharacters.length}`);

    } catch (error) {
        console.error("Error during custom directory scan:", error);
        displayStatus("Error scanning custom folder.", "red");
    }
}


function renderPromptPreview() {
    const selectedChar = availableCharacters[selectedCharacterIndex];
     if (!selectedChar) {
         promptPreviewArea.value = "Select a character to preview the prompt.";
         return;
     }

     const backendUsed = document.querySelector('input[name="backend"]:checked').value;
     let pageTextRelevant = false;

     const effectiveTemplate = selectedChar.customPromptTemplate || PROMPT_BASE_TEMPLATE;

     if (backendUsed === 'gemini') {
          pageTextRelevant = effectiveTemplate.includes('{PAGE_TEXT}') || effectiveTemplate.includes('{PAGE_TEXT_SECTION}');
     } else {
         pageTextRelevant = ollamaSendPageContentCheckbox.checked && (effectiveTemplate.includes('{PAGE_TEXT}') || effectiveTemplate.includes('{PAGE_TEXT_SECTION}'));
     }

     const previewUrl = "https://example.com/some/page?query=test#section";
      const historyRelevant = parseInt(maxHistorySizeInput.value, 10) > 0 && (effectiveTemplate.includes('{HISTORY}') || effectiveTemplate.includes('{HISTORY_SECTION}'));
     const previewHistory = historyRelevant ? "- Previous quip example 1\n- Previous quip example 2" : "[No history available or included]";

     const previewPageText = pageTextRelevant ? "This is a snippet of the page content for preview." : "[Page text not included]";

     const finalPrompt = createFinalPrompt(
         selectedChar,
         previewUrl,
         previewHistory,
         previewPageText
     );

     promptPreviewArea.value = finalPrompt;
}


function renderBlockedUrls() {
    blockedUrlsList.innerHTML = '';
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
        await chrome.storage.sync.set({ blockedUrls: currentBlockedUrls });
        newBlockedUrlInput.value = '';
        renderBlockedUrls();
        displayStatus('Blocked URL added.', 'green');
    } catch (error) {
        console.error("Error saving blocked URLs:", error);
        displayStatus('Error saving blocked URL.', 'red');
        currentBlockedUrls = currentBlockedUrls.filter(url => url !== urlToAdd);
        renderBlockedUrls();
    }
}

async function removeBlockedUrl(urlToRemove) {
    const initialBlockedUrls = [...currentBlockedUrls];
    currentBlockedUrls = currentBlockedUrls.filter(url => url !== urlToRemove);
    renderBlockedUrls();

    try {
        await chrome.storage.sync.set({ blockedUrls: currentBlockedUrls });
        displayStatus('Blocked URL removed.', 'green');
    } catch (error) {
        console.error("Error saving blocked URLs after removal:", error);
        displayStatus('Error removing blocked URL.', 'red');
        currentBlockedUrls = initialBlockedUrls;
        renderBlockedUrls();
    }
}

async function clearHistory() {
    displayStatus("Clearing history...", "orange");
    try {
        await chrome.storage.local.remove('requestHistory');
        currentHistory = [];
        renderHistory([]);
        displayStatus('History cleared!', 'green');
        console.log("History cleared from local storage.");
    } catch (error) {
        console.error("Error clearing history:", error);
        displayStatus('Error clearing history.', 'red');
    }
}

clearHistoryBtn.addEventListener('click', clearHistory);
historySection.addEventListener('toggle', (event) => {
    if (event.target.open) {
        loadHistory();
    }
});


function renderHistory() {
    historyList.innerHTML = '';
     if (!currentHistory || currentHistory.length === 0) {
        historyList.innerHTML = '<li><span class="list-item-text">History is empty or not loaded.</span></li>';
        return;
    }

    [...currentHistory].reverse().forEach((item) => {
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
    const initialHistory = [...currentHistory];
    currentHistory = currentHistory.filter(item => item.timestamp !== timestampToRemove);
    renderHistory();

     try {
        await chrome.storage.local.set({ requestHistory: currentHistory });
        displayStatus('History item removed.', 'green');
    } catch (error) {
        console.error("Error saving history after removal:", error);
        displayStatus('Error removing history item.', 'red');
        currentHistory = initialHistory;
        renderHistory();
    }
}

function saveOptions() {
    const chance = parseInt(chanceInput.value, 10);
    const backendType = document.querySelector('input[name="backend"]:checked').value;
    const ollamaModel = ollamaModelInput.value.trim();
    const ollamaSendPageContent = ollamaSendPageContentCheckbox.checked;
    const geminiApiKey = geminiApiKeyInput.value.trim();
    const geminiModel = geminiModelSelect.value;
    const geminiRPM = parseInt(geminiRPMInput.value, 10);
    const geminiRPD = parseInt(geminiRPDInput.value, 10);
    const maxHistorySize = parseInt(maxHistorySizeInput.value, 10);

    if (isNaN(chance) || chance < 0 || chance > 100) { displayStatus('Error: Chance must be between 0 and 100.', 'red'); return; }
    if (backendType === 'ollama' && !ollamaModel) { displayStatus('Error: Ollama Model name cannot be empty.', 'red'); return; }
    if (backendType === 'gemini' && !geminiModel) { displayStatus('Error: Gemini Model must be selected.', 'red'); return; }
     if (isNaN(geminiRPM) || geminiRPM < 0) { displayStatus('Error: Gemini RPM must be a non-negative number.', 'red'); return; }
    if (isNaN(geminiRPD) || geminiRPD < 0) { displayStatus('Error: Gemini RPD must be a non-negative number.', 'red'); return; }
     if (isNaN(maxHistorySize) || maxHistorySize < 0) { displayStatus('Error: Max History Size must be a non-negative number.', 'red'); return; }
    if (selectedCharacterIndex === -1) { displayStatus('Error: No character available or selected.', 'red'); return; }


    const settingsToSave = {
        chance: chance,
        backendType: backendType,
        ollamaModel: ollamaModel,
        ollamaSendPageContent: ollamaSendPageContent,
        geminiApiKey: geminiApiKey,
        geminiModel: geminiModel,
        geminiRPM: geminiRPM,
        geminiRPD: geminiRPD,
        maxHistorySize: maxHistorySize
    };

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

async function restoreOptions() {
    try {
        const [settings, blockedUrlsData, historyData, customDirNameData] = await Promise.all([
            chrome.storage.sync.get(DEFAULTS),
            chrome.storage.sync.get({ blockedUrls: [] }),
            chrome.storage.local.get({ requestHistory: [] }),
            chrome.storage.sync.get({ customCharacterDirectoryName: null })
        ]);

        const currentSettings = { ...DEFAULTS, ...settings };
        currentBlockedUrls = blockedUrlsData.blockedUrls || [];
        currentHistory = historyData.requestHistory || [];

        console.log("Options: Loaded settings:", currentSettings);
        console.log("Options: Loaded blocked URLs:", currentBlockedUrls);
        console.log(`Options: Loaded history size: ${currentHistory.length}`);

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

        await loadAvailableCharacters(currentSettings.selectedCharacterId);

        const savedCustomDirName = customDirNameData.customCharacterDirectoryName;

        if (!window.showDirectoryPicker) {
            if (customFolderFieldset) customFolderFieldset.style.display = 'none';
            console.warn("Custom character folder selection disabled: File System Access API not supported.");
            const charHubPane = document.getElementById('tab-character-hub');
            if (charHubPane && !charHubPane.querySelector('.custom-folder-unavailable')) {
                 const msg = document.createElement('p');
                 msg.className = 'description custom-folder-unavailable';
                 msg.style.color = 'orange';
                 msg.textContent = 'Custom character folders are not supported in this browser.';
                 charHubPane.appendChild(msg);
            }
        } else {
             if (customFolderFieldset) customFolderFieldset.style.display = 'block';
             if (savedCustomDirName) {
                 customFolderPathSpan.textContent = savedCustomDirName;
             } else {
                 customFolderPathSpan.textContent = 'No custom folder selected';
             }
        }

        renderBlockedUrls();

        updateVisibleSettings();
        activateTab('general');

    } catch (error) {
        console.error("Options: Uncaught error during restore:", error);
        displayStatus("Error loading options.", "red");
        renderCarousel([]);
        renderSelectedCharacterDetails(null);
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

document.addEventListener('DOMContentLoaded', restoreOptions);
saveButton.addEventListener('click', saveOptions);

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