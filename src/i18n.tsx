import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

// 中英双语支持：UI 文案走 t() 字典，数据层名称用 L10n 对象双字段存储
export type Lang = "zh" | "en";

/** 双语文本（数据层：车型名、零件名、分组名等运行时生成的内容） */
export interface L10n {
  zh: string;
  en: string;
}

/** 按当前语言取双语字段 */
export function tr(v: L10n, lang: Lang): string {
  return lang === "zh" ? v.zh : v.en;
}

const zh = {
  partsButton: "☰ 零件",
  toDark: "切换到夜间模式",
  toLight: "切换到日间模式",
  themeLight: "☀️ 日间",
  themeDark: "🌙 夜间",
  toZh: "切换到中文",
  toEn: "切换到英文",
  loadingModel: "模型加载中…",
  loadingHint: "GLB 体积较大，首次加载需要一点时间",
  loadFailed: "模型加载失败",
  explode: "爆炸",
  explodeAria: "爆炸分解程度",
  appSubtitle: "交互式汽车爆炸图鉴",
  closePanel: "关闭面板",
  vehicle: "车型",
  loadingPct: "加载中 {pct}%",
  partsCount: "{n} 个零件 · {license}",
  searchPlaceholder: "搜索零件…",
  noMatch: "没有匹配的零件",
  showGroup: "显示该组",
  hideGroup: "隐藏该组",
  pickHint: "点击选中 · 右键显示/隐藏",
  showPart: "显示零件",
  hidePart: "隐藏零件",
  footerHelp: "点击选中零件 · 右键隐藏 · 拖拽旋转 · 底部滑块爆炸分解",
  modelCredit: "模型：{credit}（{license}）",
  closeDetail: "关闭详情",
  tris: "三角面",
  verts: "顶点",
  material: "材质",
  unnamedMaterial: "未命名材质",
  source: "来源：{credit} · {license}",
  isolateOn: "退出隔离模式",
  isolateOff: "隔离查看此零件",
  noPart: "尚未选中零件",
  noPartHint: "在 3D 视图中点击任意零件，或使用左侧搜索定位。",
};

type Key = keyof typeof zh;

const en: Record<Key, string> = {
  partsButton: "☰ Parts",
  toDark: "Switch to dark mode",
  toLight: "Switch to light mode",
  themeLight: "☀️ Day",
  themeDark: "🌙 Night",
  toZh: "Switch to Chinese",
  toEn: "Switch to English",
  loadingModel: "Loading model…",
  loadingHint: "GLB files are large — the first load may take a moment",
  loadFailed: "Failed to load model",
  explode: "Explode",
  explodeAria: "Explosion level",
  appSubtitle: "Interactive car exploded-view atlas",
  closePanel: "Close panel",
  vehicle: "Model",
  loadingPct: "Loading {pct}%",
  partsCount: "{n} parts · {license}",
  searchPlaceholder: "Search parts…",
  noMatch: "No matching parts",
  showGroup: "Show group",
  hideGroup: "Hide group",
  pickHint: "Click to select · right-click to show/hide",
  showPart: "Show part",
  hidePart: "Hide part",
  footerHelp: "Click to select · right-click to hide · drag to rotate · explode with the slider below",
  modelCredit: "Model: {credit} ({license})",
  closeDetail: "Close details",
  tris: "Triangles",
  verts: "Vertices",
  material: "Material",
  unnamedMaterial: "Unnamed material",
  source: "Source: {credit} · {license}",
  isolateOn: "Exit isolation mode",
  isolateOff: "Isolate this part",
  noPart: "No part selected",
  noPartHint: "Click any part in the 3D view, or use the search on the left.",
};

const DICT: Record<Lang, Record<Key, string>> = { zh, en };

const STORAGE_KEY = "auto-atlas-lang";

function detectLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "zh" || saved === "en") return saved;
  } catch {
    // localStorage 不可用时按浏览器语言兜底
  }
  return navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en";
}

interface I18n {
  lang: Lang;
  setLang: (l: Lang) => void;
  toggleLang: () => void;
  /** 取 UI 文案，{x} 占位符用 params 替换 */
  t: (key: Key, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18n | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(detectLang);

  useEffect(() => {
    document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
    document.title = lang === "zh" ? "Auto Atlas — 交互式汽车爆炸图鉴" : "Auto Atlas — Interactive Car Exploded-View Atlas";
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // 忽略持久化失败
    }
  }, [lang]);

  const value = useMemo<I18n>(
    () => ({
      lang,
      setLang,
      toggleLang: () => setLang((l) => (l === "zh" ? "en" : "zh")),
      t(key, params) {
        let s = DICT[lang][key];
        if (params) {
          for (const [k, v] of Object.entries(params)) {
            s = s.split(`{${k}}`).join(String(v));
          }
        }
        return s;
      },
    }),
    [lang],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
