/* fullpage.html?popup=1 için body sınıfı (CSP: satır içi script yok) */
(function () {
  if (new URLSearchParams(location.search).get("popup") === "1") {
    document.body.className = "popup";
  }
})();
