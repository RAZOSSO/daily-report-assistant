// 履歴一覧・詳細の描画。

import * as db from "./db.js";
import { minutesToClock, clockToMinutes, mountTimeline } from "./timeline.js";

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
  destroyEditTimelines();
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

// 編集モードで開いたタイムラインは、画面外（document.body）にシートを追加するため、
// 履歴詳細を離れる・再描画する際は必ずdestroy()して後始末する。
let activeEditTimelines = [];
function destroyEditTimelines() {
  activeEditTimelines.forEach((t) => t.destroy());
  activeEditTimelines = [];
}

export function renderHistoryDetail(container, date, onGenerate, settings) {
  destroyEditTimelines();
  const record = db.getRecord(date);
  const journal = db.getJournal(date);
  container.innerHTML = "";
  let editing = false;

  const title = document.createElement("h2");
  title.className = "detail-title";
  title.textContent = formatDateLabel(date);
  container.appendChild(title);

  const editToggleRow = document.createElement("div");
  editToggleRow.className = "detail-actions";
  const editToggleBtn = document.createElement("button");
  editToggleBtn.type = "button";
  editToggleBtn.textContent = "この日の内容を編集する";
  editToggleRow.appendChild(editToggleBtn);
  container.appendChild(editToggleRow);

  const editHost = document.createElement("div");
  container.appendChild(editHost);

  const viewHost = document.createElement("div");
  container.appendChild(viewHost);

  function renderView() {
    viewHost.innerHTML = "";
    viewHost.appendChild(buildComparisonBlock(record));

    if (onGenerate) {
      const scheduleActions = document.createElement("div");
      scheduleActions.className = "detail-actions";
      scheduleActions.innerHTML = `
        <button type="button" data-report="morning">予定の報告文を作る</button>
        <button type="button" data-report="evening">実績の報告文を作る</button>
        <button type="button" data-report="compare">比較の報告文を作る</button>`;
      scheduleActions.querySelectorAll("[data-report]").forEach((btn) => {
        btn.addEventListener("click", () => onGenerate(btn.dataset.report, date));
      });
      viewHost.appendChild(scheduleActions);
    }

    if (record.reflection?.trim()) {
      const block = document.createElement("div");
      block.className = "detail-block";
      block.innerHTML = `<h3>所感</h3><p>${escapeHtml(record.reflection)}</p>`;
      viewHost.appendChild(block);
    }

    if (record.nextAction?.trim()) {
      const block = document.createElement("div");
      block.className = "detail-block";
      block.innerHTML = `<h3>翌日メモ</h3><p>${escapeHtml(record.nextAction)}</p>`;
      viewHost.appendChild(block);
    }

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
      viewHost.appendChild(block);
    }

    if (onGenerate && (journalFields.length || journal.selfScore)) {
      const journalActions = document.createElement("div");
      journalActions.className = "detail-actions";
      journalActions.innerHTML = `<button type="button" data-report="journal">ジャーナルの報告文を作る</button>`;
      journalActions.querySelector("[data-report]").addEventListener("click", () => onGenerate("journal", date));
      viewHost.appendChild(journalActions);
    }
  }

  function renderEdit() {
    destroyEditTimelines();
    editHost.innerHTML = "";
    if (!editing) return;

    const morningBlock = document.createElement("div");
    morningBlock.className = "detail-block";
    morningBlock.innerHTML = `<h3>予定を編集</h3><p class="screen-hint">時刻をタップして内容を修正できます。</p>`;
    const morningHost = document.createElement("div");
    morningBlock.appendChild(morningHost);
    editHost.appendChild(morningBlock);
    activeEditTimelines.push(
      mountTimeline({
        host: morningHost,
        entries: record.morning,
        settings,
        mode: "morning",
        onChange: () => {
          db.saveRecord(record);
          renderView();
        },
      })
    );

    const eveningBlock = document.createElement("div");
    eveningBlock.className = "detail-block";
    eveningBlock.innerHTML = `<h3>実績を編集</h3><p class="screen-hint">時刻をタップして内容を修正できます。</p>`;
    const eveningHost = document.createElement("div");
    eveningBlock.appendChild(eveningHost);
    editHost.appendChild(eveningBlock);
    activeEditTimelines.push(
      mountTimeline({
        host: eveningHost,
        entries: record.evening,
        settings,
        mode: "evening",
        onChange: () => {
          db.saveRecord(record);
          renderView();
        },
      })
    );

    const fieldsBlock = document.createElement("div");
    fieldsBlock.className = "detail-block";
    fieldsBlock.innerHTML = `
      <h3>所感・翌日メモを編集</h3>
      <div class="field-block">
        <label for="history-reflection">所感・気づき・課題</label>
        <textarea id="history-reflection" rows="3"></textarea>
      </div>
      <div class="field-block">
        <label for="history-next-action">翌日メモ（任意）</label>
        <textarea id="history-next-action" rows="2"></textarea>
      </div>`;
    editHost.appendChild(fieldsBlock);

    const reflectionEl = fieldsBlock.querySelector("#history-reflection");
    reflectionEl.value = record.reflection || "";
    reflectionEl.addEventListener("input", () => {
      record.reflection = reflectionEl.value;
      db.saveRecord(record);
    });

    const nextActionEl = fieldsBlock.querySelector("#history-next-action");
    nextActionEl.value = record.nextAction || "";
    nextActionEl.addEventListener("input", () => {
      record.nextAction = nextActionEl.value;
      db.saveRecord(record);
    });

    const journalBlock = document.createElement("div");
    journalBlock.className = "detail-block";
    journalBlock.innerHTML = `
      <h3>振り返りジャーナルを編集</h3>
      <div class="field-block">
        <label for="history-journal-main-events">今日の主な出来事</label>
        <textarea id="history-journal-main-events" rows="3"></textarea>
      </div>
      <div class="field-block">
        <label for="history-journal-gratitude">感謝の瞬間</label>
        <textarea id="history-journal-gratitude" rows="2"></textarea>
      </div>
      <div class="field-block">
        <label for="history-journal-achievements">達成したこと</label>
        <textarea id="history-journal-achievements" rows="2"></textarea>
      </div>
      <div class="field-block">
        <label for="history-journal-learnings">学んだこと</label>
        <textarea id="history-journal-learnings" rows="2"></textarea>
      </div>
      <div class="field-block">
        <label for="history-journal-challenges">課題と改善点</label>
        <textarea id="history-journal-challenges" rows="2"></textarea>
      </div>
      <div class="field-block">
        <label for="history-journal-insights">感じた気づき</label>
        <textarea id="history-journal-insights" rows="2"></textarea>
      </div>
      <div class="field-block">
        <label for="history-journal-positive-words">自分に対するポジティブな言葉</label>
        <textarea id="history-journal-positive-words" rows="2"></textarea>
      </div>
      <div class="field-block">
        <label for="history-journal-tomorrow-goal">明日への目標</label>
        <textarea id="history-journal-tomorrow-goal" rows="2"></textarea>
      </div>
      <div class="field-block">
        <label>今日の自分に対する評価（1〜10）</label>
        <div class="score-picker" id="history-journal-score"></div>
      </div>`;
    editHost.appendChild(journalBlock);

    const journalFieldMap = [
      ["history-journal-main-events", "mainEvents"],
      ["history-journal-gratitude", "gratitude"],
      ["history-journal-achievements", "achievements"],
      ["history-journal-learnings", "learnings"],
      ["history-journal-challenges", "challenges"],
      ["history-journal-insights", "insights"],
      ["history-journal-positive-words", "positiveWords"],
      ["history-journal-tomorrow-goal", "tomorrowGoal"],
    ];
    for (const [id, key] of journalFieldMap) {
      const el = journalBlock.querySelector(`#${id}`);
      el.value = journal[key] || "";
      el.addEventListener("input", () => {
        journal[key] = el.value;
        db.saveJournal(journal);
      });
    }

    function renderScorePicker() {
      const scoreHost = journalBlock.querySelector("#history-journal-score");
      scoreHost.innerHTML = "";
      for (let n = 1; n <= 10; n++) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "score-btn" + (journal.selfScore === n ? " is-selected" : "");
        btn.textContent = String(n);
        btn.addEventListener("click", () => {
          journal.selfScore = journal.selfScore === n ? null : n;
          db.saveJournal(journal);
          renderScorePicker();
          renderView();
        });
        scoreHost.appendChild(btn);
      }
    }
    renderScorePicker();
  }

  editToggleBtn.addEventListener("click", () => {
    editing = !editing;
    editToggleBtn.textContent = editing ? "編集を終了する" : "この日の内容を編集する";
    renderEdit();
    renderView();
  });

  renderView();
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
          const duration = e.durationMinutes
            ? `<span class="row-duration">〜${minutesToClock(clockToMinutes(e.time) + e.durationMinutes)}</span>`
            : "";
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
