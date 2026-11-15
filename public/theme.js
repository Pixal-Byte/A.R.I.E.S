/* A.R.I.E.S. // applies the saved theme before first paint (loaded synchronously in <head>). */
(function () {
    var theme = "dark";
    try {
        var saved = localStorage.getItem("aries-theme");
        if (saved === "light" || saved === "dark") theme = saved;
    } catch (e) { /* storage blocked: stay on the dark default */ }
document.documentElement.setAttribute("data-theme", theme);
})();