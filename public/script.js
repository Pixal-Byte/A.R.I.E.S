/* A.R.I.E.S. // shared station scripts (loaded with defer on every page). */

/* ---- theme toggle ---- */
(function () {
  var btn = document.getElementById("theme-toggle");
  var root = document.documentElement;
  var meta = document.querySelector('meta[name="theme-color"]');

  function sync() {
    var light = root.getAttribute("data-theme") === "light";
    if (btn) btn.setAttribute("aria-pressed", light ? "true" : "false");
    if (meta) meta.setAttribute("content", light ? "#fbfdfe" : "#16151b");
  }

  if (btn) {
    btn.addEventListener("click", function () {
      var next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
      root.setAttribute("data-theme", next);
      try { localStorage.setItem("aries-theme", next); } catch (e) { /* ignore */ }
      sync();
      document.dispatchEvent(new Event("themechange"));
    });
  }
  sync();
})();

/* ---- starfield (static when the visitor prefers reduced motion) ---- */
(function () {
  var canvas = document.getElementById("starfield");
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext("2d");
  var mql = window.matchMedia("(prefers-reduced-motion: reduce)");
  var stars = [], w = 0, h = 0, raf = 0, last = 0, rgb = "231, 228, 240", alpha = 0.9;

  function readTheme() {
    var cs = getComputedStyle(document.documentElement);
    var c = cs.getPropertyValue("--star").trim();
    var a = parseFloat(cs.getPropertyValue("--star-alpha"));
    if (c) rgb = c;
    alpha = isNaN(a) ? 0.9 : a;
  }

  function seed() {
    var n = Math.min(260, Math.round((w * h) / 8000));
    stars = [];
    for (var i = 0; i < n; i++) {
      var z = Math.random();
      stars.push({ x: Math.random() * w, y: Math.random() * h, z: z, r: 0.4 + z * 1.3, tw: Math.random() * 6.283 });
    }
  }

  function draw(t) {
    ctx.clearRect(0, 0, w, h);
    var animated = !mql.matches;
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      var a = alpha * (0.35 + 0.65 * s.z);
      if (animated) a *= 0.75 + 0.25 * Math.sin(t / 900 + s.tw);
      ctx.fillStyle = "rgba(" + rgb + "," + a.toFixed(3) + ")";
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, 6.283);
      ctx.fill();
    }
  }

  function frame(t) {
    var dt = Math.min(50, t - last) || 16;
    last = t;
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      s.x -= (0.006 + 0.03 * s.z) * dt; /* parallax: nearer stars drift faster */
      if (s.x < -2) { s.x = w + 2; s.y = Math.random() * h; }
    }
    draw(t);
    raf = requestAnimationFrame(frame);
  }

  function start() {
    cancelAnimationFrame(raf);
    if (mql.matches) { draw(0); return; }
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    seed();
    if (mql.matches) draw(0);
  }

  var timer = 0;
  window.addEventListener("resize", function () { clearTimeout(timer); timer = setTimeout(resize, 150); });
  document.addEventListener("themechange", function () { readTheme(); if (mql.matches) draw(0); });
  if (mql.addEventListener) mql.addEventListener("change", start);
  else if (mql.addListener) mql.addListener(start);

  readTheme();
  resize();
  start();
})();

/* ---- station clock (UTC) and days in operation ---- */
(function () {
  var clock = document.getElementById("clock");
  var uptime = document.getElementById("uptime");
  if (!clock && !uptime) return;

  function pad(n) { return (n < 10 ? "0" : "") + n; }

  function tick() {
    var now = new Date();
    if (clock) clock.textContent = pad(now.getUTCHours()) + ":" + pad(now.getUTCMinutes()) + ":" + pad(now.getUTCSeconds()) + " UTC";
    if (uptime) {
      var since = uptime.getAttribute("data-since").split("-");
      var start = Date.UTC(+since[0], +since[1] - 1, +since[2]);
      var days = Math.max(0, Math.floor((now.getTime() - start) / 86400000));
      uptime.textContent = days + (days === 1 ? " day" : " days");
    }
  }
  tick();
  setInterval(tick, 1000);
})();

/* ---- 404: show the path that wasn't found (textContent only, never HTML) ---- */
(function () {
  var el = document.getElementById("lost-path");
  if (!el) return;
  var p = location.pathname;
  try { p = decodeURIComponent(p); } catch (e) { /* keep the raw path */ }
  if (p.length > 80) p = p.slice(0, 77) + "...";
  el.textContent = p;
})();

/* ---- tab title when the visitor looks away ---- */
(function () {
  var base = document.title;
  document.addEventListener("visibilitychange", function () {
    document.title = document.hidden ? "A.R.I.E.S. // VSITOR AWAY..." : base;
  });
})();