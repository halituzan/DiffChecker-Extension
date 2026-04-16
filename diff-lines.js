/**
 * Satır bazlı metin farkı (LCS tabanlı, birleştirilmiş çıktı).
 */
(function (global) {
  /**
   * @param {string} [joinWith] Satır diff'te bitişik aynı tür parçalar arası (ör. "\\n"); karakter/kelime için boş.
   */
  function mergeAdjacentParts(parts, joinWith) {
    if (!parts.length) return [];
    const j = joinWith === undefined ? "" : joinWith;
    const out = [{ type: parts[0].type, text: parts[0].text }];
    for (let k = 1; k < parts.length; k++) {
      const p = parts[k];
      const last = out[out.length - 1];
      if (last.type === p.type) {
        last.text += j + p.text;
      } else {
        out.push({ type: p.type, text: p.text });
      }
    }
    return out;
  }

  /**
   * İki dizi üzerinde LCS diff (satır, kelime veya karakter parçaları).
   * @param {string[]} a
   * @param {string[]} b
   */
  function computeSequenceDiff(a, b, joinMerged) {
    const m = a.length;
    const n = b.length;
    const dp = Array(m + 1)
      .fill(null)
      .map(() => Array(n + 1).fill(0));
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (a[i - 1] === b[j - 1]) dp[i][j] = dp[i - 1][j - 1] + 1;
        else dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
    const raw = [];
    let i = m;
    let j = n;
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
        raw.unshift({ type: "equal", text: a[i - 1] });
        i--;
        j--;
      } else if (i > 0 && (j === 0 || dp[i - 1][j] >= dp[i][j - 1])) {
        raw.unshift({ type: "delete", text: a[i - 1] });
        i--;
      } else {
        raw.unshift({ type: "insert", text: b[j - 1] });
        j--;
      }
    }
    return mergeAdjacentParts(raw, joinMerged);
  }

  function computeLineDiff(oldStr, newStr) {
    const a = oldStr.split(/\r?\n/);
    const b = newStr.split(/\r?\n/);
    return computeSequenceDiff(a, b, "\n");
  }

  global.LineDiff = { computeLineDiff, computeSequenceDiff };
})(typeof window !== "undefined" ? window : self);
