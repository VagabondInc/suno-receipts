const STORAGE_KEYS = {
  projects: "sr_projects",
  projectOrder: "sr_project_order",
  activeByTab: "sr_active_by_tab",
  settings: "sr_settings"
};

const DEFAULT_SETTINGS = {
  verbosity: "balanced",
  autoPrompt: true,
  toastPosition: null,
  preferredSaveLocation: "~/Music/SunoReceipts/"
};

const EVENT_WEIGHTS = {
  "generation.requested": 10,
  "generation.completed": 9,
  "lyrics.edited": 8,
  "style.edited": 8,
  "title.edited": 6,
  "model.changed": 8,
  "track.extended": 9,
  "track.remastered": 9,
  "track.covered": 9,
  "persona.added": 7,
  "voice.added": 7,
  "instrument.added": 7,
  "vocals.changed": 7,
  "speed.changed": 7,
  "section.edited": 8,
  "ui.intent": 4,
  "request.observed": 3,
  "dom.observed": 2
};

chrome.runtime.onInstalled.addListener(async () => {
  const { sr_settings: settings } = await chrome.storage.local.get(STORAGE_KEYS.settings);
  if (!settings) {
    await chrome.storage.local.set({ [STORAGE_KEYS.settings]: DEFAULT_SETTINGS });
  }
});

chrome.tabs.onRemoved.addListener(async tabId => {
  const state = await readState();
  if (state.activeByTab[String(tabId)]) {
    delete state.activeByTab[String(tabId)];
    await writeState({ activeByTab: state.activeByTab });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then(sendResponse)
    .catch(error => {
      console.error("[Suno Receipts]", error);
      sendResponse({ ok: false, error: error.message || "Unknown extension error" });
    });
  return true;
});

async function handleMessage(message, sender) {
  const tabId = sender.tab?.id ? String(sender.tab.id) : message.tabId ? String(message.tabId) : "global";

  switch (message.type) {
    case "settings:get":
      return { ok: true, settings: await getSettings() };
    case "settings:update":
      return { ok: true, settings: await updateSettings(message.patch || {}) };
    case "projects:list":
      return { ok: true, ...(await getProjectList()) };
    case "projects:get":
      return { ok: true, project: await getProject(message.projectId) };
    case "projects:findSimilar":
      return { ok: true, matches: await findSimilarProjects(message.fingerprint || {}) };
    case "projects:create":
      return { ok: true, project: await createProject(message.payload || {}, tabId) };
    case "projects:setActive":
      return { ok: true, project: await setActiveProject(tabId, message.projectId) };
    case "projects:closeActive":
      return { ok: true, project: await closeActiveProject(tabId) };
    case "projects:saveActive":
      return await exportActiveProjectCsv(tabId);
    case "projects:exportCsv":
      return await exportProjectCsv(message.projectId);
    case "projects:exportReport":
      return await openProjectReport(message.projectId);
    case "events:record":
      return await recordEvent(tabId, message.event, message.options || {});
    case "state:active":
      return await getActiveState(tabId);
    default:
      return { ok: false, error: `Unsupported message type: ${message.type}` };
  }
}

async function readState() {
  const stored = await chrome.storage.local.get(Object.values(STORAGE_KEYS));
  return {
    projects: stored[STORAGE_KEYS.projects] || {},
    projectOrder: stored[STORAGE_KEYS.projectOrder] || [],
    activeByTab: stored[STORAGE_KEYS.activeByTab] || {},
    settings: { ...DEFAULT_SETTINGS, ...(stored[STORAGE_KEYS.settings] || {}) }
  };
}

async function writeState(patch) {
  const next = {};
  if (patch.projects) next[STORAGE_KEYS.projects] = patch.projects;
  if (patch.projectOrder) next[STORAGE_KEYS.projectOrder] = patch.projectOrder;
  if (patch.activeByTab) next[STORAGE_KEYS.activeByTab] = patch.activeByTab;
  if (patch.settings) next[STORAGE_KEYS.settings] = patch.settings;
  await chrome.storage.local.set(next);
}

async function getSettings() {
  return (await readState()).settings;
}

async function updateSettings(patch) {
  const state = await readState();
  const settings = { ...state.settings, ...patch };
  await writeState({ settings });
  return settings;
}

async function getProjectList() {
  const state = await readState();
  const projects = state.projectOrder
    .map(id => state.projects[id])
    .filter(Boolean)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  return { projects, activeByTab: state.activeByTab, settings: state.settings };
}

async function getProject(projectId) {
  if (!projectId) return null;
  const state = await readState();
  return state.projects[projectId] || null;
}

async function createProject(payload, tabId) {
  const state = await readState();
  const now = new Date().toISOString();
  const fingerprint = normalizeFingerprint(payload.fingerprint || {});
  const title = fingerprint.title || payload.title || `Untitled Suno Project ${state.projectOrder.length + 1}`;
  const project = {
    id: `sr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title,
    status: "recording",
    createdAt: now,
    updatedAt: now,
    fingerprint,
    sunoTrackIds: [],
    events: []
  };

  for (const event of payload.initialEvents || []) {
    project.events.push(prepareEvent(project.id, event));
  }

  state.projects[project.id] = project;
  state.projectOrder = [project.id, ...state.projectOrder.filter(id => id !== project.id)];
  state.activeByTab[tabId] = project.id;
  await writeState({
    projects: state.projects,
    projectOrder: state.projectOrder,
    activeByTab: state.activeByTab
  });
  return project;
}

async function setActiveProject(tabId, projectId) {
  const state = await readState();
  const project = state.projects[projectId];
  if (!project) throw new Error("Project not found");
  project.status = "recording";
  project.updatedAt = new Date().toISOString();
  state.activeByTab[tabId] = projectId;
  await writeState({ projects: state.projects, activeByTab: state.activeByTab });
  return project;
}

async function closeActiveProject(tabId) {
  const state = await readState();
  const projectId = state.activeByTab[tabId];
  if (!projectId || !state.projects[projectId]) return null;

  const project = state.projects[projectId];
  project.status = "closed";
  project.updatedAt = new Date().toISOString();
  project.events.push(prepareEvent(project.id, {
    kind: "project.closed",
    label: "Recording closed",
    detail: "User closed the active Suno Receipts project.",
    source: "extension"
  }));
  delete state.activeByTab[tabId];
  await writeState({ projects: state.projects, activeByTab: state.activeByTab });
  return project;
}

async function recordEvent(tabId, event, options) {
  const state = await readState();
  const settings = state.settings;
  const activeProjectId = state.activeByTab[tabId];
  const prepared = prepareEvent(activeProjectId || "pending", event);

  if (!shouldCapture(prepared, settings.verbosity)) {
    return { ok: true, captured: false, reason: "verbosity" };
  }

  if (!activeProjectId || !state.projects[activeProjectId]) {
    if (options.promptIfMissing && settings.autoPrompt) {
      return {
        ok: true,
        captured: false,
        requiresPrompt: true,
        event: prepared,
        matches: await findSimilarProjects(event.fingerprint || {})
      };
    }
    return { ok: true, captured: false, reason: "no-active-project" };
  }

  const project = state.projects[activeProjectId];
  prepared.projectId = activeProjectId;
  project.events.push(prepared);
  project.updatedAt = prepared.timestamp;
  project.fingerprint = mergeFingerprint(project.fingerprint, event.fingerprint || {});
  project.sunoTrackIds = mergeTrackIds(project.sunoTrackIds, event.trackIds || []);
  await writeState({ projects: state.projects });
  return { ok: true, captured: true, event: prepared, project };
}

async function getActiveState(tabId) {
  const state = await readState();
  const projectId = state.activeByTab[tabId];
  return {
    ok: true,
    settings: state.settings,
    project: projectId ? state.projects[projectId] || null : null
  };
}

async function exportActiveProjectCsv(tabId) {
  const state = await readState();
  const projectId = state.activeByTab[tabId];
  if (!projectId) return { ok: false, error: "No active project in this tab" };
  return exportProjectCsv(projectId);
}

async function exportProjectCsv(projectId) {
  const project = await getProject(projectId);
  if (!project) return { ok: false, error: "Project not found" };
  const csv = projectToCsv(project);
  const dataUrl = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
  const filename = `SunoReceipts/${safeFileName(project.title)}-${dateStamp(project.updatedAt)}.csv`;
  const downloadId = await chrome.downloads.download({
    url: dataUrl,
    filename,
    saveAs: false,
    conflictAction: "uniquify"
  });
  return { ok: true, downloadId, filename };
}

async function openProjectReport(projectId) {
  const project = await getProject(projectId);
  if (!project) return { ok: false, error: "Project not found" };
  const url = chrome.runtime.getURL(`report/report.html?id=${encodeURIComponent(projectId)}`);
  const tab = await chrome.tabs.create({ url });
  return { ok: true, tabId: tab.id };
}

async function findSimilarProjects(rawFingerprint) {
  const state = await readState();
  const fingerprint = normalizeFingerprint(rawFingerprint);
  return Object.values(state.projects)
    .map(project => ({ project, score: similarityScore(fingerprint, project.fingerprint || {}) }))
    .filter(result => result.score >= 0.42)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(({ project, score }) => ({
      id: project.id,
      title: project.title,
      status: project.status,
      updatedAt: project.updatedAt,
      score
    }));
}

function prepareEvent(projectId, rawEvent = {}) {
  const timestamp = rawEvent.timestamp || new Date().toISOString();
  return {
    id: rawEvent.id || `evt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    projectId,
    timestamp,
    kind: rawEvent.kind || "request.observed",
    label: rawEvent.label || humanizeKind(rawEvent.kind || "request.observed"),
    detail: sanitizeText(rawEvent.detail || ""),
    source: rawEvent.source || "content-script",
    url: sanitizeUrl(rawEvent.url || ""),
    fingerprint: normalizeFingerprint(rawEvent.fingerprint || {}),
    payloadSummary: sanitizePayload(rawEvent.payloadSummary || rawEvent.payload || null)
  };
}

function shouldCapture(event, verbosity) {
  const weight = EVENT_WEIGHTS[event.kind] ?? 3;
  if (verbosity === "minimal") return weight >= 8;
  if (verbosity === "detailed") return true;
  return weight >= 4;
}

function mergeFingerprint(current = {}, next = {}) {
  const normalized = normalizeFingerprint(next);
  return {
    title: normalized.title || current.title || "",
    lyrics: normalized.lyrics || current.lyrics || "",
    style: normalized.style || current.style || "",
    model: normalized.model || current.model || ""
  };
}

function normalizeFingerprint(fingerprint = {}) {
  return {
    title: sanitizeText(fingerprint.title || "").slice(0, 160),
    lyrics: sanitizeText(fingerprint.lyrics || "").slice(0, 4000),
    style: sanitizeText(fingerprint.style || "").slice(0, 1000),
    model: sanitizeText(fingerprint.model || "").slice(0, 80)
  };
}

function mergeTrackIds(existing, next) {
  return Array.from(new Set([...(existing || []), ...(next || []).map(String).filter(Boolean)]));
}

function similarityScore(a, b) {
  const title = jaccard(a.title, b.title);
  const lyrics = jaccard(a.lyrics, b.lyrics);
  const style = jaccard(a.style, b.style);
  const model = a.model && b.model && a.model === b.model ? 0.15 : 0;
  return Math.min(1, title * 0.25 + lyrics * 0.45 + style * 0.25 + model);
}

function jaccard(left = "", right = "") {
  const a = new Set(tokenize(left));
  const b = new Set(tokenize(right));
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection += 1;
  }
  return intersection / new Set([...a, ...b]).size;
}

function tokenize(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(token => token.length > 2)
    .slice(0, 400);
}

function projectToCsv(project) {
  const rows = [
    ["project_id", "project_title", "timestamp", "event_kind", "event_label", "detail", "source", "url", "payload_summary"]
  ];
  for (const event of project.events) {
    rows.push([
      project.id,
      project.title,
      event.timestamp,
      event.kind,
      event.label,
      event.detail,
      event.source,
      event.url,
      JSON.stringify(event.payloadSummary || "")
    ]);
  }
  return rows.map(row => row.map(csvEscape).join(",")).join("\n");
}

function csvEscape(value) {
  const text = value == null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function sanitizePayload(value) {
  if (!value) return "";
  if (typeof value === "string") return sanitizeText(value).slice(0, 1200);
  if (Array.isArray(value)) return value.slice(0, 12).map(sanitizePayload);
  if (typeof value === "object") {
    const output = {};
    for (const [key, nestedValue] of Object.entries(value).slice(0, 30)) {
      if (/token|auth|cookie|secret|password|credential/i.test(key)) {
        output[key] = "[redacted]";
      } else if (typeof nestedValue === "object" && nestedValue !== null) {
        output[key] = sanitizePayload(nestedValue);
      } else {
        output[key] = sanitizeText(String(nestedValue)).slice(0, 400);
      }
    }
    return output;
  }
  return String(value).slice(0, 400);
}

function sanitizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function sanitizeUrl(value) {
  try {
    const url = new URL(value);
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}

function humanizeKind(kind) {
  return String(kind)
    .split(".")
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function safeFileName(value) {
  return sanitizeText(value || "suno-project")
    .replace(/[^a-z0-9-_ ]/gi, "")
    .replace(/\s+/g, "-")
    .slice(0, 80)
    .toLowerCase() || "suno-project";
}

function dateStamp(value) {
  return new Date(value || Date.now()).toISOString().slice(0, 10);
}
