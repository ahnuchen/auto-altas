// 批量优化 GLB：Meshopt 几何压缩 + 贴图转 WebP 并降采样
// 源文件在仓库根目录，产物覆盖 public/models/ 下的同名文件
// 用法: npm run optimize            （处理全部）
//       node scripts/optimize-models.mjs xxx.glb  （只处理指定文件）
import { execFileSync } from "node:child_process";
import { statSync, existsSync, mkdirSync, copyFileSync, unlinkSync } from "node:fs";
import path from "node:path";

// 直接指向 CLI 入口，避免依赖 node_modules/.bin 的 PATH（npm run 之外也能跑）
// （该包未在 exports 里暴露 bin，无法用 require.resolve）
const cliPath = "node_modules/@gltf-transform/cli/bin/cli.js";

const root = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const cliFile = path.resolve(root, "../", cliPath);
const MODELS = [
  "free_bmw_m3_e30.glb",
  "tesla_2018_model_3.glb",
  "2023_chery_arrizo_8_290t.glb",
];
const only = process.argv.slice(2).map((f) => path.basename(f));
const targets = only.length ? MODELS.filter((m) => only.includes(m)) : MODELS;
const outDir = path.resolve(root, "../public/models");

const fmt = (n) => (n / 1024 / 1024).toFixed(1).padStart(6) + " MB";

for (const file of targets) {
  const src = path.resolve(root, "../" + file);
  if (!existsSync(src)) {
    console.error("缺少源文件: " + src);
    process.exit(1);
  }
  const before = statSync(src).size;
  const tmp = src.replace(/\.glb$/, ".opt.glb");
  console.log(`\n== ${file}  (${fmt(before)})`);
  execFileSync(
    process.execPath,
    [
      cliFile,
      "optimize",
      src,
      tmp,
      "--compress", "meshopt", // 几何体 Meshopt 压缩（运行时用本地 MeshoptDecoder 解码）
      "--flatten", "false", // 保留场景层级：语义分组（车门/车轮/保险杠）依赖节点树
      "--instance", "false", // 逐零件位移与拾取不支持 InstancedMesh
      "--texture-compress", "webp", // 贴图转 WebP（EXT_texture_webp，浏览器原生解码）
      "--texture-size", "2048", // 贴图最大边 2048，够移动端首图清晰
    ],
    { stdio: "inherit" },
  );
  mkdirSync(outDir, { recursive: true });
  const dest = path.join(outDir, file);
  copyFileSync(tmp, dest);
  unlinkSync(tmp);
  const after = statSync(dest).size;
  console.log(`   ${fmt(before)}  ->  ${fmt(after)}   (压缩到 ${(100 * after / before).toFixed(1)}%)`);
}
console.log("\n完成。原始 GLB 保留在仓库根目录作为源文件。");
