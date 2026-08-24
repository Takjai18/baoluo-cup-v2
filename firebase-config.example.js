/**
 * 複製呢個檔做 firebase-config.js，填入 Firebase 專案設定。
 *
 * 1. https://console.firebase.google.com/ 開專案
 * 2. 加 Web App → 複製 firebaseConfig
 * 3. 開 Firestore Database（生產模式）→ 貼上 README 嘅 Rules
 * 4. cp firebase-config.example.js firebase-config.js 再填下面
 */
window.BAOLUO_FIREBASE_CONFIG = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
};
