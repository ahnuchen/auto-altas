import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  // 部署在根路径下（开发环境：http://localhost:3018/）
  base: "/",
  // 构建时间戳注入产物：每次构建文件名 hash 必然变化，绕开 CDN/浏览器缓存的旧 404
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  build: {
    // 产物输出到 dist，上传该目录即可
    outDir: "dist",
  },
  plugins: [react(), tailwindcss()],
});
