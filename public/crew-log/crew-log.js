(function () {
    var root = document.getElementById("crewlog");
    var tpl = document.getElementById("entry-tpl");
    var list = document.getElementById("entries");
    var empty_notice = document.getElementById("entries-empty");

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

    function render(entries) {
        list.replaceChildren();
        entries.forEach(function(entry) {
            var li = tpl.content.firstElementChild.cloneNode(true);
            li.querySelector(".callsign").textContent = entry.name;
            li.querySelector(".entry-body").textContent = entry.message;

            var time = li.querySelector("time");
            time.dateTime = entry.created_at;
            time.textContent = new Date(entry.created_at).toLocaleString();

            list.appendChild(li);
        });
    }

    async function loadEntries() {
        try {
            var entries = await getJSON("/api/guestbook?limit=20");
            empty_notice.hidden = entries.length > 0;
            render(entries);
        setState("online");
        } catch (err) {
            console.error(err);
            setState("offline");                // network error, timeout, 5xx or non-JSON: all "offline"
        }
    }

    loadEntries();
    }
)();