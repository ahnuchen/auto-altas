import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  // 部署在根路径下（开发环境：http://localhost:3018/）
  base: "/",
  build: {
    // 产物输出到 dist，上传该目录即可
    outDir: "dist",
  },
  plugins: [react(), tailwindcss()],
});
