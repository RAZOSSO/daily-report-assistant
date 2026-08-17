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

// 予定（morning）と実績（evening）を、それぞれ独立したパネルとして並べて比較できる
// ブロックを作る（仮実装）。スマホはタブで切り替え、PC（幅700px以上）は横並びで両方表示。
// 同じ時刻なのに内容が食い違っている行は色付けして目立たせる。履歴詳細と「予定と実績」
// 画面（今日）の両方から使われる。
export function buildComparisonBlock(record) {
  const planEntries = record.morning.filter((e) => e.content).sort((a, b) => (a.time < b.time ? -1 : 1));
  const actualEntries = record.evening.filter((e) => e.content).sort((a, b) => (a.time < b.time ? -1 : 1));
  const planMap = new Map(planEntries.map((e) => [e.time, e]));
  const actualMap = new Map(actualEntries.map((e) => [e.time, e]));

  const block = document.createElement("div");
  block.className = "detail-block compare-block";

  if (planEntries.length === 0 && actualEntries.length === 0) {
    block.innerHTML = `<h3>予定と実績</h3><p class="empty-note">記録なし</p>`;
    return block;
  }

  function buildPanelRows(entries, counterMap, withStatus) {
    return (
      entries
        .map((e) => {
          const counter = counterMap.get(e.time);
          const mismatch = Boolean(counter && counter.content !== e.content);
          const duration = e.durationMinutes ? `<span class="row-duration">${e.durationMinutes / 60}時間</span>` : "";
          const status = withStatus && e.status ? `<span class="row-status status-${statusClass(e.status)}">${e.status}</span>` : "";
          const note = withStatus && e.note ? `<span class="detail-note">${escapeHtml(e.note)}</span>` : "";
          return `<div class="detail-row${mismatch ? " is-mismatch" : ""}"><span class="row-time">${e.time}</span><span class="row-content">${escapeHtml(e.content)}</span>${duration}${status}${note}</div>`;
        })
        .join("") || `<p class="empty-note">記録なし</p>`
    );
  }

  block.innerHTML = `
    <h3>予定と実績の比較</h3>
    <div class="compare-tabs">
      <button type="button" class="compare-tab is-active" data-panel="plan">予定</button>
      <button type="button" class="compare-tab" data-panel="actual">実績</button>
    </div>
    <div class="compare-columns">
      <div class="compare-panel is-active" data-panel="plan" data-panel-label="予定">${buildPanelRows(planEntries, actualMap, false)}</div>
      <div class="compare-panel" data-panel="actual" data-panel-label="実績">${buildPanelRows(actualEntries, planMap, true)}</div>
    </div>`;

  block.querySelectorAll(".compare-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      block.querySelectorAll(".compare-tab").forEach((t) => t.classList.toggle("is-active", t === tab));
      block
        .querySelectorAll(".compare-panel")
        .forEach((p) => p.classList.toggle("is-active", p.dataset.panel === tab.dataset.panel));
    });
  });

  return block;
}

function statusClass(status) {
  return { 完了: "done", 一部完了: "partial", 未着手: "todo", 中止: "cancelled" }[status] || "";
}
