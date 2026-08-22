// 路由冒烟测试（Task 9 手动验收的自动化替代）：
// jsdom 中设置 location.hash 并手动派发 hashchange，断言首页/课程页切换与清理函数生效。
// 注意：jsdom 对 location.hash 赋值的 hashchange 自动派发是异步且不可靠的，这里统一手动派发。
import { describe, it, expect, beforeEach } from "vitest";

/** 确保入口挂载点存在：main.ts 在导入时会立即执行 route() */
function ensureAppRoot(): void {
  if (!document.getElementById("app")) {
    const div = document.createElement("div");
    div.id = "app";
    document.body.appendChild(div);
  }
}

/** 切换 hash 并同步触发路由（手动派发 hashchange 事件） */
function go(hash: string): void {
  location.hash = hash;
  window.dispatchEvent(new HashChangeEvent("hashchange"));
}

describe("hash 路由", () => {
  beforeEach(() => {
    ensureAppRoot();
    // 归位到目录页，保证每个用例从已知状态开始
    go("#/");
  });

  it("导入入口模块后初始渲染目录页，列出减数分裂条目", async () => {
    await import("../src/main");
    const app = document.getElementById("app")!;
    expect(app.querySelector("h1")?.textContent).toBe("生物概念可视化讲解");
    const link = app.querySelector<HTMLAnchorElement>('.home-list a[href="#/course/meiosis"]');
    expect(link?.textContent).toContain("减数分裂");
  });

  it("进入课程页 → 返回首页 → 再次进入均正常（清理函数生效）", async () => {
    await import("../src/main");
    const app = document.getElementById("app")!;

    // 进入课程页
    go("#/course/meiosis");
    expect(app.querySelector(".course-title")?.textContent).toContain("减数分裂");
    expect(app.querySelector(".back-link")).toBeTruthy();

    // 返回首页：课程页 DOM 被整体重建为目录页（清理句柄已在 renderHome 内执行）
    go("#/");
    expect(app.querySelector(".home-list")).toBeTruthy();
    expect(app.querySelector(".course-title")).toBeNull();

    // 再次进入课程页仍正常渲染（验证销毁后可重复装配）
    go("#/course/meiosis");
    expect(app.querySelector(".course-title")?.textContent).toContain("减数分裂");

    // 浏览器后退等价场景：hash 变化回目录页
    go("#/");
    expect(app.querySelector(".home-list")).toBeTruthy();
  });

  it("未知课程 id 回退到目录页", async () => {
    await import("../src/main");
    const app = document.getElementById("app")!;
    go("#/course/nonexistent");
    expect(app.querySelector(".home-list")).toBeTruthy();
  });
});
