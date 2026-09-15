import { useMemo, useState } from "react";
import type { ModelDef } from "../data/models";
import type { PartInfo } from "../three/glb-scene";
import { useI18n, tr, type L10n } from "../i18n";

export interface SidebarProps {
  models: ModelDef[];
  currentModel: string;
  onModelChange: (id: string) => void;
  loading: boolean;
  progress: number;
  groups: { name: L10n; parts: PartInfo[] }[];
  totalParts: number;
  hidden: Set<string>;
  onTogglePart: (id: string) => void;
  onToggleGroup: (parts: PartInfo[]) => void;
  selectedId: string | null;
  onSelectPart: (id: string) => void;
  query: string;
  onQueryChange: (q: string) => void;
  onClose?: () => void;
}

export default function Sidebar(props: SidebarProps) {
  const { lang, t } = useI18n();
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const model = props.models.find((m) => m.id === props.currentModel);
  const query = props.query.trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!query) return props.groups;
    // 中英文名称都参与匹配，任一语言命中的零件都能搜到
    const hit = (v: L10n) => v.zh.toLowerCase().includes(query) || v.en.toLowerCase().includes(query);
    return props.groups
      .map((g) => ({
        name: g.name,
        parts: g.parts.filter((p) => hit(p.name) || hit(g.name)),
      }))
      .filter((g) => g.parts.length > 0);
  }, [props.groups, query]);

  const toggleCollapse = (name: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  return (
    <aside className="flex w-72 shrink-0 flex-col border-r bg-(--panel) backdrop-blur" style={{ borderColor: "var(--border)" }}>
      <header className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: "var(--border)" }}>
        <div>
          <h1 className="text-sm font-semibold text-(--text)">Auto Atlas</h1>
          <p className="text-xs text-(--muted)">{t("appSubtitle")}</p>
        </div>
        {props.onClose && (
          <button
            className="rounded p-1 text-(--muted) hover:bg-(--hover)"
            onClick={props.onClose}
            aria-label={t("closePanel")}
          >
            ✕
          </button>
        )}
      </header>

      {/* 车型切换 */}
      <div className="border-b px-4 py-3" style={{ borderColor: "var(--border)" }}>
        <p className="mb-2 text-xs font-medium text-(--text-soft)">{t("vehicle")}</p>
        <div className="grid grid-cols-3 gap-1.5">
          {props.models.map((m) => (
            <button
              key={m.id}
              className={
                "rounded-md border px-2 py-1.5 text-xs transition " +
                (m.id === props.currentModel
                  ? "bg-(--active) text-(--accent-text) border-(--accent)"
                  : "text-(--text-soft) border-(--border) hover:text-(--accent-text) hover:border-(--accent)")
              }
              onClick={() => props.onModelChange(m.id)}
            >
              {tr(m.short, lang)}
            </button>
          ))}
        </div>
        {model && (
          <div className="mt-2 space-y-0.5 text-xs text-(--muted)">
            <p>{tr(model.name, lang)}</p>
            <p>
              {props.loading
                ? t("loadingPct", { pct: Math.round(props.progress * 100) })
                : t("partsCount", { n: props.totalParts, license: tr(model.license, lang) })}
            </p>
          </div>
        )}
        {props.loading && (
          <div className="mt-2 h-1 w-full overflow-hidden rounded bg-(--hover)">
            <div
              className="h-full rounded bg-(--accent) transition-all"
              style={{ width: `${Math.max(4, props.progress * 100)}%` }}
            />
          </div>
        )}
      </div>

      <div className="px-4 py-3">
        <input
          value={props.query}
          onChange={(e) => props.onQueryChange(e.target.value)}
          placeholder={t("searchPlaceholder")}
          className="w-full rounded-md border px-3 py-1.5 text-sm text-(--text) placeholder:text-(--muted) bg-(--hover) focus:border-(--accent) focus:outline-none"
          style={{ borderColor: "var(--border)" }}
        />
      </div>

      {/* 分组零件列表 */}
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {filtered.length === 0 && (
          <p className="px-2 text-sm text-(--muted)">{props.loading ? t("loadingModel") : t("noMatch")}</p>
        )}
        {filtered.map((g) => {
          const open = !collapsed.has(g.name.zh);
          const allHidden = g.parts.every((p) => props.hidden.has(p.id));
          return (
            <div key={g.name.zh} className="mb-0.5">
              <div className="flex items-center gap-1 rounded px-2 py-1.5 hover:bg-(--hover)">
                <button
                  className="flex flex-1 items-center gap-2 text-left text-sm text-(--text)"
                  onClick={() => toggleCollapse(g.name.zh)}
                >
                  <span className="text-xs text-(--muted)">{open ? "▾" : "▸"}</span>
                  <span className="flex-1 truncate">{tr(g.name, lang)}</span>
                  <span className="text-xs text-(--muted)">{g.parts.length}</span>
                </button>
                <button
                  className="rounded p-1 text-xs text-(--muted) hover:bg-(--hover)"
                  title={allHidden ? t("showGroup") : t("hideGroup")}
                  onClick={() => props.onToggleGroup(g.parts)}
                >
                  {allHidden ? "🚫" : "👁"}
                </button>
              </div>
              {open && (
                <ul className="ml-4">
                  {g.parts.map((p) => {
                    const hidden = props.hidden.has(p.id);
                    return (
                      <li key={p.id} className="flex items-center gap-1">
                        <button
                          className={
                            "flex flex-1 items-center gap-2 rounded px-2 py-1 text-left text-xs transition " +
                            (p.id === props.selectedId
                              ? "bg-(--active) text-(--accent-text)"
                              : hidden
                                ? "text-(--muted) opacity-60 hover:bg-(--hover)"
                                : "text-(--text-soft) hover:bg-(--hover)")
                          }
                          onClick={() => props.onSelectPart(p.id)}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            props.onTogglePart(p.id);
                          }}
                          title={t("pickHint")}
                        >
                          <span className="flex-1 truncate">{tr(p.name, lang)}</span>
                          <span className="text-[10px] text-(--muted)">{p.tris.toLocaleString()}</span>
                        </button>
                        <button
                          className="rounded p-1 text-[10px] text-(--muted) hover:bg-(--hover)"
                          onClick={() => props.onTogglePart(p.id)}
                          aria-label={hidden ? t("showPart") : t("hidePart")}
                        >
                          {hidden ? "🚫" : "👁"}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      <footer className="border-t px-4 py-2 text-[10px] leading-relaxed text-(--muted)" style={{ borderColor: "var(--border)" }}>
        {t("footerHelp")}
        {model && (
          <>
            <br />
            {t("modelCredit", { credit: tr(model.credit, lang), license: tr(model.license, lang) })}
          </>
        )}
      </footer>
    </aside>
  );
}
