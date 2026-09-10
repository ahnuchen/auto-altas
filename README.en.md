# Auto Atlas — Interactive Car Exploded View

An interactive 3D exploded-view application built on real production-car GLB models, powered by **React 19 + three.js + Vite + Tailwind CSS 4**. Features model switching, part picking, per-part visibility, day/night themes, and an explosion slider that blends from radial separation into a flat shelf layout.

> 中文文档见 [README.md](README.md)。

## Features

- **Multi-model switching** — 3 real production cars built in, one-click switching in the sidebar with lazy loading
- **Exploded view** — slider 0–65% is a radial explosion (parts fly outward from the body center); 65–100% smoothly transitions to a flat ground shelf layout (parts laid out without overlap)
- **Part interaction** — click to select (highlight + detail panel), hover tooltips, per-part / per-group visibility, isolate mode, name search
- **Semantic naming** — parts are extracted from the GLB scene graph at runtime and translated into Chinese groups/names via per-model naming adapters
- **Day/night themes** — 3D scene and UI switch in sync, defaults to light
- **Responsive** — dual-pane desktop layout / mobile drawer

## Included Models

| Model | Parts | Triangles | Source | License |
|---|---|---|---|---|
| Chery Arrizo 8 290T (2023) | 102 | 332k | Sketchfab community | See model page |
| BMW M3 E30 (1986–1991) | 26 | 115k | Martin Trafas (TinoD2) | CC BY 4.0 |
| Tesla Model 3 (2018) | 162 | 684k | Ameer Studio (uchiha.321abc) | CC BY 4.0 |

> Verify each model's license terms on its source page before commercial use.

## Getting Started

```bash
npm install
npm run dev        # http://localhost:3018/auto-atlas/
```

Other commands:

```bash
npm run build      # production build, outputs to dist/auto-atlas/
npm run check      # TypeScript type check
npm run inspect    # dump GLB internals (node tree / materials / triangles)
npm run optimize   # batch GLB optimization (see below)
```

## GLB Optimization Pipeline

Uncompressed source GLBs (17–73 MB) live in the repository root; optimized artifacts (2.8–3.7 MB) live in `public/models/`:

```bash
# Optimize all models
npm run optimize
# Optimize a single file
node scripts/optimize-models.mjs xxx.glb
```

What it does: **Meshopt geometry compression** (decoded at runtime by a local decoder shipped with three.js — no CDN dependency) + **textures converted to WebP and downscaled to 2048px**. Keep `--flatten false --instance false`, otherwise the scene hierarchy is flattened and semantic grouping breaks.

## Deployment

- The site is served under the **`/auto-atlas/` sub-path** (`base` is configured in `vite.config.ts`); in development visit `http://localhost:3018/auto-atlas/`
- Build output goes to **`dist/auto-atlas/`** — upload that directory's contents to the server's `auto-atlas` folder
- `vercel.json` configures one-year immutable caching and brotli encoding for `/auto-atlas/models/*.glb`

## Project Structure

```
auto-altas/
├── public/models/          # Optimized GLBs (deployment artifacts)
├── scripts/
│   ├── inspect-glb.mjs     # Zero-dependency GLB inspector (node tree / materials / triangles)
│   └── optimize-models.mjs # Meshopt + WebP batch optimization pipeline
├── src/
│   ├── data/models.ts      # Model catalog and per-model naming/grouping adapters
│   ├── three/glb-scene.ts  # Scene core: loading / normalization / explosion / picking / themes
│   ├── components/         # Sidebar (model switching / search / groups) and DetailPanel
│   └── App.tsx             # State orchestration and layout
└── *.glb                   # Uncompressed source models (do not deploy)
```

## Adding a New Model

1. Place the GLB source file in the repository root
2. Run `node scripts/optimize-models.mjs <filename>` to produce the optimized artifact
3. Add a `ModelDef` entry in `src/data/models.ts`, implementing the `groupName` / `partName` adapters for that model's naming convention
4. Build (`npm run build`) or preview with `npm run dev`
