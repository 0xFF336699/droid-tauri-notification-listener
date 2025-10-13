import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { initI18n } from "./i18n";

// 初始化应用
const initApp = async () => {
  // 初始化i18n
  await initI18n();
  
  // 渲染应用
  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
};

// 启动应用
initApp().catch(console.error);
