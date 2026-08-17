// Google Gemini APIを使って、実績データを参考情報にした振り返りジャーナルの下書きを生成する。
// APIキーはブラウザからGoogleへ直接送られる（自分の端末のみに保存、自前サーバーは経由しない）。

// "-latest"エイリアスを使うと、モデルが廃止されるたびにコードを直す必要がなくなる
// （Googleが自動的に最新のFlashモデルへ切り替える）
const GEMINI_MODEL = "gemini-flash-latest";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const JOURNAL_KEYS = [
  "mainEvents",
  "gratitude",
  "achievements",
  "learnings",
  "challenges",
  "insights",
  "positiveWords",
  "tomorrowGoal",
];

function buildReference(record) {
  const entries = record.evening
    .filter((e) => e.content && e.content.trim())
    .slice()
    .sort((a, b) => (a.time < b.time ? -1 : 1))
    .map((e) => `${e.time} ${e.content}${e.status ? `（${e.status}）` : ""}${e.note ? `：${e.note}` : ""}`)
    .join("\n");

  const parts = [
    entries ? `【今日の実績】\n${entries}` : "",
    record.reflection?.trim() ? `【所感・気づき・課題】\n${record.reflection.trim()}` : "",
    record.nextAction?.trim() ? `【翌日メモ】\n${record.nextAction.trim()}` : "",
  ].filter(Boolean);

  return parts.length ? parts.join("\n\n") : "（今日の実績データはまだ入力されていません）";
}

const SYSTEM_PROMPT = `あなたはユーザー本人になりきって、1日の振り返りジャーナルの下書きを書くアシスタントです。
渡される「実績」はあくまで参考情報です。書き写すのではなく、それをもとに自然で丁寧な日本語の一人称の文章を書いてください。
必ず次のキーだけを持つJSONオブジェクトで返答してください（説明文やコードブロックは不要）：
mainEvents（今日の主な出来事）, gratitude（感謝の瞬間）, achievements（達成したこと）, learnings（学んだこと）,
challenges（課題と改善点）, insights（感じた気づき）, positiveWords（自分に対するポジティブな言葉）, tomorrowGoal（明日への目標）。
各値は1〜3文程度の短い文章にしてください。参考情報が乏しい項目は、無理に事実を作らず前向きで一般的な短い文章にしてください。`;

export async function generateJournalWithAI(record, apiKey) {
  if (!apiKey?.trim()) {
    throw new Error("設定画面でGemini APIキーを登録してください。");
  }

  const res = await fetch(`${GEMINI_ENDPOINT}?key=${encodeURIComponent(apiKey.trim())}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: "user", parts: [{ text: buildReference(record) }] }],
      generationConfig: { responseMimeType: "application/json" },
    }),
  });

  if (!res.ok) {
    const bodyText = await res.text().catch(() => "");
    throw new Error(`Gemini APIエラー（${res.status}）：${bodyText.slice(0, 200)}`);
  }

  const data = await res.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!content) throw new Error("AIからの応答が空でした。");

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("AIの応答を解析できませんでした。");
  }

  const draft = {};
  for (const key of JOURNAL_KEYS) {
    if (typeof parsed[key] === "string" && parsed[key].trim()) draft[key] = parsed[key].trim();
  }
  return draft;
}
