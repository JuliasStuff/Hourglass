// Hourglass — playful time tracker

const STORAGE_KEY = "hourglass.v1";
const EMOJI_CHOICES = ["⏳", "📚", "💻", "🎨", "🏃", "🧘", "🍳", "🎮", "📝", "🎵", "🛌", "🚿", "🧹", "🛒", "📞", "✍️", "📖", "💪", "🚗", "🐶", "🌱", "☕", "🍕", "🎬", "🧠", "🎯", "💼", "🏠", "👪", "❤️", "✨"];
const COLOR_CHOICES = ["#ffb37a", "#ff9ec7", "#8ec5ff", "#9be7c4", "#ffe27a", "#c4a3ff", "#ff8e8e", "#7fd8d8", "#b8d97a", "#ffc1a3"];

const DEFAULT_DATA = {
    types: [
        { id: "t-work", name: "Work", color: "#8ec5ff", emoji: "💼" },
        { id: "t-learn", name: "Learning", color: "#9be7c4", emoji: "🧠" },
        { id: "t-fun", name: "Fun", color: "#ff9ec7", emoji: "✨" },
        { id: "t-self", name: "Self-care", color: "#ffe27a", emoji: "🧘" }
    ],
    activities: [
        { id: "a-code", name: "Coding", typeId: "t-work", emoji: "💻" },
        { id: "a-read", name: "Reading", typeId: "t-learn", emoji: "📚" },
        { id: "a-game", name: "Gaming", typeId: "t-fun", emoji: "🎮" },
        { id: "a-exer", name: "Exercise", typeId: "t-self", emoji: "💪" }
    ],
    sessions: [],
    current: null
};

let data = loadData();
let tickHandle = null;
let syncDebounce = null;

function loadData() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            return structuredClone(DEFAULT_DATA);
        }
        const parsed = JSON.parse(raw);
        return {
            types: parsed.types || [],
            activities: parsed.activities || [],
            sessions: parsed.sessions || [],
            current: parsed.current || null
        };
    } catch (e) {
        console.warn("Bad data, resetting", e);
        return structuredClone(DEFAULT_DATA);
    }
}

function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function uid(prefix) {
    return prefix + "-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function fmtDuration(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

function fmtDurationShort(ms) {
    const total = Math.floor(ms / 1000);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    if (h > 0) {
        return h + "h " + m + "m";
    }
    if (m > 0) {
        return m + "m";
    }
    return total + "s";
}

function findActivity(id) {
    return data.activities.find((a) => a.id === id);
}

function findType(id) {
    return data.types.find((t) => t.id === id);
}

// Timer
function startTimer(activityId) {
    if (data.current) {
        stopTimer();
    }
    data.current = { activityId, startedAt: Date.now() };
    saveData();
    renderTimer();
    renderQuickStart();
    startTick();
    confetti();
    const act = findActivity(activityId);
    if (act) {
        toast("Started " + act.emoji + " " + act.name);
    }
}

function stopTimer() {
    if (!data.current) {
        return;
    }
    const endedAt = Date.now();
    const session = {
        id: uid("s"),
        activityId: data.current.activityId,
        startedAt: data.current.startedAt,
        endedAt,
        durationMs: endedAt - data.current.startedAt
    };
    if (session.durationMs >= 1000) {
        data.sessions.push(session);
    }
    const act = findActivity(data.current.activityId);
    data.current = null;
    saveData();
    stopTick();
    renderTimer();
    renderQuickStart();
    renderStats();
    if (act) {
        toast("Saved " + fmtDurationShort(session.durationMs) + " on " + act.name);
    }
}

function startTick() {
    stopTick();
    tickHandle = setInterval(renderTimerReadout, 1000);
    renderTimerReadout();
}

function stopTick() {
    if (tickHandle) {
        clearInterval(tickHandle);
        tickHandle = null;
    }
}

// Rendering: Timer tab
function renderTimer() {
    const btn = document.getElementById("btn-start-stop");
    const label = document.getElementById("current-activity");
    const clk = document.getElementById("clock-svg");
    if (data.current) {
        const act = findActivity(data.current.activityId);
        btn.textContent = "Stop 🛑";
        btn.classList.add("stop");
        label.textContent = (act ? act.emoji + " " + act.name : "Tracking…");
        label.classList.add("active");
        clk.classList.add("running");
    } else {
        btn.textContent = "Start ✨";
        btn.classList.remove("stop");
        label.textContent = "Pick something fun ↓";
        label.classList.remove("active");
        clk.classList.remove("running");
        document.getElementById("time-readout").textContent = "00:00:00";
    }
    updateClock();
}

function renderTimerReadout() {
    if (!data.current) {
        return;
    }
    const elapsed = Date.now() - data.current.startedAt;
    document.getElementById("time-readout").textContent = fmtDuration(elapsed);
    updateClock();
}

function buildClockFace() {
    const cx = 100;
    const cy = 100;
    const ticks = document.getElementById("clock-ticks");
    const nums = document.getElementById("clock-numbers");
    if (!ticks || !nums || ticks.childElementCount > 0) {
        return;
    }
    for (let i = 0; i < 60; i++) {
        const a = (i / 60) * Math.PI * 2 - Math.PI / 2;
        const isHour = i % 5 === 0;
        const inner = isHour ? 70 : 74;
        const outer = 80;
        const x1 = cx + Math.cos(a) * inner;
        const y1 = cy + Math.sin(a) * inner;
        const x2 = cx + Math.cos(a) * outer;
        const y2 = cy + Math.sin(a) * outer;
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", x1);
        line.setAttribute("y1", y1);
        line.setAttribute("x2", x2);
        line.setAttribute("y2", y2);
        line.setAttribute("stroke", isHour ? "#6b5440" : "#c8a98a");
        line.setAttribute("stroke-width", isHour ? 2.5 : 1);
        line.setAttribute("stroke-linecap", "round");
        ticks.appendChild(line);
    }
    for (let h = 1; h <= 12; h++) {
        const a = (h / 12) * Math.PI * 2 - Math.PI / 2;
        const x = cx + Math.cos(a) * 58;
        const y = cy + Math.sin(a) * 58;
        const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
        t.setAttribute("x", x);
        t.setAttribute("y", y);
        t.textContent = h;
        nums.appendChild(t);
    }
}

function updateClock() {
    const hourHand = document.getElementById("hand-hour");
    const minHand = document.getElementById("hand-minute");
    const secHand = document.getElementById("hand-second");
    const sweep = document.getElementById("clock-sweep");
    if (!hourHand || !minHand || !secHand || !sweep) {
        return;
    }
    const elapsed = data.current ? (Date.now() - data.current.startedAt) : 0;
    const seconds = elapsed / 1000;
    const minutes = seconds / 60;
    const hours = minutes / 60;
    const secDeg = (seconds % 60) * 6;
    const minDeg = (minutes % 60) * 6;
    const hourDeg = (hours % 12) * 30;
    secHand.style.transform = "rotate(" + secDeg + "deg)";
    minHand.style.transform = "rotate(" + minDeg + "deg)";
    hourHand.style.transform = "rotate(" + hourDeg + "deg)";

    if (!data.current || minutes < 0.01) {
        sweep.setAttribute("d", "");
        sweep.setAttribute("opacity", "0");
        return;
    }
    const cx = 100;
    const cy = 100;
    const r = 80;
    const minIn = minutes % 60;
    const angle = (minIn / 60) * Math.PI * 2 - Math.PI / 2;
    const ex = cx + Math.cos(angle) * r;
    const ey = cy + Math.sin(angle) * r;
    const largeArc = minIn > 30 ? 1 : 0;
    const path = "M " + cx + " " + cy + " L " + cx + " " + (cy - r) + " A " + r + " " + r + " 0 " + largeArc + " 1 " + ex + " " + ey + " Z";
    sweep.setAttribute("d", path);
    sweep.setAttribute("opacity", "0.22");
}

function renderQuickStart() {
    const grid = document.getElementById("activity-grid");
    grid.innerHTML = "";
    if (data.activities.length === 0) {
        const hint = document.createElement("div");
        hint.className = "empty-hint";
        hint.textContent = "No activities yet — head to the Activities tab to add some! 🎨";
        grid.appendChild(hint);
        return;
    }
    data.activities.forEach((act) => {
        const type = findType(act.typeId);
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "activity-chip";
        if (data.current && data.current.activityId === act.id) {
            chip.classList.add("active");
        }
        if (type) {
            chip.style.borderTopColor = type.color;
        }
        chip.innerHTML = '<span class="activity-chip-emoji">' + (act.emoji || "⏳") + '</span><span>' + escapeHtml(act.name) + '</span>';
        chip.addEventListener("click", () => {
            if (data.current && data.current.activityId === act.id) {
                stopTimer();
            } else {
                startTimer(act.id);
            }
        });
        grid.appendChild(chip);
    });
}

// Rendering: Activities tab
function renderActivitiesTab() {
    renderTypesList();
    renderActivitiesList();
}

function renderTypesList() {
    const list = document.getElementById("types-list");
    list.innerHTML = "";
    if (data.types.length === 0) {
        const empty = document.createElement("div");
        empty.className = "empty-hint";
        empty.textContent = "Add a type to group your activities!";
        list.appendChild(empty);
        return;
    }
    data.types.forEach((type) => {
        const count = data.activities.filter((a) => a.typeId === type.id).length;
        const row = document.createElement("div");
        row.className = "list-row";
        row.innerHTML =
            '<div class="swatch" style="background:' + type.color + '">' + (type.emoji || "🏷️") + '</div>' +
            '<div class="row-info">' +
                '<div class="row-title">' + escapeHtml(type.name) + '</div>' +
                '<div class="row-sub">' + count + ' ' + (count === 1 ? "activity" : "activities") + '</div>' +
            '</div>' +
            '<div class="row-actions">' +
                '<button class="btn-icon" data-edit-type="' + type.id + '" title="Edit">✏️</button>' +
                '<button class="btn-icon" data-del-type="' + type.id + '" title="Delete">🗑️</button>' +
            '</div>';
        list.appendChild(row);
    });
    list.querySelectorAll("[data-edit-type]").forEach((b) => {
        b.addEventListener("click", () => openTypeModal(b.dataset.editType));
    });
    list.querySelectorAll("[data-del-type]").forEach((b) => {
        b.addEventListener("click", () => deleteType(b.dataset.delType));
    });
}

function renderActivitiesList() {
    const list = document.getElementById("activities-list");
    list.innerHTML = "";
    if (data.activities.length === 0) {
        const empty = document.createElement("div");
        empty.className = "empty-hint";
        empty.textContent = "No activities yet! Tap the button below to add one.";
        list.appendChild(empty);
        return;
    }
    data.activities.forEach((act) => {
        const type = findType(act.typeId);
        const row = document.createElement("div");
        row.className = "list-row";
        const swatchColor = type ? type.color : "#ddd";
        const typeName = type ? type.name : "Unsorted";
        row.innerHTML =
            '<div class="swatch" style="background:' + swatchColor + '">' + (act.emoji || "⏳") + '</div>' +
            '<div class="row-info">' +
                '<div class="row-title">' + escapeHtml(act.name) + '</div>' +
                '<div class="row-sub">' + escapeHtml(typeName) + '</div>' +
            '</div>' +
            '<div class="row-actions">' +
                '<button class="btn-icon" data-edit-act="' + act.id + '" title="Edit">✏️</button>' +
                '<button class="btn-icon" data-del-act="' + act.id + '" title="Delete">🗑️</button>' +
            '</div>';
        list.appendChild(row);
    });
    list.querySelectorAll("[data-edit-act]").forEach((b) => {
        b.addEventListener("click", () => openActivityModal(b.dataset.editAct));
    });
    list.querySelectorAll("[data-del-act]").forEach((b) => {
        b.addEventListener("click", () => deleteActivity(b.dataset.delAct));
    });
}

function deleteType(id) {
    const inUse = data.activities.some((a) => a.typeId === id);
    if (inUse) {
        if (!confirm("This type has activities. Delete it anyway? Activities will become unsorted.")) {
            return;
        }
        data.activities.forEach((a) => {
            if (a.typeId === id) {
                a.typeId = null;
            }
        });
    } else {
        if (!confirm("Delete this type?")) {
            return;
        }
    }
    data.types = data.types.filter((t) => t.id !== id);
    saveData();
    renderActivitiesTab();
    renderQuickStart();
    renderStats();
}

function deleteActivity(id) {
    const hasSessions = data.sessions.some((s) => s.activityId === id);
    let msg = "Delete this activity?";
    if (hasSessions) {
        msg = "Delete this activity and all its tracked sessions?";
    }
    if (!confirm(msg)) {
        return;
    }
    if (data.current && data.current.activityId === id) {
        data.current = null;
        stopTick();
    }
    data.activities = data.activities.filter((a) => a.id !== id);
    data.sessions = data.sessions.filter((s) => s.activityId !== id);
    saveData();
    renderActivitiesTab();
    renderQuickStart();
    renderTimer();
    renderStats();
}

// Modal
let modalState = null;

function openTypeModal(id) {
    const existing = id ? findType(id) : null;
    modalState = {
        kind: "type",
        id: existing ? existing.id : null,
        name: existing ? existing.name : "",
        color: existing ? existing.color : COLOR_CHOICES[0],
        emoji: existing ? existing.emoji : "🏷️"
    };
    renderModal();
}

function openActivityModal(id) {
    const existing = id ? findActivity(id) : null;
    modalState = {
        kind: "activity",
        id: existing ? existing.id : null,
        name: existing ? existing.name : "",
        typeId: existing ? existing.typeId : (data.types[0] ? data.types[0].id : null),
        emoji: existing ? existing.emoji : "⏳"
    };
    renderModal();
}

function renderModal() {
    const modal = document.getElementById("modal");
    const title = document.getElementById("modal-title");
    const body = document.getElementById("modal-body");
    if (!modalState) {
        modal.hidden = true;
        return;
    }
    modal.hidden = false;
    if (modalState.kind === "type") {
        title.textContent = (modalState.id ? "Edit" : "New") + " type";
        body.innerHTML =
            '<div class="field"><label>Name</label><input id="m-name" type="text" placeholder="e.g., Hobbies" value="' + escapeAttr(modalState.name) + '" /></div>' +
            '<div class="field"><label>Emoji</label><div class="emoji-picker" id="m-emoji"></div></div>' +
            '<div class="field"><label>Color</label><div class="color-picker" id="m-color"></div></div>';
        buildEmojiPicker("m-emoji", modalState.emoji, (e) => { modalState.emoji = e; });
        buildColorPicker("m-color", modalState.color, (c) => { modalState.color = c; });
    } else {
        title.textContent = (modalState.id ? "Edit" : "New") + " activity";
        const opts = data.types.map((t) =>
            '<option value="' + t.id + '"' + (t.id === modalState.typeId ? " selected" : "") + '>' + escapeHtml(t.emoji + " " + t.name) + '</option>'
        ).join("");
        body.innerHTML =
            '<div class="field"><label>Name</label><input id="m-name" type="text" placeholder="e.g., Piano practice" value="' + escapeAttr(modalState.name) + '" /></div>' +
            '<div class="field"><label>Emoji</label><div class="emoji-picker" id="m-emoji"></div></div>' +
            '<div class="field"><label>Type</label><select id="m-type">' + (opts || '<option value="">— none —</option>') + '</select></div>';
        buildEmojiPicker("m-emoji", modalState.emoji, (e) => { modalState.emoji = e; });
    }
    setTimeout(() => {
        const inp = document.getElementById("m-name");
        if (inp) {
            inp.focus();
        }
    }, 50);
}

function buildEmojiPicker(containerId, selected, onPick) {
    const c = document.getElementById(containerId);
    c.innerHTML = "";
    EMOJI_CHOICES.forEach((e) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "emoji-option" + (e === selected ? " selected" : "");
        b.textContent = e;
        b.addEventListener("click", () => {
            c.querySelectorAll(".emoji-option").forEach((x) => x.classList.remove("selected"));
            b.classList.add("selected");
            onPick(e);
        });
        c.appendChild(b);
    });
}

function buildColorPicker(containerId, selected, onPick) {
    const c = document.getElementById(containerId);
    c.innerHTML = "";
    COLOR_CHOICES.forEach((col) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "color-option" + (col === selected ? " selected" : "");
        b.style.background = col;
        b.addEventListener("click", () => {
            c.querySelectorAll(".color-option").forEach((x) => x.classList.remove("selected"));
            b.classList.add("selected");
            onPick(col);
        });
        c.appendChild(b);
    });
}

function saveModal() {
    if (!modalState) {
        return;
    }
    const nameInput = document.getElementById("m-name");
    const name = nameInput ? nameInput.value.trim() : "";
    if (!name) {
        toast("Give it a name first ✏️");
        nameInput.focus();
        return;
    }
    if (modalState.kind === "type") {
        if (modalState.id) {
            const t = findType(modalState.id);
            t.name = name;
            t.color = modalState.color;
            t.emoji = modalState.emoji;
        } else {
            data.types.push({
                id: uid("t"),
                name,
                color: modalState.color,
                emoji: modalState.emoji
            });
        }
    } else {
        const typeSel = document.getElementById("m-type");
        const typeId = typeSel ? typeSel.value || null : null;
        if (modalState.id) {
            const a = findActivity(modalState.id);
            a.name = name;
            a.emoji = modalState.emoji;
            a.typeId = typeId;
        } else {
            data.activities.push({
                id: uid("a"),
                name,
                typeId,
                emoji: modalState.emoji
            });
        }
    }
    saveData();
    modalState = null;
    renderModal();
    renderActivitiesTab();
    renderQuickStart();
    renderStats();
}

function closeModal() {
    modalState = null;
    renderModal();
}

// Stats
let currentRange = "today";

function startOfRange(range) {
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (range === "today") {
        return d.getTime();
    }
    if (range === "week") {
        const day = d.getDay();
        const diff = (day + 6) % 7;
        d.setDate(d.getDate() - diff);
        return d.getTime();
    }
    if (range === "month") {
        return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    }
    return 0;
}

function getSessionsInRange() {
    const start = startOfRange(currentRange);
    const list = data.sessions.filter((s) => s.endedAt >= start);
    if (data.current) {
        list.push({
            id: "current",
            activityId: data.current.activityId,
            startedAt: data.current.startedAt,
            endedAt: Date.now(),
            durationMs: Date.now() - data.current.startedAt
        });
    }
    return list;
}

function renderStats() {
    const sessions = getSessionsInRange();
    const total = sessions.reduce((acc, s) => acc + s.durationMs, 0);

    const summary = document.getElementById("stats-summary");
    summary.innerHTML =
        '<div class="summary-label">Total tracked</div>' +
        '<div class="summary-value">' + fmtDuration(total) + '</div>';

    const byType = new Map();
    const byAct = new Map();
    sessions.forEach((s) => {
        const act = findActivity(s.activityId);
        if (!act) {
            return;
        }
        byAct.set(act.id, (byAct.get(act.id) || 0) + s.durationMs);
        const typeId = act.typeId || "_none";
        byType.set(typeId, (byType.get(typeId) || 0) + s.durationMs);
    });

    renderBars("stats-types", Array.from(byType.entries()).map(([id, ms]) => {
        const t = findType(id);
        return {
            label: t ? (t.emoji + " " + t.name) : "🏷️ Unsorted",
            color: t ? t.color : "#ccc",
            ms
        };
    }), total);

    renderBars("stats-activities", Array.from(byAct.entries()).map(([id, ms]) => {
        const a = findActivity(id);
        const t = a ? findType(a.typeId) : null;
        return {
            label: (a ? (a.emoji + " " + a.name) : "⏳ —"),
            color: t ? t.color : "#ffb37a",
            ms
        };
    }), total);

    renderSessionsList(sessions);
}

function renderBars(containerId, rows, total) {
    const c = document.getElementById(containerId);
    c.innerHTML = "";
    if (rows.length === 0) {
        const empty = document.createElement("div");
        empty.className = "empty-hint";
        empty.textContent = "Nothing here yet — go track something! ⏳";
        c.appendChild(empty);
        return;
    }
    rows.sort((a, b) => b.ms - a.ms);
    rows.forEach((r) => {
        const pct = total > 0 ? (r.ms / total) * 100 : 0;
        const row = document.createElement("div");
        row.className = "bar-row";
        row.innerHTML =
            '<div class="bar-head"><span>' + escapeHtml(r.label) + '</span><span>' + fmtDurationShort(r.ms) + '</span></div>' +
            '<div class="bar-track"><div class="bar-fill" style="width:' + pct.toFixed(1) + '%;background:linear-gradient(90deg,' + r.color + ',' + r.color + 'cc)"></div></div>';
        c.appendChild(row);
    });
}

function renderSessionsList(sessions) {
    const list = document.getElementById("sessions-list");
    list.innerHTML = "";
    const recent = sessions
        .filter((s) => s.id !== "current")
        .slice()
        .sort((a, b) => b.endedAt - a.endedAt)
        .slice(0, 12);
    if (recent.length === 0) {
        const empty = document.createElement("div");
        empty.className = "empty-hint";
        empty.textContent = "No sessions in this range yet.";
        list.appendChild(empty);
        return;
    }
    recent.forEach((s) => {
        const act = findActivity(s.activityId);
        const when = new Date(s.startedAt);
        const row = document.createElement("div");
        row.className = "session-row";
        row.innerHTML =
            '<span class="session-emoji">' + (act ? act.emoji : "⏳") + '</span>' +
            '<div class="session-info">' +
                '<div class="session-title">' + escapeHtml(act ? act.name : "Deleted") + '</div>' +
                '<div class="session-time">' + fmtWhen(when) + '</div>' +
            '</div>' +
            '<div class="session-dur">' + fmtDurationShort(s.durationMs) + '</div>';
        list.appendChild(row);
    });
}

function fmtWhen(d) {
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    if (sameDay) {
        return "Today, " + time;
    }
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    if (d.toDateString() === y.toDateString()) {
        return "Yesterday, " + time;
    }
    return d.toLocaleDateString([], { month: "short", day: "numeric" }) + ", " + time;
}

// Tab switching
function switchTab(name) {
    document.querySelectorAll(".tab").forEach((el) => el.classList.remove("active"));
    document.getElementById("tab-" + name).classList.add("active");
    document.querySelectorAll(".tab-btn").forEach((b) => {
        b.classList.toggle("active", b.dataset.tab === name);
    });
    if (name === "activities") {
        renderActivitiesTab();
    }
    if (name === "stats") {
        renderStats();
    }
}

// Toast & confetti
function toast(msg) {
    const t = document.getElementById("toast");
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(t._hide);
    t._hide = setTimeout(() => { t.hidden = true; }, 2000);
}

function confetti() {
    const colors = ["#ffb37a", "#ff9ec7", "#8ec5ff", "#9be7c4", "#ffe27a"];
    const rect = document.getElementById("btn-start-stop").getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    for (let i = 0; i < 18; i++) {
        const piece = document.createElement("div");
        piece.className = "confetti-piece";
        piece.style.background = colors[i % colors.length];
        piece.style.left = cx + "px";
        piece.style.top = cy + "px";
        const angle = (Math.PI * 2 * i) / 18;
        const dx = Math.cos(angle) * (60 + Math.random() * 40);
        const dy = Math.sin(angle) * (60 + Math.random() * 40);
        piece.animate(
            [
                { transform: "translate(0,0) rotate(0deg)", opacity: 1 },
                { transform: "translate(" + dx + "px," + (dy + 80) + "px) rotate(720deg)", opacity: 0 }
            ],
            { duration: 900 + Math.random() * 300, easing: "cubic-bezier(0.2,0.7,0.3,1)" }
        );
        document.body.appendChild(piece);
        setTimeout(() => piece.remove(), 1300);
    }
}

// Helpers
function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    }[c]));
}

function escapeAttr(s) {
    return escapeHtml(s);
}

// Wiring
function init() {
    document.getElementById("btn-start-stop").addEventListener("click", () => {
        if (data.current) {
            stopTimer();
            return;
        }
        if (data.activities.length === 0) {
            toast("Add an activity first 🎨");
            switchTab("activities");
            return;
        }
        startTimer(data.activities[0].id);
    });

    document.querySelectorAll(".tab-btn").forEach((b) => {
        b.addEventListener("click", () => switchTab(b.dataset.tab));
    });

    document.getElementById("btn-add-type").addEventListener("click", () => openTypeModal(null));
    document.getElementById("btn-add-activity").addEventListener("click", () => {
        if (data.types.length === 0) {
            toast("Make a type first 🏷️");
            return;
        }
        openActivityModal(null);
    });

    document.getElementById("modal-save").addEventListener("click", saveModal);
    document.getElementById("modal-cancel").addEventListener("click", closeModal);
    document.getElementById("modal").addEventListener("click", (e) => {
        if (e.target.id === "modal") {
            closeModal();
        }
    });

    document.querySelectorAll(".range-btn").forEach((b) => {
        b.addEventListener("click", () => {
            currentRange = b.dataset.range;
            document.querySelectorAll(".range-btn").forEach((x) => x.classList.remove("active"));
            b.classList.add("active");
            renderStats();
        });
    });

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && modalState) {
            closeModal();
        }
    });

    buildClockFace();
    renderTimer();
    renderQuickStart();
    if (data.current) {
        startTick();
    }

    if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register("service-worker.js").catch(() => {});
    }
}

document.addEventListener("DOMContentLoaded", init);
