# 國中基礎 1200 單字線上測驗

這是一套可發布到 GitHub Pages 的 1200 單字測驗網站，設計方式比照原本的 2000 單版本。

## 測驗規則

- 選擇題 60 題：30 題中翻英、30 題英翻中
- 填充題 40 題：看中文寫英文
- 每題 1 分，滿分 100 分
- 限時 20 分鐘，到時自動交卷
- 填充題大小寫必須完全正確，大小寫寫錯不計分
- 填充題提供字母數提示，並有喇叭按鈕可播放英文讀音

## 題庫來源

題庫由 `國中基礎1200單字.pdf` 抽取而來，目前包含 1315 筆不重複單字/片語，每筆都有中文解釋。

## Google Sheets

請將 `apps-script.gs` 貼到你的 Google 試算表 Apps Script。這一版預設會把成績寫到「1200單成績」工作表。

取得 Apps Script Web App URL 後，填入 `config.js`：

```js
window.QUIZ_CONFIG = {
  sheetEndpoint: "https://script.google.com/macros/s/你的部署網址/exec"
};
```

## 發布到 GitHub Pages

把此資料夾內的檔案上傳到 GitHub repository，然後在 `Settings` > `Pages` 啟用 GitHub Pages 即可。
