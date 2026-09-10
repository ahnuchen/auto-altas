import type { ModelDef } from "../data/models";
import type { PartInfo } from "../three/glb-scene";

interface DetailPanelProps {
  part: PartInfo | null;
  model: ModelDef | null;
  isolate: boolean;
  onToggleIsolate: () => void;
  onClose: () => void;
}

export default function DetailPanel(props: DetailPanelProps) {
  const part = props.part;
  return (
    <aside className="flex w-80 shrink-0 flex-col border-l bg-(--panel) backdrop-blur" style={{ borderColor: "var(--border)" }}>
      {part ? (
        <>
          <header className="flex items-start justify-between border-b px-4 py-3" style={{ borderColor: "var(--border)" }}>
            <div>
              <h2 className="text-sm font-semibold text-(--text)">{part.name}</h2>
              <span className="mt-1 inline-block rounded-full bg-(--active) px-2 py-0.5 text-xs text-(--accent-text)">
                {part.group}
              </span>
            </div>
            <button
              className="rounded p-1 text-(--muted) hover:bg-(--hover)"
              onClick={props.onClose}
              aria-label="关闭详情"
            >
              ✕
            </button>
          </header>
          <div className="flex-1 px-4 py-3">
            <dl className="space-y-2 text-xs">
              <div className="flex justify-between">
                <dt className="text-(--muted)">三角面</dt>
                <dd className="tabular-nums text-(--text-soft)">{part.tris.toLocaleString()}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-(--muted)">顶点</dt>
                <dd className="tabular-nums text-(--text-soft)">{part.verts.toLocaleString()}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-(--muted)">材质</dt>
                <dd className="max-w-40 truncate text-right text-(--text-soft)">{part.materials.join(", ")}</dd>
              </div>
            </dl>
            {props.model && (
              <p className="mt-4 text-[10px] leading-relaxed text-(--muted)">
                来源：{props.model.credit} · {props.model.license}
              </p>
            )}
          </div>
          <div className="border-t px-4 py-3" style={{ borderColor: "var(--border)" }}>
            <button
              className={
                "w-full rounded-md px-3 py-2 text-sm transition " +
                (props.isolate
                  ? "bg-(--accent-strong) text-white hover:opacity-90"
                  : "border text-(--text-soft) hover:text-(--accent-text) hover:border-(--accent)")
              }
              style={props.isolate ? undefined : { borderColor: "var(--border)" }}
              onClick={props.onToggleIsolate}
            >
              {props.isolate ? "退出隔离模式" : "隔离查看此零件"}
            </button>
          </div>
        </>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <p className="text-sm text-(--text-soft)">尚未选中零件</p>
          <p className="mt-2 text-xs leading-relaxed text-(--muted)">
            在 3D 视图中点击任意零件，或使用左侧搜索定位。
          </p>
        </div>
      )}
    </aside>
  );
}
