# TOtally unhelpful Assistant Daemons - TOADs

Remember that old paper clip that would pop up and give you helpful instructions on how to navigate the dread of crafting documents?
Well, in the age of AI, it's clearly time for something like this to make a comeback.
EVERYWHERE.
Also, not being useful at all.

Totally Unhelpful Assistant Daemons or TOADs for short, will lounge around any webpage and talk about it in the most unhelpful way possible. It's even hard to set up!

Requires either a Gemini API key or an Ollama installation.

## What do these Unhelpful Daemons do?

Mostly, they just... exist... and occasionally bother you. Specifically, they will:

*   **Lounge Around:** Pop up in the bottom corner of web pages.
*   **Spout Nonsense:** Generate short, semi-related but utterly unhelpful quips about the page you're looking at, powered by the magic (or lack thereof) of modern AI.
*   **Come in Different Flavors:** Choose from a selection of built-in 'Daemons', each with their own distinct (and equally unhelpful) personality.
*   **Let You Build Your Own:** Feeling brave? You can craft your own custom Daemons with unique looks and unhelpful personas.
*   **Be Occasionally Restrained:** You can set how *often* they appear, block them from certain annoying websites (like banking sites where a talking paperclip might cause a panic), and manage the history of their terrible advice.

## Getting the Daemon on Your Shoulder: Installation

Since this is a novelty extension and probably won't be gracing the official Chrome Web Store anytime soon (because... unhelpful, although I did think it was going to be easy and gave google 5 bucks!), you'll need to install it manually. It's only *mildly* complicated.

**For Chrome (and most Chromium-based browsers):**

1.  Download the source code from the GitHub repository. You can click the "Code" button and select "Download ZIP".
2.  Extract the ZIP file into a folder on your computer. Remember where you put it!
3.  Open Chrome and navigate to the extensions page. You can type `chrome://extensions/` in the address bar.
4.  In the top right corner of the extensions page, enable **Developer mode**. A few new buttons should appear near the top.
5.  Click the **Load unpacked** button.
6.  Navigate to the folder where you extracted the TOADs source code (the folder containing `manifest.json`, `background.js`, etc.). Select *that folder*.
7.  The TOADs extension should now appear in your list of installed extensions!
8.  (Optional but recommended) Click the puzzle piece icon next to your profile picture in the Chrome toolbar. Find "Totally Unhelpful Assistant Daemons" and click the pin icon to make the TOADs button visible in your toolbar.

Now the Daemons are lurking... but they need brains!

## Giving Your Daemon a Brain: Initial Setup

Alright, you've got the Daemon's husk installed, but it's just a silent image without an AI brain to spout nonsense. Let's remedy that with minimal effort (yours, not the Daemon's).

1.  Open the TOADs settings page. The least painful way is usually via the Chrome Extensions page (`chrome://extensions/`). Find "Totally Unhelpful Assistant Daemons", click **Details**, and then click **Extension options**.
2.  Navigate directly to the **Backend Settings** tab. The others are distractions... for now.
3.  You must choose one: **Ollama (Local)** or **Gemini API (Google)**. There is no third option (yet).

### Option 1: The Remote Brain (Gemini API)

This is easier, but does not include the page text in the context:

*   Select the **Gemini API (Google)** radio button.
*   You'll need a **Gemini API Key**. Acquire one from the mystical lands of [Google AI Studio](https://aistudio.google.com/apikey).
*   Paste your key into the field provided. **Treat this key with paranoid secrecy!**
*   Enter the **Gemini Model** name. Consult the list of available models [here](https://ai.google.dev/gemini-api/docs/models). The `flash` models are great and fast.
*   Consider setting **Rate Limits** (RPM/RPD) to avoid accidentally spamming the API (and yourself). `0` disables the check, which is bold.

### Option 2: The Local Brain (Ollama)

If you're the type who likes your AI nonsense *locally sourced* (and already have Ollama running from [ollama.com](https://ollama.com/), you'll need it!), this is your path to keeping things on your machine (and sending a chunk of the page as context).

*   Select the **Ollama (Local)** radio button.
*   **PAY CLOSE ATTENTION HERE:** Ollama, by default, is very shy and won't talk to browser extensions because they live in a weird, unique address like `chrome-extension://[some-long-id]`. You *must* tell your Ollama server it's okay to communicate with this specific ID by setting the `OLLAMA_ORIGINS` environment variable *before* you start your Ollama server.

    **How to set `OLLAMA_ORIGINS` (persistently, if you're lucky):**
    *   First, find your extension ID. Go back to your Chrome Extensions page (`chrome://extensions/`). Make sure "Developer mode" is still enabled (top right). Find "Totally Unhelpful Assistant Daemons" and note the **ID** listed below the extension name. It's a long string of letters. Copy that ID.
    *   **For Windows:** To make this setting permanent, you need to add or modify a system environment variable. Search for "environment variables" in the Windows search bar and select "Edit the system environment variables". Click the "Environment Variables..." button. In the "User variables" section (or "System variables" if you're feeling bold), click "New..." (or select `OLLAMA_ORIGINS` if it exists and click "Edit..."). Set the **Variable name** to `OLLAMA_ORIGINS` and the **Variable value** to `chrome-extension://[YOUR_EXTENSION_ID]`, replacing `[YOUR_EXTENSION_ID]` with the ID you copied. Click OK on all the windows.
    *   **For macOS / Linux:** Setting permanent environment variables varies depending on your shell (Bash, Zsh, etc.) and setup. You'll likely need to edit a file like `.bashrc`, `.zshrc`, or `.profile` in your home directory and add a line like `export OLLAMA_ORIGINS="chrome-extension://[YOUR_EXTENSION_ID]"`. You'll have to figure out the specifics for your own system setup – search online for "how to set permanent environment variable [your shell name]".
    *   **A slightly quicker, but less secure, alternative for *temporary* testing:** If you're feeling particularly unconcerned (or lazy), you can use the wildcard `chrome-extension://*` which allows *any* extension to talk to Ollama for your current terminal session. Run `export OLLAMA_ORIGINS="chrome-extension://*"` (or the Windows equivalent `set OLLAMA_ORIGINS=chrome-extension://*`) in your terminal *before* running `ollama serve`. Only do this if you understand the implications.
    *   **Important:** **You *must* restart your Ollama server after setting this variable for it to take effect!** If your Daemon just says "Can't reach Ollama", this `OLLAMA_ORIGINS` setting is the prime suspect.

    **A slightly quicker, but less secure, alternative:**
    *   If you're feeling particularly unconcerned (or lazy), you can use the wildcard `chrome-extension://*` which allows *any* extension to talk to Ollama.
    *   Run the command as above, but use `chrome-extension://*` instead of the specific ID (e.g., `export OLLAMA_ORIGINS="chrome-extension://*"`). Only do this if you understand the implications.

*   Back in the extension options, enter the **Ollama Model** name you want. `gemma3:1b-it-qat` is adequately unhelpful even on moderate hardware (like a GTX 1080), but the daemons start shining more on 4b and above!
*   Confirm the **Ollama URL** (default `http://localhost:11434` is usually fine).
*   There's an experimental **Send Page Text Content** checkbox. It might make quips more relevant, but costs processing power and has, shall we say, *minimal* privacy implications depending on the page. Your call.

### Finishing Touches (Almost Done!)

*   Take a moment to gaze upon the **Generated Prompt Preview** to admire the carefully constructed nonsense you're about to send to the AI.
*   Briefly glance at the other tabs (**General**, **Character Hub**, **Data Management**) to see what other levers of chaos you can pull (like changing how often the Daemon appears, picking a different one, or blocking websites).
*   Finally, locate the prominent **Save All Settings** button at the bottom and click it with purpose.

Your Daemons are now armed with AI and ready to dispense their unique brand of unhelpfulness upon the unsuspecting web. Congratulations?

## Summoning *Your Own* Daemons: Creating Custom Characters (Chrome Only Feature!)

Want a Daemon that truly speaks to your specific brand of unhelpful? You can add your own! This feature currently relies on Chrome's File System Access API for selecting a folder, so it might not work in other browsers like Firefox.

Here's how the sausage is made:

1.  Create a folder on your computer where you will store all your custom characters.
2.  Inside that main custom folder, create a **new folder for *each* custom character**. The name of this subfolder doesn't strictly matter for the Daemon's ID, but keep it clean (e.g., `my-sarcastic-bot`, `dungeon-master-quips`).
3.  Inside each character's subfolder, you need two files:
    *   `character.png`: A PNG image file for your character's sprite. Square or roughly square aspect ratios usually work best. The extension will scale it.
    *   `manifest.json`: A JSON file describing your character's personality and rules.

4.  The `manifest.json` file should look like this (using an example):

    ```json
    {
      "name": "The Sarcastic Spoon",
      "persona": "You are a sentient, slightly-rusting spoon with an incredibly dry, cynical wit. You are unimpressed by everything and everyone, especially the user and the content they are viewing. You tend to make passive-aggressive or utterly dismissive remarks.",
      "outputConstraints": "Provide one short, sarcastic or dismissive comment about the page or task. Do not be helpful in any way. Always maintain a tone of weary disdain. Output only the comment itself.",
      "examples": "Example for google.com: \"Searching again? Hope you're enjoying that existential dread.\" Example for youtube.com: \"Ah, more flickering lights. Fascinating.\" Example for github.com: \"Committing... bold move. For a human.\"",
      "customPromptTemplate": "{PERSONA_INSTRUCTIONS}\n\nYou are looking at: {URL}\n\nPrevious unhelpful thoughts on this page:\n{HISTORY_SECTION}\n\nHere is a tiny fragment of the page content:\n{PAGE_TEXT_SECTION}\n\n{OUTPUT_CONSTRAINTS}\n\nHere's the kind of nonsense you usually spout:\n{EXAMPLES}\n\nOUTPUT:"
    }
    ```
    *   `name`: The display name for your character.
    *   `persona`: A detailed description of the character's personality for the AI.
    *   `outputConstraints`: Strict rules for the AI's output (format, length, tone, etc.). This is crucial!
    *   `examples`: One or more example interactions, showing the AI the desired input/output format and tone. Newlines (`\n`) are fine within the string.
    *   `customPromptTemplate` (Optional): If your character needs a very specific prompt structure beyond the standard one, you can define it here. See `characters.js` or the Prompt Preview in options for placeholder details (`{URL}`, `{HISTORY_SECTION}`, `{PAGE_TEXT_SECTION}`, etc.). If omitted, the extension uses a default template.

5.  Once you have your custom character folder set up with subfolders, each containing `manifest.json` and `character.png`, go back to the TOADs **Options page** (`chrome://extensions/`, Details, Extension options).
6.  Go to the **Character Hub** tab.
7.  In the "Custom Characters Folder" section, click **Select Folder**.
8.  Choose the main folder you created in step 1.
9.  The extension will scan the folder. If it finds valid character subfolders, they will be added to your list of available characters in the carousel!
10. Use the **Rescan** button if you add, remove, or modify characters in that folder later.

## Frequently Asked Questions (that nobody asked)

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