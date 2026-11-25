(function () {
    var root = document.getElementById("crewlog");

    function setState(state) { root.dataset.state = state; }

    async function getJSON(url) {
        var ctrl = new AbortController();
        var timer = setTimeout(function () { ctrl.abort(); }, 8000);   // give up after 8 s
        try {
            var res = await fetch(url, { signal: ctrl.signal });
            if (!res.ok) throw new Error("HTTP " + res.status);
            return await res.json();            // throws if the body isn't JSON (e.g. Caddy's 404 page)
        } finally {
            clearTimeout(timer);
        }
    }

    async function loadEntries() {
        try {
            var entries = await getJSON("/api/guestbook?limit=20");
            // TODO: render(entries) by cloning #entry-tpl and filling it with textContent
        setState("online");
        } catch (err) {
            setState("offline");                // network error, timeout, 5xx or non-JSON: all "offline"
        }
    }

    loadEntries();
    }
)();