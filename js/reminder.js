// アプリを開いた時だけの入力促進バナー（プッシュ通知は使わない）。

function nowClock() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function checkReminders(settings, record) {
  const now = nowClock();
  const morningFilled = record.morning.some((e) => e.content?.trim());
  const eveningFilled = record.evening.some((e) => e.content?.trim());
  return {
    morningDue: now >= settings.reminderMorningTime && !morningFilled,
    eveningDue: now >= settings.reminderEveningTime && !eveningFilled,
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
}

function buildBanner(message, actionLabel, onClick) {
  const el = document.createElement("div");
  el.className = "reminder-banner";
  el.innerHTML = `<span>${message}</span><button type="button">${actionLabel}</button>`;
  el.querySelector("button").addEventListener("click", onClick);
  return el;
}
