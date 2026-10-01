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
  const jsonTypeExport = document.getElementById("json-type-export");
  const jsonCopy = document.getElementById("json-copy");
  const jsonClear = document.getElementById("json-clear");
  const jsonStatus = document.getElementById("json-status");
  const jsonOutputLabel = document.getElementById("json-output-label");

  if (!jsonInput || !jsonOutputCode) return;

  const JSON_TOKEN_RE =
    /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|[{}\[\],:]/g;

  const TS_TOKEN_RE =
    /\b(export|interface|type)\b|\b(string|number|boolean|null|unknown|any)\b|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|\b[A-Z][A-Za-z0-9_]*\b|[{}\[\]:;|&?]|\/\/[^\n]*/g;

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

  function highlightTypeScript(text) {
    const s = String(text ?? "");
    if (!s) return "";
    const pieces = [];
    let last = 0;
    let m;
    TS_TOKEN_RE.lastIndex = 0;
    while ((m = TS_TOKEN_RE.exec(s)) !== null) {
      if (m.index > last) {
        pieces.push(escapeHtml(s.slice(last, m.index)));
      }
      const token = m[0];
      if (token.startsWith("//")) {
        pieces.push('<span class="tok-comment">' + escapeHtml(token) + "</span>");
      } else if (m[1]) {
        pieces.push('<span class="tok-kw">' + escapeHtml(token) + "</span>");
      } else if (m[2]) {
        pieces.push('<span class="tok-bool">' + escapeHtml(token) + "</span>");
      } else if (m[3]) {
        pieces.push('<span class="tok-str">' + escapeHtml(token) + "</span>");
      } else if (/^[A-Z]/.test(token)) {
        pieces.push('<span class="tok-key">' + escapeHtml(token) + "</span>");
      } else {
        pieces.push('<span class="tok-punct">' + escapeHtml(token) + "</span>");
      }
      last = m.index + m[0].length;
    }
    if (last < s.length) {
      pieces.push(escapeHtml(s.slice(last)));
    }
    return pieces.join("");
  }

  function setOutputLabel(mode) {
    if (!jsonOutputLabel) return;
    if (mode === "types") {
      jsonOutputLabel.textContent = t("jsonTypeOutputLabel", "TypeScript types");
    } else {
      jsonOutputLabel.textContent = t("jsonOutputLabel", "Formatted output");
    }
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

  function setOutput(plainText, mode) {
    const text = plainText || "";
    const outputMode = mode === "types" ? "types" : "json";
    jsonOutputCode.innerHTML = text
      ? outputMode === "types"
        ? highlightTypeScript(text)
        : highlightJson(text)
      : "";
    jsonOutput.dataset.plain = text;
    jsonOutput.dataset.mode = outputMode;
    syncOutputLines(text);
    setOutputLabel(outputMode);
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

  function toPascalCase(name) {
    const cleaned = String(name || "")
      .replace(/[^A-Za-z0-9]+/g, " ")
      .trim();
    if (!cleaned) return "Item";
    const parts = cleaned.split(/\s+/);
    const pascal = parts
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join("");
    return /^[A-Za-z_]/.test(pascal) ? pascal : "T" + pascal;
  }

  function isValidIdentifier(key) {
    return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key);
  }

  function formatPropertyKey(key) {
    return isValidIdentifier(key) ? key : JSON.stringify(String(key));
  }

  function uniqueInterfaceName(base, usedNames) {
    let name = toPascalCase(base);
    if (!usedNames.has(name)) {
      usedNames.add(name);
      return name;
    }
    let i = 2;
    while (usedNames.has(name + i)) i++;
    const unique = name + i;
    usedNames.add(unique);
    return unique;
  }

  function inferPrimitive(value) {
    if (value === null) return "null";
    if (typeof value === "string") return "string";
    if (typeof value === "boolean") return "boolean";
    if (typeof value === "number") return Number.isFinite(value) ? "number" : "number";
    return "unknown";
  }

  function mergeUnionTypes(types) {
    const set = new Set();
    types.forEach((type) => {
      if (!type) return;
      String(type)
        .split("|")
        .map((part) => part.trim())
        .filter(Boolean)
        .forEach((part) => set.add(part));
    });
    const list = Array.from(set);
    if (!list.length) return "unknown";
    if (list.length === 1) return list[0];
    const order = ["string", "number", "boolean", "null", "unknown"];
    list.sort((a, b) => {
      const ia = order.indexOf(a);
      const ib = order.indexOf(b);
      if (ia === -1 && ib === -1) return a.localeCompare(b);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
    return list.join(" | ");
  }

  function buildTypesFromJson(data) {
    const interfaces = [];
    const usedNames = new Set(["Root"]);
    const shapeCache = new Map();

    function interfaceSignature(props) {
      return Object.keys(props)
        .sort()
        .map((key) => key + ":" + props[key])
        .join("|");
    }

    function inferObject(obj, preferredName) {
      const propTypes = {};
      Object.keys(obj).forEach((key) => {
        propTypes[key] = inferValue(obj[key], toPascalCase(key));
      });
      const signature = interfaceSignature(propTypes);
      if (shapeCache.has(signature)) {
        return shapeCache.get(signature);
      }

      const interfaceName = uniqueInterfaceName(preferredName || "Object", usedNames);
      shapeCache.set(signature, interfaceName);
      const lines = Object.keys(obj).map(
        (key) => "  " + formatPropertyKey(key) + ": " + propTypes[key] + ";"
      );
      interfaces.push(
        "export interface " +
          interfaceName +
          " {\n" +
          (lines.length ? lines.join("\n") + "\n" : "") +
          "}"
      );
      return interfaceName;
    }

    function inferArray(arr, preferredName) {
      if (!arr.length) return "unknown[]";
      const elementTypes = arr.map((item, index) =>
        inferValue(item, (preferredName || "Item") + (index === 0 ? "" : String(index + 1)))
      );
      const merged = mergeUnionTypes(elementTypes);
      const needsParens = merged.includes("|");
      return (needsParens ? "(" + merged + ")" : merged) + "[]";
    }

    function inferValue(value, preferredName) {
      if (Array.isArray(value)) {
        return inferArray(value, preferredName);
      }
      if (value !== null && typeof value === "object") {
        return inferObject(value, preferredName);
      }
      return inferPrimitive(value);
    }

    let rootType;
    if (Array.isArray(data)) {
      rootType = inferArray(data, "Item");
      return (
        interfaces.join("\n\n") +
        (interfaces.length ? "\n\n" : "") +
        "export type Root = " +
        rootType +
        ";"
      );
    }
    if (data !== null && typeof data === "object") {
      usedNames.delete("Root");
      rootType = inferObject(data, "Root");
      return interfaces.join("\n\n");
    }
    rootType = inferPrimitive(data);
    return "export type Root = " + rootType + ";";
  }

  function formatJson() {
    const data = parseInput();
    if (data === null) return;
    const pretty = JSON.stringify(data, null, 2);
    jsonInput.value = pretty;
    syncInputLines();
    setOutput(pretty, "json");
    setStatus(t("jsonFormatOk", "Formatted."), false);
  }

  function minifyJson() {
    const data = parseInput();
    if (data === null) return;
    const mini = JSON.stringify(data);
    jsonInput.value = mini;
    syncInputLines();
    setOutput(mini, "json");
    setStatus(t("jsonMinifyOk", "Minified."), false);
  }

  function exportTypes() {
    const data = parseInput();
    if (data === null) return;
    const types = buildTypesFromJson(data);
    setOutput(types, "types");
    setStatus(t("jsonTypeExportOk", "Types exported."), false);
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

  const TOOL_SUBTITLE_KEYS = {
    diff: ["subtitle", "Compare two texts line by line - + added - - removed"],
    json: ["subtitleJson", "Format, minify, validate JSON and export TypeScript types"],
    image: ["subtitleImage", "Convert images between PNG, JPEG, WebP and AVIF"]
  };

  function updateToolSubtitle(tool) {
    const el = document.getElementById("app-subtitle");
    if (!el) return;
    const keys = TOOL_SUBTITLE_KEYS[tool] || TOOL_SUBTITLE_KEYS.diff;
    el.textContent = t(keys[0], keys[1]);
  }

  function switchTool(tool) {
    const valid = ["diff", "json", "image"];
    const next = valid.includes(tool) ? tool : "diff";
    document.body.setAttribute("data-tool", next);
    updateToolSubtitle(next);

    document.querySelectorAll(".tool-tab").forEach((btn) => {
      const selected = btn.getAttribute("data-tool") === next;
      btn.setAttribute("aria-selected", selected ? "true" : "false");
      btn.classList.toggle("tool-tab--active", selected);
    });

    document.querySelectorAll("[data-panel]").forEach((el) => {
      const match = el.getAttribute("data-panel") === next;
      if (
        el.classList.contains("tool-panel") ||
        el.id === "diff-toolbar" ||
        el.id === "json-toolbar" ||
        el.id === "img-toolbar"
      ) {
        el.hidden = !match;
      }
    });

    if (next === "json") {
      syncInputLines();
      requestAnimationFrame(() => {
        if (jsonInput) jsonInput.focus();
      });
    } else if (next === "image") {
      document.dispatchEvent(new CustomEvent("diffchecker:imagetool"));
    } else if (next === "diff") {
      requestAnimationFrame(() => {
        const diffLeft = document.getElementById("diff-left");
        if (diffLeft) diffLeft.focus();
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
  if (jsonTypeExport) jsonTypeExport.addEventListener("click", exportTypes);
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
    if (jsonTypeExport) {
      jsonTypeExport.textContent = t("jsonTypeExportButton", "Type Export");
    }
    setOutputLabel(jsonOutput && jsonOutput.dataset.mode === "types" ? "types" : "json");
    updateToolSubtitle(document.body.getAttribute("data-tool") || "diff");
  });

  switchTool("diff");
  syncInputLines();
})();
