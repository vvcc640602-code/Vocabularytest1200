const TOTAL_CHOICE = 60;
const CHOICE_ZH_TO_EN = 30;
const CHOICE_EN_TO_ZH = 30;
const TOTAL_FILL = 40;
const TOTAL_QUESTIONS = TOTAL_CHOICE + TOTAL_FILL;
const POINTS_PER_QUESTION = 1;
const TIME_LIMIT_SECONDS = 20 * 60;
const QUIZ_VERSION = "2026-09-01-basic-1200";
const VOCAB_SOURCE = "國中基礎1200單字.pdf";
const HISTORY_KEY = "vocabQuizHistory";
const ENDPOINT_KEY = "vocabQuizSheetEndpoint";
const CONFIG_ENDPOINT = window.QUIZ_CONFIG?.sheetEndpoint || "";

let quiz = null;
let timerId = null;
let startTime = 0;

const $ = (id) => document.getElementById(id);

document.addEventListener("DOMContentLoaded", () => {
  $("quizDate").valueAsDate = new Date();
  $("sheetEndpoint").value = getSheetEndpoint();

  $("startQuizBtn").addEventListener("click", startQuiz);
  $("submitQuizBtn").addEventListener("click", () => submitQuiz({ force: false }));
  $("newQuizBtn").addEventListener("click", resetHome);
  $("historyBtn").addEventListener("click", showHistory);
  $("backHomeBtn").addEventListener("click", resetHome);
  $("exportCsvBtn").addEventListener("click", exportCsv);
  $("settingsBtn").addEventListener("click", () => $("settingsDialog").showModal());
  $("saveSettingsBtn").addEventListener("click", saveSettings);

  window.addEventListener("beforeunload", (event) => {
    if (quiz && !quiz.completed) {
      event.preventDefault();
      event.returnValue = "";
    }
  });
});

function startQuiz() {
  const name = $("studentName").value.trim();
  const quizDate = $("quizDate").value;

  if (!name) {
    alert("請先輸入作答者姓名。");
    $("studentName").focus();
    return;
  }

  const picked = pickBalancedWords(TOTAL_QUESTIONS);
  if (picked.length < TOTAL_QUESTIONS) {
    alert("可出題的中文題庫不足 100 題，請先補足 vocab-data.js 的中文解釋。");
    return;
  }

  const choiceWords = picked.slice(0, TOTAL_CHOICE);
  const fillWords = picked.slice(TOTAL_CHOICE);
  const modes = shuffle([
    ...Array(CHOICE_ZH_TO_EN).fill("zhToEn"),
    ...Array(CHOICE_EN_TO_ZH).fill("enToZh")
  ]);

  quiz = {
    name,
    quizDate,
    choiceQuestions: choiceWords.map((entry, index) => makeChoiceQuestion(entry, index + 1, modes[index])),
    fillQuestions: fillWords.map((entry, index) => makeFillQuestion(entry, index + 1)),
    completed: false
  };

  $("activeName").textContent = name;
  $("activeDate").textContent = quizDate;
  renderChoiceQuestions();
  renderFillQuestions();
  showPanel("quizPanel");

  startTime = Date.now();
  updateTimer();
  timerId = window.setInterval(updateTimer, 1000);
}

function pickBalancedWords(count) {
  const usable = [...window.VOCAB_DATA].filter((item) => item.term && item.zh);
  const groups = new Map();

  shuffle(usable).forEach((item) => {
    const letter = firstLetter(item.term);
    const key = `${item.level || "basic"}-${letter}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  });

  const keys = shuffle([...groups.keys()]).sort((a, b) => {
    const levelA = a.startsWith("basic") ? 0 : 1;
    const levelB = b.startsWith("basic") ? 0 : 1;
    return levelA - levelB || a.localeCompare(b);
  });

  const picked = [];
  while (picked.length < count && keys.length) {
    for (let index = keys.length - 1; index >= 0; index -= 1) {
      const key = keys[index];
      const bucket = groups.get(key);
      if (!bucket.length) {
        keys.splice(index, 1);
        continue;
      }
      picked.push(bucket.pop());
      if (picked.length === count) break;
    }
  }

  return shuffle(picked);
}

function makeChoiceQuestion(entry, number, mode) {
  const optionPool = window.VOCAB_DATA.filter((item) => item.term !== entry.term && item.zh);
  const distractors = shuffle(optionPool).slice(0, 3);
  const options = shuffle([entry, ...distractors]).map((item) => ({
    term: item.term,
    zh: item.zh,
    label: mode === "zhToEn" ? item.term : item.zh,
    correct: item.term === entry.term
  }));

  return {
    id: `c-${number}`,
    number,
    mode,
    entry,
    prompt: mode === "zhToEn" ? `「${entry.zh}」的英文是？` : `"${entry.term}" 的中文意思是？`,
    options
  };
}

function makeFillQuestion(entry, number) {
  return {
    id: `f-${number}`,
    number,
    entry,
    prompt: `請寫出「${entry.zh}」的英文。`,
    hint: `共有 ${letterCount(entry.term)} 個字母`
  };
}

function renderChoiceQuestions() {
  $("choiceQuestions").innerHTML = quiz.choiceQuestions.map((question) => `
    <article class="question" id="${question.id}">
      <div class="q-title">
        <strong>${question.number}.</strong>
        <p>${escapeHtml(question.prompt)}</p>
      </div>
      <div class="options">
        ${question.options.map((option, index) => `
          <label class="option">
            <input type="radio" name="${question.id}" value="${index}">
            <span>${escapeHtml(option.label)}</span>
          </label>
        `).join("")}
      </div>
    </article>
  `).join("");
}

function renderFillQuestions() {
  $("fillQuestions").innerHTML = quiz.fillQuestions.map((question) => `
    <article class="question" id="${question.id}">
      <div class="q-title">
        <strong>${question.number}.</strong>
        <p>${escapeHtml(question.prompt)}<br><span class="hint">${escapeHtml(question.hint)}</span></p>
        <button class="speak-btn" type="button" title="播放單字讀音" data-speak="${escapeAttr(question.entry.term)}">🔊</button>
      </div>
      <div class="fill-row">
        <input type="text" autocomplete="off" autocapitalize="none" spellcheck="false" data-answer="${escapeAttr(question.id)}" placeholder="請輸入英文，大小寫須完全正確">
      </div>
    </article>
  `).join("");

  document.querySelectorAll("[data-speak]").forEach((button) => {
    button.addEventListener("click", () => speakWord(button.dataset.speak));
  });
}

function submitQuiz({ force }) {
  if (!quiz || quiz.completed) return;

  if (!force && !confirm("確定要交卷並計分嗎？")) return;

  window.clearInterval(timerId);
  const durationSeconds = Math.min(TIME_LIMIT_SECONDS, Math.round((Date.now() - startTime) / 1000));
  const results = gradeQuiz();
  const score = results.correctCount * POINTS_PER_QUESTION;

  quiz.completed = true;
  const record = {
    quizVersion: QUIZ_VERSION,
    vocabSource: VOCAB_SOURCE,
    choiceQuestionCount: TOTAL_CHOICE,
    fillQuestionCount: TOTAL_FILL,
    timeLimitMinutes: TIME_LIMIT_SECONDS / 60,
    name: quiz.name,
    quizDate: quiz.quizDate,
    submittedAt: new Date().toISOString(),
    durationSeconds,
    durationText: formatDuration(durationSeconds),
    score,
    correctCount: results.correctCount,
    totalQuestions: TOTAL_QUESTIONS,
    wrongCount: results.wrong.length,
    wrongSummary: results.wrong.map((item) => `${item.part}${item.number}. ${item.prompt} 正解：${item.answer}`).join("；"),
    wrong: results.wrong
  };

  saveHistory(record);
  renderResults(record);
  showPanel("resultPanel");
  sendToGoogleSheets(record);
}

function gradeQuiz() {
  const wrong = [];
  let correctCount = 0;

  quiz.choiceQuestions.forEach((question) => {
    const checked = document.querySelector(`input[name="${question.id}"]:checked`);
    const selectedIndex = checked ? Number(checked.value) : -1;
    const selected = question.options[selectedIndex];
    const isCorrect = Boolean(selected && selected.correct);
    markQuestion(question.id, isCorrect, question.entry.term);
    if (isCorrect) {
      correctCount += 1;
    } else {
      wrong.push({
        part: "選擇",
        number: question.number,
        prompt: question.prompt,
        userAnswer: selected ? selected.label : "未作答",
        answer: question.mode === "zhToEn" ? question.entry.term : question.entry.zh
      });
    }
  });

  quiz.fillQuestions.forEach((question) => {
    const input = document.querySelector(`[data-answer="${question.id}"]`);
    const userAnswer = input.value;
    const isCorrect = exactAnswer(userAnswer) === exactAnswer(question.entry.term);
    markQuestion(question.id, isCorrect, question.entry.term);
    input.disabled = true;
    if (isCorrect) {
      correctCount += 1;
    } else {
      wrong.push({
        part: "填充",
        number: question.number,
        prompt: question.prompt,
        userAnswer: userAnswer || "未作答",
        answer: question.entry.term
      });
    }
  });

  document.querySelectorAll("input[type='radio']").forEach((input) => {
    input.disabled = true;
  });

  return { correctCount, wrong };
}

function markQuestion(id, isCorrect, answer) {
  const node = $(id);
  node.classList.toggle("correct", isCorrect);
  node.classList.toggle("wrong", !isCorrect);
  if (!isCorrect) {
    const feedback = document.createElement("p");
    feedback.className = "feedback";
    feedback.textContent = `正確答案：${answer}`;
    node.appendChild(feedback);
  }
}

function renderResults(record) {
  $("scoreText").textContent = Number(record.score.toFixed(1)).toString();
  $("resultMeta").textContent = `${record.name}｜${record.quizDate}｜花費時間 ${record.durationText}｜答對 ${record.correctCount} / ${record.totalQuestions} 題`;
  $("wrongList").innerHTML = record.wrong.length
    ? record.wrong.map((item) => `
      <div class="wrong-item">
        <strong>${item.part}題 ${item.number}</strong>
        <div>${escapeHtml(item.prompt)}</div>
        <div>作答：${escapeHtml(item.userAnswer)}</div>
        <div>正解：${escapeHtml(item.answer)}</div>
      </div>
    `).join("")
    : `<p>全部答對。</p>`;
}

async function sendToGoogleSheets(record) {
  const endpoint = getSheetEndpoint();
  if (!endpoint) {
    $("syncStatus").textContent = "尚未設定 Google Sheets 網址，成績已先保存在本機。";
    return;
  }

  $("syncStatus").textContent = "正在送出成績到 Google Sheets...";

  try {
    await fetch(endpoint, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(record)
    });
    $("syncStatus").textContent = "成績已送出到 Google Sheets。";
  } catch (error) {
    $("syncStatus").textContent = "Google Sheets 送出失敗，成績已保存在本機，可稍後再匯出 CSV。";
  }
}

function saveHistory(record) {
  const history = getHistory();
  history.unshift(record);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 300)));
}

function getHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
  } catch {
    return [];
  }
}

function showHistory() {
  const history = getHistory();
  $("historyList").innerHTML = history.length
    ? history.map((item) => `
      <div class="history-item">
        <strong>${escapeHtml(item.name)}｜${escapeHtml(item.quizDate)}</strong>
        <div>分數：${item.score} / 100，花費時間：${escapeHtml(item.durationText)}，答錯：${item.wrongCount} 題</div>
      </div>
    `).join("")
    : "<p>目前沒有本機紀錄。</p>";
  showPanel("historyPanel");
}

function exportCsv() {
  const history = getHistory();
  if (!history.length) {
    alert("目前沒有可匯出的成績紀錄。");
    return;
  }

  const rows = [
    ["送出時間", "測驗版本", "題庫來源", "選擇題數", "填充題數", "限時分鐘", "姓名", "測驗日期", "花費時間", "秒數", "分數", "答對題數", "總題數", "答錯題數", "錯題摘要"],
    ...history.map((item) => [
      item.submittedAt,
      item.quizVersion || "",
      item.vocabSource || "",
      item.choiceQuestionCount || "",
      item.fillQuestionCount || "",
      item.timeLimitMinutes || "",
      item.name,
      item.quizDate,
      item.durationText,
      item.durationSeconds,
      item.score,
      item.correctCount,
      item.totalQuestions,
      item.wrongCount,
      item.wrongSummary
    ])
  ];
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `vocabulary-quiz-results-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function saveSettings() {
  localStorage.setItem(ENDPOINT_KEY, $("sheetEndpoint").value.trim());
  $("settingsDialog").close();
}

function getSheetEndpoint() {
  return localStorage.getItem(ENDPOINT_KEY) || CONFIG_ENDPOINT;
}

function resetHome() {
  quiz = null;
  window.clearInterval(timerId);
  $("syncStatus").textContent = "";
  showPanel("startPanel");
}

function showPanel(panelId) {
  ["startPanel", "quizPanel", "resultPanel", "historyPanel"].forEach((id) => {
    $(id).classList.toggle("hidden", id !== panelId);
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function updateTimer() {
  const elapsed = Math.round((Date.now() - startTime) / 1000);
  const remaining = Math.max(0, TIME_LIMIT_SECONDS - elapsed);
  $("timer").textContent = `剩餘 ${formatDuration(remaining)}`;
  const answeredChoice = document.querySelectorAll("#choiceQuestions input[type='radio']:checked").length;
  const answeredFill = [...document.querySelectorAll("#fillQuestions input[type='text']")]
    .filter((input) => input.value.trim()).length;
  $("progressText").textContent = `${answeredChoice + answeredFill} / ${TOTAL_QUESTIONS}`;

  if (remaining <= 0 && quiz && !quiz.completed) {
    alert("作答時間已到，系統將自動交卷。");
    submitQuiz({ force: true });
  }
}

function speakWord(word) {
  if (!("speechSynthesis" in window)) {
    alert("這個瀏覽器不支援語音朗讀。");
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(word);
  utterance.lang = "en-US";
  utterance.rate = 0.82;
  window.speechSynthesis.speak(utterance);
}

function exactAnswer(value) {
  return String(value).trim();
}

function letterCount(value) {
  return String(value).replace(/[^a-zA-Z]/g, "").length;
}

function firstLetter(value) {
  const match = String(value).match(/[a-z]/i);
  return match ? match[0].toUpperCase() : "#";
}

function formatDuration(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function shuffle(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}

function csvCell(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}
