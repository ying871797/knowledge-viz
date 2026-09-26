/// <reference types="vitest/config" />
import { defineConfig } from "vite";

export default defineConfig({
  // 相对路径 base，适配 GitHub Pages 子路径部署
  base: "./",
  test: {
    environment: "jsdom",
    // 允许测试中以 `?raw` 读取 CSS 源码（静态守卫用例 mobileScene.test.ts 需要），
    // 否则 vitest 默认会把 .css 导入 stub 为空模块
    css: true,
  },
});
