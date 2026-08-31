/* Diff Checker - json-formatter.js */
/* Halit Uzan - 2026 */
(function () {
  "use strict";

  const jsonInput = document.getElementById("json-input");
  const jsonOutput = document.getElementById("json-output");
  const jsonOutputCode = document.getElementById("json-output-code");
  const jsonInputLines = document.getElementById("json-input-lines");
  const jsonOutputLines = document.getElementById("json-output-lines");
  const jsonFormat = document.getElementById("json-format");
  const jsonMinify = document.getElementById("json-minify");
  const jsonCopy = document.getElementById("json-copy");
  const jsonClear = document.getElementById("json-clear");
  const jsonStatus = document.getElementById("json-status");

  if (!jsonInput || !jsonOutputCode) return;

  const JSON_TOKEN_RE =
    /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|[{}\[\],:]/g;

  function t(key, fallback) {
    if (window.DiffCheckerI18n && typeof window.DiffCheckerI18n.t === "function") {
      return window.DiffCheckerI18n.t(key, fallback);
    }
    if (typeof chrome !== "undefined" && chrome.i18n && chrome.i18n.getMessage) {
      const msg = chrome.i18n.getMessage(key);
      if (msg) return msg;
    }
    return fallback || key;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function highlightJson(text) {
    const s = String(text ?? "");
    if (!s) return "";
    const pieces = [];
    let last = 0;
    let m;
    JSON_TOKEN_RE.lastIndex = 0;
    while ((m = JSON_TOKEN_RE.exec(s)) !== null) {
      if (m.index > last) {
        pieces.push(escapeHtml(s.slice(last, m.index)));
      }
      if (m[1] !== undefined) {
        if (m[2] !== undefined) {
          pieces.push(
            '<span class="tok-key">' +
              escapeHtml(m[1]) +
              "</span>" +
              escapeHtml(m[2])
          );
        } else {
          pieces.push('<span class="tok-str">' + escapeHtml(m[1]) + "</span>");
        }
      } else if (m[3]) {
        pieces.push('<span class="tok-bool">' + escapeHtml(m[3]) + "</span>");
      } else if (/^-?\d/.test(m[0])) {
        pieces.push('<span class="tok-num">' + escapeHtml(m[0]) + "</span>");
      } else {
        pieces.push('<span class="tok-punct">' + escapeHtml(m[0]) + "</span>");
      }
      last = m.index + m[0].length;
    }
    if (last < s.length) {
      pieces.push(escapeHtml(s.slice(last)));
    }
    return pieces.join("");
  }

  function buildLineNumbers(text) {
    const lineCount = text ? String(text).split(/\r\n|\r|\n/).length : 1;
    const lines = new Array(lineCount);
    for (let i = 0; i < lineCount; i++) {
      lines[i] = String(i + 1);
    }
    return lines.join("\n");
  }

  function syncInputLines() {
    if (!jsonInputLines) return;
    jsonInputLines.textContent = buildLineNumbers(jsonInput.value);
    const gutter = jsonInputLines.parentElement;
    if (gutter) gutter.scrollTop = jsonInput.scrollTop;
  }

  function syncOutputLines(text) {
    if (!jsonOutputLines) return;
    jsonOutputLines.textContent = buildLineNumbers(text || "");
  }

  function setStatus(message, isError) {
    if (!jsonStatus) return;
    jsonStatus.textContent = message || "";
    jsonStatus.classList.toggle("json-status--error", !!isError);
  }

  function setOutput(plainText) {
    const text = plainText || "";
    jsonOutputCode.innerHTML = text ? highlightJson(text) : "";
    jsonOutput.dataset.plain = text;
    syncOutputLines(text);
    if (jsonCopy) jsonCopy.disabled = !text;
  }

  function parseInput() {
    const raw = jsonInput.value.trim();
    if (!raw) {
      setStatus(t("jsonEmptyError", "Paste JSON first."), true);
      setOutput("");
      return null;
    }
    try {
      return JSON.parse(raw);
    } catch (err) {
      const msg = err && err.message ? err.message : String(err);
      setStatus(t("jsonParseError", "Invalid JSON") + ": " + msg, true);
      setOutput("");
      return null;
    }
  }

  function formatJson() {
    const data = parseInput();
    if (data === null) return;
    const pretty = JSON.stringify(data, null, 2);
    jsonInput.value = pretty;
    syncInputLines();
    setOutput(pretty);
    setStatus(t("jsonFormatOk", "Formatted."), false);
  }

  function minifyJson() {
    const data = parseInput();
    if (data === null) return;
    const mini = JSON.stringify(data);
    jsonInput.value = mini;
    syncInputLines();
    setOutput(mini);
    setStatus(t("jsonMinifyOk", "Minified."), false);
  }

  async function copyJson() {
    const text = jsonOutput.dataset.plain;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    if (jsonCopy) {
      jsonCopy.textContent = t("copyDoneButton", "Copied!");
      setTimeout(() => {
        jsonCopy.textContent = t("jsonCopyButton", "Copy");
      }, 1500);
    }
  }

  function clearJson() {
    jsonInput.value = "";
    setOutput("");
    setStatus("");
    syncInputLines();
  }

  function switchTool(tool) {
    const next = tool === "json" ? "json" : "diff";
    document.body.setAttribute("data-tool", next);

    document.querySelectorAll(".tool-tab").forEach((btn) => {
      const selected = btn.getAttribute("data-tool") === next;
      btn.setAttribute("aria-selected", selected ? "true" : "false");
      btn.classList.toggle("tool-tab--active", selected);
    });

    document.querySelectorAll("[data-panel]").forEach((el) => {
      const match = el.getAttribute("data-panel") === next;
      if (el.classList.contains("tool-panel") || el.id === "diff-toolbar" || el.id === "json-toolbar") {
        el.hidden = !match;
      }
    });

    if (next === "json") {
      syncInputLines();
      requestAnimationFrame(() => {
        if (jsonInput) jsonInput.focus();
      });
    }
  }

  document.querySelectorAll(".tool-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      switchTool(btn.getAttribute("data-tool"));
    });
  });

  if (jsonFormat) jsonFormat.addEventListener("click", formatJson);
  if (jsonMinify) jsonMinify.addEventListener("click", minifyJson);
  if (jsonCopy) jsonCopy.addEventListener("click", copyJson);
  if (jsonClear) jsonClear.addEventListener("click", clearJson);

  jsonInput.addEventListener("input", syncInputLines);
  jsonInput.addEventListener("scroll", syncInputLines);
  jsonInput.addEventListener("paste", () => requestAnimationFrame(syncInputLines));

  if (jsonOutput) {
    jsonOutput.addEventListener("scroll", () => {
      if (!jsonOutputLines) return;
      const gutter = jsonOutputLines.parentElement;
      if (gutter) gutter.scrollTop = jsonOutput.scrollTop;
    });
  }

  document.addEventListener("diffchecker:languagechange", () => {
    if (jsonCopy && !jsonCopy.disabled) {
      jsonCopy.textContent = t("jsonCopyButton", "Copy");
    }
  });

  switchTool("diff");
  syncInputLines();
})();
