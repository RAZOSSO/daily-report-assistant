// アプリを開いた時の入力促進バナー。加えて、設定で有効にしていればブラウザ通知も送る
// （app.jsのcheckAndNotifyから利用。届く条件はアプリがある程度生きている間だけ）。

export function nowClock() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

const BACKUP_REMINDER_DAYS = 14;

export function isBackupDue(lastExportAt, firstUseAt) {
  const reference = lastExportAt || firstUseAt;
  if (!reference) return false;
  const days = (Date.now() - new Date(reference).getTime()) / 86400000;
  return days >= BACKUP_REMINDER_DAYS;
}

export function checkReminders(settings, record, extra = {}) {
  const now = nowClock();
  const morningFilled = record.morning.some((e) => e.content?.trim());
  const eveningFilled = record.evening.some((e) => e.content?.trim());
  return {
    morningDue: now >= settings.reminderMorningTime && !morningFilled,
    eveningDue: now >= settings.reminderEveningTime && !eveningFilled,
    backupDue: Boolean(extra.backupDue),
  };
}

export function renderReminderBanner(container, state, onNavigate) {
  container.innerHTML = "";
  if (state.morningDue) {
    container.appendChild(buildBanner("本日の予定がまだ入力されていません。", "予定を入力する", () => onNavigate("morning")));
  }
  if (state.eveningDue) {
    container.appendChild(buildBanner("本日の実績がまだ入力されていません。", "実績を入力する", () => onNavigate("evening")));
  }
  if (state.backupDue) {
    container.appendChild(buildBanner("しばらくバックアップを取っていません。", "設定を開く", () => onNavigate("settings")));
  }
}

function buildBanner(message, actionLabel, onClick) {
  const el = document.createElement("div");
  el.className = "reminder-banner";
  el.innerHTML = `<span>${message}</span><button type="button">${actionLabel}</button>`;
  el.querySelector("button").addEventListener("click", onClick);
  return el;
}
