AI Job Greeting Assistant
==========================

Chrome extension (Manifest V3) that scrapes job descriptions on recruitment sites, combines them with your resume highlights, and uses AI to generate a greeting message, then copies it to the clipboard.


Features
--------
· Upload resume: Supports .txt and .pdf. Extracts and caches resume highlights; the next run reuses the cache. A single line shows "No file selected" or the current file name. You don’t have to re-identify every time.
· One-click generate: On job detail pages (e.g. Boss Zhipin, Lagou, LinkedIn), click “One-click generate greeting and copy” to: save options → scrape current page → clean JD → generate greeting → copy to clipboard. One progress line in the popup shows status; errors are shown in the popup if something fails.
· Tone: Choose from Sincere, Lively, or Data-driven style.
· AI backend: Supports OpenAI-compatible and Gemini-compatible APIs. Select the type in the popup; endpoints are preconfigured in the extension. You only need to enter your API Key.


Installation
------------
1. Open chrome://extensions/ in Chrome and turn on “Developer mode”.
2. Click “Load unpacked” and select the project root folder (the one containing manifest.json).
3. Click the extension icon, enter your API Key in the popup, and select AI interface (OpenAI-compatible / Gemini-compatible).


How to use
----------
1. Click the extension icon and enter your API Key; select AI interface (OpenAI-compatible / Gemini-compatible).
2. Click “Select file” to upload your resume (.txt or .pdf). The current file name is shown on the right. After upload, resume highlights are extracted and saved automatically.
3. Choose tone (Sincere / Lively / Data-driven).
4. Open a job detail page on a recruitment site, then click the extension icon and “One-click generate greeting and copy”.
5. Keep the popup open and wait for the progress line (reading page → generating greeting). When done, a toast shows “Greeting generated, start chatting!” and the text is copied; paste in the chat box. If something fails, the error is shown in the popup.


Project structure
-----------------
greeting/
  manifest.json        Extension config
  popup.html           Popup UI
  popup.js             Popup logic (upload, generate flow)
  style.css            Popup styles
  background.js        Background: AI calls (clean JD, extract resume, generate greeting)
  content.js           Injected script: scrape page, copy to clipboard, toast
  libs/
    pdf.min.js         PDF.js (PDF resume parsing)
    pdf.worker.min.js  PDF.js worker
  README.txt           This file (Chinese)
  README-en.txt        This file (English)


Data and privacy
----------------
· API Key, AI interface, and tone are stored locally in the browser (chrome.storage.local) and are only used when calling the selected AI service.
· Resume text, extracted highlights, and the last cleaned JD are cached locally to speed up the next run.
· Supported sites include Boss Zhipin (zhipin.com), Lagou (lagou.com), LinkedIn; other sites are scraped in full and the JD is cleaned by AI.


Disclaimer
----------
This extension is for personal/educational use. Keep your API Key private; do not commit it to a public repo. Use is subject to the terms of the AI service you choose.
