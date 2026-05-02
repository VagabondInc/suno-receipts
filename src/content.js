(function sunoReceiptsContent() {
  const ROOT_ID = "suno-receipts-root";
  const CREATE_KEYWORDS = ["generate", "create", "submit", "make song"];
  const EDIT_KEYWORDS = [
    "extend",
    "remaster",
    "cover",
    "persona",
    "voice",
    "instrument",
    "vocal",
    "speed",
    "section",
    "regenerate",
    "edit",
    "crop",
    "replace"
  ];

  let activeProject = null;
  let settings = null;
  let shadow = null;
  let toastList = null;
  let modalHost = null;
  let pendingPromptEvent = null;
  let inputDebounce = null;
  let lastInputFingerprint = {};
  let lastDomCompletionAt = 0;
  let contextInvalidated = false;
  const observedResources = new Set();

  initialize();

  async function initialize() {
    const response = await sendMessage({ type: "state:active" });
    settings = response.settings;
    activeProject = response.project;
    mountUi();
    updateRecordingState();
    document.addEventListener("click", handleClick, true);
    document.addEventListener("input", handleInput, true);
    document.addEventListener("change", handleInput, true);
    observeDom();
    observeNetworkResources();
  }

  function mountUi() {
    if (document.getElementById(ROOT_ID)) return;
    const root = document.createElement("div");
    root.id = ROOT_ID;
    document.documentElement.appendChild(root);
    shadow = root.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <style>
        :host { color-scheme: dark; }
        .sr-toast {
          position: fixed;
          z-index: 2147483647;
          width: 344px;
          max-width: calc(100vw - 24px);
          right: 24px;
          bottom: 28px;
          border: 1px solid rgba(255,255,255,.16);
          border-radius: 22px;
          background:
            radial-gradient(circle at 18% 0%, rgba(255, 91, 178, .28), transparent 34%),
            radial-gradient(circle at 82% 14%, rgba(83, 222, 255, .22), transparent 32%),
            rgba(10, 11, 16, .78);
          box-shadow: 0 24px 90px rgba(0,0,0,.42), inset 0 1px 0 rgba(255,255,255,.16);
          backdrop-filter: blur(24px) saturate(150%);
          font: 13px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          color: #f7f4ff;
          overflow: hidden;
          user-select: none;
        }
        .sr-toast[data-hidden="true"] { display: none; }
        .sr-top {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 13px 14px 10px;
          cursor: grab;
        }
        .sr-top:active { cursor: grabbing; }
        .sr-orb {
          width: 28px;
          height: 28px;
          border-radius: 11px;
          background: linear-gradient(135deg, #f85bb7, #7b61ff 55%, #36d8ff);
          box-shadow: 0 0 28px rgba(248,91,183,.42);
          flex: 0 0 auto;
        }
        .sr-heading { min-width: 0; flex: 1; }
        .sr-title {
          font-weight: 700;
          letter-spacing: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          font-size: 13px;
        }
        .sr-subtitle {
          color: rgba(247,244,255,.68);
          font-size: 11px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .sr-pill {
          border: 1px solid rgba(255,255,255,.14);
          background: rgba(255,255,255,.08);
          color: #e9e4ff;
          border-radius: 999px;
          padding: 4px 8px;
          font-size: 11px;
        }
        .sr-events {
          max-height: 190px;
          overflow: auto;
          padding: 0 12px 10px;
        }
        .sr-event {
          display: grid;
          grid-template-columns: 54px 1fr;
          gap: 9px;
          padding: 8px 0;
          border-top: 1px solid rgba(255,255,255,.08);
        }
        .sr-time { color: rgba(247,244,255,.52); font-size: 11px; }
        .sr-copy { min-width: 0; }
        .sr-label { font-weight: 650; color: #fff; overflow-wrap: anywhere; }
        .sr-detail { color: rgba(247,244,255,.68); font-size: 12px; overflow-wrap: anywhere; }
        .sr-actions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          padding: 10px 12px 12px;
          background: rgba(0,0,0,.16);
        }
        .sr-button {
          appearance: none;
          border: 1px solid rgba(255,255,255,.14);
          border-radius: 13px;
          color: #fff;
          background: rgba(255,255,255,.08);
          padding: 9px 10px;
          font-weight: 650;
          font-size: 12px;
          cursor: pointer;
        }
        .sr-button:hover { background: rgba(255,255,255,.14); }
        .sr-button:focus { outline: 2px solid #71dcff; outline-offset: 2px; }
        .sr-button.primary {
          border-color: rgba(255,255,255,.2);
          background: linear-gradient(135deg, #f85bb7, #7b61ff 58%, #36d8ff);
          box-shadow: 0 12px 32px rgba(123,97,255,.28);
        }
        .sr-modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 2147483646;
          display: none;
          align-items: center;
          justify-content: center;
          padding: 20px;
          background: rgba(4, 5, 9, .46);
          backdrop-filter: blur(10px);
          font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          color: #fbf9ff;
        }
        .sr-modal-backdrop[data-open="true"] { display: flex; }
        .sr-modal {
          width: min(440px, 100%);
          border-radius: 26px;
          padding: 22px;
          border: 1px solid rgba(255,255,255,.16);
          background: linear-gradient(180deg, rgba(25,24,36,.94), rgba(11,12,18,.94));
          box-shadow: 0 30px 120px rgba(0,0,0,.54);
        }
        .sr-modal h2 { margin: 0 0 8px; font-size: 22px; line-height: 1.12; letter-spacing: 0; }
        .sr-modal p { margin: 0 0 16px; color: rgba(251,249,255,.72); }
        .sr-modal-actions { display: flex; gap: 10px; justify-content: flex-end; }
        @media (prefers-reduced-motion: reduce) {
          * { transition: none !important; animation: none !important; }
        }
      </style>
      <section class="sr-toast" data-hidden="true" role="status" aria-live="polite">
        <div class="sr-top" data-drag-handle>
          <div class="sr-orb" aria-hidden="true"></div>
          <div class="sr-heading">
            <div class="sr-title">Suno Receipts</div>
            <div class="sr-subtitle">Waiting for a generation</div>
          </div>
          <div class="sr-pill">Idle</div>
        </div>
        <div class="sr-events"></div>
        <div class="sr-actions">
          <button class="sr-button primary" data-action="save" type="button">Save CSV</button>
          <button class="sr-button" data-action="close" type="button">Close Project</button>
        </div>
      </section>
      <section class="sr-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="sr-modal-title">
        <div class="sr-modal">
          <h2 id="sr-modal-title">Create a project receipt?</h2>
          <p class="sr-modal-copy">Suno Receipts saw a new generation request. Start a local project log so each creative edit is timestamped.</p>
          <div class="sr-modal-actions">
            <button class="sr-button" data-action="dismiss" type="button">Not now</button>
            <button class="sr-button primary" data-action="create" type="button">Create Project</button>
          </div>
        </div>
      </section>
    `;

    toastList = shadow.querySelector(".sr-events");
    modalHost = shadow.querySelector(".sr-modal-backdrop");
    shadow.addEventListener("click", handleUiClick);
    enableDrag(shadow.querySelector(".sr-toast"), shadow.querySelector("[data-drag-handle]"));
    applyToastPosition();
  }

  function applyToastPosition() {
    const toast = shadow?.querySelector(".sr-toast");
    if (!toast || !settings?.toastPosition) return;
    toast.style.left = `${settings.toastPosition.left}px`;
    toast.style.top = `${settings.toastPosition.top}px`;
    toast.style.right = "auto";
    toast.style.bottom = "auto";
  }

  function enableDrag(panel, handle) {
    let drag = null;
    handle.addEventListener("pointerdown", event => {
      drag = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        left: panel.getBoundingClientRect().left,
        top: panel.getBoundingClientRect().top
      };
      handle.setPointerCapture(event.pointerId);
    });
    handle.addEventListener("pointermove", event => {
      if (!drag || drag.pointerId !== event.pointerId) return;
      const left = Math.min(Math.max(12, drag.left + event.clientX - drag.startX), window.innerWidth - panel.offsetWidth - 12);
      const top = Math.min(Math.max(12, drag.top + event.clientY - drag.startY), window.innerHeight - panel.offsetHeight - 12);
      panel.style.left = `${left}px`;
      panel.style.top = `${top}px`;
      panel.style.right = "auto";
      panel.style.bottom = "auto";
    });
    handle.addEventListener("pointerup", async event => {
      if (!drag || drag.pointerId !== event.pointerId) return;
      drag = null;
      await sendMessage({
        type: "settings:update",
        patch: {
          toastPosition: {
            left: Math.round(panel.getBoundingClientRect().left),
            top: Math.round(panel.getBoundingClientRect().top)
          }
        }
      });
    });
  }

  async function handleUiClick(event) {
    const action = event.target?.dataset?.action;
    if (!action) return;
    if (action === "create" && pendingPromptEvent) {
      const response = await sendMessage({
        type: "projects:create",
        payload: {
          fingerprint: pendingPromptEvent.fingerprint,
          initialEvents: [pendingPromptEvent]
        }
      });
      activeProject = response.project;
      pendingPromptEvent = null;
      hideModal();
      updateRecordingState();
      appendToastEvent({
        label: "Project receipt started",
        detail: activeProject.title,
        timestamp: activeProject.createdAt
      });
    }
    if (action === "dismiss") {
      pendingPromptEvent = null;
      hideModal();
    }
    if (action === "save") {
      const response = await sendMessage({ type: "projects:saveActive" });
      appendToastEvent({
        label: response.ok ? "CSV saved" : "Save needs attention",
        detail: response.ok ? response.filename : response.error,
        timestamp: new Date().toISOString()
      });
    }
    if (action === "close") {
      const response = await sendMessage({ type: "projects:closeActive" });
      activeProject = null;
      updateRecordingState();
      appendToastEvent({
        label: response.project ? "Project closed" : "No active project",
        detail: response.project?.title || "",
        timestamp: new Date().toISOString()
      });
    }
  }

  function handleClick(event) {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const label = getElementLabel(target);
    if (!label) return;
    const lower = label.toLowerCase();
    const fingerprint = collectFingerprint();

    if (CREATE_KEYWORDS.some(keyword => lower.includes(keyword)) && isCreateContext()) {
      recordDetectedEvent({
        kind: "generation.requested",
        label: "Generation requested",
        detail: `User activated "${label}".`,
        source: "ui-click",
        fingerprint
      }, { promptIfMissing: true });
      return;
    }

    const editKeyword = EDIT_KEYWORDS.find(keyword => lower.includes(keyword));
    if (editKeyword) {
      recordDetectedEvent({
        kind: inferEditKind(editKeyword, lower),
        label: humanLabel(inferEditKind(editKeyword, lower)),
        detail: `User activated "${label}".`,
        source: "ui-click",
        fingerprint
      });
    }
  }

  function handleInput() {
    clearTimeout(inputDebounce);
    inputDebounce = setTimeout(() => {
      const fingerprint = collectFingerprint();
      const changes = fingerprintChanges(lastInputFingerprint, fingerprint);
      lastInputFingerprint = fingerprint;
      for (const change of changes) {
        recordDetectedEvent({
          kind: change.kind,
          label: change.label,
          detail: change.detail,
          source: "form-observer",
          fingerprint
        });
      }
    }, 900);
  }

  function observeDom() {
    const observer = new MutationObserver(mutations => {
      if (!activeProject) return;
      const addedText = mutations
        .flatMap(mutation => Array.from(mutation.addedNodes))
        .map(node => node.textContent || "")
        .join(" ")
        .toLowerCase();
      const now = Date.now();
      if (/song|track|generation/.test(addedText) && /complete|ready|finished|created/.test(addedText) && now - lastDomCompletionAt > 15000) {
        lastDomCompletionAt = now;
        recordDetectedEvent({
          kind: "generation.completed",
          label: "Generation appeared",
          detail: "Suno UI changed in a way that looks like a completed generation.",
          source: "dom-observer",
          fingerprint: collectFingerprint()
        });
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  async function recordDetectedEvent(event, options = {}) {
    if (contextInvalidated) return;
    event.timestamp = event.timestamp || new Date().toISOString();
    event.url = event.url || location.href;
    const response = await sendMessage({ type: "events:record", event, options });
    if (!response?.ok) return;
    if (response.requiresPrompt) {
      pendingPromptEvent = response.event;
      showModal(response.matches || []);
      return;
    }
    if (response.captured) {
      activeProject = response.project;
      updateRecordingState();
      appendToastEvent(response.event);
    }
  }

  function observeNetworkResources() {
    const handleEntry = entry => {
      if (!entry?.name || observedResources.has(entry.name) || !isRelevantSunoResource(entry.name)) return;
      observedResources.add(entry.name);
      if (observedResources.size > 600) observedResources.clear();

      const classified = classifyNetworkEvent({
        transport: entry.initiatorType || "resource",
        url: entry.name,
        method: "OBSERVED",
        status: "observed",
        body: null,
        timestamp: new Date(entry.startTime + performance.timeOrigin).toISOString()
      });
      if (!classified) return;
      recordDetectedEvent(classified.event, { promptIfMissing: false });
    };

    for (const entry of performance.getEntriesByType("resource")) {
      handleEntry(entry);
    }

    if ("PerformanceObserver" in window) {
      try {
        const observer = new PerformanceObserver(list => {
          for (const entry of list.getEntries()) handleEntry(entry);
        });
        observer.observe({ type: "resource", buffered: true });
      } catch {
        // Passive network observation is best-effort only.
      }
    }
  }

  function classifyNetworkEvent(networkEvent) {
    const url = String(networkEvent.url || "").toLowerCase();
    const body = networkEvent.body || {};
    const text = `${url} ${JSON.stringify(body).toLowerCase()}`;
    const fingerprint = {
      ...collectFingerprint(),
      title: findFirst(body, ["title", "songTitle", "name"]) || collectFingerprint().title,
      lyrics: findFirst(body, ["lyrics", "prompt", "gpt_description_prompt"]) || collectFingerprint().lyrics,
      style: findFirst(body, ["style", "tags", "genre"]) || collectFingerprint().style,
      model: findFirst(body, ["model", "mv", "version"]) || collectFingerprint().model
    };

    if (/generate|create|clip/.test(text) && /post/i.test(networkEvent.method || "") && networkEvent.status === "pending") {
      return {
        promptIfMissing: true,
        event: {
          kind: "generation.requested",
          label: "Generation request sent",
          detail: "Suno generation request captured before the track was created.",
          source: networkEvent.transport || "network",
          url: networkEvent.url,
          timestamp: networkEvent.timestamp,
          fingerprint,
          payloadSummary: body
        }
      };
    }

    const kind = inferNetworkEditKind(text);
    if (kind && networkEvent.status === "pending") {
      return {
        promptIfMissing: false,
        event: {
          kind,
          label: humanLabel(kind),
          detail: "Suno edit request captured.",
          source: networkEvent.transport || "network",
          url: networkEvent.url,
          timestamp: networkEvent.timestamp,
          fingerprint,
          payloadSummary: body
        }
      };
    }

    if (settings?.verbosity === "detailed" && (/post|patch|put/i.test(networkEvent.method || "") || networkEvent.status === "observed")) {
      return {
        promptIfMissing: false,
        event: {
          kind: "request.observed",
          label: "Suno request observed",
          detail: `${networkEvent.method || "REQUEST"} ${new URL(networkEvent.url, location.href).pathname}`,
          source: networkEvent.transport || "network",
          url: networkEvent.url,
          timestamp: networkEvent.timestamp,
          fingerprint,
          payloadSummary: body
        }
      };
    }

    return null;
  }

  function collectFingerprint() {
    const fields = Array.from(document.querySelectorAll("textarea, input, [contenteditable='true']"));
    const visible = fields
      .filter(element => element.offsetParent !== null || element.matches("[contenteditable='true']"))
      .map(element => ({
        label: getFieldLabel(element).toLowerCase(),
        value: getFieldValue(element)
      }))
      .filter(field => field.value && field.value.length > 1);

    return {
      title: findByLabel(visible, ["title", "name"]),
      lyrics: findByLabel(visible, ["lyrics", "lyric", "prompt"]),
      style: findByLabel(visible, ["style", "genre", "tag", "vibe"]),
      model: findTextNear(["model", "v4", "v3.5", "chirp"])
    };
  }

  function fingerprintChanges(previous, next) {
    const changes = [];
    if (next.lyrics && next.lyrics !== previous.lyrics) {
      changes.push({
        kind: "lyrics.edited",
        label: "Lyrics edited",
        detail: summarizeDiff(previous.lyrics, next.lyrics)
      });
    }
    if (next.style && next.style !== previous.style) {
      changes.push({
        kind: "style.edited",
        label: "Style modified",
        detail: summarizeDiff(previous.style, next.style)
      });
    }
    if (next.title && next.title !== previous.title) {
      changes.push({
        kind: "title.edited",
        label: "Title changed",
        detail: summarizeDiff(previous.title, next.title)
      });
    }
    if (next.model && next.model !== previous.model) {
      changes.push({
        kind: "model.changed",
        label: "Model changed",
        detail: next.model
      });
    }
    return changes;
  }

  function showModal(matches) {
    const copy = modalHost.querySelector(".sr-modal-copy");
    if (matches.length) {
      copy.textContent = `This looks similar to "${matches[0].title}". Create a fresh receipt, or use the library popup to resume an existing project.`;
    } else {
      copy.textContent = "Suno Receipts saw a new generation request. Start a local project log so each creative edit is timestamped.";
    }
    modalHost.dataset.open = "true";
  }

  function hideModal() {
    modalHost.dataset.open = "false";
  }

  function updateRecordingState() {
    const toast = shadow.querySelector(".sr-toast");
    const subtitle = shadow.querySelector(".sr-subtitle");
    const pill = shadow.querySelector(".sr-pill");
    toast.dataset.hidden = activeProject ? "false" : "true";
    subtitle.textContent = activeProject ? activeProject.title : "Waiting for a generation";
    pill.textContent = activeProject ? "Recording" : "Idle";
  }

  function appendToastEvent(event) {
    const item = document.createElement("div");
    item.className = "sr-event";
    item.innerHTML = `
      <div class="sr-time">${escapeHtml(formatTime(event.timestamp))}</div>
      <div class="sr-copy">
        <div class="sr-label">${escapeHtml(event.label || "Event captured")}</div>
        <div class="sr-detail">${escapeHtml(event.detail || "")}</div>
      </div>
    `;
    toastList.prepend(item);
    while (toastList.children.length > 8) toastList.lastElementChild.remove();
  }

  function sendMessage(message) {
    if (contextInvalidated) return Promise.resolve({ ok: false, contextInvalidated: true });
    try {
      return chrome.runtime.sendMessage(message).catch(error => {
        if (isContextInvalidatedError(error)) {
          contextInvalidated = true;
          teardownContentScript();
          return { ok: false, contextInvalidated: true };
        }
        return { ok: false, error: error.message || "Extension message failed" };
      });
    } catch (error) {
      if (isContextInvalidatedError(error)) {
        contextInvalidated = true;
        teardownContentScript();
        return Promise.resolve({ ok: false, contextInvalidated: true });
      }
      return Promise.resolve({ ok: false, error: error.message || "Extension message failed" });
    }
  }

  function teardownContentScript() {
    document.removeEventListener("click", handleClick, true);
    document.removeEventListener("input", handleInput, true);
    document.removeEventListener("change", handleInput, true);
    document.getElementById(ROOT_ID)?.remove();
  }

  function isContextInvalidatedError(error) {
    return /extension context invalidated|context invalidated|extension context/i.test(error?.message || String(error || ""));
  }

  function isRelevantSunoResource(value) {
    try {
      const url = new URL(value, location.href);
      return /(^|\.)suno\.com$/i.test(url.hostname) || /^studio-api.*\.suno\.com$/i.test(url.hostname);
    } catch {
      return false;
    }
  }

  function isCreateContext() {
    return /\/create|\/song|\/workspace/i.test(location.pathname) || document.body.innerText.toLowerCase().includes("create");
  }

  function inferEditKind(keyword, text) {
    if (keyword === "extend") return "track.extended";
    if (keyword === "remaster") return "track.remastered";
    if (keyword === "cover") return "track.covered";
    if (keyword === "persona") return "persona.added";
    if (keyword === "voice") return "voice.added";
    if (keyword === "instrument") return "instrument.added";
    if (keyword === "vocal") return "vocals.changed";
    if (keyword === "speed") return "speed.changed";
    if (keyword === "section" || /move|add|replace/.test(text)) return "section.edited";
    return "ui.intent";
  }

  function inferNetworkEditKind(text) {
    if (/extend/.test(text)) return "track.extended";
    if (/remaster/.test(text)) return "track.remastered";
    if (/cover/.test(text)) return "track.covered";
    if (/persona/.test(text)) return "persona.added";
    if (/voice/.test(text)) return "voice.added";
    if (/instrument/.test(text)) return "instrument.added";
    if (/vocal/.test(text)) return "vocals.changed";
    if (/speed|tempo|bpm/.test(text)) return "speed.changed";
    if (/section|replace|crop|editor/.test(text)) return "section.edited";
    if (/lyric/.test(text)) return "lyrics.edited";
    if (/style|tag|genre/.test(text)) return "style.edited";
    if (/model|version/.test(text)) return "model.changed";
    return null;
  }

  function getElementLabel(element) {
    const button = element.closest("button, [role='button'], a, [aria-label]");
    if (!button) return "";
    return [
      button.getAttribute("aria-label"),
      button.getAttribute("title"),
      button.textContent
    ].filter(Boolean).join(" ").replace(/\s+/g, " ").trim().slice(0, 140);
  }

  function getFieldLabel(element) {
    const id = element.getAttribute("id");
    const aria = element.getAttribute("aria-label");
    const placeholder = element.getAttribute("placeholder");
    const label = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`)?.textContent : "";
    return [aria, placeholder, label, element.closest("label")?.textContent].filter(Boolean).join(" ");
  }

  function getFieldValue(element) {
    return (element.value || element.textContent || "").replace(/\s+/g, " ").trim();
  }

  function findByLabel(fields, labels) {
    const match = fields.find(field => labels.some(label => field.label.includes(label)));
    return match?.value || "";
  }

  function findTextNear(tokens) {
    const text = document.body?.innerText || "";
    const lines = text.split("\n").map(line => line.trim()).filter(Boolean);
    return lines.find(line => tokens.some(token => line.toLowerCase().includes(token)))?.slice(0, 80) || "";
  }

  function findFirst(value, keys) {
    if (!value || typeof value !== "object") return "";
    for (const [key, nestedValue] of Object.entries(value)) {
      if (keys.includes(key) && typeof nestedValue === "string") return nestedValue;
      if (nestedValue && typeof nestedValue === "object") {
        const found = findFirst(nestedValue, keys);
        if (found) return found;
      }
    }
    return "";
  }

  function summarizeDiff(before = "", after = "") {
    if (!before) return `Set to "${after.slice(0, 96)}${after.length > 96 ? "..." : ""}"`;
    return `Changed from ${before.length} to ${after.length} characters.`;
  }

  function humanLabel(kind) {
    return String(kind).split(".").map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
  }

  function formatTime(value) {
    return new Date(value || Date.now()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  }

  function escapeHtml(value) {
    return String(value || "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[char]);
  }
})();
