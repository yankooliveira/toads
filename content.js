console.log("TOADs: Content script loaded.");

let quipContainer = null;
let quipBubble = null;
let quipText = null;
let quipCharacter = null;
let isListenerAdded = false;

const MAX_PAGE_TEXT_LENGTH = 4000;


function createOrUpdateCharacter(quip, imagePath) {
    // Create Elements (only once)
    if (!quipContainer) {
        console.log("TOADs: Creating elements.");
        quipContainer = document.createElement('div');
        quipContainer.id = 'ollama-quip-container';

        // Bubble
        quipBubble = document.createElement('div');
        quipBubble.id = 'ollama-quip-bubble';
        quipText = document.createElement('p');
        quipText.id = 'ollama-quip-text';
        quipBubble.appendChild(quipText);

        // Character
        quipCharacter = document.createElement('img');
        quipCharacter.id = 'ollama-quip-character';
        quipCharacter.alt = "Character";

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

        // Add Click Listener (only once)
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

    // Update Content (always update text and image on message)
    if (quipText) {
        quipText.textContent = quip;
    } else {
         console.error("TOADs: Text element not found for update.");
    }

    // Set the character image source using the provided path/URL
    if (quipCharacter && imagePath) {
         console.log("TOADs: Setting character image src:", imagePath.substring(0, 50) + '...');
         quipCharacter.src = imagePath;
    } else if (quipCharacter && !imagePath) {
        console.warn("TOADs: No image path provided in message.");
    } else if (!quipCharacter) {
         console.error("TOADs: Character element not found for image update.");
    }
}

// Message Listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("TOADs: Message received:", request.type, request);

    if (request.type === "SHOW_QUIP") {
        // Expect quip AND imagePath in the message
        const textToShow = request.quip || "Something strange happened...";
        const imagePathToUse = request.imagePath;

        // 1. Ensure elements exist and update text/image.
        // Pass the imagePath to the creation/update function
        createOrUpdateCharacter(textToShow, imagePathToUse);
        console.log(imagePathToUse);

        // 2. Trigger the slide-in animation (if container exists)
        if (quipContainer) {
             requestAnimationFrame(() => {
                 setTimeout(() => {
                     if (document.body.contains(quipContainer)) {
                         console.log("TOADs: Applying '.ollama-visible' class.");
                         quipContainer.classList.add('ollama-visible');
                     } else {
                          console.log("TOADs: Container missing before adding visible class.");
                     }
                 }, 20);
             });
        } else {
             console.error("TOADs: Container not found when trying to show message.");
        }

        sendResponse({ status: "Quip and image processed, visibility triggered" });
        return false;

    } else if (request.type === "SHOW_ERROR") {
         console.error("Content script received unexpected SHOW_ERROR message. Treating as SHOW_QUIP.");
         const errorText = request.error || "An error occurred.";
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
            pageText = "[Error extracting page text]";
        }
        sendResponse({ pageText: pageText });
        return false;

    }

    console.warn("TOADs: Received unknown message type:", request.type);
    return false;
});

console.log("TOADs: Content script ready.");