(function sunoReceiptsChatGptPanel() {
  const ROOT_ID = "suno-receipts-chatgpt-root";
  const STORAGE_KEY = "sr_chatgpt_fields";
  const DEFAULT_FIELDS = {
    title: "",
    style: "",
    lyrics: "",
    excludedStyles: "",
    weirdness: 35,
    styleInfluence: 55,
    updatedAt: null
  };

  let shadow = null;
  let state = { ...DEFAULT_FIELDS };
  let scanTimer = null;
  let contextInvalidated = false;

  initialize();

  async function initialize() {
    state = { ...DEFAULT_FIELDS, ...(await loadState()) };
    mountPanel();
    render();
    scanConversation();
    observeConversation();
  }

  function mountPanel() {
    if (document.getElementById(ROOT_ID)) return;
    const root = document.createElement("div");
    root.id = ROOT_ID;
    document.documentElement.appendChild(root);
    shadow = root.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <style>
        :host { color-scheme: dark; }
        .sr-panel {
          position: fixed;
          z-index: 2147483600;
          right: 18px;
          top: 86px;
          width: 360px;
          max-width: calc(100vw - 28px);
          max-height: calc(100vh - 108px);
          overflow: hidden;
          border: 1px solid rgba(255,255,255,.14);
          border-radius: 22px;
          background:
            radial-gradient(circle at 15% 0%, rgba(248,91,183,.18), transparent 34%),
            radial-gradient(circle at 90% 12%, rgba(54,216,255,.14), transparent 34%),
            rgba(13, 14, 20, .88);
          color: #fbf9ff;
          box-shadow: 0 26px 90px rgba(0,0,0,.44), inset 0 1px 0 rgba(255,255,255,.12);
          backdrop-filter: blur(24px) saturate(150%);
          font: 13px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }
        .sr-panel[data-collapsed="true"] .sr-body { display: none; }
        .sr-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 14px 14px 12px;
          border-bottom: 1px solid rgba(255,255,255,.09);
        }
        .sr-kicker {
          margin: 0 0 2px;
          color: rgba(255,255,255,.56);
          font-size: 10px;
          font-weight: 800;
          letter-spacing: .12em;
          text-transform: uppercase;
        }
        .sr-title {
          margin: 0;
          font-size: 16px;
          line-height: 1.12;
          letter-spacing: 0;
        }
        .sr-head-actions { display: flex; gap: 6px; }
        .sr-icon {
          width: 30px;
          height: 30px;
          display: inline-grid;
          place-items: center;
          border-radius: 11px;
          border: 1px solid rgba(255,255,255,.12);
          color: #fff;
          background: rgba(255,255,255,.07);
          cursor: pointer;
        }
        .sr-body {
          display: grid;
          gap: 12px;
          max-height: calc(100vh - 174px);
          overflow: auto;
          padding: 12px;
        }
        .sr-field {
          display: grid;
          gap: 7px;
          padding: 10px;
          border: 1px solid rgba(255,255,255,.1);
          border-radius: 16px;
          background: rgba(255,255,255,.055);
        }
        .sr-label-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
        }
        .sr-label {
          font-size: 11px;
          color: rgba(255,255,255,.62);
          text-transform: uppercase;
          letter-spacing: .08em;
          font-weight: 850;
        }
        .sr-insert {
          border: 0;
          border-radius: 999px;
          padding: 6px 9px;
          color: #fff;
          background: linear-gradient(135deg, #f85bb7, #7b61ff 62%, #36d8ff);
          font: inherit;
          font-size: 11px;
          font-weight: 850;
          cursor: pointer;
        }
        textarea, input[type="text"] {
          width: 100%;
          min-width: 0;
          border: 1px solid rgba(255,255,255,.1);
          border-radius: 12px;
          color: #fff;
          background: rgba(0,0,0,.18);
          padding: 9px 10px;
          font: inherit;
          resize: vertical;
          outline: none;
        }
        textarea:focus, input:focus, button:focus {
          outline: 2px solid #52ddff;
          outline-offset: 2px;
        }
        textarea[data-field="lyrics"] { min-height: 132px; }
        textarea[data-field="style"] { min-height: 72px; }
        .sr-slider {
          display: grid;
          grid-template-columns: 1fr 42px;
          gap: 10px;
          align-items: center;
        }
        input[type="range"] {
          width: 100%;
          accent-color: #9a7cff;
        }
        .sr-value {
          color: #fff;
          text-align: right;
          font-weight: 850;
        }
        .sr-actions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }
        .sr-button {
          border: 1px solid rgba(255,255,255,.12);
          border-radius: 13px;
          color: #fff;
          background: rgba(255,255,255,.07);
          padding: 9px 10px;
          font: inherit;
          font-weight: 800;
          cursor: pointer;
        }
        .sr-status {
          min-height: 18px;
          color: rgba(255,255,255,.58);
          font-size: 12px;
        }
        @media (prefers-reduced-motion: reduce) {
          * { transition: none !important; animation: none !important; }
        }
      </style>
      <aside class="sr-panel" aria-label="Suno field bridge">
        <header class="sr-head">
          <div>
            <p class="sr-kicker">Suno Bridge</p>
            <h2 class="sr-title">ChatGPT to Suno</h2>
          </div>
          <div class="sr-head-actions">
            <button class="sr-icon" type="button" data-action="guide" aria-label="Insert briefing instructions">✦</button>
            <button class="sr-icon" type="button" data-action="collapse" aria-label="Collapse panel">−</button>
          </div>
        </header>
        <section class="sr-body">
          ${textFieldTemplate("title", "Title", "Song title")}
          ${textFieldTemplate("style", "Style", "Music style, genre, production notes", true)}
          ${textFieldTemplate("lyrics", "Lyrics", "Current lyric draft", true)}
          ${textFieldTemplate("excludedStyles", "Excluded Styles", "Things Suno should avoid", true)}
          ${sliderTemplate("weirdness", "Weirdness")}
          ${sliderTemplate("styleInfluence", "Style Slider")}
          <div class="sr-actions">
            <button class="sr-button" type="button" data-action="rescan">Rescan Chat</button>
            <button class="sr-button" type="button" data-action="insert-all">Insert All</button>
          </div>
          <div class="sr-status" role="status" aria-live="polite"></div>
        </section>
      </aside>
    `;
    shadow.addEventListener("click", handleClick);
    shadow.addEventListener("input", handleInput);
  }

  function textFieldTemplate(field, label, placeholder, multiline = false) {
    const control = multiline
      ? `<textarea data-field="${field}" placeholder="${placeholder}"></textarea>`
      : `<input type="text" data-field="${field}" placeholder="${placeholder}">`;
    return `
      <label class="sr-field">
        <span class="sr-label-row">
          <span class="sr-label">${label}</span>
          <button class="sr-insert" type="button" data-action="insert" data-field="${field}">Insert</button>
        </span>
        ${control}
      </label>
    `;
  }

  function sliderTemplate(field, label) {
    return `
      <label class="sr-field">
        <span class="sr-label-row">
          <span class="sr-label">${label}</span>
          <button class="sr-insert" type="button" data-action="insert" data-field="${field}">Insert</button>
        </span>
        <span class="sr-slider">
          <input type="range" min="0" max="100" step="1" data-field="${field}">
          <span class="sr-value" data-value-for="${field}">0</span>
        </span>
      </label>
    `;
  }

  function render() {
    for (const [field, value] of Object.entries(state)) {
      const control = shadow.querySelector(`[data-field="${field}"]`);
      if (!control) continue;
      control.value = value ?? "";
      const valueLabel = shadow.querySelector(`[data-value-for="${field}"]`);
      if (valueLabel) valueLabel.textContent = String(value ?? 0);
    }
    setStatus(state.updatedAt ? `Updated ${new Date(state.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Waiting for ChatGPT output");
  }

  async function handleClick(event) {
    const action = event.target?.dataset?.action;
    if (!action) return;
    if (action === "collapse") {
      const panel = shadow.querySelector(".sr-panel");
      const collapsed = panel.dataset.collapsed === "true";
      panel.dataset.collapsed = collapsed ? "false" : "true";
      event.target.textContent = collapsed ? "−" : "+";
    }
    if (action === "rescan") {
      scanConversation();
      render();
    }
    if (action === "guide") {
      insertGuidePrompt();
    }
    if (action === "insert") {
      await insertField(event.target.dataset.field);
    }
    if (action === "insert-all") {
      for (const field of ["title", "style", "lyrics", "excludedStyles", "weirdness", "styleInfluence"]) {
        if (state[field] !== "" && state[field] != null) await insertField(field);
      }
    }
  }

  function handleInput(event) {
    const field = event.target?.dataset?.field;
    if (!field) return;
    state[field] = event.target.type === "range" ? Number(event.target.value) : event.target.value;
    state.updatedAt = new Date().toISOString();
    persistState();
    render();
  }

  async function insertField(field) {
    const response = await sendMessage({
      type: "suno:insertField",
      field,
      value: state[field],
      meta: { source: "chatgpt.com", updatedAt: state.updatedAt }
    });
    setStatus(response.ok ? `Inserted ${labelFor(field)} into Suno.` : response.error || `Could not insert ${labelFor(field)}.`);
  }

  function observeConversation() {
    const observer = new MutationObserver(() => {
      clearTimeout(scanTimer);
      scanTimer = setTimeout(() => {
        if (scanConversation()) render();
      }, 900);
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  function scanConversation() {
    const text = latestAssistantText();
    if (!text) return false;
    const next = deriveFields(text, state);
    const changed = JSON.stringify(stripTimestamp(next)) !== JSON.stringify(stripTimestamp(state));
    if (!changed) return false;
    const changedFields = Object.keys(next).filter(key => state[key] !== next[key]);
    state = { ...state, ...next, updatedAt: new Date().toISOString() };
    persistState();
    sendMessage({
      type: "events:record",
      event: {
        kind: "assistant.fieldUpdated",
        label: "ChatGPT brief updated",
        detail: `Updated ${changedFields.join(", ") || "fields"} from the ChatGPT conversation.`,
        source: "chatgpt-panel",
        fingerprint: {
          title: state.title,
          style: state.style,
          lyrics: state.lyrics
        },
        payloadSummary: stripTimestamp(state)
      }
    });
    return true;
  }

  function latestAssistantText() {
    const candidates = Array.from(document.querySelectorAll("[data-message-author-role='assistant'], article, [data-testid*='conversation-turn']"))
      .map(element => element.innerText || element.textContent || "")
      .map(text => text.replace(/\n{3,}/g, "\n\n").trim())
      .filter(text => text.length > 40 && !/ChatGPT can make mistakes/i.test(text));
    return candidates[candidates.length - 1] || "";
  }

  function deriveFields(text, previous) {
    const parsed = {
      title: extractLabel(text, ["title", "song title"]) || previous.title,
      style: extractLabel(text, ["style", "music style", "suno style", "genre"]) || previous.style,
      lyrics: extractBlock(text, ["lyrics", "lyric draft", "song lyrics"]) || previous.lyrics,
      excludedStyles: extractLabel(text, ["excluded styles", "exclude", "avoid", "negative style"]) || previous.excludedStyles
    };
    const combined = `${parsed.title}\n${parsed.style}\n${parsed.lyrics}\n${parsed.excludedStyles}`;
    parsed.weirdness = extractNumber(text, ["weirdness"], calculateWeirdness(combined));
    parsed.styleInfluence = extractNumber(text, ["style slider", "style influence", "style strength"], calculateStyleInfluence(parsed.style, parsed.lyrics));
    return parsed;
  }

  function extractLabel(text, labels) {
    for (const label of labels) {
      const pattern = new RegExp(`(?:^|\\n)\\s*(?:[-*#>\\s]*)${escapeRegExp(label)}\\s*[:\\-]\\s*(.+)`, "i");
      const match = text.match(pattern);
      if (match?.[1]) return cleanValue(match[1]).slice(0, label.includes("style") ? 900 : 180);
    }
    return "";
  }

  function extractBlock(text, labels) {
    for (const label of labels) {
      const pattern = new RegExp(`(?:^|\\n)\\s*(?:[-*#>\\s]*)${escapeRegExp(label)}\\s*[:\\-]\\s*([\\s\\S]+?)(?=\\n\\s*(?:title|song title|style|music style|suno style|genre|excluded styles|exclude|avoid|negative style|weirdness|style slider|style influence|style strength)\\s*[:\\-]|$)`, "i");
      const match = text.match(pattern);
      if (match?.[1]) return cleanValue(match[1]).slice(0, 5000);
    }
    return "";
  }

  function extractNumber(text, labels, fallback) {
    for (const label of labels) {
      const pattern = new RegExp(`${escapeRegExp(label)}\\s*[:\\-]?\\s*(\\d{1,3})`, "i");
      const match = text.match(pattern);
      if (match?.[1]) return clamp(Number(match[1]), 0, 100);
    }
    return fallback;
  }

  function calculateWeirdness(text) {
    const lower = text.toLowerCase();
    let score = 32;
    score += countMatches(lower, ["experimental", "surreal", "glitch", "avant", "strange", "psychedelic", "unusual"]) * 8;
    score -= countMatches(lower, ["classic", "simple", "clean", "mainstream", "traditional", "radio"]) * 5;
    return clamp(score, 5, 95);
  }

  function calculateStyleInfluence(style, lyrics) {
    let score = 48;
    if (style.length > 80) score += 12;
    if (style.split(",").length >= 3) score += 10;
    if (/specific|exact|must|strong|reference|in the style/i.test(style)) score += 12;
    if (lyrics.length > 900) score -= 6;
    return clamp(score, 10, 95);
  }

  function insertGuidePrompt() {
    const composer = document.querySelector("#prompt-textarea, [contenteditable='true'][data-testid], textarea");
    if (!composer) {
      setStatus("Could not find the ChatGPT composer.");
      return;
    }
    const prompt = `For this Suno songwriting session, keep an up-to-date structured brief in every major answer using these labels exactly:\nTitle:\nStyle:\nLyrics:\nExcluded Styles:\nWeirdness: 0-100\nStyle Slider: 0-100\n\nAs we brainstorm, update these fields based on the latest direction.`;
    composer.focus();
    if (composer.matches("[contenteditable='true']")) composer.textContent = prompt;
    else composer.value = prompt;
    composer.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: prompt }));
    setStatus("Briefing prompt inserted into ChatGPT composer.");
  }

  function cleanValue(value) {
    return String(value || "")
      .replace(/^["'`]+|["'`]+$/g, "")
      .replace(/\n\s*[-*]\s*/g, "\n")
      .trim();
  }

  async function loadState() {
    try {
      const data = await chrome.storage.local.get(STORAGE_KEY);
      return data[STORAGE_KEY] || {};
    } catch {
      return {};
    }
  }

  function persistState() {
    chrome.storage.local.set({ [STORAGE_KEY]: state }).catch(() => {});
  }

  function sendMessage(message) {
    if (contextInvalidated) return Promise.resolve({ ok: false, contextInvalidated: true });
    try {
      return chrome.runtime.sendMessage(message).catch(error => {
        if (/extension context invalidated|context invalidated|extension context/i.test(error?.message || "")) {
          contextInvalidated = true;
          document.getElementById(ROOT_ID)?.remove();
          return { ok: false, contextInvalidated: true };
        }
        return { ok: false, error: error.message || "Extension message failed" };
      });
    } catch (error) {
      contextInvalidated = true;
      document.getElementById(ROOT_ID)?.remove();
      return Promise.resolve({ ok: false, error: error.message || "Extension message failed" });
    }
  }

  function setStatus(value) {
    const status = shadow?.querySelector(".sr-status");
    if (status) status.textContent = value || "";
  }

  function stripTimestamp(value) {
    const { updatedAt, ...rest } = value;
    return rest;
  }

  function labelFor(field) {
    return {
      title: "Title",
      style: "Style",
      lyrics: "Lyrics",
      excludedStyles: "Excluded styles",
      weirdness: "Weirdness",
      styleInfluence: "Style slider"
    }[field] || field;
  }

  function countMatches(text, terms) {
    return terms.reduce((total, term) => total + (text.includes(term) ? 1 : 0), 0);
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, Math.round(Number(value) || 0)));
  }

  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
})();
