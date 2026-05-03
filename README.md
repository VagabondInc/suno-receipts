# Suno Receipts

Suno Receipts is a Manifest V3 Chrome extension that records a local authorship trail while a producer works in Suno.

## Product Behavior

- Watches Suno create/workspace pages for generation and edit intent.
- Prompts the user to create a new project receipt when a generation starts without an active project.
- Keeps the in-page extension collapsed during recording and shows a draggable live event log.
- Captures passive Suno network observations, UI edit intent, lyric/style/title/model changes, and common song operations such as extend, remaster, cover, persona, voice, instruments, vocals, speed, and section edits.
- Stores project receipts locally in Chrome extension storage.
- Exports CSV files into a `SunoReceipts/` folder under Chrome's configured download directory.
- Opens a styled receipt timeline that can be saved as PDF through Chrome's print dialog.
- Adds a real `chatgpt.com` companion panel that extracts Suno-ready Title, Style, Lyrics, Excluded Styles, Weirdness, and Style Slider values from the active ChatGPT conversation.
- Inserts accepted ChatGPT-side fields into the live Suno tab through extension messaging and records those insertions in the receipt log.

## Chrome Filesystem Constraint

Chrome extensions cannot silently write to `~/Music/SunoReceipts/` or any other arbitrary local path without a native messaging helper. The extension stores receipts locally and uses Chrome Downloads for CSV export. The settings page keeps `~/Music/SunoReceipts/` as the preferred product target for a future native helper.

## Load Locally

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Click **Load unpacked**.
4. Select this folder: `/Users/justintylermoore/Documents/New project 8`.
5. Open `https://suno.com/create` and start a generation.

## Surfaces

- Popup: project library, resume active receipt, export CSV, open PDF timeline.
- Options: verbosity, prompt behavior, preferred save-location display.
- Content UI: in-page modal and draggable live log.
- ChatGPT UI: floating Suno Bridge panel on `chatgpt.com` with auto-updated fields and per-field insert buttons.

## ChatGPT Bridge

The ChatGPT bridge uses the real `chatgpt.com` page as a top-level site. It does not iframe ChatGPT and does not replace it with an API clone.

Because ChatGPT and Suno remain real top-level Chrome pages, their passkey flows stay browser-native. Do not move those authenticated pages into an Electron WebView unless Electron WebAuthn/passkey support is proven for the target platform and login flow.

The panel scans the current conversation for structured labels:

- `Title:`
- `Style:`
- `Lyrics:`
- `Excluded Styles:`
- `Weirdness: 0-100`
- `Style Slider: 0-100`

The `Guide ChatGPT` button inserts a prompt asking ChatGPT to keep those labels updated in future brainstorming turns. When ChatGPT provides slider values, the panel uses them. If a value is missing, the panel keeps a conservative local fallback so the UI remains usable.

## Network Capture Strategy

The extension does not monkey-patch `window.fetch` or `XMLHttpRequest`. It uses UI intent, form state, DOM changes, and passive `PerformanceObserver` resource entries. This avoids becoming part of Suno's request call stack or third-party analytics/captcha failures.
