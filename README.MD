# TOtally unhelpful Assistant Daemons - TOADs

![an animated gif showing different AI generated quips for the Ollama home page](/images/toads.gif "Some totally unhelpful assistant daemons")

Remember that old paper clip that would pop up and give you helpful instructions on how to navigate the dread of crafting documents?
Well, in the age of AI, it's clearly time for something like this to make a comeback.
EVERYWHERE.
Also, not being useful at all.

Totally Unhelpful Assistant Daemons or TOADs for short, will lounge around any webpage and talk about it in the most unhelpful way possible. It's even hard to set up!

Requires either a Gemini API key or an Ollama installation.

## What do these Unhelpful Daemons do?

Mostly, they just... exist... and occasionally bother you.
> A daemon (/ˈdiːmən/ or /ˈdeɪmən/) is a computer program that runs as a background process, rather than being under the direct control of an interactive user.

 Specifically, they will:

*   **Lounge Around:** Pop up in the bottom corner of web pages.
*   **Spout Nonsense:** Generate short, semi-related but utterly unhelpful quips about the page you're looking at, powered by the magic (or lack thereof) of modern AI.
*   **Come in Different Flavors:** Choose from a selection of built-in 'Daemons', each with their own distinct (and equally unhelpful) personality.
*   **Let You Build Your Own:** Feeling brave? You can craft your own custom Daemons with unique looks and unhelpful personas.
*   **Be Configurable:** You can set how *often* they appear, block them from certain websites, set rate limits, and manage the history of their terrible advice.

## Installation (Chrome & Chromium)

1.  Download the release ZIP from GitHub.
2.  Extract the ZIP to a folder.
3.  Go to `chrome://extensions/`.
4.  Enable **Developer mode** (top right).
5.  Click **Load unpacked**.
6.  Select the extracted folder.
7.  (Optional) Pin the extension using the puzzle piece icon.

## Giving Your Daemon a Brain: Setup

Open the TOADs settings page (via `chrome://extensions/` > Details > Extension options). Go to the **Backend Settings** tab.

Choose one: **Ollama (Local)** or **Gemini API (Google)**.

### Option 1: Gemini (Remote)

*   Select **Gemini API**.
*   Get your Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey). **Keep it secret!**
*   Paste the key.
*   Enter the **Gemini Model** name. See models [here](https://ai.google.dev/gemini-api/docs/models).
*   Optionally set **Rate Limits** (RPM/RPD, 0 to disable).

### Option 2: Ollama (Local)

Requires you to have Ollama installed and running from [ollama.com](https://ollama.com/).

*   Select **Ollama (Local)**.
*   **Crucially:** You MUST set the `OLLAMA_ORIGINS` environment variable *before* starting your Ollama server to allow the extension to connect. Find your extension ID on `chrome://extensions/` (in Developer mode).
    *   **Linux/macOS:** `export OLLAMA_ORIGINS="chrome-extension://[YOUR_EXTENSION_ID]"`
    *   **Windows:** `set OLLAMA_ORIGINS=chrome-extension://[YOUR_EXTENSION_ID]`
        *   To make this setting permanent, you need to add or modify a system environment variable. Search for "environment variables" in the Windows search bar and select "Edit the system environment variables". Click the "Environment Variables..." button. In the "User variables" section (or "System variables" if you're feeling bold), click "New..." (or select `OLLAMA_ORIGINS` if it exists and click "Edit..."). Set the **Variable name** to `OLLAMA_ORIGINS` and the **Variable value** to `chrome-extension://[YOUR_EXTENSION_ID]`, replacing `[YOUR_EXTENSION_ID]` with the ID you copied. Click OK on all the windows.
    *   Restart your Ollama server! (Check console output for errors related to origins).
    *   *Temporary/Less Secure:* `chrome-extension://*` allows any extension (use with caution).
*   Enter the **Ollama Model** name (e.g., `gemma3:1b-it-qat`, `llama3`).
*   Confirm **Ollama URL** (default `http://localhost:11434`).
*   **Send Page Text Content (Experimental):** Check if you want to send page text (more relevant quips, but costs processing/has minimal privacy implications with local AI).

### Final Step

Go to any tab (General, Character Hub, etc.) and click **Save All Settings** at the bottom.

## Troubleshooting: Repetition

If your Daemon keeps repeating itself, clear its memory! Go to **Options > Data Management** and click **Clear History**. Reducing the **Maximum History Length** might also help with smaller models.

## Summoning *Your Own* Daemons: Custom Characters (Chrome Only)

Create a folder to hold your custom characters. Inside, create a subfolder for *each* character. Each subfolder needs:

*   `character.png`: The image.
*   `manifest.json`: A JSON file describing the character.

Example `manifest.json`:
```json
{
  "name": "Sarcastic Spoon",
  "persona": "A cynical, sentient spoon.",
  "outputConstraints": "Provide one short, sarcastic comment. No help. Weary disdain. Output only the comment.",
  "examples": "Ex: google.com: \"Searching again? Hope you're enjoying that existential dread.\"",
  "customPromptTemplate": "{PERSONA_INSTRUCTIONS}\nLooking at: {URL}\nHistory:\n{HISTORY_SECTION}\nContent snippet:\n{PAGE_TEXT_SECTION}\n{OUTPUT_CONSTRAINTS}\nExamples:\n{EXAMPLES}\n\nOUTPUT:"
}
```
*   `name`, `persona`, `outputConstraints`, `examples`: Required fields for AI instruction.
*   `customPromptTemplate` (Optional): Custom prompt structure (see Prompt Preview in options for placeholders).

Load your custom folder in **Options > Character Hub > Select Folder**. Use **Rescan** if you change files.

## FAQ

**Q: Why would you do this?**

A: A friend joked about this concept at work and I am eerily attracted to making convoluted weekend projects over jokes.

**Q: How much of the code did a LLM write?**

A: All of it. Also, most of this readme as well. This was an experiment in following the whole ViBeCoDinG trend: I'm a sucker for anything that lets me not touch anything in the web stack. I used Gemini 2.5 Pro while it was available for free (it's really impressive!) and then 2.5 Flash when it became (still pretty good but way flakier than pro. But hey, free!).

**Q: Does this work on Firefox?**

A: Kinda? Firefox is a bit more finicky and as far as I understood only lets you add extensions from disk temporarily. There's a `manifest-firefox.json` file you can overwrite your `manifest.json` file with, and it should work, but I've provided a XPI you can install directly.

**Q: Why is the option to send page content to the AI only available for Ollama by default?**

A: Sending the *entire text content* of a web page to a remote API service like Google's Gemini has different privacy implications compared to sending it to an AI running entirely on *your own* computer (Ollama). As a default, the remote calls are restricted to just the URL and character context (which still _can_ include some security concerns, but hopefully anything that goes as a parameter in the URL is ephemeral, otherwise, the site you're accessing has bigger security concerns).

If you fully understand the privacy implications of sending potentially sensitive page content (emails, documents, internal tools, etc.) to a third-party API, and still wish to do so with Gemini, you're welcome to tweak the `background.js` code yourself. It's not hidden, you just need to flip a small switch (or rather, adjust the logic around the `requiresPageText` flag for the 'gemini' case). But don't say O didn't warn you when your Gemini quips start referencing your bank balance!

## Contributing

I am historically a terrible open source maintainer, and this was more of a weekend joke than a real project, so I'm preemptively sorry for any pull requests I end up not reviewing or integrating.

## License

This project is licensed under the [MIT License](LICENSE). Go forth and be unhelpful.
