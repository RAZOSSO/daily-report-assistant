// 予定／実績データ → 報告文（挨拶・結びなしの箇条書き）への変換。

import { minutesToClock } from "./timeline.js";

function sortEntries(entries) {
  return entries
    .filter((e) => e.content && e.content.trim())
    .slice()
    .sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));
}

function timeToMinutes(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function computeRanges(entries, settings) {
  const sorted = sortEntries(entries);
  return sorted.map((entry, i) => {
    const startMin = timeToMinutes(entry.time);
    const inferredEndMin = i + 1 < sorted.length ? timeToMinutes(sorted[i + 1].time) : settings.dayEndHour * 60;
    // 明示的な所要時間があっても、次の予定の開始時刻は超えない
    const endMin = entry.durationMinutes ? Math.min(startMin + entry.durationMinutes, inferredEndMin) : inferredEndMin;
    return { ...entry, startLabel: minutesToClock(startMin), endLabel: minutesToClock(endMin) };
  });
}

export function generateMorningReport(record, settings) {
  const ranges = computeRanges(record.morning, settings);
  if (ranges.length === 0) return "本日の予定です。\n\n（予定はまだ入力されていません）";
  const lines = ranges.map((r) => `${r.startLabel}-${r.endLabel}　${r.content}`);
  return ["本日の予定です。", "", ...lines].join("\n");
}

export function generateEveningReport(record, settings) {
  const ranges = computeRanges(record.evening, settings);
  const lines = ranges.map((r) => {
    let line = `${r.startLabel}-${r.endLabel}　${r.content}`;
    if (r.status) {
      line += ` → ${r.status}`;
      if (r.note) line += `。${r.note}`;
    }
    return line;
  });
  const body = lines.length ? lines : ["（実績はまだ入力されていません）"];
  const parts = ["本日の実績です。", "", ...body];
  if (record.reflection && record.reflection.trim()) {
    parts.push("", `所感：${record.reflection.trim()}`);
  }
  return parts.join("\n");
}

function formatComparisonLine(entry, withStatus) {
  const duration = entry.durationMinutes
    ? `（〜${minutesToClock(timeToMinutes(entry.time) + entry.durationMinutes)}）`
    : "";
  let line = `${entry.time}　${entry.content}${duration}`;
  if (withStatus && entry.status) {
    line += ` → ${entry.status}`;
    if (entry.note) line += `。${entry.note}`;
  }
  return line;
}

// 画面の「予定と実績を比べる」表示（予定リスト→実績リストの並び）と同じ見た目の報告文を作る
export function generateComparisonReport(record) {
  const planEntries = record.morning.filter((e) => e.content).sort((a, b) => (a.time < b.time ? -1 : 1));
  const actualEntries = record.evening.filter((e) => e.content).sort((a, b) => (a.time < b.time ? -1 : 1));

  const planLines = planEntries.length
    ? planEntries.map((e) => formatComparisonLine(e, false))
    : ["（予定はまだ入力されていません）"];
  const actualLines = actualEntries.length
    ? actualEntries.map((e) => formatComparisonLine(e, true))
    : ["（実績はまだ入力されていません）"];

  return ["予定と実績の比較です。", "", "【予定】", ...planLines, "", "【実績】", ...actualLines].join("\n");
}

function formatJournalDate(dateStr) {
  const [, m, d] = dateStr.split("-").map(Number);
  return `${m}月${d}日`;
}

// 実際にLINEで送っている「1日の振り返りと自己成長ジャーナル」の書式（番号付き1行形式）を崩さずに出力する
export function generateJournalText(journal) {
  const lines = [
    "⭕ 1日の振り返りと自己成長ジャーナル",
    `1. 日付:${formatJournalDate(journal.date)}`,
    `2. 今日の主な出来事:${journal.mainEvents || ""}`,
    `3. 感謝の瞬間:${journal.gratitude || ""}`,
    `4. 達成したこと:${journal.achievements || ""}`,
    `5. 学んだこと:${journal.learnings || ""}`,
    `6. 課題と改善点:${journal.challenges || ""}`,
    `7. 感じた気づき:${journal.insights || ""}`,
    `8. 自分に対するポジティブな言葉:${journal.positiveWords || ""}`,
    `9. 明日への目標:${journal.tomorrowGoal || ""}`,
    `10. 今日の自分に対する評価 (1-10):${journal.selfScore ?? ""}`,
  ];
  return lines.join("\n");
}

function toLines(text) {
  return (text || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

// 実際にLINEで送っている「AIアクション報告」の書式を崩さずに出力する
export function generateActivityReport(activity) {
  const contentLines = toLines(activity.content);
  const nextLines = toLines(activity.nextAction);
  const parts = [
    "AIアクション報告",
    "昨日の日報です🌟",
    "",
    `活動時間: ${activity.hours || ""}`.trimEnd(),
    "",
    "【活動内容】",
    "〈AI〉",
    ...(contentLines.length ? contentLines : [""]),
    "",
    "【次回の行動】",
    "〈AI〉",
    ...(nextLines.length ? nextLines : [""]),
    "",
    "【振り返り】",
    activity.reflection || "",
  ];
  return parts.join("\n");
}
