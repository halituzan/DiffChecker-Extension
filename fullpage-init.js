/* fullpage.html?popup=1 için body sınıfı (CSP: satır içi script yok) */
(function () {
  if (new URLSearchParams(location.search).get("popup") === "1") {
    document.body.classList.remove("fullpage");
    document.body.classList.add("popup");
    if (!document.body.hasAttribute("data-tool")) {
      document.body.setAttribute("data-tool", "diff");
    }
  }
})();
