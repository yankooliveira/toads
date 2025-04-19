// promptBuilder.js

import { PROMPT_BASE_TEMPLATE, PROMPT_SECTIONS } from './characters.js'; // Import character data

/**
 * Constructs the final prompt string for the LLM using character components and context.
 * @param {CharacterDefinition} selectedCharacter - The selected character definition.
 * @param {string} url - The full URL of the current page.
 * @param {string} historyString - Formatted historical quips for the cleaned URL.
 * @param {string|null} pageText - Snippet of page text or null/error string.
 * @returns {string} The final prompt ready for the LLM.
 */
export function createFinalPrompt(selectedCharacter, url, historyString, pageText) {
     let templateToUse;
     let prompt = "";

     // 1. Determine the base template.
     if (selectedCharacter?.customPromptTemplate) { // Use optional chaining for safety
          templateToUse = selectedCharacter.customPromptTemplate;
          console.log("PromptBuilder: Using character's custom prompt template.");
     } else {
          templateToUse = PROMPT_BASE_TEMPLATE;
          console.log("PromptBuilder: Using default base prompt template.");
     }

     prompt = templateToUse;

     // 2. Replace core character components
     prompt = prompt.replace(/{PERSONA_INSTRUCTIONS}/g, selectedCharacter?.persona || ""); // Use optional chaining
     prompt = prompt.replace(/{OUTPUT_CONSTRAINTS}/g, selectedCharacter?.outputConstraints || ""); // Use optional chaining
     prompt = prompt.replace(/{EXAMPLES}/g, selectedCharacter?.examples || ""); // Use optional chaining


     // 3. Replace context-specific placeholders (always attempt these)

     // Replace {URL}
     prompt = prompt.replace(/{URL}/g, url || "");

     // Handle HISTORY_SECTION and {HISTORY}
     const hasHistorySectionPlaceholder = prompt.includes("{HISTORY_SECTION}");
     const hasHistoryPlaceholder = prompt.includes("{HISTORY}");

     if (historyString) { // History data exists
          if (hasHistorySectionPlaceholder) {
               console.log("PromptBuilder: Replacing {HISTORY_SECTION} placeholder with history.");
               prompt = prompt.replace(/{HISTORY_SECTION}/g, (PROMPT_SECTIONS.HISTORY || "").replace(/{HISTORY}/g, historyString));
          } else if (hasHistoryPlaceholder) {
               console.log("PromptBuilder: Replacing standalone {HISTORY} placeholder with history.");
               prompt = prompt.replace(/{HISTORY}/g, historyString);
          }
          // If no placeholder, history is not included unless template adds it implicitly
     } else { // No history data
          if (hasHistorySectionPlaceholder) {
               console.log("PromptBuilder: Removing {HISTORY_SECTION} placeholder (no history).");
               prompt = prompt.replace(/{HISTORY_SECTION}/g, "\n[No previous quips for this page]\n"); // Replace with placeholder text
          }
          if (hasHistoryPlaceholder) {
               console.log("PromptBuilder: Replacing standalone {HISTORY} placeholder (no history).");
               prompt = prompt.replace(/{HISTORY}/g, "None"); // Replace with "None"
          }
     }


     // Handle PAGE_TEXT_SECTION and {PAGE_TEXT}
     const hasPageTextSectionPlaceholder = prompt.includes("{PAGE_TEXT_SECTION}");
     const hasPageTextPlaceholder = prompt.includes("{PAGE_TEXT}");
     const isErrorPageText = pageText === "[Error retrieving page content]" || pageText === "[Page content not received]";

     if (pageText && !isErrorPageText) { // Page text data exists and is not an error string
          const formattedPageText = `\n---\n${pageText}\n---`;

          if (hasPageTextSectionPlaceholder) {
               console.log("PromptBuilder: Replacing {PAGE_TEXT_SECTION} placeholder with page text.");
               prompt = prompt.replace(/{PAGE_TEXT_SECTION}/g, (PROMPT_SECTIONS.PAGE_TEXT || "").replace(/{PAGE_TEXT}/g, formattedPageText));
          } else if (hasPageTextPlaceholder) {
               console.log("PromptBuilder: Replacing standalone {PAGE_TEXT} placeholder with page text.");
               prompt = prompt.replace(/{PAGE_TEXT}/g, formattedPageText);
          }
          // If no placeholder, page text is not included unless template adds it implicitly
     } else { // No page text available (null or error)
          const replacementText = isErrorPageText ? pageText : "\n[Page content not available or not requested]\n"; // Use error string if applicable
          if (hasPageTextSectionPlaceholder) {
               console.log("PromptBuilder: Removing {PAGE_TEXT_SECTION} placeholder (no page text).");
               prompt = prompt.replace(/{PAGE_TEXT_SECTION}/g, replacementText);
          }
          if (hasPageTextPlaceholder) {
               console.log("PromptBuilder: Replacing standalone {PAGE_TEXT} placeholder (no page text).");
               prompt = prompt.replace(/{PAGE_TEXT}/g, replacementText);
          }
     }

     // 4. Cleanup any remaining unreplaced section placeholders
     prompt = prompt.replace(/{PERSONA_INSTRUCTIONS}|{OUTPUT_CONSTRAINTS}|{EXAMPLES}|{URL}|{HISTORY_SECTION}|{HISTORY}|{PAGE_TEXT_SECTION}|{PAGE_TEXT}/g, "");


     console.log("PromptBuilder: Final prompt length:", prompt.length);
     console.log("PromptBuilder: Final prompt (truncated):", prompt.substring(0, 800) + (prompt.length > 800 ? "..." : ""));
     return prompt;
}