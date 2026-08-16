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
