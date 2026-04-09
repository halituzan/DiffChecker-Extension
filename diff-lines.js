/**
 * Satır bazlı metin farkı (LCS tabanlı, birleştirilmiş çıktı).
 */
(function (global) {
  function computeLineDiff(oldStr, newStr) {
    const a = oldStr.split(/\r?\n/);
    const b = newStr.split(/\r?\n/);
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
    const parts = [];
    let i = m;
    let j = n;
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
        parts.unshift({ type: "equal", text: a[i - 1] });
        i--;
        j--;
      } else if (i > 0 && (j === 0 || dp[i - 1][j] >= dp[i][j - 1])) {
        parts.unshift({ type: "delete", text: a[i - 1] });
        i--;
      } else {
        parts.unshift({ type: "insert", text: b[j - 1] });
        j--;
      }
    }
    return parts;
  }

  global.LineDiff = { computeLineDiff };
})(typeof window !== "undefined" ? window : self);
