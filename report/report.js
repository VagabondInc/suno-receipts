const params = new URLSearchParams(location.search);
const projectId = params.get("id");
const title = document.getElementById("title");
const meta = document.getElementById("meta");
const summary = document.getElementById("summary");
const timeline = document.getElementById("timeline");

document.getElementById("print").addEventListener("click", () => window.print());
document.getElementById("csv").addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "projects:exportCsv", projectId });
});

load();

async function load() {
  const response = await chrome.runtime.sendMessage({ type: "projects:get", projectId });
  const project = response.project;
  if (!project) {
    title.textContent = "Receipt not found";
    meta.textContent = "Open the popup and choose another project.";
    return;
  }

  const first = project.events[0]?.timestamp || project.createdAt;
  const last = project.events[project.events.length - 1]?.timestamp || project.updatedAt;
  title.textContent = project.title;
  meta.textContent = `${formatDate(first)} to ${formatDate(last)} · ${project.events.length} captured creative events`;
  summary.innerHTML = summaryTemplate(project);
  timeline.innerHTML = project.events.map(eventTemplate).join("");
}

function summaryTemplate(project) {
  const counts = project.events.reduce((acc, event) => {
    acc[event.kind] = (acc[event.kind] || 0) + 1;
    return acc;
  }, {});
  return [
    ["Events", project.events.length],
    ["Lyric edits", counts["lyrics.edited"] || 0],
    ["Style changes", counts["style.edited"] || 0],
    ["Generations", counts["generation.requested"] || 0]
  ].map(([label, value]) => `
    <article class="stat">
      <strong>${value}</strong>
      <span>${label}</span>
    </article>
  `).join("");
}

function eventTemplate(event) {
  return `
    <article class="event">
      <time class="event-time">${escapeHtml(formatDate(event.timestamp))}</time>
      <div class="rail"><span class="dot"></span></div>
      <div class="event-card">
        <span class="event-kind">${escapeHtml(event.kind)}</span>
        <h2>${escapeHtml(event.label)}</h2>
        <p>${escapeHtml(event.detail || payloadText(event.payloadSummary))}</p>
      </div>
    </article>
  `;
}

function payloadText(payload) {
  if (!payload) return "";
  if (typeof payload === "string") return payload;
  return JSON.stringify(payload).slice(0, 220);
}

function formatDate(value) {
  return new Date(value).toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
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
