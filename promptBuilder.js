import { PROMPT_BASE_TEMPLATE, PROMPT_SECTIONS } from './characters.js';

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

     if (selectedCharacter?.customPromptTemplate) {
          templateToUse = selectedCharacter.customPromptTemplate;
          console.log("PromptBuilder: Using character's custom prompt template.");
     } else {
          templateToUse = PROMPT_BASE_TEMPLATE;
          console.log("PromptBuilder: Using default base prompt template.");
     }

     prompt = templateToUse;

     prompt = prompt.replace(/{PERSONA_INSTRUCTIONS}/g, selectedCharacter?.persona || "");
     prompt = prompt.replace(/{OUTPUT_CONSTRAINTS}/g, selectedCharacter?.outputConstraints || "");
     prompt = prompt.replace(/{EXAMPLES}/g, selectedCharacter?.examples || "");

     prompt = prompt.replace(/{URL}/g, url || "");

     const hasHistorySectionPlaceholder = prompt.includes("{HISTORY_SECTION}");
     const hasHistoryPlaceholder = prompt.includes("{HISTORY}");

     if (historyString) {
          if (hasHistorySectionPlaceholder) {
               console.log("PromptBuilder: Replacing {HISTORY_SECTION} placeholder with history.");
               prompt = prompt.replace(/{HISTORY_SECTION}/g, (PROMPT_SECTIONS.HISTORY || "").replace(/{HISTORY}/g, historyString));
          } else if (hasHistoryPlaceholder) {
               console.log("PromptBuilder: Replacing standalone {HISTORY} placeholder with history.");
               prompt = prompt.replace(/{HISTORY}/g, historyString);
          }
     } else {
          if (hasHistorySectionPlaceholder) {
               console.log("PromptBuilder: Removing {HISTORY_SECTION} placeholder (no history).");
               prompt = prompt.replace(/{HISTORY_SECTION}/g, "\n[No previous quips for this page]\n");
          }
          if (hasHistoryPlaceholder) {
               console.log("PromptBuilder: Replacing standalone {HISTORY} placeholder (no history).");
               prompt = prompt.replace(/{HISTORY}/g, "None");
          }
     }

     const hasPageTextSectionPlaceholder = prompt.includes("{PAGE_TEXT_SECTION}");
     const hasPageTextPlaceholder = prompt.includes("{PAGE_TEXT}");
     const isErrorPageText = pageText === "[Error retrieving page content]" || pageText === "[Page content not received]";

     if (pageText && !isErrorPageText) {
          const formattedPageText = `\n---\n${pageText}\n---`;

          if (hasPageTextSectionPlaceholder) {
               console.log("PromptBuilder: Replacing {PAGE_TEXT_SECTION} placeholder with page text.");
               prompt = prompt.replace(/{PAGE_TEXT_SECTION}/g, (PROMPT_SECTIONS.PAGE_TEXT || "").replace(/{PAGE_TEXT}/g, formattedPageText));
          } else if (hasPageTextPlaceholder) {
               console.log("PromptBuilder: Replacing standalone {PAGE_TEXT} placeholder with page text.");
               prompt = prompt.replace(/{PAGE_TEXT}/g, formattedPageText);
          }
     } else {
          const replacementText = isErrorPageText ? pageText : "\n[Page content not available or not requested]\n";
          if (hasPageTextSectionPlaceholder) {
               console.log("PromptBuilder: Removing {PAGE_TEXT_SECTION} placeholder (no page text).");
               prompt = prompt.replace(/{PAGE_TEXT_SECTION}/g, replacementText);
          }
          if (hasPageTextPlaceholder) {
               console.log("PromptBuilder: Replacing standalone {PAGE_TEXT} placeholder (no page text).");
               prompt = prompt.replace(/{PAGE_TEXT}/g, replacementText);
          }
     }

     prompt = prompt.replace(/{PERSONA_INSTRUCTIONS}|{OUTPUT_CONSTRAINTS}|{EXAMPLES}|{URL}|{HISTORY_SECTION}|{HISTORY}|{PAGE_TEXT_SECTION}|{PAGE_TEXT}/g, "");

     console.log("PromptBuilder: Final prompt length:", prompt.length);
     console.log("PromptBuilder: Final prompt (truncated):", prompt.substring(0, 800) + (prompt.length > 800 ? "..." : ""));
     return prompt;
}