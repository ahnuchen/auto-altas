import { createRoot } from "react-dom/client";
import App from "./App";
import { I18nProvider } from "./i18n";
import "./styles.css";

// 控制台可见的构建标识，用于确认线上跑的是哪次构建
console.info(`[auto-atlas] build: ${__BUILD_TIME__}`);

createRoot(document.getElementById("root")!).render(
  <I18nProvider>
    <App />
  </I18nProvider>,
);
