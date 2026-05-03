const projectList = document.getElementById("projectList");
const emptyState = document.getElementById("emptyState");
const statusCard = document.getElementById("statusCard");
const statusCopy = document.getElementById("statusCopy");

document.getElementById("refresh").addEventListener("click", render);
document.getElementById("openOptions").addEventListener("click", () => chrome.runtime.openOptionsPage());
document.getElementById("exportActiveCsv").addEventListener("click", exportActiveCsv);
document.getElementById("openWorkspace").addEventListener("click", openWorkspace);
projectList.addEventListener("click", handleProjectAction);

render();

async function render() {
  const { projects, activeByTab } = await chrome.runtime.sendMessage({ type: "projects:list" });
  const activeIds = new Set(Object.values(activeByTab || {}));
  const activeProject = projects.find(project => activeIds.has(project.id));

  statusCard.dataset.recording = activeProject ? "true" : "false";
  statusCopy.textContent = activeProject
    ? `Recording "${activeProject.title}" with ${activeProject.events.length} captured events.`
    : "Open Suno and create a song to start recording.";

  emptyState.hidden = projects.length > 0;
  projectList.innerHTML = projects.map(project => projectTemplate(project, activeIds.has(project.id))).join("");
}

async function exportActiveCsv() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const response = await chrome.runtime.sendMessage({ type: "projects:saveActive", tabId: tab?.id });
  statusCopy.textContent = response.ok
    ? `Saved ${response.filename}.`
    : response.error || "No active project in this tab.";
}

async function openWorkspace() {
  const response = await chrome.runtime.sendMessage({ type: "workspace:open" });
  statusCopy.textContent = response.ok
    ? "Opened Suno and ChatGPT workspace windows."
    : response.error || "Could not open workspace.";
}

async function handleProjectAction(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const projectId = button.closest("[data-project-id]").dataset.projectId;
  if (button.dataset.action === "csv") {
    await chrome.runtime.sendMessage({ type: "projects:exportCsv", projectId });
  }
  if (button.dataset.action === "report") {
    await chrome.runtime.sendMessage({ type: "projects:exportReport", projectId });
  }
  if (button.dataset.action === "resume") {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await chrome.runtime.sendMessage({ type: "projects:setActive", projectId, tabId: tab?.id });
  }
  await render();
}

function projectTemplate(project, isActive) {
  return `
    <article class="project" data-project-id="${escapeHtml(project.id)}">
      <div class="project-top">
        <h2 class="project-title">${escapeHtml(project.title)}</h2>
        <span class="badge ${isActive ? "recording" : ""}">${isActive ? "Recording" : escapeHtml(project.status)}</span>
      </div>
      <p class="project-meta">${project.events.length} events · Updated ${relativeTime(project.updatedAt)}</p>
      <div class="project-actions">
        <button class="button ghost" data-action="resume" type="button">Resume</button>
        <button class="button ghost" data-action="csv" type="button">CSV</button>
        <button class="button ghost" data-action="report" type="button">PDF</button>
      </div>
    </article>
  `;
}

function relativeTime(value) {
  const delta = Date.now() - new Date(value).getTime();
  const minutes = Math.max(1, Math.round(delta / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(value).toLocaleDateString();
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
