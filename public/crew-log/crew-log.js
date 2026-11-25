(function () {
    var root = document.getElementById("crewlog");
    var tpl = document.getElementById("entry-tpl");
    var list = document.getElementById("entries");
    var empty_notice = document.getElementById("entries-empty");
    var form = document.getElementById("log-form");
    var message = document.getElementById("f-message");
    var token = null;
    var formStatus = document.getElementById("form-status");
    var btn_send = document.getElementById("send");

    //Helpers
    function setState(state) { root.dataset.state = state; }

    async function refreshToken() {
        var data = await getJSON("/api/guestbook/token") 
        token = data.token;
    }

    function showStatus(kind, text) {      // kind: "ok" or "warn"
        formStatus.className = "notice " + kind;
        formStatus.textContent = text;
        formStatus.hidden = false;
    }

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
            await refreshToken();
            setState("online");
        } catch (err) {
            setState("offline");                // network error, timeout, 5xx or non-JSON: all "offline"
        }
    }

    loadEntries();

    // Listeners
    document.getElementById("retry").addEventListener("click", function() { loadEntries() });
    message.addEventListener("input", function() {
        document.getElementById("msg-count").textContent = message.value.length;
    });
    form.addEventListener("submit", async function (event) {
        event.preventDefault();
        btn_send.disabled = true;
        var data = Object.fromEntries(new FormData(form));
        try {
            var res;
            try {
                res = await fetch("/api/guestbook", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ ...data, token: token }),
                });
            } catch(err) {
                showStatus("warn", "Transmission failed: no signal. Your message is still here, so try again.");
                return; 
            }

            switch (res.status) {
                case 202:
                    showStatus("ok", "Transmission received. It will appear in the log once a crew member has read it.");
                    form.reset();
                    document.getElementById("msg-count").textContent = 0;
                    break;
                case 400:
                    showStatus("warn", "The channel timed out, or that was very quick. A fresh one is open now, so press send again in a few seconds.");
                    await refreshToken();
                    break;
                case 422:
                    showStatus("warn", "That entry didn't pass the checks. Make sure it has a name and a message, and try again.");
                    break;
                case 429:
                    var minutes = Math.ceil(Number(res.headers.get("Retry-After")) / 60);
                    showStatus("warn", "Too many transmissions from your connection. The channel reopens in about " + minutes + " min.");
                    break;
                default:
                    showStatus("warn", "Something went wrong at the station. Your message is still here, so try again in a moment.");
                    break;
            }
        } finally {
            btn_send.disabled = false;
        }
    });
}
)();