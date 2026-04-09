/* Diff Checker - popup.js */
/* Halit Uzan - 2026 */
(function () {
  "use strict";

  const UI_LANG_STORAGE_KEY = "diffCheckerUiLanguage";
  const LOCALE_LOADERS = {
    en: () => fetch(chrome.runtime.getURL("_locales/en/messages.json")).then((r) => r.json()),
    tr: () => fetch(chrome.runtime.getURL("_locales/tr/messages.json")).then((r) => r.json())
  };
  const loadedLocales = {};
  let selectedUiLanguage = "auto";
  let activeUiLanguage = "en";
  const languageSelect = document.getElementById("language-select");

  function normalizeUiLanguage(lang) {
    const raw = (lang || "").toLowerCase();
    if (raw.startsWith("tr")) return "tr";
    return "en";
  }

  function getBrowserUiLanguage() {
    if (typeof chrome !== "undefined" && chrome.i18n && chrome.i18n.getUILanguage) {
      return chrome.i18n.getUILanguage();
    }
    return navigator.language || "en";
  }

  function resolveActiveUiLanguage() {
    return selectedUiLanguage === "auto"
      ? normalizeUiLanguage(getBrowserUiLanguage())
      : normalizeUiLanguage(selectedUiLanguage);
  }

  async function ensureLocaleLoaded(lang) {
    const normalized = normalizeUiLanguage(lang);
    if (loadedLocales[normalized]) return;
    const raw = await LOCALE_LOADERS[normalized]();
    loadedLocales[normalized] = Object.keys(raw).reduce((acc, key) => {
      acc[key] = raw[key] && typeof raw[key].message === "string" ? raw[key].message : "";
      return acc;
    }, {});
  }

  function t(key, fallback) {
    const fromSelectedLocale = loadedLocales[activeUiLanguage] && loadedLocales[activeUiLanguage][key];
    if (fromSelectedLocale) return fromSelectedLocale;
    if (typeof chrome !== "undefined" && chrome.i18n && chrome.i18n.getMessage) {
      const msg = chrome.i18n.getMessage(key);
      if (msg) return msg;
    }
    return fallback || key;
  }

  function localizePage() {
    document.documentElement.lang = activeUiLanguage;

    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (!key) return;
      const msg = t(key, el.textContent);
      if (msg) el.textContent = msg;
    });
    document.querySelectorAll("[data-i18n-title]").forEach((el) => {
      const key = el.getAttribute("data-i18n-title");
      if (!key) return;
      const msg = t(key, el.getAttribute("title") || "");
      if (msg) el.setAttribute("title", msg);
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      const key = el.getAttribute("data-i18n-placeholder");
      if (!key) return;
      const msg = t(key, el.getAttribute("placeholder") || "");
      if (msg) el.setAttribute("placeholder", msg);
    });
    document.querySelectorAll("[data-i18n-aria-label]").forEach((el) => {
      const key = el.getAttribute("data-i18n-aria-label");
      if (!key) return;
      const msg = t(key, el.getAttribute("aria-label") || "");
      if (msg) el.setAttribute("aria-label", msg);
    });
  }

  const diffRun = document.getElementById("diff-run");
  const diffCopy = document.getElementById("diff-copy");
  const diffClear = document.getElementById("diff-clear");
  const diffLeft = document.getElementById("diff-left");
  const diffRight = document.getElementById("diff-right");
  const diffOutput = document.getElementById("diff-output");
  const diffStats = document.getElementById("diff-stats");
  const diffNavUp = document.getElementById("diff-nav-up");
  const diffNavDown = document.getElementById("diff-nav-down");
  const diffNavPos = document.getElementById("diff-nav-pos");
  const diffLeftLines = document.getElementById("diff-left-lines");
  const diffRightLines = document.getElementById("diff-right-lines");

  function buildLineNumbers(textarea) {
    const lineCount = textarea.value
      ? textarea.value.split(/\r\n|\r|\n/).length
      : 1;
    const lines = new Array(lineCount);
    for (let i = 0; i < lineCount; i++) {
      lines[i] = String(i + 1);
    }
    return lines.join("\n");
  }

  function syncEditorLines(textarea, linesEl) {
    if (!textarea || !linesEl) return;
    linesEl.textContent = buildLineNumbers(textarea);
    const gutter = linesEl.parentElement;
    if (gutter) {
      gutter.scrollTop = textarea.scrollTop;
    }
  }

  function bindEditorLineNumbers(textarea, linesEl) {
    if (!textarea || !linesEl) return;
    const update = () => syncEditorLines(textarea, linesEl);
    textarea.addEventListener("input", update);
    textarea.addEventListener("change", update);
    textarea.addEventListener("paste", () => {
      requestAnimationFrame(update);
    });
    textarea.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    update();
  }

  async function applyLanguageSelection(newValue) {
    selectedUiLanguage = newValue === "tr" || newValue === "en" ? newValue : "auto";
    localStorage.setItem(UI_LANG_STORAGE_KEY, selectedUiLanguage);
    activeUiLanguage = resolveActiveUiLanguage();
    await ensureLocaleLoaded(activeUiLanguage);
    localizePage();
    updateNavUi();
    updateFsButtonUi();
    if (diffOutput.childElementCount > 0) runDiff();
  }

  async function initLocalization() {
    const stored = localStorage.getItem(UI_LANG_STORAGE_KEY);
    selectedUiLanguage = stored === "tr" || stored === "en" || stored === "auto" ? stored : "auto";
    activeUiLanguage = resolveActiveUiLanguage();
    await ensureLocaleLoaded("en");
    await ensureLocaleLoaded("tr");
    localizePage();
    if (languageSelect) {
      languageSelect.value = selectedUiLanguage;
      languageSelect.addEventListener("change", async (e) => {
        const value = e.target && e.target.value ? e.target.value : "auto";
        await applyLanguageSelection(value);
      });
    }
  }

  let navChangeIndex = -1;

  function getChangeLineElements() {
    return Array.from(
      diffOutput.querySelectorAll(".diff-line--insert, .diff-line--delete")
    );
  }

  function updateNavHighlight() {
    const els = getChangeLineElements();
    els.forEach((el, i) => {
      el.classList.toggle("diff-line--nav-current", i === navChangeIndex);
    });
  }

  function updateNavUi() {
    const els = getChangeLineElements();
    const n = els.length;
    if (!diffNavUp || !diffNavDown || !diffNavPos) return;
    diffNavUp.disabled = n === 0;
    diffNavDown.disabled = n === 0;
    if (n === 0) {
      diffNavPos.textContent = "";
    } else if (navChangeIndex < 0) {
      diffNavPos.textContent = t("navPositionUnknown", "—") + " / " + n;
    } else {
      diffNavPos.textContent = navChangeIndex + 1 + " / " + n;
    }
  }

  function scrollNavCurrentIntoView() {
    const els = getChangeLineElements();
    if (navChangeIndex < 0 || navChangeIndex >= els.length) return;
    els[navChangeIndex].scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  function goToChange(delta) {
    const els = getChangeLineElements();
    const n = els.length;
    if (!n) return;
    if (navChangeIndex < 0) {
      navChangeIndex = delta > 0 ? 0 : n - 1;
    } else {
      navChangeIndex = (navChangeIndex + delta + n) % n;
    }
    updateNavHighlight();
    updateNavUi();
    scrollNavCurrentIntoView();
  }

  function resetDiffNav() {
    navChangeIndex = -1;
    getChangeLineElements().forEach((el) => el.classList.remove("diff-line--nav-current"));
    updateNavUi();
  }

  function runDiff() {
    const left = diffLeft.value;
    const right = diffRight.value;
    const parts = window.LineDiff.computeLineDiff(left, right);
    let ins = 0;
    let del = 0;
    let eq = 0;
    diffOutput.innerHTML = "";
    const frag = document.createDocumentFragment();
    for (const p of parts) {
      if (p.type === "insert") ins++;
      else if (p.type === "delete") del++;
      else eq++;
      const row = document.createElement("div");
      row.className = "diff-line diff-line--" + p.type;
      const prefix = p.type === "delete" ? "- " : p.type === "insert" ? "+ " : "  ";
      row.textContent = prefix + p.text;
      frag.appendChild(row);
    }
    diffOutput.appendChild(frag);
    diffStats.textContent = `${t("statsSame", "Same")}: ${eq} · ${t("statsAdded", "Added")}: ${ins} · ${t("statsRemoved", "Removed")}: ${del}`;
    const plain = parts
      .map((p) => {
        const prefix = p.type === "delete" ? "- " : p.type === "insert" ? "+ " : "  ";
        return prefix + p.text;
      })
      .join("\n");
    diffOutput.dataset.plain = plain;
    diffCopy.disabled = parts.length === 0;
    navChangeIndex = -1;
    updateNavHighlight();
    updateNavUi();
  }

  diffRun.addEventListener("click", runDiff);

  if (diffNavUp) {
    diffNavUp.addEventListener("click", () => goToChange(-1));
  }
  if (diffNavDown) {
    diffNavDown.addEventListener("click", () => goToChange(1));
  }

  diffClear.addEventListener("click", () => {
    diffLeft.value = "";
    diffRight.value = "";
    syncEditorLines(diffLeft, diffLeftLines);
    syncEditorLines(diffRight, diffRightLines);
    diffOutput.innerHTML = "";
    diffStats.textContent = "";
    diffCopy.disabled = true;
    delete diffOutput.dataset.plain;
    resetDiffNav();
  });

  const diffMain = document.getElementById("diff-main");
  const diffColumns = document.getElementById("diff-columns");
  const diffResultBlock = document.getElementById("diff-result-block");
  const diffSplitter = document.getElementById("diff-splitter");
  const diffFsBtn = document.getElementById("diff-fs-btn");

  const SPLIT_MIN_COL = 100;
  const SPLIT_MIN_RES = 120;
  const SPLIT_GAP = 12;

  let splitDragging = false;
  let splitStartY = 0;
  let splitStartColH = 0;

  function getFullscreenEl() {
    return (
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      null
    );
  }

  function requestFs(el) {
    if (el.requestFullscreen) return el.requestFullscreen();
    if (el.webkitRequestFullscreen) return el.webkitRequestFullscreen();
    return Promise.reject(new Error("fullscreen"));
  }

  function exitFs() {
    if (document.exitFullscreen) return document.exitFullscreen();
    if (document.webkitExitFullscreen) return document.webkitExitFullscreen();
    return Promise.resolve();
  }

  function updateFsButtonUi() {
    if (!diffFsBtn || !diffResultBlock) return;
    const on = getFullscreenEl() === diffResultBlock;
    diffFsBtn.title = on
      ? t("fullscreenExitTitle", "Exit fullscreen")
      : t("fullscreenEnterTitle", "Fullscreen");
    diffFsBtn.setAttribute(
      "aria-label",
      on
        ? t("fullscreenExitAriaLabel", "Exit fullscreen")
        : t("fullscreenEnterAriaLabel", "Show diff summary in fullscreen")
    );
    diffFsBtn.textContent = on ? "⤓" : "⛶";
  }

  if (diffFsBtn && diffResultBlock) {
    diffFsBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (getFullscreenEl() === diffResultBlock) {
        exitFs();
      } else {
        requestFs(diffResultBlock).catch(() => {});
      }
    });
    document.addEventListener("fullscreenchange", updateFsButtonUi);
    document.addEventListener("webkitfullscreenchange", updateFsButtonUi);
    updateFsButtonUi();
  }

  function applySplitColumnHeight(newColPx) {
    if (!diffColumns || !diffResultBlock) return;
    diffColumns.style.flex = "0 0 auto";
    diffColumns.style.height = newColPx + "px";
    diffColumns.style.minHeight = newColPx + "px";
    diffColumns.style.maxHeight = newColPx + "px";
    diffColumns.style.overflow = "hidden";
    diffResultBlock.style.flex = "1 1 auto";
    diffResultBlock.style.minHeight = SPLIT_MIN_RES + "px";
    diffResultBlock.style.minWidth = "0";
  }

  if (diffSplitter && diffMain && diffColumns && diffResultBlock) {
    diffSplitter.addEventListener("mousedown", (e) => {
      e.preventDefault();
      splitDragging = true;
      splitStartY = e.clientY;
      splitStartColH = diffColumns.offsetHeight;
      document.body.classList.add("diff-splitter-active");
    });

    window.addEventListener("mousemove", (e) => {
      if (!splitDragging) return;
      e.preventDefault();
      const dy = e.clientY - splitStartY;
      const splitterH = diffSplitter.offsetHeight;
      const mainH = diffMain.clientHeight;
      const gapsTotal = SPLIT_GAP * 2;
      const maxCol = mainH - gapsTotal - splitterH - SPLIT_MIN_RES;
      const minColEff = Math.min(SPLIT_MIN_COL, Math.max(0, maxCol));
      let newCol = splitStartColH + dy;
      newCol = Math.max(minColEff, Math.min(Math.max(0, maxCol), newCol));
      applySplitColumnHeight(newCol);
    });

    window.addEventListener("mouseup", () => {
      if (!splitDragging) return;
      splitDragging = false;
      document.body.classList.remove("diff-splitter-active");
    });

    window.addEventListener("blur", () => {
      if (!splitDragging) return;
      splitDragging = false;
      document.body.classList.remove("diff-splitter-active");
    });
  }

  diffCopy.addEventListener("click", async () => {
    const textToCopy = diffOutput.dataset.plain;
    if (!textToCopy) return;
    try {
      await navigator.clipboard.writeText(textToCopy);
      diffCopy.textContent = t("copyDoneButton", "Copied!");
      setTimeout(() => {
        diffCopy.textContent = t("copySummaryButton", "Copy summary");
      }, 1500);
    } catch (e) {
      const ta = document.createElement("textarea");
      ta.value = textToCopy;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      diffCopy.textContent = t("copyDoneButton", "Copied!");
      setTimeout(() => {
        diffCopy.textContent = t("copySummaryButton", "Copy summary");
      }, 1500);
    }
  });

  initLocalization().then(() => {
    bindEditorLineNumbers(diffLeft, diffLeftLines);
    bindEditorLineNumbers(diffRight, diffRightLines);
    updateFsButtonUi();
    updateNavUi();
  });
})();
