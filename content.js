// content.js
console.log("TOADs: Content script loaded.");

let quipContainer = null;
let quipBubble = null;
let quipText = null;
let quipCharacter = null;
let isListenerAdded = false; // Flag to ensure listener is added only once

const MAX_PAGE_TEXT_LENGTH = 4000; // Max characters to send


function createOrUpdateCharacter(quip, imagePath) { // Added imagePath parameter
    // --- Create Elements (only once) ---
    if (!quipContainer) {
        console.log("TOADs: Creating elements.");
        // Container
        quipContainer = document.createElement('div');
        quipContainer.id = 'ollama-quip-container'; // CSS handles initial hidden state

        // Bubble
        quipBubble = document.createElement('div');
        quipBubble.id = 'ollama-quip-bubble';
        quipText = document.createElement('p');
        quipText.id = 'ollama-quip-text';
        quipBubble.appendChild(quipText);

        // Character
        quipCharacter = document.createElement('img');
        quipCharacter.id = 'ollama-quip-character';
        quipCharacter.alt = "Character"; // Always set alt text

        quipContainer.appendChild(quipBubble);
        quipContainer.appendChild(quipCharacter);

        // Add to Page
        if (document.body) {
             document.body.appendChild(quipContainer);
             console.log("TOADs: Container appended to body.");
        } else {
             document.addEventListener('DOMContentLoaded', () => {
                 if (document.body) {
                    document.body.appendChild(quipContainer);
                    console.log("TOADs: Container appended to body after DOMContentLoaded.");
                 }
             });
        }

        // --- Add Click Listener (only once) ---
        if (quipCharacter && !isListenerAdded) {
            quipCharacter.addEventListener('click', () => {
                console.log("TOADs: Character clicked, hiding.");
                if (quipContainer) {
                    // Removing the class triggers the transition back to initial state
                    quipContainer.classList.remove('ollama-visible');
                }
            });
            isListenerAdded = true;
             console.log("TOADs: Click listener added to character.");
        }
    }

    // --- Update Content (always update text and image on message) ---
    if (quipText) {
        quipText.textContent = quip;
    } else {
         console.error("TOADs: Text element not found for update.");
    }

    // Set the character image source using the provided path/URL
    if (quipCharacter && imagePath) { // Only update if character element exists and path is provided
         console.log("TOADs: Setting character image src:", imagePath.substring(0, 50) + '...'); // Log truncated path
         quipCharacter.src = imagePath;
    } else if (quipCharacter && !imagePath) {
        console.warn("TOADs: No image path provided in message.");
         // Optionally hide the character image or use a default if path is missing
         // quipCharacter.src = chrome.runtime.getURL('images/character.png'); // Fallback
    } else if (!quipCharacter) {
         console.error("TOADs: Character element not found for image update.");
    }


}

// --- Message Listener ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("TOADs: Message received:", request.type, request); // Log full request object

    if (request.type === "SHOW_QUIP") {
        // Expect quip AND imagePath in the message
        const textToShow = request.quip || "Something strange happened...";
        const imagePathToUse = request.imagePath; // Get the image path

        // 1. Ensure elements exist and update text/image.
        // Pass the imagePath to the creation/update function
        createOrUpdateCharacter(textToShow, imagePathToUse);
        console.log(imagePathToUse);

        // 2. Trigger the slide-in animation (if container exists)
        if (quipContainer) {
             // Use setTimeout with 0ms delay or requestAnimationFrame + timeout
             requestAnimationFrame(() => { // Use rAF to wait for DOM processing
                 setTimeout(() => { // Use a tiny timeout after rAF
                     if (document.body.contains(quipContainer)) { // Check if still in DOM
                         console.log("TOADs: Applying '.ollama-visible' class.");
                         quipContainer.classList.add('ollama-visible');
                     } else {
                          console.log("TOADs: Container missing before adding visible class.");
                     }
                 }, 20); // Minimal delay
             });
        } else {
             console.error("TOADs: Container not found when trying to show message.");
        }

        // Response is sent back to background script (optional)
        sendResponse({ status: "Quip and image processed, visibility triggered" });
        return false; // Indicate that sendResponse is called synchronously

    } else if (request.type === "SHOW_ERROR") {
         // Handle SHOW_ERROR - this also needs to show a character, maybe a default error one?
         // Or just show the selected character with the error message? Let's show selected character.
         // Need the character image path in the SHOW_ERROR message too? Or assume the last one?
         // Simpler: SHOW_QUIP is the only message that triggers appearance. Errors are just quips.
         console.error("Content script received unexpected SHOW_ERROR message. Treating as SHOW_QUIP.");
         const errorText = request.error || "An error occurred.";
         // We don't have the imagePath here. Let's rely on SHOW_QUIP always being sent.
         // If background sends SHOW_ERROR, it means it couldn't even build the message properly.
         // Let's remove the SHOW_ERROR type and just send errors as SHOW_QUIP with an error string.
         // If you MUST keep SHOW_ERROR, the background script would need to send the imagePath with it.
         // For now, assume SHOW_ERROR isn't used or needs imagePath.
         sendResponse({ status: "SHOW_ERROR type received but not fully handled without imagePath." });
         return false;

    } else if (request.type === "GET_PAGE_TEXT") {
        console.log("Content script received GET_PAGE_TEXT request.");
        let pageText = "";
        try {
            pageText = document.body.innerText?.substring(0, MAX_PAGE_TEXT_LENGTH) || "";
            console.log(`Extracted and truncated page text (${pageText.length} chars).`);
        } catch (error) {
            console.error("Error extracting page text:", error);
            pageText = "[Error extracting page text]"; // Indicate extraction error
        }
        sendResponse({ pageText: pageText });
        return false; // Indicate that sendResponse is called synchronously

    }

    console.warn("TOADs: Received unknown message type:", request.type);
    return false; // For unknown messages, sendResponse is not expected
});

console.log("TOADs: Content script ready.");