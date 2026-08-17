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

  container.appendChild(buildComparisonBlock(record));

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

  const journal = db.getJournal(date);
  const journalFields = [
    ["今日の主な出来事", journal.mainEvents],
    ["感謝の瞬間", journal.gratitude],
    ["達成したこと", journal.achievements],
    ["学んだこと", journal.learnings],
    ["課題と改善点", journal.challenges],
    ["感じた気づき", journal.insights],
    ["自分に対するポジティブな言葉", journal.positiveWords],
    ["明日への目標", journal.tomorrowGoal],
  ].filter(([, value]) => value?.trim());

  if (journalFields.length || journal.selfScore) {
    const block = document.createElement("div");
    block.className = "detail-block";
    const score = journal.selfScore ? `<p><strong>今日の自己評価：</strong>${journal.selfScore} / 10</p>` : "";
    const fields = journalFields
      .map(([label, value]) => `<p><strong>${label}：</strong>${escapeHtml(value)}</p>`)
      .join("");
    block.innerHTML = `<h3>振り返りジャーナル</h3>${score}${fields}`;
    container.appendChild(block);
  }
}

// 予定（morning）と実績（evening）を時刻ごとに表形式で並べて比較できるブロックを作る。
// 内容がある時刻だけを扱い、見出しは表の先頭に1回だけ出す。履歴詳細と「予定と実績」画面
// （今日）の両方から使われる。
export function buildComparisonBlock(record) {
  const planMap = new Map(record.morning.filter((e) => e.content).map((e) => [e.time, e]));
  const actualMap = new Map(record.evening.filter((e) => e.content).map((e) => [e.time, e]));
  const times = Array.from(new Set([...planMap.keys(), ...actualMap.keys()])).sort();

  const block = document.createElement("div");
  block.className = "detail-block compare-block";

  if (times.length === 0) {
    block.innerHTML = `<h3>予定と実績</h3><p class="empty-note">記録なし</p>`;
    return block;
  }

  const rows = times
    .map((time) => {
      const plan = planMap.get(time);
      const actual = actualMap.get(time);
      const mismatch = Boolean(plan && actual && plan.content !== actual.content);
      const planDuration = plan?.durationMinutes ? `<span class="row-duration">${plan.durationMinutes / 60}時間</span>` : "";
      const actualStatus = actual?.status ? `<span class="row-status status-${statusClass(actual.status)}">${actual.status}</span>` : "";
      const actualNote = actual?.note ? `<span class="detail-note">${escapeHtml(actual.note)}</span>` : "";
      return `
        <div class="compare-row${mismatch ? " is-mismatch" : ""}">
          <span class="compare-time">${time}</span>
          <span class="compare-cell">${plan ? escapeHtml(plan.content) : "—"}${planDuration}</span>
          <span class="compare-cell">${actual ? escapeHtml(actual.content) : "—"}${actualStatus}${actualNote}</span>
        </div>`;
    })
    .join("");

  block.innerHTML = `
    <h3>予定と実績の比較</h3>
    <div class="compare-table">
      <div class="compare-table-head">
        <span></span>
        <span>予定</span>
        <span>実績</span>
      </div>
      ${rows}
    </div>`;
  return block;
}

function statusClass(status) {
  return { 完了: "done", 一部完了: "partial", 未着手: "todo", 中止: "cancelled" }[status] || "";
}
