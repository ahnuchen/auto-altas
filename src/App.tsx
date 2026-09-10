import { useEffect, useMemo, useRef, useState } from "react";
import { MODELS, MODEL_BY_ID } from "./data/models";
import { GlbCarScene, type PartInfo, type ModelStats } from "./three/glb-scene";
import Sidebar from "./components/Sidebar";
import DetailPanel from "./components/DetailPanel";

export type Theme = "light" | "dark";

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<GlbCarScene | null>(null);
  const [modelId, setModelId] = useState(MODELS[0].id);
  const [theme, setTheme] = useState<Theme>("light"); // 默认日间模式
  const [parts, setParts] = useState<PartInfo[]>([]);
  const [stats, setStats] = useState<ModelStats>({ parts: 0, tris: 0, verts: 0 });
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [isolate, setIsolate] = useState(false);
  const [explode, setExplode] = useState(0);
  const [query, setQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 初始化场景
  useEffect(() => {
    if (!containerRef.current) return;
    const scene = new GlbCarScene(containerRef.current, {
      onLoaded: (p, s) => {
        setParts(p);
        setStats(s);
        setLoading(false);
        setProgress(1);
        setHidden(new Set());
        setSelectedId(null);
        setIsolate(false);
        setExplode(0);
      },
      onProgress: (r) => setProgress(r),
      onError: (err) => {
        console.error(err);
        setError(String(err));
        setLoading(false);
      },
      onSelect: (id) => setSelectedId(id),
    });
    sceneRef.current = scene;
    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
  }, []);

  // 切换车型
  useEffect(() => {
    const def = MODEL_BY_ID.get(modelId);
    if (!def || !sceneRef.current) return;
    setLoading(true);
    setProgress(0);
    setError(null);
    sceneRef.current.loadModel(def);
  }, [modelId]);

  // 主题同步到场景与 <html>
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    sceneRef.current?.setTheme(theme);
  }, [theme]);

  // 状态同步到场景
  useEffect(() => {
    sceneRef.current?.update({ selected: selectedId, hidden, isolate, explode });
  }, [selectedId, hidden, isolate, explode]);

  const groups = useMemo(() => {
    const map = new Map<string, PartInfo[]>();
    for (const p of parts) {
      if (!map.has(p.group)) map.set(p.group, []);
      map.get(p.group)!.push(p);
    }
    return [...map.entries()].map(([name, list]) => ({ name, parts: list }));
  }, [parts]);

  const togglePart = (id: string) => {
    setIsolate(false);
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleGroup = (list: PartInfo[]) => {
    setIsolate(false);
    setHidden((prev) => {
      const allHidden = list.every((p) => prev.has(p.id));
      const next = new Set(prev);
      for (const p of list) {
        if (allHidden) next.delete(p.id);
        else next.add(p.id);
      }
      return next;
    });
  };

  const selectPart = (id: string) => {
    setSelectedId(id);
    setSidebarOpen(false);
  };

  const model = MODEL_BY_ID.get(modelId) ?? null;
  const selected = selectedId ? (parts.find((p) => p.id === selectedId) ?? null) : null;

  const sidebar = (
    <Sidebar
      models={MODELS}
      currentModel={modelId}
      onModelChange={setModelId}
      loading={loading}
      progress={progress}
      groups={groups}
      totalParts={stats.parts}
      hidden={hidden}
      onTogglePart={togglePart}
      onToggleGroup={toggleGroup}
      selectedId={selectedId}
      onSelectPart={selectPart}
      query={query}
      onQueryChange={setQuery}
      onClose={() => setSidebarOpen(false)}
    />
  );

  const detail = (
    <DetailPanel
      part={selected}
      model={model}
      isolate={isolate}
      onToggleIsolate={() => setIsolate((v) => !v)}
      onClose={() => {
        setIsolate(false);
        setSelectedId(null);
      }}
    />
  );

  return (
    <div className="flex h-full overflow-hidden text-(--text)" style={{ background: "var(--bg)" }}>
      {/* 桌面侧栏 */}
      <div className="hidden lg:flex">{sidebar}</div>

      {/* 移动端侧栏抽屉 */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex">{sidebar}</div>
        </div>
      )}

      <main className="relative min-w-0 flex-1">
        <div ref={containerRef} className="absolute inset-0" />

        {/* 移动端工具条 */}
        <button
          className="absolute left-3 top-3 z-10 rounded-md border px-3 py-1.5 text-sm backdrop-blur lg:hidden"
          style={{ borderColor: "var(--border)", background: "var(--panel)", color: "var(--text)" }}
          onClick={() => setSidebarOpen(true)}
        >
          ☰ 零件
        </button>

        {/* 主题切换 */}
        <button
          className="absolute right-3 top-3 z-10 rounded-full border px-3 py-1.5 text-sm backdrop-blur transition hover:opacity-80"
          style={{ borderColor: "var(--border)", background: "var(--panel)", color: "var(--text)" }}
          onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
          title={theme === "light" ? "切换到夜间模式" : "切换到日间模式"}
        >
          {theme === "light" ? "☀️ 日间" : "🌙 夜间"}
        </button>

        {/* 加载遮罩 */}
        {loading && !error && (
          <div className="absolute inset-0 z-10 flex items-center justify-center backdrop-blur-sm" style={{ background: "var(--overlay)" }}>
            <div className="w-64 text-center">
              <p className="text-sm text-(--text-soft)">模型加载中…</p>
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded bg-(--hover)">
                <div
                  className="h-full rounded bg-(--accent) transition-all"
                  style={{ width: `${Math.max(4, progress * 100)}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-(--muted)">GLB 体积较大，首次加载需要一点时间</p>
            </div>
          </div>
        )}

        {error && (
          <div
            className="absolute inset-x-0 top-16 z-10 mx-auto w-fit rounded-md border px-4 py-2 text-sm"
            style={{ background: "var(--error-bg)", color: "var(--error-text)", borderColor: "var(--error-text)" }}
          >
            模型加载失败：{error}
          </div>
        )}

        {/* 爆炸滑块 */}
        <div
          className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-3 rounded-full border px-4 py-2 backdrop-blur"
          style={{ borderColor: "var(--border)", background: "var(--panel)" }}
        >
          <span className="text-xs text-(--muted)">爆炸</span>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(explode * 100)}
            onChange={(e) => setExplode(Number(e.target.value) / 100)}
            className="w-40 accent-(--accent) md:w-56"
            aria-label="爆炸分解程度"
          />
          <span className="w-8 text-right text-xs tabular-nums text-(--muted)">
            {Math.round(explode * 100)}%
          </span>
        </div>

        {/* 移动端底部详情 */}
        {selected && (
          <div className="absolute inset-x-0 bottom-16 z-10 lg:hidden">
            <div className="mx-3 overflow-hidden rounded-xl border backdrop-blur" style={{ borderColor: "var(--border)", background: "var(--panel-solid)" }}>
              {detail}
            </div>
          </div>
        )}
      </main>

      {/* 桌面详情面板 */}
      <div className="hidden lg:flex">{detail}</div>
    </div>
  );
}
