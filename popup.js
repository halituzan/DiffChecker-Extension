(function () {
  "use strict";

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
      diffNavPos.textContent = "— / " + n;
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
    diffStats.textContent = `Aynı: ${eq} · Eklenen: ${ins} · Silinen: ${del}`;
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
    diffFsBtn.title = on ? "Tam ekrandan çık" : "Tam ekran";
    diffFsBtn.setAttribute("aria-label", on ? "Tam ekrandan çık" : "Fark özetini tam ekran göster");
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
    const t = diffOutput.dataset.plain;
    if (!t) return;
    try {
      await navigator.clipboard.writeText(t);
      diffCopy.textContent = "Kopyalandı!";
      setTimeout(() => {
        diffCopy.textContent = "Özeti kopyala";
      }, 1500);
    } catch (e) {
      const ta = document.createElement("textarea");
      ta.value = t;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      diffCopy.textContent = "Kopyalandı!";
      setTimeout(() => {
        diffCopy.textContent = "Özeti kopyala";
      }, 1500);
    }
  });
})();
