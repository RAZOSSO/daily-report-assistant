// 履歴一覧・詳細の描画。

import * as db from "./db.js";
import { computeRowTimes, computeCoverage } from "./timeline.js";

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

  container.appendChild(buildComparisonBlock(record, db.getSettings()));

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

// 予定（morning）と実績（evening）を1日の全時間帯にわたって並べて、その場で比較できる
// ブロックを作る。空欄の時間帯もそのまま表示する。履歴詳細と「予定と実績」画面（今日）の
// 両方から使われる。
export function buildComparisonBlock(record, settings) {
  const planMap = new Map(record.morning.filter((e) => e.content).map((e) => [e.time, e]));
  const actualMap = new Map(record.evening.filter((e) => e.content).map((e) => [e.time, e]));
  const planCoverage = computeCoverage(record.morning, settings);
  const actualCoverage = computeCoverage(record.evening, settings);
  const times = computeRowTimes(settings);

  const block = document.createElement("div");
  block.className = "detail-block compare-block";

  const rows = times
    .map((time) => {
      const plan = planMap.get(time);
      const actual = actualMap.get(time);
      const planCovered = planCoverage.has(time);
      const actualCovered = actualCoverage.has(time);
      const mismatch = Boolean(plan && actual && plan.content !== actual.content);
      const isBlank = !plan && !actual && !planCovered && !actualCovered;

      const planDuration = plan?.durationMinutes ? `<span class="row-duration">${plan.durationMinutes / 60}時間</span>` : "";
      const actualStatus = actual?.status ? `<span class="row-status status-${statusClass(actual.status)}">${actual.status}</span>` : "";
      const actualNote = actual?.note ? `<span class="detail-note">${escapeHtml(actual.note)}</span>` : "";

      const planContent = planCovered ? `<span class="covered-label">つづき</span>` : plan ? escapeHtml(plan.content) : "—";
      const actualContent = actualCovered ? `<span class="covered-label">つづき</span>` : actual ? escapeHtml(actual.content) : "—";

      return `
        <div class="compare-row${mismatch ? " is-mismatch" : ""}${isBlank ? " is-blank" : ""}">
          <div class="compare-time">${time}</div>
          <div class="compare-cols">
            <div class="compare-col">
              <div class="compare-col-label">予定</div>
              <div class="compare-col-content">${planContent}${planDuration}</div>
            </div>
            <div class="compare-col">
              <div class="compare-col-label">実績</div>
              <div class="compare-col-content">${actualContent}${actualStatus}${actualNote}</div>
            </div>
          </div>
        </div>`;
    })
    .join("");

  block.innerHTML = `<h3>予定と実績の比較</h3>${rows}`;
  return block;
}

function statusClass(status) {
  return { 完了: "done", 一部完了: "partial", 未着手: "todo", 中止: "cancelled" }[status] || "";
}
