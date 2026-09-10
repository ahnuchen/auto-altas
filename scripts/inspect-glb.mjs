// 零依赖 GLB 结构检查：解析 JSON chunk，输出节点/网格/材质统计
// 用法: node scripts/inspect-glb.mjs <path-to-glb> [--json <out.json>]
import { readFileSync, writeFileSync } from "node:fs";

const file = process.argv[2];
const jsonOut = process.argv.includes("--json") ? process.argv[process.argv.indexOf("--json") + 1] : null;
if (!file) {
  console.error("usage: node inspect-glb.mjs <glb> [--json out.json]");
  process.exit(1);
}

const buf = readFileSync(file);
if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error("not a GLB (magic mismatch)");
const jsonLen = buf.readUInt32LE(12);
const jsonType = buf.readUInt32LE(16);
if (jsonType !== 0x4e4f534a) throw new Error("first chunk is not JSON");
const json = JSON.parse(buf.subarray(20, 20 + jsonLen).toString("utf8"));

const g = json;
const stats = {
  generator: g.asset?.generator ?? "?",
  extensionsUsed: g.extensionsUsed ?? [],
  nodes: g.nodes?.length ?? 0,
  meshes: g.meshes?.length ?? 0,
  materials: g.materials?.length ?? 0,
  textures: g.textures?.length ?? 0,
  images: g.images?.length ?? 0,
  imagesDetail: (g.images ?? []).map((im) => {
    const name = im.uri ?? `bufferView#${im.bufferView}`;
    const mime = im.mimeType ?? "?";
    return `${name} (${mime})`;
  }),
  animations: g.animations?.length ?? 0,
};

// 遍历节点树
const visited = new Set();
const tree = [];
let meshNodeCount = 0;
let triTotal = 0;
let vertTotal = 0;

function countTris(meshIdx) {
  const m = g.meshes[meshIdx];
  let tris = 0,
    verts = 0;
  for (const prim of m.primitives ?? []) {
    const pos = g.accessors[prim.attributes.POSITION];
    if (!pos) continue;
    verts += pos.count;
    const mode = prim.mode ?? 4;
    if (mode === 4) tris += prim.indices ? g.accessors[prim.indices].count / 3 : pos.count / 3;
    else if (mode === 5 || mode === 6) tris += (prim.indices ? g.accessors[prim.indices].count : pos.count) - 2;
  }
  return { tris: Math.round(tris), verts };
}

function walk(nodeIdx, depth, parentPath) {
  if (visited.has(nodeIdx)) return;
  visited.add(nodeIdx);
  const n = g.nodes[nodeIdx];
  const path = parentPath ? `${parentPath}/${n.name ?? nodeIdx}` : (n.name ?? String(nodeIdx));
  if (n.mesh != null) {
    meshNodeCount++;
    const { tris, verts } = countTris(n.mesh);
    triTotal += tris;
    vertTotal += verts;
    const mats = [...new Set((g.meshes[n.mesh].primitives ?? []).map((p) => p.material ?? -1))];
    tree.push({
      depth,
      path,
      mesh: n.mesh,
      meshName: g.meshes[n.mesh].name ?? "",
      tris,
      verts,
      materials: mats.map((i) => (i >= 0 ? g.materials[i]?.name ?? `mat#${i}` : "default")),
    });
  }
  for (const c of n.children ?? []) walk(c, depth + 1, path);
}

for (const s of g.scenes?.[0]?.nodes ?? []) walk(s, 0, "");

// 材质 -> 使用它的 mesh 节点
const matUsage = new Map();
for (const t of tree) {
  for (const mn of t.materials) {
    if (!matUsage.has(mn)) matUsage.set(mn, []);
    matUsage.get(mn).push(t.path.split("/").pop());
  }
}

const summary = { stats, meshNodeCount, triTotal, vertTotal, tree, matUsage: Object.fromEntries(matUsage) };

console.log("== generator:", stats.generator);
console.log("== extensionsUsed:", stats.extensionsUsed.join(", ") || "(none)");
console.log(
  `nodes=${stats.nodes} meshes=${stats.meshes} meshNodes=${meshNodeCount} materials=${stats.materials} textures=${stats.textures} images=${stats.images} animations=${stats.animations}`,
);
console.log(`verts=${vertTotal.toLocaleString()} tris=${triTotal.toLocaleString()}`);
console.log("\n== 材质使用分布 ==");
for (const [mat, nodes] of Object.entries(summary.matUsage)) {
  console.log(`  ${mat}: ${nodes.length} 个节点  [${nodes.slice(0, 8).join(", ")}${nodes.length > 8 ? ", …" : ""}]`);
}
console.log("\n== 网格节点（按面数降序，前 40） ==");
const sorted = [...tree].sort((a, b) => b.tris - a.tris);
for (const t of sorted.slice(0, 40)) {
  console.log(
    `  d${t.depth} ${t.path}  tris=${t.tris.toLocaleString()}  mats=[${t.materials.join(",")}]`,
  );
}
console.log(`\n(共 ${tree.length} 个网格节点，仅显示前 40)`);
console.log("\n== 节点名样本（识别命名规律） ==");
const names = tree.map((t) => t.path.split("/").pop());
console.log(names.slice(0, 60).join(" | "));

if (jsonOut) writeFileSync(jsonOut, JSON.stringify(summary, null, 2));
