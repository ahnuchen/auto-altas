# Auto Atlas — 交互式汽车爆炸图鉴

> English documentation: [README.md](README.md)。

**在线体验：** <a href="https://ahnuchen.github.io/auto-altas/" target="_blank" rel="noopener">https://ahnuchen.github.io/auto-altas/</a>

基于真实汽车 GLB 模型的交互式 3D 爆炸图应用，使用 **React 19 + three.js + Vite + Tailwind CSS 4** 构建。支持车型切换、零件拾取、逐件显隐、日间/夜间主题、中英双语界面，爆炸滑块从径向分离平滑过渡到平面货架布局。

## 功能特性

- **多车型切换** — 内置 3 款真实量产车模型，侧栏一键切换，按需加载
- **爆炸分解** — 拖动滑块 0–65% 为径向爆炸（零件沿车身中心向外散开），65–100% 平滑过渡到地面货架布局（零件摊平铺开、互不重叠）
- **零件交互** — 点击选中（高亮 + 详情面板）、悬停提示、逐件/分组显隐、隔离模式、名称搜索
- **语义化命名** — 运行时从 GLB 场景图提取零件，按车型的命名规范适配为中英双语分组与零件名
- **中英双语** — 一键切换界面语言，自动记忆选择（首次按浏览器语言推断），零件/分组名双语搜索
- **日间/夜间主题** — 场景与 UI 双端同步切换，默认日间
- **响应式** — 桌面双栏 / 移动端抽屉布局

## 内置车型

| 车型 | 零件数 | 三角面 | 模型来源 | 许可证 |
|---|---|---|---|---|
| 奇瑞艾瑞泽 8 290T (2023) | 102 | 33 万 | Sketchfab 社区 | 以模型页标注为准 |
| BMW M3 E30 (1986–1991) | 26 | 11.5 万 | Martin Trafas (TinoD2) | CC BY 4.0 |
| Tesla Model 3 (2018) | 162 | 68 万 | Ameer Studio (uchiha.321abc) | CC BY 4.0 |

> 商用部署前请自行核实各模型页面的许可证条款。

## 快速开始

```bash
pnpm install
pnpm dev        # http://localhost:3018/
```

其他命令：

```bash
pnpm build      # 生产构建，输出到 dist/
pnpm check      # TypeScript 类型检查
pnpm inspect    # 解析 GLB 内部结构（节点树/材质/面数）
pnpm optimize   # 批量优化 GLB（见下文）
```

## GLB 优化管线

仓库根目录存放未压缩的源 GLB（约 17–73 MB），`public/models/` 存放优化后的产物（约 2.8–3.7 MB）：

```bash
# 全部处理
pnpm optimize
# 只处理指定文件
node scripts/optimize-models.mjs xxx.glb
```

优化内容：**Meshopt 几何压缩**（运行时使用 three.js 本地解码器，无 CDN 依赖）+ **贴图转 WebP 并降采样至 2048px**。注意必须保留 `--flatten false --instance false`，否则场景层级被拍平，语义分组会失效。

## 部署

- 主站点部署在**根路径**下（`vite.config.ts` 已配置 `base: "/"`），开发环境访问 `http://localhost:3018/`，构建产物输出到 **`dist/`**
- **GitHub Pages** — `pnpm deploy:pages` 会以 `/auto-atlas/` 为 base 构建（`pnpm build:pages`），并把 `dist/` 强推到 `github` 远程的 `gh-pages` 分支，访问地址 <https://ahnuchen.github.io/auto-altas/>。首次部署后需在仓库设置中启用 Pages：Settings → Pages → Source 选择 `gh-pages` 分支
- `vercel.json` 已为 `/models/*.glb` 配置一年 immutable 缓存与 brotli 编码头

## 目录结构

```
auto-altas/
├── public/models/          # 优化后的 GLB（部署产物）
├── scripts/
│   ├── inspect-glb.mjs     # 零依赖 GLB 结构解析（节点树/材质/面数）
│   └── optimize-models.mjs # Meshopt + WebP 批量优化管线
├── src/
│   ├── data/models.ts      # 车型目录与各车型命名/分组适配器
│   ├── three/glb-scene.ts  # 场景核心：加载/归一化/爆炸/拾取/主题
│   ├── components/         # Sidebar（车型切换/搜索/分组）与 DetailPanel
│   └── App.tsx             # 状态编排与 UI 布局
└── *.glb                   # 未压缩源模型（勿部署）
```

## 新增车型

1. 将 GLB 源文件放到仓库根目录
2. `node scripts/optimize-models.mjs <文件名>` 生成优化产物
3. 在 `src/data/models.ts` 中添加 `ModelDef` 条目，按该模型的命名规范实现 `groupName` / `partName` 适配器
4. 构建（`pnpm build`）或 `pnpm dev` 预览
