// 予定ライブラリ（プリセットボタン）の管理。

import * as db from "./db.js";

function newId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function getSortedLibrary() {
  return db.getLibrary().slice().sort((a, b) => a.order - b.order);
}

export function addLibraryItem(label) {
  const trimmed = label.trim();
  if (!trimmed) return;
  const list = getSortedLibrary();
  list.push({ id: newId(), label: trimmed, order: list.length });
  db.saveLibrary(list);
}

export function updateLibraryItem(id, label) {
  const trimmed = label.trim();
  if (!trimmed) return;
  const list = getSortedLibrary().map((item) => (item.id === id ? { ...item, label: trimmed } : item));
  db.saveLibrary(list);
}

export function deleteLibraryItem(id) {
  const list = getSortedLibrary()
    .filter((item) => item.id !== id)
    .map((item, i) => ({ ...item, order: i }));
  db.saveLibrary(list);
}

export function moveLibraryItem(id, direction) {
  const list = getSortedLibrary();
  const index = list.findIndex((item) => item.id === id);
  const target = index + direction;
  if (index === -1 || target < 0 || target >= list.length) return;
  [list[index], list[target]] = [list[target], list[index]];
  list.forEach((item, i) => (item.order = i));
  db.saveLibrary(list);
}

// 設定画面: ライブラリの一覧を描画し、追加・編集・削除・並び替えを結線する
export function renderLibrarySettings(container, onChange) {
  const list = getSortedLibrary();
  container.innerHTML = "";

  const ul = document.createElement("div");
  ul.className = "lib-manage-list";
  list.forEach((item, i) => {
    const row = document.createElement("div");
    row.className = "lib-manage-row";
    row.innerHTML = `
      <span class="lib-manage-label">${escapeHtml(item.label)}</span>
      <span class="lib-manage-actions">
        <button type="button" data-act="up" ${i === 0 ? "disabled" : ""} aria-label="上へ">↑</button>
        <button type="button" data-act="down" ${i === list.length - 1 ? "disabled" : ""} aria-label="下へ">↓</button>
        <button type="button" data-act="edit" aria-label="編集">編集</button>
        <button type="button" data-act="delete" aria-label="削除">削除</button>
      </span>`;
    row.querySelector('[data-act="up"]').addEventListener("click", () => {
      moveLibraryItem(item.id, -1);
      renderLibrarySettings(container, onChange);
      onChange?.();
    });
    row.querySelector('[data-act="down"]').addEventListener("click", () => {
      moveLibraryItem(item.id, 1);
      renderLibrarySettings(container, onChange);
      onChange?.();
    });
    row.querySelector('[data-act="edit"]').addEventListener("click", () => {
      const next = prompt("予定ライブラリの名称を編集", item.label);
      if (next !== null) {
        updateLibraryItem(item.id, next);
        renderLibrarySettings(container, onChange);
        onChange?.();
      }
    });
    row.querySelector('[data-act="delete"]').addEventListener("click", () => {
      if (confirm(`「${item.label}」を削除しますか？`)) {
        deleteLibraryItem(item.id);
        renderLibrarySettings(container, onChange);
        onChange?.();
      }
    });
    ul.appendChild(row);
  });
  container.appendChild(ul);

  const addForm = document.createElement("form");
  addForm.className = "lib-add-form";
  addForm.innerHTML = `
    <input type="text" name="label" placeholder="新しい予定を追加（例：ランチ）" maxlength="20" />
    <button type="submit">追加</button>`;
  addForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const input = addForm.elements.label;
    addLibraryItem(input.value);
    input.value = "";
    renderLibrarySettings(container, onChange);
    onChange?.();
  });
  container.appendChild(addForm);
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
