// 画面切り替えと各モジュールの結線。

import * as db from "./db.js";
import { mountTimeline } from "./timeline.js";
import { renderLibrarySettings } from "./library.js";
import { generateMorningReport, generateEveningReport, generateJournalText, generateActivityReport } from "./report.js";
import { renderHistoryList, renderHistoryDetail, formatDateLabel } from "./history.js";
import { exportData, importFromFile } from "./exportImport.js";
import { checkReminders, renderReminderBanner } from "./reminder.js";

// GitHub PagesはService WorkerファイルをCDNで10分キャッシュするため、
// 登録URLにバージョンを付けて更新のたびに別ファイル扱いにし、キャッシュを回避する。
// デプロイのたびに、この値とservice-worker.jsのCACHE_NAMEを一緒に上げること。
const APP_VERSION = "10";

db.ensureSeed();

let settings = db.getSettings();
let currentDate = db.todayStr();
let currentRecord = db.getRecord(currentDate);
let currentJournal = db.getJournal(currentDate);
let currentActivity = db.getActivity(currentDate);
let morningTimeline = null;
let eveningTimeline = null;
let resultType = null;
let selectedHistoryDate = null;

function showScreen(name) {
  document.querySelectorAll(".screen").forEach((el) => {
    el.classList.toggle("is-active", el.dataset.screen === name);
  });
  onEnterScreen(name);
}

function onEnterScreen(name) {
  if (name === "home") renderHome();
  if (name === "morning") mountMorningTimeline();
  if (name === "evening") mountEveningTimeline();
  if (name === "journal") mountJournalScreen();
  if (name === "history") renderHistoryScreen();
  if (name === "history-detail") renderHistoryDetailScreen();
  if (name === "settings") renderSettingsScreen();
}

// ---------- ホーム ----------

function renderHome() {
  currentDate = db.todayStr();
  currentRecord = db.getRecord(currentDate);

  document.getElementById("home-date").textContent = formatDateLabel(currentDate);

  const morningFilled = currentRecord.morning.some((e) => e.content?.trim());
  const eveningFilled = currentRecord.evening.some((e) => e.content?.trim());

  const morningStatus = document.getElementById("status-morning");
  morningStatus.textContent = morningFilled ? "入力済み" : "未入力";
  morningStatus.classList.toggle("is-done", morningFilled);

  const eveningStatus = document.getElementById("status-evening");
  eveningStatus.textContent = eveningFilled ? "入力済み" : "未入力";
  eveningStatus.classList.toggle("is-done", eveningFilled);

  const reminderState = checkReminders(settings, currentRecord);
  renderReminderBanner(document.getElementById("reminder-banner"), reminderState, (target) => showScreen(target));
}

// ---------- 予定入力（朝） ----------

function mountMorningTimeline() {
  currentRecord = db.getRecord(currentDate);
  if (morningTimeline) morningTimeline.destroy();
  const host = document.getElementById("morning-timeline-host");
  host.innerHTML = "";
  morningTimeline = mountTimeline({
    host,
    entries: currentRecord.morning,
    settings,
    mode: "morning",
    onChange: () => db.saveRecord(currentRecord),
  });
}

// ---------- 実績入力（夜） ----------

function mountEveningTimeline() {
  currentRecord = db.getRecord(currentDate);
  if (currentRecord.evening.length === 0 && currentRecord.morning.length > 0) {
    currentRecord.evening = currentRecord.morning.map((e) => ({
      time: e.time,
      content: e.content,
      status: null,
      note: "",
    }));
    db.saveRecord(currentRecord);
  }

  document.getElementById("reflection-input").value = currentRecord.reflection || "";
  document.getElementById("next-action-input").value = currentRecord.nextAction || "";

  if (eveningTimeline) eveningTimeline.destroy();
  const host = document.getElementById("evening-timeline-host");
  host.innerHTML = "";
  eveningTimeline = mountTimeline({
    host,
    entries: currentRecord.evening,
    settings,
    mode: "evening",
    onChange: () => db.saveRecord(currentRecord),
  });
}

document.getElementById("reflection-input").addEventListener("input", (e) => {
  currentRecord.reflection = e.target.value;
  db.saveRecord(currentRecord);
});

document.getElementById("next-action-input").addEventListener("input", (e) => {
  currentRecord.nextAction = e.target.value;
  db.saveRecord(currentRecord);
});

// ---------- 振り返りジャーナル ----------

const JOURNAL_FIELDS = [
  ["journal-main-events", "mainEvents"],
  ["journal-gratitude", "gratitude"],
  ["journal-achievements", "achievements"],
  ["journal-learnings", "learnings"],
  ["journal-challenges", "challenges"],
  ["journal-insights", "insights"],
  ["journal-positive-words", "positiveWords"],
  ["journal-tomorrow-goal", "tomorrowGoal"],
];

function mountJournalScreen() {
  currentDate = db.todayStr();
  currentJournal = db.getJournal(currentDate);
  for (const [id, key] of JOURNAL_FIELDS) {
    document.getElementById(id).value = currentJournal[key] || "";
  }
  renderScorePicker();

  currentActivity = db.getActivity(currentDate);
  for (const [id, key] of ACTIVITY_FIELDS) {
    document.getElementById(id).value = currentActivity[key] || "";
  }
}

function renderScorePicker() {
  const host = document.getElementById("journal-score");
  host.innerHTML = "";
  for (let n = 1; n <= 10; n++) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "score-btn" + (currentJournal.selfScore === n ? " is-selected" : "");
    btn.textContent = String(n);
    btn.addEventListener("click", () => {
      currentJournal.selfScore = currentJournal.selfScore === n ? null : n;
      db.saveJournal(currentJournal);
      renderScorePicker();
    });
    host.appendChild(btn);
  }
}

for (const [id, key] of JOURNAL_FIELDS) {
  document.getElementById(id).addEventListener("input", (e) => {
    currentJournal[key] = e.target.value;
    db.saveJournal(currentJournal);
  });
}

document.getElementById("journal-generate").addEventListener("click", () => {
  const text = generateJournalText(currentJournal) + "\n\n" + generateActivityReport(currentActivity);
  showResult(text, "journal");
});

// AIアクション報告の欄は振り返りジャーナルと同じ画面に同居している

const ACTIVITY_FIELDS = [
  ["activity-hours", "hours"],
  ["activity-content", "content"],
  ["activity-next", "nextAction"],
  ["activity-reflection", "reflection"],
];

for (const [id, key] of ACTIVITY_FIELDS) {
  document.getElementById(id).addEventListener("input", (e) => {
    currentActivity[key] = e.target.value;
    db.saveActivity(currentActivity);
  });
}

// ---------- 報告文の生成・コピー ----------

function showResult(text, type) {
  resultType = type;
  document.getElementById("result-text").value = text;
  document.getElementById("copy-feedback").textContent = "";
  showScreen("result");
}

document.getElementById("morning-generate").addEventListener("click", () => {
  currentRecord.morningDoneAt = new Date().toISOString();
  db.saveRecord(currentRecord);
  showResult(generateMorningReport(currentRecord, settings), "morning");
});

document.getElementById("evening-generate").addEventListener("click", () => {
  currentRecord.eveningDoneAt = new Date().toISOString();
  db.saveRecord(currentRecord);
  showResult(generateEveningReport(currentRecord, settings), "evening");
});

document.getElementById("result-back").addEventListener("click", () => {
  showScreen(resultType || "home");
});

document.getElementById("line-share-btn").addEventListener("click", () => {
  const text = document.getElementById("result-text").value;
  window.location.href = `https://line.me/R/msg/text/?${encodeURIComponent(text)}`;
});

document.getElementById("copy-btn").addEventListener("click", async () => {
  const textarea = document.getElementById("result-text");
  const text = textarea.value;
  try {
    await navigator.clipboard.writeText(text);
    showCopyFeedback("コピーしました。LINEに貼り付けてください。");
  } catch {
    textarea.focus();
    textarea.select();
    try {
      document.execCommand("copy");
      showCopyFeedback("コピーしました。LINEに貼り付けてください。");
    } catch {
      showCopyFeedback("コピーできませんでした。文章を選択してコピーしてください。");
    }
  }
});

function showCopyFeedback(message) {
  document.getElementById("copy-feedback").textContent = message;
}

// ---------- 履歴 ----------

function renderHistoryScreen() {
  renderHistoryList(document.getElementById("history-list"), (date) => {
    selectedHistoryDate = date;
    showScreen("history-detail");
  });
}

function renderHistoryDetailScreen() {
  if (!selectedHistoryDate) {
    showScreen("history");
    return;
  }
  renderHistoryDetail(document.getElementById("history-detail"), selectedHistoryDate);
}

// ---------- 設定 ----------

function renderSettingsScreen() {
  settings = db.getSettings();
  document.getElementById("setting-start-hour").value = settings.dayStartHour;
  document.getElementById("setting-end-hour").value = settings.dayEndHour;
  document.getElementById("setting-step-minutes").value = String(settings.stepMinutes);
  document.getElementById("setting-reminder-morning").value = settings.reminderMorningTime;
  document.getElementById("setting-reminder-evening").value = settings.reminderEveningTime;
  renderLibrarySettings(document.getElementById("library-settings"));
}

function clampInt(value, min, max, fallback) {
  const n = parseInt(value, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function saveSettingsFromForm() {
  settings = {
    dayStartHour: clampInt(document.getElementById("setting-start-hour").value, 0, 23, settings.dayStartHour),
    dayEndHour: clampInt(document.getElementById("setting-end-hour").value, 1, 24, settings.dayEndHour),
    stepMinutes: Number(document.getElementById("setting-step-minutes").value),
    reminderMorningTime: document.getElementById("setting-reminder-morning").value || settings.reminderMorningTime,
    reminderEveningTime: document.getElementById("setting-reminder-evening").value || settings.reminderEveningTime,
  };
  db.saveSettings(settings);
}

["setting-start-hour", "setting-end-hour", "setting-step-minutes", "setting-reminder-morning", "setting-reminder-evening"].forEach(
  (id) => document.getElementById(id).addEventListener("change", saveSettingsFromForm)
);

document.getElementById("export-btn").addEventListener("click", () => exportData());

document.getElementById("import-file").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (!confirm("現在のデータに読み込んだ内容を上書き・追加します。よろしいですか？")) {
    e.target.value = "";
    return;
  }
  try {
    await importFromFile(file);
    alert("インポートが完了しました。");
    location.reload();
  } catch (err) {
    alert("インポートに失敗しました：" + err.message);
  } finally {
    e.target.value = "";
  }
});

// ---------- ナビゲーション ----------

document.querySelectorAll("[data-nav]").forEach((btn) => {
  btn.addEventListener("click", () => showScreen(btn.dataset.nav));
});

// ---------- Service Worker ----------

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(`./service-worker.js?v=${APP_VERSION}`).catch(() => {});
  });
}

showScreen("home");
