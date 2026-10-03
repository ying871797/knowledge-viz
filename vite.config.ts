/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import { configDefaults } from "vitest/config";

export default defineConfig({
  // 相对路径 base，适配 GitHub Pages 子路径部署
  base: "./",
  test: {
    environment: "jsdom",
    // 允许测试中以 `?raw` 读取 CSS 源码（静态守卫用例 mobileScene.test.ts 需要），
    // 否则 vitest 默认会把 .css 导入 stub 为空模块
    css: true,
    // 排除 .worktrees/：feat/fix 分支以 git worktree 形式挂在仓库内，默认会被 vitest
    // 的 include glob 扫到，导致从主检出跑 npm test 时同一批用例被重复执行（路径不同、
    // 用例名相同，数量翻倍）。展开 configDefaults.exclude 以保留 vitest 内置排除项
    // （node_modules/dist 等），仅在末尾追加本仓库的 worktree 目录。
    exclude: [...configDefaults.exclude, "**/.worktrees/**"],
  },
});
