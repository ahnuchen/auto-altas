import * as T from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { ModelDef } from "../data/models";

export interface PartInfo {
  id: string;
  name: string;
  group: string;
  tris: number;
  verts: number;
  materials: string[];
  /** 未爆炸时的静止位置 */
  base: T.Vector3;
  /** 零件包围盒尺寸 */
  size: T.Vector3;
  /** 爆炸方向（单位向量） */
  dir: T.Vector3;
  /** 每个零件的爆炸距离系数，制造错落感 */
  boost: number;
}

export interface ModelStats {
  parts: number;
  tris: number;
  verts: number;
}

export interface SceneState {
  selected: string | null;
  hidden: Set<string>;
  isolate: boolean;
  explode: number;
}

export interface SceneCallbacks {
  onLoaded(parts: PartInfo[], stats: ModelStats): void;
  onProgress(ratio: number): void;
  onError(err: unknown): void;
  onSelect(id: string | null): void;
}

export type SceneTheme = "light" | "dark";

const EXPLODE_DIST = 2.4;
const TARGET_SIZE = 4.6; // 整车最长水平尺寸归一化到 4.6m
const FLAT_FROM = 0.65; // 爆炸进度超过此值后开始向平面货架布局过渡

const THEME_CFG: Record<SceneTheme, { bg: number; gridA: number; gridB: number; hemi: number; key: number; fill: number; fogNear: number; fogFar: number; exposure: number }> = {
  light: { bg: 0xe6ecf3, gridA: 0xc4cdd9, gridB: 0xdde4ee, hemi: 0.9, key: 1.0, fill: 0.3, fogNear: 22, fogFar: 70, exposure: 1.0 },
  dark: { bg: 0x0b1220, gridA: 0x334155, gridB: 0x1e293b, hemi: 0.55, key: 1.2, fill: 0.35, fogNear: 14, fogFar: 40, exposure: 1.1 },
};

/** 找到模型语义根节点在路径中的位置 */
function relSegments(node: T.Object3D, rootSegment: string): string[] {
  const chain: string[] = [];
  let cur: T.Object3D | null = node;
  while (cur) {
    chain.unshift(cur.name || cur.uuid);
    cur = cur.parent;
  }
  const idx = chain.findIndex((n) => n === rootSegment);
  return idx >= 0 ? chain.slice(idx + 1) : chain;
}

function hash01(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return ((h >>> 0) % 1000) / 1000;
}

const _radial = new T.Vector3();

export class GlbCarScene {
  private container: HTMLElement;
  private cb: SceneCallbacks;
  private renderer: T.WebGLRenderer;
  private scene: T.Scene;
  private camera: T.PerspectiveCamera;
  private controls: OrbitControls;
  private modelRoot: T.Group; // 当前车型的容器
  private partsGroup: T.Group = new T.Group(); // 扁平化的零件容器
  private parts: PartInfo[] = [];
  private meshById = new Map<string, T.Mesh>();
  private latest: SceneState = { selected: null, hidden: new Set(), isolate: false, explode: 0 };
  private amount = 0;
  private frame = 0;
  private raycaster = new T.Raycaster();
  private pointer = new T.Vector2();
  private tooltip: HTMLDivElement;
  private observer: ResizeObserver;
  private down: { x: number; y: number; t: number } | null = null;
  private clock = new T.Clock();
  private loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  private currentUrl: string | null = null;
  // 主题相关引用
  private hemiLight!: T.HemisphereLight;
  private keyLight!: T.DirectionalLight;
  private fillLight!: T.DirectionalLight;
  private groundGrid!: T.GridHelper;
  // 平面货架布局（爆炸 100% 时的终点位置）
  private grid = new Map<string, T.Vector3>();
  private gridWidth = 0;
  private gridDepth = 0;

  constructor(container: HTMLElement, cb: SceneCallbacks) {
    this.container = container;
    this.cb = cb;

    this.renderer = new T.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.domElement.style.touchAction = "none";
    container.appendChild(this.renderer.domElement);

    this.scene = new T.Scene();
    this.scene.background = new T.Color(0x0b1220);
    this.scene.fog = new T.Fog(0x0b1220, 14, 40);

    this.camera = new T.PerspectiveCamera(45, 1, 0.1, 200);
    this.camera.position.set(6, 2.8, 6.2);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 0.8, 0);
    this.controls.enableDamping = true;
    this.controls.minDistance = 2;
    this.controls.maxDistance = 40;
    this.controls.maxPolarAngle = Math.PI * 0.55;

    // 环境光照（PBR 反射需要）
    const pmrem = new T.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    this.scene.add(new T.HemisphereLight(0xdfe8f2, 0x0b1220, 0.55));
    this.hemiLight = this.scene.children[this.scene.children.length - 1] as T.HemisphereLight;
    const key = new T.DirectionalLight(0xffffff, 1.2);
    key.position.set(5, 8, 4);
    this.scene.add(key);
    this.keyLight = key;
    const fill = new T.DirectionalLight(0x88aaff, 0.35);
    fill.position.set(-6, 4, -5);
    this.scene.add(fill);
    this.fillLight = fill;

    this.setTheme("light");

    this.modelRoot = new T.Group();
    this.scene.add(this.modelRoot);

    this.tooltip = document.createElement("div");
    this.tooltip.className = "car-tooltip";
    this.tooltip.hidden = true;
    container.appendChild(this.tooltip);

    const el = this.renderer.domElement;
    el.addEventListener("pointerdown", this.onDown);
    el.addEventListener("pointermove", this.onMove);
    el.addEventListener("pointerup", this.onUp);
    el.addEventListener("pointercancel", this.onCancel);
    el.addEventListener("pointerleave", this.onCancel);

    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(container);
    this.resize();
    this.animate();
  }

  /** 日间/夜间主题切换：背景、雾、地面网格与灯光强度同步调整 */
  setTheme(theme: SceneTheme) {
    const cfg = THEME_CFG[theme];
    this.scene.background = new T.Color(cfg.bg);
    this.scene.fog = new T.Fog(cfg.bg, cfg.fogNear, cfg.fogFar);
    if (this.hemiLight) {
      this.hemiLight.intensity = cfg.hemi;
      this.keyLight.intensity = cfg.key;
      this.fillLight.intensity = cfg.fill;
    }
    this.renderer.toneMappingExposure = cfg.exposure;
    if (this.groundGrid) {
      this.scene.remove(this.groundGrid);
      this.groundGrid.dispose();
    }
    this.groundGrid = new T.GridHelper(30, 30, cfg.gridA, cfg.gridB);
    this.groundGrid.position.y = 0.001;
    this.scene.add(this.groundGrid);
  }

  /** 加载并解析一个车型；可重复调用以切换车型 */
  loadModel(def: ModelDef) {
    if (this.currentUrl === def.file) return;
    this.currentUrl = def.file;
    this.disposeModel();
    this.loader.load(
      def.file,
      (gltf) => {
        if (this.currentUrl !== def.file) return; // 期间又切换了车型
        try {
          this.prepareModel(gltf.scene, def);
        } catch (err) {
          this.cb.onError(err);
        }
      },
      (ev) => {
        if (ev.total > 0) this.cb.onProgress(ev.loaded / ev.total);
      },
      (err) => this.cb.onError(err),
    );
  }

  private disposeModel() {
    this.parts = [];
    this.meshById.clear();
    this.grid.clear();
    this.modelRoot.clear();
    this.modelRoot.traverse((o) => {
      const mesh = o as T.Mesh;
      if (mesh.isMesh) {
        mesh.geometry?.dispose();
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const m of mats) {
          if (!m) continue;
          for (const v of Object.values(m)) {
            if (v instanceof T.Texture) v.dispose();
          }
          m.dispose();
        }
      }
    });
  }

  private prepareModel(root: T.Group, def: ModelDef) {
    // 1. 归一化：缩放到 4.6m，落地、居中
    const rawBox = new T.Box3().setFromObject(root);
    const rawSize = rawBox.getSize(new T.Vector3());
    const scale = TARGET_SIZE / Math.max(rawSize.x, rawSize.z, 0.001);
    root.scale.setScalar(scale);
    root.updateMatrixWorld(true);
    const box = new T.Box3().setFromObject(root);
    const center = box.getCenter(new T.Vector3());
    root.position.x -= center.x;
    root.position.z -= center.z;
    root.position.y -= box.min.y;
    root.updateMatrixWorld(true);

    this.modelRoot.add(root);
    this.partsGroup = new T.Group();
    this.modelRoot.add(this.partsGroup);

    // 2. 收集零件：每个 Mesh 一个零件，attach 到扁平容器（保留世界变换）
    const carBox = new T.Box3().setFromObject(root);
    const carCenter = carBox.getCenter(new T.Vector3());
    const meshes: T.Mesh[] = [];
    const pending: { mesh: T.Mesh; rel: string[]; material: string; tris: number; verts: number }[] = [];

    root.traverse((o) => {
      const mesh = o as T.Mesh;
      if (!mesh.isMesh) return;
      const geo = mesh.geometry as T.BufferGeometry;
      const pos = geo.getAttribute("position");
      const verts = pos ? pos.count : 0;
      const tris = geo.index ? Math.round(geo.index.count / 3) : Math.round(verts / 3);
      const matNames = (Array.isArray(mesh.material) ? mesh.material : [mesh.material])
        .filter(Boolean)
        .map((m) => (m as T.MeshStandardMaterial).name || "未命名材质");
      // 多材质共享会阻断逐件高亮，这里克隆为独立材质
      mesh.material = Array.isArray(mesh.material)
        ? mesh.material.map((m) => m.clone())
        : (mesh.material as T.Material).clone();
      meshes.push(mesh);
      pending.push({
        mesh,
        rel: relSegments(mesh, def.rootSegment),
        material: matNames[0] ?? "",
        tris,
        verts,
      });
    });

    for (const { mesh, rel, material, tris, verts } of pending) {
      const id = mesh.uuid;
      mesh.userData.partId = id;
      this.partsGroup.attach(mesh); // 保留世界变换地移入扁平容器
      const partBox = new T.Box3().setFromObject(mesh);
      const partCenter = partBox.getCenter(new T.Vector3());
      const partSize = partBox.getSize(new T.Vector3());
      const dir = partCenter.clone().sub(carCenter);
      if (dir.lengthSq() < 1e-6) dir.set(0, 1, 0);
      dir.normalize();
      this.parts.push({
        id,
        name: def.partName(rel, material),
        group: def.groupName(rel, material),
        tris,
        verts,
        materials: [material],
        base: mesh.position.clone(),
        size: partSize,
        dir,
        boost: 0.55 + 0.45 * hash01(id),
      });
      this.meshById.set(id, mesh);
    }

    // 3. 同名零件消歧：组内重名追加方位后缀或序号
    this.disambiguate();
    // 4. 预计算平面货架布局（爆炸 100% 时的终点）
    this.computeGridLayout();
    this.cb.onLoaded(
      this.parts,
      {
        parts: this.parts.length,
        tris: this.parts.reduce((s, p) => s + p.tris, 0),
        verts: this.parts.reduce((s, p) => s + p.verts, 0),
      },
    );
  }

  /** 组内同名零件：对称件加（前左）等后缀，非对称件加序号 */
  private disambiguate() {
    const box = new T.Box3().setFromObject(this.partsGroup);
    const center = box.getCenter(new T.Vector3());
    const size = box.getSize(new T.Vector3());
    const longX = size.x >= size.z;
    const eps = 0.1;

    const counts = new Map<string, number>();
    for (const p of this.parts) counts.set(`${p.group}/${p.name}`, (counts.get(`${p.group}/${p.name}`) ?? 0) + 1);

    const idx = new Map<string, number>();
    for (const p of this.parts) {
      const key = `${p.group}/${p.name}`;
      if ((counts.get(key) ?? 0) <= 1) continue;
      const mesh = this.meshById.get(p.id)!;
      const c = new T.Box3().setFromObject(mesh).getCenter(new T.Vector3());
      const lon = longX ? c.x : c.z;
      const lat = longX ? c.z : c.x;
      const lonC = longX ? center.x : center.z;
      const latC = longX ? center.z : center.x;
      const spanLon = longX ? size.x : size.z;
      const spanLat = longX ? size.z : size.x;
      const lonLabel = lon > lonC + eps * spanLon ? "前" : lon < lonC - eps * spanLon ? "后" : "";
      const latLabel = lat > latC + eps * spanLat ? "右" : lat < latC - eps * spanLat ? "左" : "";
      if (lonLabel || latLabel) {
        p.name += `（${lonLabel}${latLabel}）`;
      } else {
        const n = (idx.get(key) ?? 0) + 1;
        idx.set(key, n);
        p.name += ` · ${n}`;
      }
    }
  }

  /**
   * 平面货架布局：按分组排序，逐件放入不超过 MAX_ROW 的行，
   * 行沿 Z 堆叠铺在地面（y = 零件半高），作为爆炸 100% 时的终点位置。
   */
  private computeGridLayout() {
    const PAD = 0.45;
    const MAX_ROW = 14;
    const order = new Map<string, number>();
    for (const p of this.parts) if (!order.has(p.group)) order.set(p.group, order.size);
    const sorted = [...this.parts].sort(
      (a, b) =>
        order.get(a.group)! - order.get(b.group)! || a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
    );
    const clamp = (v: number) => Math.max(0.2, v);
    const rows: { items: PartInfo[]; w: number; d: number }[] = [];
    let row: { items: PartInfo[]; w: number; d: number } = { items: [], w: 0, d: 0 };
    for (const p of sorted) {
      const sx = clamp(p.size.x);
      if (row.items.length && row.w + sx + PAD > MAX_ROW) {
        rows.push(row);
        row = { items: [], w: 0, d: 0 };
      }
      row.items.push(p);
      row.w += sx + PAD;
      row.d = Math.max(row.d, clamp(p.size.z));
    }
    if (row.items.length) rows.push(row);

    this.grid.clear();
    // 先累加每行的 Z 起点与总深度，再整体居中（围绕原点对称），
    // 否则货架会偏向 +Z 一侧，爆炸 100% 时零件不在视野中心。
    let z = 0;
    const rowStart: number[] = [];
    for (const r of rows) {
      rowStart.push(z);
      z += r.d + PAD;
    }
    const totalDepth = Math.max(z - PAD, 3);
    rows.forEach((r, i) => {
      let x = -r.w / 2;
      for (const p of r.items) {
        this.grid.set(
          p.id,
          new T.Vector3(
            x + clamp(p.size.x) / 2,
            Math.max(0.02, p.size.y / 2),
            rowStart[i] + r.d / 2 - totalDepth / 2,
          ),
        );
        x += clamp(p.size.x) + PAD;
      }
    });
    this.gridWidth = MAX_ROW;
    this.gridDepth = Math.max(totalDepth, 3);
  }

  update(state: SceneState) {
    this.latest = state;
    this.applySelection();
  }

  private applySelection() {
    for (const [id, mesh] of this.meshById) {
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) {
        const std = m as T.MeshStandardMaterial;
        if (!std.emissive) continue;
        if (id === this.latest.selected) {
          std.emissive.setHex(0x14b8a6);
          std.emissiveIntensity = 0.45;
        } else {
          std.emissive.setHex(0x000000);
          std.emissiveIntensity = 1;
        }
      }
    }
  }

  /** 爆炸程度变化时把相机拉远；完全展开后兼顾平面货架的占地 */
  private refit(explodeTarget: number) {
    const span = Math.max(this.gridWidth, this.gridDepth, 8);
    const far = Math.max(11, span * 0.9 + 5);
    const distance = T.MathUtils.lerp(7.5, far, explodeTarget);
    const dir = this.camera.position.clone().sub(this.controls.target).normalize();
    this.camera.position.copy(this.controls.target).addScaledVector(dir, distance);
  }

  private pick(clientX: number, clientY: number): string | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const targets: T.Object3D[] = [];
    for (const mesh of this.meshById.values()) {
      if (mesh.visible) targets.push(mesh);
    }
    const hits = this.raycaster.intersectObjects(targets, false);
    return hits.length ? (hits[0].object.userData.partId as string) : null;
  }

  private onDown = (e: PointerEvent) => {
    this.tooltip.hidden = true;
    this.down = { x: e.clientX, y: e.clientY, t: performance.now() };
  };

  private onMove = (e: PointerEvent) => {
    if (e.buttons || this.down) {
      this.tooltip.hidden = true;
      return;
    }
    const id = this.pick(e.clientX, e.clientY);
    this.tooltip.hidden = !id;
    this.renderer.domElement.style.cursor = id ? "pointer" : "grab";
    if (id) {
      const rect = this.container.getBoundingClientRect();
      const part = this.parts.find((p) => p.id === id);
      this.tooltip.textContent = part ? `${part.group} · ${part.name}` : id;
      this.tooltip.style.left = Math.min(e.clientX - rect.left + 14, rect.width - 160) + "px";
      this.tooltip.style.top = Math.min(e.clientY - rect.top + 16, rect.height - 40) + "px";
    }
  };

  private onUp = (e: PointerEvent) => {
    const d = this.down;
    this.down = null;
    if (!d) return;
    const moved = Math.hypot(e.clientX - d.x, e.clientY - d.y);
    const elapsed = performance.now() - d.t;
    if (moved > 8 || elapsed > 500) return; // 拖拽旋转，不是点选
    this.cb.onSelect(this.pick(e.clientX, e.clientY));
  };

  private onCancel = () => {
    this.down = null;
    this.tooltip.hidden = true;
  };

  private resize() {
    const w = this.container.clientWidth;
    const h = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private animate = () => {
    this.frame = requestAnimationFrame(this.animate);
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.controls.update();
    const target = this.latest.explode;
    if (target !== this.amount) {
      const next = T.MathUtils.damp(this.amount, target, 6, dt);
      if (Math.abs(next - this.amount) > 0.00001) {
        this.amount = next;
      } else {
        this.amount = target;
      }
      this.refit(this.amount);
    }
    const visibleSet = new Set<string>();
    for (const p of this.parts) {
      if (this.latest.hidden.has(p.id)) continue;
      if (this.latest.isolate && p.id !== this.latest.selected) continue;
      visibleSet.add(p.id);
    }
    for (const [id, mesh] of this.meshById) {
      const on = visibleSet.has(id);
      mesh.visible = on;
      if (!on) continue;
      const p = this.parts.find((q) => q.id === id);
      if (!p) continue;
      if (this.amount > 0.0001) {
        // 前段：径向爆炸；后段：平滑过渡到平面货架布局（与人体图鉴一致）
        _radial.copy(p.base).addScaledVector(p.dir, this.amount * EXPLODE_DIST * p.boost);
        const flatT = T.MathUtils.smoothstep(this.amount, FLAT_FROM, 1);
        if (flatT > 0) {
          const cell = this.grid.get(id);
          if (cell) _radial.lerp(cell, flatT);
        }
        mesh.position.copy(_radial);
      } else {
        mesh.position.copy(p.base);
      }
    }
    this.renderer.render(this.scene, this.camera);
  };

  dispose() {
    cancelAnimationFrame(this.frame);
    this.observer.disconnect();
    const el = this.renderer.domElement;
    el.removeEventListener("pointerdown", this.onDown);
    el.removeEventListener("pointermove", this.onMove);
    el.removeEventListener("pointerup", this.onUp);
    el.removeEventListener("pointercancel", this.onCancel);
    el.removeEventListener("pointerleave", this.onCancel);
    this.controls.dispose();
    this.renderer.dispose();
    this.groundGrid?.dispose();
    this.tooltip.remove();
    el.remove();
  }
}
