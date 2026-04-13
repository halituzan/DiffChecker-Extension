const OPEN_MODE_KEY = "openMode";

function openFullPageInTab() {
  chrome.tabs.create({ url: chrome.runtime.getURL("fullpage.html") });
}

let tabClickListenerRegistered = false;

function registerTabClickListenerOnce() {
  if (tabClickListenerRegistered) return;
  tabClickListenerRegistered = true;
  chrome.action.onClicked.addListener(openFullPageInTab);
}

/**
 * setPopup tarayicida bazen asenkron tamamlanir; onClicked ancak popup
 * gercekten ayarlandiktan sonra kaydedilmeli (aksi halde tiklamada sekme acilir).
 */
function applyOpenMode(mode, onApplied) {
  const m = mode === "popup" ? "popup" : "tab";
  const done = typeof onApplied === "function" ? onApplied : () => {};

  if (m === "popup") {
    chrome.action.setPopup({ popup: "popup.html" }, () => {
      if (chrome.runtime.lastError) {
        console.warn("DiffChecker setPopup(popup):", chrome.runtime.lastError.message);
      }
      done();
    });
  } else {
    chrome.action.setPopup({ popup: "" }, () => {
      if (chrome.runtime.lastError) {
        console.warn("DiffChecker setPopup(clear):", chrome.runtime.lastError.message);
      }
      done();
    });
  }
}

function afterStorageReady(r) {
  const mode = r[OPEN_MODE_KEY] !== undefined ? r[OPEN_MODE_KEY] : "tab";
  applyOpenMode(mode, registerTabClickListenerOnce);
}

chrome.storage.local.get(OPEN_MODE_KEY, (r) => {
  if (chrome.runtime.lastError) {
    applyOpenMode("tab", registerTabClickListenerOnce);
    return;
  }
  afterStorageReady(r);
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !changes.openMode) return;
  applyOpenMode(changes.openMode.newValue || "tab");
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === "openModeChanged" && (msg.mode === "popup" || msg.mode === "tab")) {
    applyOpenMode(msg.mode);
    sendResponse({ ok: true });
  }
  return false;
});

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    chrome.storage.local.get(OPEN_MODE_KEY, (r) => {
      if (r[OPEN_MODE_KEY] === undefined) {
        chrome.storage.local.set({ openMode: "tab" });
      }
    });
  }
});
