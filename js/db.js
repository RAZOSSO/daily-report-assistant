// localStorage data layer. Everything the app persists goes through here.

const PREFIX = "dra:";
const SCHEMA_VERSION = 1;

const DEFAULT_SETTINGS = {
  dayStartHour: 6,
  dayEndHour: 24,
  stepMinutes: 60,
  reminderMorningTime: "08:30",
  reminderEveningTime: "20:00",
};

const DEFAULT_LIBRARY = [
  "メール対応",
  "資料作成",
  "会議",
  "訪問・打ち合わせ",
  "移動",
  "休憩",
].map((label, i) => ({ id: cryptoId(), label, order: i }));

function cryptoId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function readJSON(key, fallback) {
  const raw = localStorage.getItem(PREFIX + key);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJSON(key, value) {
  localStorage.setItem(PREFIX + key, JSON.stringify(value));
}

export function todayStr(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function ensureSeed() {
  if (readJSON("schemaVersion", null) === null) {
    writeJSON("schemaVersion", SCHEMA_VERSION);
  }
  if (readJSON("settings", null) === null) {
    writeJSON("settings", DEFAULT_SETTINGS);
  }
  if (readJSON("library", null) === null) {
    writeJSON("library", DEFAULT_LIBRARY);
  }
}

export function getSettings() {
  return { ...DEFAULT_SETTINGS, ...readJSON("settings", DEFAULT_SETTINGS) };
}

export function saveSettings(settings) {
  writeJSON("settings", settings);
}

export function getLibrary() {
  return readJSON("library", []);
}

export function saveLibrary(list) {
  writeJSON("library", list);
}

export function emptyRecord(date) {
  return {
    date,
    morning: [],
    evening: [],
    reflection: "",
    nextAction: "",
    morningDoneAt: null,
    eveningDoneAt: null,
  };
}

export function getRecord(date) {
  const rec = readJSON(`record:${date}`, null);
  return rec ? { ...emptyRecord(date), ...rec } : emptyRecord(date);
}

export function saveRecord(record) {
  writeJSON(`record:${record.date}`, record);
}

export function listRecordDates() {
  const dates = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(PREFIX + "record:")) {
      dates.push(key.slice((PREFIX + "record:").length));
    }
  }
  return dates.sort().reverse();
}

export function exportAll() {
  const records = {};
  for (const date of listRecordDates()) {
    records[date] = getRecord(date);
  }
  return {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    settings: getSettings(),
    library: getLibrary(),
    records,
  };
}

export function importAll(data) {
  if (!data || typeof data !== "object" || !data.records) {
    throw new Error("インポートするファイルの形式が正しくありません。");
  }
  if (data.settings) saveSettings({ ...DEFAULT_SETTINGS, ...data.settings });
  if (data.library) saveLibrary(data.library);
  for (const [date, record] of Object.entries(data.records)) {
    saveRecord({ ...emptyRecord(date), ...record, date });
  }
}
