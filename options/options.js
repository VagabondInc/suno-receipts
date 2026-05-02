const verbosityInputs = Array.from(document.querySelectorAll("input[name='verbosity']"));
const autoPrompt = document.getElementById("autoPrompt");
const preferredSaveLocation = document.getElementById("preferredSaveLocation");
const saveButton = document.getElementById("save");

load();
saveButton.addEventListener("click", save);
verbosityInputs.forEach(input => input.addEventListener("change", save));
autoPrompt.addEventListener("change", save);

async function load() {
  const { settings } = await chrome.runtime.sendMessage({ type: "settings:get" });
  const selected = verbosityInputs.find(input => input.value === settings.verbosity) || verbosityInputs[1];
  selected.checked = true;
  autoPrompt.checked = Boolean(settings.autoPrompt);
  preferredSaveLocation.value = settings.preferredSaveLocation || "~/Music/SunoReceipts/";
}

async function save() {
  const verbosity = verbosityInputs.find(input => input.checked)?.value || "balanced";
  const response = await chrome.runtime.sendMessage({
    type: "settings:update",
    patch: {
      verbosity,
      autoPrompt: autoPrompt.checked,
      preferredSaveLocation: preferredSaveLocation.value.trim() || "~/Music/SunoReceipts/"
    }
  });
  saveButton.textContent = response.ok ? "Saved" : "Try Again";
  setTimeout(() => {
    saveButton.textContent = "Save Settings";
  }, 1200);
}
