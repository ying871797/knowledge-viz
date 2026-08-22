/// <reference types="vitest/config" />
import { defineConfig } from "vite";

export default defineConfig({
  // 相对路径 base，适配 GitHub Pages 子路径部署
  base: "./",
  test: {
    environment: "jsdom",
  },
});
