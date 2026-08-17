// 時刻一覧（紙の手帳形式）の描画と、行タップ時の入力シート。

import { getSortedLibrary } from "./library.js";

const STATUS_OPTIONS = ["完了", "一部完了", "未着手", "中止"];
const DURATION_OPTIONS = [
  { label: "自動", minutes: null },
  { label: "1時間", minutes: 60 },
  { label: "2時間", minutes: 120 },
  { label: "3時間", minutes: 180 },
  { label: "4時間", minutes: 240 },
];

export function computeRowTimes(settings) {
  const rows = [];
  const start = settings.dayStartHour * 60;
  const end = settings.dayEndHour * 60;
  for (let t = start; t < end; t += settings.stepMinutes) rows.push(minutesToClock(t));
  return rows;
}

export function minutesToClock(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function clockToMinutes(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

// 所要時間が指定された予定について、それが覆う後続の行時刻 → 起点の時刻、を返す
export function computeCoverage(entries, settings) {
  const filled = entries
    .filter((e) => e.content && e.content.trim())
    .slice()
    .sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));
  const rowTimes = computeRowTimes(settings);
  const coverage = new Map();

  filled.forEach((entry, i) => {
    if (!entry.durationMinutes) return;
    const startMin = clockToMinutes(entry.time);
    const inferredEndMin = i + 1 < filled.length ? clockToMinutes(filled[i + 1].time) : settings.dayEndHour * 60;
    const endMin = Math.min(startMin + entry.durationMinutes, inferredEndMin);
    rowTimes.forEach((t) => {
      const tm = clockToMinutes(t);
      if (tm > startMin && tm < endMin) coverage.set(t, entry.time);
    });
  });

  return coverage;
}

export function mountTimeline({ host, entries, settings, mode, onChange }) {
  const rowsEl = document.createElement("div");
  rowsEl.className = "timeline";
  host.appendChild(rowsEl);

  const sheet = buildSheet(mode);
  document.body.appendChild(sheet.root);

  let activeTime = null;

  function findEntry(time) {
    return entries.find((e) => e.time === time) || null;
  }

  function upsertEntry(time, patch) {
    const idx = entries.findIndex((e) => e.time === time);
    if (idx === -1) {
      entries.push({ time, content: "", status: null, note: "", durationMinutes: null, ...patch });
    } else {
      entries[idx] = { ...entries[idx], ...patch };
    }
  }

  function removeEntry(time) {
    const idx = entries.findIndex((e) => e.time === time);
    if (idx !== -1) entries.splice(idx, 1);
  }

  function renderRows() {
    rowsEl.innerHTML = "";
    const times = computeRowTimes(settings);
    const coverage = computeCoverage(entries, settings);
    times.forEach((time) => {
      const entry = findEntry(time);
      const coveredBy = coverage.get(time);
      const row = document.createElement("button");
      row.type = "button";

      if (coveredBy) {
        row.className = "timeline-row is-covered";
        row.innerHTML = `
          <span class="row-time">${time}</span>
          <span class="row-content covered-label">つづき</span>`;
        row.addEventListener("click", () => openSheet(coveredBy));
        rowsEl.appendChild(row);
        return;
      }

      row.className =
        "timeline-row" + (entry?.content ? "" : " is-empty") + (entry?.durationMinutes ? " has-duration" : "");
      const statusBadge =
        mode === "evening" && entry?.status
          ? `<span class="row-status status-${statusClass(entry.status)}">${entry.status}</span>`
          : "";
      const durationBadge = entry?.durationMinutes
        ? `<span class="row-duration">${entry.durationMinutes / 60}時間</span>`
        : "";
      row.innerHTML = `
        <span class="row-time">${time}</span>
        <span class="row-content">${entry?.content ? escapeHtml(entry.content) : "—"}</span>
        ${durationBadge}
        ${statusBadge}`;
      row.addEventListener("click", () => openSheet(time));
      rowsEl.appendChild(row);
    });
  }

  function openSheet(time) {
    activeTime = time;
    sheet.open(time, findEntry(time));
  }

  function closeSheet() {
    activeTime = null;
    sheet.close();
  }

  sheet.onSave((data) => {
    if (!activeTime) return;
    if (!data.content.trim()) {
      removeEntry(activeTime);
    } else {
      upsertEntry(activeTime, {
        content: data.content.trim(),
        status: data.status,
        note: data.note,
        durationMinutes: data.durationMinutes,
      });
    }
    closeSheet();
    renderRows();
    onChange?.(entries);
  });

  sheet.onClear(() => {
    if (!activeTime) return;
    removeEntry(activeTime);
    closeSheet();
    renderRows();
    onChange?.(entries);
  });

  sheet.onCancel(() => closeSheet());

  renderRows();

  return {
    refresh: renderRows,
    destroy: () => {
      sheet.root.remove();
      rowsEl.remove();
    },
  };
}

function statusClass(status) {
  return { 完了: "done", 一部完了: "partial", 未着手: "todo", 中止: "cancelled" }[status] || "";
}

function buildSheet(mode) {
  const root = document.createElement("div");
  root.className = "sheet-backdrop";
  root.innerHTML = `
    <div class="sheet">
      <div class="sheet-header">
        <span class="sheet-time"></span>
        <button type="button" class="sheet-close" aria-label="閉じる">×</button>
      </div>
      <div class="sheet-label">予定ライブラリから選ぶ</div>
      <div class="sheet-library"></div>
      <input type="text" class="sheet-content" placeholder="内容を入力（自由入力もできます）" maxlength="60" />
      <div class="sheet-label">所要時間</div>
      <div class="sheet-duration"></div>
      ${
        mode === "evening"
          ? `<div class="sheet-label">結果</div>
             <div class="sheet-status"></div>
             <input type="text" class="sheet-note" placeholder="補足（任意）" maxlength="60" />`
          : ""
      }
      <div class="sheet-actions">
        <button type="button" class="sheet-clear">クリア</button>
        <button type="button" class="sheet-save">保存</button>
      </div>
    </div>`;

  const timeEl = root.querySelector(".sheet-time");
  const contentEl = root.querySelector(".sheet-content");
  const libraryEl = root.querySelector(".sheet-library");
  const durationEl = root.querySelector(".sheet-duration");
  const statusEl = root.querySelector(".sheet-status");
  const noteEl = root.querySelector(".sheet-note");

  libraryEl.innerHTML = getSortedLibrary()
    .map((item) => `<button type="button" class="lib-btn" data-label="${escapeHtml(item.label)}">${escapeHtml(item.label)}</button>`)
    .join("");
  libraryEl.querySelectorAll(".lib-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      contentEl.value = btn.dataset.label;
      contentEl.focus();
    });
  });

  let selectedDuration = null;
  durationEl.innerHTML = DURATION_OPTIONS.map(
    (d) => `<button type="button" class="status-btn" data-minutes="${d.minutes ?? ""}">${d.label}</button>`
  ).join("");
  durationEl.querySelectorAll(".status-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedDuration = btn.dataset.minutes ? Number(btn.dataset.minutes) : null;
      durationEl
        .querySelectorAll(".status-btn")
        .forEach((b) => b.classList.toggle("is-selected", (b.dataset.minutes ? Number(b.dataset.minutes) : null) === selectedDuration));
    });
  });

  let selectedStatus = null;
  if (statusEl) {
    statusEl.innerHTML = STATUS_OPTIONS.map(
      (s) => `<button type="button" class="status-btn" data-status="${s}">${s}</button>`
    ).join("");
    statusEl.querySelectorAll(".status-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        selectedStatus = selectedStatus === btn.dataset.status ? null : btn.dataset.status;
        statusEl
          .querySelectorAll(".status-btn")
          .forEach((b) => b.classList.toggle("is-selected", b.dataset.status === selectedStatus));
      });
    });
  }

  let saveHandler = () => {};
  let clearHandler = () => {};
  let cancelHandler = () => {};

  root.querySelector(".sheet-close").addEventListener("click", () => cancelHandler());
  root.addEventListener("click", (e) => {
    if (e.target === root) cancelHandler();
  });
  root.querySelector(".sheet-clear").addEventListener("click", () => clearHandler());
  root.querySelector(".sheet-save").addEventListener("click", () =>
    saveHandler({
      content: contentEl.value,
      status: selectedStatus,
      note: noteEl ? noteEl.value.trim() : "",
      durationMinutes: selectedDuration,
    })
  );

  return {
    root,
    open(time, entry) {
      timeEl.textContent = time;
      contentEl.value = entry?.content || "";
      selectedStatus = entry?.status || null;
      if (statusEl) {
        statusEl
          .querySelectorAll(".status-btn")
          .forEach((b) => b.classList.toggle("is-selected", b.dataset.status === selectedStatus));
      }
      selectedDuration = entry?.durationMinutes || null;
      durationEl
        .querySelectorAll(".status-btn")
        .forEach((b) => b.classList.toggle("is-selected", (b.dataset.minutes ? Number(b.dataset.minutes) : null) === selectedDuration));
      if (noteEl) noteEl.value = entry?.note || "";
      root.classList.add("is-open");
      setTimeout(() => contentEl.focus(), 50);
    },
    close() {
      root.classList.remove("is-open");
    },
    onSave(fn) {
      saveHandler = fn;
    },
    onClear(fn) {
      clearHandler = fn;
    },
    onCancel(fn) {
      cancelHandler = fn;
    },
  };
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
