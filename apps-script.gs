const SHEET_NAME = '1200單成績';

const HEADERS = [
  '送出時間',
  '測驗版本',
  '題庫來源',
  '選擇題數',
  '填充題數',
  '限時分鐘',
  '姓名',
  '測驗日期',
  '花費時間',
  '秒數',
  '分數',
  '答對題數',
  '總題數',
  '答錯題數',
  '錯題摘要'
];

function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, message: 'Basic 1200 vocabulary quiz receiver is ready.' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const payload = JSON.parse(e.postData.contents || '{}');
    const sheet = getResultSheet_();

    sheet.appendRow([
      new Date(),
      payload.quizVersion || '',
      payload.vocabSource || '',
      payload.choiceQuestionCount || 60,
      payload.fillQuestionCount || 40,
      payload.timeLimitMinutes || 20,
      payload.name || '',
      payload.quizDate || '',
      payload.durationText || '',
      payload.durationSeconds || 0,
      payload.score || 0,
      payload.correctCount || 0,
      payload.totalQuestions || 100,
      payload.wrongCount || 0,
      payload.wrongSummary || ''
    ]);

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function getResultSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }

  ensureHeaders_(sheet);
  return sheet;
}

function ensureHeaders_(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
    return;
  }

  const secondHeader = sheet.getRange(1, 2).getValue();

  if (secondHeader !== HEADERS[1]) {
    sheet.insertColumnsAfter(1, 5);
  }

  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  sheet.setFrozenRows(1);
}
