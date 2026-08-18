// データのエクスポート（JSONダウンロード）／インポート（ファイル読み込み）。

import * as db from "./db.js";

export function exportData() {
  const data = db.exportAll();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `daily-report-backup-${db.todayStr()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  db.markExported();
}

export function importFromFile(file) {
  return file
    .text()
    .then((text) => JSON.parse(text))
    .then((data) => {
      db.importAll(data);
    });
}
