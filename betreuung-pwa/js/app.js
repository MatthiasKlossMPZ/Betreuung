const STORAGE_KEY = "betreuung-pwa-v1";

const STATUS = {
  present: { label: "Noch da", short: "Da" },
  picked_up: { label: "Abgeholt", short: "Abgeh." },
  sick: { label: "Krank", short: "Krank" },
  absent: { label: "Nicht da", short: "Fehlt" },
  alone: { label: "Alleine gegangen", short: "Alleine" }
};

const DAYS = [
  { key: 1, short: "Mo", long: "Montag" },
  { key: 2, short: "Di", long: "Dienstag" },
  { key: 3, short: "Mi", long: "Mittwoch" },
  { key: 4, short: "Do", long: "Donnerstag" },
  { key: 5, short: "Fr", long: "Freitag" }
];

const DEMO_STUDENTS = [
  { firstName: "Emma", lastName: "Berger", className: "2a", grade: 2, needsSupervision: true, mayLeaveAlone: false, notes: "Wird i. d. R. von der Mutter abgeholt", authorized: "Lisa Berger, Oma Helga" },
  { firstName: "Ben", lastName: "Hoffmann", className: "2a", grade: 2, needsSupervision: true, mayLeaveAlone: false, notes: "", authorized: "Markus Hoffmann" },
  { firstName: "Mia", lastName: "Schulte", className: "1b", grade: 1, needsSupervision: true, mayLeaveAlone: false, notes: "Nussallergie", authorized: "Eltern, Tante Pia" },
  { firstName: "Leon", lastName: "Krüger", className: "3a", grade: 3, needsSupervision: true, mayLeaveAlone: true, notes: "Darf ab 15:30 alleine gehen", authorized: "" },
  { firstName: "Sofia", lastName: "Yilmaz", className: "1a", grade: 1, needsSupervision: true, mayLeaveAlone: false, notes: "", authorized: "Elif Yilmaz" },
  { firstName: "Paul", lastName: "Wagner", className: "4b", grade: 4, needsSupervision: false, mayLeaveAlone: true, notes: "Keine Betreuungspflicht mehr", authorized: "" }
];

function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2);
}

function todayISO(d = new Date()) {
  const tz = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return tz.toISOString().slice(0, 10);
}

function parseISO(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function addDays(iso, n) {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return todayISO(d);
}

function mondayOf(iso) {
  const d = parseISO(iso);
  const day = d.getDay() || 7;
  d.setDate(d.getDate() - day + 1);
  return todayISO(d);
}

function formatLong(iso) {
  return parseISO(iso).toLocaleDateString("de-DE", {
    weekday: "long", day: "numeric", month: "long"
  });
}

function formatShort(iso) {
  return parseISO(iso).toLocaleDateString("de-DE", {
    weekday: "short", day: "numeric", month: "numeric"
  });
}

function nowTime() {
  return new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function save(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function createState() {
  return {
    schoolName: "Meine Schule",
    students: [],
    days: {},
    demoLoaded: false,
    sortBy: "lastName"
  };
}

const state = load() || createState();

const ui = {
  view: "today",
  date: todayISO(),
  filter: "remaining",
  query: "",
  editingId: null,
  sortBy: state.sortBy || "lastName"
};

const STATUS_ORDER = { present: 0, picked_up: 1, alone: 2, sick: 3, absent: 4, off: 5 };

function cmpText(a, b) {
  return String(a || "").localeCompare(String(b || ""), "de", { numeric: true, sensitivity: "base" });
}

function compareStudents(a, b, date = ui.date) {
  const key = ui.sortBy || "lastName";
  let r = 0;
  if (key === "firstName") r = cmpText(a.firstName, b.firstName) || cmpText(a.lastName, b.lastName);
  else if (key === "className") r = cmpText(a.className, b.className) || cmpText(a.lastName, b.lastName);
  else if (key === "grade") r = (Number(a.grade) || 99) - (Number(b.grade) || 99) || cmpText(a.className, b.className) || cmpText(a.lastName, b.lastName);
  else if (key === "status") {
    const sa = entry(date, a.id).status || "present";
    const sb = entry(date, b.id).status || "present";
    r = (STATUS_ORDER[sa] ?? 9) - (STATUS_ORDER[sb] ?? 9) || cmpText(a.lastName, b.lastName);
  } else {
    r = cmpText(a.lastName, b.lastName) || cmpText(a.firstName, b.firstName);
  }
  return r || cmpText(a.firstName, b.firstName);
}

function sortedStudents(list, date = ui.date) {
  return [...list].sort((a, b) => compareStudents(a, b, date));
}

function setSort(value) {
  ui.sortBy = value;
  state.sortBy = value;
  save(state);
  render();
}

function sortSelectHtml() {
  const opts = [
    ["lastName", "Nachname"],
    ["firstName", "Vorname"],
    ["className", "Klasse"],
    ["grade", "Jahrgang"],
    ["status", "Status"]
  ];
  return `<label class="sort-wrap">Sortierung
    <select id="sort-by" class="sort-select">
      ${opts.map(([v, l]) => `<option value="${v}" ${ui.sortBy === v ? "selected" : ""}>${l}</option>`).join("")}
    </select>
  </label>`;
}

function bindSort() {
  const sel = document.getElementById("sort-by");
  if (sel) sel.onchange = (e) => setSort(e.target.value);
}

function entry(date, studentId) {
  if (!state.days[date]) state.days[date] = {};
  if (!state.days[date][studentId]) {
    const s = state.students.find((x) => x.id === studentId);
    const weekend = [0, 6].includes(parseISO(date).getDay());
    state.days[date][studentId] = {
      status: weekend || (s && s.needsSupervision === false) ? "absent" : "present",
      time: "",
      note: "",
      updatedAt: null
    };
    if (weekend || (s && s.needsSupervision === false)) {
      // keep default absent / no duty
    }
    if (s && s.needsSupervision === false) {
      state.days[date][studentId].status = "off";
    }
  }
  return state.days[date][studentId];
}

function supervisedStudents() {
  return state.students.filter((s) => s.needsSupervision !== false);
}

function counts(date) {
  const list = supervisedStudents();
  const c = { present: 0, picked_up: 0, sick: 0, absent: 0, alone: 0, off: 0, remaining: 0, total: list.length };
  for (const s of list) {
    const e = entry(date, s.id);
    const st = e.status || "present";
    if (c[st] !== undefined) c[st]++;
    if (st === "present") c.remaining++;
  }
  return c;
}

function setStatus(studentId, status, date = ui.date) {
  const e = entry(date, studentId);
  e.status = status;
  e.time = status === "picked_up" || status === "alone" ? nowTime() : e.time;
  if (status === "present") e.time = "";
  e.updatedAt = new Date().toISOString();
  save(state);
  render();
}

function setNote(studentId, note, date = ui.date) {
  const e = entry(date, studentId);
  e.note = note;
  save(state);
}

function loadDemo() {
  state.students = DEMO_STUDENTS.map((s) => ({ ...s, id: uid() }));
  state.demoLoaded = true;
  state.schoolName = state.schoolName || "Beispielschule";
  save(state);
  render();
}

function upsertStudent(data) {
  if (data.id) {
    const i = state.students.findIndex((s) => s.id === data.id);
    if (i >= 0) state.students[i] = { ...state.students[i], ...data };
  } else {
    state.students.push({ ...data, id: uid() });
  }
  state.students.sort((a, b) =>
    (a.lastName + a.firstName).localeCompare(b.lastName + b.firstName, "de")
  );
  save(state);
  render();
}

function deleteStudent(id) {
  state.students = state.students.filter((s) => s.id !== id);
  save(state);
  render();
}

function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `betreuung-backup-${todayISO()}.json`;
  a.click();
}

function exportCsv(date) {
  const rows = [["Datum", "Nachname", "Vorname", "Klasse", "Status", "Uhrzeit", "Notiz"]];
  for (const s of state.students) {
    const e = entry(date, s.id);
    rows.push([
      date,
      s.lastName,
      s.firstName,
      s.className || "",
      STATUS[e.status]?.label || e.status,
      e.time || "",
      e.note || ""
    ]);
  }
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `betreuung-${date}.csv`;
  a.click();
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data.students) throw new Error("Ungültige Datei");
      state.schoolName = data.schoolName || state.schoolName;
      state.students = data.students || [];
      state.days = data.days || {};
      save(state);
      render();
    } catch (err) {
      alert("Import fehlgeschlagen: " + err.message);
    }
  };
  reader.readAsText(file);
}

function truthy(v) {
  const s = String(v || "").trim().toLowerCase();
  return ["1", "ja", "yes", "true", "x", "wahr", "j"].includes(s);
}

function parseCsv(text) {
  const raw = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const firstLine = raw.split("\n").find((l) => l.trim()) || "";
  const delim = (firstLine.split(";").length > firstLine.split(",").length) ? ";" : ",";
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (inQuotes) {
      if (ch === '"') {
        if (raw[i + 1] === '"') { cell += '"'; i++; }
        else inQuotes = false;
      } else cell += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delim) {
      row.push(cell); cell = "";
    } else if (ch === "\n") {
      row.push(cell); cell = "";
      if (row.some((c) => String(c).trim() !== "")) rows.push(row);
      row = [];
    } else cell += ch;
  }
  if (cell.length || row.length) {
    row.push(cell);
    if (row.some((c) => String(c).trim() !== "")) rows.push(row);
  }
  return rows;
}

function normalizeHeader(h) {
  return String(h || "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/ä/g, "a").replace(/ö/g, "o").replace(/ü/g, "u").replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function mapStudentRow(obj) {
  const get = (...keys) => {
    for (const k of keys) {
      if (obj[k] !== undefined && obj[k] !== "") return obj[k];
    }
    return "";
  };
  const firstName = String(get("vorname", "first name", "firstname", "name")).trim();
  let lastName = String(get("nachname", "familienname", "last name", "lastname", "surname")).trim();
  const full = String(get("name", "schuler", "schueler", "kind")).trim();
  if (!firstName && full) {
    const parts = full.split(/\s+/);
    return nullIfEmpty({
      firstName: parts.slice(0, -1).join(" ") || parts[0],
      lastName: parts.length > 1 ? parts.slice(-1).join(" ") : "",
      className: String(get("klasse", "class", "gruppe")).trim(),
      grade: parseInt(String(get("jahrgang", "klassenstufe", "stufe", "grade")), 10) || "",
      needsSupervision: !["nein", "no", "0", "false"].includes(String(get("betreuungspflicht", "aufsichtspflicht", "betreuung")).trim().toLowerCase()),
      mayLeaveAlone: truthy(get("darf alleine gehen", "alleine", "alleingeher")),
      authorized: String(get("abholberechtigte", "abholen", "berechtigte")).trim(),
      notes: String(get("hinweise", "notiz", "notizen", "bemerkung", "bemerkungen")).trim()
    });
  }
  return nullIfEmpty({
    firstName,
    lastName,
    className: String(get("klasse", "class", "gruppe")).trim(),
    grade: parseInt(String(get("jahrgang", "klassenstufe", "stufe", "grade")), 10) || "",
    needsSupervision: (() => {
      const raw = String(get("betreuungspflicht", "aufsichtspflicht", "betreuung")).trim();
      if (!raw) return true;
      return !["nein", "no", "0", "false"].includes(raw.toLowerCase());
    })(),
    mayLeaveAlone: truthy(get("darf alleine gehen", "alleine", "alleingeher")),
    authorized: String(get("abholberechtigte", "abholen", "berechtigte")).trim(),
    notes: String(get("hinweise", "notiz", "notizen", "bemerkung", "bemerkungen")).trim()
  });
}

function nullIfEmpty(s) {
  if (!s.firstName && !s.lastName) return null;
  if (!s.firstName) { s.firstName = s.lastName; s.lastName = ""; }
  return s;
}

function studentKey(s) {
  return `${(s.lastName || "").trim().toLowerCase()}|${(s.firstName || "").trim().toLowerCase()}|${(s.className || "").trim().toLowerCase()}`;
}

function importStudentsFromText(text, mode) {
  const rows = parseCsv(text);
  if (rows.length < 2) throw new Error("Die Datei enthält keine Datenzeilen.");
  const headers = rows[0].map(normalizeHeader);
  const imported = [];
  for (const row of rows.slice(1)) {
    const obj = {};
    headers.forEach((h, i) => { if (h) obj[h] = row[i] ?? ""; });
    const s = mapStudentRow(obj);
    if (s) imported.push(s);
  }
  if (!imported.length) throw new Error("Keine gültigen Namen gefunden. Erwartet werden Spalten wie Vorname und Nachname.");

  if (mode === "replace") {
    state.students = imported.map((s) => ({ ...s, id: uid() }));
  } else {
    const existing = new Map(state.students.map((s) => [studentKey(s), s]));
    for (const s of imported) {
      const prev = existing.get(studentKey(s));
      if (prev) Object.assign(prev, s);
      else {
        const created = { ...s, id: uid() };
        state.students.push(created);
        existing.set(studentKey(s), created);
      }
    }
  }
  state.students.sort((a, b) =>
    (a.lastName + a.firstName).localeCompare(b.lastName + b.firstName, "de")
  );
  save(state);
  return imported.length;
}

function importStudentFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const text = reader.result;
      if (file.name.toLowerCase().endsWith(".json") || text.trim().startsWith("{")) {
        const data = JSON.parse(text);
        const list = Array.isArray(data) ? data : data.students;
        if (!list) throw new Error("JSON ohne Schülerliste");
        const mode = confirm("OK = zur bestehenden Liste hinzufügen / aktualisieren.\nAbbrechen = bestehende Liste ersetzen.") ? "merge" : "replace";
        if (mode === "replace") {
          state.students = list.map((s) => ({ ...s, id: s.id || uid() }));
        } else {
          const existing = new Map(state.students.map((s) => [studentKey(s), s]));
          for (const raw of list) {
            const s = {
              firstName: raw.firstName || "",
              lastName: raw.lastName || "",
              className: raw.className || "",
              grade: raw.grade || "",
              needsSupervision: raw.needsSupervision !== false,
              mayLeaveAlone: !!raw.mayLeaveAlone,
              authorized: raw.authorized || "",
              notes: raw.notes || ""
            };
            const prev = existing.get(studentKey(s));
            if (prev) Object.assign(prev, s);
            else {
              const created = { ...s, id: raw.id || uid() };
              state.students.push(created);
              existing.set(studentKey(s), created);
            }
          }
          state.students.sort((a, b) =>
            (a.lastName + a.firstName).localeCompare(b.lastName + b.firstName, "de")
          );
        }
        save(state);
        render();
        alert(`${list.length} Einträge übernommen.`);
        return;
      }
      const mode = confirm("OK = vorhandene Kinder behalten und neue ergänzen bzw. gleiche Namen aktualisieren.\nAbbrechen = komplette Liste ersetzen.") ? "merge" : "replace";
      const n = importStudentsFromText(text, mode);
      render();
      alert(`${n} Schüler/innen importiert.`);
    } catch (err) {
      alert("Schülerimport fehlgeschlagen: " + err.message);
    }
  };
  reader.readAsText(file);
}

function exportStudentCsv() {
  const rows = [["Vorname", "Nachname", "Klasse", "Jahrgang", "Betreuungspflicht", "Darf alleine gehen", "Abholberechtigte", "Hinweise"]];
  for (const s of state.students) {
    rows.push([
      s.firstName || "",
      s.lastName || "",
      s.className || "",
      s.grade || "",
      s.needsSupervision === false ? "nein" : "ja",
      s.mayLeaveAlone ? "ja" : "nein",
      s.authorized || "",
      s.notes || ""
    ]);
  }
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `schuelerliste-${todayISO()}.csv`;
  a.click();
}

function downloadStudentTemplate() {
  const rows = [
    ["Vorname", "Nachname", "Klasse", "Jahrgang", "Betreuungspflicht", "Darf alleine gehen", "Abholberechtigte", "Hinweise"],
    ["Anna", "Muster", "2a", "2", "ja", "nein", "Eltern, Oma", ""],
    ["Jonas", "Beispiel", "3b", "3", "ja", "ja", "", "Darf ab 15:30 alleine"]
  ];
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "schuelerliste-vorlage.csv";
  a.click();
}

const FILTER_STATUSES = {
  remaining: ["present"],
  picked: ["picked_up", "alone"],
  sick: ["sick", "absent"],
  done: ["picked_up", "alone", "sick", "absent"]
};

function filteredStudents(date) {
  const q = ui.query.trim().toLowerCase();
  const allowed = FILTER_STATUSES[ui.filter];
  const list = state.students.filter((s) => {
    const e = entry(date, s.id);
    if (allowed && !allowed.includes(e.status)) return false;
    if (ui.filter === "supervised" && s.needsSupervision === false) return false;
    if (q) {
      const hay = `${s.firstName} ${s.lastName} ${s.className} ${s.notes || ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  return sortedStudents(list, date);
}

function renderHeader() {
  document.getElementById("school-sub").textContent = state.schoolName || "Wer ist noch da?";
  document.getElementById("date-label").textContent = formatShort(ui.date);
}

function renderToday() {
  const c = counts(ui.date);
  const remainingList = filteredStudents(ui.date);
  const allDone = c.remaining === 0 && c.total > 0;

  document.getElementById("view-today").innerHTML = `
    ${allDone ? `<div class="done-banner">Alle betreuungspflichtigen Kinder sind ausgetragen.</div>` : ""}
    <div class="stats">
      <button type="button" class="stat remain ${ui.filter === "remaining" ? "active" : ""}" data-filter="remaining">
        <div class="num">${c.remaining}</div>
        <div class="lbl">noch da · von ${c.total} betreuungspflichtig</div>
      </button>
      <button type="button" class="stat picked ${ui.filter === "picked" ? "active" : ""}" data-filter="picked">
        <div class="num">${c.picked_up + c.alone}</div>
        <div class="lbl">abgeholt / alleine · antippen</div>
      </button>
      <button type="button" class="stat sick ${ui.filter === "sick" ? "active" : ""}" data-filter="sick">
        <div class="num">${c.sick + c.absent}</div>
        <div class="lbl">krank / nicht da · antippen</div>
      </button>
    </div>
    <div class="toolbar">
      <button class="chip ${ui.filter === "remaining" ? "active" : ""}" data-filter="remaining">Noch da</button>
      <button class="chip ${ui.filter === "picked" ? "active" : ""}" data-filter="picked">Abgeholt</button>
      <button class="chip ${ui.filter === "sick" ? "active" : ""}" data-filter="sick">Krank</button>
      <button class="chip ${ui.filter === "all" ? "active" : ""}" data-filter="all">Alle</button>
      <input class="search" id="search" placeholder="Name oder Klasse …" value="${ui.query}">
      ${sortSelectHtml()}
    </div>
    ${state.students.length === 0 ? `
      <div class="empty">
        <h2>Noch keine Schülerliste</h2>
        <p>Lege Kinder an oder lade Beispieldaten, um die App auszuprobieren.</p>
        <p><button class="primary" id="btn-demo">Beispieldaten laden</button>
        <button class="ghost" data-nav="students">Schüler anlegen</button></p>
      </div>` : remainingList.length === 0 ? `
      <div class="empty"><p>Keine Einträge für diesen Filter.</p></div>
    ` : `<div class="list">${remainingList.map(studentCard).join("")}</div>`}
  `;

  document.querySelectorAll("[data-filter]").forEach((b) => {
    b.onclick = () => { ui.filter = b.dataset.filter; render(); };
  });
  const search = document.getElementById("search");
  if (search) {
    search.oninput = (e) => { ui.query = e.target.value; };
    search.onkeydown = (e) => { if (e.key === "Enter") render(); };
    search.onblur = () => render();
  }
  const demo = document.getElementById("btn-demo");
  if (demo) demo.onclick = loadDemo;
  bindSort();
  bindCards();
}

function studentCard(s) {
  const e = entry(ui.date, s.id);
  const st = e.status || "present";
  const statusLabel = st === "off" ? "keine Pflicht" : (STATUS[st]?.label || st);
  return `
    <article class="card ${st !== "present" ? "done" : ""}" data-id="${s.id}">
      <div class="card-top">
        <div>
          <div class="name">${s.firstName} ${s.lastName}</div>
          <div class="meta">${s.className || "ohne Klasse"}${s.mayLeaveAlone ? " · darf alleine gehen" : ""}${e.time ? " · " + e.time : ""}</div>
          ${s.authorized ? `<div class="meta">Abholen: ${s.authorized}</div>` : ""}
          ${s.notes ? `<div class="meta">${s.notes}</div>` : ""}
        </div>
        <span class="badge ${st}">${statusLabel}</span>
      </div>
      <div class="actions">
        <button class="act ${st === "present" ? "on-present" : ""}" data-status="present">Noch da</button>
        <button class="act ${st === "picked_up" ? "on-picked_up" : ""}" data-status="picked_up">Abgeholt</button>
        <button class="act ${st === "sick" ? "on-sick" : ""}" data-status="sick">Krank</button>
        <button class="act ${st === "alone" ? "on-alone" : ""}" data-status="alone">Alleine</button>
      </div>
      <div class="note-row">
        <input data-note placeholder="Kurznotiz, z. B. von Oma abgeholt" value="${(e.note || "").replace(/"/g, "&quot;")}">
        <button class="ghost" data-status="absent">Nicht da</button>
      </div>
    </article>
  `;
}

function bindCards() {
  document.querySelectorAll(".card").forEach((card) => {
    const id = card.dataset.id;
    card.querySelectorAll("[data-status]").forEach((btn) => {
      btn.onclick = () => setStatus(id, btn.dataset.status);
    });
    const note = card.querySelector("[data-note]");
    if (note) {
      note.onchange = () => setNote(id, note.value);
    }
  });
}

function renderWeek() {
  const mon = mondayOf(ui.date);
  const dates = [0, 1, 2, 3, 4].map((i) => addDays(mon, i));
  const list = sortedStudents(state.students.filter((s) => s.needsSupervision !== false));
  document.getElementById("view-week").innerHTML = `
    <div class="toolbar">
      <button class="ghost" id="week-prev">← Woche</button>
      <strong>${formatShort(dates[0])} – ${formatShort(dates[4])}</strong>
      <button class="ghost" id="week-next">Woche →</button>
      ${sortSelectHtml()}
    </div>
    ${list.length === 0 ? `<div class="empty"><p>Noch keine betreuungspflichtigen Schüler.</p></div>` : `
    <div class="week-grid">
      <div class="h">Kind</div>
      ${dates.map((d) => `<div class="h">${parseISO(d).toLocaleDateString("de-DE", { weekday: "short", day: "numeric" })}</div>`).join("")}
      ${list.map((s) => `
        <div class="n">${s.firstName} ${s.lastName}<div class="meta">${s.className || ""}</div></div>
        ${dates.map((d) => {
          const e = entry(d, s.id);
          const label = e.status === "present" ? "" : (STATUS[e.status]?.short || (e.status === "off" ? "—" : ""));
          return `<div class="c ${e.status}" data-sid="${s.id}" data-date="${d}" title="${STATUS[e.status]?.label || e.status}">${label}${e.time ? "<br>" + e.time : ""}</div>`;
        }).join("")}
      `).join("")}
    </div>
    <p class="hint">Tipp: Zelle antippen wechselt den Status für diesen Tag. Reihenfolge: Noch da → Abgeholt → Krank → Nicht da → Alleine → Noch da.</p>`}
  `;
  document.getElementById("week-prev").onclick = () => { ui.date = addDays(mon, -7); render(); };
  document.getElementById("week-next").onclick = () => { ui.date = addDays(mon, 7); render(); };
  bindSort();
  const cycle = ["present", "picked_up", "sick", "absent", "alone"];
  document.querySelectorAll(".week-grid .c").forEach((cell) => {
    cell.onclick = () => {
      const e = entry(cell.dataset.date, cell.dataset.sid);
      const i = cycle.indexOf(e.status);
      const next = cycle[(i + 1) % cycle.length];
      ui.date = cell.dataset.date;
      setStatus(cell.dataset.sid, next, cell.dataset.date);
    };
  });
}

function renderStudents() {
  document.getElementById("view-students").innerHTML = `
    <div class="toolbar">
      <button class="primary" id="btn-add">+ Schülerin / Schüler</button>
      <button class="ghost" id="btn-import-students">CSV importieren</button>
      <button class="ghost" id="btn-template">Vorlage</button>
      ${state.students.length ? `<button class="ghost" id="btn-export-students">Liste exportieren</button>` : `<button class="ghost" id="btn-demo2">Beispieldaten</button>`}
      <input type="file" id="file-students" accept=".csv,.txt,.json,text/csv,application/json" class="hidden">
      ${state.students.length ? sortSelectHtml() : ""}
    </div>
    <p class="hint">CSV aus Excel/LibreOffice: Vorlage laden, ausfüllen, speichern als CSV (Trennzeichen Semikolon). Pflichtspalten: Vorname, Nachname.</p>
    ${state.students.length === 0 ? `<div class="empty"><p>Die Liste ist leer.</p></div>` : `
      <div class="list">
        ${sortedStudents(state.students).map((s) => `
          <article class="card">
            <div class="student-item">
              <div>
                <div class="name">${s.firstName} ${s.lastName}</div>
                <div class="meta">${s.className || "ohne Klasse"} · Klasse ${s.grade || "?"} · ${s.needsSupervision === false ? "keine Aufsichtspflicht" : "betreuungspflichtig"}${s.mayLeaveAlone ? " · darf alleine" : ""}</div>
              </div>
              <div>
                <button class="ghost" data-edit="${s.id}">Bearbeiten</button>
              </div>
            </div>
          </article>
        `).join("")}
      </div>`}
  `;
  const add = document.getElementById("btn-add");
  if (add) add.onclick = () => openStudentModal();
  const demo = document.getElementById("btn-demo2");
  if (demo) demo.onclick = loadDemo;
  document.getElementById("btn-import-students").onclick = () => document.getElementById("file-students").click();
  document.getElementById("btn-template").onclick = downloadStudentTemplate;
  const exp = document.getElementById("btn-export-students");
  if (exp) exp.onclick = exportStudentCsv;
  document.getElementById("file-students").onchange = (e) => {
    if (e.target.files[0]) importStudentFile(e.target.files[0]);
    e.target.value = "";
  };
  document.querySelectorAll("[data-edit]").forEach((b) => {
    b.onclick = () => openStudentModal(b.dataset.edit);
  });
  bindSort();
}

function renderSettings() {
  document.getElementById("view-settings").innerHTML = `
    <div class="settings card form">
      <label>Name der Schule / Gruppe
        <input id="school-name" value="${(state.schoolName || "").replace(/"/g, "&quot;")}">
      </label>
      <p class="hint">Daten liegen nur auf diesem Gerät (localStorage). Für Tablets im Team: Backup exportieren und auf dem anderen Gerät importieren – oder die Dateien auf einem Schul-Webspace mit HTTPS ablegen.</p>
      <div class="toolbar">
        <button class="primary" id="btn-export">Backup (JSON)</button>
        <button class="ghost" id="btn-csv">Heute als CSV</button>
        <button class="ghost" id="btn-import">Backup importieren</button>
        <button class="ghost" id="btn-import-students-2">Schüler-CSV</button>
        <input type="file" id="file-import" accept="application/json" class="hidden">
        <input type="file" id="file-students-2" accept=".csv,.txt,.json,text/csv,application/json" class="hidden">
      </div>
      <button class="danger" id="btn-reset-day">Heutige Einträge zurücksetzen</button>
      <button class="danger" id="btn-reset-all">Alle Daten löschen</button>
      <p class="hint">PWA installieren: Im Browser „Zum Home-Bildschirm“ / „App installieren“ wählen. Danach funktioniert sie auch offline.</p>
    </div>
  `;
  document.getElementById("school-name").onchange = (e) => {
    state.schoolName = e.target.value.trim();
    save(state);
    renderHeader();
  };
  document.getElementById("btn-export").onclick = exportData;
  document.getElementById("btn-csv").onclick = () => exportCsv(ui.date);
  document.getElementById("btn-import").onclick = () => document.getElementById("file-import").click();
  document.getElementById("file-import").onchange = (e) => {
    if (e.target.files[0]) importData(e.target.files[0]);
  };
  document.getElementById("btn-import-students-2").onclick = () => document.getElementById("file-students-2").click();
  document.getElementById("file-students-2").onchange = (e) => {
    if (e.target.files[0]) importStudentFile(e.target.files[0]);
    e.target.value = "";
  };
  document.getElementById("btn-reset-day").onclick = () => {
    if (!confirm("Status von heute wirklich zurücksetzen?")) return;
    delete state.days[ui.date];
    save(state);
    render();
  };
  document.getElementById("btn-reset-all").onclick = () => {
    if (!confirm("Wirklich alles löschen? Schülerliste und Woche gehen verloren.")) return;
    localStorage.removeItem(STORAGE_KEY);
    Object.assign(state, createState());
    render();
  };
}

function openStudentModal(id) {
  const s = id ? state.students.find((x) => x.id === id) : {
    firstName: "", lastName: "", className: "", grade: "", needsSupervision: true, mayLeaveAlone: false, notes: "", authorized: ""
  };
  const modal = document.getElementById("modal");
  modal.classList.remove("hidden");
  modal.innerHTML = `
    <div class="modal">
      <h2>${id ? "Schüler bearbeiten" : "Neue/r Schüler/in"}</h2>
      <div class="form">
        <div class="row-2">
          <label>Vorname <input id="f-first" value="${s.firstName || ""}"></label>
          <label>Nachname <input id="f-last" value="${s.lastName || ""}"></label>
        </div>
        <div class="row-2">
          <label>Klasse <input id="f-class" value="${s.className || ""}" placeholder="2a"></label>
          <label>Jahrgang <input id="f-grade" type="number" min="1" max="13" value="${s.grade || ""}"></label>
        </div>
        <div class="checks">
          <label><input type="checkbox" id="f-need" ${s.needsSupervision !== false ? "checked" : ""}> Betreuungspflicht</label>
          <label><input type="checkbox" id="f-alone" ${s.mayLeaveAlone ? "checked" : ""}> darf alleine gehen</label>
        </div>
        <label>Abholberechtigte
          <input id="f-auth" value="${s.authorized || ""}" placeholder="Eltern, Oma …">
        </label>
        <label>Hinweise
          <textarea id="f-notes" rows="2">${s.notes || ""}</textarea>
        </label>
        <div class="toolbar">
          <button class="primary" id="f-save">Speichern</button>
          <button class="ghost" id="f-cancel">Abbrechen</button>
          ${id ? `<button class="danger" id="f-del">Löschen</button>` : ""}
        </div>
      </div>
    </div>
  `;
  document.getElementById("f-cancel").onclick = closeModal;
  modal.querySelector(".modal-bg")?.addEventListener("click", closeModal);
  document.getElementById("f-save").onclick = () => {
    const firstName = document.getElementById("f-first").value.trim();
    const lastName = document.getElementById("f-last").value.trim();
    if (!firstName || !lastName) { alert("Bitte Vor- und Nachname angeben."); return; }
    upsertStudent({
      id: s.id,
      firstName, lastName,
      className: document.getElementById("f-class").value.trim(),
      grade: Number(document.getElementById("f-grade").value) || "",
      needsSupervision: document.getElementById("f-need").checked,
      mayLeaveAlone: document.getElementById("f-alone").checked,
      authorized: document.getElementById("f-auth").value.trim(),
      notes: document.getElementById("f-notes").value.trim()
    });
    closeModal();
  };
  const del = document.getElementById("f-del");
  if (del) del.onclick = () => {
    if (confirm("Diese Person wirklich entfernen?")) {
      deleteStudent(s.id);
      closeModal();
    }
  };
}

function closeModal() {
  document.getElementById("modal").classList.add("hidden");
  document.getElementById("modal").innerHTML = "";
}

function render() {
  renderHeader();
  document.querySelectorAll("[data-view]").forEach((el) => {
    el.classList.toggle("hidden", el.dataset.view !== ui.view);
  });
  document.querySelectorAll(".nav button").forEach((b) => {
    b.classList.toggle("active", b.dataset.nav === ui.view);
  });
  if (ui.view === "today") renderToday();
  if (ui.view === "week") renderWeek();
  if (ui.view === "students") renderStudents();
  if (ui.view === "settings") renderSettings();
}

function init() {
  document.getElementById("prev-day").onclick = () => { ui.date = addDays(ui.date, -1); render(); };
  document.getElementById("next-day").onclick = () => { ui.date = addDays(ui.date, 1); render(); };
  document.getElementById("date-label").onclick = () => { ui.date = todayISO(); render(); };
  document.querySelectorAll(".nav button").forEach((b) => {
    b.onclick = () => { ui.view = b.dataset.nav; render(); };
  });
  document.body.addEventListener("click", (e) => {
    const nav = e.target.closest("[data-nav]");
    if (nav && nav.dataset.nav) {
      ui.view = nav.dataset.nav;
      render();
    }
  });
  document.getElementById("modal").addEventListener("click", (e) => {
    if (e.target.id === "modal") closeModal();
  });
  render();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
}

document.addEventListener("DOMContentLoaded", init);
