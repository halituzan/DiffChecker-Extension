/* Diff Checker - popup.js */
/* Halit Uzan - 2026 */
(function () {
  "use strict";

  const UI_LANG_STORAGE_KEY = "diffCheckerUiLanguage";
  const THEME_STORAGE_KEY = "diffCheckerTheme";

  const HIGHLIGHT_RE =
    /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|\b(function|const|let|var|if|else|return|for|while|async|await|class|import|export|from|try|catch|finally|new|typeof|default|switch|case|break|continue|void|null|undefined|true|false|do|in|of|this|super|extends|static|interface|type|enum|yield|debugger|with)\b/g;

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function highlightCodeLine(line) {
    if (line === undefined || line === null) return "\u00a0";
    const s = String(line);
    if (s.length === 0) return "\u00a0";
    const pieces = [];
    let last = 0;
    let m;
    HIGHLIGHT_RE.lastIndex = 0;
    while ((m = HIGHLIGHT_RE.exec(s)) !== null) {
      if (m.index > last) {
        pieces.push(escapeHtml(s.slice(last, m.index)));
      }
      if (m[1]) {
        pieces.push('<span class="tok-str">' + escapeHtml(m[1]) + "</span>");
      } else if (m[2]) {
        pieces.push('<span class="tok-kw">' + escapeHtml(m[2]) + "</span>");
      }
      last = m.index + m[0].length;
    }
    if (last < s.length) {
      pieces.push(escapeHtml(s.slice(last)));
    }
    return pieces.join("") || "\u00a0";
  }

  /** Satır içi diff: kısa satırlarda karakter (LCS), uzunlarda kelime/boşluk parçaları. */
  const INLINE_CHAR_MAX_LEN = 1500;
  const INLINE_MAX_DP = 2800000;

  function tokenizeInlineWords(s) {
    if (s === undefined || s === null) return [];
    const str = String(s);
    if (str === "") return [];
    return str.match(/\S+|\s+/g) || [];
  }

  /** Satır içi eşit parça: sözdizimi yok, nötr metin (değişmeyen kısım açıkça belli olsun). */
  function inlineEqualPlain(text) {
    const t = String(text ?? "");
    if (t.length === 0) return "";
    return '<span class="diff-inline-same">' + escapeHtml(t) + "</span>";
  }

  function buildInlineChangeHtml(leftLine, rightLine) {
    const ls = String(leftLine ?? "");
    const rs = String(rightLine ?? "");
    const maxLen = Math.max(ls.length, rs.length);
    if (maxLen === 0) {
      return { left: "\u00a0", right: "\u00a0" };
    }
    let seqA;
    let seqB;
    if (maxLen <= INLINE_CHAR_MAX_LEN) {
      seqA = Array.from(ls);
      seqB = Array.from(rs);
    } else {
      seqA = tokenizeInlineWords(ls);
      seqB = tokenizeInlineWords(rs);
    }
    const dpCost = seqA.length * seqB.length;
    if (dpCost > INLINE_MAX_DP || !window.LineDiff || typeof window.LineDiff.computeSequenceDiff !== "function") {
      return {
        left: ls.length
          ? '<span class="diff-inline-chg diff-inline-chg--del">' + escapeHtml(ls) + "</span>"
          : "\u00a0",
        right: rs.length
          ? '<span class="diff-inline-chg diff-inline-chg--ins">' + escapeHtml(rs) + "</span>"
          : "\u00a0"
      };
    }
    const parts = window.LineDiff.computeSequenceDiff(seqA, seqB);
    let leftHtml = "";
    let rightHtml = "";
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      if (p.type === "equal") {
        const h = inlineEqualPlain(p.text);
        leftHtml += h;
        rightHtml += h;
      } else if (p.type === "delete") {
        leftHtml +=
          '<span class="diff-inline-chg diff-inline-chg--del">' +
          escapeHtml(p.text) +
          "</span>";
      } else if (p.type === "insert") {
        rightHtml +=
          '<span class="diff-inline-chg diff-inline-chg--ins">' +
          escapeHtml(p.text) +
          "</span>";
      }
    }
    if (!leftHtml) leftHtml = "\u00a0";
    if (!rightHtml) rightHtml = "\u00a0";
    return { left: leftHtml, right: rightHtml };
  }

  function partsToSideBySideRows(parts) {
    const rows = [];
    let i = 0;
    while (i < parts.length) {
      const p = parts[i];
      if (p.type === "equal") {
        rows.push({ kind: "equal", left: p.text, right: p.text });
        i++;
      } else if (
        p.type === "delete" &&
        i + 1 < parts.length &&
        parts[i + 1].type === "insert"
      ) {
        rows.push({ kind: "change", left: p.text, right: parts[i + 1].text });
        i += 2;
      } else if (
        p.type === "insert" &&
        i + 1 < parts.length &&
        parts[i + 1].type === "delete"
      ) {
        /* LCS geri izlemesi bazen önce insert sonra delete üretir; yine de aynı satırın değişimi */
        rows.push({ kind: "change", left: parts[i + 1].text, right: p.text });
        i += 2;
      } else if (p.type === "delete") {
        rows.push({ kind: "delete", left: p.text, right: "" });
        i++;
      } else if (p.type === "insert") {
        rows.push({ kind: "insert", left: "", right: p.text });
        i++;
      } else {
        i++;
      }
    }
    return rows;
  }

  function buildPlainFromParts(parts) {
    return parts
      .map((p) => {
        const prefix = p.type === "delete" ? "- " : p.type === "insert" ? "+ " : "  ";
        return prefix + p.text;
      })
      .join("\n");
  }
  const SUPPORTED_UI_LANGUAGES = [
    "ar",
    "bg",
    "bn",
    "ca",
    "cs",
    "da",
    "de",
    "el",
    "en",
    "es",
    "et",
    "fa",
    "fi",
    "fr",
    "gu",
    "he",
    "hi",
    "hr",
    "hu",
    "id",
    "it",
    "ja",
    "jv",
    "kn",
    "ko",
    "lt",
    "lv",
    "ml",
    "mr",
    "ms",
    "my",
    "nl",
    "no",
    "or",
    "pl",
    "pt_BR",
    "ro",
    "ru",
    "sk",
    "sl",
    "sr",
    "sv",
    "ta",
    "te",
    "th",
    "tr",
    "uk",
    "ur",
    "vi",
    "zh_CN",
    "zh_TW"
  ];
  const LANGUAGE_OPTION_LABELS = {
    ar: "Arabic",
    bg: "Bulgarian",
    bn: "Bengali",
    ca: "Catalan",
    cs: "Czech",
    da: "Danish",
    de: "German",
    el: "Greek",
    en: "English",
    es: "Spanish",
    et: "Estonian",
    fa: "Persian",
    fi: "Finnish",
    fr: "French",
    gu: "Gujarati",
    he: "Hebrew",
    hi: "Hindi",
    hr: "Croatian",
    hu: "Hungarian",
    id: "Indonesian",
    it: "Italian",
    ja: "Japanese",
    jv: "Javanese",
    kn: "Kannada",
    ko: "Korean",
    lt: "Lithuanian",
    lv: "Latvian",
    ml: "Malayalam",
    mr: "Marathi",
    ms: "Malay",
    my: "Burmese",
    nl: "Dutch",
    no: "Norwegian",
    or: "Odia",
    pl: "Polish",
    pt_BR: "Portuguese (Brazil)",
    ro: "Romanian",
    ru: "Russian",
    sk: "Slovak",
    sl: "Slovenian",
    sr: "Serbian",
    sv: "Swedish",
    ta: "Tamil",
    te: "Telugu",
    th: "Thai",
    tr: "Turkish",
    uk: "Ukrainian",
    ur: "Urdu",
    vi: "Vietnamese",
    zh_CN: "Chinese (Simplified)",
    zh_TW: "Chinese (Traditional)"
  };
  const DEFAULT_UI_LANGUAGE = "en";
  const LOCALE_LOADERS = SUPPORTED_UI_LANGUAGES.reduce((acc, lang) => {
    acc[lang] = () => fetch(chrome.runtime.getURL(`_locales/${lang}/messages.json`)).then((r) => r.json());
    return acc;
  }, {});
  const loadedLocales = {};
  let selectedUiLanguage = "auto";
  let activeUiLanguage = "en";
  const languageSelect = document.getElementById("language-select");

  function normalizeUiLanguage(lang) {
    const raw = String(lang || "").trim();
    if (!raw) return DEFAULT_UI_LANGUAGE;
    const normalized = raw.replace(/-/g, "_");
    const lower = normalized.toLowerCase();
    if (LOCALE_LOADERS[normalized]) return normalized;
    if (LOCALE_LOADERS[lower]) return lower;
    const base = lower.split("_")[0];
    if (LOCALE_LOADERS[base]) return base;
    if (base === "zh") {
      if (lower.includes("tw") || lower.includes("hk") || lower.includes("hant")) return "zh_TW";
      return "zh_CN";
    }
    if (base === "pt") return "pt_BR";
    return DEFAULT_UI_LANGUAGE;
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

  function isSupportedUiLanguage(lang) {
    return SUPPORTED_UI_LANGUAGES.includes(lang);
  }

  function normalizeStoredUiLanguage(value) {
    if (value === "auto") return "auto";
    const normalized = normalizeUiLanguage(value);
    return isSupportedUiLanguage(normalized) ? normalized : "auto";
  }

  function populateLanguageSelectOptions() {
    if (!languageSelect) return;
    while (languageSelect.options.length > 1) {
      languageSelect.remove(1);
    }
    SUPPORTED_UI_LANGUAGES.forEach((lang) => {
      const option = document.createElement("option");
      option.value = lang;
      option.textContent = LANGUAGE_OPTION_LABELS[lang] || lang;
      languageSelect.appendChild(option);
    });
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
    selectedUiLanguage = normalizeStoredUiLanguage(newValue);
    localStorage.setItem(UI_LANG_STORAGE_KEY, selectedUiLanguage);
    activeUiLanguage = resolveActiveUiLanguage();
    await ensureLocaleLoaded(activeUiLanguage);
    localizePage();
    updateNavUi();
    updateFsButtonUi();
    updateThemeToggleUi();
    if (diffOutput.childElementCount > 0) runDiff();
  }

  function initTheme() {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    let theme = "light";
    if (stored === "dark" || stored === "light") {
      theme = stored;
    } else if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
      theme = "dark";
    }
    document.documentElement.setAttribute("data-theme", theme);
  }

  function updateThemeToggleUi() {
    const btn = document.getElementById("theme-toggle");
    if (!btn) return;
    const theme = document.documentElement.getAttribute("data-theme") || "light";
    btn.setAttribute("aria-pressed", theme === "dark" ? "true" : "false");
    if (theme === "dark") {
      btn.title = t("themeSwitchToLightTitle", "Switch to light mode");
      btn.setAttribute("aria-label", t("themeSwitchToLightAriaLabel", "Switch to light mode"));
    } else {
      btn.title = t("themeSwitchToDarkTitle", "Switch to dark mode");
      btn.setAttribute("aria-label", t("themeSwitchToDarkAriaLabel", "Switch to dark mode"));
    }
  }

  async function initLocalization() {
    const stored = localStorage.getItem(UI_LANG_STORAGE_KEY);
    selectedUiLanguage = normalizeStoredUiLanguage(stored);
    activeUiLanguage = resolveActiveUiLanguage();
    await ensureLocaleLoaded(DEFAULT_UI_LANGUAGE);
    if (activeUiLanguage !== DEFAULT_UI_LANGUAGE) {
      await ensureLocaleLoaded(activeUiLanguage);
    }
    localizePage();
    if (languageSelect) {
      populateLanguageSelectOptions();
      languageSelect.value = selectedUiLanguage;
      languageSelect.addEventListener("change", async (e) => {
        const value = e.target && e.target.value ? e.target.value : "auto";
        await applyLanguageSelection(value);
      });
    }
  }

  let navChangeIndex = -1;

  function getChangeRowElements() {
    return Array.from(diffOutput.querySelectorAll(".side-diff__row:not(.side-diff__row--equal)"));
  }

  function updateNavHighlight() {
    const els = getChangeRowElements();
    els.forEach((el, i) => {
      el.classList.toggle("side-diff__row--nav-current", i === navChangeIndex);
    });
  }

  function updateNavUi() {
    const els = getChangeRowElements();
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
    const els = getChangeRowElements();
    if (navChangeIndex < 0 || navChangeIndex >= els.length) return;
    const row = els[navChangeIndex];
    const target =
      row.querySelector(".side-diff__code--left") || row.querySelector(".side-diff__code--right");
    if (target) {
      target.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }

  function goToChange(delta) {
    const els = getChangeRowElements();
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
    getChangeRowElements().forEach((el) => el.classList.remove("side-diff__row--nav-current"));
    updateNavUi();
  }

  function renderSideBySideDiff(container, rows) {
    const root = document.createElement("div");
    root.className = "side-diff";

    const toolbar = document.createElement("div");
    toolbar.className = "side-diff__toolbar";
    const labLeft = document.createElement("span");
    labLeft.className = "side-diff__label side-diff__label--left";
    labLeft.textContent = t("outputText1", "Text 1");
    const labRight = document.createElement("span");
    labRight.className = "side-diff__label side-diff__label--right";
    labRight.textContent = t("outputText2", "Text 2");
    const swapBtn = document.createElement("button");
    swapBtn.type = "button";
    swapBtn.id = "diff-swap";
    swapBtn.className = "side-diff__swap";
    swapBtn.title = t("swapColumnsTitle", "Swap left and right text");
    swapBtn.setAttribute("aria-label", t("swapColumnsAriaLabel", "Swap left and right text"));
    const swapSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    swapSvg.setAttribute("viewBox", "0 0 24 24");
    swapSvg.setAttribute("aria-hidden", "true");
    const swapPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    swapPath.setAttribute("fill", "currentColor");
    swapPath.setAttribute(
      "d",
      "M6.99 11L3 15l3.99 4v-3H14v-2H6.99v-3zM21 9l-3.99-4v3H10v2h7.01v3L21 9z"
    );
    swapSvg.appendChild(swapPath);
    swapBtn.appendChild(swapSvg);
    toolbar.appendChild(labLeft);
    toolbar.appendChild(swapBtn);
    toolbar.appendChild(labRight);

    const body = document.createElement("div");
    body.className = "side-diff__body";

    let leftNum = 1;
    let rightNum = 1;

    for (let r = 0; r < rows.length; r++) {
      const rowData = rows[r];
      const row = document.createElement("div");
      row.className = "side-diff__row side-diff__row--" + rowData.kind;
      const inlineChange =
        rowData.kind === "change" ? buildInlineChangeHtml(rowData.left, rowData.right) : null;

      let lnLeft = "";
      let lnRight = "";
      if (rowData.kind === "equal" || rowData.kind === "change") {
        lnLeft = String(leftNum++);
        lnRight = String(rightNum++);
      } else if (rowData.kind === "delete") {
        lnLeft = String(leftNum++);
        lnRight = "";
      } else if (rowData.kind === "insert") {
        lnLeft = "";
        lnRight = String(rightNum++);
      }

      const cellLnL = document.createElement("div");
      cellLnL.className = "side-diff__ln";
      cellLnL.textContent = lnLeft || "\u00a0";

      const markL = document.createElement("div");
      markL.className = "side-diff__mark side-diff__mark--left";
      markL.setAttribute("aria-hidden", "true");

      const cellCodeL = document.createElement("div");
      cellCodeL.className = "side-diff__code side-diff__code--left";
      cellCodeL.innerHTML = inlineChange ? inlineChange.left : highlightCodeLine(rowData.left);

      const cellLnR = document.createElement("div");
      cellLnR.className = "side-diff__ln side-diff__ln--right";
      cellLnR.textContent = lnRight || "\u00a0";

      const markR = document.createElement("div");
      markR.className = "side-diff__mark side-diff__mark--right";
      markR.setAttribute("aria-hidden", "true");

      const cellCodeR = document.createElement("div");
      cellCodeR.className = "side-diff__code side-diff__code--right";
      cellCodeR.innerHTML = inlineChange ? inlineChange.right : highlightCodeLine(rowData.right);

      if (rowData.kind === "delete" || rowData.kind === "change") {
        const icon = document.createElement("span");
        icon.className = "side-diff__gutter-icon side-diff__gutter-icon--minus";
        icon.textContent = "\u2212";
        markL.appendChild(icon);
      }
      if (rowData.kind === "insert" || rowData.kind === "change") {
        const icon = document.createElement("span");
        icon.className = "side-diff__gutter-icon side-diff__gutter-icon--plus";
        icon.textContent = "+";
        markR.appendChild(icon);
      }

      row.appendChild(cellLnL);
      row.appendChild(markL);
      row.appendChild(cellCodeL);
      row.appendChild(cellLnR);
      row.appendChild(markR);
      row.appendChild(cellCodeR);
      body.appendChild(row);
    }

    root.appendChild(toolbar);
    root.appendChild(body);
    container.appendChild(root);
  }

  function runDiff() {
    const left = diffLeft.value;
    const right = diffRight.value;
    const parts = window.LineDiff.computeLineDiff(left, right);
    let ins = 0;
    let del = 0;
    let eq = 0;
    for (const p of parts) {
      if (p.type === "insert") ins++;
      else if (p.type === "delete") del++;
      else eq++;
    }
    diffOutput.innerHTML = "";
    const rows = partsToSideBySideRows(parts);
    if (rows.length > 0) {
      renderSideBySideDiff(diffOutput, rows);
    }
    diffStats.textContent = `${t("statsSame", "Same")}: ${eq} · ${t("statsAdded", "Added")}: ${ins} · ${t("statsRemoved", "Removed")}: ${del}`;
    const plain = buildPlainFromParts(parts);
    diffOutput.dataset.plain = plain;
    diffCopy.disabled = parts.length === 0;
    navChangeIndex = -1;
    updateNavHighlight();
    updateNavUi();
  }

  const themeToggle = document.getElementById("theme-toggle");
  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      const cur = document.documentElement.getAttribute("data-theme") || "light";
      const next = cur === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      localStorage.setItem(THEME_STORAGE_KEY, next);
      updateThemeToggleUi();
    });
  }

  const settingsPanel = document.getElementById("settings-panel");
  const headerSettings = document.getElementById("header-settings");
  if (headerSettings && settingsPanel) {
    function positionSettingsPopover() {
      const btn = headerSettings.getBoundingClientRect();
      const margin = 8;
      const w = settingsPanel.offsetWidth;
      const left = Math.max(margin, Math.min(btn.right - w, window.innerWidth - w - margin));
      settingsPanel.style.top = btn.bottom + margin + "px";
      settingsPanel.style.left = left + "px";
      settingsPanel.style.right = "auto";
    }
    settingsPanel.addEventListener("toggle", (e) => {
      if (e.target !== settingsPanel) return;
      const open = e.newState === "open";
      headerSettings.setAttribute("aria-expanded", open ? "true" : "false");
      if (open) {
        requestAnimationFrame(() => {
          positionSettingsPopover();
          requestAnimationFrame(positionSettingsPopover);
        });
      }
    });
    window.addEventListener("resize", () => {
      if (typeof settingsPanel.matches === "function" && settingsPanel.matches(":popover-open")) {
        positionSettingsPopover();
      }
    });
  }

  function initOpenModeUi() {
    const sel = document.getElementById("open-mode-select");
    if (!sel || typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) {
      return;
    }
    chrome.storage.local.get(["openMode"], (r) => {
      sel.value = r.openMode === "popup" ? "popup" : "tab";
    });
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local" || !changes.openMode) return;
      sel.value = changes.openMode.newValue === "popup" ? "popup" : "tab";
    });
    sel.addEventListener("change", () => {
      const v = sel.value;
      chrome.storage.local.set({ openMode: v });
      if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({ type: "openModeChanged", mode: v }, () => {
          void chrome.runtime.lastError;
        });
      }
    });
  }

  diffOutput.addEventListener("click", (e) => {
    const swap = e.target && e.target.closest && e.target.closest("#diff-swap");
    if (!swap) return;
    const tmp = diffLeft.value;
    diffLeft.value = diffRight.value;
    diffRight.value = tmp;
    syncEditorLines(diffLeft, diffLeftLines);
    syncEditorLines(diffRight, diffRightLines);
    runDiff();
  });

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
    initTheme();
    updateThemeToggleUi();
    initOpenModeUi();
    bindEditorLineNumbers(diffLeft, diffLeftLines);
    bindEditorLineNumbers(diffRight, diffRightLines);
    updateFsButtonUi();
    updateNavUi();
  });
})();
