/* Diff Checker - image-converter.js */
/* Halit Uzan - 2026 */
(function () {
  "use strict";

  const imgDrop = document.getElementById("img-drop");
  const imgFileInput = document.getElementById("img-file-input");
  const imgSourcePreview = document.getElementById("img-source-preview");
  const imgOutputPreview = document.getElementById("img-output-preview");
  const imgSourceInfo = document.getElementById("img-source-info");
  const imgOutputInfo = document.getElementById("img-output-info");
  const imgFormatSelect = document.getElementById("img-format-select");
  const imgQualityWrap = document.getElementById("img-quality-wrap");
  const imgQuality = document.getElementById("img-quality");
  const imgQualityValue = document.getElementById("img-quality-value");
  const imgBgWrap = document.getElementById("img-bg-wrap");
  const imgBgColor = document.getElementById("img-bg-color");
  const imgConvert = document.getElementById("img-convert");
  const imgDownload = document.getElementById("img-download");
  const imgClear = document.getElementById("img-clear");
  const imgStatus = document.getElementById("img-status");

  if (!imgDrop || !imgFileInput) return;

  const OUTPUT_FORMATS = [
    { mime: "image/png", ext: "png", lossy: false, key: "imgFormatPng" },
    { mime: "image/jpeg", ext: "jpg", lossy: true, key: "imgFormatJpeg" },
    { mime: "image/webp", ext: "webp", lossy: true, key: "imgFormatWebp" },
    { mime: "image/avif", ext: "avif", lossy: true, key: "imgFormatAvif" }
  ];

  const supportedOutputMimes = new Set();
  let sourceFile = null;
  let sourceObjectUrl = null;
  let outputBlob = null;
  let outputObjectUrl = null;
  let sourceMeta = null;

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

  function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes < 0) return "—";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
  }

  function formatLabelFromMime(mime) {
    if (!mime) return t("imgFormatUnknown", "Unknown");
    const hit = OUTPUT_FORMATS.find((f) => f.mime === mime);
    if (hit) return t(hit.key, hit.ext.toUpperCase());
    const sub = mime.split("/")[1];
    return sub ? sub.toUpperCase() : mime;
  }

  function revokeUrl(url) {
    if (url) URL.revokeObjectURL(url);
  }

  function setStatus(message, isError) {
    if (!imgStatus) return;
    imgStatus.textContent = message || "";
    imgStatus.classList.toggle("img-status--error", !!isError);
  }

  function updateQualityLabel() {
    if (!imgQuality || !imgQualityValue) return;
    imgQualityValue.textContent = imgQuality.value + "%";
  }

  function selectedFormat() {
    const mime = imgFormatSelect ? imgFormatSelect.value : "image/png";
    return OUTPUT_FORMATS.find((f) => f.mime === mime) || OUTPUT_FORMATS[0];
  }

  function updateFormatControls() {
    const fmt = selectedFormat();
    const lossy = !!fmt.lossy;
    if (imgQualityWrap) imgQualityWrap.hidden = !lossy;
    if (imgBgWrap) imgBgWrap.hidden = fmt.mime !== "image/jpeg";
    updateQualityLabel();
  }

  function populateFormatOptions() {
    if (!imgFormatSelect) return;
    imgFormatSelect.innerHTML = "";
    OUTPUT_FORMATS.forEach((fmt) => {
      if (!supportedOutputMimes.has(fmt.mime)) return;
      const option = document.createElement("option");
      option.value = fmt.mime;
      option.textContent = t(fmt.key, fmt.ext.toUpperCase());
      imgFormatSelect.appendChild(option);
    });
    if (!imgFormatSelect.options.length) {
      const option = document.createElement("option");
      option.value = "image/png";
      option.textContent = t("imgFormatPng", "PNG");
      imgFormatSelect.appendChild(option);
    }
    updateFormatControls();
  }

  function detectOutputSupport() {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    return Promise.all(
      OUTPUT_FORMATS.map(
        (fmt) =>
          new Promise((resolve) => {
            canvas.toBlob(
              (blob) => {
                if (blob) supportedOutputMimes.add(fmt.mime);
                resolve();
              },
              fmt.mime,
              fmt.lossy ? 0.8 : undefined
            );
          })
      )
    );
  }

  function renderSourceInfo() {
    if (!imgSourceInfo) return;
    if (!sourceFile || !sourceMeta) {
      imgSourceInfo.textContent = "";
      return;
    }
    const placeholder = imgDrop && imgDrop.querySelector(".img-drop__placeholder");
    if (placeholder) placeholder.hidden = true;
    imgSourceInfo.textContent = t(
      "imgSourceInfo",
      "$1 × $2 · $3 · $4"
    )
      .replace("$1", String(sourceMeta.width))
      .replace("$2", String(sourceMeta.height))
      .replace("$3", formatLabelFromMime(sourceFile.type))
      .replace("$4", formatBytes(sourceFile.size));
  }

  function renderOutputInfo() {
    if (!imgOutputInfo) return;
    if (!outputBlob || !sourceMeta) {
      imgOutputInfo.textContent = "";
      return;
    }
    const fmt = selectedFormat();
    imgOutputInfo.textContent = t(
      "imgOutputInfo",
      "$1 × $2 · $3 · $4"
    )
      .replace("$1", String(sourceMeta.width))
      .replace("$2", String(sourceMeta.height))
      .replace("$3", fmt.ext.toUpperCase())
      .replace("$4", formatBytes(outputBlob.size));
  }

  function clearOutputPreview() {
    revokeUrl(outputObjectUrl);
    outputObjectUrl = null;
    outputBlob = null;
    if (imgOutputPreview) {
      imgOutputPreview.removeAttribute("src");
      imgOutputPreview.hidden = true;
    }
    const emptyEl = document.getElementById("img-output-empty");
    if (emptyEl) emptyEl.hidden = false;
    if (imgDownload) imgDownload.disabled = true;
    renderOutputInfo();
  }

  function clearSource() {
    revokeUrl(sourceObjectUrl);
    sourceObjectUrl = null;
    sourceFile = null;
    sourceMeta = null;
    if (imgSourcePreview) {
      imgSourcePreview.removeAttribute("src");
      imgSourcePreview.hidden = true;
    }
    if (imgFileInput) imgFileInput.value = "";
    if (imgDrop) imgDrop.classList.remove("img-drop--filled");
    const placeholder = imgDrop && imgDrop.querySelector(".img-drop__placeholder");
    if (placeholder) placeholder.hidden = false;
    renderSourceInfo();
    clearOutputPreview();
    if (imgConvert) imgConvert.disabled = true;
    setStatus("");
  }

  function loadImageFromFile(file) {
    if (!file || !file.type.startsWith("image/")) {
      setStatus(t("imgInvalidFile", "Select a valid image file."), true);
      return;
    }

    clearSource();
    sourceFile = file;
    sourceObjectUrl = URL.createObjectURL(file);

    const img = new Image();
    img.onload = () => {
      sourceMeta = { width: img.naturalWidth, height: img.naturalHeight };
      if (imgSourcePreview) {
        imgSourcePreview.src = sourceObjectUrl;
        imgSourcePreview.hidden = false;
      }
      if (imgDrop) imgDrop.classList.add("img-drop--filled");
      renderSourceInfo();
      if (imgConvert) imgConvert.disabled = false;
      setStatus(t("imgLoadedOk", "Image loaded."), false);
      convertImage();
    };
    img.onerror = () => {
      clearSource();
      setStatus(t("imgDecodeError", "Could not read this image."), true);
    };
    img.src = sourceObjectUrl;
  }

  function canvasToBlob(canvas, mime, quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("toBlob failed"));
        },
        mime,
        quality
      );
    });
  }

  async function convertImage() {
    if (!sourceFile || !sourceMeta) {
      setStatus(t("imgEmptyError", "Add an image first."), true);
      return;
    }

    const fmt = selectedFormat();
    if (!supportedOutputMimes.has(fmt.mime)) {
      setStatus(t("imgUnsupportedFormat", "This output format is not supported in your browser."), true);
      return;
    }

    if (imgConvert) imgConvert.disabled = true;
    setStatus(t("imgConverting", "Converting…"), false);

    let bitmap;
    try {
      bitmap = await createImageBitmap(sourceFile);
    } catch (e) {
      if (imgConvert) imgConvert.disabled = false;
      setStatus(t("imgDecodeError", "Could not read this image."), true);
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d", { alpha: fmt.mime !== "image/jpeg" });

    if (fmt.mime === "image/jpeg") {
      ctx.fillStyle = imgBgColor && imgBgColor.value ? imgBgColor.value : "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();

    const quality = fmt.lossy && imgQuality ? Number(imgQuality.value) / 100 : undefined;

    try {
      const blob = await canvasToBlob(canvas, fmt.mime, quality);
      revokeUrl(outputObjectUrl);
      outputBlob = blob;
      outputObjectUrl = URL.createObjectURL(blob);
      if (imgOutputPreview) {
        imgOutputPreview.src = outputObjectUrl;
        imgOutputPreview.hidden = false;
      }
      const emptyEl = document.getElementById("img-output-empty");
      if (emptyEl) emptyEl.hidden = true;
      if (imgDownload) imgDownload.disabled = false;
      renderOutputInfo();
      setStatus(t("imgConvertOk", "Converted."), false);
    } catch (e) {
      clearOutputPreview();
      setStatus(t("imgConvertError", "Conversion failed.") + " " + (e.message || ""), true);
    } finally {
      if (imgConvert) imgConvert.disabled = !sourceFile;
    }
  }

  function downloadOutput() {
    if (!outputBlob || !sourceFile) return;
    const fmt = selectedFormat();
    const baseName = sourceFile.name.replace(/\.[^.]+$/, "") || "image";
    const a = document.createElement("a");
    a.href = outputObjectUrl;
    a.download = baseName + "." + fmt.ext;
    a.click();
  }

  function bindDropZone() {
    imgDrop.addEventListener("click", () => {
      if (sourceFile) return;
      imgFileInput.click();
    });
    imgDrop.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        imgFileInput.click();
      }
    });

    imgFileInput.addEventListener("change", () => {
      const file = imgFileInput.files && imgFileInput.files[0];
      if (file) loadImageFromFile(file);
    });

    ["dragenter", "dragover"].forEach((evt) => {
      imgDrop.addEventListener(evt, (e) => {
        e.preventDefault();
        e.stopPropagation();
        imgDrop.classList.add("img-drop--drag");
      });
    });

    ["dragleave", "drop"].forEach((evt) => {
      imgDrop.addEventListener(evt, (e) => {
        e.preventDefault();
        e.stopPropagation();
        imgDrop.classList.remove("img-drop--drag");
      });
    });

    imgDrop.addEventListener("drop", (e) => {
      const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (file) loadImageFromFile(file);
    });
  }

  if (imgFormatSelect) {
    imgFormatSelect.addEventListener("change", () => {
      updateFormatControls();
      if (sourceFile) convertImage();
    });
  }

  if (imgQuality) {
    imgQuality.addEventListener("input", () => {
      updateQualityLabel();
    });
    imgQuality.addEventListener("change", () => {
      if (sourceFile) convertImage();
    });
  }

  if (imgBgColor) {
    imgBgColor.addEventListener("input", () => {
      if (sourceFile && selectedFormat().mime === "image/jpeg") convertImage();
    });
  }

  if (imgConvert) imgConvert.addEventListener("click", convertImage);
  if (imgDownload) imgDownload.addEventListener("click", downloadOutput);
  if (imgClear) imgClear.addEventListener("click", clearSource);

  document.addEventListener("diffchecker:languagechange", () => {
    populateFormatOptions();
    renderSourceInfo();
    renderOutputInfo();
  });

  document.addEventListener("diffchecker:imagetool", () => {
    requestAnimationFrame(() => imgDrop.focus());
  });

  bindDropZone();
  updateQualityLabel();

  detectOutputSupport().then(() => {
    populateFormatOptions();
  });
})();
