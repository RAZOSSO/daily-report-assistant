// 履歴一覧・詳細の描画。

import * as db from "./db.js";

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export function formatDateLabel(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const weekday = ["日", "月", "火", "水", "木", "金", "土"][date.getDay()];
  return `${y}年${m}月${d}日（${weekday}）`;
}

export function renderHistoryList(container, onSelect) {
  const dates = db.listRecordDates();
  container.innerHTML = "";

  if (dates.length === 0) {
    container.innerHTML = `<p class="empty-note">まだ記録がありません。</p>`;
    return;
  }

  dates.forEach((date) => {
    const record = db.getRecord(date);
    const morningCount = record.morning.filter((e) => e.content).length;
    const eveningCount = record.evening.filter((e) => e.content).length;
    const row = document.createElement("button");
    row.type = "button";
    row.className = "history-row";
    row.innerHTML = `
      <span class="history-date">${formatDateLabel(date)}</span>
      <span class="history-summary">予定 ${morningCount}件 ／ 実績 ${eveningCount}件</span>`;
    row.addEventListener("click", () => onSelect(date));
    container.appendChild(row);
  });
}

export function renderHistoryDetail(container, date) {
  const record = db.getRecord(date);
  container.innerHTML = "";

  const title = document.createElement("h2");
  title.className = "detail-title";
  title.textContent = formatDateLabel(date);
  container.appendChild(title);

  container.appendChild(buildEntryBlock("予定", record.morning, false));
  container.appendChild(buildEntryBlock("実績", record.evening, true));

  if (record.reflection?.trim()) {
    const block = document.createElement("div");
    block.className = "detail-block";
    block.innerHTML = `<h3>所感</h3><p>${escapeHtml(record.reflection)}</p>`;
    container.appendChild(block);
  }

  if (record.nextAction?.trim()) {
    const block = document.createElement("div");
    block.className = "detail-block";
    block.innerHTML = `<h3>翌日メモ</h3><p>${escapeHtml(record.nextAction)}</p>`;
    container.appendChild(block);
  }
}

function buildEntryBlock(title, entries, withStatus) {
  const filled = entries.filter((e) => e.content).sort((a, b) => (a.time < b.time ? -1 : 1));
  const block = document.createElement("div");
  block.className = "detail-block";
  const rows = filled
    .map((e) => {
      const duration = e.durationMinutes ? `<span class="row-duration">${e.durationMinutes / 60}時間</span>` : "";
      const status = withStatus && e.status ? `<span class="row-status status-${statusClass(e.status)}">${e.status}</span>` : "";
      const note = withStatus && e.note ? `<span class="detail-note">${escapeHtml(e.note)}</span>` : "";
      return `<div class="detail-row"><span class="row-time">${e.time}</span><span class="row-content">${escapeHtml(e.content)}</span>${duration}${status}${note}</div>`;
    })
    .join("");
  block.innerHTML = `<h3>${title}</h3>${rows || `<p class="empty-note">記録なし</p>`}`;
  return block;
}

function statusClass(status) {
  return { 完了: "done", 一部完了: "partial", 未着手: "todo", 中止: "cancelled" }[status] || "";
}
