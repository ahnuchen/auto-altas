import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  // 部署在 /auto-atlas/ 子路径下（开发环境同样生效：http://localhost:3018/auto-atlas/）
  base: "/auto-atlas/",
  build: {
    // 产物输出到 dist/auto-atlas，上传该目录即可
    outDir: "dist/auto-atlas",
  },
  plugins: [react(), tailwindcss()],
});
